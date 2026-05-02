-- 028_estado_valor.sql
-- Modelo de 3 estados de valor jurídico.
-- Camada transversal: não muda fluxo, adiciona consciência de valor.

ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS estado_valor TEXT DEFAULT 'indefinido'
    CHECK (estado_valor IN ('indefinido', 'estimado', 'realizado'));

ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS estado_valor_updated_at TIMESTAMPTZ;

-- Migrar dados existentes: quem já tem valor_contrato > 0 e estado_painel = 'cliente' → realizado
UPDATE atendimentos
SET estado_valor = 'realizado', estado_valor_updated_at = encerrado_em
WHERE valor_contrato > 0 AND estado_painel = 'cliente';

-- Quem tem valor_entrada > 0 mas não é cliente → estimado
UPDATE atendimentos
SET estado_valor = 'estimado', estado_valor_updated_at = NOW()
WHERE valor_entrada > 0 AND estado_valor = 'indefinido';
