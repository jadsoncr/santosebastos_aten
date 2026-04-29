# Documento de Requisitos — Live Relationship UX

## Introdução

Este documento especifica os requisitos para refinar a tela de Relacionamento (tela1) de modo a transmitir sensação de sistema online em tempo real. O objetivo é melhorar a percepção de atividade, urgência e feedback sem alterar o layout estrutural existente. As melhorias cobrem 7 eixos: indicadores de presença, movimento controlado na lista, micro-copy contextual, feedback imediato de ações, destaque leve de prioridade, estabilidade de scroll/foco, e sincronização robusta com socket. Todas as mudanças são incrementais sobre a base existente do `ConversasSidebar.tsx`, `ChatCentral.tsx`, `SocketProvider.tsx` e `conversationStatus.ts`.

## Glossário

- **Sidebar**: O componente `ConversasSidebar` que exibe a lista de conversas na tela de atendimento (tela1).
- **Card_Conversa**: Um item individual na lista da Sidebar representando um lead com metadados de atendimento.
- **Indicador_Presenca**: Elemento visual no Card_Conversa que exibe o estado de atividade do cliente em tempo real (online, digitando, última atividade).
- **Micro_Copy**: Texto contextual curto exibido abaixo do nome do contato no Card_Conversa, derivado do status da conversa e da última interação.
- **Toast_Feedback**: Notificação visual leve e temporária exibida após uma ação do operador para confirmar que a ação foi executada.
- **Animacao_Lista**: Transição visual suave (fade/slide) aplicada quando itens da lista são reordenados ou inseridos.
- **Destaque_Prioridade**: Indicação visual discreta (peso de fonte, opacidade, badge) aplicada a Card_Conversas que requerem ação urgente.
- **Scroll_Estavel**: Comportamento que mantém a posição de scroll do operador quando a lista é atualizada, evitando saltos visuais.
- **Debounce_Socket**: Técnica de agrupamento temporal de eventos de socket para evitar atualizações visuais duplicadas ou excessivas.
- **Evento_Digitando**: Evento de socket `operador_digitando` ou `cliente_digitando` que indica que uma parte está digitando uma mensagem.
- **Status_Conversa**: Classificação temporal da conversa derivada de `getConversationStatus()`. Valores: `active`, `waiting`, `no_response`, `inativo`.
- **Classificador**: A função `getConversationStatus` que calcula o Status_Conversa.
- **ultima_msg_em**: Campo de timestamp na Conversa que indica o momento da última mensagem do cliente.
- **LeadWithMeta**: Tipo estendido de Lead usado internamente na Sidebar com metadados de classificação, status e contagem de não-lidos.
- **Socket**: Instância de Socket.io fornecida pelo `SocketProvider` para comunicação em tempo real.

## Requisitos

### Requisito 1: Indicador de Presença no Card de Conversa

**User Story:** Como operador, eu quero ver indicadores de presença em cada card de conversa, para que eu saiba instantaneamente se o cliente está online, digitando ou quando foi sua última atividade.

#### Critérios de Aceitação

1. WHEN a última interação do cliente (campo `ultima_msg_em`) ocorreu há menos de 2 minutos, THE Sidebar SHALL exibir o Indicador_Presenca "online agora" no Card_Conversa correspondente, com um dot verde de 8px ao lado do texto.
2. WHEN o Socket recebe um Evento_Digitando (`cliente_digitando`) para um lead específico, THE Sidebar SHALL exibir o Indicador_Presenca "digitando..." no Card_Conversa correspondente, substituindo temporariamente o indicador de presença anterior.
3. WHEN o Evento_Digitando não é renovado dentro de 3 segundos, THE Sidebar SHALL reverter o Indicador_Presenca para o estado anterior (online ou última atividade).
4. WHEN a última interação do cliente ocorreu há 2 minutos ou mais e o cliente não está digitando, THE Sidebar SHALL exibir o Indicador_Presenca "última atividade: X min" (ou "X h", "X d") no Card_Conversa correspondente.
5. THE Sidebar SHALL atualizar os Indicadores_Presenca a cada 30 segundos para manter os tempos relativos atualizados.
6. THE Sidebar SHALL renderizar o Indicador_Presenca como texto de 10px com opacidade reduzida (60-70%), sem alterar o layout estrutural do Card_Conversa.

