# Documento de Requisitos — Refatoração da Camada de Storage

## Introdução

Este documento define os requisitos para refatorar a camada de armazenamento (storage) do chatbot do escritório Santos & Bastos Advogados. O objetivo é introduzir um padrão de adapter desacoplado com suporte multi-canal (Telegram + WhatsApp), permitindo trocar o backend de persistência (Memory, Google Sheets, Supabase) sem alterar a máquina de estados (`stateMachine.js`) nem o gerenciador de sessões (`sessionManager.js`).

Princípios:
- A State Machine nunca sabe para onde os dados vão — conhece apenas o contrato.
- Sessões permanecem em memória, gerenciadas exclusivamente pelo `sessionManager.js`. Adapters NÃO tocam em sessões.
- Adapters são responsáveis apenas por persistência: `createLead`, `createClient`, `createOther`, `createAbandono`.
- Validação de payload ocorre na fronteira (Storage_Index), não dentro dos adapters.
- Logging centralizado no Storage_Index via `wrap()`. Adapters não logam.
- Falha de storage NÃO interrompe o fluxo conversacional — o usuário nunca perde a conversa por erro de persistência.
- Identidade unificada: mesmo usuário em canais diferentes (Telegram, WhatsApp) é resolvido para um único `identity_id`.

## Glossário

- **Identity_Resolver**: Módulo `src/identityResolver.js` responsável por resolver a identidade unificada de um usuário a partir do canal e identificador do canal (`channel_user_id`). Busca primeiro por canal, depois por telefone, e cria nova identidade se não encontrar.
- **Identity**: Registro na tabela `identities` que representa uma pessoa física única, identificada por telefone. Possui um `id` interno usado como chave estrangeira em todas as tabelas de persistência.
- **Identity_Channel**: Registro na tabela `identity_channels` que vincula um canal específico (telegram, whatsapp) e seu `channel_user_id` a uma Identity. Constraint UNIQUE em `(channel, channel_user_id)`.
- **Storage_Index**: Módulo `src/storage/index.js` que atua como "firewall arquitetural". Importa adapters, seleciona com base no Config, valida que o adapter possui todas as funções requeridas, envolve cada função com logging centralizado e exporta apenas: `createLead`, `createClient`, `createOther`, `createAbandono`.
- **Adapter**: Implementação concreta de persistência (Memory, Sheets ou Supabase) localizada em `src/storage/adapters/`. Cada adapter implementa apenas funções de persistência — sem sessões, sem validação, sem logging.
- **State_Machine**: Módulo `src/stateMachine.js` responsável pela árvore de decisão do fluxo jurídico do chatbot.
- **Session_Manager**: Módulo `src/sessionManager.js` responsável por criar, atualizar e resetar sessões. Usa `inMemory` diretamente para `getSession`/`updateSession`. Único dono das sessões.
- **Config**: Módulo `src/storage/config.js` que lê `STORAGE_ADAPTER` do ambiente (default: "memory"), valida variáveis do Supabase quando necessário, e exporta a configuração.
- **Sessão**: Objeto em memória que representa o estado conversacional de um usuário identificado por `identity_id`.
- **TTL_de_Sessão**: Tempo máximo de inatividade permitido para uma sessão antes de ser classificada como abandono.
- **Abandono**: Registro persistido quando uma sessão expira por inatividade, classificado como PRECOCE, MEDIO ou VALIOSO.
- **Shadow_Mode**: Estratégia de validação onde o adapter Supabase é construído e testado em isolamento enquanto `STORAGE_ADAPTER=sheets` permanece ativo em produção. A troca para Supabase ocorre apenas alterando a variável de ambiente — zero mudanças de código.
- **Payload_Lead**: Estrutura de dados para persistência de leads, contendo campos obrigatórios (`identity_id`, `nome`, `request_id`) e opcionais (`telefone`, `area`, `urgencia`, `score`, `prioridade`, `flagAtencao`, `canalOrigem`, `canalPreferido`, `resumo`, `metadata`).
- **Payload_Client**: Estrutura de dados para persistência de clientes, contendo campos obrigatórios (`identity_id`, `nome`, `request_id`) e opcionais (`telefone`, `urgencia`, `conteudo`, `canalOrigem`, `flagAtencao`, `metadata`).
- **Payload_Other**: Estrutura de dados para persistência de registros do tipo "outros", contendo campos obrigatórios (`identity_id`, `nome`, `request_id`) e opcionais (`telefone`, `tipo`, `conteudo`, `canalOrigem`, `metadata`).
- **Payload_Abandono**: Estrutura de dados para persistência de abandonos, contendo campos obrigatórios (`identity_id`, `fluxo`, `ultimoEstado`, `request_id`) e opcionais (`score`, `prioridade`, `nome`, `canalOrigem`, `mensagensEnviadas`).

