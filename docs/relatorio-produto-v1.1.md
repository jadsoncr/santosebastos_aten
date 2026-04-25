# RELATORIO COMPLETO DO PRODUTO — BRO RESOLVE v1.0

**Data**: 25 de Abril de 2026
**Repositorio**: github.com/jadsoncr/santosebastos_aten
**Deploy**: Vercel (web) + Railway (bot)

---

## 1. VISAO GERAL DO PRODUTO

O BRO Resolve e um sistema de atendimento e gestao de leads juridicos para o escritorio Santos e Bastos Advogados. Gerencia o ciclo desde o primeiro contato via Telegram/WhatsApp ate a conversao em cliente, com cockpit operacional para operadores e painel financeiro para owners.

**Usuarios-alvo**: Operadores de atendimento e donos do escritorio juridico.

**Proposta de valor**: Automacao de triagem via bot de menus (sem IA generativa), com transicao controlada para atendimento humano, captura agressiva de dados e gestao visual de pipeline.

---

## 2. STACK TECNOLOGICA

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Backend (Bot) | Node.js + Express | CommonJS |
| Realtime | Socket.io | 4.8.3 |
| Frontend | Next.js 14 App Router | 14.2.x |
| Linguagem Web | TypeScript | 5.3.x |
| CSS | Tailwind CSS | 3.4.x |
| Banco de Dados | Supabase (PostgreSQL) | - |
| Auth | Supabase Auth | - |
| Mensageria | Telegram Bot API + n8n (WhatsApp) | - |
| Deploy Web | Vercel | - |
| Deploy Bot | Railway | - |
| Testes | Jest 30 | - |
| Fontes | Syne (display), Inter (body), JetBrains Mono (mono) | - |

**Dependencias Backend** (package.json):
- @supabase/supabase-js 2.104.1
- dotenv 17.4.2
- express 5.2.1
- googleapis 171.4.0
- socket.io 4.8.3
- uuid 13.0.0

**Dependencias Frontend** (web/package.json):
- @supabase/ssr 0.5.2
- @supabase/supabase-js 2.47.10
- next 14.2.21
- react 18.3.1
- socket.io-client 4.8.3

---

## 3. ARQUITETURA DO SISTEMA

### 3.1 Bot Server (server.js — Railway)

Servidor Express que:
- Recebe webhooks do Telegram (`POST /webhook`)
- Normaliza entrada (Telegram ou n8n/WhatsApp)
- Resolve identidade unificada via `identityResolver.js`
- Captura agressiva de nome/telefone do perfil Telegram
- Faz upsert imediato do lead na tabela `leads` (status TRIAGEM)
- Verifica flag `is_assumido` — se true, silencia o bot e apenas salva mensagem
- Processa pela stateMachine se bot no controle
- Persiste mensagens na tabela `mensagens` com `canal_origem` e `persona_nome`
- Envia resposta via Telegram com typing delay de 1.5s (persona bot)
- Broadcast via Socket.io para o frontend

**Funcoes principais**:
- `sendTelegram(chat_id, text)` — envio direto
- `sendTelegramWithTyping(chat_id, text, area)` — typing 1.5s + envio + retorna persona
- `sweepOperacao()` — roda a cada 5min: auto-snooze (30min), abandono triagem (2h), abandono atendimento (24h)

### 3.2 Frontend (Next.js — Vercel)

App Router com 3 telas principais:
- `/tela1` — Cockpit de Atendimento (3 colunas: sidebar, chat, painel)
- `/tela2` — Tela Clientes (3 colunas: filtros, lista, detalhe)
- `/financeiro` — Painel Financeiro (owner-only)

**Auth**: Supabase Auth com middleware que redireciona nao-autenticados para `/login`. Roles: `operador` e `owner`.

### 3.3 Socket.io

Conecta frontend ao bot server para tempo real.

