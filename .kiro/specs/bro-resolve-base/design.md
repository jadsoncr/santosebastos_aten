# Design — BRO Resolve Base (Spec 1/4)

## 1. Estrutura de Arquivos

```
web/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # redirect → /tela1
│   │   ├── tela1/
│   │   │   └── page.tsx          # placeholder
│   │   ├── tela2/
│   │   │   └── page.tsx          # placeholder
│   │   └── financeiro/
│   │       └── page.tsx          # placeholder (owner-only)
│   ├── layout.tsx                # root layout (fonts, globals)
│   └── globals.css
├── components/
│   ├── Sidebar.tsx
│   └── Header.tsx
├── utils/
│   └── supabase/
│       ├── client.ts             # browser client
│       ├── server.ts             # server client
│       └── middleware.ts         # helper updateSession
├── middleware.ts                  # Next.js middleware entry
├── tailwind.config.ts
├── tsconfig.json
├── next.config.mjs
├── package.json
├── .env.local.example
└── .gitignore

sql/
└── migrations/
    └── 001_bro_resolve_base.sql  # migração completa
```

## 2. Migração SQL Completa

Arquivo: `sql/migrations/001_bro_resolve_base.sql`

```sql
-- ============================================================
-- BRO Resolve Base — Migração 001
-- Rodar no SQL Editor do Supabase (ou via psql)
-- ============================================================

-- ── 1. Ajuste tabela leads existente ────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_bot TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_humano TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS corrigido BOOLEAN DEFAULT false;

-- Backfill: copiar area → area_bot onde ainda não preenchido
-- NOTA: Em bases grandes no free tier, considerar rodar em batches
-- com LIMIT (ex: UPDATE leads SET area_bot = area WHERE area_bot IS NULL LIMIT 1000)
UPDATE leads SET area_bot = area WHERE area_bot IS NULL;

-- ── 2. Tabela atendimentos ──────────────────────────────────
CREATE TABLE IF NOT EXISTS atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  delegado_de UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'aberto',
  classificacao_entrada TEXT,
  classificacao_final TEXT,
  valor_estimado NUMERIC,
  assumido_em TIMESTAMPTZ DEFAULT now(),
  encerrado_em TIMESTAMPTZ,
  UNIQUE(lead_id)
);

ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_atendimentos" ON atendimentos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_atendimentos" ON atendimentos
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_atendimentos_lead ON atendimentos(lead_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_owner ON atendimentos(owner_id);

-- ── 3. Tabela pot_tratamento ────────────────────────────────
CREATE TABLE IF NOT EXISTS pot_tratamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  operador_id UUID NOT NULL REFERENCES auth.users(id),
  proxima_acao TEXT,
  data_acao TIMESTAMPTZ,
  observacao TEXT,
  valor_estimado NUMERIC,
  valor_confirmado NUMERIC,
  data_recebimento TIMESTAMPTZ,
  status_financeiro TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pot_tratamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_pot_tratamento" ON pot_tratamento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_pot_tratamento" ON pot_tratamento
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pot_tratamento_lead ON pot_tratamento(lead_id);

-- ── 4. Tabela solicitacoes_clientes ─────────────────────────
CREATE TABLE IF NOT EXISTS solicitacoes_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id),
  mensagem TEXT,
  categoria TEXT,
  categoria_humano TEXT,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE solicitacoes_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_solicitacoes" ON solicitacoes_clientes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_solicitacoes" ON solicitacoes_clientes
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_identity ON solicitacoes_clientes(identity_id);

-- ── 5. Tabela quick_replies ─────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atalho TEXT UNIQUE NOT NULL,
  conteudo TEXT NOT NULL,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  compartilhado BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_quick_replies" ON quick_replies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_quick_replies" ON quick_replies
  FOR SELECT TO authenticated USING (true);

-- ── 6. Tabela bot_feedback ──────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  area_bot TEXT NOT NULL,
  area_humano TEXT NOT NULL,
  operador_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_bot_feedback" ON bot_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_bot_feedback" ON bot_feedback
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bot_feedback_lead ON bot_feedback(lead_id);

-- ── 7. RLS nas tabelas existentes do bot (se ainda não habilitado) ──
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE others ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_channels ENABLE ROW LEVEL SECURITY;

-- Políticas para tabelas existentes (leitura para authenticated)
DO $$
BEGIN
  -- leads
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'service_role_full_leads') THEN
    EXECUTE 'CREATE POLICY "service_role_full_leads" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'authenticated_read_leads') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_leads" ON leads FOR SELECT TO authenticated USING (true)';
  END IF;
  -- clients
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'service_role_full_clients') THEN
    EXECUTE 'CREATE POLICY "service_role_full_clients" ON clients FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'authenticated_read_clients') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_clients" ON clients FOR SELECT TO authenticated USING (true)';
  END IF;
  -- others
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'others' AND policyname = 'service_role_full_others') THEN
    EXECUTE 'CREATE POLICY "service_role_full_others" ON others FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'others' AND policyname = 'authenticated_read_others') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_others" ON others FOR SELECT TO authenticated USING (true)';
  END IF;
  -- abandonos
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abandonos' AND policyname = 'service_role_full_abandonos') THEN
    EXECUTE 'CREATE POLICY "service_role_full_abandonos" ON abandonos FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abandonos' AND policyname = 'authenticated_read_abandonos') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_abandonos" ON abandonos FOR SELECT TO authenticated USING (true)';
  END IF;
  -- identities
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'identities' AND policyname = 'service_role_full_identities') THEN
    EXECUTE 'CREATE POLICY "service_role_full_identities" ON identities FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'identities' AND policyname = 'authenticated_read_identities') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_identities" ON identities FOR SELECT TO authenticated USING (true)';
  END IF;
  -- identity_channels
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'identity_channels' AND policyname = 'service_role_full_identity_channels') THEN
    EXECUTE 'CREATE POLICY "service_role_full_identity_channels" ON identity_channels FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'identity_channels' AND policyname = 'authenticated_read_identity_channels') THEN
    EXECUTE 'CREATE POLICY "authenticated_read_identity_channels" ON identity_channels FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;
```

