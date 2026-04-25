# Implementation Plan: BRO Resolve v1.1

## Overview

Transforma o cockpit operacional em ERP jurídico SaaS profissional. A implementação segue 5 fases sequenciais: (1) Migração SQL com segment_trees, pipeline e campos financeiros, (2) Copy mapping centralizado e substituição global de emojis/terminologia, (3) Pipeline engine no backend com validação e Momento WOW, (4) Frontend — sidebar por pipeline, ProgressBar, dropdowns cascata, backoffice, (5) Efeito visual Momento WOW.

Stack: Node.js (CommonJS) para server.js, Next.js 14 App Router + TypeScript para web/, Supabase, Socket.io, Jest.

## Tasks

- [x] 1. SQL Migration — `012_bro_resolve_v1_1.sql`
  - [x] 1.1 Create migration file `sql/migrations/012_bro_resolve_v1_1.sql` with segment_trees table
    - Create table `segment_trees` with columns: `id` (UUID PK), `parent_id` (UUID FK self-referencing), `nivel` (INTEGER CHECK 1,2,3), `nome` (TEXT), `persona` (TEXT nullable), `ativo` (BOOLEAN default true), `created_at` (TIMESTAMPTZ)
    - Add UNIQUE constraint on `(parent_id, nome)` and partial unique index for root nodes (`WHERE parent_id IS NULL`)
    - Add indexes on `parent_id` and `nivel`
    - Enable RLS: SELECT for `authenticated`, ALL for `service_role`, ALL for `owner` role
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.10, 16.2_

  - [x] 1.2 Add pipeline columns and financial fields to existing tables
    - Add `status_pipeline TEXT DEFAULT 'ENTRADA'` to `leads`
    - Add `segmento_id`, `assunto_id`, `especificacao_id` (UUID FK to segment_trees) to `leads`
    - Add `valor_entrada` (NUMERIC), `metodo_pagamento` (TEXT), `valor_honorarios_finais` (NUMERIC), `data_baixa` (TIMESTAMPTZ) to `atendimentos`
    - Add `agendamento_data` (TIMESTAMPTZ), `agendamento_local` (TEXT), `documento_enviado` (BOOLEAN), `documento_assinado` (BOOLEAN) to `atendimentos`
    - Add index `idx_leads_status_pipeline` on `leads(status_pipeline)`
    - Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotency
    - _Requirements: 5.1, 5.2, 6.1, 16.3, 16.4_

  - [x] 1.3 Create `configuracoes_sla` table for dynamic SLA rules
    - Create table `configuracoes_sla` with columns: `id` (UUID PK), `chave` (TEXT UNIQUE), `valor` (TEXT), `descricao` (TEXT), `updated_at` (TIMESTAMPTZ), `updated_by` (UUID FK auth.users)
    - Insert default SLA configs: `tempo_snooze_minutos` = 60, `tempo_abandono_triagem_horas` = 2, `tempo_abandono_atendimento_horas` = 24
    - Enable RLS: SELECT for `authenticated`, ALL for `service_role`, UPDATE for `owner` role
    - _Requirements: SLA dinâmico configurável pelo owner_

  - [x] 1.4 Create `timeline_events` table for action logging
    - Create table `timeline_events` with columns: `id` (UUID PK), `lead_id` (UUID FK leads), `tipo` (TEXT — reuniao_agendada, proposta_enviada, documento_solicitado, status_atualizado, etc.), `descricao` (TEXT), `operador_id` (UUID FK auth.users), `metadata` (JSONB), `created_at` (TIMESTAMPTZ)
    - Add index on `lead_id` and `created_at`
    - Enable RLS: SELECT for `authenticated`, INSERT for `authenticated`, ALL for `service_role`
    - _Requirements: Timeline de ações no chat_

  - [x] 1.5 Add GIN indexes for global search
    - Create GIN index on `identities(nome)` using `pg_trgm` for fuzzy search
    - Create GIN index on `identities(telefone)` using `pg_trgm` for fuzzy search
    - Create extension `pg_trgm` IF NOT EXISTS
    - _Requirements: Barra de localização global_

  - [x] 1.6 Add seed data for Santos & Bastos segments
    - Insert 6 Segmentos (nível 1) with personas: Trabalhista/Dr. Rafael, Família/Dra. Mariana, Consumidor/Dra. Beatriz, Cível/Dr. André, Empresarial/Dr. Carlos, Saúde/Dra. Patrícia
    - Insert 5 Assuntos (nível 2) for Trabalhista: Assédio Moral, Assédio Sexual, Rescisão, Horas Extras, Acidente de Trabalho
    - Insert 3 Especificações (nível 3) for Assédio Moral: Humilhação, Abuso de Poder, Isolamento
    - Use `INSERT ... ON CONFLICT DO NOTHING` for idempotency
    - _Requirements: 1.7, 1.8, 1.9, 2.3, 16.5_

