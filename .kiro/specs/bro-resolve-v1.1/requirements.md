# Documento de Requisitos — BRO Resolve v1.1

## Introdução

O BRO Resolve v1.1 evolui o cockpit operacional existente para um ERP jurídico SaaS profissional. A evolução abrange quatro blocos: (1) Árvore Dinâmica de 3 Níveis para classificação hierárquica de segmentos, (2) Pipeline de 8 Estados Operacionais para gestão formal do ciclo de vida do lead, (3) Limpeza Visual e Copy Profissional para eliminar emojis e adotar linguagem B2B/jurídica, e (4) Momento WOW de conversão com webhook, mensagem de boas-vindas e efeito visual. A arquitetura é dinâmica — pré-configurada para o escritório Santos & Bastos, mas extensível para qualquer tipo de negócio.

## Glossário

- **Sistema**: O BRO Resolve v1.1 como um todo (backend + frontend + banco de dados)
- **Cockpit**: Tela principal de atendimento (`/tela1`) com 3 colunas: sidebar, chat central e painel do lead
- **Pipeline**: Sequência linear de 8 estados operacionais que um lead percorre desde a captação até o encerramento
- **Árvore_de_Segmentos**: Estrutura hierárquica de 3 níveis (Segmento → Assunto → Especificação) armazenada na tabela `segment_trees`
- **Segmento**: Nível 1 da Árvore_de_Segmentos (ex: Trabalhista, Família, Consumidor)
- **Assunto**: Nível 2 da Árvore_de_Segmentos, filho de um Segmento (ex: Assédio Moral, Rescisão)
- **Especificação**: Nível 3 da Árvore_de_Segmentos, filho de um Assunto (ex: Humilhação, Abuso de Poder)
- **Persona**: Nome do advogado-bot vinculado a um Segmento (ex: Dra. Mariana para Família)
- **Momento_WOW**: Evento de conversão que ocorre na transição para CARTEIRA_ATIVA, com webhook, mensagem e efeito visual
- **Operador**: Usuário autenticado com role `operador` que atende leads no Cockpit
- **Owner**: Usuário autenticado com role `owner` que tem acesso ao painel financeiro e ao backoffice
- **Lead**: Registro de um prospecto no sistema, identificado por `identity_id`
- **Sidebar_Pipeline**: Barra lateral esquerda do Cockpit reorganizada por estágios do Pipeline
- **Barra_de_Progresso**: Indicador visual no header do chat mostrando o estágio atual do Pipeline
- **Backoffice_Segmentos**: Tela administrativa para CRUD da Árvore_de_Segmentos
- **Webhook_WOW**: Requisição HTTP POST disparada para URL configurável quando um lead atinge CARTEIRA_ATIVA
- **BlocoQualificacao**: Componente do PainelLead que exibe e permite editar dados de qualificação do lead
- **Tema_Light**: Conjunto de design tokens (cores, tipografia, espaçamento) definidos em `globals.css` e `tailwind.config.ts`
- **Socket_IO**: Camada de comunicação em tempo real entre backend e frontend via Socket.io

## Requisitos

### Requisito 1: Tabela segment_trees com Hierarquia de 3 Níveis

**User Story:** Como owner, quero uma estrutura hierárquica de classificação com 3 níveis (Segmento → Assunto → Especificação), para que a qualificação de leads seja granular e extensível a qualquer tipo de negócio.

#### Critérios de Aceitação