**Eventos Client -> Server**:
| Evento | Payload | Descricao |
|--------|---------|-----------|
| `assumir_lead` | `{ lead_id, operador_id }` | Operador assume lead (atomico via UNIQUE) |
| `delegar_lead` | `{ lead_id, operador_id_origem, operador_id_destino }` | Delegar para outro operador |
| `nova_mensagem` | `{ lead_id, de, conteudo, tipo, operador_id, origem }` | Mensagem do operador |
| `operador_status` | `{ operador_id, status }` | Status do operador |
| `lead_encerrado` | `{ lead_id, tipo }` | Lead encerrado |
| `operador_digitando` | `{ lead_id, operador_nome }` | Operador esta digitando |

**Eventos Server -> Client**:
| Evento | Payload | Descricao |
|--------|---------|-----------|
| `lead_novo` | `{ identity_id, channel_user_id }` | Novo lead criado |
| `nova_mensagem_salva` | `{ lead_id, de, tipo, conteudo, created_at }` | Mensagem persistida |
| `lead_assumido` | `{ lead_id, operador_id }` | Lead foi assumido |
| `lead_delegado` | `{ lead_id, operador_id_destino }` | Lead delegado |
| `erro_assumir` | `{ mensagem }` | Erro ao assumir (ja assumido) |
| `lead_reaquecido` | `{ lead_id, status_anterior }` | Lead reaquecido |
| `lead_status_changed` | `{ lead_id, status }` | Status operacao mudou |
| `operador_status_atualizado` | `{ operador_id, status }` | Status operador atualizado |
| `lead_encerrado` | `{ lead_id, tipo }` | Lead encerrado broadcast |

### 3.4 Identity Resolution (src/identityResolver.js)

Resolve identidade unificada por canal + channel_user_id:
1. Busca em `identity_channels` por (channel, channel_user_id)
2. Se encontra, retorna `identity_id`
3. Se nao encontra, cria nova `identity` e `identity_channel`
4. Se telefone fornecido, tenta merge cross-canal

---

## 4. BANCO DE DADOS — SCHEMA COMPLETO

### Tabelas Base (schema.sql)

**identities**
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | PK | gen_random_uuid() |
| telefone | TEXT | UNIQUE, sim | - |
| nome | TEXT | sim | - |
| created_at | TIMESTAMPTZ | nao | now() |

**identity_channels**
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | PK | gen_random_uuid() |
| identity_id | UUID | FK identities | - |
| channel | TEXT | nao | - |
| channel_user_id | TEXT | nao | - |
| created_at | TIMESTAMPTZ | nao | now() |
| UNIQUE(channel, channel_user_id) |

**leads**
| Coluna | Tipo | Origem | Default |
|--------|------|--------|---------|
| id | UUID | PK | gen_random_uuid() |
| identity_id | UUID | FK identities | - |
| request_id | TEXT | UNIQUE | - |
| nome | TEXT | sim | - |
| telefone | TEXT | sim | - |
| area | TEXT | sim | - |
| urgencia | TEXT | sim | - |
| score | INTEGER | nao | 0 |
| prioridade | TEXT | nao | FRIO |
| flag_atencao | BOOLEAN | nao | false |
| canal_origem | TEXT | sim | - |
| canal_preferido | TEXT | sim | - |
| resumo | TEXT | sim | - |
| metadata | JSONB | sim | - |
| status | TEXT | nao | NOVO |
| created_at | TIMESTAMPTZ | nao | now() |
| area_bot | TEXT | mig 001 | - |
| area_humano | TEXT | mig 001 | - |
| corrigido | BOOLEAN | mig 001 | false |
| is_reaquecido | BOOLEAN | mig 004 | false |
| reaquecido_em | TIMESTAMPTZ | mig 004 | - |
| ultima_msg_de | TEXT | mig 006 | - |
| ultima_msg_em | TIMESTAMPTZ | mig 006 | - |
| status_operacao | TEXT | mig 006 | novo |
| status_alegado | TEXT | mig 008 | - |
| channel_user_id | TEXT | mig 009 | - |
| is_assumido | BOOLEAN | mig 010 | false |
| status_triagem | TEXT | mig 010 | bot_ativo |

