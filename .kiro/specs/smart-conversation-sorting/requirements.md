# Documento de Requisitos — Ordenação Inteligente de Conversas

## Introdução

Este documento especifica os requisitos para a funcionalidade de ordenação inteligente e filtros na lista de conversas (ConversasSidebar), bem como o motor de classificação de conversas, roteamento para destinos (Backoffice, encerramento, relacionamento) e ciclo de vida de status de negócio. O objetivo é simplificar a lógica de classificação de inatividade (substituindo horas úteis por horas corridas), reordenar a lista priorizando conversas que exigem ação imediata, ajustar os filtros e contadores para refletir os novos status, e formalizar o fluxo de classificação → status de negócio → destino que ocorre quando o operador qualifica uma conversa. Além disso, o documento cobre a integração com o Backoffice, a separação entre status temporal (sidebar) e status de negócio, o fluxo de reengajamento para leads inativos, a máquina de estados formal que governa as transições de status de negócio com trilha de auditoria, e o feedback visual contextual exibido ao operador após cada ação de classificação. O documento também especifica o módulo de recuperação "Outros & Abandonados" (Modulo_Outros_Abandonados), responsável por capturar e exibir conversas que não completaram o fluxo da URA (abandonadas) ou que enviaram texto livre fora da árvore do bot (outros), permitindo que operadores resgatem esses leads e os reintegrem ao fluxo normal de atendimento. Por fim, o documento especifica o sistema de classificação hierárquica configurável (Arvore_Classificacao), uma árvore de 3 níveis (Motivo → Categoria → Subcategoria) gerenciada pelo Owner, que substitui o mapeamento plano de ações e determina automaticamente o Status_Negocio e o Destino de cada conversa com base na classificação selecionada pelo operador.

## Glossário

- **Sidebar**: O componente `ConversasSidebar` que exibe a lista de conversas na tela de atendimento (tela1).
- **Conversa**: Uma entrada na lista da Sidebar representando um lead com metadados de atendimento.
- **Status_Conversa**: Classificação de inatividade de uma conversa, derivada do campo `ultima_msg_em`. Valores possíveis: `active`, `waiting`, `no_response`, `inativo`, `abandonado_ura`, `outro_input`.
- **Classificador**: A função `getConversationStatus` que calcula o Status_Conversa de uma Conversa.
- **Ordenador**: A lógica de ordenação que define a ordem de exibição das Conversas na Sidebar.
- **Filtro_Pill**: Um botão de filtro na Sidebar que permite ao operador filtrar Conversas por Status_Conversa. Valores: "Todos", "Aguardando", "Sem retorno".
- **Contador**: O número exibido ao lado de cada Filtro_Pill indicando a quantidade de Conversas naquela categoria.
- **Indicador_Nao_Lidos**: Um marcador visual (●) exibido ao lado do Filtro_Pill "Todos" quando existem Conversas com mensagens não lidas.
- **unreadCount**: Campo numérico na Conversa que indica a quantidade de mensagens não lidas.
- **ultima_msg_em**: Campo de timestamp na Conversa que indica o momento da última mensagem.
- **diffHours**: Diferença em horas corridas entre o momento atual e o valor de `ultima_msg_em`.
- **diffDays**: Diferença em dias corridos entre o momento atual e o valor de `ultima_msg_em`.
- **Action_Map**: Mapa derivado dos nós-folha (Subcategorias) da Arvore_Classificacao, que associa cada classificação final a um Status_Negocio e um Destino. O Action_Map é gerado automaticamente a partir da Arvore_Classificacao e não é editado diretamente.
- **Status_Negocio**: Status de negócio da conversa, separado do Status_Conversa (temporal). Valores possíveis: `aguardando_agendamento`, `reuniao_agendada`, `aguardando_proposta`, `negociacao`, `aguardando_contrato`, `fechado`, `perdido`.
- **Destino**: O destino de roteamento de uma conversa após classificação. Valores possíveis: `backoffice`, `encerrado`, `sidebar`, `relacionamento`.
- **Feedback_Acao**: Notificação visual (toast) exibida ao operador após salvar uma Classificacao, informando o resultado da ação de forma contextual com base no Destino.
- **Maquina_Estados**: A lógica que valida e controla as transições permitidas entre valores de Status_Negocio, garantindo que apenas transições válidas sejam executadas.
- **Classificacao**: O ato de o operador selecionar Motivo + Categoria + Subcategoria na Arvore_Classificacao para uma Conversa, persistindo a decisão e acionando a resolução automática de Status_Negocio e Destino.
- **Backoffice**: Módulo de gestão (tela2) que recebe conversas classificadas para acompanhamento de pipeline de negócio.
- **Motor_Classificacao**: A lógica que, ao receber uma Classificacao, consulta o Action_Map (derivado da Arvore_Classificacao), persiste o Status_Negocio, e roteia a Conversa para o Destino correto.
- **Reengajamento**: Fluxo automático acionado quando uma conversa atinge 7 dias corridos de inatividade, movendo-a para um status `inativo` e iniciando ações de reengajamento.
- **Modulo_Outros_Abandonados**: Módulo de recuperação que exibe conversas que abandonaram o fluxo da URA (`abandonado_ura`) ou enviaram texto livre fora da árvore do bot (`outro_input`), separado da Sidebar e do Backoffice.
- **abandonado_ura**: Valor de Status_Conversa atribuído a uma Conversa cujo cliente iniciou o fluxo da URA mas não o completou, parando em algum ponto intermediário sem atingir a classificação.
- **outro_input**: Valor de Status_Conversa atribuído a uma Conversa cujo cliente enviou texto livre fora da árvore do bot e que ainda não foi classificada nem tratada por um operador.
- **Ponto_Abandono**: Registro do ponto exato onde o cliente abandonou o fluxo da URA, contendo o estágio da URA, o último nó acessado e o timestamp do abandono.
- **Arvore_Classificacao**: A árvore hierárquica de 3 níveis (Motivo → Categoria → Subcategoria) que define todos os caminhos de classificação válidos e seus mapeamentos para Status_Negocio e Destino. Configurável pelo Owner.
- **Motivo**: Primeiro nível da Arvore_Classificacao. Representa a razão/intenção do cliente (ex.: "quer_atendimento", "em_duvida", "sem_interesse").
- **Categoria**: Segundo nível da Arvore_Classificacao. Representa uma categoria dentro de um Motivo (ex.: "pronto", "analise", "desistiu").
- **Subcategoria**: Terceiro nível (folha) da Arvore_Classificacao. Representa a classificação específica que mapeia para um Status_Negocio e um Destino.
- **Owner**: O administrador do sistema/dono do negócio que configura a Arvore_Classificacao.

