# Documento de Requisitos — BRO Resolve Base (Spec 1/4)

## Introdução

Este documento define os requisitos para a fundação da plataforma web BRO Resolve, o painel operacional do escritório Santos & Bastos Advogados. O bot de qualificação de leads já opera via Telegram/WhatsApp e persiste dados no Supabase (6 tabelas: `identities`, `identity_channels`, `leads`, `clients`, `others`, `abandonos`). Esta spec cobre exclusivamente:

1. Migrações de banco de dados (novas tabelas + políticas RLS)
2. Criação do projeto Next.js 14 com TypeScript + Tailwind em `web/`
3. Configuração do cliente Supabase + middleware de autenticação
4. Página de login com branding BRO Resolve + layout do dashboard

Stack: Next.js 14 App Router, TypeScript strict, Supabase Auth (@supabase/ssr), Tailwind CSS, deploy na Vercel.

Princípios:
- O projeto web vive em `web/` — separado do bot. O repositório do bot permanece intacto (exceto `sql/schema.sql` para referência de migrações).
- `SUPABASE_SERVICE_ROLE_KEY` NUNCA é exposto ao client-side — apenas server components e middleware.
- RLS habilitado em todas as tabelas novas. `service_role` tem acesso total; `authenticated` tem acesso de leitura restrito.
- Middleware protege TODAS as rotas do dashboard — usuários não autenticados são redirecionados para `/login`.
- Rotas owner-only (ex: `/financeiro`) são bloqueadas para usuários com role `operador`.

## Glossário

- **Plataforma_Web**: Aplicação Next.js 14 localizada em `web/` que serve como painel operacional do BRO Resolve. Consome dados do Supabase e oferece interface para operadores e owners gerenciarem leads, atendimentos e tratamentos.
- **Supabase_Client_Browser**: Módulo `web/utils/supabase/client.ts` que cria uma instância do cliente Supabase para uso em Client Components do Next.js, utilizando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Supabase_Client_Server**: Módulo `web/utils/supabase/server.ts` que cria uma instância do cliente Supabase para uso em Server Components e Route Handlers, acessando cookies para manter a sessão do usuário.
- **Auth_Middleware**: Módulo `web/middleware.ts` que intercepta todas as requisições, atualiza a sessão Supabase via refresh de cookies, e redireciona usuários não autenticados para `/login`.
- **Tabela_Atendimentos**: Tabela `atendimentos` que registra a assunção de um lead por um operador. Possui constraint `UNIQUE(lead_id)` para garantir assunção atômica — um lead pertence a no máximo um operador.
- **Tabela_Pot_Tratamento**: Tabela `pot_tratamento` (Pote de Tratamento) que registra o acompanhamento de leads em tratamento, incluindo próxima ação, valor estimado, valor confirmado e status financeiro.
- **Tabela_Solicitacoes_Clientes**: Tabela `solicitacoes_clientes` que registra solicitações de clientes existentes, categorizadas pelo bot e opcionalmente corrigidas por operador humano.
- **Tabela_Quick_Replies**: Tabela `quick_replies` que armazena atalhos de resposta rápida para operadores, com campo `compartilhado` para visibilidade entre equipe.
- **Tabela_Bot_Feedback**: Tabela `bot_feedback` que registra correções de classificação feitas por operadores humanos sobre a área jurídica atribuída pelo bot, alimentando melhoria contínua.
- **RLS**: Row Level Security do PostgreSQL. Políticas que controlam acesso a linhas de tabelas com base no role do usuário (`service_role`, `authenticated`, `anon`).
- **Owner**: Usuário com role `owner` no sistema. Tem acesso a todas as rotas, incluindo `/financeiro`.
- **Operador**: Usuário com role `operador` no sistema. Tem acesso às telas operacionais mas NÃO tem acesso a rotas owner-only como `/financeiro`.
- **Login_Page**: Página de autenticação em `web/app/(auth)/login/page.tsx` com email + senha via Supabase Auth e branding BRO Resolve.
- **Dashboard_Layout**: Layout compartilhado em `web/app/(dashboard)/layout.tsx` que inclui sidebar, header com nome do usuário e badge de role, e guard de autenticação.
- **Coluna_Area_Bot**: Coluna `area_bot` adicionada à tabela `leads` que preserva a classificação original feita pelo bot, separada da classificação humana (`area_humano`).
- **Coluna_Area_Humano**: Coluna `area_humano` adicionada à tabela `leads` que armazena a correção de área feita por operador humano.
- **Coluna_Corrigido**: Coluna `corrigido` (boolean) adicionada à tabela `leads` que indica se a classificação de área foi corrigida por um operador.