**clients**
| Coluna | Tipo | Default |
|--------|------|---------|
| id | UUID | PK |
| identity_id | UUID | FK identities |
| request_id | TEXT | UNIQUE |
| nome, telefone, urgencia, conteudo, canal_origem | TEXT | - |
| flag_atencao | BOOLEAN | false |
| metadata | JSONB | - |
| status | TEXT | NOVO |
| created_at | TIMESTAMPTZ | now() |
| last_interaction | TIMESTAMPTZ | mig 008, now() |

**others**
| Coluna | Tipo | Default |
|--------|------|---------|
| id | UUID | PK |
| identity_id | UUID | FK identities |
| request_id | TEXT | UNIQUE |
| nome, telefone, tipo, conteudo, canal_origem | TEXT | - |
| metadata | JSONB | - |
| status | TEXT | NOVO |
| created_at | TIMESTAMPTZ | now() |

**abandonos**
| Coluna | Tipo | Default |
|--------|------|---------|
| id | UUID | PK |
| identity_id | UUID | FK identities |
| request_id | TEXT | - |
| fluxo, ultimo_estado | TEXT | - |
| score | INTEGER | 0 |
| prioridade | TEXT | FRIO |
| nome, canal_origem, classificacao | TEXT | - |
| mensagens_enviadas | INTEGER | 0 |
| created_at | TIMESTAMPTZ | now() |
| UNIQUE(identity_id, ultimo_estado) |

### Tabelas de Migracao

**atendimentos** (mig 001)
| Coluna | Tipo | Origem |
|--------|------|--------|
| id | UUID | PK |
| lead_id | UUID | FK leads, UNIQUE |
| owner_id | UUID | FK auth.users |
| delegado_de | UUID | FK auth.users |
| status | TEXT | aberto |
| classificacao_entrada, classificacao_final | TEXT | - |
| valor_estimado | NUMERIC | - |
| assumido_em | TIMESTAMPTZ | now() |
| encerrado_em | TIMESTAMPTZ | - |
| motivo_perda | TEXT | mig 003 |
| tipo_espera | TEXT | mig 005 |
| prazo_sla | TIMESTAMPTZ | mig 005 |
| motivo_fechamento | TEXT | mig 006 |
| valor_contrato | NUMERIC | mig 007 |
| status_pagamento | TEXT | mig 007 |

**mensagens** (mig 002)
| Coluna | Tipo | Origem |
|--------|------|--------|
| id | UUID | PK |
| lead_id | UUID | FK leads |
| de | TEXT | nao null |
| tipo | TEXT | mensagem |
| conteudo | TEXT | nao null |
| operador_id | UUID | FK auth.users |
| created_at | TIMESTAMPTZ | now() |
| identity_id | TEXT | mig 009 |
| canal_origem | TEXT | mig 011 |
| persona_nome | TEXT | mig 011 |

**pot_tratamento** (mig 001)
| Coluna | Tipo |
|--------|------|
| id | UUID PK |
| lead_id | UUID FK leads |
| operador_id | UUID FK auth.users |
| proxima_acao, observacao | TEXT |
| data_acao | TIMESTAMPTZ |
| valor_estimado, valor_confirmado | NUMERIC |
| data_recebimento | TIMESTAMPTZ |
| status_financeiro, status | TEXT |
| created_at | TIMESTAMPTZ |

**quick_replies** (mig 001)
| Coluna | Tipo |
|--------|------|
| id | UUID PK |
| atalho | TEXT UNIQUE |
| conteudo | TEXT |
| criado_por | UUID FK auth.users |
| compartilhado | BOOLEAN |
| created_at | TIMESTAMPTZ |

**bot_feedback** (mig 001)
| Coluna | Tipo |
|--------|------|
| id | UUID PK |
| lead_id | UUID FK leads |
| area_bot, area_humano | TEXT |
| operador_id | UUID FK auth.users |
| created_at | TIMESTAMPTZ |

**solicitacoes_clientes** (mig 001)
| Coluna | Tipo |
|--------|------|
| id | UUID PK |
| identity_id | UUID FK identities |
| mensagem, categoria, categoria_humano, status | TEXT |
| created_at | TIMESTAMPTZ |

**repescagem** (mig 003)
| Coluna | Tipo |
|--------|------|
| id | UUID PK |
| lead_id | UUID FK leads |
| operador_id | UUID FK auth.users |
| motivo, observacao, status | TEXT |
| data_retorno | DATE |
| created_at | TIMESTAMPTZ |

