-- ============================================================
-- Migração 020: motivo_explicacao nas subcategorias
-- Cada nível 3 ganha texto explicativo real (não genérico)
-- ============================================================

ALTER TABLE segment_trees ADD COLUMN IF NOT EXISTS motivo_explicacao TEXT;

-- TRABALHISTA
UPDATE segment_trees SET motivo_explicacao = 'Cliente relata humilhação no ambiente de trabalho' WHERE nivel = 3 AND nome = 'Humilhação';
UPDATE segment_trees SET motivo_explicacao = 'Cliente relata abuso de poder por superior hierárquico' WHERE nivel = 3 AND nome = 'Abuso de Poder';
UPDATE segment_trees SET motivo_explicacao = 'Cliente relata isolamento intencional no trabalho' WHERE nivel = 3 AND nome = 'Isolamento';
UPDATE segment_trees SET motivo_explicacao = 'Cliente relata abordagem sexual indevida no trabalho' WHERE nivel = 3 AND nome = 'Abordagem indevida';
UPDATE segment_trees SET motivo_explicacao = 'Cliente relata coerção sexual no ambiente de trabalho' WHERE nivel = 3 AND nome = 'Coerção';
UPDATE segment_trees SET motivo_explicacao = 'Cliente foi demitido sem justa causa e quer seus direitos' WHERE nivel = 3 AND nome = 'Sem justa causa';
UPDATE segment_trees SET motivo_explicacao = 'Cliente contesta demissão por justa causa' WHERE nivel = 3 AND nome = 'Justa causa contestada';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer pedir rescisão indireta por faltas do empregador' WHERE nivel = 3 AND nome = 'Rescisão indireta';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer negociar acordo trabalhista' WHERE nivel = 3 AND nome = 'Acordo trabalhista';
UPDATE segment_trees SET motivo_explicacao = 'Cliente não recebeu pagamento de horas extras' WHERE nivel = 3 AND nome = 'Não pagamento';
UPDATE segment_trees SET motivo_explicacao = 'Cliente tem banco de horas irregular' WHERE nivel = 3 AND nome = 'Banco de horas irregular';
UPDATE segment_trees SET motivo_explicacao = 'Cliente afastado pelo INSS após acidente de trabalho' WHERE nivel = 3 AND nome = 'Afastamento INSS';
UPDATE segment_trees SET motivo_explicacao = 'Cliente desenvolveu doença por condições de trabalho' WHERE nivel = 3 AND nome = 'Doença ocupacional';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer garantir estabilidade após acidente' WHERE nivel = 3 AND nome = 'Estabilidade acidentária';

-- FAMÍLIA
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer divórcio consensual' WHERE nivel = 3 AND nome = 'Consensual';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer divórcio litigioso' WHERE nivel = 3 AND nome = 'Litigioso';
UPDATE segment_trees SET motivo_explicacao = 'Cliente precisa resolver partilha de bens' WHERE nivel = 3 AND nome = 'Partilha de bens';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer guarda compartilhada' WHERE nivel = 3 AND nome = 'Compartilhada';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer guarda unilateral' WHERE nivel = 3 AND nome = 'Unilateral';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer regulamentar visitas aos filhos' WHERE nivel = 3 AND nome = 'Regulamentação de visitas';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer fixar pensão alimentícia' WHERE nivel = 3 AND nome = 'Fixação';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer revisar valor da pensão' WHERE nivel = 3 AND nome = 'Revisão';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer executar pensão não paga' WHERE nivel = 3 AND nome = 'Execução de alimentos';
UPDATE segment_trees SET motivo_explicacao = 'Cliente precisa abrir inventário judicial' WHERE nivel = 3 AND nome = 'Judicial';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer inventário extrajudicial em cartório' WHERE nivel = 3 AND nome = 'Extrajudicial';

-- CONSUMIDOR
UPDATE segment_trees SET motivo_explicacao = 'Loja recusou trocar produto com defeito' WHERE nivel = 3 AND nome = 'Troca recusada';
UPDATE segment_trees SET motivo_explicacao = 'Garantia do produto foi negada indevidamente' WHERE nivel = 3 AND nome = 'Garantia negada';
UPDATE segment_trees SET motivo_explicacao = 'Produto apresentou defeito oculto após compra' WHERE nivel = 3 AND nome = 'Vício oculto';
UPDATE segment_trees SET motivo_explicacao = 'Cliente cobrado indevidamente no cartão de crédito' WHERE nivel = 3 AND nome = 'Cartão de crédito';
UPDATE segment_trees SET motivo_explicacao = 'Cliente cobrado por serviço que não contratou' WHERE nivel = 3 AND nome = 'Serviço não contratado';
UPDATE segment_trees SET motivo_explicacao = 'Cliente cobrado com taxa abusiva' WHERE nivel = 3 AND nome = 'Taxa abusiva';
UPDATE segment_trees SET motivo_explicacao = 'Oferta prometida não foi cumprida' WHERE nivel = 3 AND nome = 'Oferta não cumprida';
UPDATE segment_trees SET motivo_explicacao = 'Produto vendido com informação falsa' WHERE nivel = 3 AND nome = 'Informação falsa';
UPDATE segment_trees SET motivo_explicacao = 'Cliente negativado indevidamente no SPC/Serasa' WHERE nivel = 3 AND nome = 'SPC/Serasa indevido';
UPDATE segment_trees SET motivo_explicacao = 'Cliente sofreu dano moral por negativação indevida' WHERE nivel = 3 AND nome = 'Dano moral';

