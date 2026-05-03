# Documento de Requisitos — Continuous Flow UX

## Introdução

Transformação arquitetural da experiência do operador: de um sistema de "navegação por telas" para um sistema de "fluxo contínuo de operação". O problema central é que hoje o operador executa uma ação, o sistema muda de estado, e o operador precisa descobrir sozinho o próximo passo. O modelo correto é: ação → sistema reage → sistema sugere/conduz → operador continua.

Este documento especifica os requisitos em duas camadas:

1. **Camada de Orquestração** (Requisitos 1–4): Motor de fluxo, mapa de transições, resolvedor de próximo passo e log semântico — a infraestrutura que garante consistência, atomicidade e observabilidade.
2. **Camada de Experiência** (Requisitos 5–18): Toasts, auto-seleção, delegação, micro-interações e continuidade — os comportamentos visíveis ao operador, todos orquestrados pela Camada 1.

**Regra fundamental**: NUNCA deixar o operador sem próximo passo.
**Regra arquitetural**: TODA ação passa pelo orquestrador — ZERO lógica de transição direta nos handlers de componente. ZERO mutação de estado fora do Flow_Orchestrator.

## Glossário

- **Flow_Orchestrator**: Módulo central (`web/core/flow/FlowOrchestrator.ts`) que recebe uma ação e um contexto, cria um snapshot imutável do contexto, resolve a transição correspondente no Transition_Map, e executa os efeitos em ordem com garantia de atomicidade. Ponto único de controle para todas as transições de estado do sistema.
- **Transition_Map**: Estrutura de dados declarativa (`web/core/flow/transitions.ts`) que mapeia cada combinação `(estado_atual, ação)` para `(estado_destino, efeitos[])`. Fonte única de verdade para todas as transições válidas do sistema.
- **Next_Action_Resolver**: Função pura (`web/core/flow/nextAction.ts`) que dado um estado de painel, estágio atual e contexto do caso, retorna `{ action, label, destination, description }` — usado pelo Cockpit, Toast e navegação.
- **Flow_Event**: Registro semântico de uma transição executada pelo Flow_Orchestrator, armazenado na tabela `flow_events`. Diferente de `status_transitions` (técnico/etapa), o Flow_Event registra intenção do operador + contexto completo.
- **Flow_Effect**: Efeito colateral executado pelo Flow_Orchestrator após uma transição. Tipos: `log_transition`, `update_state`, `derive_status`, `emit_socket`, `refetch`, `auto_select`, `toast_destino`, `suggest_template`, `celebrate`.
- **Flow_Context**: Objeto que descreve o estado atual do caso para o Flow_Orchestrator: `{ atendimentoId, identityId, currentState, currentStage, operadorId }`. O orchestrator cria um snapshot imutável antes de executar efeitos.
- **Flow_Action**: Ação que dispara uma transição: `classificar`, `avancar_etapa`, `fechar`, `perder`, `reativar`, `delegar`, `novo_atendimento`.
- **Toast_Acao**: Notificação temporária (toast) que aparece após uma ação do operador, contendo texto descritivo e um botão clicável que navega para o destino relevante.
- **Cockpit**: O componente PainelLead que exibe o contexto completo do caso selecionado. Funciona como "motor de operação" — sempre respondendo: Onde estou? O que faço agora? O que acontece se eu fizer?
- **Sidebar**: O componente ConversasSidebar que exibe a lista de conversas.
- **Caso**: Uma entrada na tabela `atendimentos` representando um lead em atendimento, identificado por `identity_id`.
- **Operador**: Usuário autenticado que opera o painel.
- **Card_Conversa**: Item visual na Sidebar que representa um Caso.
- **Bloco_Delegacao**: Componente de delegação/assunção de responsabilidade posicionado dentro do bloco de contexto do Cockpit.
- **Indicador_Proximo_Passo**: Elemento visual no Cockpit que exibe a próxima ação recomendada, derivado do Next_Action_Resolver.
- **Acao_Encadeada**: Sequência de efeitos que o Flow_Orchestrator executa após a conclusão de uma ação primária.
- **Display_Time**: Timestamp usado para ordenar cards na Sidebar, calculado como `max(ultima_msg_em, status_changed_at)`.
- **Micro_Interacao**: Feedback visual sutil (highlight, scroll, animação) que confirma ao operador que uma ação teve efeito.
- **Limbo**: Estado em que o operador completou uma ação mas não tem visibilidade do resultado nem sugestão de próximo passo. O Flow_Orchestrator elimina limbos por design.
- **Estado_Painel**: Campo que define em qual tela o caso aparece: `triagem`, `em_atendimento`, `cliente`, `encerrado`.
- **Socket_Evento**: Evento emitido via Socket.io para sincronização em tempo real entre operadores.
- **Snapshot_Version**: Número incremental que identifica a versão do estado de um Caso. Usado para optimistic locking — se a version mudou entre leitura e escrita, a transição é rejeitada.
- **Idempotency_Key**: Hash único derivado de `(action, atendimento_id, snapshot_version)` que garante que a mesma transição não é executada duas vezes.
- **Transition_Status**: Estado de execução de uma transição: `pending` (iniciada), `applied` (sucesso), `failed` (erro). Visível ao operador via estados de UI.
- **Conflict_Policy**: Estratégia de resolução quando dois operadores tentam transicionar o mesmo Caso simultaneamente: reject-on-stale (primeiro ganha, segundo refetch).

