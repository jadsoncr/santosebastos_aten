// src/storage/config.js
// Configuração centralizada do storage adapter.
// Lê STORAGE_ADAPTER do ambiente, valida, e exporta.

const VALID_ADAPTERS = ['memory', 'sheets', 'supabase'];

function getConfig() {
  const raw = process.env.STORAGE_ADAPTER || 'memory';
  let adapter = raw.trim().toLowerCase();

  if (!VALID_ADAPTERS.includes(adapter)) {
    console.warn(`[storage/config] STORAGE_ADAPTER="${raw}" não reconhecido. Usando "memory" como fallback.`);
    adapter = 'memory';
  }

  if (adapter === 'supabase') {
    const missing = [];
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_KEY) missing.push('SUPABASE_KEY');
    if (missing.length > 0) {
      throw new Error(`[storage/config] Adapter "supabase" requer variáveis de ambiente: ${missing.join(', ')}`);
    }
  }

  return { adapter };
}

module.exports = { getConfig };
