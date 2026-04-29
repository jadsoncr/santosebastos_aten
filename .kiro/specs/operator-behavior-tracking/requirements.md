# Documento de Requisitos — Operator Behavior Tracking

## Introdução

O Operator Behavior Tracking é uma camada de instrumentação invisível que registra eventos de comportamento do operador em relação a leads críticos. O objetivo é medir se a camada de pressão comportamental (banner, separador, alerta sonoro) está efetivamente fazendo os operadores priorizarem leads críticos — ou se estão ignorando-os.

A instrumentação captura 4 eventos-chave:
1. **became_critical** — quando um lead transiciona para estado crítico
2. **lead_opened** — quando o operador clica/seleciona um lead
3. **ignored_critical** — quando o operador abre um lead NÃO-crítico enquanto existem leads críticos na fila
4. **time_to_action** — tempo entre o lead se tornar crítico e o operador abri-lo

A métrica principal derivada desses eventos é: **% de leads críticos atendidos primeiro** = `correct / (correct + ignored)`, com meta de >90%.

**Restrições fundamentais**:
- Logging é 100% assíncrono — NUNCA bloqueia a UI para escrita no banco
- Tolerante a falhas — `.catch(() => {})` em todos os inserts
- ZERO alterações no fluxo de dados existente, queries ou UI
- Usa o cliente Supabase existente (`createClient()` de `@/utils/supabase/client`)
- Usa `getUrgencyStyle()` existente para detecção de criticidade
- Usa `splitLeads()` existente de `criticalPressure.ts`

## Glossário

- **BehaviorTracker**: Módulo utilitário em `web/utils/behaviorTracker.ts` responsável por enviar eventos de comportamento ao banco de dados de forma assíncrona e tolerante a falhas
- **lead_behavior_events**: Tabela PostgreSQL no Supabase que armazena todos os eventos de comportamento do operador (id UUID PK, lead_id UUID, user_id UUID, event_type TEXT, metadata JSONB, created_at TIMESTAMP)
- **ConversasSidebar**: Componente React que renderiza a lista lateral de conversas na tela1 (`web/app/(dashboard)/tela1/components/ConversasSidebar.tsx`)
- **useCriticalAlert**: Hook React em `web/hooks/useCriticalAlert.ts` que detecta transições de leads para estado crítico e dispara alerta sonoro
- **Operador**: Usuário autenticado do sistema que atende leads via a interface de conversas
- **Lead_Crítico**: Lead cujo `getUrgencyStyle()` retorna `level === 'critical'` (prazo vencido OU cliente aguardando >30min sem resposta)
- **splitLeads**: Função pura em `web/utils/criticalPressure.ts` que particiona leads em `criticalLeads` e `nonCriticalLeads`
- **getUrgencyStyle**: Função pura em `web/utils/urgencyColors.ts` que retorna o nível de urgência de um lead
- **Supabase_Client**: Cliente Supabase criado via `createClient()` de `@/utils/supabase/client`, já configurado no projeto
- **Evento_Comportamental**: Registro na tabela `lead_behavior_events` contendo tipo do evento, metadados JSONB e timestamps

## Requisitos

### Requisito 1: Tabela de Eventos Comportamentais no Banco de Dados

**User Story:** Como analista de operações, eu quero que os eventos de comportamento do operador sejam persistidos em uma tabela dedicada no banco de dados, para que eu possa consultar métricas de priorização de leads críticos.

#### Critérios de Aceitação

1. THE lead_behavior_events SHALL armazenar registros com as colunas: `id` (UUID, chave primária, default `gen_random_uuid()`), `lead_id` (UUID), `user_id` (UUID), `event_type` (TEXT), `metadata` (JSONB), `created_at` (TIMESTAMPTZ, default `now()`)
2. THE lead_behavior_events SHALL aceitar os valores de `event_type`: `became_critical`, `lead_opened`, `ignored_critical`, `time_to_action`
3. THE lead_behavior_events SHALL ter um índice em `event_type` e `created_at` para otimizar consultas de métricas diárias
4. THE lead_behavior_events SHALL ser criada via arquivo de migração em `sql/migrations/027_behavior_events.sql`