### Requisito 2: Movimento Controlado na Lista

**User Story:** Como operador, eu quero que a lista de conversas se atualize com animações suaves quando itens mudam de posição, para que eu não perca o contexto visual durante atualizações em tempo real.

#### Critérios de Aceitação

1. WHEN um Card_Conversa muda de posição na lista (por reordenação), THE Sidebar SHALL aplicar uma Animacao_Lista de transição suave com duração entre 200 e 300 milissegundos.
2. WHEN um cliente responde a uma conversa (evento `nova_mensagem_salva` de origem cliente), THE Sidebar SHALL reposicionar o Card_Conversa correspondente para o topo da lista com Animacao_Lista.
3. WHEN uma nova mensagem chega para uma conversa (evento `nova_mensagem_salva`), THE Sidebar SHALL reposicionar o Card_Conversa correspondente para o topo da lista com Animacao_Lista.
4. THE Sidebar SHALL utilizar apenas transições CSS (transform, opacity) para a Animacao_Lista, sem animações pesadas de layout (reflow).
5. THE Sidebar SHALL não aplicar animação quando a lista é carregada pela primeira vez (initial render).
6. IF mais de 3 itens mudam de posição simultaneamente, THEN THE Sidebar SHALL aplicar um fade geral de 150ms em vez de animar cada item individualmente, para evitar ruído visual.

### Requisito 3: Contexto de Ação (Micro Copy)

**User Story:** Como operador, eu quero ver textos contextuais curtos abaixo do nome do contato, para que eu entenda rapidamente o estado de cada conversa sem precisar abri-la.

#### Critérios de Aceitação

1. WHEN o Status_Conversa retornado por `getConversationStatus()` é `active` e a última mensagem foi enviada pelo cliente, THE Sidebar SHALL exibir o Micro_Copy "Cliente respondeu agora" no Card_Conversa.
2. WHEN o Status_Conversa é `waiting` (8-34h sem resposta), THE Sidebar SHALL exibir o Micro_Copy "Aguardando sua resposta" no Card_Conversa.
3. WHEN o Status_Conversa é `no_response` (34h+ sem resposta), THE Sidebar SHALL exibir o Micro_Copy "Sem resposta há X horas" no Card_Conversa, onde X é o valor de `diffHours` arredondado para o inteiro mais próximo.
4. WHEN `diffHours` do Status_Conversa `no_response` é maior ou igual a 48, THE Sidebar SHALL exibir o Micro_Copy "Sem resposta há X dias" em vez de horas, onde X é o valor de `diffDays` arredondado para o inteiro mais próximo.
5. THE Sidebar SHALL exibir o Micro_Copy na mesma linha onde atualmente é exibido o preview da última mensagem, substituindo-o quando o Micro_Copy estiver ativo.
6. THE Sidebar SHALL estilizar o Micro_Copy "Aguardando sua resposta" com cor de alerta (warning) e o Micro_Copy "Sem resposta há X horas/dias" com cor neutra (text-muted), sem usar cores fortes.
7. THE Sidebar SHALL derivar o Micro_Copy exclusivamente dos dados já disponíveis em `LeadWithMeta._conversationStatus` e `ultima_msg_em`, sem consultas adicionais ao banco de dados.

### Requisito 4: Feedback Imediato de Ações

**User Story:** Como operador, eu quero receber feedback visual imediato após qualquer ação que eu execute, para que eu tenha certeza de que a ação foi registrada pelo sistema.

#### Critérios de Aceitação

