-- ============================================================
-- SEED DE DESENVOLVIMENTO — BRO Resolve
-- Dataset controlado para testar fluxo completo ponta a ponta
-- 
-- COBERTURA:
--   ✔ Lead novo (active < 8h)
--   ✔ Lead aguardando resposta (waiting 8-34h)
--   ✔ Lead sem retorno (no_response > 34h)
--   ✔ Lead inativo (> 7 dias)
--   ✔ Lead em negociação (backoffice)
--   ✔ Lead fechado
--   ✔ Lead perdido
--   ✔ Lead reativado
--   ✔ Abandono URA
--   ✔ Outro (input livre)
--   ✔ Mensagens variadas
--   ✔ Atendimentos em diferentes status_negocio
--   ✔ Audit trail (status_transitions)
--
-- IMPORTANTE: Rodar DEPOIS das migrações 001-015
-- IMPORTANTE: NÃO rodar em produção
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 1: Identidades (10 pessoas)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO identities (id, telefone, nome, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', '5521999990001', 'João Silva', now() - interval '2 hours'),
  ('d0000000-0000-0000-0000-000000000002', '5521999990002', 'Maria Santos', now() - interval '12 hours'),
  ('d0000000-0000-0000-0000-000000000003', '5521999990003', 'Carlos Oliveira', now() - interval '3 days'),
  ('d0000000-0000-0000-0000-000000000004', '5521999990004', 'Ana Costa', now() - interval '10 days'),
  ('d0000000-0000-0000-0000-000000000005', '5521999990005', 'Roberto Mendes', now() - interval '5 days'),
  ('d0000000-0000-0000-0000-000000000006', '5521999990006', 'Fernanda Lima', now() - interval '1 day'),
  ('d0000000-0000-0000-0000-000000000007', '5521999990007', 'Pedro Almeida', now() - interval '6 hours'),
  ('d0000000-0000-0000-0000-000000000008', '5521999990008', 'Juliana Ferreira', now() - interval '20 days'),
  ('d0000000-0000-0000-0000-000000000009', '5521999990009', 'Lucas Barbosa', now() - interval '4 hours'),
  ('d0000000-0000-0000-0000-000000000010', '5521999990010', 'Camila Rocha', now() - interval '15 days')
ON CONFLICT (telefone) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 2: Canais (WhatsApp para todos)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO identity_channels (identity_id, channel, channel_user_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'whatsapp', '5521999990001'),
  ('d0000000-0000-0000-0000-000000000002', 'whatsapp', '5521999990002'),
  ('d0000000-0000-0000-0000-000000000003', 'whatsapp', '5521999990003'),
  ('d0000000-0000-0000-0000-000000000004', 'whatsapp', '5521999990004'),
  ('d0000000-0000-0000-0000-000000000005', 'whatsapp', '5521999990005'),
  ('d0000000-0000-0000-0000-000000000006', 'telegram', '5521999990006'),
  ('d0000000-0000-0000-0000-000000000007', 'whatsapp', '5521999990007'),
  ('d0000000-0000-0000-0000-000000000008', 'whatsapp', '5521999990008'),
  ('d0000000-0000-0000-0000-000000000009', 'whatsapp', '5521999990009'),
  ('d0000000-0000-0000-0000-000000000010', 'telegram', '5521999990010')
ON CONFLICT (channel, channel_user_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- BLOCO 3: Leads (10 cenários diferentes)
-- ═══════════════════════════════════════════════════════════════

-- Lead 1: João — ATIVO (respondeu há 2h, score alto, trabalhista)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'seed-req-001', 'João Silva', '5521999990001', 'trabalhista', 'trabalhista', 8, 'QUENTE', 'whatsapp', 'Demissão sem justa causa, quer saber sobre direitos', 'aberto', now() - interval '2 hours', false, true, 'EM_ATENDIMENTO', '5521999990001', now() - interval '2 hours', false, 2)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 2: Maria — AGUARDANDO (última msg há 12h, score médio, família)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'seed-req-002', 'Maria Santos', '5521999990002', 'familia', 'familia', 5, 'MEDIO', 'whatsapp', 'Divórcio consensual, precisa de orientação', 'aberto', now() - interval '12 hours', false, true, 'EM_ATENDIMENTO', '5521999990002', now() - interval '1 day', false, 0)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 3: Carlos — SEM RETORNO (última msg há 3 dias, score baixo)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'seed-req-003', 'Carlos Oliveira', '5521999990003', 'civel', 'civel', 3, 'FRIO', 'whatsapp', 'Problema com contrato de aluguel', 'aberto', now() - interval '3 days', false, false, 'ENTRADA', '5521999990003', now() - interval '3 days', false, 0)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 4: Ana — INATIVO (> 7 dias, vai para recuperação)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'seed-req-004', 'Ana Costa', '5521999990004', 'trabalhista', 'trabalhista', 6, 'MEDIO', 'whatsapp', 'Horas extras não pagas', 'aberto', now() - interval '10 days', false, true, 'QUALIFICADO', '5521999990004', now() - interval '15 days', false, 0)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 5: Roberto — EM NEGOCIAÇÃO (backoffice, aguardando proposta)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'seed-req-005', 'Roberto Mendes', '5521999990005', 'trabalhista', 'trabalhista', 9, 'QUENTE', 'whatsapp', 'Rescisão indireta, valor alto', 'aberto', now() - interval '1 day', false, true, 'AGENDAMENTO', '5521999990005', now() - interval '5 days', false, 1)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 6: Fernanda — ATIVO (respondeu há 6h, telegram)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000006', 'seed-req-006', 'Fernanda Lima', '5521999990006', 'familia', 'familia', 7, 'QUENTE', 'telegram', 'Guarda compartilhada', 'aberto', now() - interval '6 hours', false, true, 'EM_ATENDIMENTO', '5521999990006', now() - interval '1 day', false, 3)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 7: Pedro — NOVO (acabou de entrar, score médio)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000007', 'seed-req-007', 'Pedro Almeida', '5521999990007', 'consumidor', 'consumidor', 4, 'MEDIO', 'whatsapp', 'Produto com defeito, quer trocar', 'NOVO', now() - interval '30 minutes', false, false, 'ENTRADA', '5521999990007', now() - interval '1 hour', false, 1)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 8: Juliana — PERDIDO (fechou com outro, reativável)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000008', 'seed-req-008', 'Juliana Ferreira', '5521999990008', 'trabalhista', 'trabalhista', 7, 'QUENTE', 'whatsapp', 'Assédio moral no trabalho', 'aberto', now() - interval '20 days', false, true, 'EM_ATENDIMENTO', '5521999990008', now() - interval '25 days', false, 0)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 9: Lucas — REATIVADO (voltou depois de perda)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000009', 'seed-req-009', 'Lucas Barbosa', '5521999990009', 'civel', 'civel', 5, 'MEDIO', 'whatsapp', 'Cobrança indevida, voltou interessado', 'aberto', now() - interval '4 hours', true, false, 'ENTRADA', '5521999990009', now() - interval '4 hours', false, 1)
ON CONFLICT (request_id) DO NOTHING;

