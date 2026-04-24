# Design Técnico — Refatoração da Camada de Storage

## 1. Diagrama de Fluxo

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  server.js   │────▶│ identityResolver │────▶│   stateMachine   │────▶│  storage/index   │
│ (entry point)│     │  resolveIdentity │     │  (decisão/fluxo) │     │   (firewall)     │
└─────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
       │                    │                        │                        │
       │              ❌ throw se                    │                   ┌────┴────┐
       │              falhar (bloqueia)         gera request_id         │  wrap() │
       │                                       via uuidv4()            │  log+err│
       │                                            │                  └────┬────┘
       │                                            ▼                       │
       │                                   ┌────────────────┐         ┌─────▼──────┐
       │                                   │ sessionManager │         │  adapters/  │
       │                                   │ (sessões mem)  │         │  memory.js  │
       │                                   └────────────────┘         │  sheets.js  │
       │                                            │                 │  supabase.js│
       │                                   usa adapters/memory        └────────────┘
       │                                   diretamente para
       │                                   getSession/updateSession
       │
       ▼
  Fluxo de uma requisição:
  1. server.js recebe webhook (Telegram/WhatsApp)
  2. identityResolver.resolveIdentity(channel, channel_user_id, telefone?)
     → retorna identity_id (ou throw se falhar — BLOQUEIA)
     ⚠️ NOTA sobre telefone no Telegram:
       - telefone chega como `null` por padrão (a API do Telegram não fornece número de telefone)
       - O merge cross-canal (vincular Telegram ↔ WhatsApp via telefone) só acontece quando
         o fluxo conversacional (stateMachine) coleta explicitamente o telefone do usuário
       - O identityResolver recebe `telefone = null` do Telegram até que o stateMachine colete o número
  3. sessionManager.getSession(identity_id, canal)
     → sessão em memória via adapters/memory
  4. stateMachine.process(identity_id, mensagem, canal)
     → transições de estado, cálculo de score
     → ao finalizar: gera request_id = uuidv4()
     → chama storage.createLead/Client/Other({ ...data, request_id })
     → se falhar: log.error({ request_id, identity_id, fn }) + session.persist_error = true + CONTINUA
  5. storage/index.js (wrap) → adapter selecionado pelo Config
  6. Resposta ao usuário (nunca bloqueada por erro de persistência)
```

### Fluxo de Resiliência por Método

```
resolveIdentity  ──▶ ❌ THROW (bloqueia) — sem identity_id não há sessão
createLead       ──▶ ⚠️ try/catch → log.error({ request_id, identity_id, fn }) → session.persist_error = true → CONTINUA
createClient     ──▶ ⚠️ try/catch → log.error({ request_id, identity_id, fn }) → session.persist_error = true → CONTINUA
createOther      ──▶ ⚠️ try/catch → log.error({ request_id, identity_id, fn }) → session.persist_error = true → CONTINUA
createAbandono   ──▶ 🟡 try/catch → log.warn({ request_id, identity_id, fn })  → IGNORA (não-crítico)
```

## 2. Contratos de Interface

### 2.1 identityResolver.js

```js
/**
 * Resolve identidade unificada multi-canal.
 * THROW em caso de falha — bloqueia o fluxo.
 *
 * @param {string} channel - "telegram" | "whatsapp"
 * @param {string} channel_user_id - ID do usuário no canal
 * @param {string|null} telefone - telefone para merge cross-canal
 * @returns {Promise<string>} identity_id (UUID)
 */
async function resolveIdentity(channel, channel_user_id, telefone = null) {}
```

### 2.2 storage/config.js

```js
/**
 * @returns {{ adapter: "memory"|"sheets"|"supabase" }}
 * @throws {Error} se supabase sem SUPABASE_URL/SUPABASE_KEY
 */
