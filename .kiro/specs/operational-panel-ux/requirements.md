# Documento de Requisitos — Painel Operacional UX

## Introdução

Este documento especifica os requisitos para a interface do Painel Operacional do sistema de CRM/backoffice jurídico. O princípio central é: **o operador nunca deve ter que pensar**. A interface conduz decisões, não exibe dados. O sistema segue o modelo: "a triagem entende — o tratamento decide — o backoffice executa".

O layout é composto por três colunas: SIDEBAR (conversas) | CHAT CENTRAL | PAINEL LEAD (único por cliente). O Painel Lead muda de função conforme o estado do atendimento (Triagem → Em Atendimento → Cliente → Encerrado), e cada modo exibe apenas os blocos relevantes para aquela fase.

## Glossário

- **Painel_Lead**: Componente lateral direito que exibe e permite interação com os dados de um lead/cliente selecionado. Muda de modo conforme o `estado_painel`.
- **Sidebar**: Componente lateral esquerdo que lista todas as conversas ativas, com busca, filtros e indicadores visuais.
- **Chat_Central**: Componente central que exibe o histórico de mensagens em tempo real e permite envio de mensagens e arquivos.
- **Operador**: Usuário autenticado do sistema que realiza triagem, atendimento e gestão de leads.
- **Lead**: Registro de um potencial cliente que entrou em contato via WhatsApp ou Telegram.
- **Estado_Painel**: Campo que controla o modo do Painel_Lead. Valores possíveis: `triagem`, `em_atendimento`, `cliente`, `encerrado`.
- **Tratamento**: Classificação operacional de 2 níveis (Tipo → Detalhe) que decide o destino do lead. Única entidade que define encaminhamento.
- **Classificação_Jurídica**: Classificação contextual de 3 níveis (Área → Tipo → Detalhe) que organiza o caso juridicamente. Não decide destino.
- **Dossiê**: Campo de texto livre onde o Operador registra seu entendimento do caso. Centro de verdade operacional.
- **Intenção_URA**: Intenção capturada pelo bot (URA) durante o primeiro contato. Não é verdade absoluta, é contexto.
- **Score**: Pontuação de 0 a 10 que indica a temperatura do lead (quente ≥ 7, morno ≥ 4, frio < 4).
- **resolveTreatment**: Função que recebe Tipo + Detalhe do Tratamento e retorna `destino` (backoffice/encerrado) e `status_negocio`.
- **Identity**: Registro consolidado de um cliente que pode ter múltiplos leads (cross-canal).
- **Badge_Não_Lido**: Indicador visual de mensagem não lida na Sidebar.
- **Alerta_Sem_Responsável**: Indicador visual amarelo que aparece quando um lead não tem operador atribuído.
- **Alerta_Tempo_Resposta**: Indicador visual que aparece quando um lead está sem resposta por mais de 15 minutos.

## Requisitos

### Requisito 1: Layout Principal de Três Colunas

**User Story:** Como Operador, eu quero ver sidebar, chat e painel lado a lado, para que eu tenha contexto completo sem trocar de tela.

#### Critérios de Aceitação

1. THE Painel_Lead SHALL renderizar o layout em três colunas: Sidebar (esquerda, 320px), Chat_Central (centro, flexível), Painel_Lead (direita, 360px).
2. WHILE o Operador estiver na tela de atendimento, THE Sidebar SHALL permanecer visível e interativa.
3. WHILE o Operador estiver na tela de atendimento, THE Chat_Central SHALL permanecer visível e ocupar o espaço restante entre Sidebar e Painel_Lead.
4. WHEN o Operador selecionar um lead na Sidebar, THE Painel_Lead SHALL exibir os dados do lead selecionado e THE Chat_Central SHALL exibir o histórico de mensagens do lead selecionado.
5. IF nenhum lead estiver selecionado, THEN THE Painel_Lead SHALL exibir uma mensagem indicando que nenhum lead foi selecionado.

### Requisito 2: Modos do Painel Lead por Estado

**User Story:** Como Operador, eu quero que o painel mude automaticamente conforme o estado do atendimento, para que eu veja apenas o que é relevante para cada fase.

#### Critérios de Aceitação

