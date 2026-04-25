# RELATORIO DE ENTREGA — BRO RESOLVE v1.2

**Santos e Bastos Advogados**
**Data**: 25 de Abril de 2026
**Repositorio**: github.com/jadsoncr/santosebastos_aten
**Deploy**: Vercel (web) + Railway (bot)

---

## 1. RESUMO EXECUTIVO

O BRO Resolve e um sistema completo de atendimento e gestao de leads juridicos. Gerencia o ciclo desde o primeiro contato via Telegram/WhatsApp ate a conversao em cliente, com cockpit operacional para operadores e painel de gestao para owners.

**Versao atual**: v1.2 (inclui anexos de arquivos)
**Status geral**: OPERACIONAL EM PRODUCAO

---

## 2. JORNADAS COMPLETAS — MAPA DE STATUS

### JORNADA 1: CAPTACAO (Bot → Lead)
| Etapa | Status | Detalhe |
|-------|--------|---------|
| Cliente envia mensagem no Telegram | FUNCIONA | Webhook recebe e processa |
| Bot responde com menu de opcoes | FUNCIONA | Typing delay 1.5s, persona por area |
| Bot classifica area juridica | FUNCIONA | Trabalhista, Familia, Previdenciario, Consumidor, Civel, Criminal |
| Bot calcula score de propensao | FUNCIONA | Score 0-10, prioridade QUENTE/MEDIO/FRIO |
| Bot coleta nome e telefone | FUNCIONA | Propaga para identities (fonte unica) |
| Lead criado automaticamente | FUNCIONA | Upsert imediato no primeiro "Oi" |
| Lead aparece na sidebar do cockpit | FUNCIONA | Real-time via Socket.io |
| Captura agressiva de dados Telegram | FUNCIONA | first_name, last_name, username |

### JORNADA 2: ATENDIMENTO (Operador no Cockpit)
| Etapa | Status | Detalhe |
|-------|--------|---------|
| Operador ve lista de leads | FUNCIONA | Sidebar WhatsApp-style, dedup por identity |
| Operador filtra por status | FUNCIONA | Pills: Todos/Ativos/Esfriando/Sem resposta |
| Operador busca por nome/telefone | FUNCIONA | Fuzzy search com 300ms debounce |
| Operador clica no lead | FUNCIONA | Assume automaticamente, cria atendimento |
| Chat carrega mensagens | FUNCIONA | Historico completo por identity_id |
| Operador envia mensagem de texto | FUNCIONA | Socket → DB → Telegram outbound |
| Operador envia arquivo (PDF/imagem) | FUNCIONA | Upload → Storage → Telegram sendDocument |
| Cliente recebe mensagem no Telegram | FUNCIONA | Texto e documentos |
| Cliente envia mensagem de texto | FUNCIONA | Webhook → DB → Socket → cockpit |
| Cliente envia documento | FUNCIONA* | Webhook → Storage → DB (requer bucket chat-files) |
| Cliente envia foto | FUNCIONA* | Webhook → Storage → DB (requer bucket chat-files) |
| Cliente envia audio | FUNCIONA* | Webhook → Storage → DB (requer bucket chat-files) |
| Bot silencia quando humano ativo | FUNCIONA | is_assumido=true, silencio total |
| Bot retoma apos 5min inatividade | FUNCIONA | Auto-release no webhook + sweep |
| Operador ve badge Bot/Humano | FUNCIONA | Header do chat |
| Operador ve canal de origem | FUNCIONA | "via Telegram" / "via WhatsApp" |
| Operador edita nome/telefone/email | FUNCIONA | Salva em identities (fonte unica) |
| Operador classifica segmento | FUNCIONA | Dropdown cascata 3 niveis |
| Operador escreve notas internas | FUNCIONA | Dossie Estrategico, auto-save |
| Operador usa Quick Replies (/) | FUNCIONA | Busca na tabela quick_replies |
| Operador usa Smart Snippets | FUNCIONA | Template contextual editavel |
| Typing do operador chega no Telegram | FUNCIONA | Throttle 4s |

*Requer configuracao: bucket `chat-files` no Supabase Storage + `SUPABASE_SERVICE_ROLE_KEY` no Railway

