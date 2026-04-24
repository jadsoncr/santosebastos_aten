-- ============================================================
-- BRO Resolve — Migração 009: Conexão Total
-- channel_user_id em leads pra outbound + identity_id em mensagens
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS channel_user_id TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS identity_id TEXT;