## Contrato de Execução

```typescript
type FlowTransition = {
  transition_id: string        // uuid v4
  idempotency_key: string      // hash(action + atendimento_id + snapshot_version)
  snapshot_version: number     // optimistic lock version
  
  action: Flow_Action
  from_state: Estado_Painel
  to_state: Estado_Painel
  
  effects: Flow_Effect[]
  
  status: 'pending' | 'applied' | 'failed'
  error?: string
  
  started_at: number           // performance.now()
  completed_at?: number
  duration_ms?: number
}
```

---

## CAMADA 1: ARQUITETURA DE FLUXO

### Requisito 1: Flow Orchestrator — Motor Central de Transição

**User Story:** Como desenvolvedor, eu quero que todas as transições de estado passem por um único orquestrador com garantia de atomicidade e contexto imutável, para que a lógica de transição seja consistente, testável, auditável e extensível sem duplicação.

#### Critérios de Aceitação

1. THE Flow_Orchestrator SHALL ser implementado como classe em `web/core/flow/FlowOrchestrator.ts` que recebe serviços injetados (updateState, deriveStatus, emitSocket, showToast, autoSelect, refetch, logEvent, suggestTemplate, celebrate) no construtor.
2. WHEN o método `run(action: Flow_Action, ctx: Flow_Context)` é chamado, THE Flow_Orchestrator SHALL criar um snapshot imutável do Flow_Context (`const snapshot = { ...ctx }`) antes de executar qualquer efeito, garantindo que mutações externas ao contexto durante a execução não afetem os efeitos.
3. WHEN uma transição válida é encontrada no Transition_Map, THE Flow_Orchestrator SHALL executar cada Flow_Effect da lista de efeitos em ordem sequencial usando o snapshot imutável.
4. THE execução de efeitos SHALL ser atômica: se qualquer efeito crítico (`update_state`, `derive_status`, `emit_socket`) falhar, THE Flow_Orchestrator SHALL interromper a execução dos efeitos restantes e propagar o erro ao chamador. Efeitos de UI (`toast_destino`, `auto_select`, `celebrate`) SHALL ser executados em bloco try-catch individual sem interromper a cadeia.
5. IF o Transition_Map não contém uma transição para o par `(ctx.currentState, action)`, THEN THE Flow_Orchestrator SHALL registrar um warning no console e retornar sem executar efeitos.
6. THE Flow_Orchestrator SHALL aplicar um timeout de 5000ms para a execução completa de todos os efeitos. IF o timeout é excedido, THEN THE Flow_Orchestrator SHALL rejeitar a promise com erro de timeout e registrar o evento no log.
7. THE Flow_Orchestrator SHALL ser a única via de execução de transições de estado — nenhum handler de componente (handleConfirmar, handleAvancarStatus, handleFechamento, handleReengajar, handleNaoFechou, handleNovoAtendimento) SHALL executar lógica de transição diretamente.
8. FOR ALL transições executadas pelo Flow_Orchestrator, a sequência de efeitos registrada no Transition_Map SHALL ser reproduzível: executar a mesma ação com o mesmo contexto SHALL produzir os mesmos efeitos na mesma ordem (propriedade de determinismo).

### Requisito 2: Transition Map — Mapa Declarativo de Transições

**User Story:** Como desenvolvedor, eu quero um mapa declarativo que defina todas as transições válidas do sistema com seus efeitos em ordem formal, para que eu tenha uma fonte única de verdade e possa adicionar novas transições sem modificar lógica espalhada.

#### Critérios de Aceitação

1. THE Transition_Map SHALL ser implementado como constante exportada em `web/core/flow/transitions.ts` com tipo `Record<Estado_Painel, Partial<Record<Flow_Action, Transition>>>`.
2. THE Transition_Map SHALL definir as seguintes transições com seus efeitos na ordem formal padrão:
   - `triagem` + `classificar` (destino backoffice) → `em_atendimento` com efeitos: `[log_transition, update_state, derive_status, emit_socket, refetch, auto_select, toast_destino, suggest_template]`
   - `triagem` + `classificar` (destino encerrado) → `encerrado` com efeitos: `[log_transition, update_state, emit_socket, auto_select, toast_destino]`
   - `em_atendimento` + `avancar_etapa` → `em_atendimento` com efeitos: `[log_transition, update_state, derive_status, emit_socket, refetch]`
   - `em_atendimento` + `fechar` → `cliente` com efeitos: `[log_transition, update_state, derive_status, emit_socket, refetch, auto_select, toast_destino, celebrate]`
   - `em_atendimento` + `perder` → `encerrado` com efeitos: `[log_transition, update_state, emit_socket, auto_select, toast_destino]`
   - `encerrado` + `reativar` → `triagem` com efeitos: `[log_transition, update_state, emit_socket, refetch, toast_destino]`
   - `cliente` + `novo_atendimento` → `triagem` com efeitos: `[log_transition, update_state, emit_socket, auto_select, toast_destino]`
