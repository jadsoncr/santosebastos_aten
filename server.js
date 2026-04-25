require('dotenv').config();

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const normalize = require('./src/normalizer');
const { process: processar } = require('./src/stateMachine');
const { buildResponse } = require('./src/responder');
const sessionManager = require('./src/sessionManager');
const { createAbandono } = require('./src/storage');
const { resolveIdentity } = require('./src/identityResolver');
const { ESTADOS_FINAIS } = require('./src/sessionManager');
const { getSupabase } = require('./src/supabaseAdmin');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const BOT_PERSONAS = {
  'trabalhista': 'Dr. Rafael',
  'familia': 'Dra. Mariana',
  'previdenciario': 'Dr. Carlos',
  'consumidor': 'Dra. Beatriz',
  'civel': 'Dr. André',
  'criminal': 'Dra. Patrícia',
};
const DEFAULT_PERSONA = 'Atendimento Santos & Bastos';

async function sendTelegram(chat_id, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text }),
  });
}

async function sendTelegramWithTyping(chat_id, text, area) {
  try {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, action: 'typing' }),
    });
  } catch (typingErr) {
    console.error(JSON.stringify({
      level: 'warn',
      msg: 'typing_action_fail',
      chat_id,
      erro: typingErr.message,
      ts: new Date().toISOString(),
    }));
  }
  await new Promise(r => setTimeout(r, 1500));
  await sendTelegram(chat_id, text);
  const areaKey = (area || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return BOT_PERSONAS[areaKey] || DEFAULT_PERSONA;
}

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    // Detectar origem: Telegram ou padrão (n8n/WhatsApp)
    const isTelegram = !!(req.body.message || req.body.edited_message);
    const tgMsg = req.body.message || req.body.edited_message;

    let body = req.body;
    if (isTelegram) {
      if (!tgMsg.text) {
        // áudio, foto, sticker, etc — tratamento progressivo por nível
        const chatId = String(tgMsg.chat.id);
        let audioIdentityId;
        try {
          audioIdentityId = await resolveIdentity('telegram', chatId, null);
        } catch (_) {
          await sendTelegram(chatId, 'Erro interno. Tente novamente.');
          return res.sendStatus(200);
        }
        const sess = await sessionManager.getSession(audioIdentityId, 'telegram', chatId);
        const count = (sess.audioCount || 0) + 1;
        await sessionManager.updateSession(audioIdentityId, { audioCount: count });

        let msg;
        if (count === 1) {
          msg = 'Perfeito 👍 recebi seu áudio.\n\nVou encaminhar para um advogado ouvir — mas pra agilizar, me diz:\n\n1️⃣ Problema no trabalho\n2️⃣ Questão de família\n3️⃣ Já sou cliente\n4️⃣ Quero falar com advogado\n5️⃣ Outro assunto';
        } else if (count === 2) {
          msg = 'Recebi 👍 Um advogado vai ouvir seu áudio.\n\nEnquanto isso, qual opção descreve melhor seu caso?\n\n1️⃣ Trabalho\n2️⃣ Família\n3️⃣ Já sou cliente\n4️⃣ Falar com advogado\n5️⃣ Outro';
        } else {
          msg = 'Pra te ajudar agora 👍\n\nPreciso que escolha uma opção:\n\n1 - Trabalho\n2 - Família\n3 - Já sou cliente\n4 - Advogado\n5 - Outro';
        }

        await sendTelegram(chatId, msg);
        return res.sendStatus(200);
      }
      body = {
        sessao: String(tgMsg.chat.id),
        mensagem: tgMsg.text,
        canal: 'telegram',
      };
    }

    const { sessao, mensagem, canal } = normalize(body);

    if (!sessao) {
      return res.status(400).json({ error: 'Campo "sessao" é obrigatório.' });
    }

    // Resolver identidade unificada
    // Telegram: telefone = null (API não fornece). Merge cross-canal só quando fluxo coleta número.
    const telefone = body.telefone || null;
    const channel = isTelegram ? 'telegram' : (canal || 'whatsapp');
    const channel_user_id = sessao;

    let identity_id;
    try {
      identity_id = await resolveIdentity(channel, channel_user_id, telefone);
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        msg: 'identity_resolve_fail',
        channel,
        channel_user_id,
        erro: err.message,
        ts: new Date().toISOString(),
      }));
      if (isTelegram) return res.sendStatus(200);
      return res.status(500).json({ error: 'Erro ao resolver identidade.' });
    }

    // ── CAPTURA AGRESSIVA: extrair nome/telefone do Telegram ──
    // Preenche identities.nome e leads.nome com dados do perfil Telegram,
    // mas NUNCA sobrescreve dados já preenchidos (pelo bot ou operador).
    let nome_telegram = null;
    if (isTelegram && tgMsg.from) {
      const firstName = tgMsg.from.first_name || '';
      const lastName = tgMsg.from.last_name || '';
      nome_telegram = lastName ? `${firstName} ${lastName}` : firstName || null;

      if (nome_telegram || tgMsg.from.phone_number) {
        try {
          const db = getSupabase();
          // Atualizar identities.nome apenas se null
          if (nome_telegram) {
            await db
              .from('identities')
              .update({ nome: nome_telegram })
              .eq('id', identity_id)
              .is('nome', null);
          }
          // Atualizar identities.telefone apenas se phone_number disponível e telefone null
          if (tgMsg.from.phone_number) {
            await db
              .from('identities')
              .update({ telefone: tgMsg.from.phone_number })
              .eq('id', identity_id)
              .is('telefone', null);
          }
        } catch (captureErr) {
          console.error(JSON.stringify({
            level: 'warn',
            msg: 'telegram_capture_fail',
            identity_id,
            erro: captureErr.message,
            ts: new Date().toISOString(),
          }));
        }
      }
    }

    // Usar identity_id como chave de sessão, com legacy_id para migração lazy
    const sessAntes = await sessionManager.getSession(identity_id, canal, sessao);

    // ── UPSERT IMEDIATO: criar lead ao primeiro "Oi" ──
    try {
      const db = getSupabase();
      const { data: existingLead } = await db
        .from('leads')
        .select('id, is_assumido')
        .eq('identity_id', identity_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingLead) {
        // Primeiro contato — criar lead com status TRIAGEM
        const { randomUUID: genUUID } = require('crypto');
        await db.from('leads').insert({
          identity_id,
          request_id: genUUID(),
          nome: nome_telegram,
          telefone: null,
          canal_origem: channel,
          channel_user_id,
          status: 'TRIAGEM',
          score: 0,
          prioridade: 'FRIO',
        });
        // Broadcast pra sidebar atualizar
        io.emit('lead_novo', { identity_id, channel_user_id });
      } else {
        // Atualizar leads.nome com nome_telegram apenas se leads.nome for null
        if (nome_telegram) {
          await db
            .from('leads')
            .update({ nome: nome_telegram })
            .eq('id', existingLead.id)
            .is('nome', null);
        }
        // Atualizar channel_user_id e ultima_msg
        await db.from('leads').update({
          channel_user_id,
          ultima_msg_de: channel_user_id,
          ultima_msg_em: new Date().toISOString(),
        }).eq('id', existingLead.id);

        // ── SILENCIADOR INTELIGENTE: verificar se humano está realmente ativo ──
        if (existingLead.is_assumido) {
          // Verificar última interação do operador (não do cliente)
          const { data: leadFull } = await db
            .from('leads')
            .select('last_operator_message_at, ultima_msg_em')
            .eq('id', existingLead.id)
            .maybeSingle();

          // Usar last_operator_message_at se disponível, senão ultima_msg_em como fallback
          const ultimaInteracao = leadFull?.last_operator_message_at
            ? new Date(leadFull.last_operator_message_at)
            : leadFull?.ultima_msg_em
            ? new Date(leadFull.ultima_msg_em)
            : null;
          const agora = new Date();
          const diffMin = ultimaInteracao ? (agora.getTime() - ultimaInteracao.getTime()) / 60000 : 999;

          // Se inatividade > 5 min, liberar para o bot
          if (diffMin > 5) {
            console.log('[AUTO RELEASE] liberando is_assumido por inatividade no webhook', {
              lead_id: existingLead.id, inatividade_min: Math.floor(diffMin),
            });
            await db.from('leads').update({
              is_assumido: false,
              status_triagem: 'bot_ativo',
            }).eq('id', existingLead.id);
            // NÃO retornar — deixar o bot processar normalmente
            console.log('[BOT LIBERADO]', { lead_id: existingLead.id });
          } else {
            // Humano ativo — bloquear bot
            console.log('[BOT BLOQUEADO - HUMANO ATIVO]', {
              lead_id: existingLead.id, inatividade_min: Math.floor(diffMin),
            });
            await db.from('mensagens').insert({
              lead_id: existingLead.id,
              de: channel_user_id,
              tipo: 'mensagem',
              conteudo: mensagem,
              canal_origem: channel,
            });
            io.emit('nova_mensagem_salva', {
              lead_id: existingLead.id,
              de: channel_user_id,
              tipo: 'mensagem',
              conteudo: mensagem,
              created_at: new Date().toISOString(),
            });

            if (isTelegram) {
              await sendTelegram(tgMsg.chat.id, 'Um momento, nosso atendente está respondendo...');
              return res.sendStatus(200);
            }
            return res.json({ message: 'Atendimento humano ativo.' });
          }
        }
      }
    } catch (upsertErr) {
      console.error('[upsert_imediato]', upsertErr.message);
    }

    const resultado = await processar(identity_id, mensagem, canal);

    // Incrementa contador de mensagens
    await sessionManager.updateSession(identity_id, {
      mensagensEnviadas: (sessAntes.mensagensEnviadas || 0) + 1,
      statusSessao: ESTADOS_FINAIS.includes(resultado.estado) ? 'FINALIZADO' : 'ATIVO',
    });
    const resposta = buildResponse(resultado);

    // ── Persistir mensagens na tabela mensagens ──────────────────────────
    try {
      const sessaoAtual = await sessionManager.getSession(identity_id);
      const db = getSupabase();

      // Encontrar lead_id: da sessão ou buscar no banco por identity_id
      let leadId = sessaoAtual?.leadId;
      if (!leadId) {
        const { data: existingLead } = await db
          .from('leads')
          .select('id')
          .eq('identity_id', identity_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        leadId = existingLead?.id;
      }

      // Salvar channel_user_id no lead pra outbound
      if (leadId) {
        await db.from('leads').update({ channel_user_id }).eq('id', leadId);

        // ── Atualizar ultima_msg no lead ──
        await db.from('leads').update({
          ultima_msg_de: channel_user_id,
          ultima_msg_em: new Date().toISOString(),
        }).eq('id', leadId);

        // ── Reentrada: checar se lead está em pausa, fechado ou encerrado ──
        const { data: leadAtual } = await db
          .from('leads')
          .select('status_operacao, is_reaquecido')
          .eq('id', leadId)
          .maybeSingle();

        if (leadAtual && ['em_pausa', 'fechado'].includes(leadAtual.status_operacao)) {
          // Lead voltou — reativar como prioridade máxima
          await db.from('leads').update({
            status_operacao: 'ativo',
            is_reaquecido: true,
            reaquecido_em: new Date().toISOString(),
          }).eq('id', leadId);
          io.emit('lead_reaquecido', { lead_id: leadId, status_anterior: leadAtual.status_operacao });
        }

        // ── Reentrada clássica: atendimento encerrado ──
        const { data: atExistente } = await db
          .from('atendimentos')
          .select('status')
          .eq('lead_id', leadId)
          .in('status', ['convertido', 'nao_fechou', 'enfileirado', 'aguardando'])
          .maybeSingle();

        if (atExistente) {
          // Lead reaquecido — marcar flag sem mudar status do atendimento
          await db.from('leads').update({
            is_reaquecido: true,
            reaquecido_em: new Date().toISOString(),
          }).eq('id', leadId);

          io.emit('lead_reaquecido', {
            lead_id: leadId,
            status_anterior: atExistente.status,
          });
        }

        // Mensagem recebida do lead
        await db.from('mensagens').insert({
          lead_id: leadId,
          de: channel_user_id,
          tipo: 'mensagem',
          conteudo: mensagem,
          canal_origem: channel,
        });
        // Resposta do bot
        const botArea = resultado.fluxo || resultado.area || null;
        const botAreaKey = (botArea || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const personaNome = BOT_PERSONAS[botAreaKey] || DEFAULT_PERSONA;
        await db.from('mensagens').insert({
          lead_id: leadId,
          de: 'bot',
          tipo: 'mensagem',
          conteudo: resposta.message,
          canal_origem: channel,
          persona_nome: personaNome,
        });

        // Log de sistema: classificação do bot
        if (resultado.fluxo || resultado.score) {
          const logMsg = `[SISTEMA] Motor Santos & Bastos: ${resultado.fluxo || '—'} | Score ${resultado.score}/10 | ${resultado.prioridade || 'FRIO'}`;
          await db.from('mensagens').insert({
            lead_id: leadId,
            de: 'sistema',
            tipo: 'sistema',
            conteudo: logMsg,
            canal_origem: channel,
          });
        }
        // Broadcast via Socket.io
        io.emit('nova_mensagem_salva', {
          lead_id: leadId,
          de: channel_user_id,
          tipo: 'mensagem',
          conteudo: mensagem,
          created_at: new Date().toISOString(),
        });
        io.emit('nova_mensagem_salva', {
          lead_id: leadId,
          de: 'bot',
          tipo: 'mensagem',
          conteudo: resposta.message,
          created_at: new Date().toISOString(),
        });
      }
    } catch (msgErr) {
      // Falha de persistência de mensagem não bloqueia o fluxo
      console.error(JSON.stringify({
        level: 'warn',
        msg: 'mensagem_persist_fail',
        identity_id,
        erro: msgErr.message,
        ts: new Date().toISOString(),
      }));
    }

    if (isTelegram) {
      const botArea = resultado.fluxo || resultado.area || null;
      await sendTelegramWithTyping(tgMsg.chat.id, resposta.message, botArea);
      return res.sendStatus(200);
    }

    return res.json(resposta);

  } catch (err) {
    console.error('[webhook error]', err);
    if (req.body.message || req.body.edited_message) return res.sendStatus(200);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

// Health check para Railway
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Admin: visibilidade de sessões em produção ──────────────────────────────
// Protegido por ADMIN_TOKEN (defina na Railway)
function adminAuth(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN não configurado.' });
  if (req.headers['x-admin-token'] !== token) return res.status(401).json({ error: 'Não autorizado.' });
  next();
}

app.get('/admin/sessions', adminAuth, async (_req, res) => {
  const { _getAll } = require('./src/storage');
  const { sessions } = _getAll();
  const agora = Date.now();

  const lista = Object.values(sessions).map(s => ({
    sessao:           s.sessao,
    estado:           s.estadoAtual,
    fluxo:            s.fluxo || '—',
    score:            s.score || 0,
    prioridade:       s.prioridade || 'FRIO',
    status:           s.statusSessao || 'ATIVO',
    nome:             s.nome || '—',
    canal:            s.canalOrigem || '—',
    mensagens:        s.mensagensEnviadas || 0,
    ultimaMensagem:   s.ultimaMensagem || '—',
    inatividade_min:  s.atualizadoEm
      ? Math.floor((agora - new Date(s.atualizadoEm).getTime()) / 60000)
      : null,
    atualizadoEm:     s.atualizadoEm || null,
  }));

  // ordena por mais recente
  lista.sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));

  const resumo = {
    total:       lista.length,
    ativos:      lista.filter(s => s.status === 'ATIVO').length,
    finalizados: lista.filter(s => s.status === 'FINALIZADO').length,
    abandonados: lista.filter(s => s.status === 'ABANDONOU').length,
    quentes:     lista.filter(s => s.prioridade === 'QUENTE').length,
  };

  return res.json({ resumo, sessoes: lista });
});


