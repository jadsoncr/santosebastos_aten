# Plano de Implementação: Refatoração da Camada de Storage

## Visão Geral

Refatoração incremental da camada de storage para padrão adapter desacoplado com identidade unificada multi-canal. Cada task produz código funcional e testável, sem dependências circulares. A linguagem é JavaScript (CommonJS, Node.js).

## Tasks

- [x] 1. Criar `src/storage/config.js` — módulo de configuração isolado
  - [x] 1.1 Implementar `getConfig()` que lê `STORAGE_ADAPTER` do ambiente (default: "memory")
    - Aceitar valores válidos: "memory", "sheets", "supabase"
    - Se valor não reconhecido: fallback para "memory" + `console.warn`
    - Se "supabase": validar que `SUPABASE_URL` e `SUPABASE_KEY` existem, senão `throw Error` descritivo
    - Exportar `{ adapter }` como resultado
    - Arquivo alvo: `src/storage/config.js`
    - O que NÃO muda: nenhum outro arquivo é tocado
    - Done: `getConfig()` retorna adapter correto para cada cenário de env var
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.2 Escrever property test para Config (Property 8)
    - **Property 8: Config Aceita Apenas Valores Válidos**
    - Para qualquer string S como `STORAGE_ADAPTER`: se S ∈ {"memory", "sheets", "supabase"}, `getConfig().adapter === S`. Caso contrário, `getConfig().adapter === "memory"`.
    - **Valida: Requisitos 3.4, 3.5**

- [x] 2. Criar `src/storage/adapters/memory.js` — adapter Memory isolado
  - [x] 2.1 Mover `src/storage/inMemory.js` para `src/storage/adapters/memory.js`
    - Manter toda funcionalidade existente: `getSession`, `updateSession`, `createLead`, `createClient`, `createOther`
    - Adicionar `createAbandono` com `classificarAbandono()` (mover lógica de classificação do googleSheets.js)
    - Manter `_clear` e `_getAll` para testes e admin
    - Adicionar array `abandonos` ao store in-memory
    - `_getAll` deve incluir `abandonos` no retorno
    - Arquivo alvo: `src/storage/adapters/memory.js`
    - O que NÃO muda: nenhum import externo é alterado ainda; `inMemory.js` permanece até task 4
    - Done: adapter exporta `createLead`, `createClient`, `createOther`, `createAbandono`, `getSession`, `updateSession`, `_clear`, `_getAll`
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 8.2_

  - [ ]* 2.2 Escrever property test para classificação de abandono (Property 3)
    - **Property 3: Classificação de Abandono é Total**
    - Para qualquer `ultimoEstado` (string), `classificarAbandono(ultimoEstado)` retorna exatamente um de: "PRECOCE", "MEDIO", "VALIOSO".
    - **Valida: Requisito 5.5**

  - [ ]* 2.3 Escrever property test para campos opcionais (Property 4)
    - **Property 4: Campos Opcionais Ausentes Não Lançam Erro**
    - Para qualquer subconjunto de campos opcionais omitidos (mantendo obrigatórios), `createLead`/`createClient`/`createOther`/`createAbandono` não lança exceção.
    - **Valida: Requisito 5.6**

- [x] 3. Criar `src/storage/adapters/sheets.js` — adapter Sheets isolado
  - [x] 3.1 Mover `src/storage/googleSheets.js` para `src/storage/adapters/sheets.js`
    - Manter: `createLead`, `createClient`, `createOther`, `createAbandono` (com `classificarAbandono`)
    - Remover: `getSession`, `updateSession` (não pertencem ao adapter Sheets)
    - Manter helpers internos: `getAuth`, `appendRow`, `fmt`, `ensureAbandonosHeader`
    - Arquivo alvo: `src/storage/adapters/sheets.js`
    - O que NÃO muda: `googleSheets.js` permanece até task 4; nenhum import externo alterado
    - Done: adapter exporta apenas `createLead`, `createClient`, `createOther`, `createAbandono`
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 8.3_