3. EACH entrada no Transition_Map SHALL conter: `toState` (Estado_Painel destino), `effects` (lista ordenada de Flow_Effect), `toastMessage` (texto do toast), `toastAction` (label do botão, opcional), `toastVariant` (`success` | `info` | `celebration`).
4. THE ordem formal padrão de efeitos SHALL ser: `log_transition` → `update_state` → `derive_status` → `emit_socket` → `refetch` → `auto_select` → `toast_destino` → `suggest_template` → `celebrate`. Efeitos não aplicáveis a uma transição são omitidos, mas a ordem relativa dos presentes SHALL ser mantida.
5. THE Transition_Map SHALL ser a única fonte de verdade para determinar quais transições são válidas — nenhuma transição fora do mapa SHALL ser executada.
6. FOR ALL pares `(estado, ação)` definidos no Transition_Map, a transição SHALL ser idempotente: executar a mesma transição duas vezes com o mesmo contexto SHALL produzir o mesmo estado final.

### Requisito 3: Next Action Resolver — Resolvedor de Próximo Passo

**User Story:** Como desenvolvedor, eu quero uma função pura que dado o estado atual de um caso e seu contexto retorne a próxima ação recomendada, para que o Cockpit, Toast e navegação usem a mesma lógica sem duplicação.

#### Critérios de Aceitação

1. THE Next_Action_Resolver SHALL ser implementado como função pura exportada em `web/core/flow/nextAction.ts` com assinatura `resolveNextAction(state: Estado_Painel, stage: string | null, ctx?: { valor_contrato?: number | null, ultima_msg_de?: string | null, tempo_desde_ultima_msg?: number | null }) => NextActionContext | null`.
2. WHEN `state` é `triagem`, THE Next_Action_Resolver SHALL retornar `{ action: 'classificar', label: 'Classificar este caso', destination: 'em_atendimento', description: 'Definir tipo de decisão e encaminhar' }`.
3. WHEN `state` é `em_atendimento`, THE Next_Action_Resolver SHALL consultar `getNextStep()` do `businessStateMachine.ts` para derivar a próxima etapa e retornar `{ action: 'avancar_etapa', label: <etapa derivada>, destination: 'em_atendimento', description: <descrição da etapa> }`.
4. WHEN `state` é `em_atendimento` e `ultima_msg_de` é `operador` e `tempo_desde_ultima_msg` é maior que 24 horas, THE Next_Action_Resolver SHALL retornar `{ action: 'follow_up', label: 'Fazer follow-up', destination: 'em_atendimento', description: 'Cliente sem resposta há mais de 24h' }`.
5. WHEN `state` é `cliente` e `valor_contrato` é null, THE Next_Action_Resolver SHALL retornar `{ action: 'registrar_financeiro', label: 'Registrar financeiro', destination: 'cliente', description: 'Registrar valor de contrato e forma de pagamento' }`.
6. WHEN `state` é `cliente` e `valor_contrato` é preenchido, THE Next_Action_Resolver SHALL retornar `{ action: 'acompanhar', label: 'Acompanhar caso', destination: 'cliente', description: 'Caso em andamento — monitorar progresso' }`.
7. WHEN `state` é `encerrado`, THE Next_Action_Resolver SHALL retornar `{ action: 'reativar', label: 'Reativar caso', destination: 'triagem', description: 'Reabrir caso para nova triagem' }`.
8. FOR ALL combinações válidas de `(state, stage)`, THE Next_Action_Resolver SHALL retornar um resultado não-nulo — garantindo que o Cockpit sempre tenha uma sugestão de próximo passo.
9. THE Next_Action_Resolver SHALL ser uma função pura sem efeitos colaterais, dependendo apenas dos parâmetros recebidos e de `getNextStep()`.
10. THE Next_Action_Resolver SHALL retornar um campo `confidence: 'high' | 'medium' | 'low'` indicando a certeza da recomendação.
11. THE Next_Action_Resolver SHALL retornar um campo `type: 'auto' | 'assisted' | 'blocked'` indicando o nível de automação.
12. WHEN confidence é `low` (dados incompletos ou regras conflitantes), THE Next_Action_Resolver SHALL retornar `{ action: 'revisar', label: 'Revisar caso', type: 'assisted', confidence: 'low' }`.
13. WHEN type é `blocked`, THE Next_Action_Resolver SHALL incluir `reason: string` e `unblockAction: string` explicando por que está bloqueado e como desbloquear.

### Requisito 4: Flow Events — Log Semântico de Transições

**User Story:** Como gestor, eu quero um log semântico de todas as transições executadas pelo orquestrador, separado do log técnico de status_transitions, para que eu tenha auditoria completa da intenção do operador e contexto de cada ação.

#### Critérios de Aceitação

