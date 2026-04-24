-- ============================================================
-- BRO Resolve Cockpit — Migração 002
-- Rodar no SQL Editor do Supabase (ou via psql)
-- ============================================================

-- ── 1. Tabela mensagens ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  de TEXT NOT NULL,
  tipo TEXT DEFAULT 'mensagem',
  conteudo TEXT NOT NULL,
  operador_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_mensagens" ON mensagens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_mensagens" ON mensagens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_mensagens" ON mensagens
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mensagens_lead ON mensagens(lead_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created ON mensagens(created_at);

-- ── 2. Seeds quick_replies ──────────────────────────────────
-- IMPORTANTE: Substitua OWNER_USER_ID pelo UUID do owner.
-- Para encontrar: SELECT id, email FROM auth.users LIMIT 5;

INSERT INTO quick_replies (atalho, conteudo, criado_por, compartilhado) VALUES
  ('saudacao', 'Olá! Sou do escritório Santos & Bastos. Como posso ajudar?', 'OWNER_USER_ID', true),
  ('agenda', 'Vou verificar a agenda e retorno em instantes.', 'OWNER_USER_ID', true),
  ('docs', 'Para dar andamento, preciso dos seguintes documentos: RG, CPF e comprovante de residência.', 'OWNER_USER_ID', true),
  ('prazo', 'O prazo estimado para esse tipo de processo é de 6 a 12 meses.', 'OWNER_USER_ID', true),
  ('encerramento', 'Agradeço o contato! Qualquer dúvida, estamos à disposição.', 'OWNER_USER_ID', true)
ON CONFLICT (atalho) DO NOTHING;
