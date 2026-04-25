-- ============================================================
-- BRO Resolve — Migração 010: Triagem Imediata + Silenciador de IA
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_assumido BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_triagem TEXT DEFAULT 'bot_ativo';
-- status_triagem: 'bot_ativo' | 'humano_assumiu' | 'finalizado'
