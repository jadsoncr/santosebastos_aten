# Plano de Implementação: Painel Operacional UX

## Visão Geral

Execução em 3 ondas: **ESTRUTURA → INTERFACE → COMPORTAMENTO**. Cada onda só começa quando a anterior está sólida. Sem misturar estado, UI e realtime.

- **Onda 1**: Sistema consistente (estado_painel, identity_id, fluxos, queries)
- **Onda 2**: UI base funcional (componentes, layout, classificação, confirmação)
- **Onda 3**: UX operacional inteligente (alertas, ordenação, presença, debounce)

Stack: TypeScript, Next.js App Router, Supabase, Socket.io.

---

## ONDA 1 — ESTRUTURA (sistema consistente, sem UX)

- [x] 1. Funções utilitárias e máquina de estados
  - [x] 1.1 Criar `web/utils/painelModes.ts` com o mapa `PAINEL_MODES` e o hook `usePainelMode(estadoPainel)`
    - Definir tipo `EstadoPainel` e interface `PainelModeConfig`
    - Implementar o mapa de configuração por modo (triagem, em_atendimento, cliente, encerrado)
    - Criar hook que recebe `estado_painel` e retorna a config de blocos visíveis
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Criar/atualizar `web/utils/painelStatus.ts` com `getCorPainel()`, `getEstadoLabel()`, `calcularPrazo()`, `getPrazoLabel()`
    - `getCorPainel(estadoPainel)` → retorna classe CSS de cor (cinza, azul, verde, cinza_claro)
    - `getEstadoLabel(estadoPainel)` → retorna label humano ("Triagem", "Em atendimento", etc.)
    - `calcularPrazo(statusNegocio)` → retorna Date do prazo da próxima ação
    - `getPrazoLabel(prazo)` → retorna texto formatado com urgência
    - _Requisitos: 3.1, 16.2, 10.2_

  - [x] 1.3 Validar e consolidar `web/utils/resolveTreatment.ts`
    - Garantir que `resolveTreatment(tipo, detalhe)` retorna `TreatmentResult` para pares válidos
    - Garantir que lança erro para pares inválidos
    - Exportar `TREATMENT_TIPOS`, `TREATMENT_DETALHES`, `TREATMENT_MAP`
    - _Requisitos: 8.3, 8.4_

  - [x] 1.4 Validar e consolidar `web/utils/segmentTree.ts` com `filterChildren()`
    - `filterChildren(nodes, parentId, nivel)` → retorna nós ativos do nível com parent_id correto
    - Garantir que nível 1 usa `parent_id === null`
    - _Requisitos: 6.2, 6.3, 6.4_

- [x] 2. Validar estado_painel ponta a ponta
  - [x] 2.1 Garantir que todas as queries usam `identity_id` como chave primária
    - Auditar `PainelLead.tsx`, `ChatCentral.tsx`, `ConversasSidebar.tsx`
    - Substituir `.eq('lead_id', ...)` por `.eq('identity_id', ...)` onde aplicável
    - Fallback para `lead_id` quando `identity_id` é null
    - _Requisitos: 19.1, 19.4_

  - [x] 2.2 Validar fluxo completo de transições de estado_painel
    - triagem → em_atendimento (confirmar com destino=backoffice)
    - triagem → encerrado (confirmar com destino=encerrado)
    - em_atendimento → cliente (conversão/fechou)
    - em_atendimento → encerrado (perdido)
    - encerrado → em_atendimento (reengajar)
    - cliente → triagem (novo atendimento)
    - _Requisitos: 2.5, 12.3, 12.4_

  - [x] 2.3 Garantir `handleConfirmar` sólido no PainelLead
    - Salvar: classificação jurídica, tratamento, dossiê, status_negocio, destino, estado_painel, owner_id
    - Emitir `conversa_classificada` via socket após sucesso
    - Garantir owner_id sempre definido ao entrar em atendimento
    - _Requisitos: 9.3, 9.4_

