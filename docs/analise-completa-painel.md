# Análise Completa — Painel Lead: O que Existe vs. O que Precisa Ser Construído

## ARQUITETURA CORRETA (VALIDADA)

```
Cliente fala → URA sugere → sistema organiza → operador entende → operador classifica → sistema executa
```

Separação clara:
- **Intenção do cliente** ≠ verdade
- **Classificação jurídica (3 níveis)** = filtro de entrada (O QUE É o caso)
- **Classificação de tratamento (2 níveis)** = decisão operacional (O QUE FAZER com o caso)

---

## 📊 INVENTÁRIO: O QUE JÁ EXISTE HOJE

### ✅ EXISTE E ESTÁ CORRETO

| Item | Arquivo | Status |
|------|---------|--------|
| `resolveTreatment.ts` — motor de decisão (2 níveis: Tipo + Detalhe → destino + status_negocio) | `web/utils/resolveTreatment.ts` | ✅ Pronto, correto |
| `segmentTree.ts` — utils para dropdowns cascata (3 níveis) | `web/utils/segmentTree.ts` | ✅ Pronto, correto |
| `segment_trees` no banco — 68 especificações com status_negocio/destino/fila/acao | Migration 018 | ✅ Seed completo |
| `arvore-classificacao.md` — documentação completa da árvore | `docs/arvore-classificacao.md` | ✅ Referência |
| Tabela `atendimentos` com colunas: status_negocio, destino, classificacao_tratamento_tipo, classificacao_tratamento_detalhe, observacao | Migrations 019-021 | ✅ Schema pronto |
| `getIntencaoAtual.ts` — interpreta mensagens reais do cliente | `web/utils/getIntencaoAtual.ts` | ✅ Pronto |
| `getEstadoCliente.ts` — detecta confuso/perdido/ativo | `web/utils/getEstadoCliente.ts` | ✅ Pronto |
| Socket `conversa_classificada` — broadcast + remoção da sidebar | `server.js` + sidebar | ✅ Corrigido (closedLeadId) |
| `PainelLead.tsx` — painel com tratamento (2 níveis) + dossiê + confirmar | Tela1 | ✅ Funcional |
| `BlocoQualificacao.tsx` — painel ANTIGO com classificação jurídica (3 dropdowns) + botoeira | Tela1 | ⚠️ Existe mas NÃO está integrado no PainelLead novo |
| Pipeline linear no backoffice | `pipeline.js` + tela2 | ✅ Funcional |
| Identities + merge cross-canal | `identityResolver.js` | ✅ Funcional |

### ⚠️ EXISTE MAS PRECISA AJUSTE

| Item | Problema | Ação |
|------|----------|------|
| `BlocoQualificacao.tsx` | É o painel ANTIGO — tem classificação jurídica (3 níveis) MAS também tem botoeira de jornada (Agendar/Proposta/Contrato) que mistura classificação com ação | Extrair APENAS os 3 dropdowns jurídicos e mover pro PainelLead novo |
| `PainelLead.tsx` | Tem tratamento (2 níveis) + dossiê + confirmar, MAS falta classificação jurídica (3 níveis) | Adicionar bloco de classificação jurídica ANTES do dossiê |
| Sidebar card | Mostra intenção + score, MAS não mostra estado (confuso/ativo/perdido) | Adicionar estado visual |
| Tela2 (backoffice) | Filtra por `status_negocio` mas não mostra classificação jurídica do caso | Mostrar área + assunto + especificação no card do backoffice |

### ❌ NÃO EXISTE — PRECISA SER CONSTRUÍDO

| Item | Descrição | Prioridade |
|------|-----------|-----------|
| Classificação jurídica NO PainelLead | 3 dropdowns (Área → Categoria → Subcategoria) usando segment_trees, ANTES do dossiê | 🔴 CRÍTICO |
| Persistência da classificação jurídica no `handleConfirmar` | Salvar segmento_id, assunto_id, especificacao_id junto com tratamento | 🔴 CRÍTICO |
| Tela de ABANDONOS | Query `WHERE destino = 'encerrado'` — listar leads encerrados (informação, sem_interesse, trote, erro) | 🟡 ALTO |
| Cor do painel por status_negocio | triagem=cinza, backoffice=azul, negociação=amarelo, fechado=verde, perdido=cinza claro | 🟡 MÉDIO |
| Painel por identity_id (não por lead) | Hoje é por lead — precisa consolidar por identidade | 🟡 MÉDIO |
| Auto-sugestão de tratamento baseada na URA | Se URA = Trabalhista → sugerir "Solicitação → Reunião" | 🟢 FUTURO |