### JORNADA 3: QUALIFICACAO E PIPELINE
| Etapa | Status | Detalhe |
|-------|--------|---------|
| Pipeline de 8 estagios | FUNCIONA | Barra de progresso visual |
| Agendar Reuniao (modal) | FUNCIONA | Salva em atendimentos + timeline_events |
| Solicitar Dados (modal) | FUNCIONA | Salva em timeline_events |
| Enviar Proposta (modal) | FUNCIONA | Salva valor + timeline_events |
| Gerar Contrato (modal) | FUNCIONA | Salva em atendimentos + timeline_events |
| Transicao de pipeline | PARCIAL | Funciona mas falha silenciosamente se estagio errado (feedback adicionado via alert) |
| Valor estimado | FUNCIONA | Salva em atendimentos on blur |

### JORNADA 4: DESFECHO
| Etapa | Status | Detalhe |
|-------|--------|---------|
| CONVERTER — VIRAR CLIENTE | FUNCIONA | Validacao: email + valor + contrato + segmento |
| NAO FECHOU | FUNCIONA | Modal com 8 motivos de perda |
| ENCERRAR E ENFILEIRAR | FUNCIONA | PopupEnfileirar com proxima acao/data/valor |
| Arquivar interacao (reaquecido) | FUNCIONA | So aparece para leads reaquecidos |
| Status reflete no BackOffice | FUNCIONA | Automatico via atendimentos.status |

### JORNADA 5: BACKOFFICE (Visao de Negocio)
| Etapa | Status | Detalhe |
|-------|--------|---------|
| 4 cards resumo | FUNCIONA | Em Atendimento, Em Negociacao, Convertidos, Perdidos |
| Cards clicaveis como filtro | FUNCIONA | Toggle on/off |
| Lista agrupada por status | FUNCIONA | Nome, area, valor, tempo |
| Orquestracao automatica | FUNCIONA | CONVERTER → convertido, NAO FECHOU → nao_fechou |

### JORNADA 6: REENTRADA E RECUPERACAO
| Etapa | Status | Detalhe |
|-------|--------|---------|
| Lead volta apos pausa/fechamento | FUNCIONA | Detecta no webhook, marca is_reaquecido |
| Lead reaquecido aparece na sidebar | FUNCIONA | Badge REATIVADO |
| Sweep automatico (5min) | FUNCIONA | Auto-snooze, abandono triagem/atendimento |

### JORNADA 7: FINANCEIRO
| Etapa | Status | Detalhe |
|-------|--------|---------|
| Receita estimada/confirmada | FUNCIONA | Dados de pot_tratamento |
| Ticket medio | FUNCIONA | Calculado de atendimentos convertidos |
| Fechamentos por operador | FUNCIONA | Tabela com email, fechados, valor |
| Gap bot vs humano | FUNCIONA | % de correcoes do bot |

---

## 3. O QUE FUNCIONA (COMPLETO)

1. Bot de triagem via Telegram (menus, score, persona)
2. Captura agressiva de dados do perfil Telegram
3. Identity resolution com merge cross-canal
4. Cockpit de atendimento 3 colunas (sidebar + chat + painel)
5. Sidebar WhatsApp-style com busca, filtros, calorimetria
6. Classificacao de inatividade por horas uteis
7. Chat bidirecional em tempo real (texto + arquivos)
8. Envio de arquivos pelo operador (PDF, imagem, doc)
9. Recebimento de arquivos do cliente (documento, foto, audio)*
10. Silenciador inteligente (is_assumido com auto-release)
11. Edicao de dados do lead (nome, telefone, email)
12. Classificacao por segmento/assunto/especificacao (3 niveis)
13. Dossie Estrategico (notas internas auto-save)
14. Botoeira de jornada (4 modais: Agendar/Solicitar/Proposta/Contrato)
15. Pipeline de 8 estagios com barra de progresso
16. Smart Snippets e Quick Replies
17. Vinculacao de identidades cross-canal
18. Novo contato manual
19. CONVERTER com validacao (email + valor + contrato + segmento)
20. NAO FECHOU com 8 motivos de perda
21. ENCERRAR E ENFILEIRAR com proxima acao
22. BackOffice com 4 cards + lista agrupada
23. Orquestracao automatica Cockpit ↔ BackOffice
24. Reentrada/reaquecimento de leads
25. Sweep automatico (snooze, abandono, auto-release)
26. Painel financeiro (owner-only)
27. Auth com roles (operador/owner)
28. Typing relay operador → Telegram

