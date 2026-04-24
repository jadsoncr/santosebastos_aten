// src/storage/index.js
// Firewall arquitetural — único ponto de acesso para persistência.
// Seleciona adapter via config, valida contrato, wrap() com logging centralizado.
// NUNCA exporta getSession/updateSession.
// Logs NUNCA contêm PII (nome, telefone) — só request_id, identity_id, fn, adapter, error, ts.

const { getConfig } = require('./config');
const memory = require('./adapters/memory');

const config = getConfig();

// ─── Carregar adapter selecionado ─────────────────────────────────────────

const adapters = { memory };

// Lazy-load sheets e supabase para evitar erros de import quando não configurados
try { adapters.sheets = require('./adapters/sheets'); } catch (_) {}
try { adapters.supabase = require('./adapters/supabase'); } catch (_) {}

const selected = adapters[config.adapter];
if (!selected) {
  throw new Error(`[storage/index] Adapter "${config.adapter}" não encontrado.`);
}

// ─── Validar contrato ─────────────────────────────────────────────────────

const REQUIRED_FNS = ['createLead', 'createClient', 'createOther', 'createAbandono'];

for (const fn of REQUIRED_FNS) {
  if (typeof selected[fn] !== 'function') {
    throw new Error(`[storage/index] Adapter "${config.adapter}" não implementa ${fn}().`);
  }
}

console.log(`[storage/index] Adapter ativo: ${config.adapter}`);

// ─── Validação de payload na fronteira ────────────────────────────────────

const REQUIRED_FIELDS = {
  createLead:     ['identity_id', 'nome', 'request_id'],
  createClient:   ['identity_id', 'nome', 'request_id'],
  createOther:    ['identity_id', 'nome', 'request_id'],
  createAbandono: ['identity_id', 'ultimo_estado', 'request_id'],
};

function validatePayload(operacao, payload) {
  const required = REQUIRED_FIELDS[operacao] || [];
  const missing = required.filter(f => payload[f] === undefined || payload[f] === null);
  if (missing.length > 0) {
    console.warn(JSON.stringify({
      level: 'warn',
      msg: 'payload_missing_fields',
      adapter: config.adapter,
      operacao,
      missing,
      request_id: payload.request_id || null,
      identity_id: payload.identity_id || null,
      ts: new Date().toISOString(),
    }));
  }
}

// ─── Wrap com logging centralizado ────────────────────────────────────────

function wrap(fn, operacao) {
  return async (payload) => {
    validatePayload(operacao, payload || {});
    const start = Date.now();
    try {
      const result = await selected[fn](payload);
      console.log(JSON.stringify({
        level: 'info',
        adapter: config.adapter,
        operacao,
        request_id: payload?.request_id || null,
        identity_id: payload?.identity_id || null,
        resultado: 'ok',
        duracao_ms: Date.now() - start,
        ts: new Date().toISOString(),
      }));
      return result;
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        adapter: config.adapter,
        operacao,
        request_id: payload?.request_id || null,
        identity_id: payload?.identity_id || null,
        erro: err.message,
        ts: new Date().toISOString(),
      }));
      throw err;
    }
  };
}

// ─── Interface pública ────────────────────────────────────────────────────

module.exports = {
  createLead:     wrap('createLead', 'createLead'),
  createClient:   wrap('createClient', 'createClient'),
  createOther:    wrap('createOther', 'createOther'),
  createAbandono: wrap('createAbandono', 'createAbandono'),
  _getAll:        memory._getAll,
  _clear:         memory._clear,
};
