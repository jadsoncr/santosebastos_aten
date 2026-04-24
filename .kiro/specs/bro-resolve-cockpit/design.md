# Design — BRO Resolve Cockpit (Spec 2/4)

## 1. Estrutura de Arquivos

```
src/
├── supabaseAdmin.js              # NOVO — singleton Supabase service_role (compartilhado)
├── identityResolver.js           # MODIFICADO — importa de supabaseAdmin.js
├── stateMachine.js
├── ...

sql/
└── migrations/
    └── 002_bro_resolve_cockpit.sql  # tabela mensagens + seeds quick_replies

server.js                            # MODIFICADO — http.createServer + Socket.io

web/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx               # MODIFICADO — envolve com SocketProvider
│   │   └── tela1/
│   │       ├── page.tsx             # MODIFICADO — layout 3 colunas
│   │       └── components/
│   │           ├── ConversasSidebar.tsx
│   │           ├── ChatCentral.tsx
│   │           ├── PainelLead.tsx
│   │           ├── QuickReplies.tsx
│   │           ├── PopupEnfileirar.tsx
│   │           └── ScoreCircle.tsx
│   └── api/
│       └── whatsapp/
│           └── enviar/
│               └── route.ts         # NOVO — proxy para WEBHOOK_N8N_URL
├── components/
│   ├── Sidebar.tsx                  # MODIFICADO — tema light
│   ├── Header.tsx                   # MODIFICADO — tema light
│   └── providers/
│       └── SocketProvider.tsx       # NOVO
├── utils/
│   └── socket.ts                    # NOVO — singleton Socket.io client
└── .env.local.example               # MODIFICADO — novas variáveis
```

## 2. Migração SQL — `sql/migrations/002_bro_resolve_cockpit.sql`

```sql
-- ============================================================
-- BRO Resolve Cockpit — Migração 002
-- Rodar no SQL Editor do Supabase (ou via psql)
-- ============================================================

-- ── 1. Tabela mensagens ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  de TEXT NOT NULL,
  tipo TEXT DEFAULT 'mensagem',
  conteudo TEXT NOT NULL,
  operador_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_mensagens" ON mensagens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_mensagens" ON mensagens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_mensagens" ON mensagens
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mensagens_lead ON mensagens(lead_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created ON mensagens(created_at);

-- ── 2. Seeds quick_replies ──────────────────────────────────
-- NOTA: criado_por precisa ser um UUID válido de auth.users.
-- Substituir 'OWNER_USER_ID' pelo UUID do owner no Supabase.
INSERT INTO quick_replies (atalho, conteudo, criado_por, compartilhado) VALUES
  ('saudacao', 'Olá! Sou do escritório Santos & Bastos. Como posso ajudar?', 'OWNER_USER_ID', true),
  ('agenda', 'Vou verificar a agenda e retorno em instantes.', 'OWNER_USER_ID', true),
  ('docs', 'Para dar andamento, preciso dos seguintes documentos: RG, CPF e comprovante de residência.', 'OWNER_USER_ID', true),
  ('prazo', 'O prazo estimado para esse tipo de processo é de 6 a 12 meses.', 'OWNER_USER_ID', true),
  ('encerramento', 'Agradeço o contato! Qualquer dúvida, estamos à disposição.', 'OWNER_USER_ID', true)
ON CONFLICT (atalho) DO NOTHING;
```

## 3. Módulo Compartilhado — `src/supabaseAdmin.js`

O `identityResolver.js` atualmente cria seu próprio Supabase client com lazy singleton. Vamos extrair esse padrão para um módulo compartilhado que tanto o `identityResolver` quanto os handlers Socket.io usam.

```javascript
// src/supabaseAdmin.js
// Singleton Supabase client com service_role key.
// Reutilizado por identityResolver.js e handlers Socket.io.

let supabase;

function getSupabase() {
  if (!supabase) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return supabase;
}

module.exports = { getSupabase };
```

Após criar o módulo, atualizar `identityResolver.js` para importar de `supabaseAdmin.js`:

```javascript
// Em identityResolver.js — substituir o bloco local:
// ANTES:
// let supabase;
// function getSupabase() { ... }

// DEPOIS:
const { getSupabase } = require('./supabaseAdmin');
```

