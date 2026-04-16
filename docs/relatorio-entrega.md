# Relatório de Entrega — Sistema de Atendimento Jurídico
**Santos & Bastos Advogados**
**Data:** 15/04/2026
**Repositório:** https://github.com/jadsoncr/santosebastos_aten
**Deploy:** Railway (autodeploy via push em `main`)

---

## 1. Objetivo

Construir um sistema automatizado de atendimento jurídico via WhatsApp, capaz de:

- Receber mensagens do n8n via webhook
- Classificar e qualificar leads com score incremental
- Conduzir o usuário por fluxos de atendimento específicos
- Identificar urgência e priorizar casos automaticamente
- Persistir dados para triagem pelo time de advogados

---

## 2. Arquitetura

```
WhatsApp
    ↓
  n8n
    ↓
POST /webhook
    ↓
normalizer.js       → limpa e padroniza entrada
    ↓
stateMachine.js     → motor de estados e fluxos
    ↙            ↘
scorer.js     sessionManager.js
                  ↓
            storage/index.js
             ↙          ↘
      inMemory.js    googleSheets.js (stub)
    ↓
responder.js        → formata saída JSON
    ↓
n8n / WhatsApp
```

**Stack:** Node.js 22, Express 5, dotenv — sem banco de dados.
**Testes:** Jest — 66 testes, 0 falhas.

---

## 3. Módulos entregues

| Arquivo | Responsabilidade |
|---|---|
| `server.js` | Entrada HTTP, `POST /webhook`, `GET /health` |
| `src/normalizer.js` | Limpa sessao/telefone/Telefone, trim/lowercase |
| `src/scorer.js` | Fórmula de score e classificação de prioridade |
| `src/sessionManager.js` | Criação, atualização e reset de sessão |
| `src/stateMachine.js` | Motor de estados, transições, perguntas, flags |
| `src/responder.js` | Formato de saída consistente |
| `src/storage/index.js` | Seleção de adapter por env var |
| `src/storage/inMemory.js` | Persistência em memória (MVP) |
| `src/storage/googleSheets.js` | Stub pronto para implementação futura |
| `tests/normalizer.test.js` | 7 testes |
| `tests/scorer.test.js` | 6 testes |
| `tests/stateMachine.test.js` | 53 testes |

---

## 4. Jornada do usuário

### Entrada — fallback progressivo

```
Usuário envia qualquer mensagem
        ↓
Detecção de urgência (transversal)
"urgente" / "advogado" / "falar com alguém" → flagAtencao = true
        ↓
Palavra de reset?
"menu" / "reiniciar" / "voltar" → volta ao início
        ↓
[ESTADO: inicio]
"Olá! Aqui é do Santos & Bastos Advogados 👋
 Me conta o que aconteceu 👇"
        ↓
Classifica por texto livre?
    SIM → vai direto ao fluxo
    NÃO → [ESTADO: inicio_detalhe]
          "Pode me explicar um pouco melhor?"
               ↓
          Classifica? (texto ou 1/2/3/4)
              SIM → vai ao fluxo
              NÃO → [ESTADO: inicio_menu]
                    "1 - Já sou cliente
                     2 - Problema no trabalho
                     3 - Questões de família
                     4 - Outro assunto"
                         ↓
                    se nada classificar → Fluxo Outros
```

### Classificação por texto livre

O sistema reconhece linguagem coloquial brasileira sem exigir palavras exatas:

**Trabalhista:** `demitido`, `me demitiram`, `mandaram embora`, `mandado embora`, `dispensado`, `desligado`, `perdi o emprego`, `aviso prévio`, `justa causa`, `horas extras`, `carteira assinada`, `fgts`, `rescisão`

**Família:** `pensão`, `alimentos`, `guarda`, `divórcio`, `separação`, `filho`, `filha`, `casamento`, `inventário`, `herança`, `partilha`, `cônjuge`

**Cliente existente:** `sou cliente`, `já cliente`, `tenho processo`, `meu processo`, `quero falar com advogado`

---