1. THE Sistema SHALL armazenar nós da Árvore_de_Segmentos na tabela `segment_trees` com colunas: `id` (UUID PK), `parent_id` (UUID FK self-referencing, nullable), `nivel` (INTEGER, valores 1, 2 ou 3), `nome` (TEXT), `persona` (TEXT, nullable), `ativo` (BOOLEAN, default true), `created_at` (TIMESTAMPTZ).
2. WHEN um nó de nível 1 é criado, THE Sistema SHALL aceitar `parent_id` como NULL e `nivel` como 1.
3. WHEN um nó de nível 2 é criado, THE Sistema SHALL exigir que `parent_id` referencie um nó de nível 1 existente e ativo.
4. WHEN um nó de nível 3 é criado, THE Sistema SHALL exigir que `parent_id` referencie um nó de nível 2 existente e ativo.
5. THE Sistema SHALL impedir a criação de nós com `nivel` diferente de 1, 2 ou 3.
6. THE Sistema SHALL garantir unicidade de `nome` dentro do mesmo `parent_id` (irmãos com nomes distintos).
7. THE Sistema SHALL incluir seed data pré-configurada para Santos & Bastos com os Segmentos: Trabalhista, Família, Consumidor, Cível, Empresarial, Saúde.
8. THE Sistema SHALL incluir seed data de Assuntos para o Segmento Trabalhista: Assédio Moral, Assédio Sexual, Rescisão, Horas Extras, Acidente de Trabalho.
9. THE Sistema SHALL incluir seed data de Especificações para o Assunto Assédio Moral: Humilhação, Abuso de Poder, Isolamento.
10. THE Sistema SHALL aplicar Row Level Security na tabela `segment_trees` permitindo SELECT para `authenticated` e ALL para `service_role`.

### Requisito 2: Persona Vinculada ao Segmento

**User Story:** Como operador, quero que a persona do bot seja automaticamente determinada pelo Segmento selecionado, para que o atendimento automatizado use o advogado correto.

#### Critérios de Aceitação

1. WHEN um Segmento de nível 1 possui o campo `persona` preenchido, THE Sistema SHALL utilizar esse valor como nome da persona do bot para leads classificados nesse Segmento.
2. WHEN o campo `persona` de um Segmento de nível 1 é NULL, THE Sistema SHALL utilizar a persona padrão "Atendimento Santos & Bastos".
3. THE Sistema SHALL incluir seed data de personas nos Segmentos: Trabalhista → "Dr. Rafael", Família → "Dra. Mariana", Consumidor → "Dra. Beatriz", Cível → "Dr. André", Empresarial → "Dr. Carlos", Saúde → "Dra. Patrícia".

### Requisito 3: Dropdowns Cascata no BlocoQualificacao

**User Story:** Como operador, quero selecionar Segmento, Assunto e Especificação em dropdowns interdependentes no painel do lead, para que a classificação seja precisa e hierárquica.

#### Critérios de Aceitação

1. THE BlocoQualificacao SHALL exibir três dropdowns sequenciais: Segmento (nível 1), Assunto (nível 2) e Especificação (nível 3), substituindo o dropdown único de `areas_juridicas` atual.
2. WHEN o Cockpit é carregado, THE BlocoQualificacao SHALL popular o dropdown de Segmento com todos os nós de nível 1 ativos da tabela `segment_trees`.
3. WHEN o operador seleciona um Segmento, THE BlocoQualificacao SHALL popular o dropdown de Assunto com os nós de nível 2 ativos cujo `parent_id` corresponde ao Segmento selecionado.
4. WHEN o operador seleciona um Assunto, THE BlocoQualificacao SHALL popular o dropdown de Especificação com os nós de nível 3 ativos cujo `parent_id` corresponde ao Assunto selecionado.
5. WHEN o operador altera o Segmento, THE BlocoQualificacao SHALL limpar as seleções de Assunto e Especificação.
6. WHEN o operador altera o Assunto, THE BlocoQualificacao SHALL limpar a seleção de Especificação.
7. WHEN um nível não possui filhos ativos, THE BlocoQualificacao SHALL desabilitar o dropdown correspondente e exibir o texto "Nenhuma opção disponível".
8. WHEN o operador confirma a seleção, THE Sistema SHALL persistir os IDs selecionados nas colunas `segmento_id`, `assunto_id` e `especificacao_id` da tabela `leads`.

