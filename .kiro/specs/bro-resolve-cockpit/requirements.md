# Documento de Requisitos — BRO Resolve Cockpit (Spec 2/4)

## Introdução

Este documento define os requisitos para a Tela 1 — Cockpit de Atendimento da plataforma BRO Resolve. O cockpit é uma interface de 3 colunas estilo WhatsApp Web que permite operadores gerenciarem leads em tempo real via WebSocket (Socket.io). Inclui migração de tema (dark → light), nova tabela `mensagens`, integração Socket.io no servidor do bot e no cliente Next.js, e todos os componentes da interface de atendimento.

Pré-requisito: todos os componentes da Spec 1 (login, dashboard layout, Sidebar, Header, tailwind.config.ts, globals.css) devem ser migrados do tema escuro para o tema claro antes de qualquer trabalho na Tela 1.

Stack: Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, Socket.io, Express (CommonJS), deploy Vercel (web) + Railway (bot).

## Glossário

- **Plataforma_Web**: Aplicação Next.js 14 em `web/` que serve como painel operacional do BRO Resolve.
- **Servidor_Bot**: Servidor Express em `server.js` (CommonJS) que processa webhooks do Telegram/WhatsApp e agora também gerencia conexões Socket.io.
- **Tabela_Mensagens**: Tabela `mensagens` no Supabase que armazena todas as mensagens trocadas entre leads e operadores, incluindo notas internas.
- **Socket_Server**: Instância Socket.io acoplada ao HTTP server do Express em `server.js`, responsável por emitir e receber eventos em tempo real.
- **Socket_Client**: Módulo singleton em `web/utils/socket.ts` que conecta ao Socket_Server via `NEXT_PUBLIC_SOCKET_URL`.
- **Socket_Provider**: Context provider React em `web/components/providers/SocketProvider.tsx` que disponibiliza a conexão Socket.io para toda a árvore de componentes do dashboard.
- **Cockpit**: Página Tela 1 em `web/app/(dashboard)/tela1/page.tsx` com layout de 3 colunas: ConversasSidebar, ChatCentral e PainelLead.
- **ConversasSidebar**: Coluna esquerda (280px) que exibe a fila de leads ordenada por score, com atualizações em tempo real via WebSocket.
- **ChatCentral**: Coluna central (flex-1) que exibe o histórico de mensagens do lead selecionado, campo de input com suporte a `/` para quick replies, e botões de ação (ASSUMIR, DELEGAR, AGUARDANDO, ENCERRAR).
- **PainelLead**: Coluna direita (280px) que exibe dados do lead selecionado: círculo de score, pills de classificação (area_bot vs area_humano), dados coletados pelo bot, valor estimado e botões de ação (VIROU CLIENTE, NÃO FECHOU, ENCERRAR E ENFILEIRAR).
- **QuickReplies**: Dropdown acionado por `/` no campo de input do ChatCentral, carrega atalhos da tabela `quick_replies`.
- **PopupEnfileirar**: Modal acionado pelo botão "ENCERRAR E ENFILEIRAR" no PainelLead, com campos proxima_acao, data, valor e observação que insere registro na tabela `pot_tratamento`.
- **Nota_Interna**: Modo alternativo do campo de input do ChatCentral que salva mensagens com `tipo='nota_interna'` na Tabela_Mensagens, renderizadas com estilo diferenciado e nunca enviadas via WhatsApp.
- **Chamar_WA**: Funcionalidade que envia POST para `/api/whatsapp/enviar` (route handler server-side) usando `WEBHOOK_N8N_URL`, permitindo operador iniciar conversa com lead via WhatsApp.
- **Operador**: Usuário autenticado com role `operador` que atende leads no cockpit.
- **Owner**: Usuário autenticado com role `owner` com acesso total à plataforma.
- **Assunção_Atômica**: Mecanismo que garante que um lead seja assumido por no máximo um operador, via constraint `UNIQUE(lead_id)` na tabela `atendimentos` combinado com broadcast WebSocket.
- **Bot_Feedback**: Registro inserido na tabela `bot_feedback` quando o operador altera `area_humano` para valor diferente de `area_bot`.
- **Tema_Light**: Novo conjunto de design tokens com fundo branco (#FFFFFF), superfícies claras (#F7F7F5) e accent azul (#1A73E8) que substitui o tema escuro da Spec 1.

## Requisitos

### Requisito 1: Migração de Tema — Dark para Light (Passo 0)

**User Story:** Como operador, eu quero que a plataforma utilize um tema claro e profissional, para melhor legibilidade durante longas jornadas de atendimento.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL atualizar `web/app/globals.css` substituindo todos os design tokens escuros pelos seguintes tokens claros: background `#FFFFFF`, surface `#F7F7F5`, surface-hover `#F0EFE9`, border `#E8E7E1`, text-primary `#1A1A1A`, text-secondary `#6B6B6B`, text-muted `#ADADAD`, accent `#1A73E8`, success `#1DB954`, warning `#F59E0B`, error `#EF4444`, score-hot `#F97316`, score-warm `#F59E0B`, score-cold `#6B7280`, sidebar-bg `#FAFAF8`, chat-received `#F7F7F5`, chat-sent `#EBF3FE`, note-internal `#FFFBEB`.
2. THE Plataforma_Web SHALL atualizar `web/tailwind.config.ts` substituindo todas as cores do tema escuro pelas cores do Tema_Light correspondentes e adicionando as novas cores (text-secondary, success, warning, score-hot, score-warm, score-cold, sidebar-bg, chat-received, chat-sent, note-internal).
3. THE Plataforma_Web SHALL atualizar o componente Login_Page (`web/app/(auth)/login/page.tsx`) para utilizar as classes Tailwind do Tema_Light em vez das classes do tema escuro.
4. THE Plataforma_Web SHALL atualizar o componente Sidebar (`web/components/Sidebar.tsx`) para utilizar as classes Tailwind do Tema_Light.
5. THE Plataforma_Web SHALL atualizar o componente Header (`web/components/Header.tsx`) para utilizar as classes Tailwind do Tema_Light.
6. THE Plataforma_Web SHALL atualizar o Dashboard_Layout (`web/app/(dashboard)/layout.tsx`) para utilizar as classes Tailwind do Tema_Light.

### Requisito 2: Migração — Tabela Mensagens (Passo 1)

**User Story:** Como operador, eu quero que todas as mensagens trocadas com leads sejam persistidas no banco de dados, para consultar o histórico completo de conversas no cockpit.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL criar a tabela `mensagens` via migração SQL (`sql/migrations/002_bro_resolve_cockpit.sql`) com os campos: `id` (UUID, PK, DEFAULT gen_random_uuid()), `lead_id` (UUID, FK para `leads`, NOT NULL), `de` (TEXT, NOT NULL), `tipo` (TEXT, DEFAULT 'mensagem'), `conteudo` (TEXT, NOT NULL), `operador_id` (UUID, FK para `auth.users`, nullable), `created_at` (TIMESTAMPTZ, DEFAULT now()).
2. THE Plataforma_Web SHALL habilitar RLS na tabela `mensagens`.
3. THE Plataforma_Web SHALL criar política RLS que conceda acesso total (SELECT, INSERT, UPDATE, DELETE) ao role `service_role` na tabela `mensagens`.
4. THE Plataforma_Web SHALL criar política RLS que conceda acesso de leitura (SELECT) ao role `authenticated` na tabela `mensagens`.
5. THE Plataforma_Web SHALL criar política RLS que conceda acesso de inserção (INSERT) ao role `authenticated` na tabela `mensagens`.

### Requisito 3: Socket.io no Servidor Bot (Passo 2)

**User Story:** Como desenvolvedor, eu quero que o servidor do bot suporte conexões WebSocket via Socket.io, para que o cockpit receba atualizações em tempo real.

#### Critérios de Aceitação

1. THE Servidor_Bot SHALL substituir `app.listen()` por `http.createServer(app)` seguido de `server.listen()` em `server.js`, utilizando sintaxe CommonJS (`require`).
2. THE Servidor_Bot SHALL instanciar Socket.io acoplado ao HTTP server com CORS configurado para aceitar conexões de `WEB_URL` (variável de ambiente).
3. THE Servidor_Bot SHALL registrar o evento `assumir_lead` que recebe `{ lead_id, operador_id }` e realiza INSERT na tabela `atendimentos` com tratamento de erro para violação de UNIQUE constraint.
4. THE Servidor_Bot SHALL registrar o evento `delegar_lead` que recebe `{ lead_id, operador_id_origem, operador_id_destino }` e atualiza o registro na tabela `atendimentos`.
5. THE Servidor_Bot SHALL registrar o evento `nova_mensagem` que recebe `{ lead_id, de, conteudo, tipo, operador_id, origem }` e insere na Tabela_Mensagens. WHEN o campo `origem` for igual a `'humano'`, THE Servidor_Bot SHALL salvar a mensagem na Tabela_Mensagens e emitir broadcast, sem processar a mensagem pela state machine.
6. THE Servidor_Bot SHALL registrar o evento `operador_status` que recebe `{ operador_id, status }` e faz broadcast para todos os clientes conectados.
7. WHEN o evento `assumir_lead` for processado com sucesso, THE Servidor_Bot SHALL emitir broadcast `lead_assumido` com `{ lead_id, operador_id }` para todos os clientes conectados.
8. IF o evento `assumir_lead` falhar por violação de UNIQUE constraint, THEN THE Servidor_Bot SHALL emitir `erro_assumir` com mensagem descritiva apenas para o socket que originou o evento.

9. THE Servidor_Bot SHALL utilizar um módulo compartilhado `src/supabaseAdmin.js` que exporta uma instância singleton do Supabase client com `service_role` key (padrão lazy igual ao `identityResolver.js`), reutilizado por `identityResolver.js` e pelos handlers Socket.io.

### Requisito 4: Bot Salva Mensagens (Passo 3)

**User Story:** Como operador, eu quero que o bot registre automaticamente todas as mensagens recebidas e enviadas na tabela mensagens, para que o histórico esteja disponível no cockpit.

#### Critérios de Aceitação

1. WHEN o Servidor_Bot receber uma mensagem de lead via webhook, THE Servidor_Bot SHALL inserir um registro na Tabela_Mensagens com `de` igual ao identificador do lead, `tipo` igual a `'mensagem'` e `conteudo` igual ao texto da mensagem.
2. WHEN o Servidor_Bot enviar uma resposta ao lead, THE Servidor_Bot SHALL inserir um registro na Tabela_Mensagens com `de` igual a `'bot'`, `tipo` igual a `'mensagem'` e `conteudo` igual ao texto da resposta.
3. WHEN uma mensagem for inserida na Tabela_Mensagens pelo Servidor_Bot, THE Servidor_Bot SHALL emitir evento Socket.io `nova_mensagem_salva` com os dados da mensagem para todos os clientes conectados.

### Requisito 5: Socket.io Client e Provider (Passo 4)

**User Story:** Como desenvolvedor, eu quero um cliente Socket.io singleton e um context provider React, para que todos os componentes do dashboard acessem a conexão WebSocket de forma consistente.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL criar módulo `web/utils/socket.ts` que exporta uma função para obter uma instância singleton do cliente Socket.io conectando a `NEXT_PUBLIC_SOCKET_URL`.
2. THE Plataforma_Web SHALL criar componente `web/components/providers/SocketProvider.tsx` que disponibiliza a instância Socket.io via React Context para componentes filhos.
3. THE Plataforma_Web SHALL adicionar o Socket_Provider ao Dashboard_Layout (`web/app/(dashboard)/layout.tsx`) envolvendo o conteúdo do dashboard.
4. THE Plataforma_Web SHALL adicionar `NEXT_PUBLIC_SOCKET_URL` ao arquivo `web/.env.local.example`.
5. THE Plataforma_Web SHALL garantir que o Socket_Client reconecte automaticamente em caso de desconexão.

### Requisito 6: Layout de 3 Colunas do Cockpit (Passo 5)

**User Story:** Como operador, eu quero uma interface de 3 colunas estilo WhatsApp Web, para visualizar a fila de leads, o chat ativo e os dados do lead simultaneamente.

#### Critérios de Aceitação

1. THE Cockpit SHALL renderizar layout de 3 colunas: ConversasSidebar (280px fixa à esquerda), ChatCentral (flex-1 no centro) e PainelLead (280px fixa à direita).
2. THE Cockpit SHALL ocupar 100% da altura disponível dentro do Dashboard_Layout (excluindo Header).
3. THE Cockpit SHALL separar as colunas com bordas verticais utilizando a cor `border` do Tema_Light.
4. WHEN nenhum lead estiver selecionado, THE ChatCentral SHALL exibir mensagem indicando que o operador deve selecionar um lead na fila.

### Requisito 7: ConversasSidebar (Passo 6)

**User Story:** Como operador, eu quero visualizar a fila de leads ordenada por score com atualizações em tempo real, para priorizar atendimentos de maior potencial.

#### Critérios de Aceitação

1. THE ConversasSidebar SHALL exibir lista de leads carregados da tabela `leads` via Supabase, ordenados por score decrescente.
2. THE ConversasSidebar SHALL exibir para cada lead: nome (ou telefone se nome indisponível), score com indicador visual de cor (hot `#F97316` para score >= 7, warm `#F59E0B` para score >= 4, cold `#6B7280` para score < 4), área classificada e preview da última mensagem.
3. WHEN o Socket_Client receber evento `lead_assumido`, THE ConversasSidebar SHALL atualizar visualmente o lead correspondente indicando qual operador o assumiu.
4. WHEN o Socket_Client receber evento `nova_mensagem_salva`, THE ConversasSidebar SHALL atualizar o preview da última mensagem do lead correspondente e reordenar a lista se necessário.
5. WHEN o operador clicar em um lead na ConversasSidebar, THE Cockpit SHALL selecionar o lead e carregar seus dados no ChatCentral e PainelLead.
6. THE ConversasSidebar SHALL destacar visualmente o lead atualmente selecionado com background `surface-hover`.

### Requisito 8: ChatCentral (Passo 7)

**User Story:** Como operador, eu quero visualizar o histórico de mensagens e interagir com o lead selecionado, para conduzir o atendimento de forma eficiente.

#### Critérios de Aceitação

1. WHEN um lead for selecionado, THE ChatCentral SHALL carregar o histórico de mensagens da Tabela_Mensagens filtrado por `lead_id`, ordenado por `created_at` ascendente.
2. THE ChatCentral SHALL renderizar mensagens recebidas (de = lead) com background `chat-received` (#F7F7F5) alinhadas à esquerda e mensagens enviadas (de = 'bot' ou de = operador) com background `chat-sent` (#EBF3FE) alinhadas à direita.
3. THE ChatCentral SHALL renderizar mensagens com `tipo='nota_interna'` com background `note-internal` (#FFFBEB), ícone diferenciado e label "Nota interna".
4. THE ChatCentral SHALL exibir campo de input na parte inferior para digitação de mensagens.
5. WHEN o operador submeter uma mensagem no campo de input, THE ChatCentral SHALL emitir evento Socket.io `nova_mensagem` com `{ lead_id, de: operador_id, conteudo, tipo: 'mensagem', origem: 'humano' }`.
6. THE ChatCentral SHALL exibir botões de ação: ASSUMIR, DELEGAR, AGUARDANDO e ENCERRAR.
7. WHEN o operador clicar em ASSUMIR, THE ChatCentral SHALL emitir evento Socket.io `assumir_lead` com `{ lead_id, operador_id }`.
8. WHEN o operador clicar em DELEGAR, THE ChatCentral SHALL exibir seletor de operador e emitir evento Socket.io `delegar_lead` com `{ lead_id, operador_id_origem, operador_id_destino }`.
9. WHEN o Socket_Client receber evento `nova_mensagem_salva` para o lead selecionado, THE ChatCentral SHALL adicionar a mensagem ao histórico em tempo real e fazer scroll automático para a mensagem mais recente.
10. THE ChatCentral SHALL fazer scroll automático para a mensagem mais recente ao carregar o histórico.

### Requisito 9: QuickReplies (Passo 8)

**User Story:** Como operador, eu quero acessar respostas rápidas digitando `/` no campo de input, para agilizar o atendimento com mensagens padronizadas.

#### Critérios de Aceitação

1. WHEN o operador digitar `/` no campo de input do ChatCentral, THE QuickReplies SHALL exibir dropdown com lista de atalhos carregados da tabela `quick_replies`.
2. WHEN o operador continuar digitando após `/`, THE QuickReplies SHALL filtrar a lista de atalhos pelo texto digitado.
3. WHEN o operador selecionar um atalho no dropdown, THE QuickReplies SHALL substituir o texto do campo de input pelo conteúdo do atalho selecionado e fechar o dropdown.
4. THE Plataforma_Web SHALL incluir na migração SQL 5 registros seed na tabela `quick_replies` com atalhos úteis para atendimento jurídico.
5. THE QuickReplies SHALL carregar apenas atalhos com `compartilhado = true` ou `criado_por` igual ao operador autenticado.

### Requisito 10: PainelLead (Passo 9)

**User Story:** Como operador, eu quero visualizar os dados completos do lead selecionado com classificação e ações disponíveis, para tomar decisões informadas durante o atendimento.

#### Critérios de Aceitação

1. WHEN um lead for selecionado, THE PainelLead SHALL exibir círculo de score com cor correspondente (hot, warm, cold) e valor numérico centralizado.
2. THE PainelLead SHALL exibir pills de classificação mostrando `area_bot` (não editável) e `area_humano` (editável via dropdown).
3. WHEN o operador alterar `area_humano` para valor diferente de `area_bot`, THE PainelLead SHALL inserir registro na tabela `bot_feedback` com `area_bot`, `area_humano` e `operador_id`.
4. THE PainelLead SHALL garantir que o valor de `area_bot` do lead selecionado não seja sobrescrito em nenhuma operação de atualização.
5. THE PainelLead SHALL exibir dados coletados pelo bot: nome, telefone, área, fluxo, estado atual e score.
6. THE PainelLead SHALL exibir campo de valor estimado visível para Operador e Owner.
7. THE PainelLead SHALL exibir botões de ação: VIROU CLIENTE, NÃO FECHOU e ENCERRAR E ENFILEIRAR.
8. WHEN o operador clicar em VIROU CLIENTE, THE PainelLead SHALL atualizar o status do atendimento para `'convertido'` e registrar `classificacao_final`.
9. WHEN o operador clicar em NÃO FECHOU, THE PainelLead SHALL atualizar o status do atendimento para `'nao_fechou'` e registrar `classificacao_final`.
10. WHEN o operador clicar em ENCERRAR E ENFILEIRAR, THE PainelLead SHALL abrir o PopupEnfileirar.

### Requisito 11: PopupEnfileirar (Passo 10)

**User Story:** Como operador, eu quero encerrar um atendimento e enfileirar o lead para tratamento futuro com próxima ação e valor estimado, para manter o pipeline de conversão organizado.

#### Critérios de Aceitação

1. WHEN o PopupEnfileirar for aberto, THE PopupEnfileirar SHALL exibir modal com campos: próxima ação (TEXT), data da ação (DATE), valor estimado (NUMERIC) e observação (TEXT).
2. WHEN o operador submeter o formulário do PopupEnfileirar, THE PopupEnfileirar SHALL inserir registro na tabela `pot_tratamento` com `lead_id`, `operador_id`, `proxima_acao`, `data_acao`, `valor_estimado` e `observacao`.
3. WHEN o registro for inserido com sucesso na tabela `pot_tratamento`, THE PopupEnfileirar SHALL atualizar o status do atendimento para `'enfileirado'` e encerrar o atendimento com `encerrado_em` preenchido.
4. WHEN o registro for inserido com sucesso, THE PopupEnfileirar SHALL fechar o modal e remover o lead da fila ativa na ConversasSidebar.
5. IF o operador clicar fora do modal ou no botão cancelar, THEN THE PopupEnfileirar SHALL fechar o modal sem realizar nenhuma operação.

### Requisito 12: Nota Interna (Passo 11)

**User Story:** Como operador, eu quero registrar notas internas sobre um atendimento que não sejam enviadas ao lead, para documentar observações e compartilhar informações com a equipe.

#### Critérios de Aceitação

1. THE ChatCentral SHALL exibir toggle para alternar entre modo "Mensagem" e modo "Nota interna" no campo de input.
2. WHILE o campo de input estiver em modo "Nota interna", THE ChatCentral SHALL exibir indicador visual (background amarelo `note-internal`) no campo de input.
3. WHEN o operador submeter texto em modo "Nota interna", THE ChatCentral SHALL emitir evento Socket.io `nova_mensagem` com `tipo='nota_interna'`.
4. THE Plataforma_Web SHALL garantir que mensagens com `tipo='nota_interna'` não sejam enviadas via WhatsApp em nenhuma circunstância.
5. THE ChatCentral SHALL renderizar notas internas com estilo diferenciado (background `#FFFBEB`, ícone de nota) claramente distinguível de mensagens normais.

### Requisito 13: Chamar no WhatsApp (Passo 12)

**User Story:** Como operador, eu quero iniciar uma conversa com o lead via WhatsApp diretamente do cockpit, para entrar em contato proativamente quando necessário.

#### Critérios de Aceitação

1. THE ChatCentral SHALL exibir botão "Chamar no WA" quando um lead estiver selecionado e possuir telefone registrado.
2. WHEN o operador clicar em "Chamar no WA", THE Plataforma_Web SHALL enviar POST para route handler `/api/whatsapp/enviar` com `{ lead_id, telefone, mensagem }`.
3. THE Plataforma_Web SHALL criar route handler `web/app/api/whatsapp/enviar/route.ts` que faz POST para `WEBHOOK_N8N_URL` (variável de ambiente server-only) com os dados da mensagem.
4. THE Plataforma_Web SHALL garantir que `WEBHOOK_N8N_URL` seja utilizada exclusivamente em server components e route handlers, sem exposição ao client-side.
5. WHEN o POST para `WEBHOOK_N8N_URL` for bem-sucedido, THE route handler SHALL inserir a mensagem enviada na Tabela_Mensagens com `de` igual ao `operador_id` e `tipo` igual a `'mensagem'`.
6. IF o POST para `WEBHOOK_N8N_URL` falhar, THEN THE route handler SHALL retornar erro com status HTTP apropriado e mensagem descritiva.

### Requisito 14: Segurança e Regras de Negócio

**User Story:** Como owner do escritório, eu quero que as regras de segurança e integridade de dados sejam respeitadas em todas as operações do cockpit, para garantir confiabilidade do sistema.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL garantir assunção atômica de leads via constraint `UNIQUE(lead_id)` na tabela `atendimentos` combinado com broadcast WebSocket `lead_assumido`.
2. THE Plataforma_Web SHALL garantir que o valor de `area_bot` de um lead não seja sobrescrito por nenhuma operação — apenas `area_humano` pode ser alterado por operadores.
3. WHEN `area_humano` for diferente de `area_bot` após alteração pelo operador, THE Plataforma_Web SHALL inserir registro na tabela `bot_feedback` com ambos os valores e o `operador_id`.
4. THE Plataforma_Web SHALL garantir que mensagens com `tipo='nota_interna'` não sejam enviadas via WhatsApp.
5. THE Plataforma_Web SHALL garantir que `SUPABASE_SERVICE_ROLE_KEY` seja utilizada exclusivamente em server components e route handlers.
6. THE Plataforma_Web SHALL garantir que `WEBHOOK_N8N_URL` seja utilizada exclusivamente em server components e route handlers, sem prefixo `NEXT_PUBLIC_`.
7. THE Plataforma_Web SHALL garantir que o valor estimado do lead seja visível para Operador e Owner.
8. THE Plataforma_Web SHALL persistir todas as mensagens na Tabela_Mensagens a partir desta implantação (mensagens anteriores não são recuperadas).

### Requisito 15: Variáveis de Ambiente — Cockpit

**User Story:** Como desenvolvedor, eu quero que todas as novas variáveis de ambiente estejam documentadas, para garantir configuração correta em todos os ambientes.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL adicionar `NEXT_PUBLIC_SOCKET_URL` ao arquivo `web/.env.local.example` com descrição.
2. THE Plataforma_Web SHALL adicionar `WEBHOOK_N8N_URL` ao arquivo `web/.env.local.example` como variável server-only (sem prefixo `NEXT_PUBLIC_`).
3. THE Servidor_Bot SHALL adicionar `WEB_URL` ao arquivo `.env.example` com descrição indicando a URL da plataforma web para CORS do Socket.io.
4. THE Plataforma_Web SHALL adicionar `socket.io-client` como dependência do projeto `web/`.
5. THE Servidor_Bot SHALL adicionar `socket.io` como dependência do projeto raiz (`package.json`).