function getConfig() {}
```

### 2.3 storage/index.js (Storage_Index — Firewall)

```js
// Interface pública exportada:
module.exports = {
  createLead,      // (data: Payload_Lead) => Promise<string>     — retorna leadId
  createClient,    // (data: Payload_Client) => Promise<string>   — retorna leadId
  createOther,     // (data: Payload_Other) => Promise<string>    — retorna leadId
  createAbandono,  // (data: Payload_Abandono) => Promise<void>
  _getAll,         // () => object  (apenas memory, para testes)
  _clear,          // () => void    (apenas memory, para testes)
};
```

### 2.4 Contratos de Payload

```js
// Payload_Lead
{
  identity_id: string,    // obrigatório
  nome: string,           // obrigatório
  request_id: string,     // obrigatório — gerado na stateMachine via uuidv4()
  telefone?: string,
  area?: string,
  urgencia?: string,
  score?: number,
  prioridade?: string,
  flagAtencao?: boolean,
  canalOrigem?: string,
  canalPreferido?: string,
  resumo?: string,
  metadata?: object,
}

// Payload_Client
{
  identity_id: string,    // obrigatório
  nome: string,           // obrigatório
  request_id: string,     // obrigatório
  telefone?: string,
  urgencia?: string,
  conteudo?: string,
  canalOrigem?: string,
  flagAtencao?: boolean,
  metadata?: object,
}

// Payload_Other
{
  identity_id: string,    // obrigatório
  nome: string,           // obrigatório
  request_id: string,     // obrigatório
  telefone?: string,
  tipo?: string,
  conteudo?: string,
  canalOrigem?: string,
  metadata?: object,
}

// Payload_Abandono
{
  identity_id: string,    // obrigatório
  fluxo: string,          // obrigatório
  ultimoEstado: string,   // obrigatório
  request_id: string,     // obrigatório
  score?: number,
  prioridade?: string,
  nome?: string,
  canalOrigem?: string,
  mensagensEnviadas?: number,
}
```

### 2.5 Contrato do Adapter (cada adapter implementa)

```js
// Cada adapter em src/storage/adapters/*.js exporta:
module.exports = {
  createLead:     async (data) => leadId,      // string
  createClient:   async (data) => leadId,      // string
  createOther:    async (data) => leadId,      // string
  createAbandono: async (data) => undefined,   // void
};

// Adapter Memory adiciona:
//   getSession, updateSession  — consumidos pelo sessionManager
//   _clear, _getAll            — consumidos por testes e admin
```

### 2.6 sessionManager.js (sem alteração na interface)

```js
module.exports = {
  getSession:    async (identity_id, canalOrigem) => sessaoObj,
  updateSession: async (identity_id, data) => void,
  resetSession:  async (identity_id, canalOrigem) => sessaoObj,
};
// Importa getSession/updateSession de ./storage/adapters/memory (direto)
```

## 3. Arquivos e Responsabilidades

```
src/
├── identityResolver.js          ← NOVO: resolve channel+user_id → identity_id
│                                   Responsabilidade: lookup/create em identities + identity_channels
│                                   NÃO faz: persistência de leads, sessões, logging
│
├── sessionManager.js            ← ALTERADO: import de ./storage/adapters/memory (direto)
│                                   Responsabilidade: getSession, updateSession, resetSession, sweep TTL
│                                   NÃO faz: persistência final, identity resolution
│
├── stateMachine.js              ← ALTERADO MINIMAMENTE: gera request_id, try/catch na persistência
│                                   Responsabilidade: árvore de decisão, transições, score, prioridade
│                                   Gera request_id via uuidv4() ANTES de chamar storage
│                                   NÃO faz: identity resolution, sessões diretas, logging de storage
│
├── storage/
│   ├── config.js                ← NOVO: lê STORAGE_ADAPTER, valida env vars
│   │                               Responsabilidade: seleção e validação do adapter
│   │                               NÃO faz: importação de adapters, logging
│   │
│   ├── index.js                 ← REESCRITO: firewall arquitetural
│   │                               Responsabilidade: importa adapter, valida contrato, wrap() com logging
│   │                               Exporta: createLead, createClient, createOther, createAbandono, _getAll, _clear
│   │                               NÃO exporta: getSession, updateSession
│   │                               NÃO faz: lógica de negócio, geração de request_id
│   │
│   └── adapters/
│       ├── memory.js            ← MOVIDO de inMemory.js
│       │                           Responsabilidade: persistência em Map/Array + getSession/updateSession
│       │                           NÃO faz: logging, validação, geração de IDs
│       │
│       ├── sheets.js            ← MOVIDO de googleSheets.js
│       │                           Responsabilidade: persistência no Google Sheets via API
│       │                           NÃO faz: logging, validação, getSession/updateSession
│       │
│       └── supabase.js          ← NOVO: persistência no PostgreSQL via Supabase
│                                   Responsabilidade: CRUD nas 5 tabelas, ON CONFLICT para idempotência
│                                   NÃO faz: logging, validação, geração de request_id
│
├── normalizer.js                ← SEM ALTERAÇÃO
├── responder.js                 ← SEM ALTERAÇÃO
└── scorer.js                    ← SEM ALTERAÇÃO