// ─── HTTP Server + Socket.io ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (process.env.WEB_URL || 'http://localhost:3001').split(',').map(u => u.trim()),
    methods: ['GET', 'POST'],
  },
});

// ─── Timeline Helper ────────────────────────────────────────────────────────
async function registrarTimelineEvent(db, lead_id, tipo, descricao, operador_id, metadata) {
  try {
    await db.from('timeline_events').insert({ lead_id, tipo, descricao, operador_id, metadata });
  } catch (e) { console.error('[timeline]', e.message); }
}

// ─── Socket.io handlers ────────────────────────────────────────────────────
const typingThrottle = new Map();

io.on('connection', (socket) => {
  console.log(`[socket] conectado: ${socket.id}`);

  // Assumir lead — atômico via UNIQUE(lead_id)
  socket.on('assumir_lead', async ({ lead_id, operador_id }) => {
    const db = getSupabase();
    const { error } = await db
      .from('atendimentos')
      .insert({ lead_id, owner_id: operador_id, status: 'aberto' });

    if (error) {
      if (error.code === '23505') {
        socket.emit('erro_assumir', { mensagem: 'Este lead já foi assumido por outro operador.' });
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
      .update({ owner_id: operador_id_destino, delegado_de: operador_id_origem })
      .eq('lead_id', lead_id);
    io.emit('lead_delegado', { lead_id, operador_id_destino });
  });

  // Nova mensagem (do operador humano)
  socket.on('nova_mensagem', async ({ lead_id, de, conteudo, tipo, operador_id, origem }) => {
    console.log('[SEND START]', { lead_id, de, conteudo: conteudo?.slice(0, 50), tipo, origem, ts: new Date().toISOString() });

    const db = getSupabase();
    const { data, error } = await db
      .from('mensagens')
      .insert({ lead_id, de, conteudo, tipo: tipo || 'mensagem', operador_id })
      .select()
      .single();

    if (error) {
      console.error('[DB ERROR]', { lead_id, error: error.message });
    }

    if (!error && data) {
      console.log('[DB SAVED]', { lead_id, message_id: data.id });
      io.emit('nova_mensagem_salva', data);
    }

    // OUTBOUND: se mensagem do operador humano, enviar pro Telegram/WhatsApp
    if (origem === 'humano' && tipo !== 'nota_interna' && lead_id) {
      try {
        // Marcar lead como assumido por humano (silencia o bot) + registrar timestamp
        await db.from('leads').update({
          is_assumido: true,
          status_triagem: 'humano_assumiu',
          ultima_msg_de: de,
          ultima_msg_em: new Date().toISOString(),
          last_operator_message_at: new Date().toISOString(),
        }).eq('id', lead_id);

        const { data: lead } = await db
          .from('leads')
          .select('channel_user_id, canal_origem, identity_id')
          .eq('id', lead_id)
          .maybeSingle();

        console.log('[OUTBOUND PREP]', {
          lead_id,
          channel_user_id: lead?.channel_user_id || 'NULL',
          canal_origem: lead?.canal_origem || 'NULL',
          identity_id: lead?.identity_id || 'NULL',
        });

        if (!lead?.channel_user_id) {
          console.error('[OUTBOUND BLOCKED] channel_user_id vazio', { lead_id });
          return;
        }

        if (lead.canal_origem === 'telegram') {
          await sendTelegram(lead.channel_user_id, conteudo);
          console.log('[OUTBOUND SUCCESS]', { canal: 'telegram', channel_user_id: lead.channel_user_id });
        } else if (process.env.WEBHOOK_N8N_URL) {
          await fetch(process.env.WEBHOOK_N8N_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefone: lead.channel_user_id, mensagem: conteudo }),
          });
          console.log('[OUTBOUND SUCCESS]', { canal: 'whatsapp', channel_user_id: lead.channel_user_id });
        } else {
          console.warn('[OUTBOUND SKIP] canal não-telegram e WEBHOOK_N8N_URL não configurada', { canal_origem: lead.canal_origem });
        }
      } catch (outErr) {
        console.error('[OUTBOUND ERROR]', { lead_id, error: outErr.message, ts: new Date().toISOString() });
      }
    }
  });

  // Status do operador
  socket.on('operador_status', ({ operador_id, status }) => {
    io.emit('operador_status_atualizado', { operador_id, status });
  });

  // Lead encerrado — broadcast para remover da fila de todos
  socket.on('lead_encerrado', ({ lead_id, tipo }) => {
    io.emit('lead_encerrado', { lead_id, tipo });
  });

  // Relay de typing do operador para Telegram
  socket.on('operador_digitando', async ({ lead_id, operador_nome }) => {
    try {
      const db = getSupabase();
      const { data: lead } = await db
        .from('leads')
        .select('channel_user_id, canal_origem, is_assumido')
        .eq('id', lead_id)
        .maybeSingle();

      if (!lead || !lead.is_assumido || lead.canal_origem !== 'telegram') return;

      const chatId = lead.channel_user_id;
      const now = Date.now();
      const last = typingThrottle.get(chatId) || 0;

      if (now - last < 4000) return; // throttle 4s
      typingThrottle.set(chatId, now);

      await fetch(`${TELEGRAM_API}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      });
    } catch (typingErr) {
      console.error(JSON.stringify({
        level: 'warn',
        msg: 'operador_typing_fail',
        lead_id,
        erro: typingErr.message,
        ts: new Date().toISOString(),
      }));
    }
  });

  // Pipeline transition handler
  socket.on('pipeline_transition', async ({ lead_id, target_stage, conditions }) => {
    const { validateTransition } = require('./src/pipeline');
    const db = getSupabase();

    const { data: lead } = await db.from('leads').select('status_pipeline, nome, telefone, score, segmento_id').eq('id', lead_id).maybeSingle();
    if (!lead) { socket.emit('pipeline_error', { lead_id, error: 'Lead não encontrado.' }); return; }

    const result = validateTransition(lead.status_pipeline || 'ENTRADA', target_stage, { ...lead, ...conditions });
    if (!result.allowed) { socket.emit('pipeline_error', { lead_id, error: result.error }); return; }

    await db.from('leads').update({ status_pipeline: target_stage }).eq('id', lead_id);
    if (conditions && Object.keys(conditions).length > 0) {
      await db.from('atendimentos').update(conditions).eq('lead_id', lead_id);
    }

    io.emit('pipeline_changed', { lead_id, status_anterior: lead.status_pipeline, status_novo: target_stage, operador_id: null });

    // Momento WOW — quando lead chega em CARTEIRA_ATIVA
    if (target_stage === 'CARTEIRA_ATIVA') {
      // Webhook
      if (process.env.WEBHOOK_WOW_URL) {
        try {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 5000);
          await fetch(process.env.WEBHOOK_WOW_URL, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: lead.nome, telefone: lead.telefone, valor_entrada: conditions.valor_entrada, metodo_pagamento: conditions.metodo_pagamento, data_conversao: new Date().toISOString() }),
          });
        } catch (e) { console.error('[webhook_wow]', e.message); }
      }
      // Welcome message
      const { data: leadFull } = await db.from('leads').select('channel_user_id, canal_origem, nome').eq('id', lead_id).maybeSingle();
      if (leadFull?.channel_user_id && leadFull.canal_origem === 'telegram') {
        const msg = `${leadFull.nome || 'Prezado(a)'}, seja bem-vindo(a) ao escritorio Santos e Bastos Advogados.\n\nConfirmamos o inicio do seu atendimento. Voce recebera orientacoes sobre documentacao necessaria.\n\nAgradecemos a confianca.\nEquipe Santos e Bastos Advogados`;
        await sendTelegramWithTyping(leadFull.channel_user_id, msg, null);
        await db.from('mensagens').insert({ lead_id, de: 'bot', tipo: 'sistema', conteudo: msg, canal_origem: 'telegram' });
      }
    }

    // Register timeline event
    await registrarTimelineEvent(db, lead_id, 'status_atualizado', `Pipeline: ${lead.status_pipeline} → ${target_stage}`, null, { from: lead.status_pipeline, to: target_stage, conditions });
  });

  socket.on('disconnect', () => {
    console.log(`[socket] desconectado: ${socket.id}`);
  });
});

// ─── Sweep: Motor de Estados Automáticos ────────────────────────────────────
// Roda a cada 5 minutos no servidor. Garante consistência mesmo com browser fechado.
const SWEEP_INTERVAL = 5 * 60 * 1000; // 5 min

async function sweepOperacao() {
  const db = getSupabase();
  const agora = new Date();

  // Read SLA config from database
  let snoozeMinutos = 60;
  let abandonoTriagemHoras = 2;
  let abandonoAtendimentoHoras = 24;
  let autoReleaseMinutos = 5;

  try {
    const { data: slaConfigs } = await db.from('configuracoes_sla').select('chave, valor');
    if (slaConfigs) {
      for (const cfg of slaConfigs) {
        if (cfg.chave === 'tempo_snooze_minutos') snoozeMinutos = parseInt(cfg.valor) || 60;
        if (cfg.chave === 'tempo_abandono_triagem_horas') abandonoTriagemHoras = parseInt(cfg.valor) || 2;
        if (cfg.chave === 'tempo_abandono_atendimento_horas') abandonoAtendimentoHoras = parseInt(cfg.valor) || 24;
        if (cfg.chave === 'tempo_auto_release_minutos') autoReleaseMinutos = parseInt(cfg.valor) || 5;
      }
    }
  } catch (e) { console.error('[sweep] SLA config read fail:', e.message); }

  const SNOOZE_THRESHOLD = snoozeMinutos * 60 * 1000;
  const ABANDONO_TRIAGEM = abandonoTriagemHoras * 60 * 60 * 1000;
  const ABANDONO_ATENDIMENTO = abandonoAtendimentoHoras * 60 * 60 * 1000;
  const AUTO_RELEASE_THRESHOLD = autoReleaseMinutos * 60 * 1000;

  try {
    // 0. Auto-Release: devolver ao bot se operador não responde há X minutos
    const { data: leadsAssumidos } = await db
      .from('leads')
      .select('id, ultima_msg_em, ultima_msg_de')
      .eq('is_assumido', true)
      .not('ultima_msg_em', 'is', null);

    if (leadsAssumidos) {
      for (const lead of leadsAssumidos) {
        if (!lead.ultima_msg_em) continue;
        const diff = agora.getTime() - new Date(lead.ultima_msg_em).getTime();
        // Se última msg foi do operador e cliente não respondeu, OU
        // se última msg foi do cliente e operador não respondeu — em ambos os casos,
        // se passou o threshold, devolver ao bot
        if (diff > AUTO_RELEASE_THRESHOLD) {
          await db.from('leads').update({
            is_assumido: false,
            status_triagem: 'bot_ativo',
          }).eq('id', lead.id);
          console.log(JSON.stringify({
            level: 'info',
            msg: 'auto_release_bot',
            lead_id: lead.id,
            inatividade_min: Math.floor(diff / 60000),
            ts: agora.toISOString(),
          }));
        }
      }
    }

    // 1. Auto-Snooze: última msg do operador, cliente não respondeu
    const { data: leadsAtivos } = await db
      .from('leads')
      .select('id, ultima_msg_de, ultima_msg_em')
      .eq('status_operacao', 'ativo')
      .not('ultima_msg_em', 'is', null);

    if (leadsAtivos) {
      for (const lead of leadsAtivos) {
        if (!lead.ultima_msg_em) continue;
        const diff = agora.getTime() - new Date(lead.ultima_msg_em).getTime();
        // Se última msg foi do operador/bot e cliente não respondeu em 30min
        if (lead.ultima_msg_de !== 'lead' && diff > SNOOZE_THRESHOLD) {
          await db.from('leads').update({ status_operacao: 'em_pausa' }).eq('id', lead.id);
          io.emit('lead_status_changed', { lead_id: lead.id, status: 'em_pausa' });
        }
      }
    }

    // 2. Abandono de Triagem: leads novos parados 2h sem atendimento humano
    const limiteTriagem = new Date(agora.getTime() - ABANDONO_TRIAGEM).toISOString();
    const { data: leadsTriagem } = await db
      .from('leads')
      .select('id')
      .eq('status_operacao', 'novo')
      .lt('created_at', limiteTriagem);

    if (leadsTriagem) {
      for (const lead of leadsTriagem) {
        await db.from('leads').update({ status_operacao: 'fechado' }).eq('id', lead.id);
        await db.from('atendimentos').update({
          status: 'fechado',
          motivo_fechamento: 'abandono_triagem',
          encerrado_em: agora.toISOString(),
        }).eq('lead_id', lead.id);
        io.emit('lead_status_changed', { lead_id: lead.id, status: 'fechado' });
      }
    }

    // 3. Abandono de Atendimento: leads com humano sem resposta 24h
    const limiteAtendimento = new Date(agora.getTime() - ABANDONO_ATENDIMENTO).toISOString();
    const { data: leadsAbandono } = await db
      .from('leads')
      .select('id, ultima_msg_em')
      .in('status_operacao', ['ativo', 'em_pausa'])
      .lt('ultima_msg_em', limiteAtendimento);

    if (leadsAbandono) {
      for (const lead of leadsAbandono) {
        await db.from('leads').update({ status_operacao: 'fechado' }).eq('id', lead.id);
        await db.from('atendimentos').update({
          status: 'fechado',
          motivo_fechamento: 'abandono_atendimento',
          encerrado_em: agora.toISOString(),
        }).eq('lead_id', lead.id);
        io.emit('lead_status_changed', { lead_id: lead.id, status: 'fechado' });
      }
    }
  } catch (err) {
    console.error('[sweep] erro:', err.message);
  }
}

const _sweepOp = setInterval(sweepOperacao, SWEEP_INTERVAL);
if (_sweepOp.unref) _sweepOp.unref();

httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Storage adapter: ${process.env.STORAGE_ADAPTER || 'memory'}`);
  console.log(`Socket.io CORS: ${process.env.WEB_URL || 'http://localhost:3001'}`);
});