---

## 🧱 ORDEM CORRETA DO PAINEL (COMO DEVE FICAR)

```
┌─────────────────────────────────────┐
│ 1. O QUE O CLIENTE QUER             │  ← getIntencaoAtual() ✅ EXISTE
│    "Falar com advogado (trabalhista)"│
│    Telegram • Trabalhista            │
│    URA: trabalhista                  │
├─────────────────────────────────────┤
│ 2. IDENTIFICAÇÃO                     │  ✅ EXISTE
│    Nome: [editável]                  │
│    Telefone: [editável]              │
│    Email: [editável]                 │
│    [Vincular identidade]             │
├─────────────────────────────────────┤
│ 3. CLASSIFICAÇÃO JURÍDICA            │  ❌ FALTA NO PainelLead
│    Área do caso: [Trabalhista ▼]     │
│    Tipo do problema: [Rescisão ▼]    │
│    Detalhe: [Sem justa causa ▼]      │
├─────────────────────────────────────┤
│ 4. OBSERVAÇÃO (DOSSIÊ)               │  ✅ EXISTE
│    [textarea]                        │
│    Notas anteriores...               │
├─────────────────────────────────────┤
│ 5. CLASSIFICAÇÃO DE TRATAMENTO       │  ✅ EXISTE
│    Tipo: [Solicitação ▼]             │
│    Detalhe: [Reunião ▼]             │
│    ┌─────────────────────────┐      │
│    │ Encaminhamento: Backoffice │    │
│    │ Status: aguardando_agendamento │ │
│    └─────────────────────────┘      │
├─────────────────────────────────────┤
│ 6. BOTÃO                             │  ✅ EXISTE
│    [Confirmar encaminhamento]        │
│    [Não fechou] [Delegar]            │
└─────────────────────────────────────┘
```

---

## 🎯 O QUE SERÁ MANTIDO (SEM ALTERAÇÃO)

1. `resolveTreatment.ts` — motor de decisão operacional ✅
2. `segmentTree.ts` — utils de cascata ✅
3. `getIntencaoAtual.ts` — intenção consolidada ✅
4. `getEstadoCliente.ts` — estado comportamental ✅
5. `server.js` — socket handlers ✅
6. Tabela `segment_trees` com 68 especificações ✅
7. Tabela `atendimentos` com schema completo ✅
8. Pipeline linear (backoffice) ✅
9. Sidebar com remoção via closedLeadId ✅
10. Tela2 filtrando por `destino = 'backoffice'` ✅

---

## 🔧 O QUE PRECISA SER CONSTRUÍDO (ENCADEAMENTO)

### FASE 1 — CLASSIFICAÇÃO JURÍDICA NO PAINEL (BLOCKER)

**Tarefa:** Adicionar 3 dropdowns cascata no PainelLead, entre "Identificação" e "Observação".

**Labels (linguagem humana, não técnica):**
- Nível 1: **Área do caso** (Ex: Trabalhista, Família, Consumidor)
- Nível 2: **Tipo do problema** (Ex: Rescisão, Divórcio, Cobrança indevida)
- Nível 3: **Detalhe do problema** (Ex: Sem justa causa, Consensual, Cartão de crédito)

**Fonte dos dados:** `segment_trees` (já populada)
**Utils:** `filterChildren()` de `segmentTree.ts` (já existe)
**Persistência:** Salvar `segmento_id`, `assunto_id`, `especificacao_id` no `handleConfirmar`

**Regras:**
- Obrigatória para casos que vão para backoffice
- Editável pelo operador
- NÃO define destino (quem define é o tratamento)
- NÃO executa ação

### FASE 2 — HANDLECONFIRMAR COMPLETO

**Tarefa:** Atualizar `handleConfirmar()` para salvar TUDO junto:
- classificação jurídica (segmento_id, assunto_id, especificacao_id)
- tratamento (tipo + detalhe)
- observação
- status_negocio + destino (do resolveTreatment)

### FASE 3 — ABANDONOS (TAB NO BACKOFFICE, NÃO TELA ISOLADA)

**Tarefa:** Criar TAB "Encerrados" dentro da tela2 (backoffice) — NÃO é rota separada.
Abandonos é parte do fluxo, não módulo isolado.

