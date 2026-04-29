-- ============================================================
-- Migração 021: Prazo + Classificação de Tratamento
-- Separa STATUS (fluxo) de PRAZO (pressão operacional)
-- Adiciona colunas de classificação de tratamento
-- ============================================================

-- Prazo da próxima ação (SLA operacional)
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS prazo_proxima_acao TIMESTAMP;

-- Classificação de tratamento (2 níveis — decisão da triagem)
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS classificacao_tratamento_tipo TEXT;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS classificacao_tratamento_detalhe TEXT;

-- Observação do operador (dossiê da triagem)
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS observacao TEXT;