- [ ] 2. Checkpoint — Verify migration
  - Ensure migration file is syntactically correct and idempotent. Ask the user if questions arise.

- [x] 3. Copy Mapping — Centralized terminology
  - [ ] 3.1 Create `web/utils/copy.ts` with full copy mapping constants
    - Define `COPY` object with all terminology mappings: sidebar labels, conversas section headers, badge texts, chat labels, qualificacao labels, score labels, pipeline stage labels, indicator replacements
    - Export as `const` for type safety and tree-shaking
    - Follow the complete mapping table from design (Section 5 and 6)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 3.2 Replace emojis and labels in `web/components/Sidebar.tsx`
    - Import `COPY` from `@/utils/copy`
    - Replace `links` array: remove `icon` emoji fields (📥, 👥, 💰), update labels to `Captação`, `Carteira`, `Gestão Financeira`
    - Remove `<span>{link.icon}</span>` from JSX
    - _Requirements: 9.1, 10.1_

  - [ ] 3.3 Replace emojis and labels in `web/app/(dashboard)/tela1/components/CardBotTree.tsx`
    - Import `COPY` from `@/utils/copy`
    - Replace `🎯 LEAD` → `PROSPECTO`, `👤 CLIENTE` → `CARTEIRA ATIVA`, `🔥 REAQUECIDO` → `REATIVADO`
    - _Requirements: 9.2, 10.3_

  - [ ] 3.4 Replace emojis and labels in `web/app/(dashboard)/tela1/components/ChatCentral.tsx`
    - Import `COPY` from `@/utils/copy`
    - Replace `👤 Atendimento Humano` → `Atendimento Humano`, `🤖 Automação Ativa` → `Automação Ativa`
    - Replace `📝 Nota interna` → `Nota interna`, `💬 Mensagem` → `Mensagem`
    - Replace empty state `Selecione uma conversa` using COPY constant
    - _Requirements: 9.3, 10.6_

  - [ ] 3.5 Replace emojis and labels in `web/app/(dashboard)/tela1/components/BlocoQualificacao.tsx`
    - Import `COPY` from `@/utils/copy`
    - Replace `Notas Internas` → `Dossiê Estratégico`
    - Replace `📝 Salvar nota` → `Salvar nota`, `✏️ Editar telefone` → `Editar telefone`, `🔗 Vincular a Identidade Existente` → `Vincular a Identidade Existente`
    - Replace `Chamar no WA` → `Contato via WhatsApp`
    - Replace Post-it yellow style (`bg-[#FFFBEB]`, `border-warning/30`) with neutral style (`bg-bg-surface`, `border-border`)
    - _Requirements: 9.4, 10.4, 11.2, 11.4_

  - [ ] 3.6 Replace emojis and labels in `web/app/(dashboard)/tela1/components/ConversasSidebar.tsx`
    - Import `COPY` from `@/utils/copy`
    - Replace section headers: `🔥 PRIORIDADE MÁXIMA` → `Captação`, `💬 EM CURSO` → `Em Atendimento`, `⏳ EM PAUSA` → `Aguardando Retorno`
    - Replace empty states: `Nenhum lead urgente` → `Nenhum prospecto na captação`, `Nenhum em curso` → `Nenhum em atendimento`, `Nenhum aguardando` → `Nenhum aguardando retorno`
    - Replace emoji indicators in `renderLeadItem`: `🔥` → Badge `R` with `bg-score-hot/10`, `👤` → Badge `C` with `bg-success/10`, `⚠️` → Badge `!` with `bg-warning/10`, `⏰` → Badge `SLA` with `bg-warning/10`
    - _Requirements: 9.5, 9.6, 10.2_

  - [ ] 3.7 Replace labels in `web/app/(dashboard)/tela1/components/ScoreCircle.tsx`
    - Import `COPY` from `@/utils/copy`
    - Replace `QUENTE` → `Alta Propensão`, `MORNO` → `Média Propensão`, `FRIO` → `Baixa Propensão`
    - _Requirements: 10.5_

  - [ ] 3.8 Update SmartSnippets to use professional language
    - Update `web/app/(dashboard)/tela1/components/SmartSnippets.tsx` to use professional terminology from COPY
    - _Requirements: 10.6, 11.4_