- [x] 4. Reescrever `src/storage/index.js` — firewall arquitetural
  - [x] 4.1 Implementar Storage_Index com config, validação de contrato e wrap()
    - Importar `getConfig()` de `./config`
    - Importar adapter selecionado de `./adapters/{adapter}`
    - Validar que adapter possui `createLead`, `createClient`, `createOther`, `createAbandono` — senão `throw Error` descritivo
    - Implementar `wrap(fn, operacao)` que envolve cada função com:
      - Log JSON de sucesso: `{ adapter, operacao, request_id, timestamp, resultado: "ok" }`
      - Log JSON de erro: `{ adapter, operacao, request_id, identity_id, timestamp, erro }`
      - Relança o erro original após logar
    - Implementar validação de payload na fronteira: log de aviso se campo obrigatório ausente (não bloqueante)
    - Exportar: `createLead`, `createClient`, `createOther`, `createAbandono`, `_getAll`, `_clear`
    - NÃO exportar: `getSession`, `updateSession`
    - Registrar no console qual adapter está ativo na inicialização
    - Arquivo alvo: `src/storage/index.js`
    - O que NÃO muda: stateMachine.js, sessionManager.js (ainda não ajustados)
    - Done: `storage/index.js` carrega adapter correto, valida contrato, loga em JSON, exporta interface pública
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.1, 6.2, 6.3, 6.4, 6.5, 9.2_

  - [ ]* 4.2 Escrever property test para validação de payload (Property 5)
    - **Property 5: Validação de Payload na Fronteira**
    - Payload com campos obrigatórios presentes → sem log de aviso. Payload com campo obrigatório ausente → log de aviso.
    - **Valida: Requisitos 6.1, 6.2, 6.3, 6.4**

  - [ ]* 4.3 Escrever example test para interface pública (Property 9)
    - **Property 9: Storage_Index Exporta Apenas Interface Pública**
    - Chaves exportadas são exatamente: `createLead`, `createClient`, `createOther`, `createAbandono`, `_getAll`, `_clear`. Não contém `getSession` nem `updateSession`.
    - **Valida: Requisitos 4.1, 9.2**

  - [ ]* 4.4 Escrever example test para logs com request_id (Property 12)
    - **Property 12: Logs Contêm request_id e identity_id**
    - Ao chamar qualquer função via Storage_Index, o log JSON contém `request_id`, `identity_id`, `adapter`, `operacao`, `timestamp`.
    - **Valida: Requisitos 4.4, 4.5, 10.2**

- [x] 5. Checkpoint — Validar camada de storage isolada
  - Ensure all tests pass, ask the user if questions arise.
  - Rodar `npm test` e verificar que testes existentes em `tests/stateMachine.test.js` continuam passando.
  - Verificar que `src/storage/inMemory.js` e `src/storage/googleSheets.js` podem ser removidos (imports migrados).

- [x] 6. Ajustar `src/sessionManager.js` — import direto do adapter Memory
  - [x] 6.1 Trocar import de `./storage` para `./storage/adapters/memory` para operações de sessão
    - `getSession` e `updateSession` vêm de `./storage/adapters/memory` (direto)
    - Importar `createAbandono` de `./storage` (via Storage_Index) para uso no sweep TTL
    - Implementar sweep TTL: `setInterval` a cada 30 minutos
      - Sessões inativas > 60 min (baseado em `atualizadoEm`) com `statusSessao !== "ABANDONOU"` → persistir abandono + marcar ABANDONOU + remover da memória
      - Ignorar sessões em estados finais (`pos_final`, `encerramento`, `final_lead`, `final_cliente`)
      - Ignorar sessões com `statusSessao === "ABANDONOU"`
      - Se persistência falhar: log de erro + manter sessão para retry no próximo ciclo
    - Arquivo alvo: `src/sessionManager.js`
    - O que NÃO muda: interface pública (`getSession`, `updateSession`, `resetSession`), lógica de criação de sessão
    - Done: sessionManager usa memory direto para sessões, sweep TTL funciona, createAbandono via Storage_Index
    - _Requisitos: 9.1, 9.2, 9.3, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 6.2 Escrever property test para sweep TTL (Property 7)
    - **Property 7: Sweep TTL Respeita Estados Finais e ABANDONOU**
    - Sessões com `estadoAtual` ∈ estados finais OU `statusSessao === "ABANDONOU"` nunca são removidas pelo sweep, independente do tempo de inatividade.
    - **Valida: Requisitos 11.2, 11.3, 11.4**