## 3. Setup do Cliente Supabase

### 3.1 Browser Client (`web/utils/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 3.2 Server Client (`web/utils/supabase/server.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll chamado de Server Component — ignorar
          }
        },
      },
    }
  )
}
```

### 3.3 Middleware Helper (`web/utils/supabase/middleware.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const OWNER_ONLY_ROUTES = ['/financeiro']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Não autenticado → redirecionar para /login
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Autenticado acessando /login → redirecionar para /tela1
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/tela1'
    return NextResponse.redirect(url)
  }

  // Checar rotas owner-only
  if (user && OWNER_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
    const role = user.user_metadata?.role || 'operador'
    if (role !== 'owner') {
      const url = request.nextUrl.clone()
      url.pathname = '/tela1'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
```

### 3.4 Middleware Entry (`web/middleware.ts`)

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

## 4. Fluxo de Autenticação

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Usuário     │────▶│  middleware   │────▶│  Supabase Auth  │
│  acessa URL  │     │  .ts         │     │  (getUser)      │
└─────────────┘     └──────┬───────┘     └────────┬────────┘
                           │                       │
                    ┌──────▼───────┐        ┌──────▼────────┐
                    │ Tem sessão?  │        │ Refresh token │
                    └──────┬───────┘        │ via cookies   │
                           │                └───────────────┘
                    ┌──────▼───────┐
              NÃO   │              │  SIM
           ┌────────┤              ├────────┐
           │        └──────────────┘        │
    ┌──────▼───────┐              ┌─────────▼──────────┐
    │ Redirect     │              │ Checar role         │
    │ → /login     │              │ (user_metadata)     │
    └──────────────┘              └─────────┬──────────┘
                                            │
                                  ┌─────────▼──────────┐
                                  │ Rota owner-only?    │
                                  └─────────┬──────────┘
                                     SIM    │    NÃO
                              ┌─────────────┤────────────┐
                              │             │            │
                       ┌──────▼──────┐      │     ┌──────▼──────┐
                       │ role=owner? │      │     │ Permitir    │
                       └──────┬──────┘      │     │ acesso      │
                        NÃO   │  SIM        │     └─────────────┘
                    ┌─────────┤──────┐      │
                    │         │      │      │
             ┌──────▼──────┐  │  ┌───▼──────▼──┐
             │ Redirect    │  │  │ Permitir     │
             │ → /tela1    │  │  │ acesso       │
             └─────────────┘  │  └──────────────┘
                              │
                       ┌──────▼──────┐
                       │ Permitir    │
                       │ acesso      │
                       └─────────────┘
```

### Login Flow

1. Usuário acessa `/login`
2. Preenche email + senha
3. `signInWithPassword` via Supabase Auth
4. Sucesso → redirect `/tela1`
5. Erro → mensagem genérica (não revela se email existe)

### Logout Flow

1. Usuário clica "Sair" no Header
2. `supabase.auth.signOut()`
3. Redirect → `/login`

## 5. Layout do Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────────────┐│
│ │          │ │  HEADER                                  ││
│ │          │ │  [BRO Resolve]    João Silva  owner  Sair││
│ │ SIDEBAR  │ ├──────────────────────────────────────────┤│
│ │          │ │                                          ││
│ │ Tela 1   │ │                                          ││
│ │ Tela 2   │ │           CONTEÚDO DA PÁGINA             ││
│ │ ────────── │ │           (children)                     ││
│ │ Financeiro│ │                                          ││
│ │ (owner)  │ │                                          ││
│ │          │ │                                          ││
│ └──────────┘ └──────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

- Sidebar: fixa à esquerda, 240px, bg `#111`
- Header: topo, altura 56px, bg `#111`, borda inferior `#222`
- Conteúdo: flex-1, padding 24px, bg `#080808`
- Link "Financeiro" oculto para role `operador`

## 6. Tokens de Branding

```css
:root {
  /* Cores */
  --bg-primary: #080808;
  --bg-surface: #111111;
  --bg-surface-hover: #1a1a1a;
  --border: #222222;
  --accent: #00e87a;
  --accent-hover: #00cc6a;
  --text-primary: #f0f0f0;
  --text-muted: #555555;
  --text-on-accent: #080808;
  --error: #ff4444;

  /* Fontes */
  --font-display: 'Syne', sans-serif;       /* títulos, logo, headings */
  --font-mono: 'JetBrains Mono', monospace;  /* dados, tabelas, badges */
  --font-body: 'Inter', sans-serif;          /* texto geral */

  /* Espaçamento */
  --sidebar-width: 240px;
  --header-height: 56px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### Fontes (Google Fonts via next/font)

- Syne 700 — display (logo, headings)
- JetBrains Mono 400/500 — mono (dados, badges, tabelas)
- Inter 400/500/600 — body (texto geral, labels, botões)

## 7. Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Framework | Next.js 14 App Router | SSR + RSC para performance, padrão Vercel |
| Auth | Supabase Auth + @supabase/ssr | Integração nativa, cookies-based, SSR-safe |
| Estilização | Tailwind CSS | Utility-first, rápido para prototipar |
| Role check | user_metadata.role | Simples para 4 usuários, sem tabela extra |
| Middleware | Next.js middleware | Intercepta antes do render, zero latência |
| Deploy | Vercel | Zero-config para Next.js |
| Monorepo | web/ separado | Bot intacto, CI independente |

## 8. Variáveis de Ambiente

```env
# web/.env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- `NEXT_PUBLIC_*` → acessíveis no browser
- `SUPABASE_SERVICE_ROLE_KEY` → server-only, NUNCA exposta ao client
