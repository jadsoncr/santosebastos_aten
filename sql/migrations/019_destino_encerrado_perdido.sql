-- ============================================================
-- Migração 019: Destinos encerrado + perdido
-- Adiciona segmentos Informação e Geral com destinos não-backoffice
-- Garante: classificar = decidir destino (backoffice | encerrado | perdido)
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 1: Segmento "Informação" (dúvidas resolvidas no chat)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO segment_trees (id, parent_id, nivel, nome, persona) VALUES
  ('a1000000-0000-0000-0000-000000000007', NULL, 1, 'Informação', NULL)
ON CONFLICT DO NOTHING;

-- Nível 2 — Assuntos
INSERT INTO segment_trees (id, parent_id, nivel, nome) VALUES
  ('a2000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000007', 2, 'Dúvida geral'),
  ('a2000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000007', 2, 'Localização e horário')
ON CONFLICT DO NOTHING;

-- Nível 3 — Dúvida geral
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao) VALUES
  ('a2000000-0000-0000-0000-000000000010', 3, 'Como funciona o processo', 'resolvido', 'encerrado', 'sai', 'Encerrar'),
  ('a2000000-0000-0000-0000-000000000010', 3, 'Documentos necessários', 'resolvido', 'encerrado', 'sai', 'Encerrar'),
  ('a2000000-0000-0000-0000-000000000010', 3, 'Prazos e custos', 'resolvido', 'encerrado', 'sai', 'Encerrar')
ON CONFLICT DO NOTHING;

-- Nível 3 — Localização e horário
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao) VALUES
  ('a2000000-0000-0000-0000-000000000011', 3, 'Horário de funcionamento', 'resolvido', 'encerrado', 'sai', 'Encerrar'),
  ('a2000000-0000-0000-0000-000000000011', 3, 'Endereço do escritório', 'resolvido', 'encerrado', 'sai', 'Encerrar')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 2: Segmento "Geral" (não avançou / sem interesse)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO segment_trees (id, parent_id, nivel, nome, persona) VALUES
  ('a1000000-0000-0000-0000-000000000008', NULL, 1, 'Geral', NULL)
ON CONFLICT DO NOTHING;

-- Nível 2 — Assuntos
INSERT INTO segment_trees (id, parent_id, nivel, nome) VALUES
  ('a2000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000008', 2, 'Sem continuidade'),
  ('a2000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000008', 2, 'Problema de contato')
ON CONFLICT DO NOTHING;

-- Nível 3 — Sem continuidade
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao) VALUES
  ('a2000000-0000-0000-0000-000000000012', 3, 'Sem interesse', 'perdido', 'encerrado', 'sai', 'Encerrar'),
  ('a2000000-0000-0000-0000-000000000012', 3, 'Desistiu', 'perdido', 'encerrado', 'sai', 'Encerrar'),
  ('a2000000-0000-0000-0000-000000000012', 3, 'Trote', 'perdido', 'encerrado', 'sai', 'Encerrar')
ON CONFLICT DO NOTHING;

-- Nível 3 — Problema de contato
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao) VALUES
  ('a2000000-0000-0000-0000-000000000013', 3, 'Parou de responder', 'perdido', 'encerrado', 'sai', 'Encerrar'),
  ('a2000000-0000-0000-0000-000000000013', 3, 'Número errado', 'perdido', 'encerrado', 'sai', 'Encerrar')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- BLOCO 3: Ajuste — mover subcategorias discutíveis para agendamento
-- Revisão de cláusulas e Alteração contratual precisam reunião primeiro
-- ═══════════════════════════════════════════════════════════════

UPDATE segment_trees
SET status_negocio = 'aguardando_agendamento', acao = 'Agendar reunião'
WHERE nivel = 3 AND nome = 'Revisão de cláusulas' AND status_negocio = 'aguardando_proposta';

UPDATE segment_trees
SET status_negocio = 'aguardando_agendamento', acao = 'Agendar reunião'
WHERE nivel = 3 AND nome = 'Alteração contratual' AND status_negocio = 'aguardando_proposta';
