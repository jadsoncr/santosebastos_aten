# Implementation Plan: Cockpit Operativo v1.0

## Overview

Implementação do Cockpit Operativo em 5 fases sequenciais: (1) Migração SQL para preparar o banco, (2) Motor de Captura Agressiva para extração de dados do Telegram e stateMachine, (3) Lógica server-side de typing status e personas, (4) Refatoração do PainelLead em dois blocos com campos editáveis, (5) Ajustes no ChatCentral com Smart Snippets e badges de canal.

Stack: Node.js (CommonJS) para `server.js`, Next.js 14 App Router + TypeScript para `web/`, Supabase, Socket.io, Jest para testes.

## Tasks

- [x] 1. Migração SQL — Preparar banco de dados
  - [x] 1.1 Criar arquivo `sql/migrations/011_cockpit_operativo.sql`
    - Adicionar coluna `canal_origem TEXT` (nullable) à tabela `mensagens` com `ADD COLUMN IF NOT EXISTS`
    - Adicionar coluna `persona_nome TEXT` (nullable) à tabela `mensagens` com `ADD COLUMN IF NOT EXISTS`
    - Criar índice `idx_identity_channels_identity_id` em `identity_channels(identity_id)` com `IF NOT EXISTS`
    - Adicionar coluna `nome TEXT` à tabela `identities` com `ADD COLUMN IF NOT EXISTS` (caso não exista — verificar schema)
    - Toda operação DDL deve ser idempotente
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ]* 1.2 Write property test for migration idempotency
    - **Property 10: Idempotência da migração SQL**
    - **Validates: Requirements 9.4**

- [x] 2. Motor de Captura Agressiva — Extração de dados do Telegram
  - [x] 2.1 Implementar extração de campos Telegram no webhook (`server.js`)
    - No handler `POST /webhook`, quando `isTelegram === true`, extrair `tgMsg.from.first_name`, `tgMsg.from.last_name` e `tgMsg.from.phone_number` (se disponível) do objeto `tgMsg`
    - Construir `nome_telegram` concatenando `first_name` + `last_name` (se existir)
    - Fazer upsert imediato na tabela `identities`: atualizar `nome` com `nome_telegram` apenas se `identities.nome` for `null` (não sobrescrever nome editado pelo operador)
    - Vincular ao lead existente: se o lead já existe para este `identity_id`, atualizar `leads.nome` com `nome_telegram` apenas se `leads.nome` for `null`
    - Se `tgMsg.from.phone_number` existir (raro no Telegram), chamar `updateIdentityPhone(identity_id, phone_number)` para merge cross-canal
    - _Requirements: 1.6 (identities como fonte de verdade), 9.1_
  - [x] 2.2 Implementar captura de contexto na stateMachine (`src/stateMachine.js`)
    - No estado `coleta_nome` (quando o lead responde com seu nome), após salvar `nome` na sessão, propagar para `identities.nome` via `identityResolver` ou Supabase direto
    - No estado `contato_numero` (quando o lead informa telefone), após salvar `telefoneContato` na sessão, chamar `updateIdentityPhone(identity_id, telefone)` para upsert na tabela `identities`
    - No estado `contato_confirmacao` opção 1 (confirma número atual), propagar `sessao` (channel_user_id) como telefone para `identities` se for WhatsApp
    - Garantir que a propagação não falha silenciosamente — log de erro se upsert falhar, mas não bloquear o fluxo do bot
    - _Requirements: 1.2, 1.3, 2.2_
  - [ ]* 2.3 Write unit tests for Telegram field extraction
    - Testar extração de `first_name` + `last_name` com e sem `last_name`
    - Testar que `phone_number` ausente não causa erro
    - Testar que nome existente na `identities` não é sobrescrito
    - _Requirements: 1.6_
  - [ ]* 2.4 Write unit tests for stateMachine context capture
    - Testar que nome coletado em `coleta_nome` é propagado para `identities`
    - Testar que telefone coletado em `contato_numero` é propagado via `updateIdentityPhone`
    - _Requirements: 1.2, 2.2_