## 4. Modificações em `server.js` — Socket.io

### 4.1 Mudanças Estruturais

1. Substituir `app.listen()` por `http.createServer(app)` + `server.listen()`
2. Acoplar Socket.io ao HTTP server
3. Registrar handlers de eventos Socket.io

```javascript
// server.js — trecho modificado (topo, após requires existentes)
const http = require('http');
const { Server } = require('socket.io');
const { getSupabase } = require('./src/supabaseAdmin');

// ... (código Express existente permanece igual) ...

// Substituir app.listen() por:
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.WEB_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
  },
});

// ── Socket.io handlers ──────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] conectado: ${socket.id}`);

  // Assumir lead
  socket.on('assumir_lead', async ({ lead_id, operador_id }) => {
    const db = getSupabase();
    const { error } = await db
      .from('atendimentos')
      .insert({ lead_id, owner_id: operador_id, status: 'aberto' });

    if (error) {
      if (error.code === '23505') { // UNIQUE violation
        socket.emit('erro_assumir', {
          mensagem: 'Este lead já foi assumido por outro operador.',
        });
        return;
      }
      socket.emit('erro_assumir', { mensagem: error.message });
      return;
    }

    io.emit('lead_assumido', { lead_id, operador_id });
  });

  // Delegar lead
  socket.on('delegar_lead', async ({ lead_id, operador_id_origem, operador_id_destino }) => {
    const db = getSupabase();
    await db
      .from('atendimentos')
      .update({
        owner_id: operador_id_destino,
        delegado_de: operador_id_origem,
      })
      .eq('lead_id', lead_id);

    io.emit('lead_delegado', { lead_id, operador_id_destino });
  });

  // Nova mensagem (do operador)
  socket.on('nova_mensagem', async ({ lead_id, de, conteudo, tipo, operador_id, origem }) => {
    const db = getSupabase();
    const { data, error } = await db
      .from('mensagens')
      .insert({ lead_id, de, conteudo, tipo: tipo || 'mensagem', operador_id })
      .select()
      .single();

    if (!error && data) {
      io.emit('nova_mensagem_salva', data);
    }
    // Se origem === 'humano', NÃO processar pela state machine
    // Mensagens humanas são apenas persistidas e broadcast
  });

  // Status do operador
  socket.on('operador_status', ({ operador_id, status }) => {
    io.emit('operador_status_atualizado', { operador_id, status });
  });

  socket.on('disconnect', () => {
    console.log(`[socket] desconectado: ${socket.id}`);
  });
});

// Exportar io para uso no webhook handler
module.exports.io = io;

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Storage adapter: ${process.env.STORAGE_ADAPTER || 'memory'}`);
});
```

### 4.2 Bot Salva Mensagens no Webhook

No handler `/webhook`, após processar a mensagem e gerar resposta, inserir registros na tabela `mensagens`:

```javascript
// Dentro do handler /webhook, após processar:

// 1. Salvar mensagem recebida do lead
const db = getSupabase();
const sessaoAtual = await sessionManager.getSession(identity_id);
if (sessaoAtual.leadId) {
  await db.from('mensagens').insert({
    lead_id: sessaoAtual.leadId,
    de: channel_user_id,
    tipo: 'mensagem',
    conteudo: mensagem,
  });

  // 2. Salvar resposta do bot
  await db.from('mensagens').insert({
    lead_id: sessaoAtual.leadId,
    de: 'bot',
    tipo: 'mensagem',
    conteudo: resposta.message,
  });

  // 3. Emitir via Socket.io
  if (io) {
    io.emit('nova_mensagem_salva', {
      lead_id: sessaoAtual.leadId,
      de: channel_user_id,
      tipo: 'mensagem',
      conteudo: mensagem,
      created_at: new Date().toISOString(),
    });
    io.emit('nova_mensagem_salva', {
      lead_id: sessaoAtual.leadId,
      de: 'bot',
      tipo: 'mensagem',
      conteudo: resposta.message,
      created_at: new Date().toISOString(),
    });
  }
}
```

## 5. Tema Light — Design Tokens

### 5.1 Novos tokens CSS (`web/app/globals.css`)