1. THE tabela `flow_events` SHALL ser criada com a seguinte estrutura: `id` (uuid, PK), `atendimento_id` (uuid, NOT NULL, FK para atendimentos), `action` (text, NOT NULL), `from_state` (text, NOT NULL), `to_state` (text, NOT NULL), `from_stage` (text, nullable), `to_stage` (text, nullable), `operador_id` (uuid, nullable), `metadata` (jsonb, default `{}`), `created_at` (timestamptz, NOT NULL, default now()).
2. THE tabela `flow_events` SHALL ter índices em: `(atendimento_id, created_at DESC)`, `(action)`, `(to_state)`.
3. WHEN o Flow_Orchestrator executa o efeito `log_transition`, THE Sistema_Fluxo SHALL inserir um registro em `flow_events` ANTES de executar `update_state`, garantindo que o log é gravado mesmo se a atualização de estado falhar.
4. THE campo `metadata` SHALL conter contexto relevante da transição: canal de origem, tempo desde criação, dados financeiros (para fechamento), motivo (para perda), e qualquer informação específica da ação.
5. THE `flow_events` SHALL ser append-only: nenhum registro SHALL ser modificado ou deletado após criação.
6. FOR ALL transições executadas pelo Flow_Orchestrator, a leitura dos `flow_events` de um Caso em ordem cronológica SHALL reconstruir a sequência completa de ações do operador desde a criação até o estado atual (propriedade de round-trip).
7. THE flow_events SHALL ter consumidores explícitos definidos: `behaviorTracker` (tracking de produtividade), `dashboardMetrics` (métricas de gestão), `auditLog` (compliance).
8. THE flow_events SHALL ter política de retenção: 90 dias operacional (queries rápidas), archive em cold storage após 90 dias.
9. THE flow_events SHALL suportar os seguintes query patterns com índices otimizados: por atendimento (timeline), por operador (produtividade), por ação (métricas), por período (relatórios).

---

## CAMADA 2: EXPERIÊNCIA DO OPERADOR

### Requisito 5: Toast Acionável como Componente Reutilizável

**User Story:** Como desenvolvedor, eu quero que o toast com ação seja um componente reutilizável, para que todas as transições do sistema usem o mesmo padrão visual e comportamental.

#### Critérios de Aceitação

1. THE Toast_Acao SHALL ser implementado como componente React reutilizável em `web/components/ui/ActionToast.tsx`.
2. THE Toast_Acao SHALL aceitar as seguintes propriedades: `message` (texto), `actionLabel` (texto do botão, opcional), `onAction` (callback do botão, opcional), `duration` (tempo em ms, padrão 5000), `variant` (`success` | `info` | `celebration`), `onDismiss` (callback ao fechar).
3. THE Toast_Acao SHALL ser posicionado no canto inferior direito da tela, acima de toasts anteriores se houver múltiplos.
4. THE Toast_Acao SHALL suportar a variante `celebration` que inclui animação de pulse verde e fundo verde claro.
5. WHEN o Operador clica no botão de ação do Toast_Acao, THE Toast_Acao SHALL executar o callback `onAction` e se auto-descartar.
6. THE Toast_Acao SHALL ser acessível: navegável por teclado (Tab para focar, Enter para acionar) e com `role="alert"` para leitores de tela.
7. THE Toast_Acao SHALL ser descartável por clique no botão de fechar (ícone ✕) ou por timeout configurável.

### Requisito 6: Toast com Destino após Classificação (Triagem → Execução)

**User Story:** Como operador, eu quero que após classificar um caso na triagem, o sistema me mostre imediatamente um toast com link para o caso no backoffice, para que eu não perca visibilidade do caso que acabei de mover.

#### Critérios de Aceitação

1. WHEN o Flow_Orchestrator executa a transição `triagem` + `classificar` com destino `em_atendimento`, THE efeito `toast_destino` SHALL exibir um Toast_Acao com variante `success`, mensagem "Caso movido para Execução" e botão "Ver agora →".
2. WHEN o Operador clica no botão "Ver agora →", THE callback SHALL navegar para a tela de backoffice com o Caso correspondente pré-selecionado via query parameter.
3. WHEN o Flow_Orchestrator executa a transição `triagem` + `classificar` com destino `encerrado`, THE efeito `toast_destino` SHALL exibir um Toast_Acao com variante `info` e mensagem "Decisão encerrada" sem botão de navegação.
4. THE Toast_Acao SHALL permanecer visível por 5 segundos.

### Requisito 7: Toast com Destino após Fechamento (Execução → Cliente)

**User Story:** Como operador, eu quero que após fechar um caso com sucesso, o sistema me mostre um toast com link para o financeiro e uma micro-celebração, para que eu tenha feedback positivo e acesso rápido ao registro financeiro.

#### Critérios de Aceitação

1. WHEN o Flow_Orchestrator executa a transição `em_atendimento` + `fechar`, THE efeito `toast_destino` SHALL exibir um Toast_Acao com variante `celebration`, mensagem "Caso fechado com sucesso 🎉" e botão "Ver financeiro →".
2. WHEN o Operador clica no botão "Ver financeiro →", THE callback SHALL navegar para a tela financeiro com o Caso correspondente visível.
3. THE efeito `celebrate` SHALL disparar uma animação de celebração sutil (pulse verde no Toast_Acao) com duração de 1.5 segundos.
4. WHEN o Flow_Orchestrator executa a transição `em_atendimento` + `perder`, THE efeito `toast_destino` SHALL exibir um Toast_Acao com variante `info` e mensagem "Decisão encerrada" sem celebração.

### Requisito 8: Auto-Seleção de Lead após Ação

**User Story:** Como operador, eu quero que após concluir uma ação que remove o caso atual da minha lista, o sistema selecione automaticamente o próximo caso mais relevante, para que eu nunca fique olhando para uma tela vazia.

#### Critérios de Aceitação

