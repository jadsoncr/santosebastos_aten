# Documento de Requisitos — Template Visual Port

## Introdução

Este documento especifica os requisitos para portar o design visual de três templates criados no Google AI Studio (Vite + React + Tailwind + Framer Motion) para o projeto Next.js existente. O objetivo é clonar fielmente a aparência visual dos templates, mantendo toda a lógica de negócio existente (classificação, máquina de estados, eventos de socket, queries Supabase) completamente intacta. Nenhuma função, assinatura ou modelo de dados será alterado.

## Glossário

- **Sistema_Web**: A aplicação Next.js existente em `web/`, incluindo App Router, Tailwind CSS, Supabase e Socket.IO
- **Template_Relationship**: O arquivo `templates/src/components/RelationshipView.tsx` que define o design visual da tela de relacionamento (tela1)
- **Template_Backoffice**: O arquivo `templates/src/components/BackofficeView.tsx` que define o design visual da tela de backoffice (tela2)
- **Template_Dashboard**: O arquivo `templates/src/components/DashboardView.tsx` que define o design visual do painel financeiro
- **Template_Sidebar**: O arquivo `templates/src/components/Sidebar.tsx` que define o design visual da barra lateral de navegação
- **Template_Base**: O arquivo `templates/src/components/ui/Base.tsx` que define os primitivos visuais Card, Button e Badge
- **Design_System**: O conjunto de tokens visuais (tipografia Inter, bordas rounded-2xl, sombras shadow-sm, paleta blue-600/gray-50) aplicados consistentemente em todas as telas
- **Coluna_Lista**: A coluna esquerda de 320px na tela de relacionamento que exibe a lista de conversas
- **Coluna_Chat**: A coluna central na tela de relacionamento que exibe as mensagens do chat
- **Painel_Cliente**: A coluna direita de 320px na tela de relacionamento que exibe dados e classificação do lead
- **Bloco_Preview**: A seção "Vai acontecer" no Painel_Cliente que mostra o status e destino resultantes da classificação
- **Botao_Confirmar**: O botão "Confirmar e encaminhar" fixo na parte inferior do Painel_Cliente
- **Modulo_Recuperacao**: A nova tela para exibir leads abandonados, perdidos e outros para reativação

## Requisitos

### Requisito 1: Design System Global

**User Story:** Como operador, eu quero que todas as telas tenham uma aparência visual consistente baseada nos templates, para que a experiência seja coesa e profissional.

#### Critérios de Aceitação

1. THE Sistema_Web SHALL utilizar a fonte Inter (pesos 400–900) como fonte principal em todas as telas, importada via Google Fonts ou equivalente local
2. THE Sistema_Web SHALL aplicar `font-black` para títulos, `tracking-tight` para headings e `uppercase tracking-widest` para labels de seção, conforme definido nos templates
3. THE Sistema_Web SHALL utilizar `rounded-2xl` para cards e containers, `rounded-xl` para inputs e selects, conforme definido no Template_Base
4. THE Sistema_Web SHALL utilizar `shadow-sm` para cards em repouso e `shadow-md` para cards em estado hover, conforme definido nos templates
5. THE Sistema_Web SHALL utilizar a paleta de cores: `blue-600` como cor primária, `gray-50` e `gray-100` como fundos, `green-600` para sucesso, `orange-600` para avisos, conforme definido nos templates
6. THE Sistema_Web SHALL disponibilizar os componentes primitivos Card, Button e Badge com as mesmas classes CSS definidas no Template_Base (`bg-white rounded-xl shadow-sm border border-gray-100` para Card, variantes primary/secondary/neutral para Button, `rounded-full text-[10px] font-semibold uppercase tracking-wider` para Badge)
7. THE Sistema_Web SHALL aplicar a classe utilitária `scrollbar-hide` para ocultar scrollbars em áreas de rolagem, conforme definido no CSS dos templates

### Requisito 2: Sidebar de Navegação

**User Story:** Como operador, eu quero uma barra lateral de navegação com ícones e estados visuais claros, para que eu possa navegar entre as telas de forma intuitiva.

