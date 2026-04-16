require('dotenv').config();

const express = require('express');
const normalize = require('./src/normalizer');
const { process: processar } = require('./src/stateMachine');
const { buildResponse } = require('./src/responder');
const sessionManager = require('./src/sessionManager');
const { createAbandono } = require('./src/storage/googleSheets');

const ABANDONO_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
const RESET_TIMEOUT_MS   = 24 * 60 * 60 * 1000; // 24 horas → reinicia sessão
const ESTADOS_FINAIS = ['pos_final', 'encerramento', 'final_lead', 'final_cliente'];

async function checkAbandono(sess) {
  if (!sess.atualizadoEm) return;
  if (ESTADOS_FINAIS.includes(sess.estadoAtual)) return;
  if (sess.statusSessao === 'ABANDONOU') return;
  if (sess.estadoAtual === 'start' && !sess.ultimaMensagem) return; // nunca interagiu

  const diff = Date.now() - new Date(sess.atualizadoEm).getTime();
  if (diff < ABANDONO_TIMEOUT_MS) return;

  try {
    await createAbandono({
      sessao: sess.sessao,
      fluxo: sess.fluxo,
      ultimoEstado: sess.estadoAtual,
      score: sess.score,
      prioridade: sess.prioridade,
      nome: sess.nome,
      canalOrigem: sess.canalOrigem,
      mensagensEnviadas: sess.mensagensEnviadas || 0,
    });

    if (diff >= RESET_TIMEOUT_MS) {
      // sumiu >24h — reinicia sessão para nova conversa
      await sessionManager.resetSession(sess.sessao, sess.canalOrigem);
    } else {
      await sessionManager.updateSession(sess.sessao, { statusSessao: 'ABANDONOU' });
    }
  } catch (err) {
    console.error('[checkAbandono error]', err.message);
  }
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function sendTelegram(chat_id, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text }),
  });
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
        const sess = await sessionManager.getSession(chatId, 'telegram');
        const count = (sess.audioCount || 0) + 1;
        await sessionManager.updateSession(chatId, { audioCount: count });

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

    // Detecta abandono antes de processar nova mensagem
    const sessAntes = await sessionManager.getSession(sessao, canal);
    await checkAbandono(sessAntes);

    const resultado = await processar(sessao, mensagem, canal);

    // Incrementa contador de mensagens
    await sessionManager.updateSession(sessao, {
      mensagensEnviadas: (sessAntes.mensagensEnviadas || 0) + 1,
      statusSessao: ESTADOS_FINAIS.includes(resultado.estado) ? 'FINALIZADO' : 'ATIVO',
    });
    const resposta = buildResponse(resultado);

    if (isTelegram) {
      await sendTelegram(tgMsg.chat.id, resposta.message);
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Storage adapter: ${process.env.STORAGE_ADAPTER || 'memory'}`);
});
