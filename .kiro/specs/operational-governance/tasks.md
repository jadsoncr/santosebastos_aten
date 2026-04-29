# Plano de Implementação: Governança Operacional

## Visão Geral

Implementação incremental: utilitários puros → correção backend → refatoração frontend → testes PBT.

## Tasks

- [ ] 1. Criar utilitários puros
  - [ ] 1.1 Criar `web/utils/computePriority.ts`
    - Implementar interface `PriorityInput` e tipo `Prioridade`
    - Implementar função `computePriority` com if/else conforme design
    - ALTA: prazo vencido OU criado < 30min OU ciclo > 1 OU score ≥ 7
    - MEDIA: score ≥ 4 OU ultima_msg_de === 'operador'
    - BAIXA: caso contrário
    - _Requisitos: 4.1, 4.2, 4.3, 4.6_

  - [ ] 1.2 Criar `web/utils/motivoFechamento.ts`
    - Exportar array constante com os 9 motivos válidos
    - Exportar função `isValidMotivo(s: string): boolean`
    - Exportar mapa `motivoLabel` com texto humanizado para cada motivo
    - Exportar mapa `motivoColor` com cor Tailwind para cada motivo
    - _Requisitos: 3.1_

  - [ ] 1.3 Criar função `sortLeadsByPriority` em `web/utils/computePriority.ts`
    - Ordenar: (1) não lidas primeiro, (2) ALTA → MEDIA → BAIXA, (3) maior tempo sem interação
    - _Requisitos: 4.5_

- [ ] 2. Corrigir sweep em `server.js`
  - [ ] 2.1 Refatorar abandono de triagem (abandono_ura)
    - Condição: `estado_painel IN ('lead', NULL)` + sem msg de operador + tempo > threshold
    - Query via `identity_id` no atendimento (nunca lead_id)
    - Ação: `estado_painel = 'encerrado'`, `motivo_fechamento = 'abandono_ura'`
    - Emitir socket `estado_painel_changed`
    - _Requisitos: 1.1, 1.2, 1.3_

  - [ ] 2.2 Refatorar abandono de atendimento (abandono_operador)
    - Condição: `estado_painel = 'em_atendimento'` + ultima_msg_de = 'operador' + tempo > threshold
    - Query via `identity_id` no atendimento (nunca lead_id)
    - Ação: `estado_painel = 'encerrado'`, `motivo_fechamento = 'abandono_operador'`
    - Emitir socket `estado_painel_changed`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Checkpoint — Validar sweep
  - Garantir que sweep usa identity_id, condições corretas e emite sockets. Perguntar ao usuário se houver dúvidas.

- [ ] 4. Criar componente MotivoTag
  - [ ] 4.1 Criar `web/app/(dashboard)/tela1/components/MotivoTag.tsx`
    - Badge simples usando mapa de cores/labels de `motivoFechamento.ts`
    - Renderizar `<span>` com texto humanizado e cor por motivo
    - _Requisitos: 5.6_

- [ ] 5. Refatorar ConversasSidebar
  - [ ] 5.1 Substituir pills por abas Ativos/Encerrados
    - Aba Ativos: query `estado_painel IN (null, 'lead', 'em_atendimento', 'cliente')`
    - Aba Encerrados: query `estado_painel = 'encerrado'` ordenado por `encerrado_em DESC`
    - Aba padrão: Ativos. Contagem em cada aba. Limite 100 itens.
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_

  - [ ] 5.2 Integrar `computePriority` e `sortLeadsByPriority` na aba Ativos
    - Substituir `sortConversations` atual pela nova ordenação
    - _Requisitos: 4.5_

  - [ ] 5.3 Exibir MotivoTag nos itens da aba Encerrados
    - _Requisitos: 5.6_

  - [ ] 5.4 Escutar socket `estado_painel_changed` para mover leads entre abas
    - Refetch ao receber evento, nunca setar estado diretamente
    - _Requisitos: 7.2, 7.3_

- [ ] 6. Checkpoint — Validar frontend
  - Garantir que abas funcionam, ordenação correta, MotivoTag visível. Perguntar ao usuário se houver dúvidas.

- [ ] 7. Testes de propriedade (PBT)
  - [ ]* 7.1 PBT: Classificação exaustiva de computePriority
    - **Propriedade 1: Classificação exaustiva de prioridade**
    - Gerar `PriorityInput` aleatórios com fast-check, verificar retorno correto
    - **Valida: Requisitos 4.1, 4.2, 4.3, 4.4**

  - [ ]* 7.2 PBT: Invariante de ordenação da sidebar
    - **Propriedade 2: Invariante de ordenação da sidebar**
    - Gerar listas aleatórias, verificar: não lidas primeiro → ALTA → MEDIA → BAIXA → maior inatividade
    - **Valida: Requisitos 4.5**

  - [ ]* 7.3 PBT: Partição de abas por estado_painel
    - **Propriedade 3: Partição de abas por estado_painel**
    - Gerar leads com estado_painel aleatório, verificar partição correta entre abas
    - **Valida: Requisitos 5.2, 5.3**

  - [ ]* 7.4 PBT: Validação do enum motivo_fechamento
    - **Propriedade 4: Validação do enum motivo_fechamento**
    - Gerar strings aleatórias, verificar aceitação/rejeição correta
    - **Valida: Requisitos 3.1**

  - [ ]* 7.5 PBT: Limite de 100 itens por aba
    - **Propriedade 5: Limite de 100 itens por aba**
    - Gerar listas > 100, verificar truncamento
    - **Valida: Requisitos 5.7**

## Notas

- Tasks com `*` são opcionais (testes PBT) e podem ser puladas para MVP rápido
- Backend usa JavaScript (server.js), frontend usa TypeScript
- Toda query de atendimento usa `identity_id`, nunca `lead_id`