#### Critérios de Aceitação

1. THE Sistema_Web SHALL renderizar a Sidebar com largura `w-20` quando colapsada e `w-64` quando expandida, com transição suave entre os estados
2. THE Sistema_Web SHALL exibir o logo (ícone Zap em fundo `bg-blue-600 rounded-lg`) e o nome "BRO Resolve" em `font-black text-xl tracking-tighter` no topo da Sidebar, ocultando o texto quando colapsada
3. THE Sistema_Web SHALL renderizar os itens de navegação com ícones Lucide (MessageSquare para Relacionamento, LayoutGrid para Backoffice, DollarSign para Dashboard) com padding `p-3` e `rounded-xl`
4. WHEN um item de navegação está ativo, THE Sistema_Web SHALL aplicar `bg-blue-50 text-blue-600` ao item e `scale-110` ao ícone
5. WHEN um item de navegação está inativo, THE Sistema_Web SHALL aplicar `text-gray-400 hover:bg-gray-50 hover:text-gray-600` ao item
6. THE Sistema_Web SHALL exibir os botões Configurações (ícone Settings) e Sair (ícone LogOut com `text-red-400 hover:bg-red-50`) na parte inferior da Sidebar, separados por `border-t border-gray-50`
7. THE Sistema_Web SHALL manter toda a lógica de roteamento existente (Next.js Link, usePathname) e controle de permissão por role (ownerOnly) intactos

### Requisito 3: Tela de Relacionamento — Coluna de Lista (tela1)

**User Story:** Como operador, eu quero ver a lista de conversas com o visual do template, para que eu identifique rapidamente o status e prioridade de cada conversa.

#### Critérios de Aceitação

1. THE Coluna_Lista SHALL ter largura fixa de `w-80` (320px) com fundo `bg-[#F1F3F6]` e borda direita `border-[#E6E8EC]/20`
2. THE Coluna_Lista SHALL exibir o título "Conversas" em `text-xl font-bold tracking-tight` no topo
3. THE Coluna_Lista SHALL renderizar os filtros (Todos, Aguardando, Sem retorno) como tabs com estilo underline (`border-b-2`) em vez de pills, com texto `text-[11px]`, estado ativo em `text-blue-600 font-semibold border-blue-400` e inativo em `text-[#9CA3AF] border-transparent`
4. THE Coluna_Lista SHALL renderizar cada item de conversa com: avatar circular de 48px (`w-12 h-12`) com imagem ou inicial, dot de status (`bg-blue-500` para ativo, `bg-yellow-500` para cooling, `bg-gray-400` para sem resposta), nome em `font-bold text-sm`, timeAgo em `text-[9px] font-bold text-gray-300 uppercase`, e preview da mensagem em `text-xs text-gray-400 truncate`
5. WHEN uma conversa está selecionada, THE Coluna_Lista SHALL aplicar `bg-white shadow-sm rounded-xl` ao item com `border-l-4` colorido por propensidade (blue-600 para hot, yellow-400 para warm, gray-400 para cold)
6. THE Coluna_Lista SHALL renderizar o campo de busca com ícone Search, `rounded-xl`, `bg-[#F7F8FA]`, `shadow-sm` e placeholder "Buscar cliente..."
7. THE Coluna_Lista SHALL aplicar transição de fade (`opacity-0` → `opacity-100` com `duration-200`) ao trocar de filtro
8. THE Coluna_Lista SHALL manter toda a lógica existente de carregamento de leads, socket listeners, busca com debounce, deduplicação por identity_id e ordenação por conversationStatus intacta

### Requisito 4: Tela de Relacionamento — Coluna de Chat (tela1)

**User Story:** Como operador, eu quero ver o chat com o visual do template, para que a experiência de conversa seja limpa e moderna.

#### Critérios de Aceitação