- [x] 3. Checkpoint Onda 1 — Sistema consistente
  - Critério: simular via console/teste todos os fluxos de estado sem erro
  - Garantir que todos os testes passam

  - [ ]* 3.1 Escrever teste de propriedade — Propriedade 1: Mapeamento de modo do painel
    - Gerar `EstadoPainel` aleatório → verificar `PAINEL_MODES` retorna config correta
    - **Valida: Requisitos 2.1, 2.2, 2.3, 2.4**

  - [ ]* 3.2 Escrever teste de propriedade — Propriedade 2: Mapeamento de estado para cor
    - Gerar `estado_painel` aleatório → verificar `getCorPainel` retorna cor correta
    - **Valida: Requisitos 3.1, 16.2**

  - [ ]* 3.3 Escrever teste de propriedade — Propriedade 4: Filtro cascata da árvore de segmentos
    - Gerar árvore de segmentos aleatória → verificar `filterChildren` filtra corretamente
    - **Valida: Requisitos 6.2, 6.3, 6.4**

  - [ ]* 3.4 Escrever teste de propriedade — Propriedade 6: Resolução de tratamento
    - Gerar pares tipo+detalhe → verificar `resolveTreatment` retorna resultado correto ou lança erro
    - **Valida: Requisitos 8.3, 8.4**

---

## ONDA 2 — INTERFACE BASE (componentes funcionais, sem inteligência)

- [x] 4. Componentes do Painel Lead — Blocos reutilizáveis
  - [x] 4.1 Criar `PainelHeader.tsx`
    - Exibir estado com cor de fundo via `getCorPainel()`
    - Exibir nome do responsável ou "Livre"
    - Botão "Delegar" visível apenas se `isOwner`
    - Popover com lista de operadores ao clicar "Delegar"
    - Emitir `delegate_lead` via socket ao selecionar operador
    - _Requisitos: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Criar `BlocoIdentidade.tsx`
    - Campos editáveis inline (nome, telefone, email) com save no blur
    - Score visual com `getScoreVisual()`
    - Propagação de nome para todos os leads da mesma identity
    - Botão "Vincular identidade" com busca
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.3 Criar `BlocoIntencao.tsx`
    - Exibir intenção via `getIntencaoAtual(lead)`
    - Exibir canal de origem e área do bot
    - Somente leitura
    - _Requisitos: 5.1, 5.2, 5.3_

  - [x] 4.4 Criar `BlocoClassJuridica.tsx`
    - 3 dropdowns cascata usando `filterChildren()`
    - Limpar níveis inferiores ao mudar nível superior
    - Aviso "⚠ Obrigatória para backoffice" quando necessário
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 4.5 Criar `BlocoDossie.tsx`
    - Textarea com auto-save no blur (insere nota_interna)
    - Indicador "Salvo" por 1.5s
    - Lista de notas anteriores ordenadas DESC
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 4.6 Criar `BlocoTratamento.tsx`
    - 2 dropdowns (tipo + detalhe) com `TREATMENT_TIPOS` e `TREATMENT_DETALHES`
    - Executa `resolveTreatment()` ao selecionar ambos
    - Card de resultado: azul para backoffice, cinza para encerrado
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 4.7 Criar `BotaoConfirmacao.tsx`
    - Desabilitado sem tratamento ou sem classificação jurídica (quando backoffice)
    - Texto "Processando..." durante loading
    - Exibe razão do bloqueio
    - Botão "Não fechou" para destino backoffice
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 4.8 Criar `BlocoStatusAtual.tsx`
    - Formata `status_negocio` em linguagem humana
    - Exibe próxima ação e prazo com `getPrazoLabel()`
    - _Requisitos: 10.1, 10.2_

  - [x] 4.9 Criar `BotoesAcao.tsx`
    - Botões "Confirmar reunião", "Enviar proposta", "Perdido"
    - Modal de confirmação com campos relevantes
    - Registra `timeline_events` e `status_transitions`
    - _Requisitos: 10.3, 10.4, 10.5, 10.6_

  - [x] 4.10 Criar `BlocoContrato.tsx` e `BotaoNovoAtendimento.tsx`
    - Exibir valor e status de pagamento (modo cliente)
    - Botão "Iniciar novo atendimento" cria novo registro
    - _Requisitos: 11.1, 11.2, 11.3_

  - [x] 4.11 Criar `BlocoMotivoEncerramento.tsx` e `BotaoReengajar.tsx`
    - Exibir motivo do encerramento formatado (modo encerrado)
    - Botão "Reengajar" altera estado_painel para em_atendimento
    - _Requisitos: 12.1, 12.2, 12.3, 12.4_

