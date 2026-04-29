# Implementation Plan: Smart Conversation Sorting

## Overview

Implement the smart conversation sorting feature across 7 modules: database migration, utility functions, ConversasSidebar changes, BlocoQualificacao classification flow, Tela2 BackOffice status_negocio groups, server.js socket handler, and the Outros & Abandonados recovery module. Tasks are ordered by dependency — migration first, then pure utility functions, then UI components, then integration.

## Tasks

- [x] 1. Database migration — Add status_negocio columns, audit table, and unread_count
  - [x] 1.1 Create `sql/migrations/015_smart_conversation_sorting.sql`
    - Add columns `status_negocio`, `destino`, `motivo_id`, `categoria_id`, `subcategoria_id` to `atendimentos`
    - Add index `idx_atendimentos_status_negocio`
    - Create `status_transitions` table with RLS policies and indexes
    - Add `unread_count` column to `leads`
    - All operations must be idempotent (IF NOT EXISTS / IF NOT EXISTS)
    - _Requirements: 9.4, 9.5, 12.1, 12.6, 14.5_

- [x] 2. Utility functions — Pure logic modules
  - [x] 2.1 Create `web/utils/conversationStatus.ts` with `getConversationStatus()` and `CONVERSATION_STATUS_STYLES`
    - Implement threshold logic: <8h=active, 8-34h=waiting, 34h-7d=no_response, ≥7d=inativo
    - Handle null `ultimaMsgEm` fallback to `createdAt`, and null both → no_response
    - Export types `ConversationStatus`, `ConversationStatusResult`
    - Export `CONVERSATION_STATUS_STYLES` with label, bg, text for each status
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 13.1_

  - [ ]* 2.2 Write property test for `getConversationStatus` (Property 1)
    - **Property 1: Classificador temporal retorna status correto por threshold**
    - Generate random timestamps and reference times, verify status matches threshold ranges
    - Use fast-check with min 100 iterations
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 13.1**

  - [x] 2.3 Create `web/utils/resolveClassification.ts` with `resolveClassification()`
    - Implement string-matching logic for subcategoria → status_negocio + destino
    - Export types `StatusNegocio`, `Destino`, `ClassificationResult`
    - Mark function as TEMPORARY with clear documentation
    - Implement fallback to `aguardando_agendamento / backoffice`
    - _Requirements: 9.1, 9.3, 9.4, 9.6_

  - [x] 2.4 Create `web/utils/businessStateMachine.ts` with `validateBusinessTransition()` and `createAuditEntry()`
    - Implement `VALID_TRANSITIONS` map per design
    - `fechado` is terminal (no outgoing transitions)
    - `perdido` allows only reengajar → `aguardando_agendamento`
    - Export `TransitionResult`, `AuditEntry` types
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 2.5 Write property test for `validateBusinessTransition` (Property 13)
    - **Property 13: Máquina de estados aceita apenas transições válidas**
    - Generate random (from, to) pairs from StatusNegocio enum, verify allowed iff in VALID_TRANSITIONS map
    - Verify `fechado` has no outgoing transitions, `perdido` only allows `aguardando_agendamento`
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**