### Requisito 4: Backoffice CRUD da Árvore de Segmentos

**User Story:** Como owner, quero gerenciar a árvore de segmentos (adicionar, editar, desativar nós), para que a classificação se adapte à evolução do negócio.

#### Critérios de Aceitação

1. THE Backoffice_Segmentos SHALL ser acessível via rota `/backoffice/segmentos` apenas para usuários com role `owner`.
2. THE Backoffice_Segmentos SHALL exibir a Árvore_de_Segmentos em formato hierárquico visual (árvore expansível com 3 níveis).
3. WHEN o owner clica em "Adicionar" em um nó, THE Backoffice_Segmentos SHALL exibir formulário para criar um nó filho com campos: nome (obrigatório), persona (opcional, apenas nível 1).
4. WHEN o owner edita um nó, THE Backoffice_Segmentos SHALL permitir alterar o nome e a persona (nível 1) do nó.
5. WHEN o owner desativa um nó, THE Backoffice_Segmentos SHALL definir `ativo = false` no nó e em todos os seus descendentes.
6. IF o owner tenta criar um nó com nome duplicado dentro do mesmo pai, THEN THE Backoffice_Segmentos SHALL exibir mensagem de erro "Já existe um item com este nome neste nível".
7. THE Backoffice_Segmentos SHALL utilizar os design tokens do Tema_Light existente.

### Requisito 5: Pipeline de 8 Estados Operacionais

**User Story:** Como operador, quero que cada lead percorra um pipeline formal de 8 estágios, para que o ciclo de vida do atendimento seja rastreável e padronizado.

#### Critérios de Aceitação

1. THE Sistema SHALL armazenar o estado do pipeline na coluna `status_pipeline` da tabela `leads` com os valores permitidos: ENTRADA, QUALIFICADO, EM_ATENDIMENTO, AGENDAMENTO, DEVOLUTIVA, PAGAMENTO_PENDENTE, CARTEIRA_ATIVA, FINALIZADO.
2. THE Sistema SHALL definir ENTRADA como valor padrão de `status_pipeline` para novos leads.
3. WHEN um lead possui nome e telefone preenchidos e score maior que 7, THE Sistema SHALL permitir a transição de ENTRADA para QUALIFICADO.
4. WHEN um operador assume um lead (evento `assumir_lead`), THE Sistema SHALL transicionar o lead de QUALIFICADO para EM_ATENDIMENTO.
5. WHEN o operador registra um agendamento (data, hora, local), THE Sistema SHALL transicionar o lead de EM_ATENDIMENTO para AGENDAMENTO.
6. WHEN o operador registra o envio de documento contratual, THE Sistema SHALL transicionar o lead de AGENDAMENTO para DEVOLUTIVA.
7. WHEN o operador confirma o recebimento do documento assinado, THE Sistema SHALL transicionar o lead de DEVOLUTIVA para PAGAMENTO_PENDENTE.
8. WHEN o operador informa `valor_entrada` e `metodo_pagamento`, THE Sistema SHALL transicionar o lead de PAGAMENTO_PENDENTE para CARTEIRA_ATIVA e disparar o Momento_WOW.
9. WHEN o operador informa `valor_honorarios_finais` e `data_baixa`, THE Sistema SHALL transicionar o lead de CARTEIRA_ATIVA para FINALIZADO.
10. THE Sistema SHALL impedir transições que pulem estágios (ex: de ENTRADA direto para AGENDAMENTO).
11. THE Sistema SHALL persistir cada transição de pipeline no banco de dados e emitir evento `pipeline_changed` via Socket_IO com payload `{ lead_id, status_anterior, status_novo }`.

### Requisito 6: Campos Financeiros do Pipeline

**User Story:** Como operador, quero registrar dados financeiros em estágios específicos do pipeline, para que a gestão financeira seja integrada ao fluxo de atendimento.