### Requisito 2: Módulo Utilitário de Tracking Assíncrono

**User Story:** Como desenvolvedor, eu quero um módulo utilitário centralizado para enviar eventos de comportamento ao banco, para que todos os pontos de instrumentação usem a mesma lógica de escrita assíncrona e tolerante a falhas.

#### Critérios de Aceitação

1. THE BehaviorTracker SHALL expor uma função `trackEvent(params)` que aceita `lead_id` (string), `user_id` (string), `event_type` (string) e `metadata` (objeto JSON)
2. THE BehaviorTracker SHALL executar o insert no Supabase de forma assíncrona sem usar `await` no ponto de chamada, garantindo que a UI nunca seja bloqueada
3. IF o insert no Supabase falhar, THEN THE BehaviorTracker SHALL capturar o erro silenciosamente via `.catch(() => {})` sem exibir erros ao operador e sem interromper o fluxo da aplicação
4. THE BehaviorTracker SHALL usar o cliente Supabase existente via `createClient()` de `@/utils/supabase/client`
5. THE BehaviorTracker SHALL residir em `web/utils/behaviorTracker.ts`

### Requisito 3: Evento became_critical na Transição para Estado Crítico

**User Story:** Como analista de operações, eu quero registrar o momento exato em que um lead entra em estado crítico, para que eu possa medir o tempo de reação do operador a partir desse ponto.

#### Critérios de Aceitação

1. WHEN um lead transicionar para Nível_Crítico (detectado pelo useCriticalAlert), THE BehaviorTracker SHALL registrar um evento `became_critical` com `lead_id` do lead que transicionou
2. THE evento `became_critical` SHALL incluir no metadata: `elapsed_minutes` (número de minutos desde a última mensagem do cliente) e `stage` (valor `classificacao` ou `atendimento` conforme o estágio do lead)
3. THE useCriticalAlert SHALL disparar o evento `became_critical` usando a mesma detecção de transição já existente (comparação de conjuntos de IDs críticos via `detectNewCriticalIds`), sem duplicar lógica
4. THE useCriticalAlert SHALL receber o `user_id` do operador logado como parâmetro para incluir no evento
5. THE useCriticalAlert SHALL disparar um evento `became_critical` para cada lead que transicionar individualmente, quando múltiplos leads transicionarem simultaneamente

### Requisito 4: Evento lead_opened na Seleção de Lead

**User Story:** Como analista de operações, eu quero registrar cada vez que o operador abre um lead, incluindo se o lead era crítico e sua posição na fila, para que eu possa analisar padrões de seleção.

#### Critérios de Aceitação

1. WHEN o operador clicar em um lead no ConversasSidebar (callback `onSelectLead`), THE BehaviorTracker SHALL registrar um evento `lead_opened` com o `lead_id` do lead selecionado
2. THE evento `lead_opened` SHALL incluir no metadata: `was_critical` (booleano indicando se o lead selecionado é Lead_Crítico), `time_since_critical` (segundos desde que o lead se tornou crítico, ou 0 se não era crítico), `position_in_queue` (posição numérica do lead na lista renderizada)
3. THE ConversasSidebar SHALL calcular `was_critical` usando `getUrgencyStyle()` como fonte de verdade, sem duplicar lógica de urgência
4. THE ConversasSidebar SHALL calcular `position_in_queue` baseado na posição do lead na lista combinada (criticalLeads + nonCriticalLeads)

### Requisito 5: Evento ignored_critical Quando Operador Ignora Leads Críticos

**User Story:** Como analista de operações, eu quero registrar quando o operador abre um lead não-crítico enquanto existem leads críticos na fila, para que eu possa medir a taxa de "ignorar" leads urgentes.

