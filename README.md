# Santos & Bastos — Motor de Atendimento Jurídico

Backend conversacional para triagem e qualificação de leads jurídicos via Telegram (e futuramente WhatsApp), com persistência no Google Sheets.

---

## O que é este sistema

Não é um chatbot simples. É um **motor de decisão conversacional** com:

- Máquina de estados que guia o usuário por fluxos específicos
- Score incremental que classifica leads por prioridade
- Sessão por conversa mantida em memória
- Persistência final em Google Sheets ao encerrar o atendimento

---

## Fluxo técnico

```
Usuário (Telegram)
        ↓
  Telegram Bot API
        ↓
  POST /webhook  ←── Railway (Node.js + Express)
        ↓
  normalizer.js       padroniza entrada: sessao, mensagem, canal
        ↓
  sessionManager.js   cria/carrega estado da conversa (memória)
        ↓
  stateMachine.js     decide fluxo, avança estado, classifica intenção
        ↓
  scorer.js           calcula score = impacto + intenção + 1
        ↓
  storage/index.js
        ↓
  googleSheets.js     persiste lead na planilha ao finalizar
```

---

## Fluxos disponíveis

| Gatilho | Fluxo | Aba na planilha |
|---|---|---|
| "fui demitido", "rescisão", "horas extras"... | trabalhista | Leads |
| "divórcio", "pensão", "guarda", "inventário"... | familia | Leads |
| "já sou cliente", "meu processo"... | cliente | Clientes |
| qualquer outra coisa | outros | Outros |

---

## Regras de negócio

- **Sessão** → em memória, por conversa. Reinicia com "menu" ou "reiniciar"
- **Score** = impacto (1–3) + intenção (1–3) + 1
- **FRIO** < 5 | **MEDIO** 5–6 | **QUENTE** ≥ 7
- **QUENTE** → oferece transferência para advogado antes de encerrar
- **Persistência** → só acontece ao finalizar o fluxo
- **Retry** → 3 tentativas automáticas se o Google Sheets falhar
- **flagAtencao** → ativado por palavras de urgência, persiste entre resets

---

## Canais suportados

| Canal | Status |
|---|---|
| Telegram | Ativo |
| WhatsApp (via n8n) | Previsto |

---

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão: 3000) |
| `STORAGE_ADAPTER` | `memory` (dev) ou `sheets` (produção) |
| `TELEGRAM_TOKEN` | Token do bot (BotFather) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON da service account (inline) |
| `GOOGLE_SHEETS_ID` | ID da planilha Google Sheets |

---

## Endpoints

```
POST /webhook   recebe mensagens (Telegram ou n8n/WhatsApp)
GET  /health    healthcheck Railway
```

---

## Testes

```bash
npm test        # 66 testes (Jest)
```

3 suites: `stateMachine`, `scorer`, `storage`

---

## Stack

- Node.js 22 + Express 5 + CommonJS
- Jest 29
- Google Sheets API v4 (googleapis)
- Railway (deploy via push em `main`)

---

## Riscos conhecidos

| Risco | Impacto | Situação |
|---|---|---|
| Sessão em memória | restart perde contexto ativo | aceitável no MVP |
| Google Sheets como persistência | não é banco, pode ter gargalo em escala | aceitável no MVP |
| Sem WhatsApp oficial | canal limitado a Telegram | previsto para próxima fase |