1. WHEN o efeito `auto_select` é executado pelo Flow_Orchestrator, THE Sistema_Fluxo SHALL selecionar o próximo Caso na lista da Sidebar ordenada por `deriveGlobalPriority`.
2. WHEN a Sidebar não contém mais Casos após a remoção, THE Cockpit SHALL exibir uma mensagem de estado vazio com o texto "Nenhum caso pendente — bom trabalho 👏" e sugestão "Verificar outras telas".
3. THE efeito `auto_select` SHALL executar em até 300 milissegundos após a remoção do Caso da lista.
4. IF a lista contém múltiplos Casos, THEN THE efeito `auto_select` SHALL selecionar o primeiro da lista ordenada (maior prioridade).
5. IF a lista está vazia, THEN THE efeito `auto_select` SHALL limpar a seleção e exibir o estado vazio sem erro.

### Requisito 9: Delegação no Bloco de Contexto

**User Story:** Como operador, eu quero que o controle de delegação/assunção esteja dentro do bloco de contexto do caso, para que eu não precise procurar no topo da tela e a ação fique próxima da informação relevante.

#### Critérios de Aceitação

1. THE Bloco_Delegacao SHALL ser renderizado dentro da seção de contexto (identidade) do Cockpit, abaixo das informações de canal e ciclo.
2. WHEN o Caso não possui responsável (`owner_id` é null), THE Bloco_Delegacao SHALL exibir um botão com o texto "Assumir caso".
3. WHEN o Caso possui um responsável diferente do Operador atual, THE Bloco_Delegacao SHALL exibir o nome do responsável atual e um botão com o texto "Transferir".
4. WHEN o Caso possui o Operador atual como responsável, THE Bloco_Delegacao SHALL exibir o texto "Você" com badge azul e um botão "Transferir" para delegar a outro operador.
5. WHEN o Operador abre um Caso sem responsável, THE Sistema_Fluxo SHALL assumir automaticamente o Caso para o Operador (auto-assume), atualizando `owner_id` sem exigir clique adicional.
6. WHEN a auto-assunção ocorre, THE Sistema_Fluxo SHALL emitir o Socket_Evento `assignment_updated` para que todos os operadores conectados vejam a mudança em tempo real.
7. THE Bloco_Delegacao SHALL substituir o componente PainelHeader como local primário de delegação — o header mantém apenas o badge de estado.

### Requisito 10: Reset de Display Time

**User Story:** Como operador, eu quero que o card de um caso suba para o topo da lista quando houver reativação, nova mensagem ou mudança de status relevante, para que casos com atividade recente fiquem visíveis.

#### Critérios de Aceitação

1. WHEN um Caso é reativado (transição `encerrado` → `triagem` via Flow_Orchestrator), THE efeito `update_state` SHALL atualizar o campo `ultima_msg_em` do lead para o timestamp atual.
2. WHEN uma nova mensagem é recebida em um Caso, THE Sistema_Fluxo SHALL manter o campo `ultima_msg_em` atualizado com o timestamp da mensagem (comportamento existente preservado).
3. WHEN o status_negocio de um Caso muda (transição de estágio via Flow_Orchestrator), THE efeito `update_state` SHALL atualizar o campo `ultima_msg_em` do lead para o timestamp da transição.
4. THE Display_Time efetivo SHALL ser calculado como `max(ultima_msg_em, status_changed_at)` onde `status_changed_at` é derivado da última entrada em `status_transitions` para o Caso.
5. THE Sidebar SHALL usar `ultima_msg_em` como critério primário de ordenação (mais recente primeiro), mantendo o comportamento estilo WhatsApp existente.

### Requisito 11: Auto-Refetch do Cockpit

**User Story:** Como operador, eu quero que o cockpit atualize automaticamente quando o caso selecionado sofre uma mudança de estado, para que eu sempre veja informações atualizadas sem precisar recarregar.

#### Critérios de Aceitação

1. WHEN o Socket_Evento `estado_painel_changed` é recebido para o Caso atualmente selecionado, THE Cockpit SHALL executar `ctx.refetch()` em até 500 milissegundos.
2. WHEN o Socket_Evento `status_negocio_changed` é recebido para o Caso atualmente selecionado, THE Cockpit SHALL atualizar o estágio exibido no StageTimeline e o Indicador_Proximo_Passo.
3. WHEN o Socket_Evento `assignment_updated` é recebido para o Caso atualmente selecionado, THE Cockpit SHALL atualizar o nome do responsável exibido no Bloco_Delegacao.
4. THE Cockpit SHALL preservar o estado de formulários em edição (campo de observação, seleção de tratamento, classificação jurídica) durante o refetch, sem perder dados digitados pelo Operador.
5. THE refetch SHALL ser debounced com intervalo de 300ms para evitar múltiplas chamadas simultâneas quando vários eventos chegam em sequência.

### Requisito 12: Indicador de Próximo Passo no Cockpit

**User Story:** Como operador, eu quero que o cockpit sempre me diga qual é a próxima ação recomendada para o caso atual, para que eu nunca precise adivinhar o que fazer.

#### Critérios de Aceitação

