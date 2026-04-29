-- ============================================================
-- Migração 016: Collaborative Assignment
-- Tabela assignment_logs para audit trail de atribuições
-- Idempotente: todas as operações usam IF NOT EXISTS
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 1: Tabela assignment_logs (audit trail de atribuições)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS assignment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('assign', 'reassign', 'delegate', 'unassign')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE assignment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_assignment_logs" ON assignment_logs;
CREATE POLICY "service_role_full_assignment_logs" ON assignment_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_assignment_logs" ON assignment_logs;
CREATE POLICY "authenticated_read_assignment_logs" ON assignment_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_assignment_logs" ON assignment_logs;
CREATE POLICY "authenticated_insert_assignment_logs" ON assignment_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assignment_logs_lead
  ON assignment_logs(lead_id);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_created
  ON assignment_logs(created_at);
