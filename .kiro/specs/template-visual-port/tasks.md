# Implementation Plan: Template Visual Port

## Overview

Port the visual design from 3 Vite+React templates (RelationshipView, BackofficeView, DashboardView) + Sidebar + UI primitives into the existing Next.js app. Strategy: replace only CSS/Tailwind classes and JSX layout structure — zero changes to hooks, state, effects, Supabase queries, socket listeners, or business functions. Sequence: shared components → sidebar → tela1 (list → chat → panel) → tela2 → financeiro → recovery → validation.

## Tasks

- [ ] 1. Install dependencies and create shared foundation
  - [ ] 1.1 Install new npm dependencies in web/
    - Run `npm install lucide-react clsx tailwind-merge date-fns` in `web/`
    - Verify packages added to `web/package.json` without removing existing deps
    - _Requirements: 9.5_

  - [ ] 1.2 Create `web/lib/utils.ts` with cn() utility
    - Create file exporting `cn()` using `clsx` + `tailwind-merge` (exact copy from `templates/src/lib/utils.ts`)
    - Ensure `@/lib/utils` import alias works with existing tsconfig paths
    - _Requirements: 1.6_

  - [ ] 1.3 Create `web/components/ui/Card.tsx`
    - Port Card component from `templates/src/components/ui/Base.tsx`
    - Classes: `bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden`
    - Export as named export `Card`
    - _Requirements: 1.3, 1.4, 1.6_

  - [ ] 1.4 Create `web/components/ui/Button.tsx`
    - Port Button component from `templates/src/components/ui/Base.tsx`
    - Variants: primary (`bg-blue-600`), secondary, neutral
    - Classes: `px-4 py-2 rounded-lg font-medium transition-all active:scale-95`
    - _Requirements: 1.6_

  - [ ] 1.5 Create `web/components/ui/Badge.tsx`
    - Port Badge component from `templates/src/components/ui/Base.tsx`
    - Classes: `px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider`
    - _Requirements: 1.6_

  - [ ] 1.6 Update `web/app/globals.css` with Inter font import and scrollbar-hide
    - Add `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');` at top
    - Add `.scrollbar-hide` CSS rules (webkit + Firefox + IE/Edge)
    - Do NOT remove any existing CSS variables or rules
    - _Requirements: 1.1, 1.7_

  - [ ]* 1.7 Write property test for cn() utility
    - **Property 1: cn() merges base classes with custom classes**
    - **Validates: Requirements 1.6**

- [ ] 2. Checkpoint — Verify foundation
  - Ensure all shared components compile without errors, ask the user if questions arise.

- [ ] 3. Port Sidebar visual
  - [ ] 3.1 Update `web/components/Sidebar.tsx` with template visual
    - Replace width: `w-sidebar` → `w-20 lg:w-64` with transition
    - Add Lucide icons: Zap (logo), MessageSquare, LayoutGrid, DollarSign, Settings, LogOut
    - Add logo block: Zap icon in `bg-blue-600 rounded-lg`, text `font-black text-xl tracking-tighter`, hidden on collapse
    - Style nav items: `p-3 rounded-xl`, active `bg-blue-50 text-blue-600` with icon `scale-110`, inactive `text-gray-400 hover:bg-gray-50`
    - Add footer: Settings + LogOut buttons with `border-t border-gray-50`, LogOut in `text-red-400 hover:bg-red-50`
    - Text labels `hidden lg:block`
    - KEEP: `links[]` array, `usePathname()`, `role` prop, `ownerOnly` filter, `<Link>` components
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 3.2 Update `web/app/(dashboard)/layout.tsx` if needed
    - Ensure layout accommodates new sidebar width (`w-20 lg:w-64` instead of `w-sidebar`)
    - Do NOT change auth logic, SocketProvider, or Header
    - _Requirements: 2.1_