1. WHEN o Estado_Painel for `triagem` ou nulo, THE Painel_Lead SHALL exibir os blocos: Header, Identidade, Intenção_URA, Classificação_Jurídica, Dossiê, Tratamento, Resultado e Botão de Confirmação.
2. WHEN o Estado_Painel for `em_atendimento`, THE Painel_Lead SHALL remover os blocos de Classificação_Jurídica e Tratamento e SHALL exibir: Header, Identidade, Dossiê, Status atual, Próxima ação e Botões de ação (Confirmar reunião, Enviar proposta, Perdido).
3. WHEN o Estado_Painel for `cliente`, THE Painel_Lead SHALL exibir: Header com indicador "Cliente ativo", informações de contrato, valor e um botão "Iniciar novo atendimento".
4. WHEN o Estado_Painel for `encerrado`, THE Painel_Lead SHALL exibir: Header com indicador "Encerrado", motivo do encerramento e um botão "Reengajar".
5. WHEN o Estado_Painel mudar via atualização do banco de dados ou evento de socket, THE Painel_Lead SHALL atualizar o modo exibido em até 1 segundo sem necessidade de recarregar a página.

### Requisito 3: Header do Painel com Estado e Responsável

**User Story:** Como Operador, eu quero ver o estado atual e o responsável no topo do painel, para que eu saiba imediatamente a situação do caso.

#### Critérios de Aceitação

1. THE Painel_Lead SHALL exibir no Header o Estado_Painel atual com a cor correspondente: triagem em cinza, em_atendimento em azul, cliente em verde, encerrado em cinza claro.
2. THE Painel_Lead SHALL exibir no Header o nome do Operador responsável pelo lead, ou "Livre" quando nenhum Operador estiver atribuído.
3. WHEN o Operador clicar em "Delegar" no Header, THE Painel_Lead SHALL exibir uma lista de operadores disponíveis para delegação.
4. WHEN o Operador selecionar um operador na lista de delegação, THE Painel_Lead SHALL emitir um evento de socket `delegate_lead` com o lead_id e o operador destino.

### Requisito 4: Bloco de Identidade com Score

**User Story:** Como Operador, eu quero ver e editar os dados do cliente com indicador de temperatura, para que eu saiba quem é e qual a urgência.

#### Critérios de Aceitação

1. THE Painel_Lead SHALL exibir no bloco Identidade: nome, telefone, e-mail e Score do lead.
2. THE Painel_Lead SHALL exibir o Score com indicador visual: ícone 🔥 e label "QUENTE" com cor vermelha para score ≥ 7, ícone ⚠️ e label "MORNO" com cor amarela para score ≥ 4, ícone ❄️ e label "FRIO" com cor cinza para score < 4.
3. WHEN o Operador clicar no campo nome, telefone ou e-mail, THE Painel_Lead SHALL tornar o campo editável inline.
4. WHEN o Operador sair do campo editável (blur) ou pressionar Enter, THE Painel_Lead SHALL salvar o valor atualizado no banco de dados e atualizar a interface.
5. IF o lead possuir um identity_id, THEN THE Painel_Lead SHALL propagar a alteração de nome para todos os leads vinculados à mesma Identity.
6. WHEN o Operador clicar em "Vincular identidade", THE Painel_Lead SHALL exibir um campo de busca que pesquisa identidades por nome ou telefone e permite vincular o lead a uma Identity existente.

### Requisito 5: Bloco de Intenção do Cliente (URA)

**User Story:** Como Operador, eu quero ver o que o cliente pediu ao bot, para ter contexto inicial sem considerar como verdade absoluta.

#### Critérios de Aceitação

1. THE Painel_Lead SHALL exibir a intenção consolidada do cliente obtida via `getIntencaoAtual()`.
2. THE Painel_Lead SHALL exibir o canal de origem (WhatsApp/Telegram) e a área detectada pelo bot abaixo da intenção.
3. THE Painel_Lead SHALL exibir o bloco de Intenção_URA como somente leitura, sem permitir edição pelo Operador.


### Requisito 6: Classificação Jurídica em 3 Níveis

**User Story:** Como Operador, eu quero classificar o caso juridicamente em 3 níveis cascata, para organizar o contexto do problema sem que isso defina o destino.

#### Critérios de Aceitação

