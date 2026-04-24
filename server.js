require('dotenv').config();

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const normalize = require('./src/normalizer');
const { process: processar } = require('./src/stateMachine');
const { buildResponse } = require('./src/responder');
const sessionManager = require('./src/sessionManager');
const { createAbandono } = require('./src/storage');
const { resolveIdentity } = require('./src/identityResolver');
const { ESTADOS_FINAIS } = require('./src/sessionManager');
const { getSupabase } = require('./src/supabaseAdmin');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function sendTelegram(chat_id, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text }),
  });
}

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    // Detectar origem: Telegram ou padrão (n8n/WhatsApp)
    const isTelegram = !!(req.body.message || req.body.edited_message);
    const tgMsg = req.body.message || req.body.edited_message;

    let body = req.body;
    if (isTelegram) {
      if (!tgMsg.text) {
        // áudio, foto, sticker, etc — tratamento progressivo por nível
        const chatId = String(tgMsg.chat.id);
        let audioIdentityId;
        try {
          audioIdentityId = await resolveIdentity('telegram', chatId, null);
        } catch (_) {
          await sendTelegram(chatId, 'Erro interno. Tente novamente.');
          return res.sendStatus(200);
        }
        const sess = await sessionManager.getSession(audioIdentityId, 'telegram', chatId);
        const count = (sess.audioCount || 0) + 1;
        await sessionManager.updateSession(audioIdentityId, { audioCount: count });

        let msg;
        if (count === 1) {
          msg = 'Perfeito 👍 recebi seu áudio.\n\nVou encaminhar para um advogado ouvir — mas pra agilizar, me diz:\n\n1️⃣ Problema no trabalho\n2️⃣ Questão de família\n3️⃣ Já sou cliente\n4️⃣ Quero falar com advogado\n5️⃣ Outro assunto';
        } else if (count === 2) {
          msg = 'Recebi 👍 Um advogado vai ouvir seu áudio.\n\nEnquanto isso, qual opção descreve melhor seu caso?\n\n1️⃣ Trabalho\n2️⃣ Família\n3️⃣ Já sou cliente\n4️⃣ Falar com advogado\n5️⃣ Outro';
        } else {
          msg = 'Pra te ajudar agora 👍\n\nPreciso que escolha uma opção:\n\n1 - Trabalho\n2 - Família\n3 - Já sou cliente\n4 - Advogado\n5 - Outro';
        }

        await sendTelegram(chatId, msg);
        return res.sendStatus(200);
      }
      body = {
        sessao: String(tgMsg.chat.id),
        mensagem: tgMsg.text,
        canal: 'telegram',
      };
    }

    const { sessao, mensagem, canal } = normalize(body);

    if (!sessao) {
      return res.status(400).json({ error: 'Campo "sessao" é obrigatório.' });
    }

    // Resolver identidade unificada
    // Telegram: telefone = null (API não fornece). Merge cross-canal só quando fluxo coleta número.
    const telefone = body.telefone || null;
    const channel = isTelegram ? 'telegram' : (canal || 'whatsapp');
    const channel_user_id = sessao;

    let identity_id;
    try {
      identity_id = await resolveIdentity(channel, channel_user_id, telefone);
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        msg: 'identity_resolve_fail',
        channel,
        channel_user_id,
        erro: err.message,
        ts: new Date().toISOString(),
      }));
      if (isTelegram) return res.sendStatus(200);
      return res.status(500).json({ error: 'Erro ao resolver identidade.' });
    }

    // Usar identity_id como chave de sessão, com legacy_id para migração lazy
    const sessAntes = await sessionManager.getSession(identity_id, canal, sessao);

    const resultado = await processar(identity_id, mensagem, canal);

    // Incrementa contador de mensagens
    await sessionManager.updateSession(identity_id, {
      mensagensEnviadas: (sessAntes.mensagensEnviadas || 0) + 1,
      statusSessao: ESTADOS_FINAIS.includes(resultado.estado) ? 'FINALIZADO' : 'ATIVO',
    });
    const resposta = buildResponse(resultado);

    // ── Persistir mensagens na tabela mensagens ──────────────────────────
    try {
      const sessaoAtual = await sessionManager.getSession(identity_id);
      if (sessaoAtual && sessaoAtual.leadId) {
        const db = getSupabase();
        // Mensagem recebida do lead
        await db.from('mensagens').insert({
          lead_id: sessaoAtual.leadId,
          de: channel_user_id,
          tipo: 'mensagem',
          conteudo: mensagem,
        });
        // Resposta do bot
        await db.from('mensagens').insert({
          lead_id: sessaoAtual.leadId,
          de: 'bot',
          tipo: 'mensagem',
          conteudo: resposta.message,
        });
        // Broadcast via Socket.io
        io.emit('nova_mensagem_salva', {
          lead_id: sessaoAtual.leadId,
          de: channel_user_id,
          tipo: 'mensagem',
          conteudo: mensagem,
          created_at: new Date().toISOString(),
        });
        io.emit('nova_mensagem_salva', {
          lead_id: sessaoAtual.leadId,
          de: 'bot',
          tipo: 'mensagem',
          conteudo: resposta.message,
          created_at: new Date().toISOString(),
        });
      }
    } catch (msgErr) {
      // Falha de persistência de mensagem não bloqueia o fluxo
      console.error(JSON.stringify({
        level: 'warn',
        msg: 'mensagem_persist_fail',
        identity_id,
        erro: msgErr.message,
        ts: new Date().toISOString(),
      }));
    }

    if (isTelegram) {
      await sendTelegram(tgMsg.chat.id, resposta.message);
      return res.sendStatus(200);
    }

    return res.json(resposta);

  } catch (err) {
    console.error('[webhook error]', err);
    if (req.body.message || req.body.edited_message) return res.sendStatus(200);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

// Health check para Railway
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Admin: visibilidade de sessões em produção ──────────────────────────────
// Protegido por ADMIN_TOKEN (defina na Railway)
function adminAuth(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN não configurado.' });
  if (req.headers['x-admin-token'] !== token) return res.status(401).json({ error: 'Não autorizado.' });
  next();
}

app.get('/admin/sessions', adminAuth, async (_req, res) => {
  const { _getAll } = require('./src/storage');
  const { sessions } = _getAll();
  const agora = Date.now();

  const lista = Object.values(sessions).map(s => ({
    sessao:           s.sessao,
    estado:           s.estadoAtual,
    fluxo:            s.fluxo || '—',
    score:            s.score || 0,
    prioridade:       s.prioridade || 'FRIO',
    status:           s.statusSessao || 'ATIVO',
    nome:             s.nome || '—',
    canal:            s.canalOrigem || '—',
    mensagens:        s.mensagensEnviadas || 0,
    ultimaMensagem:   s.ultimaMensagem || '—',
    inatividade_min:  s.atualizadoEm
      ? Math.floor((agora - new Date(s.atualizadoEm).getTime()) / 60000)
      : null,
    atualizadoEm:     s.atualizadoEm || null,
  }));

  // ordena por mais recente
  lista.sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));

  const resumo = {
    total:       lista.length,
    ativos:      lista.filter(s => s.status === 'ATIVO').length,
    finalizados: lista.filter(s => s.status === 'FINALIZADO').length,
    abandonados: lista.filter(s => s.status === 'ABANDONOU').length,
    quentes:     lista.filter(s => s.prioridade === 'QUENTE').length,
  };

  return res.json({ resumo, sessoes: lista });
});


