-- ============================================================
-- Migração 015: Smart Conversation Sorting
-- Novas colunas em atendimentos, tabela de auditoria,
-- campo unread_count em leads
-- Idempotente: todas as operações usam IF NOT EXISTS
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 1: Novas colunas em atendimentos
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS status_negocio TEXT;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS destino TEXT;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS motivo_id UUID REFERENCES segment_trees(id);
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES segment_trees(id);
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS subcategoria_id UUID REFERENCES segment_trees(id);

-- Índice para queries do backoffice por status_negocio
CREATE INDEX IF NOT EXISTS idx_atendimentos_status_negocio
  ON atendimentos(status_negocio);

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 2: Tabela de auditoria de transições de status
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS status_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID NOT NULL REFERENCES atendimentos(id),
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  operador_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE status_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_status_transitions" ON status_transitions;
CREATE POLICY "service_role_full_status_transitions" ON status_transitions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_status_transitions" ON status_transitions;
CREATE POLICY "authenticated_read_status_transitions" ON status_transitions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_status_transitions" ON status_transitions;
CREATE POLICY "authenticated_insert_status_transitions" ON status_transitions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_status_transitions_atendimento
  ON status_transitions(atendimento_id);

CREATE INDEX IF NOT EXISTS idx_status_transitions_created
  ON status_transitions(created_at);

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 3: Campo unread_count em leads (para ordenação)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE leads ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
