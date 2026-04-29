# Documento de Requisitos — Backoffice Case Mode

## Introdução

Este documento especifica os requisitos para transformar o Backoffice (tela2) de uma lista plana de leads em um ambiente de "Case Mode" com layout de 3 colunas, onde o operador abre um caso, visualiza o contexto completo, conversa via chat e executa próximos passos guiados. A mudança é fundamentalmente de layout e composição — reutilizando componentes existentes (ChatCentral, businessStateMachine, validateBusinessTransition) sem criar lógica nova. O objetivo é dar ao operador de backoffice a mesma experiência imersiva da tela1, adaptada ao fluxo de negócio (status_negocio).

## Glossário

- **Backoffice_CaseMode**: O módulo que implementa o layout de 3 colunas na tela2, composto por Lista_Casos, Visualizacao_Caso e Painel_Acoes.
- **Lista_Casos**: Coluna esquerda do layout que exibe a lista de leads com status_negocio definido, permitindo seleção de um caso para visualização.
- **Visualizacao_Caso**: Coluna central do layout que reutiliza o componente ChatCentral para exibir o chat do caso selecionado.
- **Painel_Acoes**: Coluna direita do layout que exibe o contexto do caso e os próximos passos guiados baseados no status_negocio atual.
- **Caso**: Um lead com atendimento ativo no backoffice, identificado por um registro na tabela `atendimentos` com `status_negocio` definido (não nulo).
- **Operador**: Usuário autenticado que interage com os casos no backoffice.
- **Status_Negocio**: Campo da tabela `atendimentos` que representa o estágio atual do caso no funil de negócio. Valores possíveis: `aguardando_agendamento`, `reuniao_agendada`, `aguardando_proposta`, `negociacao`, `aguardando_contrato`, `fechado`, `perdido`.
- **Proximo_Passo**: Ação guiada apresentada no Painel_Acoes que avança o caso para o próximo Status_Negocio no pipeline linear, conforme definido no businessStateMachine.
- **ChatCentral**: Componente existente em `tela1/components/ChatCentral.tsx` que renderiza o chat completo de um lead (histórico, envio de mensagens, upload de arquivos, notas internas, socket listeners).
- **BusinessStateMachine**: Módulo existente em `utils/businessStateMachine.ts` que define transições válidas de Status_Negocio e fornece funções `validateBusinessTransition` e `getNextStatus`.
- **Cards_Resumo**: Cards de métricas exibidos no topo da tela2 (Em Negociação, Reuniões Agendadas, Contratos Fechados, Taxa de Perda).
- **Modulo_Recuperacao**: Seção existente na tela2 que exibe leads abandonados e "outros" para resgate.
- **Responsavel**: Operador atribuído ao caso, identificado pelo campo `owner_id` na tabela `atendimentos`, com nome real obtido da view `operadores`.

## Requisitos

### Requisito 1: Layout de 3 Colunas do Case Mode

**User Story:** Como operador de backoffice, eu quero visualizar os casos em um layout de 3 colunas (lista, chat, ações), para que eu possa trabalhar em cada caso com contexto completo sem navegar entre páginas.

#### Critérios de Aceitação

1. WHEN the Operador navigates to tela2, THE Backoffice_CaseMode SHALL render a 3-column layout containing the Lista_Casos on the left, the Visualizacao_Caso in the center, and the Painel_Acoes on the right.
2. THE Backoffice_CaseMode SHALL render the Cards_Resumo above the 3-column layout, preserving the existing summary metrics (Em Negociação, Reuniões Agendadas, Contratos Fechados, Taxa de Perda).
3. THE Backoffice_CaseMode SHALL render the Modulo_Recuperacao below the 3-column layout, preserving the existing recovery section for abandoned leads and "outros".
4. WHEN no Caso is selected, THE Visualizacao_Caso SHALL display a placeholder message instructing the Operador to select a case from the Lista_Casos.
5. WHEN no Caso is selected, THE Painel_Acoes SHALL display a placeholder message indicating that no case is selected.

### Requisito 2: Lista de Casos (Coluna Esquerda)

**User Story:** Como operador de backoffice, eu quero ver a lista de casos filtrada por status_negocio com informações visuais de prioridade, para que eu possa identificar rapidamente qual caso precisa de atenção.

#### Critérios de Aceitação

