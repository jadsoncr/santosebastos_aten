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

// Diagnóstico de variáveis (remover após confirmar)
app.get('/debug-env', (_req, res) => res.json({
  STORAGE_ADAPTER: process.env.STORAGE_ADAPTER || 'NÃO DEFINIDO',
  GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID ? 'OK' : 'NÃO DEFINIDO',
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? 'OK' : 'NÃO DEFINIDO',
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN ? 'OK' : 'NÃO DEFINIDO',
}));

// Teste direto de persistência no Sheets (remover após confirmar)
app.get('/test-sheets', async (_req, res) => {
  try {
    // Verificar se o JSON da service account é válido
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let credentials;
    try {
      credentials = JSON.parse(raw);
    } catch(e) {
      return res.status(500).json({ ok: false, error: 'JSON inválido: ' + e.message, raw_length: raw?.length });
    }

    const { createLead } = require('./src/storage/googleSheets');
    const id = await createLead({
      nome: 'Teste Railway',
      telefone: '00000000000',
      area: 'trabalhista',
      situacao: 'Teste direto via endpoint',
      impacto: 2, intencao: 2, score: 5, prioridade: 'MEDIO',
      flagAtencao: false, canalOrigem: 'test', resumo: 'teste', status: 'NOVO',
    });
    return res.json({ ok: true, leadId: id, client_email: credentials.client_email, sheet_id: process.env.GOOGLE_SHEETS_ID });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, sheet_id: process.env.GOOGLE_SHEETS_ID, sheet_id_length: process.env.GOOGLE_SHEETS_ID?.length });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Storage adapter: ${process.env.STORAGE_ADAPTER || 'memory'}`);
});