- [x] 3. Checkpoint — Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. ConversasSidebar — New sorting, filtering, and pills
  - [x] 4.1 Replace `classificarInatividade` with `getConversationStatus` in `ConversasSidebar.tsx`
    - Import `getConversationStatus` and `CONVERSATION_STATUS_STYLES` from `web/utils/conversationStatus`
    - Remove import of `classificarInatividade`, `STATUS_STYLES`, `LeadStatus` from `businessHours`
    - Update `LeadWithMeta` to use `_conversationStatus: ConversationStatusResult` instead of `_inactivityStatus`
    - Add `unreadCount?: number` to `LeadWithMeta`
    - Apply `getConversationStatus` in the classification loop (replace `classificarInatividade` call)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.4_

  - [x] 4.2 Implement 3 pills with counters and unread indicator
    - Change `activePill` type to `'todos' | 'aguardando' | 'sem_retorno'`
    - Replace 4 pill buttons with 3: "Todos", "Aguardando", "Sem retorno"
    - Compute counters from classified list: total, waiting count, no_response count, hasUnread
    - Display counter next to each pill label (e.g., "Todos 12", "Aguardando 3")
    - Show ● indicator next to "Todos" pill when `hasUnread` is true
    - Set "Todos" as default active pill
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_

  - [x] 4.3 Implement unread-first sort and inactivity-descending order
    - Add `sortConversations()` function: unread-first, then greater inactivity first, then tiebreaker
    - Wrap classification, sort, and filter in `useMemo` chains for memoization
    - Exclude conversations with `status === 'inativo'` from visible list
    - Apply fade transition (150ms opacity) when switching pills
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 7.1, 7.3, 13.3_

  - [x] 4.4 Add socket listener for `conversa_classificada` event
    - Listen for `conversa_classificada` on socket, remove matching lead from local state by `lead_id`
    - Recalculate counters after removal
    - No full page reload required
    - _Requirements: 10.1, 10.3, 10.4_

  - [ ]* 4.5 Write property tests for sorting and filtering (Properties 2, 3, 4, 5)
    - **Property 2: Ordenação unread-first com inatividade decrescente**
    - **Property 3: Filtros retornam apenas conversas do status correspondente**
    - **Property 4: Contadores refletem a contagem exata por status**
    - **Property 5: Indicador de não-lidos reflete presença de unread**
    - Generate random conversation lists with varied unreadCount and timestamps
    - **Validates: Requirements 2.1, 2.2, 2.4, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2**

- [x] 5. Checkpoint — Ensure sidebar changes work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. BlocoQualificacao — Classification flow with toast feedback
  - [x] 6.1 Add `handleClassificar()` function to `BlocoQualificacao.tsx`
    - Import `resolveClassification` from `web/utils/resolveClassification`
    - Resolve subcategoria name from `segmentNodes` by `selectedEspecificacao`
    - Call `resolveClassification(subcategoriaNome)` to get `status_negocio` and `destino`
    - Upsert `atendimentos` with `status_negocio`, `destino`, `motivo_id`, `categoria_id`, `subcategoria_id`, `classificacao_entrada`
    - Insert audit record into `status_transitions`
    - Emit `conversa_classificada` socket event with `{ lead_id, status_negocio, destino }`
    - Call `onLeadClosed()` on success
    - On failure: keep conversa in sidebar, show error toast
    - _Requirements: 9.3, 9.4, 9.5, 9.7, 10.1, 10.2, 10.5, 11.1, 12.3, 12.6_

  - [x] 6.2 Add inline toast system to `BlocoQualificacao.tsx`
    - Add `toast` state: `{ message, type, persistent } | null`
    - Implement `showToast(destino, error?)` with contextual messages per destino
    - Messages: backoffice→"Encaminhado para operação", encerrado→"Lead encerrado", sidebar→"Lead movido para sidebar", relacionamento→"Encaminhado para relacionamento"
    - Auto-dismiss success toasts after 3 seconds, error toasts persist until dismissed
    - Render toast as fixed div at bottom-right, no new React component
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [ ]* 6.3 Write unit tests for classification and toast flow
    - Test `resolveClassification` with known subcategoria names
    - Test toast message mapping for each destino value
    - Test error toast persistence behavior
    - _Requirements: 9.3, 15.1, 15.8_

