# Implementation Plan: Live Relationship UX

## Overview

Implementar melhorias de UX na tela de Relacionamento para transmitir sensação de sistema online em tempo real. Sem alterar layout estrutural, sem novos componentes React, sem migração de banco. Tasks ordenadas por dependência: funções puras primeiro, depois componentes UI, depois integração servidor.

## Tasks

- [ ] 1. Funções puras — Lógica de presença e micro copy
  - [ ] 1.1 Adicionar função `getPresenceIndicator()` em `ConversasSidebar.tsx`
    - Recebe `LeadWithMeta` e `typingLeads: Map<string, NodeJS.Timeout>`
    - Retorna `{ text: string, type: 'online' | 'typing' | 'last_activity' } | null`
    - Prioridade: typing > online (< 2min) > last_activity
    - Usa `ultima_msg_em` e `Date.now()` para cálculo de tempo
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ] 1.2 Adicionar função `getMicroCopy()` em `ConversasSidebar.tsx`
    - Recebe `LeadWithMeta` com `_conversationStatus` já calculado
    - Retorna `{ text: string, style: 'warning' | 'muted' | 'accent' } | null`
    - Mapeamento: active→"Cliente respondeu agora", waiting→"Aguardando sua resposta", no_response→"Sem resposta há X horas/dias"
    - Threshold: diffHours >= 48 usa dias em vez de horas
    - Sem consultas adicionais ao banco
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [ ]* 1.3 Escrever property test para `getPresenceIndicator` e `getMicroCopy` (Properties 1, 2)
    - **Property 1: Indicador de presença retorna estado correto por threshold**
    - **Property 2: Micro copy retorna texto correto por status de conversa**
    - Gerar timestamps aleatórios e verificar que o indicador/micro copy corresponde aos thresholds
    - **Validates: Requirements 1.1, 1.2, 1.4, 3.1, 3.2, 3.3, 3.4**

- [ ] 2. ConversasSidebar — Indicadores de presença e micro copy no card
  - [ ] 2.1 Adicionar estado `typingLeads` e listener de socket `cliente_digitando`
    - Estado: `Map<string, NodeJS.Timeout>` para rastrear leads digitando
    - Listener: ao receber `cliente_digitando`, adicionar lead ao mapa com timeout de 3s
    - Ao expirar timeout, remover lead do mapa
    - Limpar todos os timeouts no cleanup do useEffect
    - _Requirements: 1.2, 1.3_

  - [ ] 2.2 Alterar timer global de 60s para 30s
    - Mudar `setInterval(() => setNow(Date.now()), 60000)` para `30000`
    - Isso atualiza indicadores de presença e micro copy a cada 30s
    - _Requirements: 1.5_

  - [ ] 2.3 Renderizar indicador de presença no `renderLeadItem`
    - Chamar `getPresenceIndicator(lead)` dentro do card
    - Renderizar dot verde (8px) para type 'online'
    - Renderizar texto "digitando..." com animação sutil para type 'typing'
    - Renderizar texto "última atividade: X" para type 'last_activity'
    - Estilo: text-[10px] text-text-muted/60, sem alterar layout do card
    - _Requirements: 1.1, 1.2, 1.4, 1.6_

  - [ ] 2.4 Renderizar micro copy no `renderLeadItem` substituindo preview
    - Chamar `getMicroCopy(lead)` dentro do card
    - Se micro copy disponível, exibir no lugar do preview da última mensagem
    - Se não, manter preview existente
    - Estilizar: warning→text-warning, muted→text-text-muted, accent→text-accent
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. ConversasSidebar — Destaque de prioridade
  - [ ] 3.1 Aplicar font-weight semibold para cards com unreadCount > 0
    - Mudar classe do nome de `font-medium` para `font-semibold` quando `unreadCount > 0`
    - _Requirements: 5.1_

  - [ ] 3.2 Aplicar opacidade diferenciada por urgência
    - Cards com `unreadCount > 0` ou status `waiting`: opacity-100
    - Demais cards: opacity-70
    - Aplicar via classe Tailwind no container do card
    - _Requirements: 5.2_

  - [ ] 3.3 Adicionar badge discreto de contagem de não-lidos
    - Exibir badge com `unreadCount` ao lado do timestamp quando > 0
    - Estilo: text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent
    - _Requirements: 5.3_

- [ ] 4. ConversasSidebar — Movimento controlado e scroll estável
  - [ ] 4.1 Implementar detecção de mudança de ordem na lista
    - Manter `prevOrderRef` com IDs da ordem anterior
    - Comparar com ordem atual após cada atualização de `filteredLeads`
    - Detectar itens que mudaram de posição
    - Se > 3 itens mudaram: fade geral 150ms (usar fadeIn existente)
    - Se 1-3 itens mudaram: animar individualmente com transition-all 300ms
    - Sem animação no initial render (prevOrderRef vazio)
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

  - [ ] 4.2 Implementar scroll estável com `scrollContainerRef`
    - Adicionar ref ao container de scroll da lista
    - Antes de atualizar lista, salvar `scrollTop` atual
    - Após atualização, restaurar `scrollTop` via `requestAnimationFrame`
    - _Requirements: 6.1, 6.5_

  - [ ] 4.3 Implementar highlight temporário para item que sobe ao topo
    - Se `scrollTop < 50px`: aplicar bg-accent/5 por 1.5s no item que subiu
    - Se `scrollTop >= 50px`: mostrar indicador "Nova atividade acima" no topo da lista
    - Click no indicador faz scroll suave ao topo e esconde o indicador
    - _Requirements: 6.2, 6.3, 6.4_

  - [ ] 4.4 Manter seleção visual durante atualizações de lista
    - Garantir que `selectedLeadId` não é resetado quando a lista é atualizada
    - O card selecionado mantém `bg-bg-surface-hover` mesmo após reordenação
    - _Requirements: 6.6_

