// src/sessionManager.js
// Fachada para operações de sessão.
// Sessões em memória via adapter memory (direto).
// Persistência de abandono via storage/index (firewall).

const memory = require('./storage/adapters/memory');
const storage = require('./storage');

// Estados finais — importados da stateMachine conceptualmente, definidos aqui para evitar dep circular
const ESTADOS_FINAIS = ['pos_final', 'encerramento', 'final_lead', 'final_cliente'];

const SWEEP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const TTL_MS = 60 * 60 * 1000; // 60 minutos

/**
 * Retorna sessão existente ou cria nova com estado 'inicio'.
 * Suporta lazy migration: se user_id não encontrar, tenta legacy_id.
 */
async function getSession(user_id, canalOrigem, legacy_id) {
  // Lazy migration: sessões antigas usam telegram_id como chave
  if (memory.getSession) {
    const existing = await memory.getSession(user_id);
    if (existing) return existing;

    if (legacy_id) {
      const legacy = await memory.getSession(legacy_id);
      if (legacy) {
        await memory.updateSession(user_id, { ...legacy, sessao: user_id });
        // Remover sessão antiga
        const all = await memory._getAll();
        if (all.sessions[legacy_id]) {
          delete all.sessions[legacy_id];
        }
        return await memory.getSession(user_id);
      }
    }
  }

  const nova = {
    sessao: user_id,
    estadoAtual: 'start',
    fluxo: null,
    area: null,
    situacao: null,
    impacto: null,
    intencao: null,
    nome: null,
    canalOrigem: canalOrigem || 'desconhecido',
    canalPreferido: null,
    ultimaMensagem: null,
    ultimaPergunta: null,
    score: 0,
    prioridade: 'FRIO',
    flagAtencao: false,
    statusSessao: 'ATIVO',
    mensagensEnviadas: 0,
    atualizadoEm: new Date().toISOString(),
  };

  await memory.updateSession(user_id, nova);
  return nova;
}

/**
 * Atualiza campos específicos de uma sessão.
 */
async function updateSession(sessao, data) {
  await memory.updateSession(sessao, {
    ...data,
    atualizadoEm: new Date().toISOString(),
  });
}

/**
 * Reseta sessão para o estado inicial.
 */
async function resetSession(sessao, canalOrigem) {
  const existing = await memory.getSession(sessao);
  await memory.updateSession(sessao, {
    estadoAtual: 'start',
    fluxo: null,
    area: null,
    situacao: null,
    impacto: null,
    intencao: null,
    nome: null,
    canalPreferido: null,
    ultimaMensagem: null,
    ultimaPergunta: null,
    score: 1,
    prioridade: 'FRIO',
    flagAtencao: existing ? existing.flagAtencao : false,
    atualizadoEm: new Date().toISOString(),
  });
  return getSession(sessao, canalOrigem);
}

// ─── Sweep TTL ────────────────────────────────────────────────────────────

async function sweepExpiredSessions() {
  const { sessions } = memory._getAll();
  const agora = Date.now();

  for (const [userId, session] of Object.entries(sessions)) {
    // Ignorar sessões em estados finais
    if (ESTADOS_FINAIS.includes(session.estadoAtual)) continue;
    // Ignorar sessões já marcadas como abandono
    if (session.statusSessao === 'ABANDONOU') continue;
    // Ignorar sessões sem timestamp
    if (!session.atualizadoEm) continue;

    const diff = agora - new Date(session.atualizadoEm).getTime();
    if (diff < TTL_MS) continue;

    try {
      const { randomUUID } = require('crypto');
      await storage.createAbandono({
        identity_id: userId,
        request_id: randomUUID(),
        fluxo: session.fluxo || '',
        ultimoEstado: session.estadoAtual || '',
        ultimo_estado: session.estadoAtual || '',
        score: session.score || 0,
        prioridade: session.prioridade || 'FRIO',
        nome: session.nome || '',
        canalOrigem: session.canalOrigem || '',
        mensagensEnviadas: session.mensagensEnviadas || 0,
      });
      await memory.updateSession(userId, { statusSessao: 'ABANDONOU' });
      // Remover da memória após marcar
      const all = memory._getAll();
      delete all.sessions[userId];
    } catch (err) {
      // Falha de persistência: manter sessão para retry no próximo ciclo
      console.error(JSON.stringify({
        level: 'error',
        msg: 'sweep_abandono_fail',
        identity_id: userId,
        erro: err.message,
        ts: new Date().toISOString(),
      }));
    }
  }
}

// Iniciar sweep (não bloqueia startup)
const _sweepTimer = setInterval(sweepExpiredSessions, SWEEP_INTERVAL_MS);
// Permitir que o processo termine sem esperar o timer
if (_sweepTimer.unref) _sweepTimer.unref();

module.exports = { getSession, updateSession, resetSession, sweepExpiredSessions, ESTADOS_FINAIS };
