require('dotenv').config();

const express = require('express');
const normalize = require('./src/normalizer');
const { process: processar } = require('./src/stateMachine');
const { buildResponse } = require('./src/responder');

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
        // áudio, foto, sticker, etc — pede que escreva
        await sendTelegram(tgMsg.chat.id, 'Recebi seu áudio 😊\n\nPra te ajudar mais rápido, pode me escrever resumido aqui o que aconteceu?');
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

    const resultado = await processar(sessao, mensagem, canal);
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
