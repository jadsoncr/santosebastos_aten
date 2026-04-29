# Plano de Implementação: Behavioral Pressure Layer

## Visão Geral

Implementação de 3 mecanismos de pressão comportamental (banner crítico, separador urgente, alerta sonoro) na `ConversasSidebar.tsx`. A abordagem é bottom-up: primeiro funções puras testáveis, depois o hook de alerta, e por fim a integração aditiva no componente existente. Todas as mudanças são aditivas — zero alterações em lógica existente.

## Tasks

- [x] 1. Criar funções puras utilitárias para lógica de pressão
  - [x] 1.1 Criar arquivo `web/utils/criticalPressure.ts` com as 3 funções puras
    - Implementar `splitLeads(leads, getUrgency)` que particiona uma lista de leads em `{ criticalLeads, nonCriticalLeads }` usando a função de urgência fornecida
    - Implementar `detectNewCriticalIds(currentIds: Set<string>, previousIds: Set<string>): Set<string>` que retorna o conjunto de IDs novos (diferença de conjuntos)
    - Implementar `shouldShowSeparator(criticalCount: number, nonCriticalCount: number): boolean` que retorna `true` somente quando ambas as contagens são > 0
    - Exportar interface `LeadForAlert` com campos `id`, `ultima_msg_em?`, `ultima_msg_de?`, `prazo_proxima_acao?`
    - _Requisitos: 1.1, 1.3, 3.1, 3.2, 4.1, 4.2, 5.6_

  - [ ]* 1.2 Escrever teste de propriedade para corretude da partição (splitLeads)
    - **Property 1: Corretude da Partição — getUrgencyStyle como Fonte Única**
    - Para qualquer lista de leads com timestamps arbitrários, todo lead em `criticalLeads` deve ter `getUrgencyStyle()` retornando `level === 'critical'`, e todo lead em `nonCriticalLeads` deve ter `level !== 'critical'`
    - Usar `fast-check` com gerador de listas de leads com timestamps aleatórios
    - **Valida: Requisitos 1.1, 4.6, 5.6**

  - [ ]* 1.3 Escrever teste de propriedade para completude da partição
    - **Property 2: Completude da Partição — Nenhum Lead Perdido**
    - Para qualquer lista de leads, `criticalLeads.length + nonCriticalLeads.length === input.length` e a concatenação contém exatamente os mesmos elementos sem duplicatas
    - **Valida: Requisitos 1.3**

  - [ ]* 1.4 Escrever teste de propriedade para preservação de ordem
    - **Property 3: Preservação de Ordem na Partição**
    - Para qualquer lista de leads já ordenada, a ordem relativa dentro de cada sublista deve ser preservada
    - **Valida: Requisitos 3.5**

  - [ ]* 1.5 Escrever teste de propriedade para visibilidade do separador
    - **Property 4: Visibilidade do Separador**
    - Para qualquer par `(criticalCount, nonCriticalCount)`, `shouldShowSeparator` retorna `true` sse ambos > 0
    - **Valida: Requisitos 3.1, 3.2**

  - [ ]* 1.6 Escrever teste de propriedade para detecção de transição
    - **Property 5: Detecção de Transição para Estado Crítico**
    - Para quaisquer dois conjuntos de IDs, `detectNewCriticalIds` retorna conjunto não-vazio sse existe pelo menos um ID novo em `currentIds` que não estava em `previousIds`
    - **Valida: Requisitos 4.1, 4.2**

  - [ ]* 1.7 Escrever teste de propriedade para idempotência da detecção
    - **Property 6: Idempotência da Detecção — Mesmo Conjunto Não Dispara**
    - Para qualquer conjunto S, `detectNewCriticalIds(S, S)` retorna conjunto vazio
    - **Valida: Requisitos 4.3**

- [x] 2. Checkpoint — Validar funções puras
  - Executar todos os testes e garantir que passam. Perguntar ao usuário se houver dúvidas.