## 5. Fluxos de atendimento

### Fluxo A — Cliente existente
```
cliente_nome → cliente_canal_contato → cliente_mensagem → cliente_finalizado
```
- Não coleta impacto/intenção
- Prioridade mínima: **MEDIO** (nunca FRIO)
- Com flagAtencao: **QUENTE**

### Fluxo B — Trabalhista
```
trabalhista_situacao → trabalhista_impacto → trabalhista_intencao
    → [quente_humano se score ≥ 7]
    → trabalhista_nome → trabalhista_canal_contato → trabalhista_descricao → finalizado
```

### Fluxo C — Família
```
familia_situacao → familia_impacto → familia_intencao
    → [quente_humano se score ≥ 7]
    → familia_nome → familia_canal_contato → familia_descricao → finalizado
```

### Fluxo D — Outros
```
outro_tipo → outro_impacto → outro_intencao
    → outro_nome → outro_canal_contato → outro_descricao → finalizado
```
- Coleta impacto (adicionado para permitir score QUENTE)
- Score máximo possível: 7 → QUENTE

---

## 6. Score e prioridade

**Fórmula:**
```
score = impacto (1–3) + intenção (1–3) + 1
```

| Score | Prioridade | Mensagem de finalização |
|---|---|---|
| < 5 | FRIO | "Recebi suas informações 👍 Vamos analisar e te orientar sobre os próximos passos." |
| 5–6 | MEDIO | "Recebemos suas informações e iremos analisar seu caso." |
| ≥ 7 | QUENTE | "Seu caso foi identificado como prioritário. Entraremos em contato o mais breve possível." |

**Exemplos:**

| Impacto | Intenção | Score | Prioridade |
|---|---|---|---|
| 1 | 1 | 3 | FRIO |
| 2 | 2 | 5 | MEDIO |
| 3 | 2 | 6 | MEDIO |
| 3 | 3 | 7 | QUENTE |

Score calculado **incrementalmente**: atualizado após impacto e recalculado após intenção.

---

## 7. Estado quente_humano

Ativado automaticamente quando `score ≥ 7` ao final de trabalhista ou família:

```
"⚠️ Pelo que você descreveu, seu caso pode precisar de atenção rápida.

Prefere falar diretamente com um advogado agora?
1 - Sim, quero falar com alguém
2 - Não, continuar aqui"
```

- Opção `1`: finaliza imediatamente, persiste com `querHumano: true`
- Opção `2`: continua o fluxo normalmente

---

## 8. Flag de atenção

Ativada em qualquer mensagem, em qualquer estado, quando contém:
`urgente` · `advogado` · `falar com alguém` · `falar com alguem`

- Persiste durante toda a sessão
- **Persiste após reset** (não é zerada ao reiniciar)
- Cliente com flagAtencao → prioridade QUENTE

---

## 9. Resiliência de entrada

O campo de identificação aceita três variações sem configuração adicional:

```json
{ "sessao":   "21999999999" }
{ "telefone": "21999999999" }
{ "Telefone": "21999999999" }
```

Canal padrão quando não informado: `whatsapp`

---

## 10. Persistência por fluxo

| Fluxo | Método | Campos salvos |
|---|---|---|
| cliente | `createClient()` | nome, telefone, canal, mensagem, urgencia |
| trabalhista | `createLead()` | nome, área, situação, impacto, intenção, score, prioridade, canal, resumo |
| família | `createLead()` | idem trabalhista |
| outros | `createOther()` | nome, tipo, canal, conteúdo |

**Adapter atual:** in-memory (dados perdidos ao reiniciar — aceito para MVP)
**Próximo passo:** Google Sheets (`src/storage/googleSheets.js` — stub completo e documentado)

---

## 11. Testes

```
Test Suites: 3 passed, 3 total
Tests:       66 passed, 66 total
Time:        0.24s
```