1. THE Coluna_Chat SHALL ter fundo `bg-[#F6F8FC]` na área de mensagens
2. THE Coluna_Chat SHALL renderizar o header com: avatar circular de 40px com borda `border-gray-100 shadow-sm`, nome em `font-bold text-sm tracking-tight`, indicador "Online" em `text-[10px] font-bold uppercase tracking-widest` com dot animado (`animate-pulse`) em `bg-blue-500` para status ativo
3. THE Coluna_Chat SHALL renderizar mensagens enviadas com `bg-[#2563EB] text-white rounded-2xl rounded-tr-none` e `shadow-[0_2px_8px_rgba(0,0,0,0.04)]`
4. THE Coluna_Chat SHALL renderizar mensagens recebidas com `bg-white text-gray-900 rounded-2xl rounded-tl-none border border-white`
5. THE Coluna_Chat SHALL exibir o timestamp de cada mensagem em `text-[9px] font-bold uppercase tracking-tighter opacity-60` alinhado à direita
6. THE Coluna_Chat SHALL renderizar a área de input com: container `bg-[#F8FAFC] rounded-2xl border border-gray-100/50 shadow-inner`, botão de anexo (ícone Paperclip), textarea sem borda com `text-[13px] font-medium`, e botão de envio `bg-blue-600 rounded-xl shadow-md shadow-blue-100`
7. THE Coluna_Chat SHALL manter toda a lógica existente de envio de mensagens, upload de arquivos, socket events, quick replies, smart snippets, notas internas e detecção de digitação intacta

### Requisito 5: Tela de Relacionamento — Painel do Cliente (tela1)

**User Story:** Como operador, eu quero ver o painel do cliente com campos editáveis inline e preview de classificação, para que eu possa qualificar leads de forma eficiente.

#### Critérios de Aceitação

1. THE Painel_Cliente SHALL ter largura fixa de `w-80` (320px) com fundo `bg-[#FBFBFC]` e borda esquerda `border-[#E6E8EC]/20`
2. THE Painel_Cliente SHALL exibir o avatar do lead em tamanho `w-24 h-24 rounded-full` com borda `border-[3px] border-white` e ring colorido por leadStatus (blue-100 para hot, `[#FEF3C7]` para warm, gray-100 para cold)
3. THE Painel_Cliente SHALL renderizar os campos Nome e Telefone como campos editáveis inline com estilo `border-b border-gray-100 focus-within:border-blue-600`, labels em `text-[10px] font-bold text-gray-300 uppercase tracking-widest`, e valores em `text-sm font-bold text-gray-900`
4. THE Painel_Cliente SHALL renderizar os dropdowns de Segmento, Assunto e Próximo Passo com estilo `rounded-xl shadow-sm font-bold bg-white border border-[#E6E8EC]/20 p-3`, com o dropdown "Próximo Passo" destacado em `bg-blue-50/30 border-blue-100 text-blue-700 rounded-2xl p-4 font-black`
5. THE Painel_Cliente SHALL renderizar labels de classificação em `text-[10px] font-black uppercase tracking-widest` com "PRÓXIMO PASSO" em `text-blue-600 italic underline underline-offset-4`
6. WHEN o campo "Próximo Passo" possui um valor selecionado, THE Bloco_Preview SHALL exibir um bloco `bg-gray-900 rounded-2xl` com animação `fade-in slide-in-from-top-2`, contendo o título "Vai acontecer:" em `text-[10px] font-black text-blue-400 uppercase tracking-widest`, o status resultante e o destino ("Operação (Backoffice)") em `text-xs font-bold text-white`
7. THE Botao_Confirmar SHALL ser renderizado fixo na parte inferior do Painel_Cliente (`fixed bottom-0`) com largura total, `py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em]`, `bg-[#2563EB] text-white shadow-xl shadow-blue-100` quando ativo, e `bg-[#E5E7EB] text-gray-400 cursor-not-allowed` quando desabilitado
8. WHEN existem alterações não salvas, THE Painel_Cliente SHALL exibir um indicador `text-[10px] font-black text-[#92400E] bg-[#FEF3C7] rounded-md uppercase tracking-widest animate-pulse` com o texto "⚠️ Alterações não salvas"
9. THE Painel_Cliente SHALL renderizar o campo Dossiê Estratégico como textarea com `rounded-xl shadow-sm min-h-[100px] text-[11px] font-medium placeholder:text-gray-200`
10. THE Painel_Cliente SHALL manter toda a lógica existente de resolveClassification(), cascading dropdowns (segment_trees), save de nome/telefone/email, vinculação de identidade, notas internas com auto-save, e socket events intacta