- [x] 3. Checkpoint — Verificar migração e captura agressiva
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Server-side — Persona do bot e typing status (`server.js`)
  - [x] 4.1 Implementar persona do bot com typing delay
    - Adicionar constante `BOT_PERSONAS` no topo de `server.js` com mapeamento área → nome (Trabalhista → "Dr. Rafael", Família → "Dra. Mariana", Previdenciário → "Dr. Carlos", Consumidor → "Dra. Beatriz", Cível → "Dr. André", Criminal → "Dra. Patrícia") e `DEFAULT_PERSONA`
    - Criar função `sendTelegramWithTyping(chat_id, text, area)` que: (1) chama `sendChatAction` com `action=typing`, (2) aguarda 1500ms, (3) chama `sendTelegram`, (4) retorna o nome da persona
    - No webhook, substituir `sendTelegram(tgMsg.chat.id, resposta.message)` por `sendTelegramWithTyping(...)` quando `is_assumido === false`
    - Persistir `persona_nome` na tabela `mensagens` ao inserir a resposta do bot
    - Persistir `canal_origem` ('telegram' ou 'whatsapp') na tabela `mensagens` ao inserir qualquer mensagem
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.1, 9.2_
  - [x] 4.2 Implementar relay de typing do operador via Socket.io
    - Adicionar `typingThrottle` Map no escopo do Socket.io em `server.js`
    - Criar handler `socket.on('operador_digitando', ...)` que: (1) busca lead por `lead_id`, (2) verifica `is_assumido === true` e `canal_origem === 'telegram'`, (3) aplica throttle de 4s por `chat_id`, (4) chama `sendChatAction` com `action=typing`
    - Ignorar eventos quando `is_assumido === false` (bot no controle)
    - _Requirements: 7.2, 7.3, 7.4, 7.5_
  - [ ]* 4.3 Write property test for typing throttle
    - **Property 8: Throttle de typing do operador**
    - **Validates: Requirements 7.3**
  - [ ]* 4.4 Write unit tests for bot persona and typing
    - Testar que `sendTelegramWithTyping` chama `sendChatAction` antes de `sendMessage`
    - Testar delay de 1500ms entre typing e mensagem
    - Testar que persona correta é retornada por área
    - Testar que typing é ignorado quando `is_assumido === true`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5. Checkpoint — Verificar lógica server-side
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. PainelLead — Refatoração em dois blocos com campos editáveis
  - [x] 6.1 Criar componente `CardBotTree.tsx`
    - Criar `web/app/(dashboard)/tela1/components/CardBotTree.tsx`
    - Renderizar dados imutáveis (somente leitura): badge LEAD/CLIENTE, ScoreCircle, área bot, prioridade, respostas do menu (metadata)
    - Props: `{ lead: Lead, isCliente: boolean }`
    - Todos os campos são readonly — sem inputs editáveis
    - _Requirements: 3.2, 3.3_
  - [x] 6.2 Criar componente `BlocoQualificacao.tsx`
    - Criar `web/app/(dashboard)/tela1/components/BlocoQualificacao.tsx`
    - Implementar campo de nome editável (click-to-edit): ao clicar, transforma em input pré-preenchido; ao confirmar (Enter/blur), atualiza `identities.nome` e `leads.nome`; se vazio, mantém valor anterior sem atualizar
    - Implementar campo de telefone editável (click-to-edit): mesma lógica, atualiza `identities.telefone`
    - Implementar dropdown de área do operador (`area_humano`) — migrar lógica existente do PainelLead
    - Implementar campo de Notas Internas (Post-it): background `#FFFBEB`, borda `warning/30`, persiste como `tipo='nota_interna'` na tabela `mensagens`
    - Exibir lista de notas internas existentes ordenadas por `created_at` descendente
    - Implementar botão "Chamar no WA" com link `wa.me` pré-preenchido por status (LEAD vs CLIENTE)
    - Desabilitar botão "Chamar no WA" com tooltip quando telefone não disponível
    - Manter botões de desfecho (CONVERTER, NÃO FECHOU, ENCERRAR E ENFILEIRAR)
    - Props: `{ lead: Lead, isCliente: boolean, isAssumido: boolean, operadorId: string | null, onLeadUpdate: (lead: Lead) => void, onLeadClosed: () => void }`
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 2.1, 2.2, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 6.3 Implementar busca e vinculação de identidades no `BlocoQualificacao`
    - Adicionar botão "Vincular a Identidade Existente" abaixo do campo de telefone
    - Ao clicar, exibir campo de busca que pesquisa `identities` por nome ou telefone (ILIKE)
    - Ao selecionar identidade destino: (1) transferir `identity_channels` do canal atual, (2) atualizar `leads.identity_id`, (3) recarregar ChatCentral com novo `identity_id`
    - Exibir "Nenhuma identidade encontrada" se busca sem resultados
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [x] 6.4 Refatorar `PainelLead.tsx` para usar CardBotTree + BlocoQualificacao
    - Substituir conteúdo atual do PainelLead por dois blocos separados por `<hr className="border-border" />`
    - Bloco superior: `<CardBotTree lead={lead} isCliente={isCliente} />`
    - Bloco inferior: `<BlocoQualificacao lead={lead} isCliente={isCliente} isAssumido={isAssumido} operadorId={operadorId} onLeadUpdate={onLeadUpdate} onLeadClosed={onLeadClosed} />`
    - Garantir que nome atualizado propaga para ConversasSidebar e ChatCentral header via `onLeadUpdate`
    - _Requirements: 3.1, 1.4, 1.5, 1.6_
  - [ ]* 6.5 Write property tests for PainelLead logic
    - **Property 1: Consistência dual-write de nome (identities + leads)**
    - **Validates: Requirements 1.2, 1.3**
  - [ ]* 6.6 Write property test for empty name rejection
    - **Property 2: Rejeição de nome vazio**
    - **Validates: Requirements 1.7**
  - [ ]* 6.7 Write property test for channel linking integrity
    - **Property 3: Integridade da vinculação de canais**
    - **Validates: Requirements 2.5, 2.6**
  - [ ]* 6.8 Write property test for internal note persistence
    - **Property 4: Persistência de nota interna com tipo correto**
    - **Validates: Requirements 3.6**
  - [ ]* 6.9 Write property test for notes ordering
    - **Property 5: Ordenação de notas internas**
    - **Validates: Requirements 3.7**
  - [ ]* 6.10 Write property test for wa.me URL construction
    - **Property 7: Construção de URL wa.me**
    - **Validates: Requirements 5.2, 5.3, 5.4**