- [x] 7. Criar `src/identityResolver.js` — identidade unificada multi-canal
  - [x] 7.1 Implementar `resolveIdentity(channel, channel_user_id, telefone)`
    - Usar adapter Memory internamente (tabelas `identities` e `identity_channels` como Maps in-memory)
    - Fluxo: buscar por `(channel, channel_user_id)` → se encontrou, retornar `identity_id`
    - Se não encontrou e `telefone` fornecido: buscar em `identities` por telefone → se encontrou, vincular canal e retornar `identity_id`
    - Se nada encontrado: criar nova identity (com telefone se disponível), criar identity_channel, retornar novo `identity_id`
    - THROW em caso de falha — bloqueia o fluxo
    - ⚠️ `telefone` chega como `null` do Telegram por padrão (API do Telegram não fornece telefone). Merge cross-canal só acontece quando o fluxo conversacional coleta o telefone explicitamente.
    - Arquivo alvo: `src/identityResolver.js`
    - O que NÃO muda: sessionManager.js, stateMachine.js, storage/
    - Done: `resolveIdentity` retorna identity_id consistente, merge por telefone funciona, throw em falha
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 7.2 Escrever property test para idempotência do resolver (Property 1)
    - **Property 1: Idempotência do Identity Resolver**
    - Para qualquer `(channel, channel_user_id)`, chamar `resolveIdentity` N vezes retorna sempre o mesmo `identity_id` sem criar duplicatas.
    - **Valida: Requisitos 1.3, 1.7**

  - [ ]* 7.3 Escrever property test para convergência multi-canal (Property 2)
    - **Property 2: Convergência Multi-Canal por Telefone**
    - Para qualquer telefone T, resolver `("telegram", id_tg, T)` e depois `("whatsapp", id_wa, T)` resulta no mesmo `identity_id`.
    - **Valida: Requisitos 1.4, 1.5, 1.7**

- [x] 8. Ajustar `src/stateMachine.js` — request_id e resiliência
  - [x] 8.1 Adicionar geração de `request_id` e try/catch na persistência
    - Em `persistirFluxo()`: gerar `request_id = randomUUID()` ANTES de chamar storage
    - Incluir `request_id` e `identity_id` no payload enviado ao storage
    - Envolver chamadas `storage.createLead/Client/Other` com try/catch:
      - Em caso de erro: `console.error(JSON.stringify({ request_id, identity_id, fn }))` + `session.persist_error = true` + CONTINUA (não relança)
    - Remover loop de retry (3 tentativas) — resiliência agora é responsabilidade do wrap() no Storage_Index
    - Trocar `storage.getSession(sessao)` por `sessionManager.getSession(sessao)` onde necessário
    - NÃO alterar: transições de estado, cálculos de score, lógica de prioridade, PERGUNTAS
    - Arquivo alvo: `src/stateMachine.js`
    - O que NÃO muda: árvore de decisão, transições, score, prioridade, mensagens
    - Done: `request_id` gerado antes de persistir, erros capturados sem bloquear fluxo, testes existentes passam
    - _Requisitos: 6.6, 10.2, 10.3, 10.4, 13.1, 15.1, 15.2, 15.3_

  - [ ]* 8.2 Escrever example test para resiliência diferenciada (Property 11)
    - **Property 11: Resiliência Diferenciada — resolveIdentity Bloqueia, Persistência Continua**
    - Com adapter mockado que lança erro: `resolveIdentity` → throw propagado; `createLead/Client/Other` → erro capturado, `persist_error = true`, fluxo continua; `createAbandono` → warning logado, erro ignorado.
    - **Valida: Requisitos 10.1, 10.2, 10.3, 10.4, 10.5**

  - [ ]* 8.3 Escrever example test para request_id nunca gerado pelo adapter (Property 10)
    - **Property 10: request_id Nunca Gerado pelo Adapter**
    - Ao chamar adapter com payload sem `request_id`, o adapter persiste `request_id` como `null`/`undefined` — nunca gera valor próprio.
    - **Valida: Requisitos 6.6, 13.2**