### Requisito 6: Tela de Backoffice (tela2)

**User Story:** Como operador, eu quero ver o backoffice com o visual do template, para que eu gerencie propostas e fechamentos de forma clara e organizada.

#### Critérios de Aceitação

1. THE Sistema_Web SHALL renderizar o título da tela em `text-3xl font-black tracking-tight` com subtítulo em `text-sm font-medium text-gray-500`, e um indicador "Atualizado agora" com dot verde animado
2. THE Sistema_Web SHALL renderizar exatamente 4 cards de resumo no topo (Em Negociação, Reuniões Agendadas, Contratos Fechados, Taxa de Perda) usando o componente Card com `border-none shadow-sm hover:shadow-md`, cada um contendo: ícone em fundo colorido (`rounded-lg`), valor em `text-4xl font-black`, label em `text-[10px] font-black uppercase tracking-widest`, e subtítulo colorido em `text-[11px] font-bold`
3. THE Sistema_Web SHALL agrupar os leads em seções ("Propostas em Aberto" / "Ganhos Recentemente") com headers em `text-xs font-black uppercase tracking-[0.2em]`, subtítulo em `text-[10px] font-bold text-gray-400 italic`, e contagem de casos
4. THE Sistema_Web SHALL renderizar cada lead card com: avatar quadrado `w-12 h-12 rounded-2xl bg-gray-50`, nome em `text-base font-bold`, micro copy de urgência (`text-[11px] font-black uppercase`) com cores contextuais (green-500 para "Ativo agora", blue-500 para "Aguardando resposta", orange-500 para "Sem retorno há X dias"), valor estimado, badge de stage, e botão de ação chevron
5. WHEN o cursor está sobre um lead card, THE Sistema_Web SHALL aplicar `ring-2 ring-blue-100` ao card, mudar o avatar para `bg-blue-50 text-blue-500`, e revelar o hint de ação com `opacity-0 → opacity-100`
6. THE Sistema_Web SHALL substituir os botões de ação inline (Avançar/Fechar/Desistiu) por um único botão contextual (ChevronRight) que executa a ação principal, mantendo a mesma lógica de validateBusinessTransition() e getNextStatus()
7. WHEN não existem leads em um grupo, THE Sistema_Web SHALL exibir um estado vazio com ícone CheckCircle em `bg-green-50 rounded-full`, texto "Operação sob controle" em `font-bold`, e subtítulo "Nenhum cliente precisa de atenção agora"
8. THE Sistema_Web SHALL manter toda a lógica existente de carregamento de dados, transições de status (handleTransition, handleAvancar, handleFechar, handleDesistiu, handleReengajar), socket events e navegação para chat intacta

### Requisito 7: Tela de Dashboard / Financeiro

**User Story:** Como operador, eu quero ver o dashboard financeiro com o visual do template, para que eu tenha uma visão estratégica de relacionamento e backoffice.

#### Critérios de Aceitação

