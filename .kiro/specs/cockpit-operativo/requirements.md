# Documento de Requisitos — Cockpit Operativo v1.0

## Introdução

Este documento define os requisitos para a evolução do Cockpit de Atendimento (Tela 1) da plataforma BRO Resolve. O foco é o painel lateral direito (PainelLead), o motor de envio com respostas inteligentes por status, a humanização do atendimento via status "digitando" e a unificação visual do histórico multi-canal.

Funcionalidades **já implementadas** e fora de escopo deste documento:
- Badge "🤖 Automação Ativa" / "👤 Atendimento Humano" no header do ChatCentral
- Carregamento unificado de histórico por `identity_id` no ChatCentral
- Flag `is_assumido` e lógica de silenciamento no `server.js`
- Barra de input estilo WhatsApp com botões enviar/áudio/anexo

Stack: Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, Socket.io, deploy Vercel (web) + Railway (bot).

## Glossário

- **Plataforma_Web**: Aplicação Next.js 14 em `web/` que serve como painel operacional do BRO Resolve.
- **Servidor_Bot**: Servidor Express em `server.js` (CommonJS) que processa webhooks do Telegram/WhatsApp e gerencia conexões Socket.io.
- **PainelLead**: Coluna direita (280px) do Cockpit em `web/app/(dashboard)/tela1/components/PainelLead.tsx` que exibe dados e ações do lead selecionado.
- **ChatCentral**: Coluna central do Cockpit em `web/app/(dashboard)/tela1/components/ChatCentral.tsx` que exibe histórico de mensagens e campo de input.
- **ConversasSidebar**: Coluna esquerda (280px) do Cockpit que exibe a fila de leads.
- **Tabela_Identities**: Tabela `identities` no Supabase que armazena identidades unificadas com campos `id`, `telefone` e `nome`.
- **Tabela_Identity_Channels**: Tabela `identity_channels` no Supabase que vincula canais (Telegram/WhatsApp) a uma identidade unificada.
- **Tabela_Leads**: Tabela `leads` no Supabase que armazena leads com campos incluindo `identity_id`, `nome`, `status`, `is_assumido`, `area`, `score`.
- **Tabela_Mensagens**: Tabela `mensagens` no Supabase que armazena todas as mensagens trocadas entre leads e operadores.
- **Card_Bot_Tree**: Bloco superior do PainelLead que exibe dados imutáveis coletados pelo bot (área sugerida, score, respostas do menu).
- **Bloco_Qualificacao**: Bloco inferior do PainelLead que exibe inputs editáveis pelo operador, campo de notas internas (Post-it) e botões de desfecho.
- **Smart_Snippets**: Botões de resposta rápida contextuais que mudam conforme o status do lead (LEAD vs CLIENTE), injetando texto pré-formatado no campo de input do ChatCentral.
- **Persona_Bot**: Mapeamento de nomes fictícios por área jurídica usado pelo Servidor_Bot para simular status "digitando" no Telegram antes de mensagens automáticas.
- **Persona_Operador**: Nome do operador humano transmitido via Socket.io para exibir status "digitando" no Telegram quando o operador está compondo uma mensagem.
- **Operador**: Usuário autenticado que atende leads no cockpit.
- **Tema_Light**: Design tokens do tema claro: bg `#FFFFFF`, surface `#F7F7F5`, accent `#1A73E8`, border `#E8E7E1`.

## Requisitos

### Requisito 1: Nome Editável na Identidade

**User Story:** Como operador, eu quero editar o nome do lead diretamente no painel lateral, para substituir o apelido coletado pelo bot pelo nome completo real do contato.

#### Critérios de Aceitação