1. WHEN o operador envia uma mensagem via ChatCentral, THE ChatCentral SHALL exibir a mensagem na lista de mensagens instantaneamente (optimistic update) antes da confirmação do servidor.
2. WHEN o operador assume um lead (evento `assumir_lead`), THE Sidebar SHALL aplicar uma mudança visual instantânea no Card_Conversa (ex: badge "Atendimento Humano") antes da confirmação do servidor.
3. WHEN qualquer ação do operador é confirmada pelo servidor, THE Sistema SHALL exibir um Toast_Feedback leve com duração de 2 a 3 segundos.
4. THE Toast_Feedback SHALL ser posicionado no canto inferior direito da tela, com estilo discreto (fundo semi-transparente, texto pequeno, sem ícones pesados).
5. THE Toast_Feedback SHALL não bloquear a interação do operador com outros elementos da interface enquanto estiver visível.
6. IF a ação do operador falhar (erro do servidor ou timeout de 5 segundos), THEN THE Sistema SHALL exibir um Toast_Feedback de erro que permanece visível até o operador dispensá-lo manualmente.
7. WHEN o operador envia uma mensagem com optimistic update e o servidor confirma, THE ChatCentral SHALL não duplicar a mensagem na lista (deduplicação por ID).

### Requisito 5: Destaque de Prioridade (Leve)

**User Story:** Como operador, eu quero que conversas que requerem ação urgente tenham destaque visual discreto, para que eu identifique prioridades sem poluição visual.

#### Critérios de Aceitação

1. WHEN um Card_Conversa tem `unreadCount` maior que 0, THE Sidebar SHALL renderizar o nome do contato com font-weight semibold (600) em vez do peso padrão (500).
2. WHEN um Card_Conversa tem Status_Conversa `waiting` (aguardando resposta do operador), THE Sidebar SHALL renderizar o Card_Conversa com opacidade total (1.0), enquanto cards sem urgência SHALL ter opacidade reduzida (0.7).
3. WHEN um Card_Conversa tem `unreadCount` maior que 0, THE Sidebar SHALL exibir um badge discreto com o número de mensagens não lidas, posicionado ao lado do timestamp, com fundo accent/10 e texto accent.
4. THE Sidebar SHALL não utilizar cores fortes, bordas grossas ou ícones animados para indicar prioridade.
5. WHEN um Card_Conversa tem Status_Conversa `active` e `unreadCount` igual a 0, THE Sidebar SHALL renderizar o Card_Conversa com estilo padrão sem nenhum destaque adicional.
6. THE Sidebar SHALL aplicar os destaques de prioridade de forma cumulativa: um Card_Conversa com `unreadCount > 0` e Status_Conversa `waiting` SHALL receber tanto o font-weight semibold quanto a opacidade total.

### Requisito 6: Scroll Estável e Foco

**User Story:** Como operador, eu quero que a posição de scroll da lista seja mantida quando atualizações chegam, para que eu não perca meu lugar na lista durante o trabalho.

#### Critérios de Aceitação

1. WHEN a lista de conversas é atualizada via socket (nova mensagem, lead assumido, etc.), THE Sidebar SHALL manter a posição de scroll atual do operador sem resetar para o topo.
2. WHEN um Card_Conversa é reposicionado para o topo da lista e o operador está com scroll no topo (scrollTop < 50px), THE Sidebar SHALL aplicar um highlight temporário (background sutil por 1.5 segundos) no Card_Conversa que subiu.
3. WHEN um Card_Conversa é reposicionado para o topo da lista e o operador está com scroll abaixo do topo (scrollTop >= 50px), THE Sidebar SHALL não fazer scroll automático, mas SHALL exibir um indicador discreto no topo da lista informando "Nova atividade acima".
4. WHEN o operador clica no indicador "Nova atividade acima", THE Sidebar SHALL fazer scroll suave até o topo da lista.
5. THE Sidebar SHALL não resetar a lista completa (re-render total) quando um único item é atualizado; SHALL aplicar atualizações incrementais.
6. IF o operador está visualizando uma conversa selecionada e a lista é atualizada, THEN THE Sidebar SHALL manter a seleção visual no Card_Conversa selecionado.