**Query:** `WHERE destino = 'encerrado'`
**Tipos:** informação, sem_interesse, trote, erro

### FASE 4 — PAINEL POR IDENTITY (🔴 CRÍTICO, NÃO MÉDIO)

**Tarefa:** PainelLead opera por `identity_id`, não por `lead.id`
- Buscar TODOS os leads da mesma identidade
- Mostrar histórico consolidado (atendimentos anteriores)
- Manter contexto entre sessões

Sem isso: perde histórico, perde contexto, quebra CX, quebra CS.

**Validação:**
- [ ] Cliente que volta tem histórico visível
- [ ] Operador vê atendimentos anteriores no painel

### FASE 5 — COR DO PAINEL + ESTADO VISUAL NO CARD

**Tarefa:** Aplicar cor de fundo/borda no painel baseado em `status_negocio`
**Tarefa:** Mostrar estado do cliente (confuso/ativo/perdido) no card da sidebar

---

## 🗑️ O QUE SERÁ REMOVIDO/DEPRECADO

| Item | Motivo |
|------|--------|
| `BlocoQualificacao.tsx` como painel principal | Substituído pelo PainelLead. Os 3 dropdowns serão extraídos e movidos. A botoeira (Agendar/Proposta/Contrato) será removida da triagem — essas ações pertencem ao BACKOFFICE, não à triagem. |
| `resolveClassification.ts` | Redundante — o destino agora vem do `resolveTreatment`, não da árvore jurídica |
| Botoeira de jornada na triagem | Ações como "Agendar reunião" e "Enviar proposta" são do BACKOFFICE. Na triagem, o operador só classifica e encaminha. |

---

## ⚠️ AJUSTES APLICADOS (FEEDBACK DE APROVAÇÃO)

1. **Linguagem humana nos dropdowns** — "Área do caso / Tipo do problema / Detalhe do problema" em vez de "Área / Categoria / Subcategoria" (operador não pensa em termos técnicos)
2. **Abandonos como TAB no backoffice** — não é tela isolada, é parte do fluxo (Relacionamento → Backoffice → Encerrados)
3. **Painel por identity = 🔴 CRÍTICO** — sem isso perde histórico, contexto, CX e CS. Não é médio.

---

## 🧠 REGRA FINAL

```
TRIAGEM (tela1) → PainelLead:
  Operador entende → classifica juridicamente → classifica tratamento → confirma → lead sai

BACKOFFICE (tela2) → PainelAtendimento:
  Operador executa → agenda → envia proposta → gera contrato → converte

CLIENTE (pós-conversão) → PainelCliente:
  Relacionamento contínuo → acompanhamento → retenção
```

A triagem NÃO executa. A triagem DECIDE.
O backoffice NÃO decide. O backoffice EXECUTA.
O painel cliente NÃO vende. O painel cliente MANTÉM.

---

## 🔄 JORNADAS COMPLETAS — ANÁLISE DE CICLO DE VIDA

### JORNADA 1: LEAD → TRIAGEM → BACKOFFICE (Solicitação)

```
Telegram/WhatsApp → Bot (URA) → Sidebar (tela1) → Operador assume
→ PainelLead: Intenção + Jurídico + Dossiê + Tratamento
→ Confirmar: destino=backoffice
→ Lead SOME da tela1
→ Lead APARECE na tela2 como "caso"
→ PainelAtendimento: Pipeline (agendamento → proposta → negociação → contrato → fechado)
→ Fechado: vira CLIENTE
→ PainelCliente: relacionamento contínuo
```

**Status:** ✅ Funcional (com gaps listados abaixo)

### JORNADA 2: LEAD → TRIAGEM → ENCERRADO (Informação/BadCall)

```
Telegram/WhatsApp → Bot (URA) → Sidebar (tela1) → Operador assume
→ PainelLead: Tratamento = Informação/BadCall
→ Confirmar: destino=encerrado
→ Lead SOME da tela1
→ Lead APARECE na seção "Encerrados" da tela2 (recuperação)
→ Se cliente volta: reaquecido na sidebar
```

**Status:** ⚠️ Parcial — encerrados aparecem na tela2 mas sem tab dedicada, misturado com recuperação

### JORNADA 3: BACKOFFICE → PERDIDO → REENGAJAR