## Requisitos

### Requisito 1: Migração — Ajuste da Tabela Leads Existente

**User Story:** Como operador, eu quero que a tabela de leads preserve a classificação original do bot separada da correção humana, para que o feedback alimente a melhoria contínua do bot.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL adicionar a coluna `area_bot` (TEXT, nullable) à tabela `leads` via migração SQL usando `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
2. THE Plataforma_Web SHALL adicionar a coluna `area_humano` (TEXT, nullable) à tabela `leads` via migração SQL usando `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
3. THE Plataforma_Web SHALL adicionar a coluna `corrigido` (BOOLEAN, DEFAULT false) à tabela `leads` via migração SQL usando `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
4. WHEN a migração for executada em uma base com leads existentes, THE Plataforma_Web SHALL copiar o valor da coluna `area` para `area_bot` em todos os registros onde `area_bot` for NULL, preservando dados históricos.

### Requisito 2: Migração — Tabela Atendimentos

**User Story:** Como operador, eu quero assumir leads de forma atômica, para que dois operadores não assumam o mesmo lead simultaneamente.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL criar a tabela `atendimentos` com os campos: `id` (UUID, PK, DEFAULT gen_random_uuid()), `lead_id` (UUID, FK para `leads`, UNIQUE, NOT NULL), `owner_id` (UUID, FK para `auth.users`, NOT NULL), `delegado_de` (UUID, FK para `auth.users`, nullable), `status` (TEXT, DEFAULT 'aberto'), `classificacao_entrada` (TEXT, nullable), `classificacao_final` (TEXT, nullable), `valor_estimado` (NUMERIC, nullable), `assumido_em` (TIMESTAMPTZ, DEFAULT now()), `encerrado_em` (TIMESTAMPTZ, nullable).
2. THE Plataforma_Web SHALL definir constraint `UNIQUE(lead_id)` na tabela `atendimentos` para garantir que cada lead seja assumido por no máximo um operador (assunção atômica).
3. THE Plataforma_Web SHALL habilitar RLS na tabela `atendimentos`.
4. THE Plataforma_Web SHALL criar política RLS que conceda acesso total (SELECT, INSERT, UPDATE, DELETE) ao role `service_role` na tabela `atendimentos`.
5. THE Plataforma_Web SHALL criar política RLS que conceda acesso de leitura (SELECT) ao role `authenticated` na tabela `atendimentos`.

### Requisito 3: Migração — Tabela Pot Tratamento

**User Story:** Como operador, eu quero registrar o acompanhamento de leads em tratamento com próxima ação e valores, para gerenciar o pipeline de conversão.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL criar a tabela `pot_tratamento` com os campos: `id` (UUID, PK, DEFAULT gen_random_uuid()), `lead_id` (UUID, FK para `leads`, NOT NULL), `operador_id` (UUID, FK para `auth.users`, NOT NULL), `proxima_acao` (TEXT, nullable), `data_acao` (TIMESTAMPTZ, nullable), `observacao` (TEXT, nullable), `valor_estimado` (NUMERIC, nullable), `valor_confirmado` (NUMERIC, nullable), `data_recebimento` (TIMESTAMPTZ, nullable), `status_financeiro` (TEXT, nullable), `status` (TEXT, DEFAULT 'ativo'), `created_at` (TIMESTAMPTZ, DEFAULT now()).
2. THE Plataforma_Web SHALL habilitar RLS na tabela `pot_tratamento`.
3. THE Plataforma_Web SHALL criar política RLS que conceda acesso total ao role `service_role` na tabela `pot_tratamento`.
4. THE Plataforma_Web SHALL criar política RLS que conceda acesso de leitura (SELECT) ao role `authenticated` na tabela `pot_tratamento`.

### Requisito 4: Migração — Tabela Solicitações de Clientes

**User Story:** Como operador, eu quero visualizar solicitações de clientes existentes categorizadas pelo bot, para priorizar atendimento e corrigir classificações quando necessário.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL criar a tabela `solicitacoes_clientes` com os campos: `id` (UUID, PK, DEFAULT gen_random_uuid()), `identity_id` (UUID, FK para `identities`, NOT NULL), `mensagem` (TEXT, nullable), `categoria` (TEXT, nullable), `categoria_humano` (TEXT, nullable), `status` (TEXT, DEFAULT 'pendente'), `created_at` (TIMESTAMPTZ, DEFAULT now()).
2. THE Plataforma_Web SHALL habilitar RLS na tabela `solicitacoes_clientes`.
3. THE Plataforma_Web SHALL criar política RLS que conceda acesso total ao role `service_role` na tabela `solicitacoes_clientes`.
4. THE Plataforma_Web SHALL criar política RLS que conceda acesso de leitura (SELECT) ao role `authenticated` na tabela `solicitacoes_clientes`.

### Requisito 5: Migração — Tabela Quick Replies

**User Story:** Como operador, eu quero salvar atalhos de resposta rápida, para agilizar o atendimento com mensagens padronizadas.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL criar a tabela `quick_replies` com os campos: `id` (UUID, PK, DEFAULT gen_random_uuid()), `atalho` (TEXT, UNIQUE, NOT NULL), `conteudo` (TEXT, NOT NULL), `criado_por` (UUID, FK para `auth.users`, NOT NULL), `compartilhado` (BOOLEAN, DEFAULT true), `created_at` (TIMESTAMPTZ, DEFAULT now()).
2. THE Plataforma_Web SHALL habilitar RLS na tabela `quick_replies`.
3. THE Plataforma_Web SHALL criar política RLS que conceda acesso total ao role `service_role` na tabela `quick_replies`.
4. THE Plataforma_Web SHALL criar política RLS que conceda acesso de leitura (SELECT) ao role `authenticated` na tabela `quick_replies`.

### Requisito 6: Migração — Tabela Bot Feedback

**User Story:** Como operador, eu quero registrar correções na classificação de área feita pelo bot, para que o sistema aprenda com os erros e melhore a precisão.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL criar a tabela `bot_feedback` com os campos: `id` (UUID, PK, DEFAULT gen_random_uuid()), `lead_id` (UUID, FK para `leads`, NOT NULL), `area_bot` (TEXT, NOT NULL), `area_humano` (TEXT, NOT NULL), `operador_id` (UUID, FK para `auth.users`, NOT NULL), `created_at` (TIMESTAMPTZ, DEFAULT now()).
2. THE Plataforma_Web SHALL habilitar RLS na tabela `bot_feedback`.
3. THE Plataforma_Web SHALL criar política RLS que conceda acesso total ao role `service_role` na tabela `bot_feedback`.
4. THE Plataforma_Web SHALL criar política RLS que conceda acesso de leitura (SELECT) ao role `authenticated` na tabela `bot_feedback`.

### Requisito 7: Projeto Next.js 14 com TypeScript e Tailwind

**User Story:** Como desenvolvedor, eu quero um projeto Next.js 14 configurado com App Router, TypeScript strict e Tailwind CSS no diretório `web/`, para servir como base da plataforma BRO Resolve separada do bot.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL residir no diretório `web/` na raiz do repositório, separada do código do bot.
2. THE Plataforma_Web SHALL utilizar Next.js 14 com App Router como framework.
3. THE Plataforma_Web SHALL utilizar TypeScript com modo strict habilitado no `tsconfig.json`.
4. THE Plataforma_Web SHALL utilizar Tailwind CSS para estilização.
5. THE Plataforma_Web SHALL incluir `@supabase/supabase-js` e `@supabase/ssr` como dependências.
6. THE Plataforma_Web SHALL incluir um arquivo `.env.local.example` documentando as variáveis de ambiente necessárias: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

### Requisito 8: Configuração do Cliente Supabase (Browser e Server)

**User Story:** Como desenvolvedor, eu quero clientes Supabase configurados para browser e server, para que componentes client-side e server-side acessem o Supabase com o contexto de autenticação correto.

#### Critérios de Aceitação

1. THE Supabase_Client_Browser SHALL criar uma instância do cliente Supabase utilizando `createBrowserClient` do `@supabase/ssr` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. THE Supabase_Client_Server SHALL criar uma instância do cliente Supabase utilizando `createServerClient` do `@supabase/ssr` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, acessando cookies do Next.js para manter a sessão.
3. THE Supabase_Client_Browser SHALL residir em `web/utils/supabase/client.ts`.
4. THE Supabase_Client_Server SHALL residir em `web/utils/supabase/server.ts`.
5. THE Plataforma_Web SHALL garantir que `SUPABASE_SERVICE_ROLE_KEY` não seja importada nem referenciada em nenhum módulo client-side — apenas em server components, route handlers e middleware.

### Requisito 9: Middleware de Autenticação e Proteção de Rotas

**User Story:** Como owner do escritório, eu quero que todas as rotas do dashboard sejam protegidas por autenticação e que rotas financeiras sejam restritas a owners, para garantir segurança e controle de acesso.

#### Critérios de Aceitação

1. THE Auth_Middleware SHALL interceptar todas as requisições e atualizar a sessão Supabase via refresh de cookies utilizando `@supabase/ssr`.
2. WHEN um usuário não autenticado acessar qualquer rota exceto `/login`, THE Auth_Middleware SHALL redirecionar o usuário para `/login`.
3. WHEN um usuário autenticado acessar `/login`, THE Auth_Middleware SHALL redirecionar o usuário para `/tela1`.
4. THE Auth_Middleware SHALL residir em `web/middleware.ts` com helper em `web/utils/supabase/middleware.ts`.
5. WHEN um usuário com role `operador` acessar uma rota owner-only (ex: `/financeiro`), THE Auth_Middleware SHALL redirecionar o usuário para `/tela1`.
6. THE Auth_Middleware SHALL utilizar o matcher do Next.js para excluir arquivos estáticos (`_next/static`, `_next/image`, `favicon.ico`) do processamento de middleware.

### Requisito 10: Página de Login com Branding BRO Resolve

**User Story:** Como operador, eu quero uma página de login com a identidade visual do BRO Resolve, para acessar a plataforma de forma segura e profissional.

#### Critérios de Aceitação

1. THE Login_Page SHALL residir em `web/app/(auth)/login/page.tsx`.
2. THE Login_Page SHALL apresentar campos de email e senha para autenticação via Supabase Auth (`signInWithPassword`).
3. WHEN o usuário submeter credenciais válidas, THE Login_Page SHALL redirecionar o usuário para `/tela1`.
4. IF o usuário submeter credenciais inválidas, THEN THE Login_Page SHALL exibir uma mensagem de erro descritiva sem revelar se o email existe no sistema.
5. THE Login_Page SHALL utilizar o branding BRO Resolve: background `#080808`, fonte display Syne 700, fonte mono JetBrains Mono, accent green `#00e87a`, texto primário `#f0f0f0`, texto muted `#555`.
6. THE Login_Page SHALL exibir o logotipo ou nome "BRO Resolve" de forma proeminente.

