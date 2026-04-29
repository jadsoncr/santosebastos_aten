# Documento de Requisitos — Behavioral Pressure Layer

## Introdução

A Behavioral Pressure Layer é uma camada de pressão comportamental composta por 3 mecanismos visuais e sonoros que forçam o operador a priorizar leads críticos na sidebar de conversas (tela1). O objetivo é transformar o sistema de "assistente inteligente" em "ambiente que impõe o comportamento correto", tornando impossível ignorar leads que precisam de atenção imediata.

Os 3 mecanismos são:
1. **Banner Crítico** — banner vermelho sticky no topo da lista de conversas
2. **Separador Urgente** — divisor visual entre leads críticos e não-críticos
3. **Alerta Sonoro** — som curto quando um lead transiciona para estado crítico

**Restrição fundamental**: ZERO alterações no fluxo de dados existente, queries, state management, renderização de cards, socket handlers, filtros ou lógica de ordenação. Todas as mudanças são aditivas.

## Glossário

- **ConversasSidebar**: Componente React que renderiza a lista lateral de conversas na tela1 (`web/app/(dashboard)/tela1/components/ConversasSidebar.tsx`)
- **Lead**: Registro de prospecto/cliente no sistema, com campos como `ultima_msg_em`, `ultima_msg_de`, `prazo_proxima_acao`
- **LeadWithMeta**: Tipo estendido de Lead com metadados calculados (`_tipo`, `_slaVencido`, `lastMessage`, etc.)
- **getUrgencyStyle**: Função pura em `web/utils/urgencyColors.ts` que retorna `{level: 'critical'|'alert'|'normal', ...}` baseado em `ultima_msg_em`, `ultima_msg_de` e `prazo_proxima_acao`
- **Nível_Crítico**: Estado retornado por `getUrgencyStyle()` quando `level === 'critical'` (prazo vencido OU cliente aguardando >30min sem resposta)
- **prioritizedLeads**: `useMemo` existente no ConversasSidebar que ordena leads por nível de urgência
- **Banner_Crítico**: Elemento visual vermelho fixo no topo da lista de conversas que exibe a contagem de leads críticos
- **Separador_Urgente**: Divisor visual que separa leads críticos dos demais na lista
- **Alerta_Sonoro**: Som curto (~0.5s) reproduzido quando um lead transiciona para Nível_Crítico
- **useCriticalAlert**: Hook React customizado responsável por detectar transições para Nível_Crítico e disparar o Alerta_Sonoro
- **document.hidden**: Propriedade da Page Visibility API que indica se a aba do navegador está inativa

## Requisitos

### Requisito 1: Contagem Reativa de Leads Críticos

**User Story:** Como operador, eu quero que o sistema calcule automaticamente quantos leads estão em estado crítico, para que os mecanismos de pressão tenham dados precisos e reativos.

#### Critérios de Aceitação

1. THE ConversasSidebar SHALL calcular a contagem de leads críticos via `useMemo` derivado de `prioritizedLeads`, usando `getUrgencyStyle()` como fonte de verdade
2. WHEN a lista `prioritizedLeads` mudar, THE ConversasSidebar SHALL recalcular a contagem de leads com `level === 'critical'` sem efeitos colaterais
3. THE ConversasSidebar SHALL separar `prioritizedLeads` em duas listas — `criticalLeads` e `nonCriticalLeads` — via um único `useMemo`
4. THE ConversasSidebar SHALL manter toda lógica de ordenação, filtragem e socket handlers existente inalterada

### Requisito 2: Banner Crítico no Topo da Sidebar

**User Story:** Como operador, eu quero ver um banner vermelho fixo no topo da lista de conversas quando existem leads críticos, para que eu nunca ignore a existência de leads que precisam de atenção imediata.

#### Critérios de Aceitação

1. WHEN `criticalCount` for maior que zero, THE Banner_Crítico SHALL ser exibido no topo da área de scroll da lista de conversas
2. WHILE `criticalCount` for igual a zero, THE Banner_Crítico SHALL permanecer oculto sem ocupar espaço no layout
3. THE Banner_Crítico SHALL exibir o texto "🔴 X leads aguardando há mais de 30min" onde X é o valor dinâmico de `criticalCount`
4. THE Banner_Crítico SHALL usar fundo vermelho (`bg-red-50`), borda vermelha (`border-red-300`), e texto vermelho (`text-red-700`) com `font-bold`
5. THE Banner_Crítico SHALL permanecer fixo (sticky) no topo, sem rolar junto com a lista de leads
6. WHEN `criticalCount` mudar, THE Banner_Crítico SHALL atualizar o número exibido reativamente sem re-render completo da lista

