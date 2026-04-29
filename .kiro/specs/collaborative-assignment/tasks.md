# Implementation Plan: Atribuição Colaborativa sem Bloqueios

## Overview

Implementação do sistema de atribuição colaborativa com presença em tempo real, audit trail completo e ausência total de bloqueios. O plano segue a sequência: migration → server handlers → frontend components → validação. Código em JavaScript (server) e TypeScript/React (frontend).

## Tasks

- [x] 1. Create database migration for assignment_logs table
  - [x] 1.1 Create `sql/migrations/016_collaborative_assignment.sql` with the `assignment_logs` table
    - Create table with columns: `id` (UUID PK), `lead_id` (FK leads), `from_user_id` (FK auth.users, nullable), `to_user_id` (FK auth.users, nullable), `action` (TEXT with CHECK constraint for 'assign','reassign','delegate','unassign'), `created_at` (TIMESTAMPTZ DEFAULT now())
    - Enable RLS with policies: `service_role_full_assignment_logs` (full access for service_role), `authenticated_read_assignment_logs` (SELECT for authenticated), `authenticated_insert_assignment_logs` (INSERT for authenticated)
    - Create indexes: `idx_assignment_logs_lead` on `lead_id`, `idx_assignment_logs_created` on `created_at`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. Implement server-side presence manager and socket handlers
  - [x] 2.1 Add in-memory presence manager to `server.js`
    - Create `viewingMap` as `new Map()` (Map<lead_id, Map<user_id, ViewerInfo>>) above the `io.on('connection')` block
    - Add heartbeat checker via `setInterval(5000)` that removes entries with `last_heartbeat` older than 15 seconds and emits `viewing_update` on cleanup
    - _Requirements: 3.5_

  - [x] 2.2 Modify existing `assumir_lead` handler in `server.js` to use upsert with audit logging
    - Replace the current `insert` with `upsert({ onConflict: 'lead_id' })` so it never fails on UNIQUE constraint
    - Before upsert, query current `owner_id` from `atendimentos` to determine previous owner
    - Set `action` to 'assign' if no previous owner, 'reassign' if there was one
    - Set `delegado_de` to previous owner on reassign
    - Insert audit entry into `assignment_logs` with `lead_id`, `from_user_id`, `to_user_id`, `action`
    - Fetch owner name from `auth.users` (via `raw_user_meta_data->name`) for broadcast, fallback to 'Operador'
    - Emit `assignment_updated` event with `{ lead_id, owner_id, owner_name, action }` in addition to existing `lead_assumido`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.1, 4.4, 4.5, 4.7, 5.1, 6.5, 6.7_

  - [x] 2.3 Add new `delegate_lead` handler in `server.js`
    - Listen for `delegate_lead` event with payload `{ lead_id, from_user_id, to_user_id }`
    - Update `atendimentos` set `owner_id = to_user_id`, `delegado_de = from_user_id` where `lead_id` matches
    - Insert audit entry into `assignment_logs` with action 'delegate'
    - Fetch new owner name from `auth.users` for broadcast
    - Emit `lead_delegado` and `assignment_updated` events
    - _Requirements: 5.2_

  - [x] 2.4 Add presence socket handlers (`user_viewing`, `user_left`, disconnect cleanup) in `server.js`
    - `user_viewing`: add user to `viewingMap` for the lead, emit `viewing_update` with current viewers list
    - `user_left`: remove user from `viewingMap` for the lead, emit `viewing_update`
    - Extend existing `disconnect` handler: iterate all `viewingMap` entries, remove entries matching `socket.id`, emit `viewing_update` for affected leads
    - _Requirements: 3.1, 3.2, 3.5_

  - [ ]* 2.5 Write property tests for presence manager (P7, P8, P9)
    - **Property 7: Presence viewer list is correctly maintained across join/leave events**
    - **Validates: Requirements 3.3, 3.4**
    - **Property 8: Presence timeout removes stale viewers**
    - **Validates: Requirements 3.5**
    - **Property 9: Presence self-filter excludes current user**
    - **Validates: Requirements 3.6, 3.7**

  - [ ]* 2.6 Write property tests for assume/delegate logic (P1, P2, P3, P4, P11)
    - **Property 1: Assume action always succeeds and sets owner correctly**
    - **Validates: Requirements 1.2, 1.4, 1.5, 4.1, 4.5, 4.6, 6.7**
    - **Property 2: Assume action records audit log with correct fields**
    - **Validates: Requirements 1.3, 5.1**
    - **Property 3: Delegate action records audit log with correct fields**
    - **Validates: Requirements 5.2**
    - **Property 4: Reassignment preserves previous owner in delegado_de**
    - **Validates: Requirements 4.4**
    - **Property 11: Last-write-wins on concurrent assumes**
    - **Validates: Requirements 6.5**

