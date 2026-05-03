# Plano de Implementação: Continuous Flow UX

## Visão Geral

Implementação faseada da transformação arquitetural de "navegação por telas" para "fluxo contínuo de operação". Cada fase depende da anterior estar completa — o backend garante consistência antes do orchestrator local, que funciona antes do sync multi-operador, que precede a UX contínua, finalizada pelo hardening de produção.

**Linguagem**: TypeScript (Next.js frontend + Supabase backend)
**Testes**: Vitest + fast-check (property-based testing)

---

## Tasks

- [x] 1. 🔴 FASE 1 — Core Transaction (Backend First)
  - Objetivo: Garantir consistência absoluta no backend antes de qualquer lógica de orquestração
  - Entregáveis: migração SQL, version check, idempotency key, tabela flow_events
  - _Requisitos: 4.1, 4.2, 4.3, 4.5, 19.1, 23.1, 23.5_

  - [x] 1.1 Criar migração SQL `sql/migrations/033_continuous_flow.sql`
    - Adicionar coluna `snapshot_version INTEGER DEFAULT 1 NOT NULL` à tabela `atendimentos`
    - Criar tabela `flow_events` com estrutura completa: `id`, `atendimento_id`, `action`, `from_state`, `to_state`, `from_stage`, `to_stage`, `operador_id`, `idempotency_key`, `metadata`, `created_at`
    - Criar índices: `(atendimento_id, created_at DESC)`, `(action)`, `(to_state)`, `(operador_id, created_at DESC)`, `(created_at DESC)`
    - Criar constraint UNIQUE `(atendimento_id, idempotency_key)`
    - Criar índice `(identity_id, snapshot_version)` na tabela `atendimentos`
    - Habilitar RLS com policies de INSERT e SELECT para authenticated
    - Referência: seção "Migração SQL" do design document
    - _Requisitos: 4.1, 4.2, 4.5, 19.1, 23.5_

  - [x] 1.2 Implementar função `generateIdempotencyKey` em `web/core/flow/types.ts`
    - Criar arquivo `web/core/flow/types.ts` com todos os tipos compartilhados do design
    - Exportar função `generateIdempotencyKey(action, atendimentoId, version)` que gera hash determinístico
    - Garantir que mesma entrada → mesma saída (determinismo)
    - Garantir que versões diferentes → chaves diferentes
    - _Requisitos: 23.1, 23.7_

  - [x]* 1.3 Escrever teste de propriedade para Idempotency Key Determinism
    - **Property 15: Idempotency Key Determinism**
    - Para qualquer tupla `(action, atendimento_id, snapshot_version)`, a chave gerada deve ser determinística
    - Tuplas com versão diferente devem produzir chaves diferentes
    - Usar fast-check com `arbFlowAction`, `fc.uuid()`, `fc.nat()`
    - **Valida: Requisitos 23.1, 23.7**

  - [x] 1.4 Implementar `applyTransaction` em `web/core/flow/effects/applyTransaction.ts`
    - Função que executa transação atômica: check idempotency → check version → update_state → log_transition
    - Ordem real no backend:
      1. Check `idempotency_key` na tabela `flow_events` (se existe → retorna cached, safe retry)
      2. Check `snapshot_version` via WHERE clause (se stale → rejeita com erro)
      3. UPDATE `atendimentos` SET `estado_painel`, `snapshot_version + 1` WHERE `snapshot_version = ctx.snapshotVersion`
      4. INSERT `flow_events` (mesma transação lógica — se update passou, log é garantido)
      5. Se 0 rows affected no UPDATE → lançar erro "Caso já foi atualizado — recarregando..."
    - Retornar `{ newVersion }` em caso de sucesso
    - Timeout de 5s no statement_timeout do Supabase (prevenir queries lentas/deadlocks)
    - _Requisitos: 19.1, 19.2, 19.4, 4.3, 23.2, 23.6_

  - [x]* 1.5 Escrever teste de propriedade para Reject-on-Stale
    - **Property 14: Reject-on-Stale Concurrency**
    - Para qualquer transição onde `ctx.snapshotVersion` não corresponde à versão atual no banco, o efeito `applyTransaction` deve falhar
    - Nenhuma mutação de estado deve ocorrer no backend quando a versão é stale
    - Nenhum flow_event deve ser inserido quando a versão é stale
    - Usar mock de Supabase que simula version mismatch
    - **Valida: Requisitos 19.2, 19.4**

  - [x] 1.6 Implementar timeout de backend na migration
    - Adicionar `statement_timeout` de 5000ms nas queries de transição (via Supabase client options ou SET LOCAL)
    - Garantir que queries lentas, locks ou deadlocks não travem o orchestrator indefinidamente
    - Se timeout excedido → Supabase retorna erro que o orchestrator trata como falha crítica
    - _Requisitos: 22.4_

  - [x]* 1.7 Escrever teste de propriedade para Transition Idempotence (backend)
    - **Property 7: Transition Idempotence**
    - Executar mesma transição 2x com mesmo `idempotency_key` → segunda execução não duplica registro
    - Usar mock de Supabase que simula constraint violation
    - **Valida: Requisitos 2.6, 23.2, 23.6**

  - [x]* 1.8 Escrever teste de propriedade para Flow Events Round-Trip
    - **Property 10: Flow Events Round-Trip**
    - Para qualquer sequência de transições em um atendimento, ler `flow_events` em ordem cronológica deve reconstruir a sequência completa de ações
    - Verificar que `from_state`, `to_state`, `action` formam cadeia consistente
    - **Valida: Requisitos 4.6**

  - [x] 1.9 Checkpoint — Garantir que migração SQL e efeitos de backend estão corretos
    - Ensure all tests pass, ask the user if questions arise.