1. WHEN o operador clicar no campo de nome no PainelLead, THE PainelLead SHALL transformar o campo de nome em um input editável pré-preenchido com o valor atual de `nome` da Tabela_Identities.
2. WHEN o operador confirmar a edição do nome (via tecla Enter ou blur do campo), THE PainelLead SHALL atualizar o campo `nome` na Tabela_Identities para o `identity_id` correspondente ao lead selecionado.
3. WHEN o nome for atualizado na Tabela_Identities, THE PainelLead SHALL atualizar simultaneamente o campo `nome` na Tabela_Leads para manter consistência local.
4. WHEN o nome for atualizado com sucesso, THE ConversasSidebar SHALL refletir o novo nome na lista de leads sem necessidade de recarregar a página.
5. WHEN o nome for atualizado com sucesso, THE ChatCentral SHALL exibir o novo nome no header da conversa.
6. THE Plataforma_Web SHALL utilizar o campo `nome` da Tabela_Identities como fonte única de verdade para exibição de nome em todos os componentes (ConversasSidebar, ChatCentral, PainelLead).
7. IF o operador deixar o campo de nome vazio e confirmar, THEN THE PainelLead SHALL manter o valor anterior sem realizar atualização.

### Requisito 2: Edição de Telefone e Vinculação de Canais

**User Story:** Como operador, eu quero editar o telefone do lead e vincular canais adicionais a uma identidade existente, para unificar o histórico de múltiplos números em uma única timeline.

#### Critérios de Aceitação

1. WHEN o operador clicar no campo de telefone no PainelLead, THE PainelLead SHALL transformar o campo em um input editável pré-preenchido com o valor atual de `telefone` da Tabela_Identities.
2. WHEN o operador confirmar a edição do telefone, THE PainelLead SHALL atualizar o campo `telefone` na Tabela_Identities para o `identity_id` correspondente.
3. THE PainelLead SHALL exibir um botão "Vincular a Identidade Existente" abaixo do campo de telefone.
4. WHEN o operador clicar em "Vincular a Identidade Existente", THE PainelLead SHALL exibir um campo de busca que permita pesquisar identidades por nome ou telefone na Tabela_Identities.
5. WHEN o operador selecionar uma identidade existente no resultado da busca, THE Plataforma_Web SHALL transferir o registro da Tabela_Identity_Channels do canal atual (Telegram ou WhatsApp) para o `identity_id` da identidade selecionada.
6. WHEN a vinculação for concluída com sucesso, THE Plataforma_Web SHALL atualizar o campo `identity_id` do lead atual na Tabela_Leads para apontar para a identidade selecionada.
7. WHEN a vinculação for concluída com sucesso, THE ChatCentral SHALL recarregar o histórico de mensagens unificado da nova identidade, exibindo mensagens de todos os canais vinculados.
8. IF a busca por identidade não retornar resultados, THEN THE PainelLead SHALL exibir mensagem informativa "Nenhuma identidade encontrada".

### Requisito 3: Layout do PainelLead em Dois Blocos

**User Story:** Como operador, eu quero que o painel lateral direito seja dividido em dois blocos visuais distintos, para separar claramente os dados imutáveis do bot dos campos editáveis pelo operador.

#### Critérios de Aceitação

1. THE PainelLead SHALL dividir seu conteúdo em dois blocos visuais separados por uma borda horizontal utilizando a cor `border` do Tema_Light (`#E8E7E1`).
2. THE Card_Bot_Tree SHALL ocupar o bloco superior do PainelLead e exibir os seguintes dados imutáveis coletados pelo bot: área sugerida (`area_bot`), score numérico, prioridade e respostas do menu armazenadas em `metadata`.
3. THE Card_Bot_Tree SHALL renderizar todos os campos como somente leitura, sem possibilidade de edição pelo operador.
4. THE Bloco_Qualificacao SHALL ocupar o bloco inferior do PainelLead e conter: campo de nome editável (Requisito 1), campo de telefone editável (Requisito 2), dropdown de área do operador (`area_humano`), campo de Notas Internas (Post-it) e botões de desfecho (CONVERTER, NÃO FECHOU).
5. THE Bloco_Qualificacao SHALL exibir um campo de texto "Notas Internas" com estilo visual de Post-it (background `#FFFBEB`, borda `warning/30`) que persiste o conteúdo como mensagem com `tipo='nota_interna'` na Tabela_Mensagens.
6. WHEN o operador digitar no campo de Notas Internas e confirmar (via botão ou Enter), THE Bloco_Qualificacao SHALL inserir o texto na Tabela_Mensagens com `tipo='nota_interna'` e `lead_id` do lead selecionado.
7. THE Bloco_Qualificacao SHALL exibir as notas internas existentes do lead como lista compacta abaixo do campo de input, ordenadas por `created_at` descendente.

