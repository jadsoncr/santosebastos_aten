# Documento de Requisitos — Atribuição Colaborativa sem Bloqueios

## Introdução

Este documento especifica os requisitos para o sistema de atribuição colaborativa sem bloqueios, com transparência total e presença em tempo real. O objetivo é permitir que qualquer usuário da organização interaja com qualquer caso a qualquer momento, sem restrições de permissão ou bloqueios de concorrência, garantindo visibilidade completa sobre quem é o responsável atual, quem está visualizando cada caso, e mantendo um histórico completo (audit trail) de todas as atribuições, delegações e interações. O sistema é colaborativo, não competitivo: nenhuma ação é impedida, e toda mudança de responsabilidade é registrada e visível para todos os operadores.

## Glossário

- **Sistema_Atribuicao**: O módulo responsável por gerenciar a atribuição de responsáveis aos casos (leads/atendimentos), incluindo a lógica de assumir, delegar e registrar mudanças.
- **Caso**: Uma entrada na tabela `atendimentos` representando um lead em atendimento, identificado por `lead_id`.
- **Responsavel**: O operador atualmente atribuído a um Caso, armazenado no campo `owner_id` da tabela `atendimentos`.
- **Operador**: Um usuário autenticado da organização que pode interagir com qualquer Caso.
- **Card_Conversa**: O item visual na Sidebar (ConversasSidebar) que representa um Caso na lista de conversas.
- **Indicador_Presenca**: Elemento visual em tempo real que mostra quais Operadores estão visualizando um determinado Caso no momento.
- **Aviso_Responsavel**: Notificação leve (não bloqueante) exibida quando um Operador tenta assumir um Caso que já possui um Responsavel atribuído.
- **Historico_Atribuicao**: Registro completo de todas as mudanças de responsabilidade de um Caso, armazenado na tabela `status_transitions` e/ou em uma tabela dedicada de audit trail.
- **Sidebar**: O componente `ConversasSidebar` que exibe a lista de conversas na tela de atendimento.
- **Chat_Central**: O componente `ChatCentral` que exibe o chat do Caso selecionado.
- **Socket_Presenca**: Canal de comunicação via Socket.io utilizado para transmitir eventos de presença em tempo real entre Operadores.
- **Evento_Assumir**: Evento emitido via socket quando um Operador assume a responsabilidade de um Caso (`assumir_lead`).
- **Evento_Presenca**: Evento emitido via socket quando um Operador abre ou fecha a visualização de um Caso.

## Requisitos

### Requisito 1: Responsável Atual do Caso

**User Story:** Como operador, eu quero que cada caso tenha um responsável atual claramente definido e que esse responsável possa ser alterado a qualquer momento por qualquer operador, para que a responsabilidade seja fluida e sem burocracia.

#### Critérios de Aceitação

1. THE Sistema_Atribuicao SHALL store the current Responsavel of each Caso in the `owner_id` field of the `atendimentos` table.
2. WHEN an Operador assumes a Caso, THE Sistema_Atribuicao SHALL update the `owner_id` field to the identifier of that Operador.
3. WHEN the `owner_id` of a Caso is updated, THE Sistema_Atribuicao SHALL record the previous `owner_id` value and the new `owner_id` value in the Historico_Atribuicao before persisting the change.
4. THE Sistema_Atribuicao SHALL allow any authenticated Operador to change the Responsavel of any Caso without requiring approval or special permissions.
5. WHEN a Caso has no Responsavel (`owner_id` is null), THE Sistema_Atribuicao SHALL allow any Operador to assume the Caso by setting `owner_id` to the Operador identifier.

### Requisito 2: Visibilidade do Responsável e Última Ação no Card

**User Story:** Como operador, eu quero ver no card de cada conversa quem é o responsável atual e qual foi a última ação realizada (por quem e quando), para que eu tenha contexto imediato sem precisar abrir o caso.

#### Critérios de Aceitação

1. THE Card_Conversa SHALL display the name of the current Responsavel of the Caso.
2. WHEN the Caso has no Responsavel (`owner_id` is null), THE Card_Conversa SHALL display the text "Sem responsável" or equivalent placeholder.
3. THE Card_Conversa SHALL display the last action performed on the Caso, including the name of the Operador who performed the action and the elapsed time since the action.
4. WHEN the Responsavel of a Caso changes via socket event, THE Card_Conversa SHALL update the displayed Responsavel name in real time without requiring a page reload.
5. THE Sidebar SHALL display the Responsavel information for all Casos visible to all Operadores, regardless of which Operador is the current Responsavel.

### Requisito 3: Presença em Tempo Real

**User Story:** Como operador, eu quero ver em tempo real quais colegas estão visualizando o mesmo caso que eu, para que eu tenha consciência de quem está trabalhando no mesmo contexto e evite esforço duplicado.

#### Critérios de Aceitação