## Requisitos

### Requisito 1: Identity Resolver — Identidade Unificada Multi-Canal

**User Story:** Como operador do sistema, eu quero que o mesmo usuário seja reconhecido como uma única pessoa independente do canal (Telegram ou WhatsApp), para que leads, analytics e CRM sejam consistentes.

#### Critérios de Aceitação

1. THE Identity_Resolver SHALL receber `channel` (string: "telegram" ou "whatsapp") e `channel_user_id` (string) como entrada e retornar um `identity_id` interno.
2. WHEN o Identity_Resolver receber um `channel` e `channel_user_id`, THE Identity_Resolver SHALL primeiro buscar na tabela `identity_channels` por um registro com `(channel, channel_user_id)` correspondente.
3. WHEN a busca por canal encontrar um registro existente, THE Identity_Resolver SHALL retornar o `identity_id` associado sem criar novos registros.
4. WHEN a busca por canal não encontrar resultado e um `telefone` for fornecido, THE Identity_Resolver SHALL buscar na tabela `identities` por um registro com o mesmo `telefone`.
5. WHEN a busca por telefone encontrar uma Identity existente, THE Identity_Resolver SHALL vincular o novo canal criando um registro em `identity_channels` com o `identity_id` encontrado e retornar esse `identity_id`.
6. WHEN nenhuma busca encontrar resultado, THE Identity_Resolver SHALL criar um novo registro em `identities` (com `telefone` se disponível), criar o registro correspondente em `identity_channels`, e retornar o novo `identity_id`.
7. THE Identity_Resolver SHALL garantir que a mesma pessoa usando Telegram e WhatsApp resulte em um único `identity_id`, vinculando ambos os canais à mesma Identity.

### Requisito 2: Modelo de Dados com Identidade (5 Tabelas)

**User Story:** Como desenvolvedor, eu quero que o modelo relacional do Supabase use 5 tabelas com `identity_id` como chave estrangeira, para que todos os registros estejam vinculados a uma identidade unificada.

#### Critérios de Aceitação

1. THE Adapter Supabase SHALL persistir dados na tabela `identities` com os campos: `id` (UUID, PK), `telefone` (string, UNIQUE, nullable) e `created_at` (timestamp).
2. THE Adapter Supabase SHALL persistir dados na tabela `identity_channels` com os campos: `id` (UUID, PK), `identity_id` (FK para `identities`), `channel` (string), `channel_user_id` (string) e `created_at` (timestamp), com constraint UNIQUE em `(channel, channel_user_id)`.
3. THE Adapter Supabase SHALL persistir dados na tabela `leads` com `identity_id` (FK para `identities`) em vez de `telegram_id`, além dos campos existentes de lead.
4. THE Adapter Supabase SHALL persistir dados na tabela `clients` com `identity_id` (FK para `identities`) em vez de `telegram_id`, além dos campos existentes de cliente.
5. THE Adapter Supabase SHALL persistir dados na tabela `others` com `identity_id` (FK para `identities`) em vez de `telegram_id`, além dos campos existentes de outros.
6. THE Adapter Supabase SHALL persistir dados na tabela `abandonos` com `identity_id` (FK para `identities`) em vez de `sessao` como identificador principal, além dos campos existentes de abandono.

### Requisito 3: Módulo de Configuração (Config)

**User Story:** Como desenvolvedor, eu quero um módulo de configuração centralizado para o storage, para que a seleção do adapter e a validação de variáveis de ambiente estejam isoladas em um único lugar.

#### Critérios de Aceitação