### Requisito 4: Smart Snippets por Status do Lead

**User Story:** Como operador, eu quero que botões de resposta rápida mudem automaticamente conforme o status do lead, para enviar mensagens contextualizadas com um clique.

#### Critérios de Aceitação

1. WHILE o lead selecionado possuir status igual a "LEAD" ou "TRIAGEM" ou "NOVO", THE ChatCentral SHALL exibir Smart_Snippets com o texto: "Olá {{nome}}, recebi seu caso de {{area}}. Podemos falar agora?" onde `{{nome}}` é substituído pelo nome do lead e `{{area}}` pela área classificada.
2. WHILE o lead selecionado possuir status igual a "CLIENTE" ou atendimento com status "convertido", THE ChatCentral SHALL exibir Smart_Snippets com o texto: "Oi {{nome}}, estou acessando seu prontuário de {{area}} para te dar um retorno." onde `{{nome}}` e `{{area}}` são substituídos pelos valores do lead.
3. WHEN o operador clicar em um Smart_Snippet, THE ChatCentral SHALL injetar o texto interpolado no campo de input do chat sem enviar automaticamente.
4. WHEN o operador clicar em um Smart_Snippet, THE Plataforma_Web SHALL atualizar o campo `is_assumido` do lead para `true` na Tabela_Leads, caso ainda não esteja marcado.
5. WHEN o campo `is_assumido` for atualizado para `true` via Smart_Snippet, THE Servidor_Bot SHALL cessar o processamento automático de mensagens pela state machine para o lead correspondente.
6. THE Smart_Snippets SHALL ser renderizados como botões horizontais acima do campo de input do ChatCentral, com estilo visual distinto dos QuickReplies existentes (acionados por `/`).

### Requisito 5: Botão "Chamar no WA" com Mensagem Pré-preenchida

**User Story:** Como operador, eu quero que o botão "Chamar no WA" gere um link direto para o WhatsApp com a mensagem de status pré-preenchida, para iniciar contato externo rapidamente.

#### Critérios de Aceitação

1. WHEN o lead selecionado possuir telefone registrado, THE PainelLead SHALL exibir o botão "Chamar no WA".
2. WHEN o operador clicar em "Chamar no WA", THE PainelLead SHALL abrir uma nova aba do navegador com a URL `https://wa.me/{telefone_limpo}?text={mensagem_codificada}` onde `{telefone_limpo}` é o telefone sem caracteres especiais (apenas dígitos com código do país) e `{mensagem_codificada}` é a mensagem do Smart_Snippet correspondente ao status atual do lead, codificada com `encodeURIComponent`.
3. WHILE o lead possuir status "LEAD", THE PainelLead SHALL pré-preencher a mensagem do link WA com: "Olá {{nome}}, recebi seu caso de {{area}}. Podemos falar agora?"
4. WHILE o lead possuir status "CLIENTE", THE PainelLead SHALL pré-preencher a mensagem do link WA com: "Oi {{nome}}, estou acessando seu prontuário de {{area}} para te dar um retorno."
5. IF o lead não possuir telefone registrado, THEN THE PainelLead SHALL desabilitar o botão "Chamar no WA" com tooltip informando "Telefone não disponível".

### Requisito 6: Persona do Bot com Status "Digitando"

**User Story:** Como gestor do escritório, eu quero que o bot simule um comportamento humano com nome de persona por área antes de enviar mensagens automáticas, para transmitir confiança ao lead no Telegram.

#### Critérios de Aceitação