```css
:root {
  /* Cores — Tema Light */
  --bg-primary: #FFFFFF;
  --bg-surface: #F7F7F5;
  --bg-surface-hover: #F0EFE9;
  --border: #E8E7E1;
  --text-primary: #1A1A1A;
  --text-secondary: #6B6B6B;
  --text-muted: #ADADAD;
  --accent: #1A73E8;
  --accent-hover: #1557B0;
  --text-on-accent: #FFFFFF;
  --error: #EF4444;
  --success: #1DB954;
  --warning: #F59E0B;

  /* Score */
  --score-hot: #F97316;
  --score-warm: #F59E0B;
  --score-cold: #6B7280;

  /* Chat */
  --sidebar-bg: #FAFAF8;
  --chat-received: #F7F7F5;
  --chat-sent: #EBF3FE;
  --note-internal: #FFFBEB;

  /* Fontes (mantidas) */
  --font-display: 'Syne', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-body: 'Inter', sans-serif;

  /* Espaçamento (mantido) */
  --sidebar-width: 240px;
  --header-height: 56px;

  /* Border radius (mantido) */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body);
}
```

### 5.2 Tailwind config atualizado (`web/tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#FFFFFF',
        'bg-surface': '#F7F7F5',
        'bg-surface-hover': '#F0EFE9',
        border: '#E8E7E1',
        accent: '#1A73E8',
        'accent-hover': '#1557B0',
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B6B6B',
        'text-muted': '#ADADAD',
        'text-on-accent': '#FFFFFF',
        error: '#EF4444',
        success: '#1DB954',
        warning: '#F59E0B',
        'score-hot': '#F97316',
        'score-warm': '#F59E0B',
        'score-cold': '#6B7280',
        'sidebar-bg': '#FAFAF8',
        'chat-received': '#F7F7F5',
        'chat-sent': '#EBF3FE',
        'note-internal': '#FFFBEB',
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      spacing: {
        sidebar: '240px',
        header: '56px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
}

export default config
```

## 6. Socket.io Client — `web/utils/socket.ts`

```typescript
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })
  }
  return socket
}
```

## 7. SocketProvider — `web/components/providers/SocketProvider.tsx`

```typescript
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Socket } from 'socket.io-client'
import { getSocket } from '@/utils/socket'

const SocketContext = createContext<Socket | null>(null)

export function useSocket() {
  return useContext(SocketContext)
}

export default function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const s = getSocket()
    setSocket(s)

    return () => {
      // Não desconectar — singleton reutilizado
    }
  }, [])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}
```

## 8. Layout do Cockpit — Tela 1

```
┌──────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │ HEADER                                                     │
│ (240px) ├────────────────────────────────────────────────────────────│
│         │ ┌──────────┐ ┌──────────────────────┐ ┌──────────────────┐│
│ Tela 1  │ │CONVERSAS │ │    CHAT CENTRAL      │ │  PAINEL LEAD     ││
│ Tela 2  │ │SIDEBAR   │ │                      │ │                  ││
│ Financ. │ │(280px)   │ │  Histórico msgs      │ │  Score circle    ││
│         │ │          │ │                      │ │  Pills area      ││
│         │ │ Lead 1 ● │ │  [msg recebida]      │ │  Dados coletados ││
│         │ │ Lead 2 ● │ │       [msg enviada]  │ │  Valor estimado  ││
│         │ │ Lead 3 ● │ │  [nota interna]      │ │                  ││
│         │ │          │ │                      │ │  [VIROU CLIENTE] ││
│         │ │          │ │ ┌──────────────────┐ │ │  [NÃO FECHOU]   ││
│         │ │          │ │ │ Input + /quick   │ │ │  [ENCERRAR E     ││
│         │ │          │ │ └──────────────────┘ │ │   ENFILEIRAR]    ││
│         │ │          │ │ [ASSUMIR][DELEGAR]   │ │                  ││
│         │ │          │ │ [AGUARDANDO][ENCERR] │ │  [Chamar no WA]  ││
│         │ └──────────┘ └──────────────────────┘ └──────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### 8.1 Tela 1 Page — `web/app/(dashboard)/tela1/page.tsx`