## Requisitos

### Requisito 1: Classificação de Status da Conversa

**User Story:** Como operador, eu quero que cada conversa seja classificada automaticamente por tempo de inatividade usando horas corridas simples, para que eu identifique rapidamente quais conversas precisam de ação.

#### Critérios de Aceitação

1. WHEN `ultima_msg_em` is provided, THE Classificador SHALL calculate `diffHours` as the difference in elapsed hours between the current time and `ultima_msg_em`.
2. WHEN `diffHours` is greater than or equal to 34, THE Classificador SHALL return the Status_Conversa `no_response`.
3. WHEN `diffHours` is greater than or equal to 8 and less than 34, THE Classificador SHALL return the Status_Conversa `waiting`.
4. WHEN `diffHours` is less than 8, THE Classificador SHALL return the Status_Conversa `active`.
5. IF `ultima_msg_em` is null or absent, THEN THE Classificador SHALL return the Status_Conversa `no_response`.

### Requisito 2: Ordenação Prioritária da Lista de Conversas

**User Story:** Como operador, eu quero que a lista de conversas seja ordenada priorizando mensagens não lidas e maior tempo sem resposta, para que eu atenda primeiro quem mais precisa de ação.

#### Critérios de Aceitação

1. THE Ordenador SHALL place all Conversas with `unreadCount` greater than 0 before all Conversas with `unreadCount` equal to 0.
2. WHEN two Conversas have the same unread status (both with `unreadCount` > 0 or both with `unreadCount` = 0), THE Ordenador SHALL place the Conversa with the greater elapsed time since `ultima_msg_em` first (descending order of inactivity).
3. WHEN two Conversas have the same unread status and the same elapsed time since `ultima_msg_em`, THE Ordenador SHALL place the Conversa with the more recent `ultima_msg_em` first as a fallback.
4. THE Ordenador SHALL apply this sorting order consistently regardless of which Filtro_Pill is active.

### Requisito 3: Filtros de Conversas

**User Story:** Como operador, eu quero filtrar a lista de conversas por status de inatividade, para que eu foque apenas nas conversas de uma determinada categoria.

