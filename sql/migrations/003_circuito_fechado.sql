-- ============================================================
-- BRO Resolve — Migração 003: Circuito Fechado
-- Tabela repescagem + coluna motivo_perda em atendimentos
-- ============================================================

-- ── 1. Tabela repescagem ────────────────────────────────────
CREATE TABLE IF NOT EXISTS repescagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  operador_id UUID NOT NULL REFERENCES auth.users(id),
  motivo TEXT NOT NULL,
  data_retorno DATE,
  observacao TEXT,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE repescagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_repescagem" ON repescagem;
CREATE POLICY "service_role_full_repescagem" ON repescagem
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_repescagem" ON repescagem;
CREATE POLICY "authenticated_read_repescagem" ON repescagem
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_repescagem" ON repescagem;
CREATE POLICY "authenticated_insert_repescagem" ON repescagem
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_repescagem_lead ON repescagem(lead_id);
CREATE INDEX IF NOT EXISTS idx_repescagem_status ON repescagem(status);

-- ── 2. Coluna motivo_perda em atendimentos ──────────────────
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS motivo_perda TEXT;

-- ── 3. Policy de INSERT para authenticated em atendimentos ──
-- (necessário para o ASSUMIR funcionar via anon key do browser)
DROP POLICY IF EXISTS "authenticated_insert_atendimentos" ON atendimentos;
CREATE POLICY "authenticated_insert_atendimentos" ON atendimentos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_atendimentos" ON atendimentos;
CREATE POLICY "authenticated_update_atendimentos" ON atendimentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 4. Policy de INSERT para authenticated em clients ───────
DROP POLICY IF EXISTS "authenticated_insert_clients" ON clients;
CREATE POLICY "authenticated_insert_clients" ON clients
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 5. Policy de INSERT para authenticated em pot_tratamento ─
DROP POLICY IF EXISTS "authenticated_insert_pot_tratamento" ON pot_tratamento;
CREATE POLICY "authenticated_insert_pot_tratamento" ON pot_tratamento
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 6. Policy de UPDATE para authenticated em leads ─────────
DROP POLICY IF EXISTS "authenticated_update_leads" ON leads;
CREATE POLICY "authenticated_update_leads" ON leads
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 7. Policy de INSERT para authenticated em bot_feedback ───
DROP POLICY IF EXISTS "authenticated_insert_bot_feedback" ON bot_feedback;
CREATE POLICY "authenticated_insert_bot_feedback" ON bot_feedback
  FOR INSERT TO authenticated WITH CHECK (true);