1. THE Config SHALL ler a variável de ambiente `STORAGE_ADAPTER` e exportar o nome do adapter selecionado, utilizando "memory" como valor padrão quando a variável não estiver definida.
2. WHEN `STORAGE_ADAPTER` estiver definido como "supabase", THE Config SHALL validar que as variáveis `SUPABASE_URL` e `SUPABASE_KEY` estão definidas no ambiente.
3. IF `STORAGE_ADAPTER` for "supabase" e `SUPABASE_URL` ou `SUPABASE_KEY` não estiverem definidas, THEN THE Config SHALL lançar um erro descritivo informando quais variáveis estão ausentes.
4. THE Config SHALL aceitar os valores "memory", "sheets" e "supabase" como adapters válidos.
5. IF `STORAGE_ADAPTER` contiver um valor não reconhecido, THEN THE Config SHALL utilizar "memory" como fallback e registrar um aviso no console.

### Requisito 4: Storage_Index como Firewall Arquitetural

**User Story:** Como desenvolvedor, eu quero que o `storage/index.js` atue como firewall, importando adapters, validando o contrato e envolvendo cada função com logging centralizado, para que o resto da aplicação consuma uma interface limpa e observável.

#### Critérios de Aceitação

1. THE Storage_Index SHALL exportar apenas as funções `createLead`, `createClient`, `createOther` e `createAbandono` como interface pública.
2. THE Storage_Index SHALL importar o adapter selecionado pelo Config a partir do diretório `./adapters/`.
3. WHEN o Storage_Index carregar um adapter, THE Storage_Index SHALL validar que o adapter possui as funções `createLead`, `createClient`, `createOther` e `createAbandono`, lançando um erro descritivo caso alguma esteja ausente.
4. THE Storage_Index SHALL envolver (wrap) cada função do adapter com tratamento de erro centralizado que registra um log JSON contendo `adapter`, `operacao`, `request_id`, `identity_id`, `timestamp` e `erro`, e relança o erro original.
5. WHEN qualquer operação de persistência for concluída com sucesso, THE Storage_Index SHALL registrar um log JSON contendo `adapter`, `operacao`, `request_id`, `timestamp` e `resultado` ("ok").
6. THE Storage_Index SHALL registrar no console qual adapter está ativo durante a inicialização.
7. THE Storage_Index SHALL exportar `_getAll` e `_clear` do adapter Memory para uso em testes e no endpoint `/admin/sessions`.

### Requisito 5: Contrato do Adapter (Apenas Persistência)

**User Story:** Como desenvolvedor, eu quero que cada adapter implemente apenas funções de persistência, para que a responsabilidade de sessões permaneça exclusivamente no Session_Manager.

#### Critérios de Aceitação

1. THE Adapter SHALL implementar as funções assíncronas: `createLead(data)`, `createClient(data)`, `createOther(data)` e `createAbandono(data)`.
2. WHEN `createLead` for chamado com dados válidos, THE Adapter SHALL persistir o lead e retornar o `leadId` gerado.
3. WHEN `createClient` for chamado com dados válidos, THE Adapter SHALL persistir o registro de cliente e retornar o `leadId` gerado.
4. WHEN `createOther` for chamado com dados válidos, THE Adapter SHALL persistir o registro e retornar o `leadId` gerado.
5. WHEN `createAbandono` for chamado com dados válidos, THE Adapter SHALL persistir o registro de abandono com a classificação (PRECOCE, MEDIO ou VALIOSO).
6. THE Adapter SHALL aceitar campos opcionais ausentes sem lançar erro, utilizando `null` como valor padrão.
7. THE Adapter Memory SHALL manter as funções auxiliares `_clear` e `_getAll` para uso em testes.

### Requisito 6: Contratos de Payload por Tipo de Registro

**User Story:** Como desenvolvedor, eu quero que cada tipo de registro tenha uma estrutura de payload documentada com `identity_id` como identificador principal, para que todos os adapters recebam dados no mesmo formato.

#### Critérios de Aceitação