#### Critérios de Aceitação

1. THE Sidebar SHALL display exactly three Filtro_Pills: "Todos", "Aguardando", "Sem retorno".
2. WHEN the Filtro_Pill "Todos" is selected, THE Sidebar SHALL display all Conversas.
3. WHEN the Filtro_Pill "Aguardando" is selected, THE Sidebar SHALL display only Conversas with Status_Conversa equal to `waiting`.
4. WHEN the Filtro_Pill "Sem retorno" is selected, THE Sidebar SHALL display only Conversas with Status_Conversa equal to `no_response`.
5. THE Sidebar SHALL set the Filtro_Pill "Todos" as the default active filter on initial load.

### Requisito 4: Contadores nos Filtros

**User Story:** Como operador, eu quero ver a quantidade de conversas em cada categoria diretamente nos botões de filtro, para que eu tenha visibilidade imediata do volume de trabalho.

#### Critérios de Aceitação

1. THE Sidebar SHALL display the total count of all Conversas next to the Filtro_Pill "Todos" in the format "Todos {total}".
2. THE Sidebar SHALL display the count of Conversas with Status_Conversa `waiting` next to the Filtro_Pill "Aguardando" in the format "Aguardando {waiting}".
3. THE Sidebar SHALL display the count of Conversas with Status_Conversa `no_response` next to the Filtro_Pill "Sem retorno" in the format "Sem retorno {noResponse}".
4. WHEN the list of Conversas changes, THE Sidebar SHALL recalculate and update all Contadores.

### Requisito 5: Indicador de Mensagens Não Lidas

**User Story:** Como operador, eu quero ver um indicador visual quando existem conversas com mensagens não lidas, para que eu saiba imediatamente que há itens pendentes.

#### Critérios de Aceitação

1. WHEN at least one Conversa has `unreadCount` greater than 0, THE Sidebar SHALL display the Indicador_Nao_Lidos (●) next to the Filtro_Pill "Todos".
2. WHEN no Conversa has `unreadCount` greater than 0, THE Sidebar SHALL hide the Indicador_Nao_Lidos.
3. WHEN the `unreadCount` of any Conversa changes, THE Sidebar SHALL update the visibility of the Indicador_Nao_Lidos accordingly.

### Requisito 6: Transição Visual ao Trocar Filtro

**User Story:** Como operador, eu quero uma transição suave ao trocar de filtro, para que a mudança de lista não seja abrupta.

#### Critérios de Aceitação

1. WHEN the active Filtro_Pill changes, THE Sidebar SHALL apply a fade transition of 150 milliseconds to the list of Conversas.
2. THE Sidebar SHALL use only CSS opacity transitions for the fade effect, without animations pesadas (e.g., layout shifts, slide animations).

### Requisito 7: Performance e Memoização

**User Story:** Como operador, eu quero que a lista de conversas seja renderizada de forma eficiente, para que a interface permaneça responsiva mesmo com muitas conversas.

#### Critérios de Aceitação

1. THE Sidebar SHALL memoize the computation of Status_Conversa, sorted list, and filtered list to avoid redundant recalculations on each render cycle.
2. THE Sidebar SHALL avoid re-rendering the entire list of Conversas when only a single Conversa changes.
3. THE Sidebar SHALL compute Contadores from the already-classified list without iterating the full list of Conversas a second time.

### Requisito 8: Preservação da Estrutura Existente

**User Story:** Como desenvolvedor, eu quero que a implementação não altere a UI, não adicione componentes novos e não mude a estrutura de dados existente, para que a mudança seja segura e incremental.

#### Critérios de Aceitação

1. THE Sidebar SHALL maintain the existing visual layout, including spacing, colors, typography, and component hierarchy.
2. THE Sidebar SHALL not introduce new React components beyond the existing component tree.
3. THE Sidebar SHALL not modify the `Lead` interface defined in `page.tsx` or the database schema.
4. THE Sidebar SHALL replace the existing `classificarInatividade` usage with the new Classificador logic without changing the function signature contract of external utilities.

### Requisito 9: Mapeamento de Ação → Status de Negócio → Destino (Action Map)

**User Story:** Como operador, eu quero que ao selecionar Motivo + Categoria + Subcategoria na Arvore_Classificacao, o sistema automaticamente determine o status de negócio e o destino da conversa, para que a classificação seja consistente e sem etapas manuais adicionais.