#### Critérios de Aceitação

1. WHEN o operador selecionar um lead NÃO-crítico E existirem leads críticos na fila, THE BehaviorTracker SHALL registrar um evento `ignored_critical`
2. THE evento `ignored_critical` SHALL incluir no metadata: `critical_count` (número de leads críticos na fila no momento), `opened_lead_id` (ID do lead não-crítico que foi aberto), `critical_lead_ids` (array de IDs dos leads críticos que foram ignorados)
3. WHILE a lista de `criticalLeads` estiver vazia, THE BehaviorTracker SHALL omitir o evento `ignored_critical` mesmo que o lead selecionado seja não-crítico
4. THE ConversasSidebar SHALL usar a lista `criticalLeads` já calculada pelo `useMemo` existente (via `splitLeads`) para determinar se existem leads críticos, sem recalcular

### Requisito 6: Evento time_to_action no Tempo de Reação

**User Story:** Como analista de operações, eu quero medir o tempo entre um lead se tornar crítico e o operador abri-lo, para que eu possa avaliar a velocidade de reação da equipe.

#### Critérios de Aceitação

1. WHEN o operador abrir um Lead_Crítico, THE BehaviorTracker SHALL registrar um evento `time_to_action` com o `lead_id` do lead aberto
2. THE evento `time_to_action` SHALL incluir no metadata: `seconds` (número de segundos desde que o lead se tornou crítico até o momento da abertura) e `was_critical` (sempre `true` para este evento)
3. THE BehaviorTracker SHALL calcular `seconds` usando a diferença entre `Date.now()` e o timestamp da última mensagem do cliente (`ultima_msg_em`) do lead, convertida para segundos
4. WHILE o lead selecionado for não-crítico, THE BehaviorTracker SHALL omitir o evento `time_to_action`

### Requisito 7: Integridade do Sistema Existente

**User Story:** Como desenvolvedor, eu quero garantir que a instrumentação de tracking seja completamente invisível e não afete nenhuma funcionalidade existente do sistema.

#### Critérios de Aceitação

1. THE instrumentação SHALL executar todas as escritas no banco de forma assíncrona (fire-and-forget), sem usar `await` no fluxo principal da UI
2. THE instrumentação SHALL manter todos os socket handlers, filtros, ordenação, busca e modal de novo contato do ConversasSidebar inalterados
3. THE instrumentação SHALL manter a lógica de detecção de transição e reprodução de som do useCriticalAlert inalterada
4. THE instrumentação SHALL não adicionar nenhum elemento visual, indicador ou feedback ao operador — a instrumentação é completamente invisível
5. THE instrumentação SHALL usar exclusivamente `getUrgencyStyle()` e `splitLeads()` existentes como fontes de verdade para criticidade, sem duplicar ou criar lógica alternativa de urgência
6. THE instrumentação SHALL não modificar queries existentes, estado do React, props de componentes ou fluxo de dados entre componentes

### Requisito 8: Consulta de Métrica Diária de Priorização

**User Story:** Como analista de operações, eu quero executar uma consulta SQL que retorne a taxa diária de priorização correta de leads críticos, para que eu possa acompanhar se a meta de >90% está sendo atingida.

#### Critérios de Aceitação

1. THE lead_behavior_events SHALL suportar a consulta de métrica diária que conta eventos `lead_opened` com `metadata->>'was_critical' = 'true'` como "corretos" e eventos `ignored_critical` como "ignorados"
2. THE métrica de priorização SHALL ser calculada como `correct / (correct + ignored)` onde `correct` é a contagem de `lead_opened` com `was_critical = true` e `ignored` é a contagem de `ignored_critical`, filtrados por `created_at >= NOW() - INTERVAL '1 day'`
3. THE estrutura de metadata dos eventos `lead_opened` e `ignored_critical` SHALL ser consistente e indexável via operadores JSONB do PostgreSQL