```
Caso no pipeline → Operador clica "Desistiu" → status=perdido
→ Aparece na seção "Perdidos do Backoffice" (tela2, recuperação)
→ Botão "Reengajar" → volta pra aguardando_agendamento
→ Caso reaparece no pipeline ativo
```

**Status:** ✅ Funcional

### JORNADA 4: LEAD → REENTRADA (cliente volta)

```
Lead encerrado/perdido → Cliente manda mensagem
→ server.js detecta: is_reaquecido=true
→ Lead reaparece na sidebar como reaquecido
→ Operador vê histórico anterior
→ Reclassifica se necessário
```

**Status:** ⚠️ Parcial — reaquecido funciona mas operador NÃO vê classificação anterior no painel

### JORNADA 5: FECHADO → CLIENTE (pós-conversão)

```
Caso fechado no pipeline → handleFechar() → status=fechado
→ Deveria virar CLIENTE (tabela clients)
→ PainelCliente com relacionamento contínuo
```

**Status:** ❌ Incompleto — `handleFechar` só muda status, não cria client. O `BlocoQualificacao` antigo tinha `handleConversao` que criava client, mas o fluxo novo (tela2) não faz isso.

---

## 📊 PARECER: O QUE EXISTE vs. O QUE FALTA POR JORNADA

### TELA 1 — PAINEL LEAD (TRIAGEM)

| Item | Status | O que falta |
|------|--------|-------------|
| Intenção consolidada | ✅ | — |
| Identificação editável | ✅ | — |
| Classificação jurídica (3 níveis) | ❌ | Adicionar dropdowns |
| Dossiê (observação) | ✅ | — |
| Tratamento (2 níveis) | ✅ | — |
| Motor de decisão (resolveTreatment) | ✅ | — |
| Resultado visual (destino + status) | ✅ | — |
| Botão confirmar | ✅ | Adicionar validação: jurídico obrigatório se backoffice |
| BadCall sem jurídico | ❌ | Permitir encerrar sem classificação jurídica |
| Remoção da sidebar ao confirmar | ✅ | Corrigido (closedLeadId) |

### TELA 2 — PAINEL ATENDIMENTO (BACKOFFICE)

| Item | Status | O que falta |
|------|--------|-------------|
| Lista de casos (3 seções) | ✅ | — |
| Chat central | ✅ | — |
| Painel de ação (próximo passo) | ✅ | — |
| Pipeline linear (ACTION_MAP) | ✅ | — |
| Transições validadas | ✅ | — |
| Classificação jurídica visível | ⚠️ | Mostra `classificacao_entrada` (texto) mas não os 3 níveis resolvidos |
| Valor estimado / contrato | ✅ | — |
| Desistiu → perdido | ✅ | — |
| Reengajar → volta ao pipeline | ✅ | — |
| Encerrados (tab/seção) | ⚠️ | Existe na seção "Recuperação" mas não como tab principal |
| Conversão → criar client | ❌ | `handleFechar` não cria registro em `clients` |
| Painel por identity | ❌ | Hoje é por lead_id |

### PÓS-CONVERSÃO — PAINEL CLIENTE

| Item | Status | O que falta |
|------|--------|-------------|
| Tabela `clients` | ✅ | Existe no banco |
| Tela de clientes | ❌ | Não existe — precisa ser criada |
| Relacionamento contínuo | ❌ | Não implementado |
| Histórico de atendimentos | ❌ | Não consolidado |

### RECUPERAÇÃO (SEÇÃO NA TELA2)

| Item | Status | O que falta |
|------|--------|-------------|
| Perdidos BO (com valor) | ✅ | — |
| Encerrados | ✅ | — |
| Abandonados URA | ✅ | — |
| Outros | ✅ | — |
| Reengajar perdidos | ✅ | — |
| Reengajar encerrados | ⚠️ | Redireciona pra tela1 mas não muda destino |

---

## 🔴 O QUE FALTA PRA FECHAR (LISTA FINAL COMPLETA)

### 🔴 CRÍTICO (sem isso o produto não fecha ciclo)

1. **Classificação jurídica no PainelLead** — 3 dropdowns com linguagem humana
2. **BadCall sem jurídico** — permitir encerrar direto quando não há contexto
3. **Conversão real no pipeline** — `handleFechar` na tela2 precisa criar `client`
4. **Painel por identity** — consolidar histórico por cliente, não por lead
5. **Encerrados como tab principal** — não escondido na seção de recuperação