**pendencias** (mig 005)
| Coluna | Tipo |
|--------|------|
| id | UUID PK |
| lead_id | UUID FK leads |
| operador_id | UUID FK auth.users |
| tipo | TEXT |
| prazo_sla | TIMESTAMPTZ |
| taxa_reajuste | NUMERIC |
| status | TEXT |
| created_at | TIMESTAMPTZ |

**areas_juridicas** (mig 007)
| Coluna | Tipo |
|--------|------|
| id | UUID PK |
| nome | TEXT UNIQUE |
| ativo | BOOLEAN |
| created_at | TIMESTAMPTZ |

---

## 5. STATE MACHINE — FLUXO COMPLETO

### Estados e Transicoes

```
start → (1) trabalho_status → trabalho_tipo → trabalho_tempo → trabalho_salario → trabalho_contrato → trabalho_intencao → coleta_nome
start → (2) familia_tipo → familia_status → familia_urgencia → coleta_nome
start → (3) cliente_identificacao → final_cliente
start → (4) advogado_tipo → advogado_descricao → coleta_nome
start → (5) outros_descricao → outros_impacto → coleta_nome

coleta_nome → contato_confirmacao → (1) final_lead | (2) contato_numero → contato_canal → final_lead | (3) final_lead

final_lead → pos_final → (1) start | (2) advogado_tipo | (3) encerramento
final_cliente → pos_final → ...
```

### Score

Calculado incrementalmente durante o fluxo:
- `trabalho_tipo == 4` (multiplas): +2
- `trabalho_salario == 3` (>5k): +2, `== 2` (2-5k): +1
- `trabalho_intencao == 2` (justica): +2
- `familia_urgencia == 1` (sim): +5
- `advogado` base: score 5

**Prioridade**: QUENTE >= 5, MEDIO >= 3, FRIO < 3

### Captura de Dados

- **Nome**: Coletado em `coleta_nome` → propagado para `identities.nome` e `leads.nome` (apenas se null)
- **Telefone**: Coletado em `contato_numero` → propagado para `identities.telefone` (apenas se null)
- **Telegram Profile**: `first_name + last_name` extraidos no webhook → propagados para `identities.nome` e `leads.nome` (apenas se null)

---

## 6. FUNCIONALIDADES IMPLEMENTADAS

### a) Bot de Atendimento
- **Arquivos**: `server.js`, `src/stateMachine.js`, `src/normalizer.js`, `src/responder.js`
- **Status**: FUNCIONAL
- Suporta Telegram (direto) e WhatsApp (via n8n webhook)
- Menu de opcoes numericas, sem IA generativa
- Tratamento de audio (pede opcao numerica)

### b) Upsert Imediato de Leads
- **Arquivo**: `server.js` (bloco UPSERT IMEDIATO)
- **Status**: FUNCIONAL
- Cria lead com status TRIAGEM no primeiro contato
- Emite `lead_novo` via Socket.io

### c) Captura Agressiva de Dados
- **Arquivo**: `server.js` (bloco CAPTURA AGRESSIVA), `src/stateMachine.js` (propagarNome, propagarTelefone)
- **Status**: FUNCIONAL
- Extrai first_name/last_name do Telegram
- Propaga nome/telefone da stateMachine para identities
- Nunca sobrescreve dados ja preenchidos

### d) Silenciador (is_assumido)
- **Arquivo**: `server.js` (bloco SILENCIADOR)
- **Status**: FUNCIONAL
- Se `is_assumido == true`, bot nao processa pela stateMachine
- Apenas salva mensagem e responde "atendente esta respondendo"

### e) Persona Bot com Typing Delay
- **Arquivo**: `server.js` (sendTelegramWithTyping, BOT_PERSONAS)
- **Status**: FUNCIONAL
- Mapeamento: Trabalhista=Dr. Rafael, Familia=Dra. Mariana, Previdenciario=Dr. Carlos, Consumidor=Dra. Beatriz, Civel=Dr. Andre, Criminal=Dra. Patricia
- Typing 1.5s antes de cada mensagem automatica
- Persona persistida em `mensagens.persona_nome`

