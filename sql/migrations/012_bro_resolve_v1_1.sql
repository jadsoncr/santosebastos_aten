-- ============================================================
-- BRO Resolve v1.1 — Migração 012
-- Árvore de Segmentos, Pipeline 8 Estados, SLA Dinâmico,
-- Timeline de Ações, Campos Financeiros, Índices de Busca
-- Idempotente: todas as operações usam IF NOT EXISTS
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 1: Árvore de Segmentos (segment_trees)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS segment_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES segment_trees(id),
  nivel INTEGER NOT NULL CHECK (nivel IN (1, 2, 3)),
  nome TEXT NOT NULL,
  persona TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, nome)
);

-- Unicidade de nomes raiz (parent_id NULL — PostgreSQL trata NULLs como distintos em UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_segment_trees_root_nome
  ON segment_trees(nome) WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_segment_trees_parent
  ON segment_trees(parent_id);

CREATE INDEX IF NOT EXISTS idx_segment_trees_nivel
  ON segment_trees(nivel);

-- RLS
ALTER TABLE segment_trees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_segments" ON segment_trees;
CREATE POLICY "authenticated_read_segments" ON segment_trees
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_segments" ON segment_trees;
CREATE POLICY "authenticated_insert_segments" ON segment_trees
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'owner'
  );

DROP POLICY IF EXISTS "authenticated_update_segments" ON segment_trees;
CREATE POLICY "authenticated_update_segments" ON segment_trees
  FOR UPDATE TO authenticated USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'owner'
  );

DROP POLICY IF EXISTS "service_role_full_segments" ON segment_trees;
CREATE POLICY "service_role_full_segments" ON segment_trees
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 2: Configurações de SLA Dinâmico
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS configuracoes_sla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  descricao TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE configuracoes_sla ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_sla" ON configuracoes_sla;
CREATE POLICY "authenticated_read_sla" ON configuracoes_sla
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "owner_update_sla" ON configuracoes_sla;
CREATE POLICY "owner_update_sla" ON configuracoes_sla
  FOR UPDATE TO authenticated USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'owner'
  );

DROP POLICY IF EXISTS "service_role_full_sla" ON configuracoes_sla;
CREATE POLICY "service_role_full_sla" ON configuracoes_sla
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Defaults
INSERT INTO configuracoes_sla (chave, valor, descricao) VALUES
  ('tempo_snooze_minutos', '60', 'Minutos sem resposta do cliente antes de mover para Aguardando Retorno'),
  ('tempo_abandono_triagem_horas', '2', 'Horas sem atendimento humano antes de marcar como abandono de triagem'),
  ('tempo_abandono_atendimento_horas', '24', 'Horas sem resposta em atendimento ativo antes de fechar')
ON CONFLICT (chave) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 3: Timeline de Ações (Evidências)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  operador_id UUID REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tipos esperados: reuniao_agendada, proposta_enviada, documento_solicitado,
-- documento_recebido, pagamento_registrado, status_atualizado, contato_realizado

ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_timeline" ON timeline_events;
CREATE POLICY "authenticated_read_timeline" ON timeline_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_timeline" ON timeline_events;
CREATE POLICY "authenticated_insert_timeline" ON timeline_events
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_timeline" ON timeline_events;
CREATE POLICY "service_role_full_timeline" ON timeline_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_timeline_events_lead
  ON timeline_events(lead_id);

CREATE INDEX IF NOT EXISTS idx_timeline_events_created
  ON timeline_events(created_at);

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 4: Pipeline de 8 Estados + Campos Financeiros
-- ═══════════════════════════════════════════════════════════════

-- Coluna status_pipeline na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_pipeline TEXT DEFAULT 'ENTRADA';

-- Colunas de classificação hierárquica na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS segmento_id UUID REFERENCES segment_trees(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assunto_id UUID REFERENCES segment_trees(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS especificacao_id UUID REFERENCES segment_trees(id);

-- Campos financeiros na tabela atendimentos
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS valor_entrada NUMERIC;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS valor_honorarios_finais NUMERIC;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS data_baixa TIMESTAMPTZ;

-- Campos de agendamento na tabela atendimentos
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS agendamento_data TIMESTAMPTZ;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS agendamento_local TEXT;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS documento_enviado BOOLEAN DEFAULT false;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS documento_assinado BOOLEAN DEFAULT false;

-- Índice para queries da sidebar por pipeline
CREATE INDEX IF NOT EXISTS idx_leads_status_pipeline
  ON leads(status_pipeline);

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 5: Índices GIN para Busca Global (Localizar)
-- ═══════════════════════════════════════════════════════════════

-- Extensão pg_trgm para busca fuzzy
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes para busca por nome e telefone
CREATE INDEX IF NOT EXISTS idx_identities_nome_gin
  ON identities USING gin (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_identities_telefone_gin
  ON identities USING gin (telefone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_nome_gin
  ON leads USING gin (nome gin_trgm_ops);


-- ═══════════════════════════════════════════════════════════════
-- BLOCO 6: Seed Data — Árvore de Segmentos Santos & Bastos
-- ═══════════════════════════════════════════════════════════════

-- Nível 1 — Segmentos com Personas
INSERT INTO segment_trees (id, parent_id, nivel, nome, persona) VALUES
  ('a1000000-0000-0000-0000-000000000001', NULL, 1, 'Trabalhista', 'Dr. Rafael'),
  ('a1000000-0000-0000-0000-000000000002', NULL, 1, 'Família', 'Dra. Mariana'),
  ('a1000000-0000-0000-0000-000000000003', NULL, 1, 'Consumidor', 'Dra. Beatriz'),
  ('a1000000-0000-0000-0000-000000000004', NULL, 1, 'Cível', 'Dr. André'),
  ('a1000000-0000-0000-0000-000000000005', NULL, 1, 'Empresarial', 'Dr. Carlos'),
  ('a1000000-0000-0000-0000-000000000006', NULL, 1, 'Saúde', 'Dra. Patrícia')
ON CONFLICT DO NOTHING;

-- Nível 2 — Assuntos (Trabalhista)
INSERT INTO segment_trees (id, parent_id, nivel, nome) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2, 'Assédio Moral'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 2, 'Assédio Sexual'),
  ('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 2, 'Rescisão'),
  ('a2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 2, 'Horas Extras'),
  ('a2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 2, 'Acidente de Trabalho')
ON CONFLICT DO NOTHING;

-- Nível 3 — Especificações (Assédio Moral)
INSERT INTO segment_trees (id, parent_id, nivel, nome) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 3, 'Humilhação'),
  ('a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 3, 'Abuso de Poder'),
  ('a3000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 3, 'Isolamento')
ON CONFLICT DO NOTHING;