- [ ] 4. Checkpoint — Verify copy mapping
  - Ensure all emojis are removed and all labels use professional B2B/legal terminology. Ensure all tests pass, ask the user if questions arise.

- [x] 5. Pipeline logic in backend — `server.js`
  - [ ] 5.1 Create `web/utils/segmentTree.ts` with tree utility functions
    - Implement `SegmentNode` interface, `CascadeSelection` interface
    - Implement `filterChildren(nodes, parentId, nivel)` — filters active nodes by level and parent
    - Implement `resolvePersona(nodes, segmentoId, defaultPersona)` — resolves persona from segment
    - Implement `cascadeDeactivate(nodes, nodeId)` — returns IDs of node + all descendants
    - Implement `validateNodeCreation(nodes, parentId, nivel, nome)` — validates hierarchy and sibling uniqueness
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 4.5, 4.6_

  - [ ]* 5.2 Write property tests for segment tree functions
    - **Property 1: Integridade Hierárquica da Árvore** — For any node, nivel 1 requires parent_id null, nivel 2 requires parent nivel 1, nivel 3 requires parent nivel 2
    - **Property 2: Unicidade de Nomes entre Irmãos** — Duplicate names within same parent are rejected
    - **Property 3: Resolução de Persona** — Returns persona if set, default otherwise
    - **Property 4: Filtragem Cascata de Dropdowns** — Returns exactly active children matching parent and level
    - **Property 6: Desativação Cascata** — Deactivating a node returns it plus all descendants
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 3.2, 3.3, 3.4, 4.5, 4.6**
    - Create `tests/segmentTree.property.test.ts` using fast-check

  - [ ] 5.3 Implement pipeline validation logic as CommonJS module
    - Create pipeline constants (`PIPELINE_STAGES`, `STAGE_INDEX`, `STAGE_LABELS`) in a format usable by server.js (CommonJS)
    - Implement `validateTransition(from, to, conditions)` function with all stage-specific validations:
      - ENTRADA → QUALIFICADO: requires nome, telefone, score > 7
      - QUALIFICADO → EM_ATENDIMENTO: no extra conditions (assumir_lead)
      - EM_ATENDIMENTO → AGENDAMENTO: requires agendamento_data, agendamento_local
      - AGENDAMENTO → DEVOLUTIVA: requires documento_enviado
      - DEVOLUTIVA → PAGAMENTO_PENDENTE: requires documento_assinado
      - PAGAMENTO_PENDENTE → CARTEIRA_ATIVA: requires valor_entrada > 0, metodo_pagamento
      - CARTEIRA_ATIVA → FINALIZADO: requires valor_honorarios_finais > 0, data_baixa
    - Only allow advancing one stage at a time (no skipping, no going back)
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 6.4, 6.5_

  - [ ]* 5.4 Write property tests for pipeline validation
    - **Property 7: Transições de Pipeline Lineares e Condicionais** — Only S → S+1 allowed when conditions met; skipping or going back rejected
    - **Property 8: Validação de Campos Financeiros** — CARTEIRA_ATIVA requires positive valor_entrada + metodo_pagamento; FINALIZADO requires positive valor_honorarios_finais + valid data_baixa
    - **Validates: Requirements 5.3–5.10, 6.4, 6.5**
    - Create `tests/pipeline.property.test.ts` using fast-check

  - [ ] 5.5 Add `pipeline_transition` Socket.io handler in `server.js`
    - Add handler for `pipeline_transition` event: `{ lead_id, target_stage, conditions }`
    - Fetch current lead `status_pipeline` from Supabase
    - Call `validateTransition` — if rejected, emit `pipeline_error` with error message
    - If allowed: UPDATE `leads.status_pipeline`, UPDATE `atendimentos` with conditional fields, emit `pipeline_changed` to all clients
    - _Requirements: 5.10, 5.11, 15.1_

  - [ ] 5.6 Implement Momento WOW dispatcher in `server.js`
    - Create `dispatchMomentoWow(lead_id, db)` function
    - Webhook: POST to `WEBHOOK_WOW_URL` with payload (nome, telefone, segmento, assunto, valor_entrada, metodo_pagamento, operador_nome, data_conversao). Use AbortController with 5s timeout. Log warning if URL not configured, log error on failure. Never block pipeline transition.
    - Welcome message: Build professional message (no emojis), persist in `mensagens` table with tipo='sistema' and de='bot', send via Telegram/WhatsApp using existing `sendTelegramWithTyping`
    - Call `dispatchMomentoWow` when `pipeline_transition` target is `CARTEIRA_ATIVA`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4_

  - [ ]* 5.7 Write property tests for webhook and welcome message
    - **Property 11: Completude do Payload do Webhook** — Payload contains all required fields with valid data_conversao ISO 8601
    - **Property 12: Mensagem de Boas-Vindas sem Emojis** — Message contains nome, segmento, persona and has zero emoji characters
    - **Validates: Requirements 12.2, 13.2, 13.3**
    - Create `tests/webhookWow.property.test.ts` using fast-check