### f) Identity Resolution
- **Arquivo**: `src/identityResolver.js`
- **Status**: FUNCIONAL
- Resolve por (channel, channel_user_id)
- Merge cross-canal por telefone
- Lazy migration de sessoes antigas

### g) Tela 1 — Cockpit de Atendimento
- **Arquivos**: `web/app/(dashboard)/tela1/`
- **Status**: FUNCIONAL
- 3 colunas: ConversasSidebar (280px), ChatCentral (flex-1), PainelLead (280px)
- Componentes: ConversasSidebar, ChatCentral, PainelLead (CardBotTree + BlocoQualificacao), SmartSnippets, QuickReplies, PopupEnfileirar, PopupAguardando, ScoreCircle

### h) Tela 2 — Tela Clientes
- **Arquivos**: `web/app/(dashboard)/tela2/`
- **Status**: PARCIAL (componentes existem mas podem nao estar 100% conectados)
- 3 colunas: FilterSidebar (200px), LeadList (flex-1), DetailPanel (260px)
- Componentes: FilterSidebar, LeadList, MetricsPanel, DetailPanel

### i) Tela Financeiro
- **Arquivo**: `web/app/(dashboard)/financeiro/page.tsx`
- **Status**: FUNCIONAL
- Owner-only (middleware bloqueia operadores)
- Cards: receita estimada, confirmada, a receber, fechamentos, ticket medio, gap bot
- Tabela de fechamentos por operador

### j) Login/Auth
- **Arquivos**: `web/app/(auth)/login/page.tsx`, `web/middleware.ts`, `web/utils/supabase/`
- **Status**: FUNCIONAL
- Supabase Auth com email/senha
- Middleware protege todas as rotas
- Roles: operador, owner

### k) Smart Snippets
- **Arquivo**: `web/app/(dashboard)/tela1/components/SmartSnippets.tsx`
- **Status**: FUNCIONAL
- Botoes contextuais por status (LEAD vs CLIENTE)
- Injeta texto no input, marca is_assumido = true

### l) Badges de Canal
- **Arquivo**: `web/app/(dashboard)/tela1/components/ChatCentral.tsx`
- **Status**: FUNCIONAL
- "via Telegram" (azul) ou "via WhatsApp" (verde) em mensagens recebidas

### m) Badge Bot/Humano
- **Arquivo**: `web/app/(dashboard)/tela1/components/ChatCentral.tsx`
- **Status**: FUNCIONAL
- Header do chat: "Automacao Ativa" ou "Atendimento Humano"

### n) Notas Internas (Post-it)
- **Arquivo**: `web/app/(dashboard)/tela1/components/BlocoQualificacao.tsx`
- **Status**: FUNCIONAL
- Campo amarelo palido, persiste como tipo=nota_interna
- Lista de notas existentes ordenadas por data

### o) Nome/Telefone Editaveis
- **Arquivo**: `web/app/(dashboard)/tela1/components/BlocoQualificacao.tsx`
- **Status**: FUNCIONAL
- Click-to-edit, salva em identities + leads
- Rejeita nome vazio

### p) Vinculacao de Identidades
- **Arquivo**: `web/app/(dashboard)/tela1/components/BlocoQualificacao.tsx`
- **Status**: FUNCIONAL
- Busca por nome/telefone, transfere identity_channels

### q) Quick Replies (/)
- **Arquivo**: `web/app/(dashboard)/tela1/components/QuickReplies.tsx`
- **Status**: FUNCIONAL
- Digitar "/" abre lista de atalhos do banco

### r) Popup Enfileirar
- **Arquivo**: `web/app/(dashboard)/tela1/components/PopupEnfileirar.tsx`
- **Status**: FUNCIONAL
- Cria registro em pot_tratamento

### s) Popup Aguardando
- **Arquivo**: `web/app/(dashboard)/tela1/components/PopupAguardando.tsx`
- **Status**: FUNCIONAL

### t) Botao Chamar no WA
- **Arquivo**: `web/app/(dashboard)/tela1/components/BlocoQualificacao.tsx`
- **Status**: FUNCIONAL
- Link wa.me com mensagem pre-preenchida por status