1. WHILE o Estado_Painel for `triagem`, THE Painel_Lead SHALL exibir 3 dropdowns cascata: "Área do caso" (nível 1), "Tipo do problema" (nível 2), "Detalhe do problema" (nível 3).
2. THE Painel_Lead SHALL carregar as opções dos dropdowns a partir da tabela `segment_trees` usando a função `filterChildren()`.
3. WHEN o Operador selecionar uma opção no dropdown de nível 1, THE Painel_Lead SHALL filtrar as opções do dropdown de nível 2 para exibir apenas filhos do nível 1 selecionado e SHALL limpar as seleções dos níveis 2 e 3.
4. WHEN o Operador selecionar uma opção no dropdown de nível 2, THE Painel_Lead SHALL filtrar as opções do dropdown de nível 3 para exibir apenas filhos do nível 2 selecionado e SHALL limpar a seleção do nível 3.
5. WHEN o Tratamento resultar em destino `backoffice`, THE Painel_Lead SHALL exigir que os 3 níveis da Classificação_Jurídica estejam preenchidos antes de permitir a confirmação.
6. WHEN o Tratamento for do tipo `BadCall` ou `Informação`, THE Painel_Lead SHALL permitir a confirmação sem Classificação_Jurídica preenchida.
7. WHILE o Estado_Painel for `em_atendimento`, `cliente` ou `encerrado`, THE Painel_Lead SHALL ocultar o bloco de Classificação_Jurídica.

### Requisito 7: Dossiê — Centro de Verdade

**User Story:** Como Operador, eu quero um campo de texto grande e sempre visível para registrar meu entendimento do caso, para que o dossiê seja a fonte de verdade operacional.

#### Critérios de Aceitação

1. THE Painel_Lead SHALL exibir o Dossiê como um textarea com altura mínima de 70px, placeholder "O que você entendeu do caso..." e sem limite de caracteres.
2. THE Painel_Lead SHALL exibir o Dossiê em todos os modos do painel (triagem, em_atendimento, cliente, encerrado).
3. WHEN o Operador sair do campo Dossiê (blur) e o campo contiver texto, THE Painel_Lead SHALL salvar automaticamente o conteúdo como nota interna na tabela `mensagens` com tipo `nota_interna`.
4. WHEN uma nota for salva com sucesso, THE Painel_Lead SHALL exibir um indicador "Salvo" por 1,5 segundos ao lado do título do bloco.
5. THE Painel_Lead SHALL exibir as notas anteriores abaixo do textarea, ordenadas da mais recente para a mais antiga, com conteúdo e data/hora formatados.

### Requisito 8: Classificação de Tratamento em 2 Níveis

**User Story:** Como Operador, eu quero classificar o tratamento operacional em 2 níveis, para que o sistema decida automaticamente o destino do lead.

#### Critérios de Aceitação

1. WHILE o Estado_Painel for `triagem`, THE Painel_Lead SHALL exibir 2 dropdowns: "Tipo" (nível 1) e "Detalhe" (nível 2).
2. THE Painel_Lead SHALL carregar os tipos de tratamento a partir de `TREATMENT_TIPOS`: Informação, Solicitação, Retorno, BadCall.
3. WHEN o Operador selecionar um tipo, THE Painel_Lead SHALL filtrar as opções do dropdown "Detalhe" usando `TREATMENT_DETALHES` para o tipo selecionado e SHALL limpar a seleção do detalhe.
4. WHEN o Operador selecionar tipo e detalhe, THE Painel_Lead SHALL executar `resolveTreatment(tipo, detalhe)` e exibir o resultado (destino e status_negocio) em um card visual abaixo dos dropdowns.
5. WHEN o resultado do Tratamento indicar destino `backoffice`, THE Painel_Lead SHALL exibir o card de resultado com fundo azul e texto "→ Backoffice".
6. WHEN o resultado do Tratamento indicar destino `encerrado`, THE Painel_Lead SHALL exibir o card de resultado com fundo cinza e texto "→ Encerrado".
7. WHILE o Estado_Painel for `em_atendimento`, `cliente` ou `encerrado`, THE Painel_Lead SHALL ocultar o bloco de Tratamento.

### Requisito 9: Botão de Confirmação de Encaminhamento

**User Story:** Como Operador, eu quero confirmar o encaminhamento com um único clique, para que o lead siga para o destino correto sem ambiguidade.

#### Critérios de Aceitação

