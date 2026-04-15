require('dotenv').config();

const express = require('express');
const normalize = require('./src/normalizer');
const { process: processar } = require('./src/stateMachine');
const { buildResponse } = require('./src/responder');

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    const { sessao, mensagem, canal } = normalize(req.body);

    if (!sessao) {
      return res.status(400).json({ error: 'Campo "sessao" é obrigatório.' });
    }

    const resultado = await processar(sessao, mensagem, canal);
    return res.json(buildResponse(resultado));

  } catch (err) {
    console.error('[webhook error]', err);
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