### u) Reentrada/Reaquecimento
- **Arquivo**: `server.js` (bloco Reentrada)
- **Status**: FUNCIONAL
- Detecta leads em pausa/fechado que voltam
- Emite lead_reaquecido

### v) Sweep Automatico
- **Arquivo**: `server.js` (sweepOperacao)
- **Status**: FUNCIONAL
- Auto-snooze: 30min sem resposta do cliente
- Abandono triagem: 2h sem atendimento humano
- Abandono atendimento: 24h sem resposta

### w) Admin Sessions
- **Arquivo**: `server.js` (GET /admin/sessions)
- **Status**: FUNCIONAL
- Protegido por ADMIN_TOKEN
- Lista sessoes ativas com resumo

### x) Operacao Ativa
- **Arquivo**: `server.js`, migracao 006
- **Status**: FUNCIONAL
- status_operacao: novo, ativo, em_pausa, fechado

---

## 7. COMPONENTES DO FRONTEND

| Componente | Arquivo | Props |
|-----------|---------|-------|
| Tela1Page | tela1/page.tsx | - |
| ConversasSidebar | tela1/components/ConversasSidebar.tsx | selectedLeadId, onSelectLead |
| ChatCentral | tela1/components/ChatCentral.tsx | lead: Lead |
| PainelLead | tela1/components/PainelLead.tsx | lead, onLeadUpdate, onLeadClosed |
| CardBotTree | tela1/components/CardBotTree.tsx | lead, isCliente |
| BlocoQualificacao | tela1/components/BlocoQualificacao.tsx | lead, isCliente, isAssumido, operadorId, onLeadUpdate, onLeadClosed |
| SmartSnippets | tela1/components/SmartSnippets.tsx | lead, onInject, onAssumir |
| QuickReplies | tela1/components/QuickReplies.tsx | query, operadorId, onSelect, onClose |
| PopupEnfileirar | tela1/components/PopupEnfileirar.tsx | leadId, operadorId, onClose, onSuccess |
| PopupAguardando | tela1/components/PopupAguardando.tsx | leadId, operadorId, onClose, onSuccess |
| ScoreCircle | tela1/components/ScoreCircle.tsx | score |
| Tela2Page | tela2/page.tsx | - |
| FilterSidebar | tela2/components/FilterSidebar.tsx | - |
| LeadList | tela2/components/LeadList.tsx | - |
| MetricsPanel | tela2/components/MetricsPanel.tsx | - |
| DetailPanel | tela2/components/DetailPanel.tsx | - |
| FinanceiroPage | financeiro/page.tsx | - |
| LoginPage | (auth)/login/page.tsx | - |
| Header | components/Header.tsx | email, role |
| Sidebar | components/Sidebar.tsx | role |
| SocketProvider | components/providers/SocketProvider.tsx | children |

---

## 8. API ENDPOINTS

| Metodo | Path | Descricao | Auth |
|--------|------|-----------|------|
| POST | /webhook | Recebe mensagens Telegram/WhatsApp | Nenhuma (webhook publico) |
| GET | /health | Health check | Nenhuma |
| GET | /admin/sessions | Lista sessoes ativas | ADMIN_TOKEN header |
| POST | /api/whatsapp/enviar | Envia mensagem via WhatsApp | Supabase Auth |

---

## 9. MIGRACOES SQL (001-011)

| # | Arquivo | O que faz |
|---|---------|-----------|
| 001 | bro_resolve_base.sql | area_bot/area_humano/corrigido em leads; tabelas atendimentos, pot_tratamento, solicitacoes_clientes, quick_replies, bot_feedback; RLS em todas as tabelas |
| 002 | bro_resolve_cockpit.sql | Tabela mensagens; seeds quick_replies |
| 003 | circuito_fechado.sql | Tabela repescagem; motivo_perda em atendimentos; policies INSERT/UPDATE |
| 004 | reentrada.sql | is_reaquecido e reaquecido_em em leads |
| 005 | sla_pendencias.sql | Tabela pendencias; tipo_espera e prazo_sla em atendimentos |
| 006 | operacao_ativa.sql | ultima_msg_de, ultima_msg_em, status_operacao em leads; motivo_fechamento em atendimentos |
| 007 | areas_conversao.sql | Tabela areas_juridicas; valor_contrato e status_pagamento em atendimentos |
| 008 | filtro_realidade.sql | last_interaction em clients; status_alegado em leads |
| 009 | conexao_total.sql | channel_user_id em leads; identity_id em mensagens |
| 010 | triagem_imediata.sql | is_assumido e status_triagem em leads |
| 011 | cockpit_operativo.sql | canal_origem e persona_nome em mensagens; indices em identities |