### 🟠 ALTO IMPACTO

6. **Classificação jurídica visível na tela2** — resolver nomes dos 3 níveis (join segment_trees)
7. **Reengajar encerrados corretamente** — mudar destino pra backoffice + status
8. **Histórico de classificação anterior na reentrada** — operador vê o que foi decidido antes

### 🟡 MÉDIO

9. **Painel Cliente (pós-conversão)** — tela dedicada ou tab
10. **Cor do painel por status** — visual feedback
11. **Card sidebar com estado** (confuso/ativo/perdido)

---

## 🧱 PAINÉIS POR FASE (COMO VOCÊ DEFINIU)

```
┌──────────────────────────────────────────────────────────────┐
│ FASE 1: LEAD                                                  │
│ Tela: tela1 (sidebar + chat + PainelLead)                    │
│ Painel: PainelLead                                           │
│ Função: DECIDIR (classificar + encaminhar)                   │
│ Saída: backoffice OU encerrado                               │
├──────────────────────────────────────────────────────────────┤
│ FASE 2: ATENDIMENTO                                           │
│ Tela: tela2 (lista + chat + PainelAtendimento)               │
│ Painel: Painel de Ação (já existe como "Próximo passo")      │
│ Função: EXECUTAR (pipeline: agendar → proposta → contrato)   │
│ Saída: fechado (vira cliente) OU perdido                     │
├──────────────────────────────────────────────────────────────┤
│ FASE 3: CLIENTE                                               │
│ Tela: ❌ NÃO EXISTE AINDA                                    │
│ Painel: PainelCliente                                        │
│ Função: MANTER (relacionamento, acompanhamento, retenção)    │
│ Saída: —                                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## ⏱️ ESTIMATIVA ATUALIZADA

| Commit | O que | Prioridade | Tempo |
|--------|-------|-----------|-------|
| 1 | Classificação jurídica no PainelLead + BadCall | 🔴 | 2h |
| 2 | handleConfirmar salva jurídico + validação | 🔴 | 30min |
| 3 | Encerrados como tab na tela2 + reengajar correto | 🔴 | 2h |
| 4 | handleFechar cria client (conversão real) | 🔴 | 1h |
| 5 | Painel por identity (refactor chave) | 🔴 | 3-4h |
| 6 | Classificação jurídica visível na tela2 (join) | 🟠 | 1h |
| 7 | Histórico na reentrada | 🟠 | 1-2h |
| 8 | Painel Cliente (tela nova) | 🟡 | 3-4h |
| **TOTAL** | | | **~14-16h** |

---

## 🎯 ORQUESTRAÇÃO FINAL — ROTEIRO DE IMPLEMENTAÇÃO

### COMMIT 1 — Classificação Jurídica no PainelLead (BLOCKER)

**O que fazer:**
- Adicionar 3 dropdowns cascata no PainelLead (entre Identificação e Dossiê)
- Labels: "Área do caso" → "Tipo do problema" → "Detalhe do problema"
- Carregar `segment_trees` com `filterChildren()`
- State: `selectedSegmento`, `selectedAssunto`, `selectedEspecificacao`
- Salvar no `handleConfirmar`: `segmento_id`, `assunto_id`, `especificacao_id`
- Regra: obrigatório para backoffice, opcional para encerrado

**Validação:**
- [ ] Selecionar Trabalhista → Rescisão → Sem justa causa
- [ ] Confirmar encaminhamento → banco tem os 3 IDs salvos
- [ ] Lead some da sidebar
- [ ] Lead aparece na tela2 com classificação

---

### COMMIT 2 — Abandonos (TAB no Backoffice)

**O que fazer:**
- Adicionar TAB "Encerrados" na tela2 (NÃO rota separada)
- Query: `WHERE destino = 'encerrado'`
- Card: Nome | Intenção | Motivo (status_negocio) | Tempo | [Reengajar]
- Tipos: resolvido (informação), perdido (sem_interesse/trote/erro)
- Botão Reengajar: muda destino → backoffice, status → aguardando_agendamento

**Validação:**
- [ ] Classificar lead como Informação → Endereço → confirmar
- [ ] Lead aparece na tab "Encerrados" do backoffice
- [ ] Clicar Reengajar → lead volta pro pipeline ativo

---

### COMMIT 3 — Backoffice Exibindo Classificação Jurídica

**O que fazer:**
- Na tela2, buscar `segmento_id`, `assunto_id`, `especificacao_id` do atendimento
- Resolver nomes via join com `segment_trees`
- Exibir no card: `Trabalhista → Rescisão → Sem justa causa`

**Validação:**
- [ ] Lead classificado aparece na tela2 com área/categoria/subcategoria visíveis
- [ ] Operador do backoffice sabe exatamente o que é o caso

---

### COMMIT 4 — Card da Sidebar Completo

**O que fazer:**
- Chamar `getEstadoCliente()` com mensagens do lead
- Exibir no card: `Intenção | Estado | Score | Tempo`
- Cor do dot baseada no estado (verde=ativo, amarelo=confuso, vermelho=perdido)

**Validação:**
- [ ] Lead com muitos "oi" mostra "Confuso"
- [ ] Lead normal mostra "Ativo"
- [ ] Score visível no card

---

### COMMIT 5 — Painel por Identity (🔴 CRÍTICO)

**O que fazer:**
- PainelLead recebe `identity_id` em vez de `lead.id` como chave
- Buscar TODOS os leads da mesma identidade
- Mostrar histórico consolidado (atendimentos anteriores)
- Manter contexto entre sessões

**Impacto se não fizer:** perde histórico, perde contexto, quebra CX, quebra CS.

**Validação:**
- [ ] Cliente que volta tem histórico visível
- [ ] Operador vê atendimentos anteriores no painel

---

### COMMIT 6 — Reentrada Estruturada

**O que fazer:**
- Quando lead com `destino = 'encerrado'` manda mensagem:
  - Marcar `is_reaquecido = true`
  - Manter classificação anterior visível
  - Entrar na sidebar como "reaquecido"
- Quando lead com `destino = 'backoffice'` manda mensagem:
  - Não mudar nada — já está no pipeline

**Validação:**
- [ ] Lead encerrado manda "oi" → aparece na sidebar como reaquecido
- [ ] Operador vê classificação anterior
- [ ] Lead do backoffice manda mensagem → não sai do pipeline

---

## 📋 CHECKLIST DE VALIDAÇÃO E2E (FLUXO COMPLETO)

```
1. Lead entra pelo Telegram                    → aparece na sidebar ✓
2. Operador clica no card                      → assume o lead ✓
3. Painel mostra intenção consolidada          → "Falar com advogado" ✓
4. Operador classifica juridicamente           → Trabalhista → Rescisão → Sem justa causa
5. Operador escreve dossiê                     → "Cliente demitido há 2 meses, quer calcular verbas"
6. Operador classifica tratamento              → Solicitação → Reunião
7. Sistema mostra resultado                    → Backoffice | aguardando_agendamento
8. Operador confirma                           → Lead some da sidebar
9. Lead aparece na tela2 (backoffice)          → com classificação jurídica visível
10. Operador do backoffice agenda reunião      → status muda pra reuniao_agendada
11. Pipeline avança                            → proposta → contrato → fechado
```

```
FLUXO ALTERNATIVO (encerrado):
4. Operador classifica tratamento              → Informação → Endereço
5. Sistema mostra resultado                    → Encerrado | resolvido
6. Operador confirma                           → Lead some da sidebar
7. Lead aparece na tela de abandonos           → com motivo "informação"
8. Se cliente volta                            → reaquecido na sidebar
```

---

## ⏱️ ESTIMATIVA DE TEMPO

| Commit | Complexidade | Prioridade | Tempo |
|--------|-------------|-----------|-------|
| 1. Classificação jurídica no painel | Média | 🔴 CRÍTICO | 1-2h |
| 2. Abandonos (tab no backoffice) | Média | 🔴 CRÍTICO | 2-3h |
| 3. Backoffice com classificação | Baixa | 🟠 ALTO | 1h |
| 4. Card sidebar completo | Baixa | 🟠 ALTO | 30min |
| 5. Painel por identity | Alta | 🔴 CRÍTICO | 3-4h |
| 6. Reentrada estruturada | Média | 🟡 MÉDIO | 1-2h |
| **TOTAL** | | | **~10-12h** |

---

## 🧠 FRASE FINAL

> "Um sistema só está pronto quando ele sabe começar, decidir e terminar."

O motor existe. A árvore existe. O tratamento existe. O que falta é fechar o ciclo: entrada → decisão → saída → reentrada. Sem buracos.