- [ ] 5. ConversasSidebar — Sincronização robusta com socket
  - [ ] 5.1 Implementar debounce de 300ms por lead_id para eventos de socket
    - Manter `pendingUpdatesRef: Map<string, NodeJS.Timeout>`
    - Para cada evento de socket, agrupar por lead_id com debounce de 300ms
    - Processar apenas o estado final após o debounce
    - _Requirements: 7.1_

  - [ ] 5.2 Implementar registro de IDs removidos (`removedIdsRef`)
    - Manter `Set<string>` de lead_ids removidos
    - Ao receber `conversa_classificada` ou `lead_encerrado`, adicionar ID ao set
    - Ignorar eventos de socket para IDs no set
    - Limpar set apenas no próximo `loadLeads()` completo
    - _Requirements: 7.2_

  - [ ] 5.3 Substituir `loadLeads()` por atualizações pontuais para eventos individuais
    - Para `nova_mensagem_salva`: atualizar apenas `ultima_msg_em`, `lastMessage`, `unreadCount` do lead
    - Para `lead_assumido`: atualizar apenas `is_assumido` do lead
    - Manter `loadLeads()` apenas para reconexão e initial load
    - Ignorar eventos para lead_id inexistente na lista local
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 5.4 Escrever property tests para debounce e registro de removidos (Properties 3, 4)
    - **Property 3: Debounce agrupa eventos do mesmo lead em janela de 300ms**
    - **Property 4: IDs removidos não reaparecem na lista**
    - **Validates: Requirements 7.1, 7.2**

- [ ] 6. ChatCentral — Feedback imediato e optimistic updates
  - [ ] 6.1 Implementar optimistic update ao enviar mensagem
    - Ao enviar, adicionar mensagem com ID temporário `temp-{timestamp}` à lista local
    - Quando confirmação chega via socket, substituir temp pela versão real (deduplicação por conteúdo)
    - _Requirements: 4.1, 4.7_

  - [ ] 6.2 Adicionar toast feedback inline no ChatCentral
    - Estado: `{ message: string, type: 'success' | 'error' } | null`
    - Exibir toast fixo no canto inferior direito, estilo discreto (bg-bg-surface, text-xs)
    - Auto-dismiss success em 2.5s, error persiste até dismiss manual
    - Não bloquear interação com outros elementos
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

  - [ ] 6.3 Adicionar mudança visual instantânea ao assumir lead
    - Ao clicar em assumir, atualizar badge "Atendimento Humano" localmente antes da confirmação
    - _Requirements: 4.2_

  - [ ]* 6.4 Escrever property test para deduplicação de mensagens (Property 5)
    - **Property 5: Deduplicação preserva exatamente uma instância**
    - Gerar mensagens optimistic + confirmação, verificar que lista contém exatamente 1 instância
    - **Validates: Requirements 4.7**

- [ ] 7. Server.js — Evento `cliente_digitando`
  - [ ] 7.1 Adicionar handler `cliente_digitando` com throttle de 2s no `server.js`
    - Manter mapa de throttle: `lead_id → last_emit_timestamp`
    - Ao receber indicação de digitação do webhook, verificar throttle
    - Se > 2s desde último emit: emitir `cliente_digitando` com `{ lead_id }`
    - Limpar mapa periodicamente (a cada 60s, remover entradas > 10s)
    - _Requirements: 8.1, 8.3_

  - [ ] 7.2 Filtrar emissão apenas para operadores relevantes (opcional)
    - Emitir via `io.emit()` para todos os clientes conectados (simplificação inicial)
    - Nota: filtragem por operador pode ser adicionada futuramente com rooms
    - _Requirements: 8.2_

- [ ] 8. Preservação do layout — Validação final
  - [ ] 8.1 Verificar que nenhum novo componente React foi adicionado ao component tree
    - Todas as melhorias são elementos inline (spans, divs) dentro dos componentes existentes
    - _Requirements: 9.2_

  - [ ] 8.2 Verificar que a interface `Lead` em `page.tsx` não foi modificada
    - Nenhum campo novo adicionado à interface Lead
    - _Requirements: 9.3_

  - [ ] 8.3 Verificar que nenhuma animação pesada foi introduzida
    - Apenas transições CSS (transform, opacity) com duração ≤ 300ms
    - Sem keyframes complexos, transforms 3D ou parallax
    - _Requirements: 9.4_

## Notes

- Tasks marcadas com `*` são opcionais (property tests) e podem ser puladas para MVP mais rápido
- Nenhuma migração de banco necessária — todas as melhorias usam dados já existentes
- O evento `cliente_digitando` depende do webhook do canal suportar indicação de digitação
- O indicador "online agora" é uma aproximação baseada em timestamp, não presença real
- Todas as animações são CSS-only para manter performance em listas longas
- O debounce de socket substitui o padrão atual de `loadLeads()` para cada evento