-- Lead 10: Camila — FECHADO (convertida, contrato assinado)
INSERT INTO leads (id, identity_id, request_id, nome, telefone, area, area_bot, score, prioridade, canal_origem, resumo, status, ultima_msg_em, is_reaquecido, is_assumido, status_pipeline, channel_user_id, created_at, corrigido, unread_count) VALUES
  ('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000010', 'seed-req-010', 'Camila Rocha', '5521999990010', 'trabalhista', 'trabalhista', 10, 'QUENTE', 'telegram', 'Demissão discriminatória, caso forte', 'aberto', now() - interval '2 days', false, true, 'CARTEIRA_ATIVA', '5521999990010', now() - interval '15 days', false, 0)
ON CONFLICT (request_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- BLOCO 4: Atendimentos (cenários de status_negocio)
-- Nota: owner_id usa placeholder — substituir pelo UUID do operador real
-- ═══════════════════════════════════════════════════════════════

-- Para os atendimentos, precisamos de um owner_id real.
-- Usar o primeiro usuário autenticado disponível:
DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário encontrado em auth.users. Atendimentos não serão criados.';
    RETURN;
  END IF;

  -- Atendimento 1: João — aberto, sem classificação ainda
  INSERT INTO atendimentos (lead_id, owner_id, status, assumido_em)
  VALUES ('e0000000-0000-0000-0000-000000000001', v_owner_id, 'aberto', now() - interval '2 hours')
  ON CONFLICT (lead_id) DO NOTHING;

  -- Atendimento 2: Maria — aberto, aguardando resposta
  INSERT INTO atendimentos (lead_id, owner_id, status, assumido_em)
  VALUES ('e0000000-0000-0000-0000-000000000002', v_owner_id, 'aberto', now() - interval '12 hours')
  ON CONFLICT (lead_id) DO NOTHING;

  -- Atendimento 5: Roberto — classificado, aguardando_proposta (backoffice)
  INSERT INTO atendimentos (lead_id, owner_id, status, status_negocio, destino, classificacao_entrada, assumido_em)
  VALUES ('e0000000-0000-0000-0000-000000000005', v_owner_id, 'classificado', 'aguardando_proposta', 'backoffice', 'Rescisão Indireta', now() - interval '3 days')
  ON CONFLICT (lead_id) DO NOTHING;

  -- Atendimento 6: Fernanda — aberto, em atendimento
  INSERT INTO atendimentos (lead_id, owner_id, status, assumido_em)
  VALUES ('e0000000-0000-0000-0000-000000000006', v_owner_id, 'aberto', now() - interval '6 hours')
  ON CONFLICT (lead_id) DO NOTHING;

  -- Atendimento 8: Juliana — perdido
  INSERT INTO atendimentos (lead_id, owner_id, status, status_negocio, destino, motivo_perda, classificacao_entrada, assumido_em, encerrado_em)
  VALUES ('e0000000-0000-0000-0000-000000000008', v_owner_id, 'nao_fechou', 'perdido', 'encerrado', 'Já fechou com outro', 'Assédio Moral', now() - interval '20 days', now() - interval '18 days')
  ON CONFLICT (lead_id) DO NOTHING;

  -- Atendimento 10: Camila — fechado (convertida)
  INSERT INTO atendimentos (lead_id, owner_id, status, status_negocio, destino, classificacao_entrada, classificacao_final, valor_estimado, assumido_em, encerrado_em)
  VALUES ('e0000000-0000-0000-0000-000000000010', v_owner_id, 'convertido', 'fechado', 'backoffice', 'Demissão Discriminatória', 'Trabalhista', 15000, now() - interval '15 days', now() - interval '2 days')
  ON CONFLICT (lead_id) DO NOTHING;

  -- Atendimento 4: Ana — classificado, reuniao_agendada (backoffice)
  INSERT INTO atendimentos (lead_id, owner_id, status, status_negocio, destino, classificacao_entrada, assumido_em)
  VALUES ('e0000000-0000-0000-0000-000000000004', v_owner_id, 'classificado', 'reuniao_agendada', 'backoffice', 'Horas Extras', now() - interval '10 days')
  ON CONFLICT (lead_id) DO NOTHING;

END $$;


-- ═══════════════════════════════════════════════════════════════
-- BLOCO 5: Mensagens (conversas realistas)
-- ═══════════════════════════════════════════════════════════════

-- João (ativo, 2 mensagens não lidas)
INSERT INTO mensagens (lead_id, de, tipo, conteudo, canal_origem, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'bot', 'mensagem', 'Olá! Bem-vindo ao Santos & Bastos. Como posso ajudar?', 'whatsapp', now() - interval '2 hours 30 minutes'),
  ('e0000000-0000-0000-0000-000000000001', '5521999990001', 'mensagem', 'Oi, fui demitido sem justa causa e quero saber meus direitos', 'whatsapp', now() - interval '2 hours 20 minutes'),
  ('e0000000-0000-0000-0000-000000000001', 'bot', 'mensagem', 'Entendo. Vou te direcionar para nosso especialista em Direito Trabalhista.', 'whatsapp', now() - interval '2 hours 15 minutes'),
  ('e0000000-0000-0000-0000-000000000001', '5521999990001', 'mensagem', 'Trabalhei 3 anos na empresa. Tenho direito a FGTS?', 'whatsapp', now() - interval '2 hours'),
  ('e0000000-0000-0000-0000-000000000001', '5521999990001', 'mensagem', 'E sobre o seguro desemprego?', 'whatsapp', now() - interval '1 hour 50 minutes')
ON CONFLICT DO NOTHING;

-- Maria (aguardando, última msg do operador há 12h)
INSERT INTO mensagens (lead_id, de, tipo, conteudo, canal_origem, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000002', '5521999990002', 'mensagem', 'Preciso de ajuda com meu divórcio', 'whatsapp', now() - interval '1 day'),
  ('e0000000-0000-0000-0000-000000000002', 'bot', 'mensagem', 'Claro! Vou conectar você com nossa especialista em Direito de Família.', 'whatsapp', now() - interval '23 hours'),
  ('e0000000-0000-0000-0000-000000000002', '5521999990002', 'mensagem', 'É consensual, já conversamos sobre tudo', 'whatsapp', now() - interval '22 hours')
ON CONFLICT DO NOTHING;

-- Carlos (sem retorno há 3 dias)
INSERT INTO mensagens (lead_id, de, tipo, conteudo, canal_origem, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000003', '5521999990003', 'mensagem', 'Tenho um problema com meu contrato de aluguel', 'whatsapp', now() - interval '3 days'),
  ('e0000000-0000-0000-0000-000000000003', 'bot', 'mensagem', 'Entendo. Pode me contar mais detalhes sobre o problema?', 'whatsapp', now() - interval '3 days')
ON CONFLICT DO NOTHING;

-- Roberto (em negociação, mensagens recentes)
INSERT INTO mensagens (lead_id, de, tipo, conteudo, canal_origem, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000005', '5521999990005', 'mensagem', 'Meu chefe está me forçando a pedir demissão', 'whatsapp', now() - interval '5 days'),
  ('e0000000-0000-0000-0000-000000000005', 'bot', 'mensagem', 'Isso pode configurar rescisão indireta. Vou te conectar com nosso especialista.', 'whatsapp', now() - interval '5 days'),
  ('e0000000-0000-0000-0000-000000000005', '5521999990005', 'mensagem', 'Já tenho provas de tudo, prints e testemunhas', 'whatsapp', now() - interval '3 days'),
  ('e0000000-0000-0000-0000-000000000005', '5521999990005', 'mensagem', 'Quando podemos marcar a reunião?', 'whatsapp', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- Fernanda (ativa, telegram, 3 não lidas)
INSERT INTO mensagens (lead_id, de, tipo, conteudo, canal_origem, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000006', '5521999990006', 'mensagem', 'Preciso resolver a guarda do meu filho', 'telegram', now() - interval '1 day'),
  ('e0000000-0000-0000-0000-000000000006', 'bot', 'mensagem', 'Vou te ajudar com isso. Você já tem advogado?', 'telegram', now() - interval '23 hours'),
  ('e0000000-0000-0000-0000-000000000006', '5521999990006', 'mensagem', 'Não, por isso estou procurando vocês', 'telegram', now() - interval '8 hours'),
  ('e0000000-0000-0000-0000-000000000006', '5521999990006', 'mensagem', 'O pai da criança concorda com guarda compartilhada', 'telegram', now() - interval '7 hours'),
  ('e0000000-0000-0000-0000-000000000006', '5521999990006', 'mensagem', 'Podem me ajudar a formalizar?', 'telegram', now() - interval '6 hours')
ON CONFLICT DO NOTHING;

-- Pedro (novo, acabou de entrar)
INSERT INTO mensagens (lead_id, de, tipo, conteudo, canal_origem, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000007', '5521999990007', 'mensagem', 'Comprei um celular e veio com defeito', 'whatsapp', now() - interval '1 hour'),
  ('e0000000-0000-0000-0000-000000000007', 'bot', 'mensagem', 'Lamento ouvir isso. Vou te ajudar a resolver.', 'whatsapp', now() - interval '55 minutes'),
  ('e0000000-0000-0000-0000-000000000007', '5521999990007', 'mensagem', 'A loja não quer trocar, o que faço?', 'whatsapp', now() - interval '30 minutes')
ON CONFLICT DO NOTHING;

-- Lucas (reativado)
INSERT INTO mensagens (lead_id, de, tipo, conteudo, canal_origem, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000009', '5521999990009', 'mensagem', 'Oi, lembrei que vocês me ajudaram antes. Tenho outro problema agora', 'whatsapp', now() - interval '4 hours'),
  ('e0000000-0000-0000-0000-000000000009', 'bot', 'mensagem', 'Que bom ter você de volta! Como posso ajudar?', 'whatsapp', now() - interval '3 hours 50 minutes'),
  ('e0000000-0000-0000-0000-000000000009', '5521999990009', 'mensagem', 'Recebi uma cobrança indevida no cartão', 'whatsapp', now() - interval '3 hours 40 minutes')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- BLOCO 6: Abandonos (URA) — 2 casos
-- ═══════════════════════════════════════════════════════════════

INSERT INTO abandonos (identity_id, request_id, fluxo, ultimo_estado, score, prioridade, nome, canal_origem, mensagens_enviadas, classificacao, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000003', 'seed-aband-001', 'trabalhista', 'trabalho_status', 2, 'FRIO', 'Carlos Oliveira', 'whatsapp', 2, 'PRECOCE', now() - interval '3 days'),
  ('d0000000-0000-0000-0000-000000000004', 'seed-aband-002', 'familia', 'familia_tipo', 3, 'FRIO', 'Ana Costa', 'whatsapp', 3, 'MEDIO', now() - interval '10 days')
ON CONFLICT (identity_id, ultimo_estado) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 7: Others (input livre) — 2 casos
-- ═══════════════════════════════════════════════════════════════

INSERT INTO others (identity_id, request_id, nome, telefone, tipo, conteudo, canal_origem, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000003', 'seed-other-001', 'Carlos Oliveira', '5521999990003', 'texto_livre', 'quero falar com advogado urgente', 'whatsapp', now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000007', 'seed-other-002', 'Pedro Almeida', '5521999990007', 'texto_livre', 'oi preciso de ajuda', 'whatsapp', now() - interval '5 hours')
ON CONFLICT (request_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 8: Audit trail (status_transitions) — para leads já classificados
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_owner_id UUID;
  v_at_roberto UUID;
  v_at_juliana UUID;
  v_at_camila UUID;
  v_at_ana UUID;
BEGIN
  SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
  IF v_owner_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_at_roberto FROM atendimentos WHERE lead_id = 'e0000000-0000-0000-0000-000000000005';
  SELECT id INTO v_at_juliana FROM atendimentos WHERE lead_id = 'e0000000-0000-0000-0000-000000000008';
  SELECT id INTO v_at_camila FROM atendimentos WHERE lead_id = 'e0000000-0000-0000-0000-000000000010';
  SELECT id INTO v_at_ana FROM atendimentos WHERE lead_id = 'e0000000-0000-0000-0000-000000000004';

  -- Roberto: aguardando_agendamento → reuniao_agendada → aguardando_proposta
  IF v_at_roberto IS NOT NULL THEN
    INSERT INTO status_transitions (atendimento_id, status_anterior, status_novo, operador_id, created_at) VALUES
      (v_at_roberto, NULL, 'aguardando_agendamento', v_owner_id, now() - interval '4 days'),
      (v_at_roberto, 'aguardando_agendamento', 'reuniao_agendada', v_owner_id, now() - interval '3 days'),
      (v_at_roberto, 'reuniao_agendada', 'aguardando_proposta', v_owner_id, now() - interval '2 days');
  END IF;

  -- Juliana: aguardando_agendamento → perdido
  IF v_at_juliana IS NOT NULL THEN
    INSERT INTO status_transitions (atendimento_id, status_anterior, status_novo, operador_id, created_at) VALUES
      (v_at_juliana, NULL, 'aguardando_agendamento', v_owner_id, now() - interval '20 days'),
      (v_at_juliana, 'aguardando_agendamento', 'perdido', v_owner_id, now() - interval '18 days');
  END IF;

  -- Camila: aguardando_agendamento → reuniao_agendada → aguardando_proposta → negociacao → aguardando_contrato → fechado
  IF v_at_camila IS NOT NULL THEN
    INSERT INTO status_transitions (atendimento_id, status_anterior, status_novo, operador_id, created_at) VALUES
      (v_at_camila, NULL, 'aguardando_agendamento', v_owner_id, now() - interval '14 days'),
      (v_at_camila, 'aguardando_agendamento', 'reuniao_agendada', v_owner_id, now() - interval '12 days'),
      (v_at_camila, 'reuniao_agendada', 'aguardando_proposta', v_owner_id, now() - interval '10 days'),
      (v_at_camila, 'aguardando_proposta', 'negociacao', v_owner_id, now() - interval '7 days'),
      (v_at_camila, 'negociacao', 'aguardando_contrato', v_owner_id, now() - interval '4 days'),
      (v_at_camila, 'aguardando_contrato', 'fechado', v_owner_id, now() - interval '2 days');
  END IF;

  -- Ana: aguardando_agendamento → reuniao_agendada
  IF v_at_ana IS NOT NULL THEN
    INSERT INTO status_transitions (atendimento_id, status_anterior, status_novo, operador_id, created_at) VALUES
      (v_at_ana, NULL, 'aguardando_agendamento', v_owner_id, now() - interval '10 days'),
      (v_at_ana, 'aguardando_agendamento', 'reuniao_agendada', v_owner_id, now() - interval '8 days');
  END IF;

END $$;

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 9: Repescagem (para lead perdido)
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
  IF v_owner_id IS NULL THEN RETURN; END IF;

  INSERT INTO repescagem (lead_id, operador_id, motivo, data_retorno, observacao, status, created_at) VALUES
    ('e0000000-0000-0000-0000-000000000008', v_owner_id, 'Já fechou com outro', (now() + interval '7 days')::date, 'Tentar novamente em 1 semana', 'pendente', now() - interval '18 days')
  ON CONFLICT DO NOTHING;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- FIM DO SEED
-- ═══════════════════════════════════════════════════════════════
-- 
-- RESUMO DO DATASET:
-- 
-- | Lead       | Status Temporal | Status Negócio        | Cenário                    |
-- |------------|----------------|-----------------------|----------------------------|
-- | João       | active (<8h)   | —                     | Novo, 2 msgs não lidas     |
-- | Maria      | waiting (12h)  | —                     | Aguardando resposta        |
-- | Carlos     | no_response    | —                     | Sem retorno há 3 dias      |
-- | Ana        | inativo (10d)  | reuniao_agendada      | Inativo, no backoffice     |
-- | Roberto    | waiting (24h)  | aguardando_proposta   | Em negociação, backoffice  |
-- | Fernanda   | active (6h)    | —                     | Ativa, 3 não lidas         |
-- | Pedro      | active (30min) | —                     | Acabou de entrar           |
-- | Juliana    | inativo (20d)  | perdido               | Perdido, reativável        |
-- | Lucas      | active (4h)    | —                     | Reativado                  |
-- | Camila     | no_response    | fechado               | Convertida, contrato ok    |
-- 
-- Abandonos: Carlos (URA trabalhista), Ana (URA família)
-- Others: Carlos (texto livre), Pedro (texto livre)
-- Audit: Roberto (3 transições), Juliana (2), Camila (6), Ana (2)
