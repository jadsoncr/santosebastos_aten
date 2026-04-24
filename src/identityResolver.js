// src/identityResolver.js
// Resolve identidade unificada multi-canal.
// Busca por (channel, channel_user_id) → por telefone → cria novo.
// THROW em caso de falha — bloqueia o fluxo.
// telefone chega null do Telegram por padrão. Merge cross-canal só quando fluxo coleta telefone.
// Usa Supabase quando STORAGE_ADAPTER=supabase, senão in-memory.

const { randomUUID } = require('crypto');
const { getConfig } = require('./storage/config');

const config = getConfig();
const useSupabase = config.adapter === 'supabase';

// ─── Supabase client (lazy) ───────────────────────────────────────────────

let supabase;
function getSupabase() {
  if (!supabase) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return supabase;
}

// ─── In-memory stores (dev/test/sheets) ───────────────────────────────────

const identities = new Map();
const identityChannels = new Map();
const phoneIndex = new Map();

// ─── Supabase implementation ──────────────────────────────────────────────

async function resolveIdentitySupabase(channel, channel_user_id, telefone) {
  const db = getSupabase();

  // 1. Buscar por canal
  const { data: channelRow, error: chErr } = await db
    .from('identity_channels')
    .select('identity_id')
    .eq('channel', channel)
    .eq('channel_user_id', channel_user_id)
    .maybeSingle();

  if (chErr) throw new Error(`[identityResolver] busca por canal falhou: ${chErr.message}`);
  if (channelRow) return channelRow.identity_id;

  // 2. Buscar por telefone (merge cross-canal)
  if (telefone) {
    const { data: phoneRow, error: phErr } = await db
      .from('identities')
      .select('id')
      .eq('telefone', telefone)
      .maybeSingle();

    if (phErr) throw new Error(`[identityResolver] busca por telefone falhou: ${phErr.message}`);

    if (phoneRow) {
      const { error: linkErr } = await db
        .from('identity_channels')
        .upsert(
          { identity_id: phoneRow.id, channel, channel_user_id },
          { onConflict: 'channel,channel_user_id', ignoreDuplicates: true }
        );
      if (linkErr) throw new Error(`[identityResolver] vinculação de canal falhou: ${linkErr.message}`);
      return phoneRow.id;
    }
  }

  // 3. Criar nova identidade
  const insertPayload = telefone ? { telefone } : {};
  const { data: newIdentity, error: idErr } = await db
    .from('identities')
    .insert(insertPayload)
    .select('id')
    .single();

  if (idErr) throw new Error(`[identityResolver] criação de identidade falhou: ${idErr.message}`);

  // Vincular canal
  const { error: linkErr } = await db
    .from('identity_channels')
    .insert({ identity_id: newIdentity.id, channel, channel_user_id });

  if (linkErr) throw new Error(`[identityResolver] vinculação de canal falhou: ${linkErr.message}`);

  return newIdentity.id;
}

// ─── In-memory implementation ─────────────────────────────────────────────

async function resolveIdentityMemory(channel, channel_user_id, telefone) {
  const channelKey = `${channel}:${channel_user_id}`;

  const existing = identityChannels.get(channelKey);
  if (existing) return existing.identity_id;

  if (telefone) {
    const existingByPhone = phoneIndex.get(telefone);
    if (existingByPhone) {
      identityChannels.set(channelKey, {
        identity_id: existingByPhone, channel, channel_user_id,
        created_at: new Date().toISOString(),
      });
      return existingByPhone;
    }
  }

  const identity_id = randomUUID();
  identities.set(identity_id, {
    id: identity_id, telefone: telefone || null,
    created_at: new Date().toISOString(),
  });
  if (telefone) phoneIndex.set(telefone, identity_id);

  identityChannels.set(channelKey, {
    identity_id, channel, channel_user_id,
    created_at: new Date().toISOString(),
  });

  return identity_id;
}

// ─── Public API ───────────────────────────────────────────────────────────

async function resolveIdentity(channel, channel_user_id, telefone = null) {
  if (!channel || !channel_user_id) {
    throw new Error('[identityResolver] channel e channel_user_id são obrigatórios');
  }

  if (useSupabase) {
    return resolveIdentitySupabase(channel, channel_user_id, telefone);
  }
  return resolveIdentityMemory(channel, channel_user_id, telefone);
}

async function updateIdentityPhone(identity_id, telefone) {
  if (!telefone) return;

  if (useSupabase) {
    const db = getSupabase();
    const { error } = await db
      .from('identities')
      .update({ telefone })
      .eq('id', identity_id)
      .is('telefone', null);
    if (error) throw new Error(`[identityResolver] updateIdentityPhone falhou: ${error.message}`);
    return;
  }

  const identity = identities.get(identity_id);
  if (!identity || identity.telefone) return;
  identity.telefone = telefone;
  phoneIndex.set(telefone, identity_id);
}

function _clear() {
  identities.clear();
  identityChannels.clear();
  phoneIndex.clear();
}

function _getAll() {
  return {
    identities: Object.fromEntries(identities),
    identityChannels: Object.fromEntries(identityChannels),
  };
}

module.exports = { resolveIdentity, updateIdentityPhone, _clear, _getAll };