1. THE Lista_Casos SHALL display all leads that have a non-null Status_Negocio in the `atendimentos` table.
2. THE Lista_Casos SHALL display for each Caso: the lead name (or phone number as fallback), the segment (`area_bot` or `area`), the name of the Responsavel (from the `operadores` view), and a badge indicating the current Status_Negocio.
3. WHEN the Operador clicks on a Caso in the Lista_Casos, THE Backoffice_CaseMode SHALL select that Caso, loading the chat in the Visualizacao_Caso and the context in the Painel_Acoes.
4. THE Lista_Casos SHALL visually distinguish the currently selected Caso from the other cases using a highlighted border or background.
5. THE Lista_Casos SHALL group cases by Status_Negocio, displaying a section header with the status label and count for each group.
6. WHEN a `status_negocio_changed` socket event is received, THE Lista_Casos SHALL update the affected Caso position and badge in real time without requiring a page reload.
7. WHEN a `conversa_classificada` socket event is received with `destino` equal to "backoffice", THE Lista_Casos SHALL add the new Caso to the list in real time.
8. WHEN an `assignment_updated` socket event is received, THE Lista_Casos SHALL update the Responsavel name of the affected Caso in real time.

### Requisito 3: Visualização do Caso com Chat (Coluna Central)

**User Story:** Como operador de backoffice, eu quero ver o chat completo do caso selecionado diretamente no backoffice, para que eu possa conversar com o cliente e acompanhar o histórico sem sair da tela.

#### Critérios de Aceitação

1. WHEN a Caso is selected in the Lista_Casos, THE Visualizacao_Caso SHALL render the ChatCentral component passing the selected lead as prop.
2. THE Visualizacao_Caso SHALL support all existing ChatCentral functionality: displaying message history, sending text messages, sending internal notes, uploading files, and displaying file and audio messages.
3. THE Visualizacao_Caso SHALL maintain all existing socket listeners from ChatCentral: `nova_mensagem_salva`, `erro_assumir`, `pipeline_error`, presence events (`user_viewing`, `user_left`, `viewing_update`), and `assignment_updated`.
4. WHEN the Operador selects a different Caso in the Lista_Casos, THE Visualizacao_Caso SHALL unload the previous chat and load the chat for the newly selected Caso.
5. THE Visualizacao_Caso SHALL display the Quick Replies (`/` shortcut) and Smart Snippets features as they exist in the ChatCentral component.

### Requisito 4: Painel de Ações com Próximos Passos Guiados (Coluna Direita)

**User Story:** Como operador de backoffice, eu quero ver o contexto do caso e os próximos passos guiados baseados no status atual, para que eu saiba exatamente qual ação tomar sem precisar lembrar o fluxo de negócio.

#### Critérios de Aceitação

1. WHEN a Caso is selected, THE Painel_Acoes SHALL display the case context: lead name, segment, Responsavel name, current Status_Negocio label, and the elapsed time since the last action (`assumido_em`).
2. WHEN a Caso is selected, THE Painel_Acoes SHALL display the classification information (motivo, categoria, subcategoria) when available in the `atendimentos` record.
3. WHEN the current Status_Negocio is `aguardando_agendamento`, THE Painel_Acoes SHALL display the guided action "Confirmar reunião" that transitions the Caso to `reuniao_agendada`.
4. WHEN the current Status_Negocio is `reuniao_agendada`, THE Painel_Acoes SHALL display the guided action "Enviar proposta" that transitions the Caso to `aguardando_proposta`.
5. WHEN the current Status_Negocio is `aguardando_proposta`, THE Painel_Acoes SHALL display the guided action "Iniciar negociação" that transitions the Caso to `negociacao`.
6. WHEN the current Status_Negocio is `negociacao`, THE Painel_Acoes SHALL display the guided action "Gerar contrato" that transitions the Caso to `aguardando_contrato`.
7. WHEN the current Status_Negocio is `aguardando_contrato`, THE Painel_Acoes SHALL display the guided action "Fechar contrato" that transitions the Caso to `fechado`.
8. WHEN the current Status_Negocio is not `fechado` and not `perdido`, THE Painel_Acoes SHALL display the action "Desistiu" that transitions the Caso to `perdido`.
9. WHEN the current Status_Negocio is `perdido`, THE Painel_Acoes SHALL display the action "Reengajar" that transitions the Caso to `aguardando_agendamento`.
10. WHEN the current Status_Negocio is `fechado`, THE Painel_Acoes SHALL display a visual indicator that the case is closed and SHALL NOT display any transition actions.

### Requisito 5: Ação = Mensagem + Mudança de Estado