- [x] 3. Criar hook useCriticalAlert e arquivo de áudio
  - [x] 3.1 Criar arquivo de áudio placeholder em `web/public/sounds/alert-critical.mp3`
    - Criar diretório `web/public/sounds/` se não existir
    - Adicionar arquivo MP3 placeholder (arquivo vazio ou mínimo válido) — o áudio real será substituído depois
    - _Requisitos: 4.8_

  - [x] 3.2 Criar hook `web/hooks/useCriticalAlert.ts`
    - Importar `getUrgencyStyle` de `@/utils/urgencyColors` e `detectNewCriticalIds` de `@/utils/criticalPressure`
    - Receber `leads: LeadForAlert[]` como parâmetro
    - Usar `useRef<Set<string>>` para armazenar snapshot anterior de IDs críticos
    - Usar `useRef<HTMLAudioElement>` para instância de áudio (inicializar com `new Audio('/sounds/alert-critical.mp3')`)
    - No `useEffect`, calcular IDs críticos atuais via `getUrgencyStyle`, comparar com snapshot anterior via `detectNewCriticalIds`
    - Reproduzir som apenas se há novos IDs E `!document.hidden`
    - Capturar erros de autoplay com `.catch(() => {})`
    - Atualizar snapshot no final do efeito
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 3.3 Escrever testes unitários para useCriticalAlert
    - Testar que som é disparado quando novo ID crítico aparece
    - Testar que som NÃO é disparado quando conjunto de IDs não muda
    - Testar que som NÃO é disparado quando `document.hidden === true`
    - Testar que erro de autoplay é capturado silenciosamente
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Checkpoint — Validar hook e testes
  - Executar todos os testes e garantir que passam. Perguntar ao usuário se houver dúvidas.

- [x] 5. Integrar camada de pressão no ConversasSidebar
  - [x] 5.1 Adicionar import e useMemo de partição no ConversasSidebar
    - Adicionar import de `useCriticalAlert` de `@/hooks/useCriticalAlert`
    - Adicionar import de `splitLeads` de `@/utils/criticalPressure` (ou inline a lógica no useMemo)
    - Adicionar novo `useMemo` após `prioritizedLeads` que particiona em `{ criticalLeads, nonCriticalLeads, criticalCount }` usando `getUrgencyStyle` como fonte de verdade
    - Adicionar chamada `useCriticalAlert(prioritizedLeads)` no corpo do componente
    - **Não alterar** nenhum `useMemo`, `useEffect`, socket handler ou função existente
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 4.6, 4.7, 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_

  - [x] 5.2 Adicionar Banner Crítico e Separador Urgente no JSX
    - Adicionar banner condicional `{criticalCount > 0 && (...)}` com `sticky top-0 z-10` acima da área de scroll, com texto "🔴 X leads aguardando há mais de 30min"
    - Usar classes: `bg-red-50`, `border border-red-300`, `rounded-lg`, `text-xs font-bold text-red-700`
    - Substituir `{!isSearching && prioritizedLeads.map(renderLeadItem)}` por renderização em duas seções: `criticalLeads.map(renderLeadItem)` + separador condicional + `nonCriticalLeads.map(renderLeadItem)`
    - Separador condicional: visível apenas quando ambas as listas são não-vazias, com label "🔴 URGENTE" em `text-[10px] font-bold uppercase text-red-500` e linha `border-t border-gray-200`
    - **Não alterar** a função `renderLeadItem` — cada card individual continua idêntico
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.4_

  - [ ]* 5.3 Escrever testes de integração/regressão
    - Verificar que banner aparece quando há leads críticos e desaparece quando não há
    - Verificar que separador aparece apenas quando ambas as seções têm leads
    - Verificar que a ordem dos leads dentro de cada seção é preservada
    - Verificar que socket handlers existentes continuam funcionando (não foram alterados)
    - _Requisitos: 2.1, 2.2, 3.1, 3.2, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Checkpoint final — Validar integração completa
  - Executar todos os testes e garantir que passam. Perguntar ao usuário se houver dúvidas.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude definidas no design
- Testes unitários validam exemplos específicos e edge cases
- Toda a implementação é aditiva — nenhuma linha existente do ConversasSidebar é modificada, apenas adições
