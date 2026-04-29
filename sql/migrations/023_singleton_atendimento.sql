-- ============================================================
-- Migração 023: Atendimento singleton por identity_id
-- 1 pessoa = 1 identity = 1 atendimento (sempre)
-- Reentrada incrementa ciclo, não cria novo registro
-- ============================================================

-- 1. Adicionar coluna ciclo
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS ciclo INTEGER DEFAULT 1;

-- 2. Consolidar duplicatas: manter apenas o mais recente por identity_id
-- Primeiro, identificar duplicatas
WITH ranked AS (
  SELECT id, identity_id,
    ROW_NUMBER() OVER (PARTITION BY identity_id ORDER BY assumido_em DESC) as rn
  FROM atendimentos
  WHERE identity_id IS NOT NULL
)
DELETE FROM atendimentos
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. Para atendimentos sem identity_id, preencher a partir do lead
UPDATE atendimentos a
SET identity_id = l.identity_id
FROM leads l
WHERE a.lead_id = l.id AND a.identity_id IS NULL AND l.identity_id IS NOT NULL;

-- 4. Remover constraint antiga UNIQUE(lead_id)
ALTER TABLE atendimentos DROP CONSTRAINT IF EXISTS atendimentos_lead_id_key;

-- 5. Adicionar nova constraint UNIQUE(identity_id)
-- Use a partial unique index to allow NULLs (legacy records without identity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimentos_unique_identity
  ON atendimentos (identity_id) WHERE identity_id IS NOT NULL;

-- 6. Manter lead_id como referência mas sem UNIQUE
-- (lead_id still useful for message routing and legacy compatibility)

-- 7. Index para performance
DROP INDEX IF EXISTS idx_atendimentos_identity_estado;
CREATE INDEX IF NOT EXISTS idx_atendimentos_identity_estado
  ON atendimentos (identity_id, estado_painel);