server.js                        ← ALTERADO: importa createAbandono e _getAll via storage/index
                                    Chama identityResolver antes de stateMachine
                                    NÃO importa mais googleSheets nem inMemory diretamente
```

### Modelo de Dados Supabase (6 tabelas)

```sql
-- identities
CREATE TABLE identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- identity_channels
CREATE TABLE identity_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  channel TEXT NOT NULL,
  channel_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel, channel_user_id)
);

-- leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  request_id TEXT UNIQUE NOT NULL,
  nome TEXT,
  telefone TEXT,
  area TEXT,
  situacao TEXT,
  impacto TEXT,
  intencao TEXT,
  score INTEGER DEFAULT 0,
  prioridade TEXT DEFAULT 'FRIO',
  flag_atencao BOOLEAN DEFAULT false,
  canal_origem TEXT,
  canal_preferido TEXT,
  resumo TEXT,
  metadata JSONB,
  status TEXT DEFAULT 'NOVO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  request_id TEXT UNIQUE NOT NULL,
  nome TEXT,
  telefone TEXT,
  urgencia TEXT,
  conteudo TEXT,
  canal_origem TEXT,
  flag_atencao BOOLEAN DEFAULT false,
  metadata JSONB,
  status TEXT DEFAULT 'NOVO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- others
CREATE TABLE others (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  request_id TEXT UNIQUE NOT NULL,
  nome TEXT,
  telefone TEXT,
  tipo TEXT,
  conteudo TEXT,
  canal_origem TEXT,
  metadata JSONB,
  status TEXT DEFAULT 'NOVO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- abandonos
CREATE TABLE abandonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  request_id TEXT NOT NULL,              -- SEM UNIQUE: mesmo user pode abandonar múltiplas vezes
  fluxo TEXT,
  ultimo_estado TEXT,
  score INTEGER DEFAULT 0,
  prioridade TEXT DEFAULT 'FRIO',
  nome TEXT,
  canal_origem TEXT,
  mensagens_enviadas INTEGER DEFAULT 0,
  classificacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identity_id, ultimo_estado)     -- idempotência por estado
);
```

## 4. Ordem de Implementação

Sequência sem dependências circulares. Cada passo depende apenas dos anteriores.

```
Passo 1: src/storage/config.js
  └─ Sem dependências. Lê env vars, exporta { adapter }.
  └─ Testável isoladamente.

Passo 2: src/storage/adapters/memory.js
  └─ Depende de: nada
  └─ Mover inMemory.js → adapters/memory.js (manter getSession/updateSession/_clear/_getAll)
  └─ Testes existentes devem continuar passando.