#### Critérios de Aceitação

1. THE Motor_Classificacao SHALL derive the Action_Map from the leaf nodes (Subcategorias) of the Arvore_Classificacao, where each Subcategoria maps to exactly one Status_Negocio and one Destino.
2. THE Action_Map SHALL be automatically generated from the Arvore_Classificacao and SHALL not be edited directly; changes to the Action_Map SHALL only occur through modifications to the Arvore_Classificacao (see Requirement 17).
3. WHEN the operador submits a Classificacao (Motivo + Categoria + Subcategoria), THE Motor_Classificacao SHALL look up the selected path in the Arvore_Classificacao and retrieve the corresponding Status_Negocio and Destino from the leaf node.
4. WHEN the Motor_Classificacao retrieves a valid mapping, THE Motor_Classificacao SHALL persist the Status_Negocio on the Conversa record in the database.
5. WHEN the Motor_Classificacao retrieves a valid mapping, THE Motor_Classificacao SHALL persist the Motivo, Categoria, and Subcategoria on the Conversa record in the database.
6. IF the selected Subcategoria has no valid mapping in the Arvore_Classificacao, THEN THE Motor_Classificacao SHALL reject the Classificacao and display an error message to the operador.
7. FOR ALL valid leaf paths in the Arvore_Classificacao, persisting a Classificacao and then reading the Conversa record SHALL return the same Status_Negocio and Destino as defined in the Arvore_Classificacao leaf node (round-trip property).

### Requisito 10: Remoção da Conversa da Sidebar após Classificação (Sidebar Exit Event)

**User Story:** Como operador, eu quero que a conversa desapareça da Sidebar assim que eu salvar a classificação, para que a lista reflita apenas conversas que ainda precisam de ação.

#### Critérios de Aceitação

1. WHEN a Classificacao is saved for a Conversa, THE Sidebar SHALL remove that Conversa from the displayed list.
2. WHEN a Classificacao is saved for the currently selected Conversa, THE Sidebar SHALL clear the selection state (deselect the Conversa).
3. THE Sidebar SHALL remove the Conversa from the list without requiring a full page reload or manual refresh.
4. WHEN a Conversa is removed from the Sidebar after Classificacao, THE Sidebar SHALL recalculate and update all Contadores and Filtro_Pills.
5. IF the Classificacao persistence fails, THEN THE Sidebar SHALL keep the Conversa in the list and display an error message to the operador.

### Requisito 11: Integração com Backoffice

**User Story:** Como gestor, eu quero que conversas classificadas com destino `backoffice` apareçam automaticamente no módulo de Backoffice, para que a equipe de acompanhamento tenha visibilidade imediata do pipeline.

#### Critérios de Aceitação

1. WHEN the Motor_Classificacao determines that the Destino is `backoffice`, THE Motor_Classificacao SHALL create or update an item in the Backoffice module for that Conversa.
2. THE Backoffice item SHALL contain the Conversa identifier, the Status_Negocio, the Segmento, the Assunto, and the timestamp of the Classificacao.
3. WHEN a Backoffice item already exists for a Conversa, THE Motor_Classificacao SHALL update the existing item with the new Status_Negocio, Segmento, and Assunto instead of creating a duplicate.
4. WHEN the Motor_Classificacao determines that the Destino is `encerrado`, THE Motor_Classificacao SHALL not create or update any Backoffice item.
5. IF the Backoffice item creation or update fails, THEN THE Motor_Classificacao SHALL log the error and notify the operador that the routing to Backoffice failed.
6. THE Backoffice module SHALL group items by Status_Negocio for pipeline visualization.

### Requisito 12: Ciclo de Vida de Status de Negócio (Business State Lifecycle)

**User Story:** Como gestor, eu quero que o status de negócio de uma conversa seja separado do status temporal da Sidebar, para que eu acompanhe o progresso comercial independentemente da atividade de mensagens.

#### Critérios de Aceitação

