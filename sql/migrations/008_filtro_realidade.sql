-- ============================================================
-- BRO Resolve — Migração 008: Filtro de Realidade
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ DEFAULT now();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_alegado TEXT;
-- is_reaquecido já existe da migração 004