-- CÍVEL
UPDATE segment_trees SET motivo_explicacao = 'Outra parte descumpriu contrato' WHERE nivel = 3 AND nome = 'Descumprimento contratual';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer rescindir contrato' WHERE nivel = 3 AND nome = 'Rescisão contratual';
UPDATE segment_trees SET motivo_explicacao = 'Cliente precisa revisar cláusulas contratuais' WHERE nivel = 3 AND nome = 'Revisão de cláusulas';
UPDATE segment_trees SET motivo_explicacao = 'Cliente envolvido em acidente de trânsito' WHERE nivel = 3 AND nome = 'Acidente de trânsito';
UPDATE segment_trees SET motivo_explicacao = 'Cliente sofreu erro médico' WHERE nivel = 3 AND nome = 'Erro médico';
UPDATE segment_trees SET motivo_explicacao = 'Cliente sofreu dano material e quer indenização' WHERE nivel = 3 AND nome = 'Dano material';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer executar título de dívida' WHERE nivel = 3 AND nome = 'Execução de título';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer cobrar dívida via ação monitória' WHERE nivel = 3 AND nome = 'Ação monitória';

-- EMPRESARIAL
UPDATE segment_trees SET motivo_explicacao = 'Sócios querem dissolver a sociedade' WHERE nivel = 3 AND nome = 'Dissolução de sociedade';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer excluir sócio da empresa' WHERE nivel = 3 AND nome = 'Exclusão de sócio';
UPDATE segment_trees SET motivo_explicacao = 'Cliente precisa alterar contrato social' WHERE nivel = 3 AND nome = 'Alteração contratual';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer planejamento tributário' WHERE nivel = 3 AND nome = 'Planejamento tributário';
UPDATE segment_trees SET motivo_explicacao = 'Cliente precisa de defesa em processo fiscal' WHERE nivel = 3 AND nome = 'Defesa fiscal';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer recuperar crédito tributário' WHERE nivel = 3 AND nome = 'Recuperação de crédito';
UPDATE segment_trees SET motivo_explicacao = 'Empresa precisa pedir recuperação judicial' WHERE nivel = 3 AND nome = 'Pedido de recuperação';
UPDATE segment_trees SET motivo_explicacao = 'Empresa em processo de falência' WHERE nivel = 3 AND nome = 'Falência';

-- SAÚDE
UPDATE segment_trees SET motivo_explicacao = 'Plano de saúde negou cobertura de procedimento' WHERE nivel = 3 AND nome = 'Negativa de cobertura';
UPDATE segment_trees SET motivo_explicacao = 'Plano de saúde aplicou reajuste abusivo' WHERE nivel = 3 AND nome = 'Reajuste abusivo';
UPDATE segment_trees SET motivo_explicacao = 'Plano de saúde cancelou contrato unilateralmente' WHERE nivel = 3 AND nome = 'Cancelamento unilateral';
UPDATE segment_trees SET motivo_explicacao = 'Médico deu diagnóstico errado' WHERE nivel = 3 AND nome = 'Diagnóstico errado';
UPDATE segment_trees SET motivo_explicacao = 'Cirurgia mal sucedida causou danos ao cliente' WHERE nivel = 3 AND nome = 'Cirurgia mal sucedida';
UPDATE segment_trees SET motivo_explicacao = 'Cliente precisa de medicamento pelo SUS' WHERE nivel = 3 AND nome = 'Fornecimento pelo SUS';
UPDATE segment_trees SET motivo_explicacao = 'Cliente precisa de medicamento de alto custo' WHERE nivel = 3 AND nome = 'Medicamento de alto custo';

-- INFORMAÇÃO
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer saber como funciona o processo jurídico' WHERE nivel = 3 AND nome = 'Como funciona o processo';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer saber quais documentos precisa' WHERE nivel = 3 AND nome = 'Documentos necessários';
UPDATE segment_trees SET motivo_explicacao = 'Cliente quer saber prazos e custos' WHERE nivel = 3 AND nome = 'Prazos e custos';
UPDATE segment_trees SET motivo_explicacao = 'Cliente perguntou horário de funcionamento' WHERE nivel = 3 AND nome = 'Horário de funcionamento';
UPDATE segment_trees SET motivo_explicacao = 'Cliente perguntou endereço do escritório' WHERE nivel = 3 AND nome = 'Endereço do escritório';

-- GERAL
UPDATE segment_trees SET motivo_explicacao = 'Cliente não demonstrou interesse em prosseguir' WHERE nivel = 3 AND nome = 'Sem interesse';
UPDATE segment_trees SET motivo_explicacao = 'Cliente desistiu do atendimento' WHERE nivel = 3 AND nome = 'Desistiu';
UPDATE segment_trees SET motivo_explicacao = 'Contato identificado como trote' WHERE nivel = 3 AND nome = 'Trote';
UPDATE segment_trees SET motivo_explicacao = 'Cliente parou de responder às mensagens' WHERE nivel = 3 AND nome = 'Parou de responder';
UPDATE segment_trees SET motivo_explicacao = 'Número de telefone incorreto ou inexistente' WHERE nivel = 3 AND nome = 'Número errado';