1. THE Indicador_Proximo_Passo SHALL ser exibido de forma proeminente no Cockpit, acima dos botões de ação, com fundo azul claro (`bg-blue-50`) e ícone de seta.
2. THE Indicador_Proximo_Passo SHALL consumir o resultado do Next_Action_Resolver passando o `estado_painel`, `status_negocio` e contexto do Caso atual.
3. THE Indicador_Proximo_Passo SHALL exibir três informações: estado atual (badge colorido), ação recomendada (texto principal em negrito), e resultado esperado (texto secundário em cinza).
4. WHEN o Operador clica no Indicador_Proximo_Passo, THE Cockpit SHALL fazer scroll suave até a seção de ação correspondente (bloco de classificação na triagem, botão de avançar no backoffice).
5. WHEN o Next_Action_Resolver retorna null (estado terminal sem ação), THE Indicador_Proximo_Passo SHALL exibir "Caso arquivado" sem botão de ação.

### Requisito 13: Ações Encadeadas — Classificar

**User Story:** Como operador, eu quero que após classificar um caso, o sistema sugira automaticamente as próximas ações da cadeia (sugerir template de mensagem), para que eu complete o fluxo sem precisar lembrar dos passos.

#### Critérios de Aceitação

1. WHEN o Flow_Orchestrator executa o efeito `suggest_template` após classificação com destino `backoffice`, THE Sistema_Fluxo SHALL exibir um painel inline no Cockpit com a opção "Enviar mensagem de boas-vindas" com template pré-preenchido baseado no tipo de classificação.
2. WHEN o Operador aceita a sugestão de mensagem, THE Sistema_Fluxo SHALL inserir o template no campo de mensagem do ChatCentral, permitindo edição antes do envio.
3. WHEN o Operador rejeita a sugestão (clica em "Pular"), THE Sistema_Fluxo SHALL prosseguir para o efeito `auto_select`.
4. THE sugestão de template SHALL ser exibida como painel inline (não modal bloqueante) com timeout de 10 segundos, após o qual é descartada automaticamente.
5. THE efeito `suggest_template` SHALL ser definido no Transition_Map e executado pelo Flow_Orchestrator — não por lógica no componente.

### Requisito 14: Ações Encadeadas — Fechamento

**User Story:** Como operador, eu quero que ao fechar um caso, o sistema me guie pela sequência completa (registrar financeiro → celebração → próximo caso), para que eu não esqueça nenhum passo.

#### Critérios de Aceitação

1. WHEN o Operador inicia o fechamento de um Caso, THE Cockpit SHALL exibir o modal de fechamento com campos obrigatórios: valor de contrato, tipo de honorário, forma de pagamento (comportamento existente preservado).
2. WHEN o Operador confirma o fechamento, THE Cockpit SHALL chamar `flow.run('fechar', ctx)` que executa a sequência de efeitos definida no Transition_Map.
3. THE sequência de fechamento SHALL ser atômica: se `update_state` falha, nenhum efeito subsequente de UI é executado e o erro é exibido ao Operador via toast de erro.
4. THE efeito `log_transition` SHALL registrar o Flow_Event com metadata contendo `{ valor_contrato, tipo_honorario, forma_pagamento }`.

### Requisito 15: Eliminação de Limbos — Visibilidade Imediata

**User Story:** Como operador, eu quero que após qualquer ação que mova um caso entre telas, o caso tenha visibilidade imediata na tela de destino, para que nenhum caso "desapareça" do sistema.

#### Critérios de Aceitação

1. WHEN o efeito `emit_socket` é executado pelo Flow_Orchestrator, THE Sistema_Fluxo SHALL emitir o Socket_Evento `estado_painel_changed` com `{ identity_id, lead_id, estado_painel }` para que todas as Sidebars conectadas atualizem.
2. WHEN um Caso é reativado (transição `encerrado` → `triagem`), THE efeito `emit_socket` SHALL emitir adicionalmente o evento `lead_reaquecido`.
3. THE Sistema_Fluxo SHALL garantir que entre a execução do efeito `emit_socket` e a visibilidade do Caso na tela de destino, o tempo máximo seja de 1 segundo.
4. IF o Socket_Evento falha ao ser emitido (socket desconectado), THEN THE Flow_Orchestrator SHALL executar o efeito `refetch` como fallback após 2 segundos.

### Requisito 16: Micro-Interações de Feedback

**User Story:** Como operador, eu quero feedback visual imediato quando uma ação tem efeito no sistema, para que eu tenha certeza de que a ação foi processada.

#### Critérios de Aceitação

1. WHEN o status de um Caso muda via Socket_Evento, THE Card_Conversa correspondente SHALL exibir um highlight (borda pulsante azul) por 2 segundos.
2. WHEN um Caso é reativado e aparece na Sidebar, THE Sidebar SHALL executar auto-scroll suave até o Card_Conversa do Caso reativado.
3. WHEN uma nova transição de status é registrada, THE StageTimeline no Cockpit SHALL exibir uma animação de entrada (fade-in com slide da esquerda) no novo estágio com duração de 300ms.
4. WHEN o Operador salva uma nota, THE Cockpit SHALL exibir um indicador de confirmação (checkmark verde) por 1.5 segundos ao lado do botão de salvar.
5. THE Micro_Interacao SHALL usar animações CSS (transitions/keyframes) com duração entre 200ms e 500ms, sem bloquear interações do Operador.

### Requisito 17: Contexto Unificado entre Telas

**User Story:** Como operador, eu quero que ao navegar entre triagem e backoffice, a estrutura visual seja a mesma e apenas o filtro de dados mude, para que eu não precise reaprender a interface a cada troca de tela.