1. WHILE nenhum Tratamento estiver selecionado, THE Painel_Lead SHALL exibir o botão desabilitado com texto "Selecione o tratamento".
2. WHEN o Tratamento estiver selecionado e todas as validações forem satisfeitas, THE Painel_Lead SHALL habilitar o botão "Confirmar encaminhamento".
3. WHEN o Operador clicar em "Confirmar encaminhamento", THE Painel_Lead SHALL salvar no banco de dados: classificação jurídica (segmento_id, assunto_id, especificacao_id), tratamento (tipo, detalhe), observação do dossiê, status_negocio, destino e estado_painel.
4. WHEN a confirmação for bem-sucedida, THE Painel_Lead SHALL emitir o evento de socket `conversa_classificada` com lead_id, status_negocio e destino.
5. WHEN a confirmação for bem-sucedida, THE Painel_Lead SHALL exibir um toast de sucesso por 3 segundos com a mensagem correspondente ao destino.
6. WHEN a confirmação for bem-sucedida, THE Sidebar SHALL remover o lead da lista de conversas ativas.
7. IF a confirmação falhar, THEN THE Painel_Lead SHALL exibir um toast de erro persistente com a mensagem "Erro ao salvar classificação. Tente novamente." e um botão para fechar.
8. IF o botão estiver desabilitado, THEN THE Painel_Lead SHALL exibir uma razão clara do motivo (ex: "⚠ Obrigatória para backoffice" quando a Classificação_Jurídica estiver incompleta).

### Requisito 10: Modo Em Atendimento — Execução do Backoffice

**User Story:** Como Operador, eu quero ver o status atual e os botões de ação quando o lead estiver em atendimento, para executar o próximo passo sem dúvida.

#### Critérios de Aceitação

1. WHEN o Estado_Painel for `em_atendimento`, THE Painel_Lead SHALL exibir o status_negocio atual formatado em linguagem humana (ex: "Aguardando agendamento").
2. WHEN o Estado_Painel for `em_atendimento`, THE Painel_Lead SHALL exibir a próxima ação esperada baseada no status_negocio atual.
3. WHEN o Estado_Painel for `em_atendimento`, THE Painel_Lead SHALL exibir botões de ação contextuais: "Confirmar reunião", "Enviar proposta", "Perdido".
4. WHEN o Operador clicar em um botão de ação, THE Painel_Lead SHALL abrir um modal de confirmação com campos relevantes (data/local para reunião, valor para proposta) antes de executar a ação.
5. WHEN uma ação for confirmada, THE Painel_Lead SHALL registrar um evento na tabela `timeline_events` e atualizar o status_negocio no banco de dados.
6. WHEN uma ação for confirmada, THE Painel_Lead SHALL registrar uma transição na tabela `status_transitions` para auditoria.

### Requisito 11: Modo Cliente — Relacionamento Ativo

**User Story:** Como Operador, eu quero ver informações de contrato quando o lead for cliente ativo, para manter o relacionamento.

#### Critérios de Aceitação

1. WHEN o Estado_Painel for `cliente`, THE Painel_Lead SHALL exibir o Header com fundo verde e label "Cliente ativo".
2. WHEN o Estado_Painel for `cliente`, THE Painel_Lead SHALL exibir informações do contrato: valor e status de pagamento.
3. WHEN o Operador clicar em "Iniciar novo atendimento", THE Painel_Lead SHALL criar um novo registro de atendimento vinculado à mesma Identity e retornar ao modo triagem.

### Requisito 12: Modo Encerrado — Reengajamento

**User Story:** Como Operador, eu quero ver o motivo do encerramento e poder reengajar o lead, para recuperar oportunidades.

#### Critérios de Aceitação

1. WHEN o Estado_Painel for `encerrado`, THE Painel_Lead SHALL exibir o Header com fundo cinza claro e label "Encerrado".
2. WHEN o Estado_Painel for `encerrado`, THE Painel_Lead SHALL exibir o motivo do encerramento (status_negocio formatado).
3. WHEN o Operador clicar em "Reengajar", THE Painel_Lead SHALL alterar o destino para `backoffice`, o status_negocio para `aguardando_agendamento` e o estado_painel para `em_atendimento`.
4. WHEN o reengajamento for bem-sucedido, THE Painel_Lead SHALL atualizar o modo para `em_atendimento` e exibir os blocos correspondentes.


### Requisito 13: Sidebar — Lista de Conversas com Indicadores Visuais