- [x] 5. Refatorar PainelLead — Composição por modo
  - [x] 5.1 Refatorar `PainelLead.tsx` para usar `usePainelMode` e compor blocos
    - Substituir o componente monolítico por composição condicional
    - Renderizar blocos conforme `PAINEL_MODES[estadoPainel]`
    - Manter props `lead`, `onLeadUpdate`, `onLeadClosed`
    - Carregar `atendimento` e derivar `estadoPainel` (null → 'triagem')
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 16.1_

  - [x] 5.2 Atualizar `Tela1Page` para layout de 3 colunas e props corretas
    - Garantir que `selectedLead`, `onLeadUpdate`, `onLeadClosed` propagam corretamente
    - Garantir layout: Sidebar (320px) | Chat (flex) | Painel (360px)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 6. Chat Central — Funcional base
  - [x] 6.1 Garantir carregamento de mensagens cross-canal por identity_id
    - Buscar todos os leads da mesma identity → carregar mensagens de todos
    - Fallback para lead_id direto quando sem identity_id
    - _Requisitos: 15.1, 19.4_

  - [x] 6.2 Garantir envio e recebimento de mensagens via socket
    - Enviar via `nova_mensagem`, receber via `nova_mensagem_salva`
    - Scroll automático para o final ao receber nova mensagem
    - _Requisitos: 15.3, 15.4_

  - [x] 6.3 Garantir badge de canal (WhatsApp/Telegram) em mensagens recebidas
    - Exibir badge com canal de origem em cada mensagem do cliente
    - _Requisitos: 15.8_

- [x] 7. Checkpoint Onda 2 — Interface funcional
  - Critério: operador consegue abrir → entender → classificar → confirmar → enviar mensagem
  - Garantir que todos os testes passam

  - [ ]* 7.1 Escrever teste de propriedade — Propriedade 3: Classificação visual do score
    - Gerar score 0-10 → verificar `getScoreVisual` retorna visual correto
    - **Valida: Requisitos 4.2, 14.2**

  - [ ]* 7.2 Escrever teste de propriedade — Propriedade 5: Validação do botão de confirmação
    - Gerar combinações de treatment + classificação → verificar habilitação do botão
    - **Valida: Requisitos 6.5, 6.6, 9.1, 9.2, 9.8**

  - [ ]* 7.3 Escrever teste de propriedade — Propriedade 10: Alinhamento de mensagens
    - Gerar mensagens com remetentes variados → verificar alinhamento
    - **Valida: Requisito 15.2**

  - [ ]* 7.4 Escrever teste de propriedade — Propriedade 12: Ordenação de notas do dossiê
    - Gerar notas com timestamps → verificar ordenação DESC
    - **Valida: Requisito 7.5**

---

## ONDA 3 — UX OPERACIONAL (inteligência, alertas, realtime refinado)

- [ ] 8. Sidebar inteligente — Indicadores visuais e ordenação
  - [ ] 8.1 Extrair `LeadCard.tsx` e `AlertBadges.tsx` da ConversasSidebar
    - LeadCard com: avatar + dot de status, nome, preview, score, tempo, responsável
    - AlertBadges: 🔴 não lido, ⚠️ sem responsável, ⏱ sem resposta > 15min
    - Borda lateral por score (azul ≥7, amarelo ≥4, cinza <4)
    - Fundo azul sutil + negrito para < 5min ou não lidos
    - Opacidade 60% para > 24h
    - _Requisitos: 13.3, 13.4, 13.5, 13.6, 14.1, 14.2, 14.3, 14.4, 18.1, 18.2, 18.3_

  - [ ] 8.2 Implementar ordenação inteligente e remoção em tempo real
    - `sortConversations()` com não lidos no topo, depois por inatividade
    - Remover lead da lista ao receber `conversa_classificada`
    - Atualizar responsável ao receber `assignment_updated`
    - Reordenar ao receber `nova_mensagem_salva`
    - _Requisitos: 13.7, 13.8, 20.1, 20.2, 20.3_

  - [ ] 8.3 Implementar remoção de badge ao selecionar lead
    - Ao selecionar lead com badge de não lido, remover badge
    - _Requisitos: 18.4_