- [x] 4. Port ConversasSidebar visual (tela1 list column)
  - [x] 4.1 Update `web/app/(dashboard)/tela1/components/ConversasSidebar.tsx` with template visual
    - Container: `w-[280px]` → `w-80`, bg `bg-[#F1F3F6]`, border `border-r border-[#E6E8EC]/20`
    - Add title "Conversas" in `text-xl font-bold tracking-tight`
    - Filters: pills (`rounded-full`) → underline tabs (`border-b-2 pb-1 text-[11px]`), active `text-blue-600 font-semibold border-blue-400`, inactive `text-[#9CA3AF] border-transparent`
    - Search: `rounded-full` → `rounded-xl`, bg `bg-[#F7F8FA]`, `shadow-sm`, Lucide Search icon, placeholder "Buscar cliente..."
    - Avatar: `w-10 h-10` → `w-12 h-12` with image or initial, status dot (`bg-blue-500`/`bg-yellow-500`/`bg-gray-400`)
    - Name: `font-bold text-sm`, timeAgo: `text-[9px] font-bold text-gray-300 uppercase`, preview: `text-xs text-gray-400 truncate`
    - Selected: `bg-white shadow-sm rounded-xl` with `border-l-4` colored by score (blue-600 hot, yellow-400 warm, gray-400 cold)
    - Fade transition: `opacity-0`→`opacity-100` with `duration-200`
    - KEEP ALL: `loadLeads()`, socket listeners, `handleSearch()` debounce, `getAllLeadsFlat()` dedup, `useMemo` chains, `getConversationStatus()`, `sortConversations()`, `handleSaveNewContact()`, `counters`, new contact modal
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 4.2 Write property test for lead list item rendering
    - **Property 2: Lead list item renders all required visual elements**
    - **Validates: Requirements 3.4**

- [ ] 5. Port ChatCentral visual (tela1 chat column)
  - [ ] 5.1 Update `web/app/(dashboard)/tela1/components/ChatCentral.tsx` with template visual
    - Message area bg: `bg-[#F6F8FC]`
    - Header: avatar `w-10 h-10 rounded-full border border-gray-100 shadow-sm`, name `font-bold text-sm tracking-tight`, "Online" indicator `text-[10px] font-bold uppercase tracking-widest` with `animate-pulse bg-blue-500` dot
    - Sent messages: `bg-[#2563EB] text-white rounded-2xl rounded-tr-none shadow-[0_2px_8px_rgba(0,0,0,0.04)]`
    - Received messages: `bg-white text-gray-900 rounded-2xl rounded-tl-none border border-white`
    - Timestamps: `text-[9px] font-bold uppercase tracking-tighter opacity-60`
    - Input area: container `bg-[#F8FAFC] rounded-2xl border border-gray-100/50 shadow-inner`, Paperclip button, textarea `text-[13px] font-medium`, send button `bg-blue-600 rounded-xl shadow-md shadow-blue-100`
    - KEEP ALL: `loadMessages()`, socket listeners, `handleSend()`, `handleInputChange()`, `handleFileSelect()`, `handleKeyDown()`, `isNotaInterna`, SmartSnippets, QuickReplies, PopupEnfileirar, PopupAguardando, typing detection
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 5.2 Write property test for message direction styling
    - **Property 3: Message styling is direction-dependent**
    - **Validates: Requirements 4.3, 4.4**

- [ ] 6. Checkpoint — Verify tela1 columns
  - Ensure ConversasSidebar and ChatCentral compile and render correctly, ask the user if questions arise.

