-- ============================================================
-- Migração 022: estado_painel — Governança de estado do cliente
-- Controla o roteamento global: URA vs humano vs cliente
-- ============================================================

-- Adicionar coluna
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS estado_painel TEXT;

-- Adicionar identity_id se não existir (pra queries por cliente)
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS identity_id UUID;

-- Backfill: registros existentes
UPDATE atendimentos SET estado_painel = 'em_atendimento'
WHERE destino = 'backoffice' AND estado_painel IS NULL AND status_negocio IS NOT NULL;

UPDATE atendimentos SET estado_painel = 'encerrado'
WHERE destino = 'encerrado' AND estado_painel IS NULL AND status_negocio IS NOT NULL;

UPDATE atendimentos SET estado_painel = 'cliente'
WHERE status_negocio = 'fechado' AND estado_painel IS NULL;

-- Preencher identity_id a partir dos leads
UPDATE atendimentos a
SET identity_id = l.identity_id
FROM leads l
WHERE a.lead_id = l.id AND a.identity_id IS NULL AND l.identity_id IS NOT NULL;

-- Index pra query rápida de roteamento
CREATE INDEX IF NOT EXISTS idx_atendimentos_identity_estado
ON atendimentos (identity_id, estado_painel);