1. THE Storage_Index SHALL definir o contrato de Payload_Lead com os campos obrigatórios `identity_id` (string), `nome` (string) e `request_id` (string), e os campos opcionais `telefone` (string), `area` (string), `urgencia` (string), `score` (number), `prioridade` (string), `flagAtencao` (boolean), `canalOrigem` (string), `canalPreferido` (string), `resumo` (string) e `metadata` (object).
2. THE Storage_Index SHALL definir o contrato de Payload_Client com os campos obrigatórios `identity_id` (string), `nome` (string) e `request_id` (string), e os campos opcionais `telefone` (string), `urgencia` (string), `conteudo` (string), `canalOrigem` (string), `flagAtencao` (boolean) e `metadata` (object).
3. THE Storage_Index SHALL definir o contrato de Payload_Other com os campos obrigatórios `identity_id` (string), `nome` (string) e `request_id` (string), e os campos opcionais `telefone` (string), `tipo` (string), `conteudo` (string), `canalOrigem` (string) e `metadata` (object).
4. THE Storage_Index SHALL definir o contrato de Payload_Abandono com os campos obrigatórios `identity_id` (string), `fluxo` (string), `ultimoEstado` (string) e `request_id` (string), e os campos opcionais `score` (number), `prioridade` (string), `nome` (string), `canalOrigem` (string) e `mensagensEnviadas` (number).
5. WHEN um payload for recebido pelo Storage_Index sem um campo obrigatório, THE Storage_Index SHALL registrar um log de aviso e repassar ao adapter (validação na fronteira, não bloqueante dentro do adapter).
6. THE State_Machine SHALL gerar o `request_id` via `uuidv4()` na camada de decisão ANTES de chamar qualquer função de persistência — o adapter NUNCA gera `request_id`.

### Requisito 7: Eliminação do Vazamento de Importação no server.js

**User Story:** Como desenvolvedor, eu quero que o `server.js` importe `createAbandono` exclusivamente via `storage/index.js`, para que o padrão de adapter seja respeitado em toda a aplicação.

#### Critérios de Aceitação

1. THE server.js SHALL importar a função `createAbandono` a partir de `./src/storage` (Storage_Index) em vez de `./src/storage/googleSheets`.
2. WHEN o adapter ativo for "memory", THE server.js SHALL registrar abandonos via o adapter Memory através do Storage_Index.
3. WHEN o adapter ativo for "sheets", THE server.js SHALL registrar abandonos via o adapter Sheets através do Storage_Index.
4. THE server.js SHALL importar `_getAll` para o endpoint `/admin/sessions` a partir do Storage_Index em vez de importar diretamente de `./src/storage/inMemory`.

### Requisito 8: Reorganização dos Adapters em Diretório Dedicado

**User Story:** Como desenvolvedor, eu quero que os adapters estejam organizados em `src/storage/adapters/`, para que a estrutura do projeto reflita claramente a arquitetura de plugins.

#### Critérios de Aceitação

1. THE Storage_Index SHALL carregar adapters a partir dos módulos `./adapters/memory`, `./adapters/sheets` e `./adapters/supabase`.
2. WHEN o adapter Memory for movido para `src/storage/adapters/memory.js`, THE adapter Memory SHALL manter toda a funcionalidade existente de `src/storage/inMemory.js`, incluindo `_clear`, `_getAll`, `getSession` e `updateSession` (estas últimas consumidas diretamente pelo Session_Manager).
3. WHEN o adapter Sheets for movido para `src/storage/adapters/sheets.js`, THE adapter Sheets SHALL manter toda a funcionalidade de persistência existente de `src/storage/googleSheets.js`: `createLead`, `createClient`, `createOther` e `createAbandono`.

### Requisito 9: Sessões Permanecem no Session_Manager

**User Story:** Como desenvolvedor, eu quero que o gerenciamento de sessões permaneça exclusivamente no `sessionManager.js` usando o adapter Memory diretamente, para que não haja acoplamento errado entre sessões e adapters de persistência.

#### Critérios de Aceitação

1. THE Session_Manager SHALL importar `getSession` e `updateSession` diretamente do adapter Memory (`./storage/adapters/memory`) para operações de sessão.
2. THE Storage_Index SHALL exportar apenas funções de persistência (`createLead`, `createClient`, `createOther`, `createAbandono`), sem incluir `getSession` ou `updateSession`.
3. THE State_Machine SHALL continuar acessando sessões via Session_Manager, sem alteração na lógica existente.

### Requisito 10: Resiliência Diferenciada por Método de Storage

**User Story:** Como operador do sistema, eu quero que falhas de persistência sejam tratadas de forma diferenciada por método, para que a conversa nunca seja interrompida por erro de storage, exceto quando a resolução de identidade falhar.