Passo 3: src/storage/adapters/sheets.js
  └─ Depende de: nada
  └─ Mover googleSheets.js → adapters/sheets.js (remover getSession/updateSession)
  └─ Manter createLead, createClient, createOther, createAbandono.

Passo 4: src/storage/index.js (reescrita)
  └─ Depende de: config.js (passo 1), adapters/memory (passo 2), adapters/sheets (passo 3)
  └─ Importa config, seleciona adapter, valida contrato, wrap() com logging
  └─ Exporta: createLead, createClient, createOther, createAbandono, _getAll, _clear

Passo 5: src/sessionManager.js (ajuste de import)
  └─ Depende de: adapters/memory (passo 2)
  └─ Trocar import de ./storage para ./storage/adapters/memory
  └─ Adicionar lógica de sweep TTL com createAbandono via storage/index

Passo 6: src/identityResolver.js
  └─ Depende de: adapters/memory (passo 2) para implementação in-memory
  └─ Implementar resolveIdentity(channel, channel_user_id, telefone)
  └─ Testável isoladamente com adapter memory.

Passo 7: src/stateMachine.js (ajuste mínimo)
  └─ Depende de: storage/index (passo 4)
  └─ Adicionar geração de request_id via uuidv4() em persistirFluxo()
  └─ Adicionar try/catch com log.error + session.persist_error = true
  └─ NÃO alterar transições, score, prioridade.

Passo 8: server.js (ajuste de imports)
  └─ Depende de: storage/index (passo 4), identityResolver (passo 6)
  └─ Trocar import de googleSheets/inMemory para storage/index
  └─ Adicionar chamada a identityResolver antes de stateMachine.process()

Passo 9: src/storage/adapters/supabase.js (shadow mode)
  └─ Depende de: contrato definido no passo 4
  └─ Implementar createLead, createClient, createOther, createAbandono
  └─ ON CONFLICT para idempotência
  └─ Testável em isolamento com Supabase de dev.

Passo 10: Validação final
  └─ Rodar tests/stateMachine.test.js sem modificações
  └─ Testar com STORAGE_ADAPTER=memory, sheets, supabase
  └─ Verificar logs JSON com request_id em todos os cenários