1. THE Sistema_Web SHALL renderizar o título "Dashboard de Controle" em `text-3xl font-black tracking-tight` com subtítulo "Visão estratégica de relacionamento e backoffice." em `text-sm font-medium text-gray-500`
2. THE Sistema_Web SHALL renderizar 3 KPI cards (Receita Realizada, Leads em Qualificação, Pipeline Negociação) usando o componente Card com `border-none shadow-sm`, cada um contendo: ícone em fundo colorido (`p-3 rounded-xl`), label em `text-[10px] font-black text-gray-400 uppercase tracking-widest`, e valor em `text-3xl font-black`
3. THE Sistema_Web SHALL renderizar a seção "Controle de Relacionamento" com: indicadores de "Leads em Qualificação" e "Aguardando Backoffice" com dots coloridos, e uma barra de engajamento (`h-2 bg-gray-100 rounded-full`) dividida entre blue-500 (relacionamento) e orange-400 (backoffice)
4. THE Sistema_Web SHALL renderizar a seção "Performance Backoffice" com: itens "Pipeline Aberto" (ícone Zap, orange) e "Ganhos (Fechado)" (ícone CheckCircle, green) em containers `p-3 bg-gray-50 rounded-xl`, e botão "Extrair Relatório de Conversão" em `text-[10px] font-black text-blue-600 bg-blue-50 rounded-xl uppercase tracking-widest`
5. THE Sistema_Web SHALL renderizar a seção "Últimas Conversões" com lista de clientes convertidos, cada item contendo: ícone TrendingUp em `bg-green-50 rounded-full`, nome em `text-sm font-bold`, data em `text-[10px] font-medium text-gray-400`, valor em `text-base font-black`, e ícone ChevronRight
6. WHEN não existem conversões, THE Sistema_Web SHALL exibir o texto "Nenhuma conversão registrada no período." em `text-gray-400 font-bold italic text-xs`
7. THE Sistema_Web SHALL manter toda a lógica existente de carregamento de dados financeiros (queries Supabase para pot_tratamento, atendimentos, leads, bot_feedback) e cálculos (receita estimada/confirmada, ticket médio, gap bot) intacta

### Requisito 8: Módulo de Recuperação

**User Story:** Como operador, eu quero ver leads abandonados e perdidos com o mesmo padrão visual dos templates, para que eu possa reativá-los de forma eficiente.

#### Critérios de Aceitação

1. THE Modulo_Recuperacao SHALL renderizar a lista de leads usando o mesmo padrão visual do Template_Backoffice (Card com `border-none shadow-sm`, avatar `rounded-2xl`, micro copy de urgência)
2. THE Modulo_Recuperacao SHALL agrupar os leads em seções: "Abandonados (URA)", "Perdidos", "Outros", com headers em `text-xs font-black uppercase tracking-[0.2em]`
3. THE Modulo_Recuperacao SHALL exibir para cada item: nome, origem (canal), onde parou (último estado), e tempo desde o abandono
4. THE Modulo_Recuperacao SHALL exibir micro copy contextual: "Abandonou na etapa X" para abandonados URA, "Sem resposta há X dias" para perdidos
5. THE Modulo_Recuperacao SHALL renderizar um botão "Reativar" por item que, ao ser clicado, retorna o lead para a tela de relacionamento e abre o chat
6. THE Modulo_Recuperacao SHALL manter toda a lógica existente de carregamento de dados de recuperação (queries Supabase para abandonos e others) e socket events (conversa_resgatada) intacta

### Requisito 9: Preservação de Lógica Existente

**User Story:** Como desenvolvedor, eu quero que toda a lógica de negócio existente permaneça intacta após a portagem visual, para que nenhuma funcionalidade seja quebrada.

#### Critérios de Aceitação

1. THE Sistema_Web SHALL manter todas as assinaturas de funções existentes (resolveClassification, getConversationStatus, validateBusinessTransition, createAuditEntry, getNextStatus) sem alteração
2. THE Sistema_Web SHALL manter todos os event listeners de socket existentes (lead_assumido, nova_mensagem_salva, lead_encerrado, conversa_classificada, status_negocio_changed, pipeline_transition, conversa_resgatada) sem alteração
3. THE Sistema_Web SHALL manter todas as queries Supabase existentes (leads, atendimentos, mensagens, identities, identity_channels, segment_trees, pot_tratamento, bot_feedback, abandonos, others, status_transitions, timeline_events) sem alteração
4. THE Sistema_Web SHALL manter todos os modelos de dados e interfaces TypeScript existentes (Lead, StatusNegocio, Destino, ConversationStatus, SegmentNode) sem alteração
5. IF uma dependência adicional for necessária (lucide-react, date-fns, framer-motion), THEN THE Sistema_Web SHALL adicioná-la ao package.json sem remover nenhuma dependência existente
6. THE Sistema_Web SHALL manter o fluxo de autenticação existente (Supabase Auth, middleware de redirecionamento, controle de role) sem alteração