#### Critérios de Aceitação

1. WHEN `resolveIdentity` falhar, THE Identity_Resolver SHALL lançar o erro (throw), bloqueando o fluxo — sem `identity_id` válido não existe sessão consistente.
2. IF `createLead` falhar durante a finalização do fluxo, THEN THE State_Machine SHALL registrar o erro no console em formato JSON contendo `request_id`, `identity_id` e `fn` ("createLead"), definir `session.persist_error = true` na sessão, e continuar o fluxo exibindo a mensagem de finalização ao usuário.
3. IF `createClient` falhar durante a finalização do fluxo, THEN THE State_Machine SHALL registrar o erro no console em formato JSON contendo `request_id`, `identity_id` e `fn` ("createClient"), definir `session.persist_error = true` na sessão, e continuar o fluxo exibindo a mensagem de finalização ao usuário.
4. IF `createOther` falhar durante a finalização do fluxo, THEN THE State_Machine SHALL registrar o erro no console em formato JSON contendo `request_id`, `identity_id` e `fn` ("createOther"), definir `session.persist_error = true` na sessão, e continuar o fluxo exibindo a mensagem de finalização ao usuário.
5. WHEN `createAbandono` falhar durante a varredura de TTL, THE Session_Manager SHALL registrar um log de warning contendo `request_id`, `identity_id` e `fn` ("createAbandono"), e ignorar o erro — abandono é evento não-crítico.
6. THE Storage_Index SHALL envolver (wrap) cada função do adapter com try/catch no `wrap()`, garantindo que erros de persistência sejam logados em formato JSON mas não propagados para a State_Machine (exceto `resolveIdentity`).

### Requisito 11: Limpeza de Sessões por TTL (Session Sweeper) com Abandono Restart-Safe

**User Story:** Como operador do sistema, eu quero que sessões inativas sejam automaticamente limpas da memória e que o registro de abandono sobreviva a reinícios do servidor, para evitar vazamento de memória e duplicação de abandonos.

#### Critérios de Aceitação

1. THE Session_Manager SHALL executar uma varredura periódica (sweep) a cada 30 minutos para identificar sessões inativas.
2. WHEN uma sessão estiver inativa por mais de 60 minutos (baseado no campo `atualizadoEm`) e o campo `statusSessao` for diferente de "ABANDONOU", THE Session_Manager SHALL persistir a sessão como abandono via `storage.createAbandono()`, marcar `statusSessao` como "ABANDONOU" e em seguida remover a sessão da memória.
3. WHILE uma sessão estiver em um estado final (`pos_final`, `encerramento`, `final_lead`, `final_cliente`), THE Session_Manager SHALL ignorar a sessão durante a varredura de TTL.
4. WHILE uma sessão tiver `statusSessao` igual a "ABANDONOU", THE Session_Manager SHALL ignorar a sessão durante a varredura de TTL.
5. IF a persistência do abandono falhar durante a varredura, THEN THE Session_Manager SHALL registrar o erro no console e manter a sessão na memória para nova tentativa no próximo ciclo.
6. THE Adapter Supabase SHALL utilizar idempotência na tabela `abandonos` (via `request_id` ou constraint UNIQUE em `identity_id` + `ultimoEstado` + janela temporal) para evitar duplicação de abandonos causada por reinício do servidor.

### Requisito 12: Adapter Supabase em Shadow Mode

**User Story:** Como desenvolvedor, eu quero construir o adapter Supabase sem substituir o Google Sheets em produção, para validar a integração com PostgreSQL antes da migração.

#### Critérios de Aceitação