// ─── HTTP Server + Socket.io ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
  },
});

// ─── Socket.io handlers ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] conectado: ${socket.id}`);

  // Assumir lead — atômico via UNIQUE(lead_id)
  socket.on('assumir_lead', async ({ lead_id, operador_id }) => {
    const db = getSupabase();
    const { error } = await db
      .from('atendimentos')
      .insert({ lead_id, owner_id: operador_id, status: 'aberto' });

    if (error) {
      if (error.code === '23505') {
        socket.emit('erro_assumir', { mensagem: 'Este lead já foi assumido por outro operador.' });
        return;
      }
      socket.emit('erro_assumir', { mensagem: error.message });
      return;
    }
    io.emit('lead_assumido', { lead_id, operador_id });
  });

  // Delegar lead
  socket.on('delegar_lead', async ({ lead_id, operador_id_origem, operador_id_destino }) => {
    const db = getSupabase();
    await db
      .from('atendimentos')
      .update({ owner_id: operador_id_destino, delegado_de: operador_id_origem })
      .eq('lead_id', lead_id);
    io.emit('lead_delegado', { lead_id, operador_id_destino });
  });

  // Nova mensagem (do operador humano)
  socket.on('nova_mensagem', async ({ lead_id, de, conteudo, tipo, operador_id, origem }) => {
    const db = getSupabase();
    const { data, error } = await db
      .from('mensagens')
      .insert({ lead_id, de, conteudo, tipo: tipo || 'mensagem', operador_id })
      .select()
      .single();

    if (!error && data) {
      io.emit('nova_mensagem_salva', data);
    }
    // origem === 'humano' → NÃO processar pela state machine
  });

  // Status do operador
  socket.on('operador_status', ({ operador_id, status }) => {
    io.emit('operador_status_atualizado', { operador_id, status });
  });

  // Lead encerrado — broadcast para remover da fila de todos
  socket.on('lead_encerrado', ({ lead_id, tipo }) => {
    io.emit('lead_encerrado', { lead_id, tipo });
  });

  socket.on('disconnect', () => {
    console.log(`[socket] desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Storage adapter: ${process.env.STORAGE_ADAPTER || 'memory'}`);
  console.log(`Socket.io CORS: ${process.env.WEB_URL || 'http://localhost:3001'}`);
});