- [x] 3. Checkpoint — Ensure server-side changes compile and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update ConversasSidebar to show owner name, last action, and listen for assignment_updated
  - [x] 4.1 Modify `loadLeads` in `ConversasSidebar.tsx` to fetch owner info
    - Join `atendimentos.owner_id` with `auth.users` (or fetch separately) to get owner name for each lead
    - Fetch latest `status_transitions.created_at` per lead for last action timestamp
    - Add `ownerName` and `lastActionInfo` (actor name + timestamp) to `LeadWithMeta` interface
    - _Requirements: 2.1, 2.5_

  - [x] 4.2 Update `renderLeadItem` in `ConversasSidebar.tsx` to display owner and last action
    - Show "Responsável: {ownerName}" below the message preview, or "Sem responsável" when `owner_id` is null
    - Show "Última ação: {actorName} · {timeAgo}" line
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.3 Add `assignment_updated` socket listener in `ConversasSidebar.tsx`
    - Listen for `assignment_updated` event and update the owner name in the matching lead card in real time without full reload
    - _Requirements: 2.4_

  - [ ]* 4.4 Write property tests for card owner display and last action (P5, P6)
    - **Property 5: Card displays correct owner name**
    - **Validates: Requirements 2.1, 2.2**
    - **Property 6: Last action computation selects most recent timestamp**
    - **Validates: Requirements 2.3**

- [x] 5. Update ChatCentral with presence indicators, heartbeat, and collision warning
  - [x] 5.1 Add presence heartbeat emission in `ChatCentral.tsx`
    - On mount (when lead is selected): emit `user_viewing` with `{ lead_id, user_id, user_name }`
    - Set up `setInterval(10000)` to re-emit `user_viewing` as heartbeat
    - On unmount or lead change: emit `user_left` with `{ lead_id, user_id }` and clear interval
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Add presence indicator display in `ChatCentral.tsx` header
    - Listen for `viewing_update` socket event
    - Maintain state `viewers` array, filter out current user (`operadorId`)
    - Display "Usuário X está visualizando" for each viewer in the chat header area
    - Hide indicator when no other viewers are present
    - _Requirements: 3.3, 3.4, 3.6, 3.7_

  - [x] 5.3 Add non-blocking collision warning in `ChatCentral.tsx`
    - When `handleAssumir` is called, check if lead already has an owner (via `assignment_updated` state or fetched data)
    - If owner exists, show a non-blocking warning with the current owner's name (e.g., toast or inline banner)
    - Allow the operator to proceed — do NOT block the action
    - _Requirements: 4.2, 4.3, 6.1, 6.2, 6.4, 6.6_

  - [x] 5.4 Listen for `assignment_updated` in `ChatCentral.tsx`
    - Update local owner state when `assignment_updated` event is received for the current lead
    - _Requirements: 4.7_

  - [ ]* 5.5 Write property test for warning on reassignment (P12)
    - **Property 12: Warning shows current owner name on reassignment**
    - **Validates: Requirements 4.2**

- [x] 6. Checkpoint — Ensure frontend compiles and presence works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add delegate button and operator list popover to BlocoQualificacao
  - [x] 7.1 Add "Delegar" button and operator list popover in `BlocoQualificacao.tsx`
    - Add a "Delegar" button in the qualification panel (near existing action buttons)
    - On click, fetch list of operators from Supabase `auth.users` (or a dedicated RPC/view)
    - Show popover/dropdown with operator names
    - On select, emit `delegate_lead` socket event with `{ lead_id, from_user_id: operadorId, to_user_id: selectedOperator }`
    - _Requirements: 5.2_

  - [ ]* 7.2 Write unit tests for delegate button behavior
    - Test that popover opens on click
    - Test that `delegate_lead` event is emitted with correct payload
    - _Requirements: 5.2_

- [x] 8. Update Tela2 BackOffice to show owner name and add assumir/delegar actions
  - [x] 8.1 Modify `loadData` in `tela2/page.tsx` to fetch owner info
    - Extend the atendimentos query to include `owner_id`
    - Fetch owner names from `auth.users` for each atendimento
    - Add `owner_name` to `LeadComAtendimento` interface
    - _Requirements: 2.1, 2.5_

  - [x] 8.2 Display owner name and add Assumir/Delegar buttons in Tela2 cards
    - Show "Responsável: {owner_name}" in each lead card, or "Sem responsável" when null
    - Add "Assumir" button that emits `assumir_lead` socket event
    - Add "Delegar" button that opens operator list and emits `delegate_lead`
    - Listen for `assignment_updated` socket event to update cards in real time
    - _Requirements: 2.1, 2.2, 4.1, 4.7_

  - [ ]* 8.3 Write unit tests for Tela2 owner display
    - Test owner name rendering and "Sem responsável" placeholder
    - _Requirements: 2.1, 2.2_

- [ ] 9. Add audit trail round-trip property test
  - [ ]* 9.1 Write property test for audit log round-trip (P10)
    - **Property 10: Audit log round-trip reconstructs ownership history**
    - **Validates: Requirements 5.5, 5.6**

- [x] 10. Final checkpoint — Ensure all tests pass and full integration works
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: assume from sidebar updates card owner in real time (Req 2.4)
  - Verify: presence indicators appear/disappear correctly (Req 3.3, 3.5)
  - Verify: delegate from BlocoQualificacao updates all views (Req 5.2)
  - Verify: no blocking indicators or permission checks exist (Req 6.1, 6.2, 6.4)
  - Verify: audit trail entries are created for all actions (Req 5.1, 5.2, 5.3)

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The existing `delegar_lead` handler in server.js will be replaced by the new `delegate_lead` handler with audit logging