1. THE Adapter Supabase SHALL implementar as funções de persistência do contrato: `createLead`, `createClient`, `createOther` e `createAbandono`.
2. THE Adapter Supabase SHALL persistir dados nas 5 tabelas relacionais: `identities`, `identity_channels`, `leads`, `clients`, `others` e `abandonos`.
3. WHILE `STORAGE_ADAPTER` estiver definido como "sheets", THE Storage_Index SHALL continuar usando o adapter Sheets, sem carregar o adapter Supabase.
4. THE Adapter Supabase SHALL utilizar variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_KEY`) para configuração de conexão, sem valores hardcoded.
5. WHEN o adapter Supabase for validado em isolamento, THE operador SHALL trocar `STORAGE_ADAPTER` de "sheets" para "supabase" e reiniciar o servidor, sem nenhuma alteração de código.

### Requisito 13: Idempotência Forte no Supabase com request_id Externo

**User Story:** Como operador do sistema, eu quero que o adapter Supabase evite registros duplicados causados por retries, mensagens duplicadas do Telegram/WhatsApp, ou reinícios do servidor, para manter a integridade dos dados no PostgreSQL.

#### Critérios de Aceitação

1. THE State_Machine SHALL gerar o `request_id` via `uuidv4()` na camada de decisão (stateMachine ou entry point) ANTES de chamar qualquer função de persistência, e incluir o `request_id` no payload enviado ao Storage_Index.
2. THE Adapter SHALL receber o `request_id` como parte do payload — o adapter NUNCA gera `request_id` internamente.
3. THE Adapter Supabase SHALL utilizar constraint UNIQUE em `(channel, channel_user_id)` na tabela `identity_channels` para evitar duplicação de vínculos canal-identidade.
4. THE Adapter Supabase SHALL definir a coluna `request_id` como `TEXT UNIQUE NOT NULL` nas tabelas `leads`, `clients` e `others` para deduplicação.
5. THE Adapter Supabase SHALL definir a coluna `request_id` como `TEXT NOT NULL` (sem UNIQUE) na tabela `abandonos` — um mesmo usuário pode abandonar, retornar e abandonar novamente em estados diferentes, gerando registros legítimos distintos.
6. THE Adapter Supabase SHALL utilizar constraint `UNIQUE(identity_id, ultimo_estado)` na tabela `abandonos` para idempotência de abandonos no mesmo estado.
7. WHEN `createLead` for chamado com um `request_id` que já existe na tabela `leads`, THE Adapter Supabase SHALL utilizar `ON CONFLICT DO NOTHING` e retornar o `leadId` existente sem criar um novo registro.
8. WHEN `createClient` for chamado com um `request_id` que já existe na tabela `clients`, THE Adapter Supabase SHALL utilizar `ON CONFLICT DO NOTHING` e retornar o `leadId` existente sem criar um novo registro.
9. WHEN `createOther` for chamado com um `request_id` que já existe na tabela `others`, THE Adapter Supabase SHALL utilizar `ON CONFLICT DO NOTHING` e retornar o `leadId` existente sem criar um novo registro.
10. WHEN `createAbandono` for chamado com `identity_id` e `ultimo_estado` que já existem na tabela `abandonos`, THE Adapter Supabase SHALL utilizar `ON CONFLICT (identity_id, ultimo_estado) DO NOTHING` sem criar registro duplicado.
11. THE Adapter Memory e THE Adapter Sheets NÃO SHALL implementar lógica de idempotência — duplicatas são aceitas nesses backends.

### Requisito 14: Migração Zero-Downtime

**User Story:** Como operador do sistema, eu quero que a troca de adapter seja feita apenas alterando a variável de ambiente e reiniciando, para que a migração não exija mudanças de código.

#### Critérios de Aceitação

1. WHEN a variável `STORAGE_ADAPTER` for alterada de "sheets" para "supabase" e o servidor for reiniciado, THE Storage_Index SHALL rotear todas as chamadas de persistência para o adapter Supabase sem alterações no código-fonte.
2. THE State_Machine SHALL continuar chamando `storage.createLead(data)`, `storage.createClient(data)` e `storage.createOther(data)` sem nenhuma modificação.
3. THE Storage_Index SHALL registrar no console qual adapter está ativo durante a inicialização do servidor.

### Requisito 15: Integridade da State Machine

**User Story:** Como desenvolvedor, eu quero garantir que nenhuma alteração seja feita na lógica da `stateMachine.js` durante a refatoração, para que a árvore de decisão jurídica permaneça intacta.

#### Critérios de Aceitação

1. THE State_Machine SHALL continuar importando o módulo de storage exclusivamente via `require('./storage')`.
2. THE State_Machine SHALL manter todas as transições de estado, cálculos de score e lógica de prioridade inalterados após a refatoração.
3. WHEN a refatoração do storage for concluída, THE State_Machine SHALL passar em todos os testes existentes em `tests/stateMachine.test.js` sem modificações nos testes.