1. THE Motor_Classificacao SHALL maintain Status_Negocio as a field separate from Status_Conversa on the Conversa record.
2. THE Status_Negocio SHALL accept only the following values: `aguardando_agendamento`, `reuniao_agendada`, `aguardando_proposta`, `negociacao`, `aguardando_contrato`, `fechado`, `perdido`.
3. WHEN a Classificacao is saved, THE Motor_Classificacao SHALL set the Status_Negocio according to the Action_Map without modifying the Status_Conversa.
4. THE Sidebar SHALL continue to use Status_Conversa (derived from `ultima_msg_em` and `diffHours`) for filtering and ordering, independent of Status_Negocio.
5. THE Backoffice module SHALL use Status_Negocio for filtering and displaying the pipeline of Conversas.
6. WHEN the Status_Negocio is updated, THE Motor_Classificacao SHALL record the previous Status_Negocio and the timestamp of the transition for audit purposes.

### Requisito 13: Reengajamento por Inatividade (7 Dias)

**User Story:** Como operador, eu quero que conversas inativas por 7 dias ou mais sejam automaticamente sinalizadas para reengajamento, para que eu não perca oportunidades por falta de acompanhamento.

#### Critérios de Aceitação

1. WHEN `diffDays` (difference in elapsed days between the current time and `ultima_msg_em`) is greater than or equal to 7, THE Classificador SHALL assign the Status_Conversa `inativo` to the Conversa.
2. WHEN a Conversa receives the Status_Conversa `inativo`, THE Motor_Classificacao SHALL move the Conversa to the re-engagement flow.
3. THE Sidebar SHALL not display Conversas with Status_Conversa `inativo` in the default list view.
4. WHEN a Conversa with Status_Conversa `inativo` receives a new message from the client, THE Classificador SHALL reclassify the Conversa based on the updated `ultima_msg_em` and return the Conversa to the Sidebar.
5. IF `ultima_msg_em` is null and the elapsed days since `created_at` is greater than or equal to 7, THEN THE Classificador SHALL assign the Status_Conversa `inativo` to the Conversa.

### Requisito 14: Máquina de Estados de Negócio (Business State Machine)

**User Story:** Como gestor, eu quero que as transições de status de negócio sigam regras formais de máquina de estados, para que o pipeline comercial seja consistente e auditável.

#### Critérios de Aceitação

1. THE Maquina_Estados SHALL enforce the following valid transitions for Status_Negocio: `aguardando_agendamento` may transition to `reuniao_agendada` or `perdido`; `reuniao_agendada` may transition to `aguardando_proposta` or `perdido`; `aguardando_proposta` may transition to `negociacao`, `aguardando_proposta` (via `ajustar_proposta`), or `perdido`; `negociacao` may transition to `aguardando_contrato` or `perdido`; `aguardando_contrato` may transition to `fechado` or `perdido`.
2. THE Maquina_Estados SHALL treat `fechado` as a terminal state that does not allow any outgoing transitions.
3. THE Maquina_Estados SHALL treat `perdido` as a terminal state, except that a `reengajar` action may transition `perdido` back to `aguardando_agendamento`.
4. IF a requested Status_Negocio transition is not in the set of valid transitions, THEN THE Maquina_Estados SHALL reject the transition and return an error indicating the current state and the attempted target state.
5. WHEN a Status_Negocio transition is executed, THE Maquina_Estados SHALL record an audit entry containing the Conversa identifier, the previous Status_Negocio, the new Status_Negocio, the timestamp of the transition, and the operator identifier.
6. WHEN the `reengajar` action is applied to a Conversa with Status_Negocio `perdido`, THE Maquina_Estados SHALL transition the Status_Negocio to `aguardando_agendamento` and set the Destino to `sidebar`, returning the Conversa to the Sidebar.
7. FOR ALL valid transitions defined in the Maquina_Estados, applying a transition and then reading the Conversa record SHALL reflect the new Status_Negocio and the audit entry (round-trip property).

### Requisito 15: Feedback Visual de Ação (Action Feedback UX)

**User Story:** Como operador, eu quero receber feedback visual imediato após salvar uma classificação, para que eu tenha confirmação de que a ação foi executada corretamente.

#### Critérios de Aceitação

