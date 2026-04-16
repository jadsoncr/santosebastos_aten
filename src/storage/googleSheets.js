const { google } = require('googleapis');
const { randomUUID } = require('crypto');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não definida');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function appendRow(tab, values) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

function fmt(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'SIM' : 'NAO';
  return String(val);
}

async function createLead(data) {
  const leadId = data.leadId || randomUUID();
  const row = [
    new Date().toISOString(),
    leadId,
    fmt(data.status || 'NOVO'),
    fmt(data.nome),
    fmt(data.telefone),
    fmt(data.area || data.fluxo),
    fmt(data.situacao),
    fmt(data.impacto),
    fmt(data.intencao),
    fmt(data.score),
    fmt(data.prioridade),
    fmt(data.flagAtencao),
    fmt(data.canalOrigem),
    fmt(data.resumo || data.ultimaMensagem),
  ];
  await appendRow('Leads', row);
  return leadId;
}

async function createClient(data) {
  const leadId = data.leadId || randomUUID();
  const row = [
    new Date().toISOString(),
    leadId,
    fmt(data.status || 'NOVO'),
    fmt(data.nome),
    fmt(data.telefone),
    'cliente',
    '',
    '',
    '',
    '',
    fmt(data.urgencia),
    '',
    fmt(data.canalOrigem),
    fmt(data.conteudo),
  ];
  await appendRow('Clientes', row);
  return leadId;
}

async function createOther(data) {
  const leadId = data.leadId || randomUUID();
  const row = [
    new Date().toISOString(),
    leadId,
    fmt(data.status || 'NOVO'),
    fmt(data.nome),
    fmt(data.telefone),
    'outros',
    fmt(data.tipo),
    '',
    '',
    '',
    '',
    '',
    fmt(data.canalOrigem),
    fmt(data.conteudo),
  ];
  await appendRow('Outros', row);
  return leadId;
}

async function getSession() {
  throw new Error('Google Sheets adapter não suporta getSession. Use STORAGE_ADAPTER=memory para sessões.');
}

async function updateSession() {
  throw new Error('Google Sheets adapter não suporta updateSession. Use STORAGE_ADAPTER=memory para sessões.');
}

module.exports = { createLead, createClient, createOther, getSession, updateSession };