- [-] 2. 🟠 FASE 2 — Orchestrator Local (sem socket)
  - Objetivo: Fluxo funcional para um único usuário, sem sincronização multi-operador
  - Entregáveis: FlowOrchestrator, TransitionMap, NextActionResolver, tipos, hook
  - _Requisitos: 1.1–1.8, 2.1–2.6, 3.1–3.13_

  - [x] 2.1 Criar arquivo de tipos `web/core/flow/types.ts` (complementar 1.2)
    - Definir todos os tipos: `EstadoPainel`, `FlowAction`, `FlowEffectType`, `ToastVariant`, `TransitionStatus`, `Confidence`, `ActionType`
    - Definir interfaces: `FlowContext`, `Transition`, `FlowTransitionResult`, `NextActionContext`, `FlowServices`, `FlowEventInput`, `ActionToastProps`
    - Referência completa: seção "Tipos Compartilhados" do design
    - _Requisitos: 1.1, 2.3_

  - [x] 2.2 Implementar `TRANSITION_MAP` em `web/core/flow/transitions.ts`
    - Criar constante `TRANSITION_MAP` com tipo `Record<EstadoPainel, Partial<Record<FlowAction, Transition>>>`
    - Definir todas as 7 transições com efeitos na ordem formal padrão
    - Implementar `CLASSIFICAR_ENCERRADO` como variante separada
    - Implementar `resolveClassificarTransition(destino)` para resolver destino dinâmico
    - Referência completa: seção "Transition Map" do design
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.3 Escrever teste de propriedade para Transition Map Structural Completeness
    - **Property 6: Transition Map Structural Completeness**
    - Para toda entrada no `TRANSITION_MAP`, verificar campos obrigatórios: `toState` (EstadoPainel válido), `effects` (array não-vazio), `toastMessage` (string não-vazia), `toastVariant` (um de success/info/celebration)
    - **Valida: Requisitos 2.3**

  - [ ] 2.4 Implementar efeitos restantes em `web/core/flow/effects/`
    - `deriveStatus.ts` — calcula `status_caso` + `status_motivo` via `journeyModel`
    - `emitSocket.ts` — emite evento via Socket.io (stub nesta fase, funcional na Fase 3)
    - `refetch.ts` — dispara refetch do contexto
    - `autoSelect.ts` — seleciona próximo caso na sidebar
    - `toastDestino.ts` — exibe toast com navegação
    - `suggestTemplate.ts` — sugere template de mensagem
    - `celebrate.ts` — animação de celebração
    - `index.ts` — re-export de todos os executores
    - _Requisitos: 1.3, 1.4, 8.1, 5.1, 13.1_

  - [x] 2.5 Implementar `FlowOrchestrator` em `web/core/flow/FlowOrchestrator.ts`
    - Classe com construtor que recebe `FlowServices` injetados
    - Método `run(action, ctx)` com: snapshot imutável, lookup no mapa, execução sequencial de efeitos
    - Timeout de 5000ms para execução completa
    - Efeitos críticos (`update_state`, `derive_status`, `emit_socket`) abortam cadeia se falham
    - Efeitos de UI (`toast_destino`, `auto_select`, `celebrate`) em try-catch individual
    - Event queue para enfileirar ações durante execução
    - Tracking de `TransitionStatus`: stable → transitioning → stable/failed
    - Referência completa: seção "FlowOrchestrator" do design
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x]* 2.6 Escrever teste de propriedade para Snapshot Integrity
    - **Property 1: Snapshot Integrity**
    - Para qualquer `FlowContext` passado a `flow.run()`, o snapshot criado antes da execução de efeitos deve permanecer inalterado independente de mutações no objeto original
    - Mutar `ctx` durante execução → snapshot não é afetado
    - **Valida: Requisitos 1.2**

  - [x]* 2.7 Escrever teste de propriedade para Effect Execution Order
    - **Property 2: Effect Execution Order**
    - Para qualquer transição no `TRANSITION_MAP`, os efeitos devem ser executados na ordem exata declarada no array `effects`
    - A ordem deve respeitar a ordem formal padrão
    - Usar mock de serviços que registra ordem de chamadas
    - **Valida: Requisitos 1.3, 2.4**

  - [x]* 2.8 Escrever teste de propriedade para Error Handling Atomicity
    - **Property 3: Error Handling Atomicity**
    - Se efeito crítico falha na posição N, nenhum efeito na posição > N deve ser executado
    - Se efeito não-crítico falha, os efeitos restantes devem continuar
    - **Valida: Requisitos 1.4**

  - [x]* 2.9 Escrever teste de propriedade para Invalid Transition Safety
    - **Property 4: Invalid Transition Safety**
    - Para qualquer par `(state, action)` NÃO definido no `TRANSITION_MAP`, `flow.run()` deve executar zero efeitos e retornar `status: 'stable'`
    - Usar `arbInvalidTransition` generator
    - **Valida: Requisitos 1.5, 2.5**

  - [x]* 2.10 Escrever teste de propriedade para Execution Determinism
    - **Property 5: Execution Determinism**
    - Para qualquer `FlowAction` e `FlowContext`, executar `flow.run()` 2x com inputs idênticos deve produzir mesma sequência de efeitos e mesmo `idempotency_key`
    - **Valida: Requisitos 1.8**

  - [x] 2.11 Implementar `resolveNextAction` em `web/core/flow/nextAction.ts`
    - Função pura que retorna `NextActionContext` baseado em `(state, stage, ctx)`
    - Cobrir todos os estados: `triagem`, `em_atendimento`, `cliente`, `encerrado`
    - Implementar lógica de follow-up (>24h sem resposta)
    - Implementar lógica de bloqueio (caso de outro operador)
    - Implementar fallback para dados incompletos (`confidence: 'low'`)
    - Integrar com `getNextStep()` do `businessStateMachine.ts`
    - Referência completa: seção "Next Action Resolver" do design
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_

  - [x]* 2.12 Escrever teste de propriedade para Next Action Resolver Completeness
    - **Property 8: Next Action Resolver Completeness**
    - Para todas as combinações válidas de `(state, stage)`, `resolveNextAction` deve retornar resultado não-nulo
    - Garantir que o Cockpit sempre tem sugestão de próximo passo
    - **Valida: Requisitos 3.8**

  - [x]* 2.13 Escrever teste de propriedade para Next Action Resolver Purity
    - **Property 9: Next Action Resolver Purity**
    - Para quaisquer inputs `(state, stage, ctx)`, chamar `resolveNextAction` múltiplas vezes com argumentos idênticos deve retornar resultados estruturalmente idênticos
    - Zero efeitos colaterais
    - **Valida: Requisitos 3.9**

  - [x] 2.14 Implementar hook `useFlowOrchestrator` em `web/hooks/useFlowOrchestrator.ts`
    - Hook que instancia `FlowOrchestrator` com serviços reais (Supabase, Socket.io, toast, etc.)
    - Expor `{ flow, status, run }` para consumo nos componentes
    - Lazy init do orchestrator via `useRef`
    - Tracking de `TransitionStatus` via `useState`
    - Referência completa: seção "useFlowOrchestrator" do design
    - _Requisitos: 1.1, 1.7_

  - [ ] 2.15 Checkpoint — Garantir que orchestrator local funciona end-to-end com mocks
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. 🟡 FASE 3 — Sync Multi-Operador
  - Objetivo: Consistência distribuída entre múltiplos operadores via Socket.io
  - Entregáveis: broadcast de `estado_painel_changed`, reconciliação client-side, event queue durante transição
  - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 15.1, 15.2, 15.3, 15.4, 19.3, 19.4, 19.5_

  - [ ] 3.1 Ativar efeito `emitSocket` real em `web/core/flow/effects/emitSocket.ts`
    - Substituir stub da Fase 2 por implementação real via Socket.io
    - Emitir `estado_painel_changed` com `{ identity_id, lead_id, estado_painel, transition_id }`
    - Emitir `lead_reaquecido` adicionalmente quando transição é `encerrado → triagem`
    - Emitir `assignment_updated` para mudanças de responsável
    - Fallback: se socket desconectado, agendar `refetch` após 2 segundos
    - _Requisitos: 15.1, 15.2, 15.4_

  - [ ] 3.2 Implementar reconciliação client-side em `web/hooks/usePainelContext.ts`
    - Adicionar `snapshotVersion` ao retorno do hook (buscar `snapshot_version` do atendimento)
    - Listener para `estado_painel_changed` → verificar `event.snapshot_version > current.snapshotVersion` antes de processar (ignorar eventos stale)
    - Listener para `estado_painel_changed` → executar `refetch()` em até 500ms (se versão é mais recente)
    - Listener para `status_negocio_changed` → atualizar estágio no StageTimeline
    - Listener para `assignment_updated` → atualizar responsável no BlocoDelegacao
    - Debounce de 300ms para evitar múltiplos refetch simultâneos
    - Preservar estado de formulários em edição durante refetch
    - Regra: `if (event.snapshot_version <= current.snapshotVersion) return` — ignorar eventos fora de ordem
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 19.1_

  - [ ] 3.3 Implementar event queue no FlowOrchestrator
    - Quando Socket_Evento chega durante execução de transição → enfileirar
    - Processar eventos enfileirados somente após conclusão da transição atual
    - Deduplicar eventos por `transition_id` (ignorar duplicatas)
    - _Requisitos: 19.5, 23.4_

  - [ ] 3.4 Implementar proteção contra double-click nos componentes
    - Desabilitar botões de ação imediatamente ao clicar (antes de `flow.run()`)
    - Re-habilitar após transição completar (stable ou failed)
    - Usar `status` do `useFlowOrchestrator` para controlar estado dos botões
    - _Requisitos: 19.6, 23.3_

  - [ ]* 3.5 Escrever teste de integração para concorrência multi-operador
    - **Property 14: Reject-on-Stale (integração)**
    - Simular 2 operadores tentando transicionar o mesmo caso simultaneamente
    - Primeiro operador ganha, segundo recebe erro e faz refetch
    - Verificar que apenas 1 transição é aplicada no backend
    - **Valida: Requisitos 19.2, 19.4**

  - [ ] 3.6 Checkpoint — Garantir que sync multi-operador funciona com socket real
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. 🟢 FASE 4 — UX Contínua
  - Objetivo: Eliminar limbos — operador nunca fica sem saber o que fazer
  - Entregáveis: ActionToast, IndicadorProximoPasso, BlocoDelegacao, estados de transição na UI, auto-select, micro-interações, refactor PainelLead
  - _Requisitos: 5.1–5.7, 6.1–6.4, 7.1–7.4, 8.1–8.5, 9.1–9.7, 12.1–12.5, 13.1–13.5, 14.1–14.4, 16.1–16.5, 17.1–17.4, 18.1–18.8, 20.1–20.7_

  - [ ] 4.1 Implementar componente `ActionToast` em `web/components/ui/ActionToast.tsx`
    - Componente React reutilizável com props: `message`, `actionLabel`, `onAction`, `duration`, `variant`, `onDismiss`
    - Variantes visuais: `success` (borda verde), `info` (borda cinza), `celebration` (fundo verde + pulse)
    - Posicionamento: canto inferior direito, empilhável
    - Auto-dismiss por timeout configurável (padrão 5000ms)
    - Botão de fechar (✕) e botão de ação opcional
    - Acessibilidade: `role="alert"`, navegável por teclado (Tab + Enter)
    - Animação de saída (fade-out + slide-down, 200ms)
    - Referência completa: seção "ActionToast" do design
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 4.2 Implementar componente `IndicadorProximoPasso` em `web/app/(dashboard)/tela1/components/IndicadorProximoPasso.tsx`
    - Consumir `resolveNextAction` com `estado_painel`, `status_negocio` e contexto do caso
    - Exibir: badge de tipo (Auto/Ação/Bloqueado), label da ação, descrição
    - Estilos por confidence: `high` (azul), `medium` (amarelo), `low` (cinza)
    - Click → scroll suave até seção de ação correspondente
    - Quando `type === 'blocked'` → exibir motivo e ação de desbloqueio
    - Quando resultado é null → exibir "Caso arquivado"
    - Posicionar acima dos botões de ação no Cockpit, com fundo `bg-blue-50`
    - Referência completa: seção "IndicadorProximoPasso" do design
    - _Requisitos: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 4.3 Implementar componente `BlocoDelegacao` em `web/app/(dashboard)/tela1/components/BlocoDelegacao.tsx`
    - Renderizar dentro da seção de contexto (identidade) do Cockpit
    - Sem responsável → botão "Assumir caso"
    - Responsável diferente → nome + botão "Transferir"
    - Operador atual é responsável → "Você" com badge azul + botão "Transferir"
    - Auto-assume: ao abrir caso sem responsável, assumir automaticamente
    - Emitir `assignment_updated` via Socket.io após auto-assunção
    - Referência completa: seção "BlocoDelegacao" do design
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 4.4 Implementar estados de transição na UI do Cockpit
    - `stable` → botões habilitados, sem loading
    - `transitioning` → botões desabilitados, loading indicator inline
    - `failed` → mensagem de erro + botão "Tentar novamente"
    - `ambiguous` → mensagem "Revisar caso" com dados faltantes
    - Feedback visual por faixa de tempo: <100ms nenhum, 100-500ms skeleton, 500-5000ms spinner, >5000ms failed
    - Atualizar UI imediatamente quando `TransitionStatus` muda
    - _Requisitos: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 22.1, 22.2, 22.3, 22.4_

  - [ ] 4.5 Implementar auto-select em `web/app/(dashboard)/tela1/components/ConversasSidebar.tsx`
    - Callback `autoSelect(excludeLeadId)` que seleciona próximo caso por `deriveGlobalPriority`
    - Se lista vazia → exibir "Nenhum caso pendente — bom trabalho 👏" com sugestão "Verificar outras telas"
    - Execução em até 300ms após remoção do caso
    - Se múltiplos casos → selecionar primeiro da lista ordenada (maior prioridade)
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 4.6 Escrever teste de propriedade para Auto-Select Picks Highest Priority
    - **Property 11: Auto-Select Picks Highest Priority**
    - Para qualquer lista não-vazia de casos ordenada por `deriveGlobalPriority`, `auto_select` deve selecionar o caso com maior prioridade
    - Se lista vazia → limpar seleção sem erro
    - **Valida: Requisitos 8.1, 8.4, 8.5**

  - [ ] 4.7 Implementar micro-interações de feedback
    - Card_Conversa: highlight (borda pulsante azul, 2s) quando status muda via Socket
    - Sidebar: auto-scroll suave até card de caso reativado
    - StageTimeline: animação de entrada (fade-in + slide, 300ms) no novo estágio
    - Botão salvar nota: checkmark verde por 1.5s após salvar
    - Usar CSS transitions/keyframes (200-500ms), sem bloquear interações
    - _Requisitos: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ] 4.8 Implementar toasts com destino para cada transição
    - `triagem + classificar → em_atendimento`: toast success "Caso movido para Execução" + "Ver agora →"
    - `triagem + classificar → encerrado`: toast info "Decisão encerrada" sem botão
    - `em_atendimento + fechar → cliente`: toast celebration "Caso fechado com sucesso 🎉" + "Ver financeiro →"
    - `em_atendimento + perder → encerrado`: toast info "Decisão encerrada" sem celebração
    - `encerrado + reativar → triagem`: toast info "Caso reativado" + "Ver na triagem →"
    - Callbacks de navegação: navegar para tela de destino com caso pré-selecionado
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

  - [ ] 4.9 Implementar ações encadeadas (suggest_template + celebrate)
    - Após classificação com destino backoffice → painel inline "Enviar mensagem de boas-vindas"
    - Aceitar sugestão → inserir template no ChatCentral
    - Rejeitar ("Pular") → prosseguir para auto_select
    - Timeout de 10s → descartar automaticamente
    - Celebração no fechamento: pulse verde no toast (1.5s)
    - _Requisitos: 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3, 14.4_

  - [ ] 4.10 Refatorar `PainelLead.tsx` para usar `flow.run()`
    - Substituir `handleConfirmar` → `flow.run('classificar', ctx)`
    - Substituir `handleAvancarStatus` → `flow.run('avancar_etapa', ctx)`
    - Substituir `handleFechamento` → `flow.run('fechar', ctx)`
    - Substituir `handleNaoFechou` → `flow.run('perder', ctx)`
    - Substituir `handleReengajar` → `flow.run('reativar', ctx)`
    - Substituir `handleNovoAtendimento` → `flow.run('novo_atendimento', ctx)`
    - Integrar `IndicadorProximoPasso` acima dos botões de ação
    - Integrar `BlocoDelegacao` na seção de contexto
    - ZERO lógica de transição direta nos handlers — tudo via orchestrator
    - _Requisitos: 1.7, 14.2, 18.1_

  - [ ]* 4.11 Escrever teste de propriedade para Display Time Maximum
    - **Property 12: Display Time Maximum**
    - Para qualquer par de timestamps `(ultima_msg_em, status_changed_at)`, o Display_Time efetivo deve ser `max(ultima_msg_em, status_changed_at)`
    - **Valida: Requisitos 10.4**

  - [ ]* 4.12 Escrever teste de propriedade para Continuity Invariant
    - **Property 13: Continuity Invariant**
    - Para todas as transições no `TRANSITION_MAP`, o array `effects` deve conter pelo menos um efeito de continuidade (`toast_destino` ou `auto_select`)
    - Garantir zero limbos por design
    - **Valida: Requisitos 18.1, 18.5**

  - [ ] 4.13 Implementar contexto unificado entre telas
    - Sidebar triagem e backoffice usam mesmo componente `ConversasSidebar` com filtro de `estado_painel` como prop
    - Cockpit mantém mesma estrutura de seções em todas as telas, usando `usePainelMode`
    - Preservar estado de busca/filtros ao retornar à tela anterior em até 30s
    - _Requisitos: 17.1, 17.2, 17.3, 17.4_

  - [ ] 4.14 Checkpoint — Garantir que UX contínua funciona sem limbos
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. 🔵 FASE 5 — Hardening
  - Objetivo: Prontidão para produção — retry, timeout, SLA, métricas, preservação de contexto
  - Entregáveis: política de retry, timeout enforcement, SLA monitoring, consumidores de flow_events, display time reset, preservação de contexto
  - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5, 21.1–21.7, 22.1–22.7, 4.7, 4.8, 4.9_

  - [ ] 5.1 Implementar política de retry no FlowOrchestrator
    - Timeout de rede → retry automático 1x após 2 segundos
    - Erro 409 (conflict) → refetch automático + re-resolver transição
    - Erro 5xx → transição para `failed` com botão retry manual
    - Implementar método `retry()` que re-executa última transição falhada com contexto atualizado
    - Toast de erro: "Não foi possível [ação] — tente novamente"
    - Restaurar snapshot de UI quando transição falha
    - _Requisitos: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

  - [ ] 5.2 Implementar timeout enforcement e SLA monitoring
    - Timeout de 5000ms já implementado na Fase 2 — validar comportamento
    - Adicionar tracking de tempo por efeito individual
    - Warning no log quando tempo total > 3000ms com breakdown por efeito
    - Feedback visual por faixa: skeleton (100-500ms), spinner (500-5000ms), failed (>5000ms)
    - Manter interações de UI (scroll, busca, navegação) desbloqueadas durante loading
    - _Requisitos: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_

  - [ ] 5.3 Implementar consumidores de flow_events
    - `behaviorTracker`: integrar `trackEvent` para tracking de produtividade por operador
    - `dashboardMetrics`: expor dados de flow_events para métricas de gestão (tempo médio por transição, volume por ação)
    - `auditLog`: garantir que flow_events serve como log de compliance
    - Definir política de retenção: 90 dias operacional, archive após 90 dias
    - _Requisitos: 4.7, 4.8, 4.9_

  - [ ] 5.4 Implementar reset de Display Time
    - Reativação (`encerrado → triagem`) → atualizar `ultima_msg_em` para timestamp atual
    - Mudança de status_negocio → atualizar `ultima_msg_em` para timestamp da transição
    - Display_Time efetivo = `max(ultima_msg_em, status_changed_at)`
    - Sidebar usa `ultima_msg_em` como critério primário de ordenação (mais recente primeiro)
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 5.5 Implementar preservação de contexto entre telas
    - Preservar estado de formulários em edição durante refetch (campo de observação, seleção de tratamento, classificação jurídica)
    - Preservar estado de busca e filtros ao navegar entre telas (cache de 30s)
    - Garantir que regra de continuidade funciona: "sempre tem próximo passo OU motivo explícito de bloqueio/espera"
    - Estado `waiting` para casos aguardando input externo com tempo estimado
    - _Requisitos: 11.4, 17.4, 18.6, 18.7, 18.8_

  - [ ]* 5.6 Escrever testes de integração para SLA e métricas
    - Testar que transições lentas (>3s) geram warning no log
    - Testar que timeout (>5s) transiciona para `failed`
    - Testar que flow_events são consumidos por behaviorTracker
    - Testar que Display Time é calculado corretamente
    - _Requisitos: 22.5, 22.6, 4.7_

  - [ ] 5.7 Checkpoint final — Garantir que sistema está pronto para produção
    - Ensure all tests pass, ask the user if questions arise.
    - Verificar que ZERO lógica de transição existe fora do FlowOrchestrator
    - Verificar que todas as transições do Transition_Map estão cobertas por testes
    - Verificar que anti-patterns listados no design não estão presentes no código

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada fase depende da anterior estar completa — NÃO pular fases
- Cada task referencia requisitos específicos para rastreabilidade
- Testes de propriedade validam invariantes universais definidos no design
- Testes unitários e de integração validam cenários específicos e edge cases
- Checkpoints garantem validação incremental entre fases
- A ordem formal de efeitos DEVE ser respeitada: `log_transition → update_state → derive_status → emit_socket → refetch → auto_select → toast_destino → suggest_template → celebrate`
