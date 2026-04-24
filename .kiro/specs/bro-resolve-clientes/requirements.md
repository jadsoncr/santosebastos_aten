# Documento de Requisitos — BRO Resolve Clientes (Spec 3/4)

## Introdução

Este documento define os requisitos para a Tela 2 — Tela Clientes da plataforma BRO Resolve. A Tela Clientes é a página de fila de tratamento e gestão de leads/clientes, acessível via rota `/tela2`. Apresenta layout de 3 colunas: sidebar de filtros (200px), lista de leads estilo inbox (flex-1) e painel de detalhe (260px).

Pré-requisitos: Spec 1 (base + auth) e Spec 2 (cockpit/Tela Entrada) devem estar completas. Todas as tabelas (`leads`, `clients`, `others`, `abandonos`, `atendimentos`, `pot_tratamento`, `mensagens`, `quick_replies`, `bot_feedback`, `identities`, `identity_channels`, `solicitacoes_clientes`), o Socket.io, o tema light e os componentes da Tela 1 já existem.

Stack: Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, Socket.io, deploy Vercel (web) + Railway (bot).

Princípios:
- Recebidos (leads que entraram via bot) e Enviados (contato iniciado pelo operador) NUNCA se misturam nas abas de filtro.
- Desprezados (others + leads frios + abandonos) existem mas não poluem o fluxo principal.
- Cards financeiros (receita estimada, confirmada, a receber) são visíveis apenas para role `owner`.
- `SUPABASE_SERVICE_ROLE_KEY` exclusivamente server-side.
- Design tokens do Tema_Light definidos na Spec 2 são reutilizados integralmente.

## Glossário