- [x] 7. Tela2 BackOffice — Group by status_negocio with state machine actions
  - [x] 7.1 Update `Tela2/page.tsx` to group by `status_negocio` instead of `atendimento.status`
    - Replace `STATUS_GROUPS` with `BACKOFFICE_GROUPS` using status_negocio values
    - Update `loadData()` query to fetch `status_negocio` from `atendimentos`
    - Update `LeadComAtendimento` interface to include `status_negocio`
    - Group and count leads by `status_negocio` for summary cards
    - _Requirements: 11.6, 12.5_

  - [x] 7.2 Add 4 action buttons per card: Avançar, Fechar, Desistiu, Reengajar
    - Import `validateBusinessTransition` from `web/utils/businessStateMachine`
    - Validate transition before executing via `validateBusinessTransition(from, to)`
    - On valid transition: update `atendimentos.status_negocio`, insert `status_transitions` audit record
    - Emit `status_negocio_changed` socket event
    - Show error toast on invalid transition
    - Reengajar: transition `perdido` → `aguardando_agendamento`, set destino to `sidebar`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 7.3 Add socket listener for `conversa_classificada` in Tela2
    - Listen for `conversa_classificada` event, reload data when `destino === 'backoffice'`
    - Listen for `status_negocio_changed` event, update local state
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 7.4 Write unit tests for backoffice state transitions
    - Test each valid transition in VALID_TRANSITIONS map
    - Test rejection of invalid transitions
    - Test reengajar flow from perdido → aguardando_agendamento
    - _Requirements: 14.1, 14.4, 14.6_

- [x] 8. Checkpoint — Ensure classification and backoffice flow work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Server.js — Socket handler for `conversa_classificada`
  - [x] 9.1 Add `conversa_classificada` relay handler in `server.js`
    - Listen for `conversa_classificada` event from clients
    - Broadcast to all connected clients via `io.emit('conversa_classificada', payload)`
    - Payload: `{ lead_id, status_negocio, destino }`
    - _Requirements: 10.3_

  - [x] 9.2 Add `status_negocio_changed` relay handler in `server.js`
    - Listen for `status_negocio_changed` event from clients
    - Broadcast to all connected clients
    - Payload: `{ lead_id, status_anterior, status_novo, operador_id }`
    - _Requirements: 14.5_

  - [x] 9.3 Add `conversa_resgatada` relay handler in `server.js`
    - Listen for `conversa_resgatada` event from clients
    - Broadcast to all connected clients
    - Payload: `{ lead_id, tipo_resgate }`
    - _Requirements: 16.12, 16.13_

- [x] 10. Módulo Outros & Abandonados — Recovery display and actions
  - [x] 10.1 Create recovery section in Tela2 or as a tab showing `abandonado_ura` and `outro_input` conversations
    - Query `leads` or `abandonos`/`others` tables for conversations matching these statuses
    - Display `abandonado_ura` items with: nome, telefone, last message, abandonment stage
    - Display `outro_input` items with: nome, telefone, last message
    - Separate sections for each type within the module view
    - Sort by time since abandonment descending (longest first)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.16, 16.18_

  - [x] 10.2 Add rescue actions: open in cockpit, start manual service, classify normally
    - "Abrir no Cockpit" → navigate to tela1 with lead_id, remove abandonado/outro status
    - "Iniciar Atendimento" → assign to operator, move to cockpit
    - "Classificar" → open classification flow (same as BlocoQualificacao)
    - Emit `conversa_resgatada` socket event on rescue
    - Remove rescued conversation from module list
    - _Requirements: 16.9, 16.10, 16.11, 16.12, 16.13, 16.14, 16.15_

  - [ ]* 10.3 Write unit tests for recovery module display and filtering
    - Test that abandonado_ura and outro_input conversations are excluded from sidebar
    - Test rescue action removes conversation from module list
    - **Property 17: Exclusão de abandonado_ura e outro_input da sidebar**
    - **Validates: Requirements 16.6, 16.7**

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- `resolveClassification()` is TEMPORARY — uses string matching until DB columns are added to segment_trees
- No new React components are introduced; toast is inline state + conditional div
- Existing visual layout, spacing, and component hierarchy must be preserved