- [x] 7. Port BlocoQualificacao visual (tela1 right panel) — MOST CRITICAL
  - [x] 7.1 Update `web/app/(dashboard)/tela1/components/BlocoQualificacao.tsx` with template visual
    - Container: bg `bg-[#FBFBFC]`, border `border-l border-[#E6E8EC]/20`
    - Avatar section: `w-24 h-24 rounded-full border-[3px] border-white` with ring by leadStatus (`ring-blue-100` hot, `ring-[#FEF3C7]` warm, `ring-gray-100` cold), initial in `text-3xl font-black text-gray-200`
    - Lead status badge: `text-[9px] font-black uppercase tracking-[0.2em]` with colored bg
    - Editable fields (Nome, Telefone, Email): `border-b border-gray-100 focus-within:border-blue-600`, labels `text-[10px] font-bold text-gray-300 uppercase tracking-widest`, values `text-sm font-bold text-gray-900`
    - Identity link button: `text-[10px] text-blue-600 font-bold uppercase bg-blue-50/30 rounded-xl border border-blue-50`
    - Classification dropdowns (Segmento, Assunto): `rounded-xl shadow-sm font-bold bg-white border border-[#E6E8EC]/20 p-3`
    - "Próximo Passo" dropdown: `bg-blue-50/30 border-blue-100 text-blue-700 rounded-2xl p-4 font-black`
    - Label "PRÓXIMO PASSO": `text-[10px] font-black text-blue-600 italic underline underline-offset-4`
    - "Vai acontecer" preview block: `bg-gray-900 rounded-2xl` with fade-in animation, title `text-[10px] font-black text-blue-400 uppercase tracking-widest`, content `text-xs font-bold text-white` — connected to real `resolveClassification()` output
    - Dossiê textarea: `rounded-xl shadow-sm min-h-[100px] text-[11px] font-medium placeholder:text-gray-200`
    - Fixed bottom section: "Alterações não salvas" indicator `text-[10px] font-black text-[#92400E] bg-[#FEF3C7] rounded-md uppercase tracking-widest animate-pulse`
    - "Confirmar e encaminhar" button: `fixed bottom-0 w-80 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em]`, active `bg-[#2563EB] text-white shadow-xl shadow-blue-100`, disabled `bg-[#E5E7EB] text-gray-400 cursor-not-allowed`
    - KEEP ALL: `resolveClassification()`, cascading dropdowns with `filterChildren()`, `handleClassificar()`, `handleConversao()`, `handleNaoFechou()`, `saveNome()`/`saveTelefone()`/`saveEmail()`, `linkToIdentity()`, `handleSaveNota()` auto-save, botoeira de jornada modals, toast system, all popups
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ]* 7.2 Write property test for preview block reflecting resolveClassification
    - **Property 4: Preview block reflects resolveClassification output**
    - **Validates: Requirements 5.6**

- [ ] 8. Update tela1 page layout
  - [ ] 8.1 Update `web/app/(dashboard)/tela1/page.tsx` if needed
    - Ensure the 3-column layout uses correct widths: `w-80` (list) + `flex-1` (chat) + `w-80` (panel)
    - Apply `bg-[#F7F8FA]` to outer container, `overflow-hidden` on flex row
    - KEEP ALL: lead selection state, query params, socket events, data loading
    - _Requirements: 3.1, 4.1, 5.1_

- [ ] 9. Checkpoint — Verify complete tela1
  - Ensure all 3 columns of tela1 render correctly with template visual, ask the user if questions arise.

