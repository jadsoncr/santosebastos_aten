-- ============================================================
-- Migração 018: Árvore de Decisão Determinística
-- Adiciona colunas de decisão na segment_trees
-- Elimina necessidade de resolveClassification por regex
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 1: Novas colunas na segment_trees (nível 3 = folha)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE segment_trees ADD COLUMN IF NOT EXISTS status_negocio TEXT;
ALTER TABLE segment_trees ADD COLUMN IF NOT EXISTS destino TEXT;
ALTER TABLE segment_trees ADD COLUMN IF NOT EXISTS fila TEXT;
ALTER TABLE segment_trees ADD COLUMN IF NOT EXISTS acao TEXT;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 2: Seed completo — TRABALHISTA (já tem nível 2, falta nível 3)
-- ═══════════════════════════════════════════════════════════════

-- Assédio Sexual (nível 3)
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao) VALUES
  ('a2000000-0000-0000-0000-000000000002', 3, 'Abordagem indevida', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('a2000000-0000-0000-0000-000000000002', 3, 'Coerção', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
ON CONFLICT DO NOTHING;

-- Rescisão (nível 3)
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao) VALUES
  ('a2000000-0000-0000-0000-000000000003', 3, 'Sem justa causa', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('a2000000-0000-0000-0000-000000000003', 3, 'Justa causa contestada', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('a2000000-0000-0000-0000-000000000003', 3, 'Rescisão indireta', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('a2000000-0000-0000-0000-000000000003', 3, 'Acordo trabalhista', 'aguardando_proposta', 'backoffice', 'sai', 'Enviar proposta')
ON CONFLICT DO NOTHING;

-- Horas Extras (nível 3)
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao) VALUES
  ('a2000000-0000-0000-0000-000000000004', 3, 'Não pagamento', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('a2000000-0000-0000-0000-000000000004', 3, 'Banco de horas irregular', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
ON CONFLICT DO NOTHING;

-- Acidente de Trabalho (nível 3)
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao) VALUES
  ('a2000000-0000-0000-0000-000000000005', 3, 'Afastamento INSS', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('a2000000-0000-0000-0000-000000000005', 3, 'Doença ocupacional', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('a2000000-0000-0000-0000-000000000005', 3, 'Estabilidade acidentária', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
ON CONFLICT DO NOTHING;

-- Atualizar nível 3 existente (Assédio Moral) com colunas de decisão
UPDATE segment_trees SET status_negocio = 'aguardando_agendamento', destino = 'backoffice', fila = 'sai', acao = 'Agendar reunião'
WHERE nivel = 3 AND parent_id = 'a2000000-0000-0000-0000-000000000001' AND status_negocio IS NULL;


-- ═══════════════════════════════════════════════════════════════
-- BLOCO 3: Seed completo — FAMÍLIA
-- ═══════════════════════════════════════════════════════════════

-- Nível 2 — Assuntos
INSERT INTO segment_trees (parent_id, nivel, nome) VALUES
  ('a1000000-0000-0000-0000-000000000002', 2, 'Divórcio'),
  ('a1000000-0000-0000-0000-000000000002', 2, 'Guarda'),
  ('a1000000-0000-0000-0000-000000000002', 2, 'Pensão Alimentícia'),
  ('a1000000-0000-0000-0000-000000000002', 2, 'Inventário')
ON CONFLICT DO NOTHING;

-- Nível 3 — Divórcio
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Consensual', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Litigioso', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Partilha de bens', 'aguardando_proposta', 'backoffice', 'sai', 'Enviar proposta')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Divórcio' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000002'
ON CONFLICT DO NOTHING;

-- Nível 3 — Guarda
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Compartilhada', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Unilateral', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Regulamentação de visitas', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Guarda' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000002'
ON CONFLICT DO NOTHING;

-- Nível 3 — Pensão Alimentícia
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Fixação', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Revisão', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Execução de alimentos', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Pensão Alimentícia' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000002'
ON CONFLICT DO NOTHING;

-- Nível 3 — Inventário
INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Judicial', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Extrajudicial', 'aguardando_proposta', 'backoffice', 'sai', 'Enviar proposta')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Inventário' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000002'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 4: Seed completo — CONSUMIDOR
-- ═══════════════════════════════════════════════════════════════

INSERT INTO segment_trees (parent_id, nivel, nome) VALUES
  ('a1000000-0000-0000-0000-000000000003', 2, 'Produto com defeito'),
  ('a1000000-0000-0000-0000-000000000003', 2, 'Cobrança indevida'),
  ('a1000000-0000-0000-0000-000000000003', 2, 'Propaganda enganosa'),
  ('a1000000-0000-0000-0000-000000000003', 2, 'Negativação indevida')
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Troca recusada', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Garantia negada', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Vício oculto', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Produto com defeito' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000003'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Cartão de crédito', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Serviço não contratado', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Taxa abusiva', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Cobrança indevida' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000003'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Oferta não cumprida', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Informação falsa', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Propaganda enganosa' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000003'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('SPC/Serasa indevido', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Dano moral', 'aguardando_proposta', 'backoffice', 'sai', 'Enviar proposta')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Negativação indevida' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000003'
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- BLOCO 5: Seed completo — CÍVEL
-- ═══════════════════════════════════════════════════════════════

INSERT INTO segment_trees (parent_id, nivel, nome) VALUES
  ('a1000000-0000-0000-0000-000000000004', 2, 'Contratos'),
  ('a1000000-0000-0000-0000-000000000004', 2, 'Responsabilidade civil'),
  ('a1000000-0000-0000-0000-000000000004', 2, 'Cobrança')
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Descumprimento contratual', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Rescisão contratual', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Revisão de cláusulas', 'aguardando_proposta', 'backoffice', 'sai', 'Enviar proposta')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Contratos' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000004'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Acidente de trânsito', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Erro médico', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Dano material', 'aguardando_proposta', 'backoffice', 'sai', 'Enviar proposta')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Responsabilidade civil' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000004'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Execução de título', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Ação monitória', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Cobrança' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000004'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 6: Seed completo — EMPRESARIAL
-- ═══════════════════════════════════════════════════════════════

INSERT INTO segment_trees (parent_id, nivel, nome) VALUES
  ('a1000000-0000-0000-0000-000000000005', 2, 'Societário'),
  ('a1000000-0000-0000-0000-000000000005', 2, 'Tributário'),
  ('a1000000-0000-0000-0000-000000000005', 2, 'Recuperação judicial')
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Dissolução de sociedade', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Exclusão de sócio', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Alteração contratual', 'aguardando_proposta', 'backoffice', 'sai', 'Enviar proposta')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Societário' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000005'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Planejamento tributário', 'aguardando_proposta', 'backoffice', 'sai', 'Enviar proposta'),
  ('Defesa fiscal', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Recuperação de crédito', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Tributário' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000005'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Pedido de recuperação', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Falência', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Recuperação judicial' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000005'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 7: Seed completo — SAÚDE
-- ═══════════════════════════════════════════════════════════════

INSERT INTO segment_trees (parent_id, nivel, nome) VALUES
  ('a1000000-0000-0000-0000-000000000006', 2, 'Plano de saúde'),
  ('a1000000-0000-0000-0000-000000000006', 2, 'Erro médico'),
  ('a1000000-0000-0000-0000-000000000006', 2, 'Medicamentos')
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Negativa de cobertura', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Reajuste abusivo', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Cancelamento unilateral', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Plano de saúde' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000006'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Diagnóstico errado', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Cirurgia mal sucedida', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Erro médico' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000006'
ON CONFLICT DO NOTHING;

INSERT INTO segment_trees (parent_id, nivel, nome, status_negocio, destino, fila, acao)
SELECT id, 3, sub.nome, sub.status_negocio, sub.destino, sub.fila, sub.acao
FROM segment_trees, (VALUES
  ('Fornecimento pelo SUS', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião'),
  ('Medicamento de alto custo', 'aguardando_agendamento', 'backoffice', 'sai', 'Agendar reunião')
) AS sub(nome, status_negocio, destino, fila, acao)
WHERE segment_trees.nome = 'Medicamentos' AND segment_trees.nivel = 2 AND segment_trees.parent_id = 'a1000000-0000-0000-0000-000000000006'
ON CONFLICT DO NOTHING;