- [ ] 9. Realtime refinado — Socket, presença, feedback
  - [ ] 9.1 Implementar listener de socket `estado_painel_changed` no PainelLead
    - Ao receber evento, atualizar modo sem reload
    - Garantir transição < 1s
    - _Requisitos: 2.5, 20.1_

  - [ ] 9.2 Implementar indicador de presença no ChatHeader
    - Exibir nome de outros operadores visualizando o mesmo lead
    - Heartbeat via `user_viewing` a cada 10s
    - Limpar ao sair (`user_left`)
    - _Requisitos: 20.4_

  - [ ] 9.3 Implementar toast system global reutilizável
    - Toast verde por 3s para sucesso
    - Toast vermelho persistente com botão ✕ para erro
    - Feedback em < 500ms após ação
    - _Requisitos: 17.1, 17.3, 17.4, 17.5_

  - [ ] 9.4 Debounce de eventos no frontend
    - Debounce 200-300ms no handler de `nova_mensagem_salva`
    - Evitar flood/piscar da lista com burst de mensagens
    - _Requisitos: 20.3_

- [ ] 10. Histórico e consolidação por identity
  - [ ] 10.1 Implementar histórico por identity no PainelLead
    - Carregar últimos 5 atendimentos da mesma identity
    - Exibir tipo de tratamento, destino e data
    - _Requisitos: 19.1, 19.2, 19.3_

  - [ ] 10.2 Garantir emissão e escuta de todos os eventos de socket do design
    - `conversa_classificada`, `delegate_lead`, `assignment_updated`, `estado_painel_changed`
    - `nova_mensagem`, `nova_mensagem_salva`, `user_viewing`, `viewing_update`, `user_left`
    - _Requisitos: 9.4, 20.1, 20.2, 20.3, 20.4_

- [ ] 11. Checkpoint Onda 3 — Operador não precisa pensar
  - Critério: operador olha → entende → clica → resolve. Sem pensar.
  - Garantir que todos os testes passam

  - [ ]* 11.1 Escrever teste de propriedade — Propriedade 7: Ordenação de conversas
    - Gerar lista de leads com unread/timestamps → verificar ordenação
    - **Valida: Requisito 13.7**

  - [ ]* 11.2 Escrever teste de propriedade — Propriedade 8: Status de conversa para cor do dot
    - Gerar timestamps → verificar `getConversationStatus` retorna status correto
    - **Valida: Requisito 14.1**

  - [ ]* 11.3 Escrever teste de propriedade — Propriedade 9: Camada visual de urgência
    - Gerar leads com timestamps variados → verificar camada visual
    - **Valida: Requisitos 14.3, 14.4**

  - [ ]* 11.4 Escrever teste de propriedade — Propriedade 11: Validação de arquivo
    - Gerar arquivos com tamanhos e tipos variados → verificar validação
    - **Valida: Requisito 15.6**

  - [ ]* 11.5 Escrever testes de integração
    - Fluxo completo de triagem: selecionar → classificar → confirmar → verificar banco + socket
    - Fluxo de delegação: delegar → verificar assignment_updated → sidebar atualizada
    - Fluxo de reengajamento: encerrado → reengajar → verificar estado_painel
    - Cross-canal: identity com 2 leads → mensagens consolidadas
    - _Requisitos: 9.3, 9.4, 12.3, 19.4_

---

## Notas

- Tasks marcadas com `*` são opcionais (testes de propriedade) e podem ser puladas para MVP
- **Regra de ouro**: sem estado sólido = UX frágil
- **Ordem obrigatória**: Onda 1 completa antes de Onda 2, Onda 2 completa antes de Onda 3
- Cada checkpoint valida que a onda anterior está sólida antes de avançar
- "Primeiro o sistema funciona, depois fica bonito, depois fica inteligente"
