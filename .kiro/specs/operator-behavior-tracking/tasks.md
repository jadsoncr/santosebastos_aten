# Plano de Implementação: Operator Behavior Tracking

## Visão Geral

Implementação incremental de uma camada de instrumentação invisível que registra 4 eventos de comportamento do operador em relação a leads críticos. A abordagem segue a ordem: migração SQL → funções puras → testes PBT → integração Supabase → modificação de hook → modificação de componente → testes de regressão.

## Tarefas

- [x] 1. Criar migração SQL e tabela de eventos comportamentais
  - Criar arquivo `sql/migrations/027_behavior_events.sql`
  - Criar tabela `lead_behavior_events` com colunas: `id` (UUID PK, default `gen_random_uuid()`), `lead_id` (UUID), `user_id` (UUID), `event_type` (TEXT NOT NULL), `metadata` (JSONB DEFAULT '{}'), `created_at` (TIMESTAMPTZ DEFAULT now())
  - Criar índice composto `idx_behavior_events_type_created` em `(event_type, created_at)`
  - Sem foreign keys — tabela append-only para analytics
  - _Requisitos: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Implementar funções puras e trackEvent no behaviorTracker.ts
  - [x] 2.1 Criar `web/utils/behaviorTracker.ts` com interface `TrackEventParams` e funções puras
    - Definir interface `TrackEventParams` com `lead_id`, `user_id`, `event_type` (union type dos 4 eventos), `metadata` opcional
    - Implementar `resolveLeadSelectEvents(params)` — retorna array de `TrackEventParams` para o click handler (lógica de `lead_opened`, `ignored_critical`, `time_to_action`)
    - Implementar `resolveBecameCriticalEvents(params)` — retorna array de `TrackEventParams` para transições de criticidade
    - Implementar `calculatePrioritizationRate(correct, ignored)` — retorna `number | null`
    - Todas as funções puras aceitam parâmetro `now?: number` para testes determinísticos
    - _Requisitos: 2.1, 2.5, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 6.3, 8.2_

  - [x] 2.2 Implementar função `trackEvent` com integração Supabase fire-and-forget
    - Usar `createClient()` de `@/utils/supabase/client` dentro da função
    - Insert assíncrono com `.then(() => {}).catch(() => {})` — retorna `void`, não `Promise<void>`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Checkpoint — Validar funções puras
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 3.1 Escrever teste de propriedade para Property 1: Um became_critical por transição
    - **Property 1: Um evento `became_critical` por lead que transiciona**
    - Gerar arrays aleatórios de IDs + leads com timestamps aleatórios via fast-check
    - Verificar que `resolveBecameCriticalEvents` retorna exatamente um evento por ID em `newCriticalIds`
    - Usar imports relativos no arquivo de teste (sem path aliases)
    - **Valida: Requisitos 3.1, 3.5**

- [ ]* 3.2 Escrever teste de propriedade para Property 2: Metadata correta no became_critical
    - **Property 2: Metadata correta no evento `became_critical`**
    - Gerar leads com `ultima_msg_em` e `classificacao` aleatórios
    - Verificar `elapsed_minutes` = `Math.floor((now - Date.parse(ultima_msg_em)) / 60000)` e `stage` correto
    - **Valida: Requisitos 3.2**

- [ ]* 3.3 Escrever teste de propriedade para Property 3: lead_opened com metadata correta
    - **Property 3: Evento `lead_opened` com metadata correta para qualquer lead selecionado**
    - Gerar leads com urgência aleatória, listas de tamanho variável, posições variáveis
    - Verificar que exatamente um `lead_opened` é retornado com `was_critical`, `time_since_critical`, `position_in_queue` corretos
    - **Valida: Requisitos 4.1, 4.2, 4.4**

- [ ]* 3.4 Escrever teste de propriedade para Property 4: ignored_critical condicional
    - **Property 4: Evento `ignored_critical` disparado condicionalmente com metadata correta**
    - Gerar combinações de lead crítico/não-crítico + listas críticas vazias/não-vazias
    - Verificar presença/ausência condicional do evento e metadata (`critical_count`, `opened_lead_id`, `critical_lead_ids`)
    - **Valida: Requisitos 5.1, 5.2, 5.3**

- [ ]* 3.5 Escrever teste de propriedade para Property 5: time_to_action condicional
    - **Property 5: Evento `time_to_action` disparado condicionalmente com metadata correta**
    - Gerar leads críticos/não-críticos com timestamps aleatórios
    - Verificar presença/ausência condicional e `seconds` = `Math.floor((now - Date.parse(ultima_msg_em)) / 1000)`
    - **Valida: Requisitos 6.1, 6.2, 6.3, 6.4**

- [ ]* 3.6 Escrever teste de propriedade para Property 6: Fórmula de priorização
    - **Property 6: Fórmula de taxa de priorização**
    - Gerar pares de inteiros não-negativos via `fc.nat()`
    - Verificar `calculatePrioritizationRate(correct, ignored)` = `correct / (correct + ignored)` quando soma > 0, `null` quando ambos zero
    - **Valida: Requisitos 8.2**

- [x] 4. Modificar useCriticalAlert para aceitar userId e disparar became_critical
  - Alterar assinatura de `useCriticalAlert(leads)` para `useCriticalAlert(leads, userId?)`
  - Após detecção de `newCriticalIds` (dentro do useEffect existente), adicionar loop que chama `trackEvent` para cada novo ID crítico
  - Usar `resolveBecameCriticalEvents` para gerar os eventos e iterar chamando `trackEvent`
  - Manter lógica de som e detecção de transição inalterada
  - Import de `trackEvent` e `resolveBecameCriticalEvents` de `@/utils/behaviorTracker`
  - _Requisitos: 3.1, 3.3, 3.4, 3.5, 7.3_

- [x] 5. Modificar ConversasSidebar para instrumentar onClick com eventos de comportamento
  - [x] 5.1 Atualizar chamada do `useCriticalAlert` para passar `operadorId`
    - Alterar `useCriticalAlert(prioritizedLeads)` para `useCriticalAlert(prioritizedLeads, operadorId)`
    - _Requisitos: 3.4, 7.2_

  - [x] 5.2 Adicionar instrumentação no handler onClick do botão de lead
    - Após `onSelectLead(lead)`, adicionar bloco de instrumentação dentro de guard `if (operadorId)`
    - Usar `resolveLeadSelectEvents` para gerar array de eventos
    - Iterar sobre eventos retornados chamando `trackEvent` para cada um
    - Usar `getUrgencyStyle` existente para determinar criticidade do lead selecionado
    - Usar `criticalLeads` e `nonCriticalLeads` do useMemo existente para contexto
    - Import de `trackEvent` e `resolveLeadSelectEvents` de `@/utils/behaviorTracker`
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.4, 7.5, 7.6_

- [x] 6. Checkpoint final — Validar integração completa
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 6.1 Escrever testes unitários para trackEvent e integração
    - Testar que `trackEvent` chama Supabase insert com parâmetros corretos (mock do createClient)
    - Testar que `trackEvent` retorna `void` (não Promise)
    - Testar que rejeição do Supabase não propaga erro (edge case)
    - Testar que `useCriticalAlert` sem `userId` não dispara eventos
    - Usar imports relativos no arquivo de teste
    - _Requisitos: 2.1, 2.2, 2.3, 3.4, 7.1, 7.3_

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude das funções puras
- Testes unitários validam exemplos específicos e edge cases de integração
- Todos os arquivos de teste devem usar imports RELATIVOS (sem path aliases como `@/`)
