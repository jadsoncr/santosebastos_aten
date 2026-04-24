-- sql/schema.sql
-- Schema para Supabase (PostgreSQL). Rodar no SQL Editor do Supabase.
-- 6 tabelas: identities, identity_channels, leads, clients, others, abandonos

-- Identidades unificadas
CREATE TABLE IF NOT EXISTS identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT UNIQUE,
  nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Canais por identidade
CREATE TABLE IF NOT EXISTS identity_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  channel TEXT NOT NULL,
  channel_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel, channel_user_id)
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  request_id TEXT UNIQUE NOT NULL,
  nome TEXT,
  telefone TEXT,
  area TEXT,
  urgencia TEXT,
  score INTEGER DEFAULT 0,
  prioridade TEXT DEFAULT 'FRIO',
  flag_atencao BOOLEAN DEFAULT false,
  canal_origem TEXT,
  canal_preferido TEXT,
  resumo TEXT,
  metadata JSONB,
  status TEXT DEFAULT 'NOVO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  request_id TEXT UNIQUE NOT NULL,
  nome TEXT,
  telefone TEXT,
  urgencia TEXT,
  conteudo TEXT,
  canal_origem TEXT,
  flag_atencao BOOLEAN DEFAULT false,
  metadata JSONB,
  status TEXT DEFAULT 'NOVO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Others
CREATE TABLE IF NOT EXISTS others (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  request_id TEXT UNIQUE NOT NULL,
  nome TEXT,
  telefone TEXT,
  tipo TEXT,
  conteudo TEXT,
  canal_origem TEXT,
  metadata JSONB,
  status TEXT DEFAULT 'NOVO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Abandonos
CREATE TABLE IF NOT EXISTS abandonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  request_id TEXT NOT NULL,
  fluxo TEXT,
  ultimo_estado TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  prioridade TEXT DEFAULT 'FRIO',
  nome TEXT,
  canal_origem TEXT,
  mensagens_enviadas INTEGER DEFAULT 0,
  classificacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identity_id, ultimo_estado),
  CHECK (ultimo_estado IS NOT NULL)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_identity ON leads(identity_id);
CREATE INDEX IF NOT EXISTS idx_clients_identity ON clients(identity_id);
CREATE INDEX IF NOT EXISTS idx_others_identity ON others(identity_id);
CREATE INDEX IF NOT EXISTS idx_abandonos_identity ON abandonos(identity_id);
CREATE INDEX IF NOT EXISTS idx_identity_channels_identity ON identity_channels(identity_id);