- [x] 9. Ajustar `server.js` — imports e identityResolver
  - [x] 9.1 Corrigir imports e integrar identityResolver
    - Trocar `require('./src/storage/googleSheets')` por `require('./src/storage')` para `createAbandono`
    - Trocar `require('./src/storage/inMemory')` no endpoint `/admin/sessions` por `require('./src/storage')` usando `_getAll`
    - Adicionar `require('./src/identityResolver')` e chamar `resolveIdentity(channel, channel_user_id, telefone)` ANTES de `stateMachine.process()`
    - ⚠️ Para Telegram: `channel = "telegram"`, `channel_user_id = String(tgMsg.chat.id)`, `telefone = null` (API do Telegram não fornece telefone)
    - ⚠️ Para WhatsApp/n8n: `channel = canal`, `channel_user_id = sessao`, `telefone` do payload se disponível
    - Passar `identity_id` retornado para `sessionManager.getSession(identity_id, canal)` e `stateMachine.process(identity_id, mensagem, canal)`
    - Remover função `checkAbandono` do server.js (responsabilidade agora do sweep TTL no sessionManager)
    - Arquivo alvo: `server.js`
    - O que NÃO muda: lógica de áudio/Telegram, endpoint `/health`, middleware `adminAuth`, estrutura Express
    - Done: server.js não importa googleSheets/inMemory diretamente, identityResolver chamado antes do fluxo, checkAbandono removido
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 1.1_

- [x] 10. Checkpoint — Validar integração completa
  - Ensure all tests pass, ask the user if questions arise.
  - Rodar `npm test` — todos os testes em `tests/stateMachine.test.js` devem passar sem modificação nos testes.
  - Verificar que `src/storage/inMemory.js` e `src/storage/googleSheets.js` podem ser deletados (todos os imports migrados).
  - _Requisitos: 15.1, 15.2, 15.3_

- [x] 11. Criar `src/storage/adapters/supabase.js` — adapter Supabase (shadow mode)
  - [x] 11.1 Implementar adapter Supabase com idempotência
    - Implementar `createLead`, `createClient`, `createOther`, `createAbandono`
    - Usar `@supabase/supabase-js` com `SUPABASE_URL` e `SUPABASE_KEY` do ambiente
    - Persistir nas 5 tabelas: `identities`, `identity_channels`, `leads`, `clients`, `others`, `abandonos`
    - Idempotência via `ON CONFLICT`:
      - `leads`, `clients`, `others`: `ON CONFLICT (request_id) DO NOTHING` → retornar `leadId` existente
      - `abandonos`: `ON CONFLICT (identity_id, ultimo_estado) DO NOTHING`
    - `request_id` recebido no payload — adapter NUNCA gera `request_id`
    - Campos opcionais ausentes → `null` (sem erro)
    - Arquivo alvo: `src/storage/adapters/supabase.js`
    - O que NÃO muda: nenhum outro arquivo; adapter só é carregado quando `STORAGE_ADAPTER=supabase`
    - Done: adapter implementa contrato completo, idempotência funciona, testável em isolamento com Supabase de dev
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 12.1, 12.2, 12.4, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11_

  - [ ]* 11.2 Escrever property test para idempotência via request_id (Property 6)
    - **Property 6: Idempotência de Persistência via request_id (Supabase)**
    - Para qualquer payload válido com `request_id` fixo, chamar `createLead`/`createClient`/`createOther` duas vezes resulta em exatamente um registro. Segunda chamada retorna mesmo `leadId`.
    - **Valida: Requisitos 13.7, 13.8, 13.9**

- [x] 12. Validação end-to-end e limpeza
  - [x] 12.1 Remover arquivos legados e validar migração zero-downtime
    - Deletar `src/storage/inMemory.js` (substituído por `adapters/memory.js`)
    - Deletar `src/storage/googleSheets.js` (substituído por `adapters/sheets.js`)
    - Verificar que nenhum arquivo no projeto importa os arquivos deletados
    - Rodar `npm test` — todos os testes passam
    - Testar manualmente (ou via testes) com `STORAGE_ADAPTER=memory` e `STORAGE_ADAPTER=sheets`
    - Verificar logs JSON com `request_id` em cenários de sucesso e erro
    - Done: arquivos legados removidos, zero imports quebrados, testes passam com ambos adapters
    - _Requisitos: 8.1, 8.2, 8.3, 14.1, 14.2, 14.3_

- [x] 13. Checkpoint final — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Confirmar que `tests/stateMachine.test.js` passa sem modificações nos testes.
  - Confirmar que logs JSON contêm `request_id` e `identity_id` em todos os cenários.
  - Confirmar que `STORAGE_ADAPTER` pode ser trocado entre "memory", "sheets" e "supabase" apenas via env var.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude
- Unit/example tests validam cenários específicos e edge cases
- A linguagem de implementação é JavaScript (CommonJS, Node.js com Jest para testes)
