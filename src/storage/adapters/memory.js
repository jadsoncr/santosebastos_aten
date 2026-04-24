// src/storage/adapters/memory.js
// Adapter in-memory. Dados perdidos ao reiniciar (aceito para dev/teste).
// Exporta getSession/updateSession (consumidos diretamente pelo sessionManager).
// Exporta createLead/createClient/createOther/createAbandono (consumidos via storage/index).

const { randomUUID } = require('crypto');

const sessions = new Map();
const leads = [];
const clients = [];
const others = [];
const abandonos = [];

// ─── Sessões (consumidas diretamente pelo sessionManager) ─────────────────

async function getSession(sessao) {
  return sessions.get(sessao) || null;
}

async function updateSession(sessao, data) {
  const current = sessions.get(sessao) || {};
  sessions.set(sessao, { ...current, ...data, sessao });
}

// ─── Classificação de abandono ────────────────────────────────────────────

function classificarAbandono(ultimoEstado) {
  const finais = ['coleta_nome', 'contato_confirmacao', 'contato_numero', 'contato_canal'];
  const iniciais = ['start', 'fallback'];
  if (iniciais.includes(ultimoEstado)) return 'PRECOCE';
  if (finais.includes(ultimoEstado)) return 'VALIOSO';
  return 'MEDIO';
}

// ─── Persistência ─────────────────────────────────────────────────────────

async function createLead(data) {
  const leadId = data.leadId || randomUUID();
  leads.push({ ...data, leadId, dataHora: new Date().toISOString() });
  return leadId;
}

async function createClient(data) {
  const leadId = data.leadId || randomUUID();
  clients.push({ ...data, leadId, dataHora: new Date().toISOString() });
  return leadId;
}

async function createOther(data) {
  const leadId = data.leadId || randomUUID();
  others.push({ ...data, leadId, dataHora: new Date().toISOString() });
  return leadId;
}

async function createAbandono(data) {
  abandonos.push({
    ...data,
    classificacao: classificarAbandono(data.ultimoEstado || data.ultimo_estado || ''),
    dataHora: new Date().toISOString(),
  });
}

// ─── Helpers para testes e admin ──────────────────────────────────────────

function _clear() {
  sessions.clear();
  leads.length = 0;
  clients.length = 0;
  others.length = 0;
  abandonos.length = 0;
}

function _getAll() {
  return {
    sessions: Object.fromEntries(sessions),
    leads,
    clients,
    others,
    abandonos,
  };
}

module.exports = {
  getSession,
  updateSession,
  createLead,
  createClient,
  createOther,
  createAbandono,
  classificarAbandono,
  _clear,
  _getAll,
};