**User Story:** Como Operador, eu quero ver todas as conversas com indicadores claros de prioridade e estado, para saber imediatamente onde agir.

#### Critérios de Aceitação

1. THE Sidebar SHALL exibir uma barra de busca que filtra leads por nome ou telefone com debounce de 300ms.
2. THE Sidebar SHALL exibir abas de filtro: "Todos", "Aguardando", "Sem retorno" com contadores de quantidade em cada aba.
3. THE Sidebar SHALL exibir cada item da lista com: nome do lead, resumo da intenção ou última mensagem, estado visual, nome do responsável, tempo desde última atividade e badge de não lido.
4. WHEN um lead receber uma nova mensagem via evento de socket `nova_mensagem_salva`, THE Sidebar SHALL exibir um indicador 🔴 (vermelho) no card do lead.
5. WHEN um lead não tiver Operador responsável atribuído, THE Sidebar SHALL exibir um indicador ⚠️ (amarelo) no card do lead.
6. WHEN um lead estiver sem resposta por mais de 15 minutos, THE Sidebar SHALL exibir um indicador ⏱ (tempo) no card do lead.
7. THE Sidebar SHALL ordenar as conversas por última atividade, com leads não lidos no topo.
8. WHEN um lead for classificado e confirmado via `conversa_classificada`, THE Sidebar SHALL remover o lead da lista sem necessidade de recarregar.

### Requisito 14: Sidebar — Indicadores de Estado por Cor

**User Story:** Como Operador, eu quero identificar visualmente o estado de cada conversa pela cor, para priorizar sem ler detalhes.

#### Critérios de Aceitação

1. THE Sidebar SHALL exibir um dot de status no avatar de cada lead com as cores: azul para status `active`, amarelo para status `waiting`, cinza para status `no_response`.
2. THE Sidebar SHALL aplicar borda lateral colorida no card selecionado: azul para score ≥ 7, amarelo para score ≥ 4, cinza para score < 4.
3. WHEN um lead tiver menos de 5 minutos desde a última atividade ou mensagens não lidas, THE Sidebar SHALL aplicar fundo sutil azul e nome em negrito extra no card.
4. WHEN um lead tiver mais de 24 horas sem atividade, THE Sidebar SHALL aplicar opacidade reduzida (60%) no card.

### Requisito 15: Chat Central — Mensagens em Tempo Real

**User Story:** Como Operador, eu quero enviar e receber mensagens em tempo real com histórico contínuo, para manter a conversa fluida.

#### Critérios de Aceitação

1. THE Chat_Central SHALL exibir o histórico completo de mensagens do lead selecionado, incluindo mensagens de todos os leads vinculados à mesma Identity.
2. THE Chat_Central SHALL exibir mensagens enviadas (operador/bot) alinhadas à direita com fundo azul e mensagens recebidas (cliente) alinhadas à esquerda com fundo branco.
3. WHEN o Operador digitar uma mensagem e pressionar Enter, THE Chat_Central SHALL enviar a mensagem via evento de socket `nova_mensagem` e exibir a mensagem na lista.
4. WHEN uma nova mensagem for recebida via evento de socket `nova_mensagem_salva`, THE Chat_Central SHALL adicionar a mensagem à lista e fazer scroll automático para o final.
5. THE Chat_Central SHALL manter o histórico contínuo de mensagens, sem reiniciar ao trocar de lead e voltar.
6. THE Chat_Central SHALL suportar envio de arquivos (imagens, documentos, áudio) com validação de tamanho (máximo 10MB) e tipo de arquivo.
7. WHEN o envio de arquivo falhar, THE Chat_Central SHALL exibir uma mensagem de erro por 3 segundos abaixo da barra de input.
8. THE Chat_Central SHALL exibir o canal de origem (WhatsApp/Telegram) como badge em cada mensagem recebida do cliente.

### Requisito 16: Hierarquia Visual — O Segredo da Interface

**User Story:** Como Operador, eu quero que a interface siga uma hierarquia visual clara, para que eu nunca duvide do que é o caso, quem é responsável e o que fazer.

#### Critérios de Aceitação