```typescript
import ConversasSidebar from './components/ConversasSidebar'
import ChatCentral from './components/ChatCentral'
import PainelLead from './components/PainelLead'

export default function Tela1Page() {
  // Estado do lead selecionado gerenciado via useState no client wrapper
  return (
    <div className="flex h-full">
      <ConversasSidebar />
      <ChatCentral />
      <PainelLead />
    </div>
  )
}
```

Nota: Como a page precisa de estado compartilhado (lead selecionado), será um client component wrapper:

```typescript
'use client'

import { useState } from 'react'
import ConversasSidebar from './components/ConversasSidebar'
import ChatCentral from './components/ChatCentral'
import PainelLead from './components/PainelLead'

interface Lead {
  id: string
  nome: string | null
  telefone: string | null
  area: string | null
  area_bot: string | null
  area_humano: string | null
  score: number
  prioridade: string
  status: string
}

export default function Tela1Page() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  return (
    <div className="flex h-full -m-6"> {/* compensar padding do layout */}
      <ConversasSidebar
        selectedLeadId={selectedLead?.id ?? null}
        onSelectLead={setSelectedLead}
      />
      <div className="flex-1 border-x border-border">
        <ChatCentral lead={selectedLead} />
      </div>
      <PainelLead lead={selectedLead} />
    </div>
  )
}
```

## 9. Componentes — Especificações

### 9.1 ConversasSidebar

Arquivo: `web/app/(dashboard)/tela1/components/ConversasSidebar.tsx`

```
Props:
  selectedLeadId: string | null
  onSelectLead: (lead: Lead) => void

Comportamento:
  - useEffect: carregar leads via Supabase (SELECT * FROM leads ORDER BY score DESC)
  - useSocket: escutar 'lead_assumido', 'nova_mensagem_salva' para atualizar lista
  - Cada item: nome/telefone, score badge colorido, area, preview última msg

Classes Tailwind:
  Container: w-[280px] h-full bg-sidebar-bg border-r border-border overflow-y-auto
  Item: px-4 py-3 cursor-pointer hover:bg-bg-surface-hover border-b border-border
  Item selecionado: bg-bg-surface-hover
  Nome: text-sm font-medium text-text-primary truncate
  Preview: text-xs text-text-muted truncate mt-1
  Score badge (hot): text-xs font-mono font-medium text-score-hot
  Score badge (warm): text-xs font-mono font-medium text-score-warm
  Score badge (cold): text-xs font-mono font-medium text-score-cold
```

### 9.2 ChatCentral

Arquivo: `web/app/(dashboard)/tela1/components/ChatCentral.tsx`

```
Props:
  lead: Lead | null

Comportamento:
  - useEffect: carregar mensagens via Supabase quando lead muda
  - useSocket: escutar 'nova_mensagem_salva' para append em tempo real
  - Auto-scroll para última mensagem
  - Input com suporte a '/' para QuickReplies
  - Toggle mensagem/nota interna
  - Botões de ação: ASSUMIR, DELEGAR, AGUARDANDO, ENCERRAR

Classes Tailwind:
  Container: flex flex-col h-full
  Header: px-4 py-3 border-b border-border bg-bg-surface flex items-center justify-between
  Messages area: flex-1 overflow-y-auto p-4 space-y-3
  Msg recebida: max-w-[70%] rounded-lg px-3 py-2 bg-chat-received text-text-primary text-sm
  Msg enviada: max-w-[70%] rounded-lg px-3 py-2 bg-chat-sent text-text-primary text-sm ml-auto
  Nota interna: max-w-[70%] rounded-lg px-3 py-2 bg-note-internal text-text-primary text-sm border border-warning/30
  Input area: px-4 py-3 border-t border-border bg-bg-surface
  Input field: w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
  Input nota interna: bg-note-internal border-warning/30
  Botão ação: px-3 py-1.5 rounded-md text-xs font-medium
  ASSUMIR: bg-accent text-text-on-accent hover:bg-accent-hover
  DELEGAR: bg-bg-surface-hover text-text-primary hover:bg-border
  AGUARDANDO: bg-warning/10 text-warning hover:bg-warning/20
  ENCERRAR: bg-error/10 text-error hover:bg-error/20
  Estado vazio: flex items-center justify-center h-full text-text-muted text-sm
```

### 9.3 PainelLead