- [ ] 6. Checkpoint — Verify backend pipeline logic
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Frontend — Sidebar reorganized by pipeline
  - [ ] 7.1 Refactor `ConversasSidebar.tsx` to organize leads by pipeline stages
    - Replace 3-section layout (Prioridade/Em Curso/Em Pausa) with 7 pipeline sections: Captação (ENTRADA), Qualificação (QUALIFICADO), Em Atendimento (EM_ATENDIMENTO), Agendamento (AGENDAMENTO), Devolutiva (DEVOLUTIVA), Pagamento Pendente (PAGAMENTO_PENDENTE), Carteira Ativa (CARTEIRA_ATIVA)
    - Each section: collapsible, with lead counter, ordered by `created_at` desc
    - FINALIZADO leads do not appear in sidebar
    - Query leads grouped by `status_pipeline` from Supabase
    - Listen for `pipeline_changed` Socket.io event to move leads between sections in real-time
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 15.2_

  - [ ]* 7.2 Write unit tests for sidebar pipeline section counts
    - **Property 9: Contadores da Sidebar por Pipeline** — Counter per section equals actual lead count in that stage; FINALIZADO section does not exist
    - **Validates: Requirements 7.2, 7.5**

- [ ] 8. Frontend — ProgressBar component
  - [ ] 8.1 Create `web/app/(dashboard)/tela1/components/ProgressBar.tsx`
    - Accept `currentStage: PipelineStage` prop
    - Render 8 dots/segments horizontally: completed stages in success (#1DB954), current stage in accent (#1A73E8) with pulse animation, future stages in border (#E8E7E1)
    - Display current stage label text below the bar
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 8.2 Integrate ProgressBar into `ChatCentral.tsx` header
    - Import ProgressBar and render between lead name and action buttons in the header
    - Pass `lead.status_pipeline` as `currentStage`
    - Update ProgressBar in real-time when `pipeline_changed` event is received for the selected lead
    - _Requirements: 8.1, 8.4, 15.3_

  - [ ]* 8.3 Write property test for ProgressBar visual state
    - **Property 10: Estado Visual da Barra de Progresso** — For stage N, stages 0..N-1 are "completed", stage N is "current", stages N+1..7 are "future"
    - **Validates: Requirement 8.2**

- [ ] 9. Frontend — Cascading dropdowns and financial fields in BlocoQualificacao
  - [ ] 9.1 Replace area dropdown with 3 cascading dropdowns in `BlocoQualificacao.tsx`
    - Remove existing `areas_juridicas` dropdown and related state/logic
    - Add 3 sequential dropdowns: Segmento (nivel 1), Assunto (nivel 2), Especificação (nivel 3)
    - Fetch all active `segment_trees` nodes from Supabase on mount
    - Use `filterChildren` from `@/utils/segmentTree` for cascading logic
    - When Segmento changes: clear Assunto and Especificação, auto-resolve persona via `resolvePersona`
    - When Assunto changes: clear Especificação
    - Disable dropdown when no children available, show "Nenhuma opção disponível"
    - Persist selected IDs to `leads.segmento_id`, `leads.assunto_id`, `leads.especificacao_id`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 9.2 Write property test for cascade selection reset
    - **Property 5: Reset Cascata de Seleções** — Changing Segmento clears Assunto + Especificação; changing Assunto clears only Especificação
    - **Validates: Requirements 3.5, 3.6**

  - [ ] 9.3 Add conditional financial fields and pipeline advance button to `BlocoQualificacao.tsx`
    - Show `valor_entrada` + `metodo_pagamento` fields when lead is at PAGAMENTO_PENDENTE
    - Show `valor_honorarios_finais` + `data_baixa` fields when lead is at CARTEIRA_ATIVA
    - Show `agendamento_data` + `agendamento_local` fields when lead is at EM_ATENDIMENTO
    - Show `documento_enviado` checkbox when lead is at AGENDAMENTO
    - Show `documento_assinado` checkbox when lead is at DEVOLUTIVA
    - Add "Avançar Pipeline" button that emits `pipeline_transition` via Socket.io with current conditions
    - Handle `pipeline_error` events to display validation errors
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.2, 6.3_

  - [ ] 9.4 Style "Dossiê Estratégico" section with JetBrains Mono
    - Apply `font-mono` (JetBrains Mono) to the notes section renamed "Dossiê Estratégico"
    - Use neutral bg (`bg-bg-surface`) and border (`border-border`) instead of Post-it yellow
    - _Requirements: 10.4, 11.2, 11.3_

- [ ] 10. Frontend — Backoffice Segmentos page
  - [ ] 10.1 Create `web/app/(dashboard)/backoffice/segmentos/page.tsx`
    - Route: `/backoffice/segmentos`, owner-only access (check user role via Supabase auth)
    - Display segment tree as expandable hierarchy with 3 levels
    - Per-node actions: Add child, Edit, Deactivate
    - Add form: nome (required), persona (optional, level 1 only)
    - Validate sibling name uniqueness using `validateNodeCreation` from `@/utils/segmentTree`
    - Cascade deactivation: use `cascadeDeactivate` to deactivate node + all descendants
    - Use Tema_Light design tokens
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 11. Checkpoint — Verify frontend components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Momento WOW — Visual effect
  - [ ] 12.1 Create `web/app/(dashboard)/tela1/components/MomentoWowEffect.tsx`
    - Accept `leadId: string` and `onComplete: () => void` props
    - Triggered when Socket.io receives `pipeline_changed` with `status_novo === 'CARTEIRA_ATIVA'`
    - Visual effect: success (#1DB954) border pulse on the lead card in sidebar for 3 seconds
    - Temporary "Convertido" badge for 3 seconds
    - Optional notification sound (configurable)
    - CSS animation: `@keyframes pulse-success` with border-color transition
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ] 12.2 Integrate MomentoWowEffect into the Cockpit
    - Listen for `pipeline_changed` events in the sidebar/tela1 page
    - When `status_novo === 'CARTEIRA_ATIVA'`, render MomentoWowEffect for the converted lead
    - Auto-dismiss after 3 seconds via `onComplete` callback
    - _Requirements: 14.4, 15.4_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests validate universal correctness properties from the design document
- The implementation order follows the user's recommendation: SQL → Copy → Backend Pipeline → Frontend → Momento WOW
- Backend pipeline logic (task 5.3) is implemented as CommonJS module for direct use in `server.js`
- Frontend TypeScript types for pipeline are shared via `web/utils/segmentTree.ts` and copy constants via `web/utils/copy.ts`
