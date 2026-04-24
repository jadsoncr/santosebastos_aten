# Tarefas — BRO Resolve Base (Spec 1/4)

- [x] 1. Criar migração SQL completa
  - [x] 1.1 Criar diretório `sql/migrations/` e arquivo `001_bro_resolve_base.sql`
  - [x] 1.2 Adicionar ALTER TABLE leads com colunas `area_bot`, `area_humano`, `corrigido`
  - [x] 1.3 Adicionar UPDATE backfill `area_bot = area WHERE area_bot IS NULL` com comentário sobre batching
  - [x] 1.4 Criar tabela `atendimentos` com UNIQUE(lead_id), FKs para leads e auth.users
  - [x] 1.5 Criar tabela `pot_tratamento` com FKs para leads e auth.users
  - [x] 1.6 Criar tabela `solicitacoes_clientes` com FK para identities
  - [x] 1.7 Criar tabela `quick_replies` com `compartilhado DEFAULT true`, FK para auth.users
  - [x] 1.8 Criar tabela `bot_feedback` com FKs para leads e auth.users
  - [x] 1.9 Habilitar RLS e criar políticas (service_role full, authenticated read) em todas as tabelas novas
  - [x] 1.10 Habilitar RLS e criar políticas nas tabelas existentes do bot (leads, clients, others, abandonos, identities, identity_channels) com IF NOT EXISTS
  - [x] 1.11 Criar índices de performance em todas as tabelas novas

- [x] 2. Criar projeto Next.js em web/ com TypeScript + Tailwind
  - [x] 2.1 Criar `web/package.json` com dependências: next@14, react@18, typescript, tailwindcss, @supabase/supabase-js, @supabase/ssr
  - [x] 2.2 Criar `web/tsconfig.json` com strict mode e path alias `@/*`
  - [x] 2.3 Criar `web/tailwind.config.ts` com tokens de branding BRO Resolve (cores, fontes)
  - [x] 2.4 Criar `web/next.config.mjs`
  - [x] 2.5 Criar `web/app/globals.css` com variáveis CSS de branding e imports Tailwind
  - [x] 2.6 Criar `web/app/layout.tsx` (root layout) com Google Fonts (Syne, JetBrains Mono, Inter) e metadata
  - [x] 2.7 Criar `web/.env.local.example` com as 3 variáveis documentadas
  - [x] 2.8 Criar `web/.gitignore` incluindo `.env.local`, `node_modules/`, `.next/`

- [x] 3. Configurar cliente Supabase (browser + server) e middleware
  - [x] 3.1 Criar `web/utils/supabase/client.ts` com createBrowserClient
  - [x] 3.2 Criar `web/utils/supabase/server.ts` com createServerClient + cookies
  - [x] 3.3 Criar `web/utils/supabase/middleware.ts` com updateSession helper (refresh cookies, redirect não-autenticado, check owner-only)
  - [x] 3.4 Criar `web/middleware.ts` com matcher excluindo arquivos estáticos

- [x] 4. Criar página de login com branding BRO Resolve
  - [x] 4.1 Criar `web/app/(auth)/login/page.tsx` com formulário email + senha
  - [x] 4.2 Implementar signInWithPassword via Supabase Auth
  - [x] 4.3 Aplicar branding: bg #080808, Syne 700 para título, accent #00e87a, texto #f0f0f0
  - [x] 4.4 Implementar mensagem de erro genérica (não revelar se email existe)
  - [x] 4.5 Redirect para /tela1 após login bem-sucedido

- [x] 5. Criar layout do dashboard (sidebar + header + auth guard)
  - [x] 5.1 Criar `web/components/Sidebar.tsx` com links: Tela 1, Tela 2, Financeiro (condicional por role)
  - [x] 5.2 Criar `web/components/Header.tsx` com nome do usuário, badge de role e botão logout
  - [x] 5.3 Criar `web/app/(dashboard)/layout.tsx` integrando Sidebar + Header + auth guard server-side
  - [x] 5.4 Criar `web/app/(dashboard)/page.tsx` com redirect automático para /tela1

- [x] 6. Criar páginas placeholder
  - [x] 6.1 Criar `web/app/(dashboard)/tela1/page.tsx` — placeholder "Tela 1 — Em construção"
  - [x] 6.2 Criar `web/app/(dashboard)/tela2/page.tsx` — placeholder "Tela 2 — Em construção"
  - [x] 6.3 Criar `web/app/(dashboard)/financeiro/page.tsx` — placeholder "Financeiro — Em construção" (owner-only)