#### Critérios de Aceitação

1. THE Sistema SHALL adicionar as colunas `valor_entrada` (NUMERIC), `metodo_pagamento` (TEXT), `valor_honorarios_finais` (NUMERIC) e `data_baixa` (TIMESTAMPTZ) à tabela `atendimentos`.
2. WHEN o lead está no estágio PAGAMENTO_PENDENTE, THE BlocoQualificacao SHALL exibir campos editáveis para `valor_entrada` e `metodo_pagamento`.
3. WHEN o lead está no estágio CARTEIRA_ATIVA, THE BlocoQualificacao SHALL exibir campos editáveis para `valor_honorarios_finais` e `data_baixa`.
4. THE Sistema SHALL validar que `valor_entrada` é um número positivo antes de permitir a transição para CARTEIRA_ATIVA.
5. THE Sistema SHALL validar que `valor_honorarios_finais` é um número positivo e `data_baixa` é uma data válida antes de permitir a transição para FINALIZADO.

### Requisito 7: Sidebar Reorganizada por Pipeline

**User Story:** Como operador, quero que a sidebar do Cockpit organize os leads por estágio do pipeline, para que eu visualize rapidamente a distribuição do funil.

#### Critérios de Aceitação

1. THE Sidebar_Pipeline SHALL exibir seções colapsáveis para cada estágio do pipeline: Captação (ENTRADA), Qualificação (QUALIFICADO), Em Atendimento (EM_ATENDIMENTO), Agendamento (AGENDAMENTO), Devolutiva (DEVOLUTIVA), Pagamento Pendente (PAGAMENTO_PENDENTE), Carteira Ativa (CARTEIRA_ATIVA).
2. THE Sidebar_Pipeline SHALL exibir o contador de leads em cada seção ao lado do nome do estágio.
3. THE Sidebar_Pipeline SHALL substituir as seções atuais ("Prioridade Máxima", "Em Curso", "Em Pausa") pelas seções de pipeline.
4. WHEN um lead muda de estágio via Socket_IO (evento `pipeline_changed`), THE Sidebar_Pipeline SHALL mover o lead para a seção correspondente em tempo real sem recarregar a página.
5. THE Sidebar_Pipeline SHALL não exibir a seção FINALIZADO (leads finalizados saem da sidebar).

### Requisito 8: Barra de Progresso no Header do Chat

**User Story:** Como operador, quero ver uma barra de progresso no header do chat indicando o estágio atual do pipeline, para que eu saiba rapidamente em que ponto do funil o lead está.

#### Critérios de Aceitação

1. WHEN um lead é selecionado no Cockpit, THE Barra_de_Progresso SHALL ser exibida no header do ChatCentral mostrando os 8 estágios do pipeline como pontos ou segmentos sequenciais.
2. THE Barra_de_Progresso SHALL destacar visualmente o estágio atual do lead (cor accent) e marcar os estágios anteriores como concluídos (cor success).
3. THE Barra_de_Progresso SHALL exibir o nome do estágio atual em texto abaixo da barra.
4. WHEN o estágio do lead muda via Socket_IO, THE Barra_de_Progresso SHALL atualizar em tempo real.

### Requisito 9: Remoção de Emojis da Interface

**User Story:** Como owner, quero que toda a interface do Cockpit use ícones SVG profissionais ou labels de texto em vez de emojis, para que o produto tenha aparência de SaaS B2B.

#### Critérios de Aceitação