| Suite | Testes | Cobertura |
|---|---|---|
| normalizer | 7 | limpeza sessao, aliases telefone/Telefone, trim, lowercase, dataHora, nulo |
| scorer | 6 | fórmula, thresholds, valores parciais, score mínimo |
| stateMachine | 53 | 4 fluxos end-to-end, fallback progressivo, 29 variações linguísticas, score em todos os thresholds, quente_humano, flagAtencao, reset |

### Bugs encontrados e corrigidos durante QA

| Bug | Causa | Fix |
|---|---|---|
| Cliente finalizava como FRIO | `buildResposta` usava sessão carregada antes de `persistirFluxo` atualizar a prioridade | Recarregar sessão após persistir |
| `flagAtencao` zerada no reset | `resetSession` sobrescrevia com `false` incondicionalmente | Preservar valor existente antes de resetar |

---

## 12. Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/webhook` | Entrada principal — processa mensagem |
| `GET` | `/health` | Health check — retorna `{ "status": "ok" }` |

**Payload esperado:**
```json
{
  "sessao": "21999999999",
  "mensagem": "fui demitido",
  "canal": "whatsapp"
}
```

**Resposta:**
```json
{
  "message": "Descreva brevemente sua situação trabalhista:",
  "estado": "trabalhista_situacao",
  "fluxo": "trabalhista",
  "sessao": "21999999999",
  "score": 1,
  "prioridade": "FRIO",
  "flagAtencao": false
}
```

---

## 13. Variáveis de ambiente

```env
PORT=3000
STORAGE_ADAPTER=memory
```

Para ativar Google Sheets no futuro:
```env
STORAGE_ADAPTER=sheets
GOOGLE_SERVICE_ACCOUNT_JSON=...
SPREADSHEET_ID=...
```

---

## 14. Histórico de commits

| Hash | Descrição |
|---|---|
| `317d250` | chore: setup inicial do projeto |
| `0b3ca2e` | feat: normalizer de entrada do webhook |
| `53f5e84` | feat: scorer com cálculo incremental de prioridade |
| `ef25701` | feat: storage adapter plugável (in-memory MVP + stub Google Sheets) |
| `c0513d6` | feat: session manager com get/update/reset |
| `9f17561` | feat: máquina de estados com score incremental e flag de atenção |
| `d7fd913` | feat: server.js final com responder e health check |
| `0e58ae0` | feat: aceitar telefone/Telefone como alias de sessao no normalizer |
| `33413da` | refactor: renomear canal_preferido para canal_contato na stateMachine |
| `2a7274b` | feat: jornada híbrida com abertura conversacional, regex expandido e oferta de humano QUENTE |
| `1e7f9c5` | feat: ajustes de conversão — finalização FRIO, impacto em outros, cliente como MEDIO |
| `7b81bb9` | test: QA completo com 66 testes + fix de 2 bugs encontrados |

---

## 15. Status de entrega

| Item | Status |
|---|---|
| Webhook funcional | ✅ |
| 4 fluxos de atendimento completos | ✅ |
| Score e prioridade incrementais | ✅ |
| Fallback progressivo sem travamento | ✅ |
| Classificação por linguagem coloquial | ✅ |
| Flag de atenção transversal | ✅ |
| Oferta de humano para leads QUENTE | ✅ |
| Cliente com prioridade mínima MEDIO | ✅ |
| Fluxo outros com score real | ✅ |
| Storage plugável | ✅ |
| Health check Railway | ✅ |
| 66 testes automatizados | ✅ |
| `.gitignore` configurado | ✅ |
| Deploy Railway ativo | ✅ |

---

## 16. Próximos passos sugeridos

| Item | Prioridade | Motivo |
|---|---|---|
| Implementar Google Sheets adapter | Alta | Persistência real entre deploys |
| Definir SLA de resposta humana | Alta | Sem isso, leads QUENTE esfriamm |
| Validação entre impacto e intenção | Média | Reduz abandono — implementar após observar dados reais |
| Autenticação no webhook (token) | Média | Segurança em produção |
| Expiração de sessão por inatividade | Média | Limpeza de memória |
| Logs estruturados (JSON) | Baixa | Observabilidade |