1. THE Painel_Lead SHALL organizar os blocos na seguinte ordem de prioridade visual: (1) Estado no topo, (2) Cliente/Identidade, (3) Intenção, (4) Dossiê, (5) Próxima ação.
2. THE Painel_Lead SHALL aplicar cores de fundo no Header conforme o estado: cinza (`bg-gray-50`) para triagem, azul (`bg-blue-50`) para em_atendimento, verde (`bg-green-50`) para cliente, cinza claro (`bg-gray-50/50`) para encerrado.
3. IF o Operador não conseguir responder "Qual é este caso?", "Quem é o responsável?" e "O que eu faço agora?" em menos de 3 segundos olhando para o painel, THEN THE Painel_Lead SHALL ser considerado com falha de hierarquia visual.
4. THE Painel_Lead SHALL exibir labels em texto uppercase de 10px com tracking largo para títulos de seção, criando separação visual clara entre blocos.

### Requisito 17: Feedback Imediato e Botões Claros

**User Story:** Como Operador, eu quero feedback imediato em cada ação e botões que nunca estejam bloqueados sem razão, para que eu confie na interface.

#### Critérios de Aceitação

1. WHEN o Operador executar qualquer ação de salvamento, THE Painel_Lead SHALL exibir feedback visual (toast ou indicador inline) em até 500ms.
2. IF um botão estiver desabilitado, THEN THE Painel_Lead SHALL exibir uma mensagem ou tooltip explicando o motivo do bloqueio.
3. WHEN o Operador clicar em "Confirmar encaminhamento", THE Painel_Lead SHALL alterar o texto do botão para "Processando..." e desabilitar o botão até a operação completar.
4. WHEN uma operação de salvamento for bem-sucedida, THE Painel_Lead SHALL exibir um toast verde por 3 segundos.
5. WHEN uma operação de salvamento falhar, THE Painel_Lead SHALL exibir um toast vermelho persistente com botão de fechar.

### Requisito 18: Alertas Visuais Críticos

**User Story:** Como Operador, eu quero alertas visuais claros para situações críticas, para que nenhum lead fique sem atenção.

#### Critérios de Aceitação

1. WHEN um lead receber uma nova mensagem e o Operador não estiver visualizando o lead, THE Sidebar SHALL exibir um badge vermelho (🔴) no card do lead.
2. WHEN um lead não tiver Operador responsável atribuído, THE Sidebar SHALL exibir um indicador amarelo (⚠️) visível no card.
3. WHEN um lead estiver sem resposta do Operador por mais de 15 minutos, THE Sidebar SHALL exibir um indicador de tempo (⏱) no card do lead.
4. WHEN o Operador selecionar um lead com badge de não lido, THE Sidebar SHALL remover o badge de não lido do card.

### Requisito 19: Painel por Identity — Consolidação Cross-Canal

**User Story:** Como Operador, eu quero que o painel consolide dados por identidade do cliente, para que eu veja o histórico completo independente do canal de entrada.

#### Critérios de Aceitação

1. THE Painel_Lead SHALL carregar dados do atendimento usando `identity_id` como chave primária de consulta, consolidando todos os leads vinculados à mesma Identity.
2. WHEN um lead possuir atendimentos anteriores vinculados à mesma Identity, THE Painel_Lead SHALL exibir um bloco "Histórico" com os últimos 5 atendimentos, mostrando tipo de tratamento, destino e data.
3. WHEN um lead reaquecido for selecionado, THE Painel_Lead SHALL exibir a classificação do atendimento anterior como contexto, permitindo ao Operador reclassificar se necessário.
4. THE Chat_Central SHALL carregar mensagens de todos os leads vinculados à mesma Identity, mantendo histórico contínuo cross-canal.

### Requisito 20: Atualização em Tempo Real via Socket

**User Story:** Como Operador, eu quero que todas as mudanças de estado sejam refletidas em tempo real, para que eu trabalhe sempre com dados atualizados.

#### Critérios de Aceitação

1. WHEN outro Operador classificar um lead via evento `conversa_classificada`, THE Sidebar SHALL remover o lead da lista em tempo real.
2. WHEN outro Operador delegar um lead via evento `assignment_updated`, THE Sidebar SHALL atualizar o nome do responsável no card do lead em tempo real.
3. WHEN uma nova mensagem for recebida via evento `nova_mensagem_salva`, THE Sidebar SHALL reordenar a lista de conversas e atualizar o preview da última mensagem.
4. WHEN outro Operador estiver visualizando o mesmo lead, THE Chat_Central SHALL exibir um indicador de presença com o nome do outro Operador.