1. THE Servidor_Bot SHALL manter um mapeamento de nomes de persona por área jurídica (exemplo: Trabalhista = "Dr. Rafael", Família = "Dra. Mariana", Previdenciário = "Dr. Carlos") configurável no código de `server.js`.
2. WHEN o Servidor_Bot enviar uma mensagem automática via Telegram, THE Servidor_Bot SHALL disparar a ação `sendChatAction` com `action=typing` para o `chat_id` correspondente antes de enviar a mensagem.
3. WHEN o Servidor_Bot disparar o status "digitando", THE Servidor_Bot SHALL aguardar 1500 milissegundos antes de enviar a mensagem de texto.
4. WHILE o campo `is_assumido` do lead for igual a `true`, THE Servidor_Bot SHALL ignorar a lógica de persona do bot e não disparar status "digitando" automático para o lead correspondente.

### Requisito 7: Persona do Operador com Status "Digitando"

**User Story:** Como operador, eu quero que o lead veja no Telegram que estou digitando uma resposta, para humanizar o atendimento e reduzir a ansiedade de espera.

#### Critérios de Aceitação

1. WHEN o operador começar a digitar no campo de input do ChatCentral, THE ChatCentral SHALL emitir evento Socket.io `operador_digitando` com `{ lead_id, operador_nome }` após debounce de 500 milissegundos.
2. WHEN o Servidor_Bot receber o evento `operador_digitando`, THE Servidor_Bot SHALL disparar a ação `sendChatAction` com `action=typing` para o `chat_id` do lead no Telegram.
3. THE Servidor_Bot SHALL limitar o disparo de `sendChatAction` a no máximo uma vez a cada 4 segundos por `chat_id` para evitar rate limiting da API do Telegram.
4. WHILE o campo `is_assumido` do lead for igual a `true`, THE Servidor_Bot SHALL processar eventos `operador_digitando` normalmente, transmitindo o status de digitação ao Telegram.
5. WHILE o campo `is_assumido` do lead for igual a `false`, THE Servidor_Bot SHALL ignorar eventos `operador_digitando` para o lead correspondente, pois o bot está no controle.

### Requisito 8: Badges de Canal no Histórico Unificado

**User Story:** Como operador, eu quero ver badges discretos indicando o canal de origem de cada mensagem no chat, para distinguir mensagens vindas do Telegram e do WhatsApp na timeline unificada.

#### Critérios de Aceitação

1. THE ChatCentral SHALL exibir um badge discreto ao lado do timestamp de cada mensagem recebida (de = lead) indicando o canal de origem: "via Telegram" ou "via WhatsApp".
2. THE Plataforma_Web SHALL determinar o canal de origem da mensagem comparando o campo `de` da mensagem com os registros da Tabela_Identity_Channels vinculados ao `identity_id` do lead.
3. THE ChatCentral SHALL renderizar o badge "via Telegram" com estilo `bg-accent/10 text-accent` e o badge "via WhatsApp" com estilo `bg-success/10 text-success`.
4. THE ChatCentral SHALL renderizar os badges com tamanho de fonte `text-[10px]` e padding compacto para não interferir na leitura das mensagens.
5. THE ChatCentral SHALL omitir o badge de canal em mensagens enviadas pelo operador ou pelo bot, exibindo apenas em mensagens recebidas do lead.

### Requisito 9: Migração SQL para Campos de Suporte

**User Story:** Como desenvolvedor, eu quero que os campos necessários para as novas funcionalidades estejam disponíveis no banco de dados, para suportar notas internas fixas, persona do bot e vinculação de canais.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL criar migração SQL (`sql/migrations/011_cockpit_operativo.sql`) que adiciona a coluna `canal_origem` (TEXT, nullable) à Tabela_Mensagens para rastrear o canal de origem de cada mensagem.
2. THE Plataforma_Web SHALL adicionar na migração a coluna `persona_nome` (TEXT, nullable) à Tabela_Mensagens para registrar o nome da persona que enviou a mensagem automática.
3. THE Plataforma_Web SHALL adicionar na migração um índice em `identity_channels(identity_id)` caso não exista, para otimizar buscas de canais por identidade.
4. THE Plataforma_Web SHALL garantir que a migração seja idempotente, utilizando `IF NOT EXISTS` em todas as operações DDL.
