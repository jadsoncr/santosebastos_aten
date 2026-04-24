// src/storage/adapters/supabase.js
// Adapter Supabase — persistência no PostgreSQL via @supabase/supabase-js.
// Idempotência via ON CONFLICT (request_id) em leads/clients/others.
// Idempotência via ON CONFLICT (identity_id, ultimo_estado) em abandonos.
// NÃO loga — logging centralizado no storage/index.js wrap().
// NÃO gera request_id — sempre recebido no payload.

const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
function getClient() {
  if (!supabase) {
    supabase = createSupabaseClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// Helper: throw on any error except UNIQUE violation (23505)
function throwIfNotDuplicate(error, context) {
  if (!error) return;
  // 23505 = unique_violation — esperado para idempotência
  if (error.code === '23505') return;
  // Qualquer outro erro (23503 FK violation, etc) deve propagar
  throw new Error(`[supabase/${context}] ${error.message} (code: ${error.code})`);
}

async function createLead(data) {
  const db = getClient();
  const row = {
    identity_id: data.identity_id,
    request_id: data.request_id,
    nome: data.nome || null,
    telefone: data.telefone || null,
    area: data.area || null,
    urgencia: data.urgencia || null,
    score: data.score || 0,
    prioridade: data.prioridade || 'FRIO',
    flag_atencao: data.flagAtencao || false,
    canal_origem: data.canalOrigem || null,
    canal_preferido: data.canalPreferido || null,
    resumo: data.resumo || null,
    metadata: data.metadata || null,
    status: data.status || 'NOVO',
  };

  const { data: inserted, error } = await db
    .from('leads')
    .upsert(row, { onConflict: 'request_id', ignoreDuplicates: true })
    .select('id')
    .single();

  throwIfNotDuplicate(error, 'createLead');

  if (!inserted) {
    const { data: existing } = await db
      .from('leads')
      .select('id')
      .eq('request_id', data.request_id)
      .single();
    return existing?.id || data.leadId;
  }
  return inserted.id;
}

async function createClient(data) {
  const db = getClient();
  const row = {
    identity_id: data.identity_id,
    request_id: data.request_id,
    nome: data.nome || null,
    telefone: data.telefone || null,
    urgencia: data.urgencia || null,
    conteudo: data.conteudo || null,
    canal_origem: data.canalOrigem || null,
    flag_atencao: data.flagAtencao || false,
    metadata: data.metadata || null,
    status: data.status || 'NOVO',
  };

  const { data: inserted, error } = await db
    .from('clients')
    .upsert(row, { onConflict: 'request_id', ignoreDuplicates: true })
    .select('id')
    .single();

  throwIfNotDuplicate(error, 'createClient');

  if (!inserted) {
    const { data: existing } = await db
      .from('clients')
      .select('id')
      .eq('request_id', data.request_id)
      .single();
    return existing?.id || data.leadId;
  }
  return inserted.id;
}

async function createOther(data) {
  const db = getClient();
  const row = {
    identity_id: data.identity_id,
    request_id: data.request_id,
    nome: data.nome || null,
    telefone: data.telefone || null,
    tipo: data.tipo || null,
    conteudo: data.conteudo || null,
    canal_origem: data.canalOrigem || null,
    metadata: data.metadata || null,
    status: data.status || 'NOVO',
  };

  const { data: inserted, error } = await db
    .from('others')
    .upsert(row, { onConflict: 'request_id', ignoreDuplicates: true })
    .select('id')
    .single();

  throwIfNotDuplicate(error, 'createOther');

  if (!inserted) {
    const { data: existing } = await db
      .from('others')
      .select('id')
      .eq('request_id', data.request_id)
      .single();
    return existing?.id || data.leadId;
  }
  return inserted.id;
}

function classificarAbandono(ultimoEstado) {
  const finais = ['coleta_nome', 'contato_confirmacao', 'contato_numero', 'contato_canal'];
  const iniciais = ['start', 'fallback'];
  if (iniciais.includes(ultimoEstado)) return 'PRECOCE';
  if (finais.includes(ultimoEstado)) return 'VALIOSO';
  return 'MEDIO';
}

async function createAbandono(data) {
  const db = getClient();
  const ultimoEstado = data.ultimoEstado || data.ultimo_estado || '';
  const row = {
    identity_id: data.identity_id,
    request_id: data.request_id,
    fluxo: data.fluxo || null,
    ultimo_estado: ultimoEstado,
    score: data.score || 0,
    prioridade: data.prioridade || 'FRIO',
    nome: data.nome || null,
    canal_origem: data.canalOrigem || null,
    mensagens_enviadas: data.mensagensEnviadas || 0,
    classificacao: classificarAbandono(ultimoEstado),
  };

  const { error } = await db
    .from('abandonos')
    .upsert(row, { onConflict: 'identity_id,ultimo_estado', ignoreDuplicates: true });

  throwIfNotDuplicate(error, 'createAbandono');
}

module.exports = { createLead, createClient, createOther, createAbandono };