### Requisito 3: Separador Visual entre Leads Urgentes e Normais

**User Story:** Como operador, eu quero ver uma separação visual clara entre leads críticos e os demais, para que eu identifique instantaneamente quais leads precisam de ação imediata.

#### Critérios de Aceitação

1. WHILE existirem leads críticos E leads não-críticos simultaneamente, THE Separador_Urgente SHALL ser renderizado entre as duas seções
2. WHILE existirem apenas leads críticos OU apenas leads não-críticos, THE Separador_Urgente SHALL permanecer oculto
3. THE Separador_Urgente SHALL exibir o label "🔴 URGENTE" acima da seção de leads críticos, com texto vermelho (`text-red-500`) em `text-[10px] font-bold uppercase`
4. THE Separador_Urgente SHALL incluir uma linha divisória (`border-t border-gray-200`) entre a seção de leads críticos e a seção de leads normais
5. THE ConversasSidebar SHALL renderizar primeiro os `criticalLeads`, depois o Separador_Urgente, depois os `nonCriticalLeads`, substituindo o `.map` único por renderização em duas seções
6. THE ConversasSidebar SHALL manter a função `renderLeadItem` inalterada — cada card individual continua idêntico

### Requisito 4: Alerta Sonoro na Transição para Estado Crítico

**User Story:** Como operador, eu quero ouvir um som curto quando um lead entra em estado crítico, para que eu seja alertado mesmo quando não estou olhando para a tela.

#### Critérios de Aceitação

1. WHEN um lead transicionar de nível não-crítico para Nível_Crítico, THE useCriticalAlert SHALL reproduzir o arquivo de áudio `alert-critical.mp3`
2. THE useCriticalAlert SHALL comparar o conjunto atual de IDs críticos com o conjunto anterior para detectar transições, usando `useRef` para armazenar o snapshot anterior
3. THE useCriticalAlert SHALL reproduzir o som apenas uma vez por transição — re-renders ou refreshes que mantêm o mesmo conjunto de leads críticos não disparam o som
4. WHILE `document.hidden` for `true`, THE useCriticalAlert SHALL suprimir a reprodução do som
5. IF o navegador bloquear autoplay de áudio, THEN THE useCriticalAlert SHALL capturar o erro silenciosamente via `.catch(() => {})` sem exibir erros ao operador
6. THE useCriticalAlert SHALL receber a lista de leads e usar `getUrgencyStyle()` para determinar quais são críticos, sem duplicar lógica de urgência
7. THE useCriticalAlert SHALL ser um hook independente em `web/hooks/useCriticalAlert.ts`, sem dependência de estado externo além da lista de leads recebida como parâmetro
8. THE arquivo de áudio SHALL ter duração aproximada de 0.5 segundos e ser armazenado em `web/public/sounds/alert-critical.mp3`

### Requisito 5: Integridade do Sistema Existente

**User Story:** Como desenvolvedor, eu quero garantir que a camada de pressão comportamental seja puramente aditiva, para que zero funcionalidade existente seja afetada.

#### Critérios de Aceitação

1. THE ConversasSidebar SHALL manter todos os socket handlers (`nova_mensagem_salva`, `lead_assumido`, `lead_encerrado`, `lead_reaquecido`, `estado_painel_changed`, `conversa_classificada`, `assignment_updated`) inalterados
2. THE ConversasSidebar SHALL manter toda lógica de filtros por pills (`todos`, `aguardando`, `sem_retorno`) inalterada
3. THE ConversasSidebar SHALL manter o `useMemo` de `prioritizedLeads` com a mesma lógica de ordenação por urgência
4. THE ConversasSidebar SHALL manter a função `renderLeadItem` com a mesma renderização visual de cada card individual
5. THE ConversasSidebar SHALL manter a busca por texto, modal de novo contato, e auto-seleção do primeiro lead inalterados
6. THE implementação SHALL usar exclusivamente `getUrgencyStyle()` de `web/utils/urgencyColors.ts` como fonte de verdade para determinar criticidade — nenhuma lógica de urgência duplicada ou alternativa
7. THE implementação SHALL usar `useMemo` para todos os cálculos derivados — nenhum cálculo dentro de funções de render
8. THE implementação SHALL não persistir estado derivado (urgência, prioridade, contagem crítica) no banco de dados