Arquivo: `web/app/(dashboard)/tela1/components/PainelLead.tsx`

```
Props:
  lead: Lead | null

Comportamento:
  - Exibir ScoreCircle com cor baseada no score
  - Pills: area_bot (readonly, bg-bg-surface-hover) e area_humano (dropdown editável)
  - Ao alterar area_humano != area_bot → INSERT bot_feedback
  - Dados coletados: nome, telefone, área, fluxo, estado, score
  - Campo valor estimado
  - Botões: VIROU CLIENTE, NÃO FECHOU, ENCERRAR E ENFILEIRAR
  - Botão Chamar no WA (se telefone disponível)

Classes Tailwind:
  Container: w-[280px] h-full bg-bg-surface overflow-y-auto p-4 space-y-4
  ScoreCircle: w-16 h-16 rounded-full flex items-center justify-center mx-auto
    Hot: bg-score-hot/10 text-score-hot border-2 border-score-hot
    Warm: bg-score-warm/10 text-score-warm border-2 border-score-warm
    Cold: bg-score-cold/10 text-score-cold border-2 border-score-cold
  Score value: font-mono text-lg font-bold
  Pill area_bot: px-2 py-1 rounded-full text-xs bg-bg-surface-hover text-text-secondary
  Pill area_humano: px-2 py-1 rounded-full text-xs bg-accent/10 text-accent cursor-pointer
  Dados label: text-xs text-text-muted
  Dados value: text-sm text-text-primary
  Botão VIROU CLIENTE: w-full py-2 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90
  Botão NÃO FECHOU: w-full py-2 rounded-md text-sm font-medium bg-error/10 text-error hover:bg-error/20
  Botão ENCERRAR E ENFILEIRAR: w-full py-2 rounded-md text-sm font-medium bg-warning/10 text-warning hover:bg-warning/20
  Botão Chamar WA: w-full py-2 rounded-md text-sm font-medium bg-success/10 text-success hover:bg-success/20
```

### 9.4 QuickReplies

Arquivo: `web/app/(dashboard)/tela1/components/QuickReplies.tsx`

```
Props:
  query: string (texto após '/')
  onSelect: (conteudo: string) => void
  onClose: () => void
  operadorId: string

Comportamento:
  - Carregar quick_replies via Supabase (compartilhado=true OR criado_por=operadorId)
  - Filtrar por query
  - Selecionar → substituir input

Classes Tailwind:
  Container: absolute bottom-full left-0 w-full max-h-48 overflow-y-auto bg-bg-primary border border-border rounded-md shadow-lg z-10
  Item: px-3 py-2 hover:bg-bg-surface-hover cursor-pointer
  Atalho: text-xs font-mono text-accent
  Conteudo: text-sm text-text-primary truncate
```

### 9.5 PopupEnfileirar

Arquivo: `web/app/(dashboard)/tela1/components/PopupEnfileirar.tsx`

```
Props:
  leadId: string
  operadorId: string
  onClose: () => void
  onSuccess: () => void

Comportamento:
  - Modal overlay com formulário
  - Campos: proxima_acao (text), data_acao (date), valor_estimado (number), observacao (textarea)
  - Submit → INSERT pot_tratamento + UPDATE atendimentos (status='enfileirado', encerrado_em=now())
  - Fechar ao clicar fora ou cancelar

Classes Tailwind:
  Overlay: fixed inset-0 bg-black/50 flex items-center justify-center z-50
  Modal: bg-bg-primary rounded-lg border border-border p-6 w-full max-w-md shadow-xl
  Título: text-lg font-display font-bold text-text-primary mb-4
  Label: text-sm text-text-secondary mb-1
  Input: w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
  Botão Confirmar: px-4 py-2 rounded-md text-sm font-medium bg-accent text-text-on-accent hover:bg-accent-hover
  Botão Cancelar: px-4 py-2 rounded-md text-sm font-medium bg-bg-surface-hover text-text-primary hover:bg-border
```

### 9.6 ScoreCircle

Arquivo: `web/app/(dashboard)/tela1/components/ScoreCircle.tsx`

```
Props:
  score: number

Comportamento:
  - score >= 7 → hot (laranja)
  - score >= 4 → warm (amarelo)
  - score < 4 → cold (cinza)

Classes Tailwind: (ver PainelLead acima)
```

