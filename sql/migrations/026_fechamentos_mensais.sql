-- Fechamentos mensais (snapshot contábil)
CREATE TABLE IF NOT EXISTS fechamentos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes TEXT NOT NULL,
  status TEXT DEFAULT 'aberto',
  receita_entrada NUMERIC DEFAULT 0,
  receita_pendente NUMERIC DEFAULT 0,
  custos_total NUMERIC DEFAULT 0,
  resultado NUMERIC DEFAULT 0,
  fechado_em TIMESTAMPTZ,
  fechado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mes)
);

-- Custos mensais (CRUD simples)
CREATE TABLE IF NOT EXISTS custos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  categoria TEXT DEFAULT 'outros',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custos_mensais_mes ON custos_mensais(mes);
CREATE INDEX IF NOT EXISTS idx_fechamentos_mes ON fechamentos_mensais(mes);

-- RLS
ALTER TABLE fechamentos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_mensais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_fechamentos" ON fechamentos_mensais;
CREATE POLICY "service_role_full_fechamentos" ON fechamentos_mensais FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_fechamentos" ON fechamentos_mensais;
CREATE POLICY "authenticated_read_fechamentos" ON fechamentos_mensais FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_full_custos" ON custos_mensais;
CREATE POLICY "service_role_full_custos" ON custos_mensais FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_custos" ON custos_mensais;
CREATE POLICY "authenticated_read_custos" ON custos_mensais FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_custos" ON custos_mensais;
CREATE POLICY "authenticated_insert_custos" ON custos_mensais FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_custos" ON custos_mensais;
CREATE POLICY "authenticated_update_custos" ON custos_mensais FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_custos" ON custos_mensais;
CREATE POLICY "authenticated_delete_custos" ON custos_mensais FOR DELETE TO authenticated USING (true);
