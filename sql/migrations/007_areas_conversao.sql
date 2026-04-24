-- ============================================================
-- BRO Resolve — Migração 007: Áreas Dinâmicas + Conversão
-- ============================================================

CREATE TABLE IF NOT EXISTS areas_juridicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO areas_juridicas (nome) VALUES
  ('Trabalhista'), ('Civil'), ('Família'),
  ('Previdenciário'), ('Criminal')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE areas_juridicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_areas" ON areas_juridicas;
CREATE POLICY "authenticated_read_areas" ON areas_juridicas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_areas" ON areas_juridicas;
CREATE POLICY "authenticated_insert_areas" ON areas_juridicas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_full_areas" ON areas_juridicas;
CREATE POLICY "service_role_full_areas" ON areas_juridicas FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS valor_contrato NUMERIC;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS status_pagamento TEXT;
