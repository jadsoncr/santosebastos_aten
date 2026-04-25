-- ============================================================
-- BRO Resolve v1.1 — Migração 013: Sprint Final
-- location em atendimentos, email em identities, request_id nullable
-- Idempotente: todas as operações usam IF NOT EXISTS
-- ============================================================

-- 1. Coluna location em atendimentos (central/backoffice/abandonos)
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'central';
-- Valores: 'central' | 'backoffice' | 'abandonos'

-- 2. Coluna email em identities
ALTER TABLE identities ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. request_id nullable em leads (permitir cadastro manual sem UUID gerado pelo bot)
ALTER TABLE leads ALTER COLUMN request_id DROP NOT NULL;

-- 4. Coluna contrato_assinado em atendimentos (checkbox de segurança)
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS contrato_assinado BOOLEAN DEFAULT false;

-- 5. Índice para filtrar por location
CREATE INDEX IF NOT EXISTS idx_atendimentos_location
  ON atendimentos(location);

-- 6. Índice para busca de email
CREATE INDEX IF NOT EXISTS idx_identities_email
  ON identities(email);


-- 7. SLA config para auto-release do silenciador (devolver ao bot)
INSERT INTO configuracoes_sla (chave, valor, descricao) VALUES
  ('tempo_auto_release_minutos', '30', 'Minutos sem resposta do operador antes de devolver o lead ao bot automaticamente')
ON CONFLICT (chave) DO NOTHING;


-- 8. Foto do perfil Telegram
ALTER TABLE identities ADD COLUMN IF NOT EXISTS photo_url TEXT;