### Requisito 11: Layout do Dashboard com Sidebar e Header

**User Story:** Como operador, eu quero um layout de dashboard com sidebar de navegação e header com informações do usuário, para navegar entre as telas da plataforma de forma intuitiva.

#### Critérios de Aceitação

1. THE Dashboard_Layout SHALL residir em `web/app/(dashboard)/layout.tsx` e envolver todas as páginas do dashboard.
2. THE Dashboard_Layout SHALL incluir uma sidebar com links de navegação para: Tela 1, Tela 2 e Financeiro.
3. WHEN o usuário autenticado tiver role `operador`, THE Dashboard_Layout SHALL ocultar o link "Financeiro" da sidebar.
4. THE Dashboard_Layout SHALL incluir um header exibindo o nome do usuário autenticado, um badge indicando o role (owner ou operador) e um botão de logout.
5. WHEN o usuário clicar no botão de logout, THE Dashboard_Layout SHALL encerrar a sessão Supabase e redirecionar o usuário para `/login`.
6. THE Plataforma_Web SHALL criar uma página em `web/app/(dashboard)/page.tsx` que redirecione automaticamente para `/tela1`.
7. THE Plataforma_Web SHALL criar uma página placeholder em `web/app/(dashboard)/tela1/page.tsx` para servir como destino padrão após login.

### Requisito 12: Variáveis de Ambiente e Segurança

**User Story:** Como desenvolvedor, eu quero que as variáveis de ambiente estejam documentadas e que chaves sensíveis sejam protegidas, para garantir configuração correta e segurança em todos os ambientes.

#### Critérios de Aceitação

1. THE Plataforma_Web SHALL utilizar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` como variáveis públicas acessíveis no browser.
2. THE Plataforma_Web SHALL utilizar `SUPABASE_SERVICE_ROLE_KEY` como variável server-only, sem o prefixo `NEXT_PUBLIC_`.
3. IF `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` não estiverem definidas no ambiente, THEN THE Plataforma_Web SHALL falhar na inicialização com mensagem de erro descritiva.
4. THE Plataforma_Web SHALL incluir `web/.env.local` no `.gitignore` para evitar commit acidental de credenciais.