1. WHEN a Classificacao is saved successfully, THE Feedback_Acao SHALL display a toast notification with a contextual message based on the Destino.
2. WHEN the Destino is `backoffice`, THE Feedback_Acao SHALL display the message "Encaminhado para operação" (or equivalent contextual message indicating the Conversa was routed to the Backoffice pipeline).
3. WHEN the Destino is `encerrado`, THE Feedback_Acao SHALL display the message "Lead encerrado" (or equivalent contextual message indicating the Conversa was closed).
4. WHEN the Destino is `sidebar`, THE Feedback_Acao SHALL display the message "Lead movido para sidebar" (or equivalent contextual message indicating the Conversa was returned to the Sidebar for re-engagement).
5. WHEN the Destino is `relacionamento`, THE Feedback_Acao SHALL display the message "Encaminhado para relacionamento" (or equivalent contextual message indicating the Conversa was routed to the relationship management flow).
6. THE Feedback_Acao SHALL auto-dismiss the toast notification after 3 seconds without requiring operator interaction.
7. THE Feedback_Acao SHALL not block the operator from interacting with other Conversas or UI elements while the toast is displayed.
8. IF the Classificacao persistence fails, THEN THE Feedback_Acao SHALL display an error toast notification indicating the failure, and the error toast SHALL remain visible until the operator dismisses it manually.

### Requisito 16: Módulo de Outros e Abandonados (Recovery Module)

**User Story:** Como operador, eu quero visualizar e resgatar conversas que abandonaram o fluxo da URA ou que enviaram texto livre fora da árvore do bot, para que nenhum lead seja perdido por falta de tratamento.

#### Critérios de Aceitação

1. WHEN a client starts the URA flow and does not complete the journey (does not reach Classificacao), THE Modulo_Outros_Abandonados SHALL classify that Conversa with Status_Conversa `abandonado_ura`.
2. WHEN a client sends free text outside the bot tree and the Conversa has not been classified or handled by an operator, THE Modulo_Outros_Abandonados SHALL classify that Conversa with Status_Conversa `outro_input`.
3. WHEN a Conversa is classified as `abandonado_ura`, THE Modulo_Outros_Abandonados SHALL store the Ponto_Abandono containing the URA stage, the last node accessed, and the timestamp of the abandonment.
4. THE Modulo_Outros_Abandonados SHALL display each `abandonado_ura` Conversa with the following fields: nome (if available), telefone, last message, and the stage where the client abandoned (e.g., "Selecionou Trabalhista → parou em Demissão").
5. THE Modulo_Outros_Abandonados SHALL display each `outro_input` Conversa with the following fields: nome (if available), telefone, and last message.
6. THE Modulo_Outros_Abandonados SHALL not display Conversas with Status_Conversa `abandonado_ura` or `outro_input` in the Sidebar list.
7. THE Sidebar SHALL not display Conversas with Status_Conversa `abandonado_ura` or `outro_input`.
8. THE Backoffice module SHALL not display Conversas with Status_Conversa `abandonado_ura` or `outro_input` unless the Conversa has been rescued and classified by an operator.
9. THE Modulo_Outros_Abandonados SHALL provide an action to open the Conversa in the Cockpit directly from the module list.
10. THE Modulo_Outros_Abandonados SHALL provide an action to start manual service for a Conversa directly from the module list.
11. THE Modulo_Outros_Abandonados SHALL provide an action to classify a Conversa normally (Segmento + Assunto + Próximo passo) directly from the module list.
12. WHEN an operator opens a Conversa from the Modulo_Outros_Abandonados in the Cockpit, THE Modulo_Outros_Abandonados SHALL return the Conversa to the normal service flow and remove the `abandonado_ura` or `outro_input` Status_Conversa.
13. WHEN an operator starts manual service on a Conversa from the Modulo_Outros_Abandonados, THE Modulo_Outros_Abandonados SHALL move the Conversa into the Cockpit and assign the Conversa to the operator.
14. WHEN an operator classifies a Conversa rescued from the Modulo_Outros_Abandonados, THE Motor_Classificacao SHALL follow the normal Action_Map to determine the Status_Negocio and Destino (backoffice or encerrado).
15. WHEN a Conversa is rescued by an operator (opened, serviced, or classified), THE Modulo_Outros_Abandonados SHALL remove that Conversa from the module list.
16. THE Modulo_Outros_Abandonados SHALL support sorting the list by time since abandonment in descending order (longest abandoned first).
17. THE Modulo_Outros_Abandonados SHALL support sorting the list by number of contact attempts in descending order (most attempts first).
18. THE Modulo_Outros_Abandonados SHALL maintain the `abandonado_ura` and `outro_input` lists as separate sections within the module view.
19. FOR ALL Conversas rescued from the Modulo_Outros_Abandonados and then classified, the resulting Status_Negocio and Destino SHALL match the Arvore_Classificacao leaf node definition for the selected Subcategoria (round-trip property).