**User Story:** Como operador de backoffice, eu quero que cada ação de avanço de status opcionalmente envie uma mensagem via chat e registre a transição com auditoria completa, para que o histórico do caso reflita todas as decisões tomadas.

#### Critérios de Aceitação

1. WHEN the Operador executes a guided action in the Painel_Acoes, THE Backoffice_CaseMode SHALL validate the transition using the `validateBusinessTransition` function from the BusinessStateMachine before applying the change.
2. IF the `validateBusinessTransition` function returns `allowed: false`, THEN THE Backoffice_CaseMode SHALL display the error message returned by the function and SHALL NOT apply the status change.
3. WHEN a valid transition is executed, THE Backoffice_CaseMode SHALL update the `status_negocio` field in the `atendimentos` table to the target status.
4. WHEN a valid transition is executed, THE Backoffice_CaseMode SHALL insert an audit record in the `status_transitions` table containing: `atendimento_id`, `status_anterior`, `status_novo`, `operador_id`, and the current timestamp.
5. WHEN a valid transition is executed, THE Backoffice_CaseMode SHALL emit a `status_negocio_changed` socket event containing: `lead_id`, `status_anterior`, `status_novo`, and `operador_id`.
6. WHEN the Operador executes a guided action, THE Painel_Acoes SHALL provide an optional text input field that allows the Operador to compose a message to be sent via the chat simultaneously with the status change.
7. WHEN the Operador provides a message text along with a guided action, THE Backoffice_CaseMode SHALL emit a `nova_mensagem` socket event with the message content before applying the status change.
8. WHEN the "Reengajar" action is executed on a Caso with Status_Negocio `perdido`, THE Backoffice_CaseMode SHALL update the `status_negocio` to `aguardando_agendamento` and emit a `conversa_resgatada` socket event.

### Requisito 6: Contexto Sempre Visível

**User Story:** Como operador de backoffice, eu quero que as informações essenciais do caso estejam sempre visíveis no painel de ações, para que eu tenha contexto completo ao tomar decisões sem precisar buscar informações em outros lugares.

#### Critérios de Aceitação

1. THE Painel_Acoes SHALL display the Responsavel name obtained from the `operadores` view (real name, not the user ID).
2. THE Painel_Acoes SHALL display the elapsed time since the last action in a human-readable format (e.g., "2h", "3d", "agora").
3. THE Painel_Acoes SHALL display the current Status_Negocio with a localized label in Portuguese (e.g., "Aguardando Agendamento", "Reunião Agendada", "Negociação").
4. WHEN the Caso has classification data (motivo_id, categoria_id, subcategoria_id), THE Painel_Acoes SHALL display the classification labels resolved from the `segment_trees` table.
5. WHEN the Responsavel of the selected Caso changes via socket event, THE Painel_Acoes SHALL update the displayed Responsavel name in real time.
6. WHEN the Status_Negocio of the selected Caso changes via socket event, THE Painel_Acoes SHALL update the displayed status label and the available guided actions in real time.

### Requisito 7: Preservação de Funcionalidades Existentes

**User Story:** Como operador de backoffice, eu quero que todas as funcionalidades existentes da tela2 continuem funcionando após a transformação para Case Mode, para que nenhuma capacidade operacional seja perdida.

#### Critérios de Aceitação

1. THE Backoffice_CaseMode SHALL preserve all existing socket listeners from the current tela2: `conversa_classificada`, `status_negocio_changed`, and `assignment_updated`.
2. THE Backoffice_CaseMode SHALL preserve all existing action handlers from the current tela2: `handleTransition`, `handleAvancar`, `handleFechar`, `handleDesistiu`, and `handleReengajar`.
3. THE Backoffice_CaseMode SHALL preserve the existing data loading logic that fetches atendimentos with non-null `status_negocio` and merges them with lead data.
4. THE Backoffice_CaseMode SHALL preserve the existing toast notification system for action feedback (success and error messages).
5. THE Backoffice_CaseMode SHALL reuse the ChatCentral component from `tela1/components/ChatCentral.tsx` without modifying the component source code, passing the selected lead as the `lead` prop.
6. THE Backoffice_CaseMode SHALL reuse the `validateBusinessTransition` and `getNextStatus` functions from the BusinessStateMachine without modifying the module source code.
7. THE Backoffice_CaseMode SHALL preserve the existing recovery module (abandonados and outros) with the `handleRescue` function that navigates to tela1.
