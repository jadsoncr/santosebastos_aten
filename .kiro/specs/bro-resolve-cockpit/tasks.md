# Tarefas — BRO Resolve Cockpit (Spec 2/4)

- [x] 0. Migração de tema dark → light (Passo 0)
  - [x] 0.1 Atualizar `web/app/globals.css` substituindo todos os design tokens escuros pelos tokens do Tema Light (background #FFFFFF, surface #F7F7F5, accent #1A73E8, etc.)
  - [x] 0.2 Atualizar `web/tailwind.config.ts` com todas as cores do Tema Light (incluindo novas: text-secondary, success, warning, score-hot, score-warm, score-cold, sidebar-bg, chat-received, chat-sent, note-internal)
  - [x] 0.3 Verificar que Login Page, Sidebar, Header e Dashboard Layout funcionam com os novos tokens (nenhuma mudança de classes necessária — apenas valores dos tokens mudam)

- [x] 1. Migração SQL — tabela mensagens + seeds quick_replies (Passo 1)
  - [x] 1.1 Criar `sql/migrations/002_bro_resolve_cockpit.sql` com CREATE TABLE mensagens (id UUID PK, lead_id UUID FK, de TEXT, tipo TEXT, conteudo TEXT, operador_id UUID FK nullable, created_at TIMESTAMPTZ)
  - [x] 1.2 Habilitar RLS na tabela mensagens e criar políticas (service_role full, authenticated read, authenticated insert)
  - [x] 1.3 Criar índices idx_mensagens_lead e idx_mensagens_created
  - [x] 1.4 Adicionar 5 registros seed na tabela quick_replies (saudacao, agenda, docs, prazo, encerramento)

- [x] 2. Shared supabaseAdmin.js + server.js com Socket.io (Passo 2)
  - [x] 2.1 Criar `src/supabaseAdmin.js` com singleton lazy getSupabase() usando createClient(SUPABASE_URL, SUPABASE_KEY)
  - [x] 2.2 Atualizar `src/identityResolver.js` para importar getSupabase de `./supabaseAdmin` em vez de criar client local
  - [x] 2.3 Instalar `socket.io` como dependência do projeto raiz
  - [x] 2.4 Modificar `server.js`: substituir app.listen() por http.createServer(app) + server.listen()
  - [x] 2.5 Instanciar Socket.io acoplado ao HTTP server com CORS para WEB_URL
  - [x] 2.6 Registrar handler `assumir_lead` com INSERT em atendimentos + tratamento UNIQUE violation + broadcast lead_assumido
  - [x] 2.7 Registrar handler `delegar_lead` com UPDATE em atendimentos + broadcast lead_delegado
  - [x] 2.8 Registrar handler `nova_mensagem` com INSERT em mensagens + broadcast nova_mensagem_salva (checar campo `origem: 'humano'` para NÃO processar pela state machine)
  - [x] 2.9 Registrar handler `operador_status` com broadcast operador_status_atualizado
  - [x] 2.10 Adicionar `WEB_URL` ao `.env.example`

- [x] 3. Bot salva mensagens na tabela mensagens (Passo 3)
  - [x] 3.1 No handler /webhook de server.js, após processar mensagem, inserir registro na tabela mensagens com de=channel_user_id, tipo='mensagem', conteudo=mensagem (mensagem recebida do lead)
  - [x] 3.2 Inserir registro na tabela mensagens com de='bot', tipo='mensagem', conteudo=resposta.message (resposta do bot)
  - [x] 3.3 Emitir evento Socket.io `nova_mensagem_salva` para ambas as mensagens (recebida e resposta)

- [x] 4. Socket.io client + SocketProvider no Next.js (Passo 4)
  - [x] 4.1 Instalar `socket.io-client` como dependência em `web/`
  - [x] 4.2 Criar `web/utils/socket.ts` com singleton getSocket() conectando a NEXT_PUBLIC_SOCKET_URL com reconnection automática
  - [x] 4.3 Criar `web/components/providers/SocketProvider.tsx` com React Context disponibilizando instância Socket.io
  - [x] 4.4 Modificar `web/app/(dashboard)/layout.tsx` para envolver conteúdo com SocketProvider
  - [x] 4.5 Adicionar NEXT_PUBLIC_SOCKET_URL e WEBHOOK_N8N_URL ao `web/.env.local.example`

- [x] 5. Tela 1 — layout de 3 colunas (Passo 5)
  - [x] 5.1 Reescrever `web/app/(dashboard)/tela1/page.tsx` como client component com useState para selectedLead
  - [x] 5.2 Implementar layout flex com ConversasSidebar (280px), ChatCentral (flex-1) e PainelLead (280px) separados por bordas border-border
  - [x] 5.3 Garantir que o layout ocupa 100% da altura disponível (h-full, compensar padding do layout pai)

- [x] 6. ConversasSidebar (Passo 6)
  - [x] 6.1 Criar `web/app/(dashboard)/tela1/components/ConversasSidebar.tsx`
  - [x] 6.2 Carregar leads via Supabase (SELECT * FROM leads ORDER BY score DESC)
  - [x] 6.3 Renderizar cada lead com nome/telefone, score badge colorido (hot/warm/cold), area e preview última mensagem
  - [x] 6.4 Implementar seleção de lead (onClick → onSelectLead) com destaque visual bg-bg-surface-hover
  - [x] 6.5 Escutar eventos Socket.io `lead_assumido` e `nova_mensagem_salva` para atualizar lista em tempo real

- [x] 7. ChatCentral com histórico de mensagens (Passo 7)
  - [x] 7.1 Criar `web/app/(dashboard)/tela1/components/ChatCentral.tsx`
  - [x] 7.2 Carregar histórico de mensagens via Supabase quando lead muda (SELECT * FROM mensagens WHERE lead_id ORDER BY created_at ASC)
  - [x] 7.3 Renderizar mensagens: recebidas (bg-chat-received, esquerda), enviadas (bg-chat-sent, direita), notas internas (bg-note-internal, ícone)
  - [x] 7.4 Implementar campo de input com submit via Socket.io `nova_mensagem` (incluindo origem: 'humano')
  - [x] 7.5 Escutar `nova_mensagem_salva` para append em tempo real + auto-scroll
  - [x] 7.6 Implementar botões de ação: ASSUMIR (emit assumir_lead), DELEGAR (seletor + emit delegar_lead), AGUARDANDO, ENCERRAR
  - [x] 7.7 Exibir estado vazio quando nenhum lead selecionado

- [x] 8. QuickReplies (Passo 8)
  - [x] 8.1 Criar `web/app/(dashboard)/tela1/components/QuickReplies.tsx`
  - [x] 8.2 Detectar '/' no input do ChatCentral para abrir dropdown
  - [x] 8.3 Carregar quick_replies via Supabase (compartilhado=true OR criado_por=operadorId)
  - [x] 8.4 Filtrar por texto digitado após '/' e substituir input ao selecionar

- [x] 9. PainelLead com classificação + bot_feedback (Passo 9)
  - [x] 9.1 Criar `web/app/(dashboard)/tela1/components/PainelLead.tsx` e `ScoreCircle.tsx`
  - [x] 9.2 Renderizar ScoreCircle com cor baseada no score (hot >= 7, warm >= 4, cold < 4)
  - [x] 9.3 Renderizar pills area_bot (readonly) e area_humano (dropdown editável)
  - [x] 9.4 Ao alterar area_humano != area_bot, inserir registro em bot_feedback
  - [x] 9.5 Exibir dados coletados: nome, telefone, área, fluxo, estado, score
  - [x] 9.6 Exibir campo valor estimado
  - [x] 9.7 Implementar botões VIROU CLIENTE (status='convertido'), NÃO FECHOU (status='nao_fechou'), ENCERRAR E ENFILEIRAR (abre PopupEnfileirar)

- [x] 10. PopupEnfileirar (Passo 10)
  - [x] 10.1 Criar `web/app/(dashboard)/tela1/components/PopupEnfileirar.tsx`
  - [x] 10.2 Implementar modal com campos: proxima_acao, data_acao, valor_estimado, observacao
  - [x] 10.3 Submit: INSERT pot_tratamento + UPDATE atendimentos (status='enfileirado', encerrado_em=now())
  - [x] 10.4 Fechar modal ao clicar fora, cancelar ou após sucesso

- [x] 11. Nota interna (Passo 11)
  - [x] 11.1 Adicionar toggle mensagem/nota interna no campo de input do ChatCentral
  - [x] 11.2 Em modo nota interna: background note-internal no input, emitir nova_mensagem com tipo='nota_interna'
  - [x] 11.3 Garantir que notas internas são renderizadas com estilo diferenciado e nunca enviadas via WhatsApp

- [x] 12. Chamar no WhatsApp (Passo 12)
  - [x] 12.1 Criar route handler `web/app/api/whatsapp/enviar/route.ts` com POST para WEBHOOK_N8N_URL (server-only)
  - [x] 12.2 Adicionar botão "Chamar no WA" no PainelLead (visível quando lead tem telefone)
  - [x] 12.3 Ao clicar, enviar POST para /api/whatsapp/enviar com lead_id, telefone, mensagem
  - [x] 12.4 Salvar mensagem enviada na tabela mensagens via route handler