```


## 5. Propriedades de Corretude

### Property 1: Idempotência do Identity Resolver
- **Requisito:** 1.3, 1.7
- **Tipo:** Property-based test
- **Propriedade:** Para qualquer `(channel, channel_user_id)`, chamar `resolveIdentity` N vezes retorna sempre o mesmo `identity_id` e não cria registros duplicados em `identity_channels`.
- **Gerador:** channel ∈ {"telegram", "whatsapp"}, channel_user_id = string alfanumérica aleatória

### Property 2: Convergência Multi-Canal por Telefone
- **Requisito:** 1.4, 1.5, 1.7
- **Tipo:** Property-based test
- **Propriedade:** Para qualquer telefone T, resolver `("telegram", id_tg, T)` e depois `("whatsapp", id_wa, T)` resulta no mesmo `identity_id`.
- **Gerador:** telefone = string numérica 10-11 dígitos, id_tg e id_wa = strings aleatórias distintas

### Property 3: Classificação de Abandono é Total
- **Requisito:** 5.5
- **Tipo:** Property-based test
- **Propriedade:** Para qualquer `ultimoEstado` (string), `classificarAbandono(ultimoEstado)` retorna exatamente um de: "PRECOCE", "MEDIO", "VALIOSO".
- **Gerador:** ultimoEstado = qualquer string do conjunto de estados válidos + strings aleatórias

### Property 4: Campos Opcionais Ausentes Não Lançam Erro
- **Requisito:** 5.6
- **Tipo:** Property-based test
- **Propriedade:** Para qualquer subconjunto de campos opcionais omitidos do payload (mantendo os obrigatórios), `createLead`/`createClient`/`createOther`/`createAbandono` não lança exceção.
- **Gerador:** payload com campos obrigatórios fixos + subconjunto aleatório de campos opcionais

### Property 5: Validação de Payload na Fronteira
- **Requisito:** 6.1, 6.2, 6.3, 6.4
- **Tipo:** Property-based test
- **Propriedade:** Para qualquer payload com todos os campos obrigatórios presentes (`identity_id`, `nome`, `request_id`), o Storage_Index repassa ao adapter sem log de aviso. Para qualquer payload com campo obrigatório ausente, o Storage_Index registra log de aviso.
- **Gerador:** payloads com combinações aleatórias de campos presentes/ausentes

### Property 6: Idempotência de Persistência via request_id (Supabase)
- **Requisito:** 13.7, 13.8, 13.9
- **Tipo:** Property-based test
- **Propriedade:** Para qualquer payload válido com `request_id` fixo, chamar `createLead`/`createClient`/`createOther` duas vezes resulta em exatamente um registro no banco. A segunda chamada retorna o mesmo `leadId`.
- **Gerador:** payloads válidos com request_id = uuidv4() fixo por iteração

### Property 7: Sweep TTL Respeita Estados Finais e ABANDONOU
- **Requisito:** 11.2, 11.3, 11.4
- **Tipo:** Property-based test
- **Propriedade:** Para qualquer sessão com `estadoAtual` ∈ {pos_final, encerramento, final_lead, final_cliente} OU `statusSessao` = "ABANDONOU", o sweep nunca persiste abandono nem remove a sessão, independente do tempo de inatividade.
- **Gerador:** sessões com estados aleatórios, statusSessao aleatório, atualizadoEm variando de 0 a 120 minutos atrás

### Property 8: Config Aceita Apenas Valores Válidos
- **Requisito:** 3.4, 3.5
- **Tipo:** Property-based test
- **Propriedade:** Para qualquer string S como `STORAGE_ADAPTER`: se S ∈ {"memory", "sheets", "supabase"}, `getConfig().adapter === S`. Se S ∉ desse conjunto, `getConfig().adapter === "memory"`.
- **Gerador:** strings aleatórias + os 3 valores válidos

### Property 9: Storage_Index Exporta Apenas Interface Pública
- **Requisito:** 4.1, 9.2
- **Tipo:** Example test
- **Verificação:** As chaves exportadas por `storage/index.js` são exatamente: `createLead`, `createClient`, `createOther`, `createAbandono`, `_getAll`, `_clear`. Não contém `getSession` nem `updateSession`.

### Property 10: request_id Nunca Gerado pelo Adapter
- **Requisito:** 6.6, 13.2
- **Tipo:** Example test
- **Verificação:** Ao chamar qualquer função do adapter com payload sem `request_id`, o adapter persiste `request_id` como `null`/`undefined` — nunca gera um valor próprio. O `request_id` presente no registro persistido é sempre idêntico ao recebido no payload.

### Property 11: Resiliência Diferenciada — resolveIdentity Bloqueia, Persistência Continua
- **Requisito:** 10.1, 10.2, 10.3, 10.4, 10.5
- **Tipo:** Example test
- **Verificação:** Com adapter mockado que lança erro em todas as funções:
  - `resolveIdentity` → erro propagado (throw)
  - `createLead` → erro capturado, `session.persist_error = true`, fluxo continua
  - `createClient` → erro capturado, `session.persist_error = true`, fluxo continua
  - `createOther` → erro capturado, `session.persist_error = true`, fluxo continua
  - `createAbandono` → warning logado, erro ignorado

### Property 12: Logs Contêm request_id e identity_id
- **Requisito:** 4.4, 4.5, 10.2
- **Tipo:** Example test
- **Verificação:** Ao chamar qualquer função via Storage_Index (sucesso ou erro), o log JSON emitido contém os campos `request_id`, `identity_id` (extraído do payload), `adapter`, `operacao` e `timestamp`.