---

## 10. DESIGN TOKENS / TEMA

### Cores
| Token | Hex | Uso |
|-------|-----|-----|
| bg-primary | #FFFFFF | Fundo principal |
| bg-surface | #F7F7F5 | Superficies, cards |
| bg-surface-hover | #F0EFE9 | Hover em superficies |
| border | #E8E7E1 | Bordas |
| accent | #1A73E8 | Cor principal, links |
| accent-hover | #1557B0 | Hover accent |
| text-primary | #1A1A1A | Texto principal |
| text-secondary | #6B6B6B | Texto secundario |
| text-muted | #ADADAD | Texto desabilitado |
| text-on-accent | #FFFFFF | Texto sobre accent |
| error | #EF4444 | Erros |
| success | #1DB954 | Sucesso, WhatsApp |
| warning | #F59E0B | Alertas |
| score-hot | #F97316 | Score quente |
| score-warm | #F59E0B | Score morno |
| score-cold | #6B7280 | Score frio |
| chat-received | #F7F7F5 | Balao recebido |
| chat-sent | #EBF3FE | Balao enviado |
| note-internal | #FFFBEB | Notas internas |

### Tipografia
- Display: Syne 700
- Body: Inter 400/500/600
- Mono: JetBrains Mono 400/500

### Espacamento
- Sidebar: 240px
- Header: 56px
- Border radius: sm=4px, md=8px, lg=12px

---

## 11. TESTES

| Arquivo | Cobertura |
|---------|-----------|
| tests/normalizer.test.js | Normalizacao de entrada |
| tests/scorer.test.js | Calculo de score e prioridade |
| tests/stateMachine.test.js | Fluxo completo da state machine |

Framework: Jest 30 (CommonJS)

---


## 12. GAP ANALYSIS — O QUE FALTA PARA v1.1

Comparacao entre o estado atual e o "Prompt Mestre v1.1":

### 12.1 State Machine de 8 Estados Operacionais

**Atual**: O sistema tem `status` (NOVO, TRIAGEM) e `status_operacao` (novo, ativo, em_pausa, fechado) mas NAO tem a cadeia linear de 8 estados proposta.

**Falta implementar**:
| Estado | Status | Descricao |
|--------|--------|-----------|
| ENTRADA | Existe (TRIAGEM) | Bot no controle |
| QUALIFICADO | NAO EXISTE | Score > 7, identidade populada |
| EM ATENDIMENTO | Parcial (is_assumido) | Operador assume |
| AGENDAMENTO | NAO EXISTE | Gestao de reunioes |
| DEVOLUTIVA DE CONTRATO | NAO EXISTE | Envio de documento |
| PAGAMENTO PENDENTE | NAO EXISTE | Bloqueio ate validacao financeira |
| CARTEIRA ATIVA | NAO EXISTE | Momento WOW com webhook |
| FINALIZADO | Parcial (encerrado_em) | Encerramento com valor_honorarios_finais |

**Trabalho necessario**: Criar coluna `status_pipeline` em leads/atendimentos com os 8 estados. Implementar transicoes obrigatorias no frontend e backend. Criar UI de sidebar organizada por status.

### 12.2 Arvore Dinamica de 3 Niveis

**Atual**: Tabela `areas_juridicas` com 1 nivel (nome). Dropdown simples no PainelLead.

**Falta implementar**:
- Tabela `segment_trees` com 3 niveis: Segmento → Assunto → Especificacao
- Dropdowns interdependentes no PainelLead
- Backoffice para CRUD da arvore
- Vinculacao automatica de Persona ao Nivel 1