- [x] 7. Checkpoint — Verificar PainelLead refatorado
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. ChatCentral — Smart Snippets e badges de canal
  - [x] 8.1 Criar componente `SmartSnippets.tsx`
    - Criar `web/app/(dashboard)/tela1/components/SmartSnippets.tsx`
    - Implementar função `getSnippets(lead, isCliente)` que retorna template por status: LEAD/TRIAGEM/NOVO → "Olá {{nome}}, recebi seu caso de {{area}}. Podemos falar agora?"; CLIENTE/convertido → "Oi {{nome}}, estou acessando seu prontuário de {{area}} para te dar um retorno."
    - Renderizar botões horizontais acima do input com estilo `bg-accent/5 border border-accent/20 text-accent text-xs rounded-full px-3 py-1`
    - Ao clicar: injetar texto interpolado no input (sem enviar), marcar `is_assumido = true` no lead se ainda não marcado
    - Props: `{ lead: Lead, onInject: (text: string) => void, onAssumir: () => void }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 8.2 Integrar SmartSnippets e typing do operador no ChatCentral
    - Importar e renderizar `<SmartSnippets>` acima do input no ChatCentral
    - Implementar debounce de 500ms no `handleInputChange` para emitir `socket.emit('operador_digitando', { lead_id, operador_nome })` quando o operador digita
    - Adicionar `typingTimeoutRef` para controlar o debounce
    - _Requirements: 4.3, 4.6, 7.1_
  - [x] 8.3 Implementar badges de canal no histórico unificado
    - Carregar mapa `channel_user_id → channel` via `identity_channels` ao montar o ChatCentral (quando lead muda)
    - Renderizar badge "via Telegram" (`bg-accent/10 text-accent`) ou "via WhatsApp" (`bg-success/10 text-success`) ao lado do timestamp em mensagens recebidas (de = lead)
    - Badge com `text-[10px]` e padding compacto
    - Omitir badge em mensagens do bot, sistema ou operador
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ]* 8.4 Write property test for Smart Snippet template selection
    - **Property 6: Seleção de template Smart Snippet por status**
    - **Validates: Requirements 4.1, 4.2**
  - [ ]* 8.5 Write property test for conditional channel badge
    - **Property 9: Badge de canal condicional**
    - **Validates: Requirements 8.1, 8.2, 8.5**
  - [ ]* 8.6 Write unit tests for ChatCentral integrations
    - Testar que Smart Snippet injeta texto no input sem enviar
    - Testar que debounce de 500ms emite `operador_digitando`
    - Testar que badge é omitido em mensagens do bot/sistema
    - _Requirements: 4.3, 7.1, 8.5_

- [x] 9. Final checkpoint — Verificar implementação completa
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que todos os requisitos (1-9) estão cobertos
  - Verificar que captura agressiva (Telegram + stateMachine) está funcional

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Server-side code uses Node.js CommonJS (`require`/`module.exports`)
- Web code uses TypeScript with Next.js 14 App Router
- Test framework: Jest (root `package.json`) — property tests use `fast-check` library
- The "Motor de Captura Agressiva" (tasks 2.x) is a new addition not in the original design — it captures Telegram user fields and stateMachine context data into the `identities` table proactively
