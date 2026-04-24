-- ============================================================
-- BRO Resolve Base — Migração 001
-- Rodar no SQL Editor do Supabase (ou via psql)
-- ============================================================

-- ── 1. Ajuste tabela leads existente ────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_bot TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_humano TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS corrigido BOOLEAN DEFAULT false;

-- Backfill: copiar area → area_bot onde ainda não preenchido
-- NOTA: Em bases grandes no free tier, considerar rodar em batches
-- com LIMIT (ex: UPDATE leads SET area_bot = area WHERE area_bot IS NULL LIMIT 1000)
UPDATE leads SET area_bot = area WHERE area_bot IS NULL;

-- ── 2. Tabela atendimentos ──────────────────────────────────
CREATE TABLE IF NOT EXISTS atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  delegado_de UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'aberto',
  classificacao_entrada TEXT,
  classificacao_final TEXT,
  valor_estimado NUMERIC,
  assumido_em TIMESTAMPTZ DEFAULT now(),
  encerrado_em TIMESTAMPTZ,
  UNIQUE(lead_id)
);

ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_atendimentos" ON atendimentos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_atendimentos" ON atendimentos
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_atendimentos_lead ON atendimentos(lead_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_owner ON atendimentos(owner_id);

-- ── 3. Tabela pot_tratamento ────────────────────────────────
CREATE TABLE IF NOT EXISTS pot_tratamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  operador_id UUID NOT NULL REFERENCES auth.users(id),
  proxima_acao TEXT,
  data_acao TIMESTAMPTZ,
  observacao TEXT,
  valor_estimado NUMERIC,
  valor_confirmado NUMERIC,
  data_recebimento TIMESTAMPTZ,
  status_financeiro TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pot_tratamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_pot_tratamento" ON pot_tratamento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_pot_tratamento" ON pot_tratamento
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pot_tratamento_lead ON pot_tratamento(lead_id);

-- ── 4. Tabela solicitacoes_clientes ─────────────────────────
CREATE TABLE IF NOT EXISTS solicitacoes_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  mensagem TEXT,
  categoria TEXT,
  categoria_humano TEXT,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE solicitacoes_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_solicitacoes" ON solicitacoes_clientes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_solicitacoes" ON solicitacoes_clientes
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_identity ON solicitacoes_clientes(identity_id);

-- ── 5. Tabela quick_replies ─────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atalho TEXT UNIQUE NOT NULL,
  conteudo TEXT NOT NULL,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  compartilhado BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_quick_replies" ON quick_replies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_quick_replies" ON quick_replies
  FOR SELECT TO authenticated USING (true);

-- ── 6. Tabela bot_feedback ──────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  area_bot TEXT NOT NULL,
  area_humano TEXT NOT NULL,
  operador_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_bot_feedback" ON bot_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_bot_feedback" ON bot_feedback
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bot_feedback_lead ON bot_feedback(lead_id);

-- ── 7. RLS nas tabelas existentes do bot (se ainda não habilitado) ──
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE others ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_channels ENABLE ROW LEVEL SECURITY;

-- Políticas para tabelas existentes (leitura para authenticated)
DO $
BEGIN
  -- leads
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'service_role_full_leads') THEN
    EXECUTE 'CREATE POLICY "service_role_full_leads" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'authenticated_read_leads') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_leads" ON leads FOR SELECT TO authenticated USING (true)';
  END IF;
  -- clients
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'service_role_full_clients') THEN
    EXECUTE 'CREATE POLICY "service_role_full_clients" ON clients FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'authenticated_read_clients') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_clients" ON clients FOR SELECT TO authenticated USING (true)';
  END IF;
  -- others
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'others' AND policyname = 'service_role_full_others') THEN
    EXECUTE 'CREATE POLICY "service_role_full_others" ON others FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'others' AND policyname = 'authenticated_read_others') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_others" ON others FOR SELECT TO authenticated USING (true)';
  END IF;
  -- abandonos
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abandonos' AND policyname = 'service_role_full_abandonos') THEN
    EXECUTE 'CREATE POLICY "service_role_full_abandonos" ON abandonos FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abandonos' AND policyname = 'authenticated_read_abandonos') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_abandonos" ON abandonos FOR SELECT TO authenticated USING (true)';
  END IF;
  -- identities
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'identities' AND policyname = 'service_role_full_identities') THEN
    EXECUTE 'CREATE POLICY "service_role_full_identities" ON identities FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'identities' AND policyname = 'authenticated_read_identities') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_identities" ON identities FOR SELECT TO authenticated USING (true)';
  END IF;
  -- identity_channels
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'identity_channels' AND policyname = 'service_role_full_identity_channels') THEN
    EXECUTE 'CREATE POLICY "service_role_full_identity_channels" ON identity_channels FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'identity_channels' AND policyname = 'authenticated_read_identity_channels') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_identity_channels" ON identity_channels FOR SELECT TO authenticated USING (true)';
  END IF;
END $;