**Trabalho necessario**: Nova tabela `segment_trees (id, parent_id, nivel, nome, persona)`. Refatorar dropdown de area no BlocoQualificacao para 3 niveis cascata. Criar tela de backoffice.

### 12.3 Momento WOW (Conversao com Webhook)

**Atual**: Conversao existe (botao CONVERTER no PainelLead) mas sem:
- Input de `valor_entrada` e `metodo_pagamento`
- Disparo de webhook para grupo
- Mensagem de boas-vindas profissional
- Efeito visual de conversao no cockpit

**Trabalho necessario**: Adicionar campos no popup de conversao. Criar webhook de notificacao. Implementar animacao/efeito visual. Enviar mensagem automatica ao cliente.

### 12.4 Backoffice (Potes de Saida e Custodia)

**Atual**: Tabela `repescagem` existe. Tabela `pot_tratamento` existe. Nao ha UI de backoffice dedicada.

**Falta implementar**:
- **Pote de Recuperacao**: UI para leads qualificados sem resposta com gatilho de follow-up automatico
- **Pote de Parceria**: UI para encaminhamento externo de casos fora da area
- **Modulo de Custodia**: Lista de Carteira Ativa para acompanhamento processual. Envio de mensagens de "Status do Processo" via bot.

**Trabalho necessario**: Nova tela `/backoffice` com 3 abas (Recuperacao, Parceria, Custodia). Logica de follow-up automatico. Integracao com bot para envio de status.

### 12.5 ROI por Segmento e Periodo

**Atual**: Painel financeiro mostra receita estimada/confirmada e fechamentos por operador. NAO filtra por segmento nem periodo customizado.

**Falta implementar**:
- Filtro por segmento (area juridica)
- Filtro por periodo (data inicio/fim)
- Calculo de ROI (receita vs custo de aquisicao)

### 12.6 UI Profissional sem Emojis

**Atual**: Usa emojis na sidebar (📥 Entrada, 👥 Clientes, 💰 Financeiro), nos badges e nos Smart Snippets.

**Falta implementar**: Substituir emojis por icones SVG profissionais. Estilo "SaaS B2B" sobrio.

### 12.7 Dossie Estrategico

**Atual**: Campo "Notas Internas" com estilo Post-it amarelo.

**Falta implementar**: Substituir por campo de texto de alta densidade para anotacoes de guerra do advogado. Mesmo conceito, visual mais profissional.

---

## 13. RESUMO EXECUTIVO

### O que esta pronto (v1.0)
- Bot de triagem funcional (Telegram + WhatsApp)
- Captura agressiva de dados do perfil Telegram
- Identity resolution com merge cross-canal
- Cockpit de atendimento com 3 colunas
- PainelLead editavel (nome, telefone, area, notas)
- Vinculacao de identidades
- Smart Snippets contextuais
- Persona bot com typing delay
- Typing do operador via Socket.io
- Badges de canal (Telegram/WhatsApp)
- Badge bot/humano
- Silenciador de automacao (is_assumido)
- Reentrada/reaquecimento
- Sweep automatico (snooze, abandono)
- Painel financeiro (owner-only)
- Auth com roles (operador/owner)
- 11 migracoes SQL

### O que falta para v1.1
- State machine de 8 estados operacionais
- Arvore de classificacao de 3 niveis
- Momento WOW de conversao
- Backoffice (Recuperacao, Parceria, Custodia)
- ROI por segmento e periodo
- UI profissional sem emojis
- Campos valor_entrada, valor_final, tabela segment_trees

### Metricas do Codigo
- **Arquivos backend**: 8 (server.js + src/)
- **Arquivos frontend**: ~25 componentes
- **Migracoes SQL**: 11
- **Testes**: 3 arquivos (normalizer, scorer, stateMachine)
- **Tabelas no banco**: 13 (identities, identity_channels, leads, clients, others, abandonos, atendimentos, mensagens, pot_tratamento, quick_replies, bot_feedback, solicitacoes_clientes, repescagem, pendencias, areas_juridicas)