#### Critérios de Aceitação

1. THE Sidebar da triagem e THE Sidebar do backoffice SHALL usar o mesmo componente base (`ConversasSidebar`) com a mesma estrutura visual (busca, filtros, lista de cards).
2. THE diferença entre telas SHALL ser exclusivamente o filtro de `estado_painel` passado como prop ao componente.
3. THE Cockpit SHALL manter a mesma estrutura de seções (header, contexto, timeline, ações) em todas as telas, usando `usePainelMode` para controlar visibilidade de seções conforme o `estado_painel`.
4. WHEN o Operador navega entre telas, THE Sistema_Fluxo SHALL preservar o estado de busca e filtros ativos se o Operador retornar à tela anterior em até 30 segundos.

### Requisito 18: Regra de Continuidade do Sistema

**User Story:** Como operador, eu quero que o sistema nunca me deixe sem próximo passo, para que minha produtividade não seja interrompida por falta de orientação.

#### Critérios de Aceitação

1. WHEN o Flow_Orchestrator completa a execução de todos os efeitos de uma transição, THE Sistema_Fluxo SHALL garantir que exatamente uma das seguintes condições é verdadeira: (a) um Toast_Acao com destino está visível, (b) um novo Caso está selecionado na Sidebar, ou (c) a mensagem de fila vazia está exibida.
2. THE Flow_Orchestrator SHALL garantir que após qualquer transição, o tempo entre a conclusão do último efeito e a exibição do próximo passo ao Operador seja inferior a 1 segundo.
3. IF a fila de Casos está vazia após uma transição, THEN THE Sistema_Fluxo SHALL exibir a mensagem "Nenhum caso pendente — bom trabalho 👏" com links para verificar outras telas.
4. THE Flow_Orchestrator SHALL registrar via `trackEvent` do `behaviorTracker` cada transição completada, incluindo: ação, estado anterior, estado novo, tempo de execução, e se o operador seguiu a sugestão do Toast.
5. FOR ALL transições definidas no Transition_Map, a execução pelo Flow_Orchestrator SHALL resultar em pelo menos um efeito de continuidade (`toast_destino` ou `auto_select`) — garantindo zero limbos por design.
6. WHEN o Next_Action_Resolver retorna type `blocked`, THE Sistema_Fluxo SHALL exibir o motivo do bloqueio e a ação necessária para desbloquear, em vez de forçar um próximo passo artificial.
7. WHEN o Caso está aguardando input externo (resposta do cliente, aprovação), THE Sistema_Fluxo SHALL exibir estado `waiting` com tempo estimado e sugestão "Verificar outros casos enquanto aguarda".
8. THE regra de continuidade SHALL ser: "sempre tem próximo passo OU motivo explícito de bloqueio/espera" — nunca vazio sem explicação.

---

## CAMADA 3: RESILIÊNCIA E CONCORRÊNCIA

### Requisito 19: Modelo de Concorrência

**User Story:** Como desenvolvedor, eu quero que o sistema trate corretamente cenários de concorrência (multi-operador, multi-tab, retry), para que transições não causem inconsistência silenciosa.

#### Critérios de Aceitação

1. THE Flow_Context SHALL incluir um campo `snapshot_version: number` que identifica a versão do estado do Caso no momento da leitura (optimistic locking).
2. WHEN o Flow_Orchestrator executa `run(action, ctx)`, THE Flow_Orchestrator SHALL comparar `ctx.snapshot_version` com a versão atual no backend antes de aplicar efeitos. IF a versão mudou entre snapshot e apply, THEN THE Flow_Orchestrator SHALL abortar a transição e executar refetch do estado atual (política reject-on-stale).
3. THE Sistema_Fluxo SHALL operar sem lock pessimista — nenhuma operação de leitura ou navegação SHALL ser bloqueada enquanto uma transição está em execução por outro operador.
4. WHEN dois Operadores tentam transicionar o mesmo Caso simultaneamente, THE Sistema_Fluxo SHALL aplicar a transição do primeiro operador a submeter e rejeitar a do segundo com a mensagem "Caso já foi atualizado — recarregando..." seguida de refetch automático.
5. WHEN um Socket_Evento chega durante a execução de efeitos de uma transição em andamento, THE Flow_Orchestrator SHALL enfileirar o evento e processá-lo somente após a conclusão da transição atual.
6. THE Sistema_Fluxo SHALL implementar proteção contra double-click: botões de ação SHALL ser desabilitados imediatamente ao clicar, antes do início da execução de `flow.run()`.

### Requisito 20: Modelo de Estados de Transição

**User Story:** Como operador, eu quero que o sistema me mostre claramente quando uma transição está em progresso ou falhou, para que eu nunca fique em estado ambíguo.

#### Critérios de Aceitação