1. THE Sistema SHALL substituir todos os emojis da Sidebar (📥, 👥, 💰) por ícones SVG monocromáticos ou labels de texto.
2. THE Sistema SHALL substituir todos os emojis dos badges no CardBotTree (🎯 LEAD, 👤 CLIENTE, 🔥 REAQUECIDO) por labels de texto com estilo profissional.
3. THE Sistema SHALL substituir todos os emojis do ChatCentral (👤 Atendimento Humano, 🤖 Automação Ativa, 📝 Nota interna) por ícones SVG ou prefixos de texto.
4. THE Sistema SHALL substituir todos os emojis do BlocoQualificacao (✏️, 🔗, 📝) por ícones SVG ou texto descritivo.
5. THE Sistema SHALL substituir os emojis da ConversasSidebar (🔥, 👤, ⚠️, ⏰) por indicadores visuais com CSS (cores, bordas, ícones SVG).
6. THE Sistema SHALL substituir os emojis das seções da sidebar ("🔥 PRIORIDADE MÁXIMA", "💬 EM CURSO", "⏳ EM PAUSA") por labels de texto profissional.

### Requisito 10: Terminologia Profissional B2B/Jurídica

**User Story:** Como owner, quero que toda a terminologia da interface use linguagem profissional jurídica/B2B, para que o produto transmita seriedade e credibilidade.

#### Critérios de Aceitação

1. THE Sidebar SHALL exibir os labels: "Captação" (em vez de "Entrada"), "Carteira" (em vez de "Clientes"), "Gestão Financeira" (em vez de "Financeiro").
2. THE ConversasSidebar SHALL exibir os labels de seção: "Captação" (em vez de "PRIORIDADE MÁXIMA"), "Em Atendimento" (em vez de "EM CURSO"), "Aguardando Retorno" (em vez de "EM PAUSA").
3. THE CardBotTree SHALL exibir os badges: "Prospecto" (em vez de "LEAD"), "Carteira Ativa" (em vez de "CLIENTE").
4. THE BlocoQualificacao SHALL exibir o label "Dossiê Estratégico" (em vez de "Notas Internas") para a seção de notas.
5. THE ScoreCircle SHALL exibir labels de score profissionais: "Alta Propensão" (score >= 7), "Média Propensão" (score >= 4), "Baixa Propensão" (score < 4), em vez de "Quente/Morno/Frio".
6. THE Sistema SHALL aplicar as mudanças de terminologia de forma consistente em todos os componentes que referenciam os termos antigos.

### Requisito 11: Estilo Visual Profissional SaaS

**User Story:** Como owner, quero que o estilo visual do Cockpit seja limpo, sóbrio e profissional, para que o produto tenha identidade de SaaS B2B.

#### Critérios de Aceitação