### Requisito 17: Sistema de Classificação Hierárquica Configurável (Arvore_Classificacao)

**User Story:** Como owner, eu quero configurar uma árvore hierárquica de classificação com 3 níveis (Motivo → Categoria → Subcategoria), para que o sistema resolva automaticamente o Status_Negocio e o Destino com base na classificação selecionada pelo operador, sem que o operador precise escolher ações ou fluxos manualmente.

#### Critérios de Aceitação

1. THE Motor_Classificacao SHALL maintain an Arvore_Classificacao structured as a 3-level hierarchy: Motivo (level 1) → Categoria (level 2) → Subcategoria (level 3, leaf node).
2. EACH Subcategoria (leaf node) in the Arvore_Classificacao SHALL map to exactly one Status_Negocio and exactly one Destino.
3. THE Owner SHALL be able to create new nodes at any level (Motivo, Categoria, or Subcategoria) of the Arvore_Classificacao.
4. THE Owner SHALL be able to edit existing nodes at any level (Motivo, Categoria, or Subcategoria) of the Arvore_Classificacao.
5. THE Owner SHALL be able to remove nodes at any level (Motivo, Categoria, or Subcategoria) of the Arvore_Classificacao.
6. WHEN the Owner removes a Motivo node, THE Motor_Classificacao SHALL remove all child Categoria and Subcategoria nodes under that Motivo.
7. WHEN the Owner removes a Categoria node, THE Motor_Classificacao SHALL remove all child Subcategoria nodes under that Categoria.
8. WHEN the operador opens the classification interface, THE Motor_Classificacao SHALL present the available Motivo options from the Arvore_Classificacao as the first selection step.
9. WHEN the operador selects a Motivo, THE Motor_Classificacao SHALL present the available Categoria options under that Motivo as the second selection step.
10. WHEN the operador selects a Categoria, THE Motor_Classificacao SHALL present the available Subcategoria options under that Categoria as the third selection step.
11. WHEN the operador selects a Motivo + Categoria + Subcategoria, THE Motor_Classificacao SHALL look up the mapping on the selected Subcategoria leaf node, set the Status_Negocio, set the Destino, and persist the full classification path (Motivo, Categoria, Subcategoria) on the Conversa record.
12. WHEN a Classificacao is saved with a valid Subcategoria mapping, THE Sidebar SHALL remove the Conversa from the displayed list.
13. WHEN a Classificacao is saved with Destino `backoffice`, THE Motor_Classificacao SHALL route the Conversa to the Backoffice module.
14. WHEN a Classificacao is saved with Destino `encerrado`, THE Motor_Classificacao SHALL close the Conversa and set Status_Negocio to the mapped value.
15. WHEN a Classificacao is saved with Destino `relacionamento`, THE Motor_Classificacao SHALL route the Conversa to the relationship management flow.
16. IF a Subcategoria leaf node has no Status_Negocio or no Destino mapping defined, THEN THE Motor_Classificacao SHALL block saving the Classificacao and display a validation error to the operador.
17. THE Arvore_Classificacao SHALL not allow incomplete paths: every Motivo SHALL contain at least one Categoria, and every Categoria SHALL contain at least one Subcategoria with a valid mapping.
18. THE Arvore_Classificacao SHALL not allow free-text input as a classification value; the operador SHALL only select from predefined nodes in the tree.
19. IF the Owner attempts to save a Subcategoria without a Status_Negocio or Destino mapping, THEN THE Motor_Classificacao SHALL reject the save and display a validation error to the Owner.
20. IF the Owner attempts to save a Categoria with zero Subcategoria children, THEN THE Motor_Classificacao SHALL reject the save and display a validation error to the Owner.
21. IF the Owner attempts to save a Motivo with zero Categoria children, THEN THE Motor_Classificacao SHALL reject the save and display a validation error to the Owner.
22. WHEN the Owner modifies the Arvore_Classificacao, THE Motor_Classificacao SHALL regenerate the derived Action_Map from the updated leaf nodes.
23. THE Motor_Classificacao SHALL guarantee that no Conversa can be classified with an invalid or incomplete path through the Arvore_Classificacao.
24. FOR ALL valid leaf paths (Motivo + Categoria + Subcategoria) in the Arvore_Classificacao, persisting a Classificacao and then reading the Conversa record SHALL return the same Motivo, Categoria, Subcategoria, Status_Negocio, and Destino as defined in the tree (round-trip property).