### Requisito 7: Sincronização Robusta com Socket

**User Story:** Como operador, eu quero que as atualizações via socket sejam processadas de forma robusta, para que eu não veja duplicações, itens fantasma ou flickering na lista.

#### Critérios de Aceitação

1. WHEN múltiplos eventos de socket chegam em intervalo menor que 300ms para o mesmo lead, THE Sidebar SHALL aplicar Debounce_Socket agrupando as atualizações e processando apenas o estado final.
2. WHEN um Card_Conversa é removido da lista (evento `conversa_classificada` ou `lead_encerrado`), THE Sidebar SHALL garantir que o Card_Conversa não reapareça na próxima atualização de lista, mantendo um registro local de IDs removidos até o próximo carregamento completo.
3. WHEN o Socket reconecta após uma desconexão, THE Sidebar SHALL fazer um reload incremental da lista (delta) em vez de recarregar todos os dados, para evitar flickering.
4. THE Sidebar SHALL não executar `loadLeads()` (reload completo do banco) para cada evento de socket individual; SHALL aplicar atualizações pontuais no estado local quando possível.
5. WHEN um evento `nova_mensagem_salva` chega para um lead que já está na lista, THE Sidebar SHALL atualizar apenas os campos relevantes do Card_Conversa (ultima_msg_em, lastMessage, unreadCount) sem recriar o objeto LeadWithMeta completo.
6. IF o Socket emite um evento para um lead_id que não existe na lista local, THEN THE Sidebar SHALL ignorar o evento silenciosamente em vez de adicionar um Card_Conversa incompleto.
7. THE Sidebar SHALL processar eventos de socket na ordem de chegada, sem reordenar eventos atrasados que chegam fora de sequência.

### Requisito 8: Evento de Socket para Cliente Digitando

**User Story:** Como operador, eu quero que o servidor emita um evento quando o cliente está digitando, para que o indicador de presença "digitando..." funcione em tempo real.

#### Critérios de Aceitação

1. WHEN o servidor recebe uma indicação de que o cliente está digitando (via webhook do canal de mensagens), THE Socket SHALL emitir o evento `cliente_digitando` com payload `{ lead_id: string }`.
2. THE Socket SHALL emitir o evento `cliente_digitando` apenas para operadores conectados que têm o lead correspondente na lista da Sidebar.
3. THE Socket SHALL não emitir o evento `cliente_digitando` mais de uma vez a cada 2 segundos para o mesmo lead_id, aplicando throttle no servidor.
4. IF o canal de mensagens (WhatsApp/Telegram) não suporta eventos de digitação, THEN THE Socket SHALL não emitir o evento `cliente_digitando` para leads desse canal.

### Requisito 9: Preservação do Layout Estrutural

**User Story:** Como desenvolvedor, eu quero que todas as melhorias de UX sejam implementadas sem alterar o layout estrutural existente, para que a mudança seja segura e não quebre funcionalidades existentes.

#### Critérios de Aceitação

1. THE Sidebar SHALL manter o layout existente de Card_Conversa: avatar à esquerda, nome + timestamp à direita, preview abaixo, border-left por score de propensão.
2. THE Sidebar SHALL não adicionar novos componentes React ao component tree existente; todas as melhorias SHALL ser implementadas como elementos inline dentro dos componentes existentes.
3. THE Sidebar SHALL não modificar a interface `Lead` definida em `page.tsx` nem o schema do banco de dados.
4. THE Sidebar SHALL não adicionar animações pesadas (keyframes complexos, transforms 3D, parallax) que possam impactar a performance em listas longas.
5. THE ChatCentral SHALL manter a estrutura existente de header, pipeline progress, messages list e input area sem alterações de layout.
6. THE Sistema SHALL não transformar a tela de Relacionamento em um dashboard; SHALL manter o foco em lista de conversas + chat + painel lateral.