## 10. Route Handler — Chamar no WhatsApp

Arquivo: `web/app/api/whatsapp/enviar/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { lead_id, telefone, mensagem } = await request.json()

  const webhookUrl = process.env.WEBHOOK_N8N_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'WEBHOOK_N8N_URL não configurada' }, { status: 500 })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, mensagem }),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Falha ao enviar: ${res.status}` },
        { status: res.status }
      )
    }

    // Salvar mensagem enviada na tabela mensagens
    // Usar service_role via server client para INSERT
    await supabase.from('mensagens').insert({
      lead_id,
      de: user.id,
      tipo: 'mensagem',
      conteudo: mensagem,
      operador_id: user.id,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro ao conectar com webhook' },
      { status: 502 }
    )
  }
}
```

## 11. Migração de Componentes Spec 1 — Dark → Light

### 11.1 Login Page

Substituições de classes:
- `bg-bg-primary` → mantém (valor muda via CSS vars)
- `bg-bg-surface` → mantém
- `text-text-primary` → mantém
- `text-text-muted` → mantém
- `border-border` → mantém
- `focus:border-accent` → mantém
- `bg-accent` → mantém
- `text-text-on-accent` → mantém (agora #FFFFFF em vez de #080808)
- `hover:bg-accent-hover` → mantém

Como todas as classes usam tokens semânticos, a migração é feita apenas atualizando `globals.css` e `tailwind.config.ts`. Os componentes não precisam de alteração de classes — apenas os valores dos tokens mudam.

Exceção: o badge de role no Header usa `bg-blue-500/15 text-blue-400` (hardcoded). Manter como está — funciona em ambos os temas.

### 11.2 Dashboard Layout

O `layout.tsx` usa `bg-bg-primary` que agora será branco. Nenhuma mudança de classes necessária.

### 11.3 Sidebar

Usa `bg-bg-surface`, `border-border`, `text-text-primary`, `text-text-muted`, `bg-accent/10 text-accent`. Todas semânticas — nenhuma mudança de classes.

### 11.4 Header

Usa `bg-bg-surface`, `border-border`, `text-text-primary`, `text-text-muted`, `bg-bg-surface-hover`. Todas semânticas — nenhuma mudança de classes.

**Conclusão**: A migração de tema se resume a atualizar `globals.css` e `tailwind.config.ts`. Os componentes da Spec 1 já usam tokens semânticos e não precisam de alteração de classes Tailwind.

## 12. Variáveis de Ambiente

### 12.1 `web/.env.local.example` (adicionar)

```env
# Socket.io — URL do servidor bot (Railway)
NEXT_PUBLIC_SOCKET_URL=https://your-bot-server.railway.app

# Webhook n8n — envio de WhatsApp (server-only, NÃO usar NEXT_PUBLIC_)
WEBHOOK_N8N_URL=https://your-n8n-instance.com/webhook/whatsapp
```

### 12.2 `.env.example` (adicionar)

```env
# URL da plataforma web para CORS do Socket.io
WEB_URL=https://your-web-app.vercel.app
```

### 12.3 Dependências

```bash
# Raiz (bot server)
npm install socket.io

# Web (Next.js)
cd web && npm install socket.io-client
```

## 13. Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| WebSocket | Socket.io | Reconexão automática, rooms, broadcast nativo |
| Supabase client compartilhado | `src/supabaseAdmin.js` | Evita duplicação entre identityResolver e Socket.io handlers |
| Tema light via tokens | CSS vars + Tailwind config | Migração zero nos componentes existentes |
| Componentes tela1 | Colocados em `tela1/components/` | Colocação por feature, não poluem `web/components/` global |
| Estado lead selecionado | useState na page | Simples, sem necessidade de state manager externo |
| Quick replies | Tabela Supabase | Compartilháveis entre operadores, seeds via migração |
| Nota interna | Campo `tipo` na tabela mensagens | Reutiliza mesma tabela, filtro simples |
| Chamar WA | Route handler server-side | Protege WEBHOOK_N8N_URL do client-side |
| Origem humano | Campo `origem` no payload Socket.io | Servidor sabe não processar pela state machine |