1. WHEN an Operador opens a Caso (selects it in the Sidebar), THE Socket_Presenca SHALL emit an Evento_Presenca containing the Caso identifier and the Operador identifier and name.
2. WHEN an Operador closes a Caso (navigates away or selects another Caso), THE Socket_Presenca SHALL emit an Evento_Presenca indicating that the Operador is no longer viewing that Caso.
3. WHEN an Evento_Presenca is received, THE Chat_Central SHALL display the Indicador_Presenca showing the names or avatars of all Operadores currently viewing the same Caso.
4. THE Indicador_Presenca SHALL display the text "Usuário X está visualizando" for each Operador currently viewing the Caso, where X is the name of the Operador.
5. WHEN an Operador disconnects from the socket (browser closed, network loss), THE Socket_Presenca SHALL automatically remove that Operador from the Indicador_Presenca of all Casos within 10 seconds.
6. THE Indicador_Presenca SHALL not display the current Operador viewing the Caso (only other Operadores are shown).
7. WHEN no other Operador is viewing the Caso, THE Indicador_Presenca SHALL be hidden.

### Requisito 4: Assumir Caso sem Bloqueios

**User Story:** Como operador, eu quero poder assumir qualquer caso a qualquer momento, mesmo que já tenha um responsável, para que o fluxo de trabalho nunca seja interrompido por restrições de permissão.

#### Critérios de Aceitação

1. THE Sistema_Atribuicao SHALL allow any Operador to assume any Caso, regardless of whether the Caso already has a Responsavel.
2. WHEN an Operador attempts to assume a Caso that already has a Responsavel, THE Sistema_Atribuicao SHALL display the Aviso_Responsavel containing the name of the current Responsavel.
3. THE Aviso_Responsavel SHALL be non-blocking: the Operador SHALL be able to proceed with assuming the Caso after seeing the warning, without requiring confirmation from the current Responsavel.
4. WHEN an Operador confirms assuming a Caso that already has a Responsavel, THE Sistema_Atribuicao SHALL update the `owner_id` to the new Operador and store the previous Responsavel in the `delegado_de` field.
5. THE Sistema_Atribuicao SHALL not require any special permission, role, or approval workflow to assume a Caso.
6. THE Sistema_Atribuicao SHALL not lock, disable, or restrict any action on a Caso based on who the current Responsavel is.
7. WHEN an Operador assumes a Caso, THE Sistema_Atribuicao SHALL emit the Evento_Assumir via socket so that all connected Operadores see the change in real time.

### Requisito 5: Histórico Completo de Atribuições (Audit Trail)

**User Story:** Como gestor, eu quero um registro completo de todas as mudanças de responsabilidade, delegações e interações em cada caso, para que eu tenha rastreabilidade total e possa auditar o fluxo de trabalho.

#### Critérios de Aceitação

1. WHEN an Operador assumes a Caso, THE Historico_Atribuicao SHALL record an entry containing: the Caso identifier, the previous Responsavel identifier (or null if none), the new Responsavel identifier, the type of action ("assumiu"), and the timestamp.
2. WHEN an Operador delegates a Caso to another Operador, THE Historico_Atribuicao SHALL record an entry containing: the Caso identifier, the delegating Operador identifier, the receiving Operador identifier, the type of action ("delegou"), and the timestamp.
3. WHEN an Operador performs any interaction on a Caso (sends a message, adds a note, classifies), THE Historico_Atribuicao SHALL record an entry containing: the Caso identifier, the Operador identifier, the type of interaction, and the timestamp.
4. THE Historico_Atribuicao SHALL be append-only: no entry SHALL be modified or deleted after creation.
5. THE Historico_Atribuicao SHALL be queryable by Caso identifier to retrieve the full chronological history of all attribution changes and interactions for that Caso.
6. FOR ALL attribution changes recorded in the Historico_Atribuicao, reading the entries for a Caso in chronological order SHALL reconstruct the complete sequence of Responsavel changes from the initial assignment to the current state (round-trip property).

### Requisito 6: Ausência Total de Bloqueios

**User Story:** Como operador, eu quero que o sistema nunca impeça nenhuma ação minha em nenhum caso, para que o atendimento seja colaborativo e fluido, sem barreiras artificiais.

#### Critérios de Aceitação

1. THE Sistema_Atribuicao SHALL not implement any locking mechanism that prevents an Operador from viewing, editing, or interacting with a Caso.
2. THE Sistema_Atribuicao SHALL not implement any permission-based restriction that limits which Operadores can interact with which Casos.
3. THE Sistema_Atribuicao SHALL allow multiple Operadores to send messages, add notes, and perform actions on the same Caso simultaneously.
4. THE Sistema_Atribuicao SHALL not display any "locked by user X" or "in use by user X" blocking indicator that prevents actions.
5. WHEN two Operadores attempt to assume the same Caso simultaneously, THE Sistema_Atribuicao SHALL resolve the conflict by applying the most recent assumption (last-write-wins) and recording both actions in the Historico_Atribuicao.
6. THE Sistema_Atribuicao SHALL not require the current Responsavel to release or transfer the Caso before another Operador can interact with the Caso.
7. IF the existing `assumir_lead` socket handler returns an error due to the UNIQUE constraint on `atendimentos.lead_id`, THEN THE Sistema_Atribuicao SHALL update the existing record instead of inserting a new one, ensuring the assumption always succeeds.