1. THE Sistema SHALL manter a paleta de cores do Tema_Light existente (bg-primary, accent, success, error, warning) sem alterações de valores hex.
2. THE Sistema SHALL substituir o estilo Post-it amarelo das notas internas (bg-[#FFFBEB] com borda warning) por um estilo neutro com fundo `bg-surface` e borda `border`.
3. THE Sistema SHALL utilizar tipografia consistente: Syne para títulos, Inter para corpo, JetBrains Mono para dados numéricos e timestamps.
4. THE Sistema SHALL remover qualquer linguagem casual da interface (ex: "Chamar no WA" → "Contato via WhatsApp").

### Requisito 12: Momento WOW — Disparo de Webhook

**User Story:** Como owner, quero que o sistema dispare um webhook para um grupo quando um lead atinge CARTEIRA_ATIVA, para que a equipe seja notificada da conversão em tempo real.

#### Critérios de Aceitação

1. WHEN um lead transiciona para CARTEIRA_ATIVA, THE Sistema SHALL enviar uma requisição HTTP POST para a URL configurada na variável de ambiente `WEBHOOK_WOW_URL`.
2. THE Webhook_WOW SHALL incluir no payload: `nome` do lead, `telefone`, `segmento` (nível 1), `assunto` (nível 2), `valor_entrada`, `metodo_pagamento`, `operador_nome`, `data_conversao`.
3. IF a variável `WEBHOOK_WOW_URL` não estiver configurada, THEN THE Sistema SHALL registrar um log de warning e prosseguir sem erro.
4. IF a requisição ao webhook falhar (timeout ou status >= 400), THEN THE Sistema SHALL registrar o erro em log e prosseguir sem bloquear a transição do pipeline.

### Requisito 13: Momento WOW — Mensagem de Boas-Vindas

**User Story:** Como owner, quero que o sistema envie uma mensagem profissional de boas-vindas ao cliente via bot quando o lead atinge CARTEIRA_ATIVA, para que o cliente tenha uma experiência de onboarding positiva.

#### Critérios de Aceitação

1. WHEN um lead transiciona para CARTEIRA_ATIVA, THE Sistema SHALL enviar uma mensagem de boas-vindas ao cliente via o canal de origem (Telegram ou WhatsApp).
2. THE mensagem de boas-vindas SHALL conter: saudação com o nome do cliente, confirmação da área de atuação (Segmento), nome da persona responsável e informação de próximos passos.
3. THE mensagem de boas-vindas SHALL utilizar linguagem profissional sem emojis.
4. THE Sistema SHALL persistir a mensagem de boas-vindas na tabela `mensagens` com `tipo = 'sistema'` e `de = 'bot'`.

### Requisito 14: Momento WOW — Efeito Visual de Conversão

**User Story:** Como operador, quero ver um efeito visual no Cockpit quando um lead é convertido para CARTEIRA_ATIVA, para que a conversão seja celebrada e visualmente perceptível.

#### Critérios de Aceitação

1. WHEN um lead transiciona para CARTEIRA_ATIVA, THE Cockpit SHALL exibir um efeito visual de destaque no card do lead na Sidebar_Pipeline por 3 segundos.
2. THE efeito visual SHALL consistir em um pulso de borda com cor `success` (#1DB954) e um badge temporário "Convertido" no card do lead.
3. WHEN o efeito visual é exibido, THE Cockpit SHALL emitir um som sutil de notificação (opcional, configurável).
4. THE efeito visual SHALL ser acionado via evento Socket_IO `pipeline_changed` quando `status_novo === 'CARTEIRA_ATIVA'`.

### Requisito 15: Atualização em Tempo Real do Pipeline via Socket.io

**User Story:** Como operador, quero que todas as mudanças de pipeline sejam refletidas em tempo real no Cockpit, para que eu trabalhe sempre com dados atualizados.

#### Critérios de Aceitação

1. WHEN o status_pipeline de um lead é alterado no backend, THE Sistema SHALL emitir evento `pipeline_changed` via Socket_IO com payload `{ lead_id, status_anterior, status_novo, operador_id }`.
2. WHEN o frontend recebe o evento `pipeline_changed`, THE Sidebar_Pipeline SHALL mover o lead para a seção do novo estágio.
3. WHEN o frontend recebe o evento `pipeline_changed`, THE Barra_de_Progresso SHALL atualizar para refletir o novo estágio (se o lead estiver selecionado).
4. WHEN o frontend recebe o evento `pipeline_changed` com `status_novo === 'CARTEIRA_ATIVA'`, THE Cockpit SHALL disparar o efeito visual do Momento_WOW.

### Requisito 16: Migração SQL Idempotente

**User Story:** Como desenvolvedor, quero que todas as alterações de banco de dados sejam aplicadas via migração SQL idempotente, para que o deploy seja seguro e repetível.

#### Critérios de Aceitação

1. THE Sistema SHALL criar a migração `012_bro_resolve_v1_1.sql` contendo todas as alterações de schema da v1.1.
2. THE migração SHALL utilizar `CREATE TABLE IF NOT EXISTS` para a tabela `segment_trees`.
3. THE migração SHALL utilizar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para novas colunas em tabelas existentes.
4. THE migração SHALL utilizar `INSERT ... ON CONFLICT DO NOTHING` para seed data.
5. THE migração SHALL ser executável múltiplas vezes sem erro e sem duplicação de dados.