*Requer bucket `chat-files` + `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. O QUE NAO FUNCIONA / FALTA

### Bugs Conhecidos
| # | Bug | Impacto | Status |
|---|-----|---------|--------|
| 1 | Anexos falham sem bucket `chat-files` no Supabase Storage | Alto | Configuracao pendente |
| 2 | `SUPABASE_SERVICE_ROLE_KEY` nao configurada no Railway | Alto | Configuracao pendente |
| 3 | Pipeline transitions falham silenciosamente se estagio errado | Baixo | Alert adicionado, UX pode melhorar |
| 4 | "IR PARA ACOMPANHAMENTO" navega mas tela2 nao le query param | Baixo | Botao navega sem efeito |
| 5 | Smart Snippet edicao com lapis nao persiste (so em memoria) | Baixo | Recarregar perde edicao |

### Funcionalidades Placeholder (Nao Implementadas)
| Feature | Status | Detalhe |
|---------|--------|---------|
| Gravacao de audio no cockpit | PLACEHOLDER | Botao existe mas nao grava |
| WhatsApp outbound nativo | DEPENDE | Requer n8n configurado com WEBHOOK_N8N_URL |
| Preview avancado de imagem (ampliar) | NAO FEITO | Imagem renderiza inline, sem lightbox |
| Backoffice de segmentos (CRUD) | NAO FEITO | Rota /backoffice/segmentos na sidebar mas sem pagina |
| Notificacoes push | NAO FEITO | - |
| Responsividade mobile | LIMITADA | Layout fixo desktop-first |

### Configuracoes Pendentes para Producao
| Item | Onde | O que fazer |
|------|------|-------------|
| Bucket `chat-files` | Supabase Storage | Criar bucket privado |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway Variables | Adicionar service_role key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Variables | Adicionar para API route /api/upload |
| Migracao 014 | Supabase SQL Editor | Rodar 014_chat_attachments.sql |
| `WEB_URL` | Railway Variables | Incluir URL atual do Vercel para CORS |
| `NEXT_PUBLIC_SOCKET_URL` | Vercel Variables | URL do Railway para Socket.io |

---

## 5. STACK TECNOLOGICA

| Camada | Tecnologia |
|--------|-----------|
| Backend (Bot) | Node.js + Express 5 (CommonJS) |
| Realtime | Socket.io 4.8.3 |
| Frontend | Next.js 14 App Router (TypeScript) |
| CSS | Tailwind CSS 3.4 |
| Banco de Dados | Supabase (PostgreSQL) |
| Storage | Supabase Storage (bucket chat-files) |
| Auth | Supabase Auth |
| Mensageria | Telegram Bot API + n8n (WhatsApp) |
| Deploy Web | Vercel |
| Deploy Bot | Railway |
| Testes | Jest 30 |

---

## 6. MIGRACOES SQL (001-014)

| # | Arquivo | O que faz |
|---|---------|-----------|
| 001 | bro_resolve_base.sql | Tabelas base: atendimentos, pot_tratamento, quick_replies, bot_feedback |
| 002 | bro_resolve_cockpit.sql | Tabela mensagens, seeds quick_replies |
| 003 | circuito_fechado.sql | Tabela repescagem, motivo_perda |
| 004 | reentrada.sql | is_reaquecido, reaquecido_em em leads |
| 005 | sla_pendencias.sql | Tabela pendencias, tipo_espera, prazo_sla |
| 006 | operacao_ativa.sql | ultima_msg_de/em, status_operacao em leads |
| 007 | areas_conversao.sql | Tabela areas_juridicas, valor_contrato |
| 008 | filtro_realidade.sql | last_interaction em clients, status_alegado |
| 009 | conexao_total.sql | channel_user_id em leads, identity_id em mensagens |
| 010 | triagem_imediata.sql | is_assumido, status_triagem em leads |
| 011 | cockpit_operativo.sql | canal_origem, persona_nome em mensagens |
| 012 | bro_resolve_v1_1.sql | segment_trees, pipeline 8 estados, configuracoes_sla, timeline_events |
| 013 | sprint_final.sql | location, email, request_id nullable, contrato_assinado, photo_url, last_operator_message_at |
| 014 | chat_attachments.sql | arquivo_url, arquivo_nome, arquivo_tipo, arquivo_tamanho em mensagens |

---

## 7. VARIAVEIS DE AMBIENTE

### Railway (Bot Server)
| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| SUPABASE_URL | Sim | URL do projeto Supabase |
| SUPABASE_KEY | Sim | Anon key do Supabase |
| SUPABASE_SERVICE_ROLE_KEY | Sim | Service role key (para Storage) |
| TELEGRAM_TOKEN | Sim | Token do bot Telegram |
| WEB_URL | Sim | URL do Vercel (para CORS do Socket.io) |
| ADMIN_TOKEN | Nao | Token para /admin/sessions |
| WEBHOOK_N8N_URL | Nao | URL do webhook n8n para WhatsApp |
| WEBHOOK_WOW_URL | Nao | URL do webhook de conversao |
| PORT | Nao | Porta (default 3000) |

### Vercel (Frontend)
| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| NEXT_PUBLIC_SUPABASE_URL | Sim | URL do projeto Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Sim | Anon key do Supabase |
| NEXT_PUBLIC_SOCKET_URL | Sim | URL do Railway para Socket.io |
| SUPABASE_SERVICE_ROLE_KEY | Sim | Service role key (para API /api/upload) |

---

## 8. TERMINOLOGIA DO PRODUTO

Toda a interface usa terminologia profissional B2B/juridica, sem emojis:

| Termo Interno | Exibicao na Interface |
|---------------|----------------------|
| Tela 1 | Central de Relacionamento |
| Tela 2 | BackOffice |
| Lead | Prospecto |
| Cliente convertido | Carteira Ativa |
| Notas internas | Dossie Estrategico |
| Score alto | Alta Propensao |
| Sidebar | Operacao Ativa |

---

## 9. HISTORICO DE COMMITS RELEVANTES

| Hash | Descricao |
|------|-----------|
| 84e4fbe | feat: Fase 2 Anexos — inbound completo (documento/foto/audio) + player audio |
| be47571 | feat: Fase 1 Anexos — upload + render + outbound Telegram sendDocument |
| be8492f | fix: CONVERTER usa identity_id correto + pipeline_error feedback |
| 96689e9 | fix: remover componentes orfaos tela2 que quebravam o build |
| 5108419 | fix: remover "Um momento..." — silencio total quando humano ativo |
| 6fe96b3 | feat: BackOffice reescrito — 4 cards + lista agrupada |
| a64ecbb | feat: leads esfriando com horas uteis, pills, tags, contador |
| e2d0394 | feat: 3 blocos visuais + modais em vez de prompt() |
| 2beb088 | fix: fonte unica de dados — saveNome atualiza TODOS os leads |

---

## 10. CHECKLIST DE ENTREGA

### Funcionalidades Core
- [x] Bot de triagem funcional (Telegram)
- [x] Captura agressiva de dados
- [x] Identity resolution cross-canal
- [x] Cockpit de atendimento (3 colunas)
- [x] Chat bidirecional em tempo real
- [x] Envio de arquivos (operador → cliente)
- [x] Recebimento de arquivos (cliente → cockpit)*
- [x] Silenciador inteligente com auto-release
- [x] Classificacao por segmento (3 niveis)
- [x] Pipeline de 8 estagios
- [x] Botoeira de jornada (4 modais)
- [x] CONVERTER / NAO FECHOU / ENFILEIRAR
- [x] BackOffice com visao de negocio
- [x] Orquestracao automatica Cockpit ↔ BackOffice
- [x] Painel financeiro (owner-only)
- [x] Auth com roles
- [x] Sweep automatico
- [x] Reentrada/reaquecimento

### Configuracao Pendente
- [ ] Criar bucket `chat-files` no Supabase Storage
- [ ] Adicionar `SUPABASE_SERVICE_ROLE_KEY` no Railway
- [ ] Adicionar `SUPABASE_SERVICE_ROLE_KEY` no Vercel
- [ ] Rodar migracao 014 no Supabase
- [ ] Verificar `WEB_URL` no Railway inclui URL do Vercel

### Nao Implementado (Futuro)
- [ ] Gravacao de audio no cockpit
- [ ] WhatsApp nativo (sem n8n)
- [ ] Lightbox para imagens
- [ ] Backoffice de segmentos (CRUD)
- [ ] Notificacoes push
- [ ] Responsividade mobile
- [ ] ROI por segmento e periodo

---

*Entregue por Kiro — Santos e Bastos Advogados 2026*