1. THE Flow_Orchestrator SHALL manter um estado de transição com os seguintes valores possíveis: `stable`, `transitioning`, `failed`, `ambiguous`.
2. WHILE o estado de transição é `stable`, THE Cockpit SHALL exibir todas as ações disponíveis habilitadas e sem indicadores de loading.
3. WHILE o estado de transição é `transitioning`, THE Cockpit SHALL desabilitar todos os botões de ação e exibir um loading indicator inline na ação em execução.
4. WHILE o estado de transição é `failed`, THE Cockpit SHALL exibir a mensagem de erro e um botão "Tentar novamente" que re-executa a última transição com o mesmo contexto.
5. WHILE o estado de transição é `ambiguous` (dados incompletos para determinar próximo passo), THE Cockpit SHALL exibir a mensagem "Revisar caso" com indicação dos dados faltantes.
6. IF o estado de transição permanece em `transitioning` por mais de 5000ms, THEN THE Flow_Orchestrator SHALL mudar automaticamente para `failed` com mensagem de timeout.
7. WHEN o estado de transição muda, THE Cockpit SHALL atualizar a UI imediatamente refletindo o novo estado (botões, indicadores, mensagens).

### Requisito 21: Política de Erros e Recuperação

**User Story:** Como operador, eu quero que quando uma transição falha, o sistema me dê opções claras de recuperação, para que eu não fique preso.

#### Critérios de Aceitação

1. IF um efeito crítico (`update_state`, `derive_status`, `emit_socket`) falha durante a execução, THEN THE Flow_Orchestrator SHALL abortar a cadeia de efeitos, restaurar o snapshot de UI e exibir um toast de erro com botão "Tentar novamente".
2. IF um efeito de UI (`toast_destino`, `auto_select`, `celebrate`) falha durante a execução, THEN THE Flow_Orchestrator SHALL registrar um warning no log e continuar a execução da cadeia de efeitos restantes.
3. WHEN ocorre um timeout de rede, THE Flow_Orchestrator SHALL executar retry automático 1 vez após 2 segundos. IF o retry também falhar, THEN THE Flow_Orchestrator SHALL transicionar para o estado `failed`.
4. WHEN a API retorna erro 409 (conflict), THE Flow_Orchestrator SHALL executar refetch do estado atual e re-resolver a transição com o contexto atualizado.
5. WHEN a API retorna erro 5xx, THE Flow_Orchestrator SHALL transicionar para o estado `failed` com botão "Tentar novamente".
6. WHEN uma transição falha, THE Flow_Orchestrator SHALL restaurar o estado de UI a partir do snapshot criado antes da execução. O estado do backend permanece inalterado (um `log_transition` já gravado é aceitável como registro órfão).
7. THE toast de erro SHALL exibir a mensagem "Não foi possível [ação] — tente novamente" com botão retry que re-executa a transição.

### Requisito 22: SLA de Resposta do Fluxo

**User Story:** Como operador, eu quero que o sistema responda dentro de tempos previsíveis, para que o fluxo contínuo não seja quebrado por delays.

#### Critérios de Aceitação

1. WHEN efeitos locais (UI state update, snapshot) são executados, THE Flow_Orchestrator SHALL completá-los em menos de 100ms — percepção instantânea para o Operador.
2. WHEN efeitos de rede (`update_state`, `emit_socket`) são executados e levam entre 100ms e 500ms, THE Cockpit SHALL exibir skeleton/shimmer nos componentes afetados.
3. WHEN a execução total de efeitos excede 500ms, THE Cockpit SHALL exibir spinner inline com texto "Processando...".
4. IF a execução total de efeitos excede 5000ms, THEN THE Flow_Orchestrator SHALL transicionar para o estado `failed` e exibir toast de erro com timeout.
5. THE Flow_Orchestrator SHALL rastrear o tempo de execução por efeito individual e o tempo total da transição.
6. IF o tempo total de execução excede 3000ms, THEN THE Flow_Orchestrator SHALL registrar um warning no log com breakdown de tempo por efeito.
7. WHILE efeitos de rede estão em execução com loading states visíveis, THE Sistema_Fluxo SHALL manter outras interações de UI (scroll da Sidebar, busca, navegação) desbloqueadas e responsivas.

### Requisito 23: Idempotência de Transições

**User Story:** Como desenvolvedor, eu quero que transições sejam idempotentes, para que double-clicks, retries e reprocessamento de eventos não causem inconsistência.

#### Critérios de Aceitação

1. WHEN `flow.run()` é chamado, THE Flow_Orchestrator SHALL gerar um `transition_id` (uuid v4) e um `idempotency_key` (hash de `action + atendimento_id + snapshot_version`).
2. WHEN o backend recebe uma requisição de transição, THE backend SHALL verificar o `idempotency_key` antes de aplicar. IF o `idempotency_key` já existe, THEN THE backend SHALL retornar o resultado existente sem re-executar a transição.
3. THE Sistema_Fluxo SHALL desabilitar botões de ação imediatamente ao clicar (antes de `flow.run()` iniciar) como proteção contra double-click.
4. WHEN Socket_Eventos são emitidos, THE Socket_Evento SHALL incluir o `transition_id`. IF o receptor já processou esse `transition_id`, THEN THE receptor SHALL ignorar o evento duplicado.
5. THE tabela `flow_events` SHALL ter uma constraint unique em `(atendimento_id, idempotency_key)` para garantir que a mesma transição não seja registrada duas vezes.
6. WHEN um retry é executado com a mesma `idempotency_key`, THE backend SHALL retornar o resultado cacheado (safe retry).
7. WHEN um retry é executado com uma nova `idempotency_key` (nova snapshot_version), THE backend SHALL tratar como nova transição, aplicando somente se a version atual corresponde.