- **Tela_Clientes**: Página em `web/app/(dashboard)/tela2/page.tsx` com layout de 3 colunas: FilterSidebar, LeadList e DetailPanel.
- **FilterSidebar**: Coluna esquerda (200px) que exibe filtros por status, prioridade e área, com contadores em tempo real.
- **LeadList**: Coluna central (flex-1) que exibe leads em formato inbox, com avatar, nome, pills de classificação, preview do resumo do bot e tempo desde entrada.
- **DetailPanel**: Coluna direita (260px) que exibe dados completos do lead selecionado, histórico de atendimentos, valores estimados/confirmados e botões de ação.
- **MetricsPanel**: Painel de métricas posicionado acima da LeadList, com 4 cards operacionais visíveis para todos e 3 cards financeiros visíveis apenas para Owner.
- **Card_Entradas_Hoje**: Card que exibe contagem de leads criados hoje (WHERE `created_at >= hoje`).
- **Card_Tempo_Medio**: Card que exibe tempo médio de resposta calculado como média de (`assumido_em - created_at`) da tabela `atendimentos`.
- **Card_Prioridades**: Card que exibe pills coloridas com contagem de leads por prioridade: quente (score >= 7), morno (score >= 4), frio (score < 4).
- **Card_Abandonos**: Card que exibe contagem de abandonos do dia (WHERE `created_at >= hoje` na tabela `abandonos`).
- **Card_Receita_Estimada**: Card owner-only que exibe soma de `valor_estimado` da tabela `pot_tratamento` WHERE mês corrente.
- **Card_Receita_Confirmada**: Card owner-only que exibe soma de `valor_confirmado` da tabela `pot_tratamento` WHERE mês corrente.
- **Card_A_Receber**: Card owner-only que exibe diferença entre receita estimada e receita confirmada do mês.
- **Filtro_Status**: Seção da FilterSidebar com opções: Recebidos, Enviados, Aguardando resposta, Pot ativo, Desprezados — cada um com contagem.
- **Filtro_Prioridade**: Seção da FilterSidebar com opções clicáveis: Quente, Morno, Frio.
- **Filtro_Area**: Seção da FilterSidebar com lista de áreas jurídicas e contagens.
- **Recebidos**: Leads que entraram via bot (canal_origem preenchido, sem atendimento com origem operador).
- **Enviados**: Leads cujo primeiro contato foi iniciado pelo operador (atendimento com origem operador).
- **Desprezados**: Registros da tabela `others` + leads com prioridade FRIO + registros da tabela `abandonos`.
- **Operador**: Usuário autenticado com role `operador`.
- **Owner**: Usuário autenticado com role `owner` com acesso total incluindo cards financeiros.
- **Tema_Light**: Design tokens definidos na Spec 2 com fundo branco (#FFFFFF), superfícies claras (#F7F7F5) e accent azul (#1A73E8).

## Requisitos

### Requisito 1: Layout de 3 Colunas da Tela Clientes

**User Story:** Como operador, eu quero uma interface de 3 colunas na Tela Clientes, para filtrar, visualizar e detalhar leads de forma eficiente.

#### Critérios de Aceitação

1. THE Tela_Clientes SHALL renderizar layout de 3 colunas: FilterSidebar (200px fixa à esquerda), LeadList (flex-1 no centro) e DetailPanel (260px fixa à direita).
2. THE Tela_Clientes SHALL ocupar 100% da altura disponível dentro do Dashboard_Layout (excluindo Header).
3. THE Tela_Clientes SHALL separar as colunas com bordas verticais utilizando a cor `border` (#E8E7E1) do Tema_Light.
4. WHEN nenhum lead estiver selecionado, THE DetailPanel SHALL exibir mensagem indicando que o operador deve selecionar um lead na lista.
5. THE Tela_Clientes SHALL residir em `web/app/(dashboard)/tela2/page.tsx`.

### Requisito 2: Painel de Métricas — Cards Operacionais

**User Story:** Como operador, eu quero visualizar métricas operacionais do dia no topo da tela, para ter visão rápida do volume e performance do atendimento.

#### Critérios de Aceitação

1. THE MetricsPanel SHALL ser posicionado acima da LeadList, ocupando a largura da coluna central.
2. THE MetricsPanel SHALL exibir 4 cards em grid horizontal: Card_Entradas_Hoje, Card_Tempo_Medio, Card_Prioridades e Card_Abandonos.
3. THE Card_Entradas_Hoje SHALL exibir a contagem de registros na tabela `leads` WHERE `created_at` >= início do dia corrente (00:00:00 UTC-3).
4. THE Card_Tempo_Medio SHALL exibir o tempo médio de resposta calculado como média de (`assumido_em` - `leads.created_at`) dos registros na tabela `atendimentos`, formatado em minutos.
5. THE Card_Prioridades SHALL exibir 3 pills coloridas com contagens: quente (score >= 7, cor `#F97316`), morno (score >= 4 e < 7, cor `#F59E0B`), frio (score < 4, cor `#6B7280`).
6. THE Card_Abandonos SHALL exibir a contagem de registros na tabela `abandonos` WHERE `created_at` >= início do dia corrente.
7. THE MetricsPanel SHALL utilizar background `bg-surface` (#F7F7F5) nos cards com border `border` (#E8E7E1) e border-radius `radius-md` (8px).

### Requisito 3: Painel de Métricas — Cards Financeiros (Owner-Only)

**User Story:** Como owner do escritório, eu quero visualizar métricas financeiras do mês no topo da tela, para acompanhar receita estimada, confirmada e a receber.

#### Critérios de Aceitação

1. WHILE o usuário autenticado tiver role `owner`, THE MetricsPanel SHALL exibir 3 cards adicionais: Card_Receita_Estimada, Card_Receita_Confirmada e Card_A_Receber.
2. WHILE o usuário autenticado tiver role `operador`, THE MetricsPanel SHALL ocultar os 3 cards financeiros.
3. THE Card_Receita_Estimada SHALL exibir a soma de `valor_estimado` da tabela `pot_tratamento` WHERE `created_at` pertence ao mês corrente, formatada em reais (R$).
4. THE Card_Receita_Confirmada SHALL exibir a soma de `valor_confirmado` da tabela `pot_tratamento` WHERE `created_at` pertence ao mês corrente, formatada em reais (R$).
5. THE Card_A_Receber SHALL exibir a diferença entre Card_Receita_Estimada e Card_Receita_Confirmada, formatada em reais (R$).

### Requisito 4: Sidebar de Filtros — Seção Status

**User Story:** Como operador, eu quero filtrar leads por status na sidebar, para focar no grupo de leads relevante ao meu trabalho atual.

#### Critérios de Aceitação

1. THE FilterSidebar SHALL exibir seção "STATUS" com as opções: Recebidos, Enviados, Aguardando resposta, Pot ativo e Desprezados.
2. THE FilterSidebar SHALL exibir contagem numérica ao lado de cada opção de status.
3. THE FilterSidebar SHALL calcular a contagem de "Recebidos" como total de leads que entraram via bot (canal_origem preenchido, sem atendimento iniciado por operador).
4. THE FilterSidebar SHALL calcular a contagem de "Enviados" como total de leads cujo primeiro contato foi iniciado pelo operador.
5. THE FilterSidebar SHALL calcular a contagem de "Aguardando resposta" como total de leads com atendimento status `aberto` e última mensagem enviada pelo operador.
6. THE FilterSidebar SHALL calcular a contagem de "Pot ativo" como total de registros na tabela `pot_tratamento` WHERE `status = 'ativo'`.
7. THE FilterSidebar SHALL calcular a contagem de "Desprezados" como soma de: registros na tabela `others` + leads com prioridade `FRIO` + registros na tabela `abandonos`.
8. WHEN o operador clicar em uma opção de status, THE LeadList SHALL filtrar e exibir apenas os leads correspondentes ao status selecionado.
9. THE FilterSidebar SHALL destacar visualmente a opção de status selecionada com background `accent/10` e texto `accent`.

### Requisito 5: Sidebar de Filtros — Seção Prioridade

**User Story:** Como operador, eu quero filtrar leads por prioridade, para focar nos leads com maior potencial de conversão.

#### Critérios de Aceitação

1. THE FilterSidebar SHALL exibir seção "PRIORIDADE" com as opções clicáveis: Quente, Morno e Frio.
2. THE FilterSidebar SHALL exibir cada opção de prioridade com cor correspondente: Quente (`#F97316`), Morno (`#F59E0B`), Frio (`#6B7280`).
3. WHEN o operador clicar em uma opção de prioridade, THE LeadList SHALL filtrar e exibir apenas os leads com a prioridade selecionada.
4. THE FilterSidebar SHALL permitir combinar filtro de prioridade com filtro de status ativo.

### Requisito 6: Sidebar de Filtros — Seção Área

**User Story:** Como operador, eu quero filtrar leads por área jurídica, para focar em leads da minha especialidade.

#### Critérios de Aceitação

1. THE FilterSidebar SHALL exibir seção "ÁREA" com lista de áreas jurídicas distintas extraídas da coluna `area` da tabela `leads`.
2. THE FilterSidebar SHALL exibir contagem de leads ao lado de cada área.
3. WHEN o operador clicar em uma área, THE LeadList SHALL filtrar e exibir apenas os leads da área selecionada.
4. THE FilterSidebar SHALL permitir combinar filtro de área com filtros de status e prioridade ativos.

### Requisito 7: Lista de Leads — Formato Inbox

**User Story:** Como operador, eu quero visualizar leads em formato inbox com informações resumidas, para identificar rapidamente leads relevantes e priorizar atendimento.

#### Critérios de Aceitação

1. THE LeadList SHALL exibir leads em formato de lista vertical estilo inbox, abaixo do MetricsPanel.
2. THE LeadList SHALL exibir para cada lead: avatar com iniciais e cor de prioridade como borda, nome (ou telefone se nome indisponível), pills de área e canal (TG/WA), score numérico, preview do resumo do bot (campo `resumo` da tabela `leads`), tempo desde entrada (formatado como "Xh", "Xmin" ou "Xd") e status atual.
3. THE LeadList SHALL ordenar leads por score decrescente como ordenação padrão.
4. WHEN o operador clicar em um lead na LeadList, THE Tela_Clientes SHALL selecionar o lead, destacar o item com borda esquerda verde (`#1DB954`) e carregar seus dados no DetailPanel.
5. THE LeadList SHALL aplicar os filtros ativos da FilterSidebar (status, prioridade, área) de forma combinada.
6. THE LeadList SHALL exibir indicador de canal de origem: "TG" para Telegram e "WA" para WhatsApp, com pill colorida.

### Requisito 8: Painel de Detalhe do Lead

**User Story:** Como operador, eu quero visualizar dados completos do lead selecionado com histórico e ações disponíveis, para tomar decisões informadas sobre o atendimento.

#### Critérios de Aceitação

1. WHEN um lead for selecionado na LeadList, THE DetailPanel SHALL exibir os dados do lead: nome, telefone, área classificada (area_bot e area_humano), score com indicador visual de cor, prioridade, canal de origem e resumo do bot.
2. THE DetailPanel SHALL exibir a classificação confirmada do lead (area_humano se disponível, senão area_bot).
3. THE DetailPanel SHALL exibir histórico de atendimentos do lead carregado da tabela `atendimentos`, incluindo operador responsável, status, data de assunção e data de encerramento.
4. THE DetailPanel SHALL exibir valor estimado e valor confirmado do lead carregados da tabela `pot_tratamento`.
5. THE DetailPanel SHALL exibir 3 botões de ação: "ABRIR NO CHAT", "CHAMAR NO WA" e "MOVER PARA...".
6. THE DetailPanel SHALL utilizar background `bg-surface` (#F7F7F5) e design tokens do Tema_Light.

### Requisito 9: Ação — Abrir no Chat

**User Story:** Como operador, eu quero abrir o chat com um lead diretamente da Tela Clientes, para iniciar ou continuar o atendimento na Tela Entrada.

#### Critérios de Aceitação

1. WHEN o operador clicar em "ABRIR NO CHAT" no DetailPanel, THE Tela_Clientes SHALL navegar para `/tela1` com o lead selecionado pré-carregado.
2. THE Tela_Clientes SHALL passar o `lead_id` como query parameter na navegação para `/tela1` (ex: `/tela1?lead=UUID`).
3. WHEN a Tela Entrada (`/tela1`) receber query parameter `lead`, THE Cockpit SHALL selecionar automaticamente o lead correspondente na ConversasSidebar e carregar seus dados no ChatCentral e PainelLead.

### Requisito 10: Ação — Chamar no WhatsApp

**User Story:** Como operador, eu quero iniciar contato com um lead via WhatsApp diretamente da Tela Clientes, para entrar em contato proativamente.

#### Critérios de Aceitação

1. WHEN o operador clicar em "CHAMAR NO WA" no DetailPanel, THE Tela_Clientes SHALL enviar POST para route handler `/api/whatsapp/enviar` com `{ lead_id, telefone, mensagem }`, reutilizando o mesmo endpoint da Spec 2.
2. WHEN o lead selecionado possuir telefone registrado, THE DetailPanel SHALL habilitar o botão "CHAMAR NO WA".
3. WHEN o lead selecionado não possuir telefone registrado, THE DetailPanel SHALL desabilitar o botão "CHAMAR NO WA" com indicação visual de indisponibilidade.
4. IF o POST para o endpoint falhar, THEN THE Tela_Clientes SHALL exibir mensagem de erro ao operador.

### Requisito 11: Ação — Mover Para

**User Story:** Como operador, eu quero mover um lead entre categorias de status, para organizar o pipeline de atendimento.

#### Critérios de Aceitação

1. WHEN o operador clicar em "MOVER PARA..." no DetailPanel, THE DetailPanel SHALL exibir dropdown com opções de destino: "Pot Tratamento", "Desprezados" e "Convertido (Cliente)".
2. WHEN o operador selecionar "Pot Tratamento", THE Tela_Clientes SHALL abrir o PopupEnfileirar (mesmo componente da Spec 2) para preencher dados de tratamento.
3. WHEN o operador selecionar "Desprezados", THE Tela_Clientes SHALL atualizar o status do lead para `DESPREZADO` e mover o lead para a categoria Desprezados na FilterSidebar.
4. WHEN o operador selecionar "Convertido (Cliente)", THE Tela_Clientes SHALL atualizar o status do atendimento para `convertido`, registrar `classificacao_final` e atualizar contadores na FilterSidebar.
5. WHEN uma ação de mover for concluída com sucesso, THE LeadList SHALL atualizar a lista removendo o lead da categoria atual e atualizando contadores na FilterSidebar.

### Requisito 12: Integração Socket.io — Atualizações em Tempo Real

**User Story:** Como operador, eu quero que a Tela Clientes atualize em tempo real quando novos leads entrarem ou status mudarem, para manter a visão sempre atualizada sem refresh manual.

#### Critérios de Aceitação

1. WHEN o Socket_Client receber evento `nova_mensagem_salva`, THE MetricsPanel SHALL recalcular e atualizar os contadores dos cards operacionais.
2. WHEN o Socket_Client receber evento `lead_assumido`, THE LeadList SHALL atualizar o status visual do lead correspondente e THE FilterSidebar SHALL atualizar os contadores de status.
3. WHEN o Socket_Client receber evento `lead_delegado`, THE LeadList SHALL atualizar o operador responsável do lead correspondente.
4. THE Tela_Clientes SHALL reutilizar o Socket_Provider já configurado no Dashboard_Layout pela Spec 2.
5. WHEN o Socket_Client receber evento `nova_mensagem_salva` para um lead novo (não presente na lista), THE LeadList SHALL adicionar o lead à lista e THE MetricsPanel SHALL incrementar o Card_Entradas_Hoje.

### Requisito 13: Segurança e Regras de Negócio

**User Story:** Como owner do escritório, eu quero que as regras de negócio e segurança sejam respeitadas na Tela Clientes, para garantir integridade dos dados e controle de acesso.

#### Critérios de Aceitação

1. THE Tela_Clientes SHALL garantir que leads Recebidos (via bot) e leads Enviados (iniciados por operador) não se misturem nas abas de filtro de status.
2. THE Tela_Clientes SHALL garantir que leads Desprezados (others + frios + abandonos) não poluam o fluxo principal — Desprezados são exibidos apenas quando o filtro "Desprezados" estiver ativo.
3. WHILE o usuário autenticado tiver role `operador`, THE MetricsPanel SHALL ocultar os cards financeiros (Card_Receita_Estimada, Card_Receita_Confirmada, Card_A_Receber).
4. THE Tela_Clientes SHALL garantir que `SUPABASE_SERVICE_ROLE_KEY` não seja utilizada em nenhum componente client-side da Tela Clientes.
5. THE Tela_Clientes SHALL reutilizar os design tokens do Tema_Light definidos na Spec 2 sem introduzir novos tokens de cor.
6. THE Tela_Clientes SHALL garantir que o valor de `area_bot` de um lead não seja sobrescrito por nenhuma operação na Tela Clientes.
