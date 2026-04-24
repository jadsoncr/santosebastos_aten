-- ============================================================
-- BRO Resolve — Migração 004: Reentrada e Busca Ativa
-- Flag is_reaquecido em leads para clientes que voltam
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_reaquecido BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reaquecido_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_reaquecido ON leads(is_reaquecido) WHERE is_reaquecido = true;