- [ ] 10. Port Tela2 BackOffice visual
  - [ ] 10.1 Update `web/app/(dashboard)/tela2/page.tsx` with template visual
    - Title: `text-3xl font-black tracking-tight` + subtitle `text-sm font-medium text-gray-500` + "Atualizado agora" indicator with animated green dot
    - Summary cards: use Card component with `border-none shadow-sm hover:shadow-md`, icon in colored bg `rounded-lg`, value `text-4xl font-black`, label `text-[10px] font-black uppercase tracking-widest`, subtitle colored `text-[11px] font-bold`
    - Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5`
    - Section headers: `text-xs font-black uppercase tracking-[0.2em]` with italic subtitle and case count
    - Lead cards: Card with `border-none hover:ring-2 hover:ring-blue-100`, avatar `w-12 h-12 rounded-2xl bg-gray-50` (hover `bg-blue-50 text-blue-500`), name `text-base font-bold`, micro copy urgency `text-[11px] font-black uppercase` with contextual colors, value, Badge, ChevronRight action button
    - Replace 3 inline action buttons (Avançar/Fechar/Desistiu) with single contextual ChevronRight button that calls `handleAvancar()` for non-terminal leads
    - Empty state: CheckCircle in `bg-green-50 rounded-full`, "Operação sob controle" in `font-bold`, subtitle "Nenhum cliente precisa de atenção agora"
    - Import and use Card, Badge from `@/components/ui/`
    - Import Lucide icons: Target, CheckCircle, XCircle, ChevronRight, MessageSquare, Clock, Zap
    - KEEP ALL: `loadData()`, `handleTransition()`, `handleAvancar()`, `handleFechar()`, `handleDesistiu()`, `handleReengajar()`, `validateBusinessTransition()`, `getNextStatus()`, socket listeners, `handleRescue()`, `BACKOFFICE_GROUPS`, toast system
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 10.2 Write property test for backoffice lead grouping
    - **Property 5: Backoffice leads are grouped by status_negocio**
    - **Validates: Requirements 6.3, 6.4**

- [ ] 11. Port Financeiro/Dashboard visual
  - [ ] 11.1 Update `web/app/(dashboard)/financeiro/page.tsx` with template visual
    - Title: `text-3xl font-black tracking-tight` "Dashboard de Controle" + subtitle `text-sm font-medium text-gray-500`
    - KPI cards: use Card with `border-none shadow-sm`, Lucide icons (Wallet, Users, Target) in colored bg `p-3 rounded-xl`, label `text-[10px] font-black text-gray-400 uppercase tracking-widest`, value `text-3xl font-black`
    - "Controle de Relacionamento" section: Card with indicators (dots + labels), engagement bar `h-2 bg-gray-100 rounded-full` split blue-500/orange-400
    - "Performance Backoffice" section: Card with items in `p-3 bg-gray-50 rounded-xl` (Zap orange, CheckCircle green), report button `text-[10px] font-black text-blue-600 bg-blue-50 rounded-xl uppercase tracking-widest`
    - "Últimas Conversões" section: Card with list items — TrendingUp icon in `bg-green-50 rounded-full`, name `text-sm font-bold`, date `text-[10px] font-medium text-gray-400`, value `text-base font-black`, ChevronRight
    - Empty state: "Nenhuma conversão registrada no período." in `text-gray-400 font-bold italic text-xs`
    - Operator table: apply Card styling
    - Import Lucide icons: Wallet, Users, Target, TrendingUp, ChevronRight, Zap, CheckCircle
    - KEEP ALL: `loadData()`, Supabase queries (pot_tratamento, atendimentos, leads, bot_feedback), calculations, `fmt()`, MetricCard/MetricIcon logic
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 11.2 Write property test for engagement bar proportions
    - **Property 6: Engagement bar proportions are valid**
    - **Validates: Requirements 7.3**

- [ ] 12. Checkpoint — Verify tela2 and financeiro
  - Ensure tela2 and financeiro pages compile and render with template visual, ask the user if questions arise.

- [ ] 13. Port Recovery module styling
  - [ ] 13.1 Apply template visual pattern to recovery section in `web/app/(dashboard)/tela2/page.tsx`
    - Section headers: "Abandonados (URA)", "Perdidos", "Outros" in `text-xs font-black uppercase tracking-[0.2em]`
    - Lead items: Card with `border-none shadow-sm`, avatar `w-12 h-12 rounded-2xl bg-gray-50`, micro copy contextual ("Abandonou na etapa X", "Sem resposta há X dias")
    - "Reativar" button replacing "Abrir no Cockpit" — same visual style as backoffice action buttons
    - Display: nome, canal_origem, ultimo_estado, timeAgo
    - KEEP ALL: Supabase queries for abandonos/others, `handleRescue()`, socket emit `conversa_resgatada`, router navigation
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 14. Final validation
  - [ ] 14.1 Verify all existing tests still pass
    - Run existing test suite to confirm no regressions
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 14.2 Verify no function signatures changed
    - Confirm `resolveClassification`, `getConversationStatus`, `validateBusinessTransition`, `createAuditEntry`, `getNextStatus` signatures are identical
    - Confirm all socket event names unchanged (lead_assumido, nova_mensagem_salva, lead_encerrado, conversa_classificada, status_negocio_changed, pipeline_transition, conversa_resgatada)
    - Confirm all Supabase queries unchanged
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

- [ ] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate universal correctness properties from the design document
- The core principle is "visual swap" — only CSS/Tailwind classes and JSX layout change, never business logic
