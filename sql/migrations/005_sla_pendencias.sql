-- ============================================================
-- BRO Resolve — Migração 005: SLA e Pendências
-- ============================================================

CREATE TABLE IF NOT EXISTS pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  operador_id UUID NOT NULL REFERENCES auth.users(id),
  tipo TEXT NOT NULL,
  prazo_sla TIMESTAMPTZ NOT NULL,
  taxa_reajuste NUMERIC,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pendencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_pendencias" ON pendencias;
CREATE POLICY "service_role_full_pendencias" ON pendencias FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_pendencias" ON pendencias;
CREATE POLICY "authenticated_read_pendencias" ON pendencias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_pendencias" ON pendencias;
CREATE POLICY "authenticated_insert_pendencias" ON pendencias FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_pendencias" ON pendencias;
CREATE POLICY "authenticated_update_pendencias" ON pendencias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pendencias_lead ON pendencias(lead_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_status ON pendencias(status);

ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS tipo_espera TEXT;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS prazo_sla TIMESTAMPTZ;
