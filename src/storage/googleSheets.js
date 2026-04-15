// src/storage/googleSheets.js
// Stub para implementação futura com Google Sheets API.
// Para ativar: defina STORAGE_ADAPTER=sheets e implemente cada função
// usando a biblioteca googleapis com Service Account credentials.
//
// Variáveis de ambiente necessárias:
//   GOOGLE_SERVICE_ACCOUNT_JSON  → JSON da service account (base64 ou raw)
//   SPREADSHEET_ID               → ID da planilha do Google Sheets
//
// Estrutura das abas esperadas:
//   SESSOES  → Sessao | EstadoAtual | Fluxo | Area | Situacao | Impacto | Intencao | Nome | CanalOrigem | CanalPreferido | UltimaMensagem | UltimaPergunta | Score | Prioridade | AtualizadoEm
//   LEADS    → DataHora | Nome | Telefone | Area | Situacao | Impacto | Intencao | Score | Prioridade | CanalOrigem | CanalPreferido | Resumo | Status | Origem
//   CLIENTES → DataHora | Nome | Telefone | TipoSolicitacao | CanalOrigem | CanalPreferido | Conteudo | Urgencia | Status | Origem
//   OUTROS   → DataHora | Nome | Telefone | Tipo | CanalOrigem | CanalPreferido | Conteudo | Status | Origem

async function getSession(sessao) {
  throw new Error('Google Sheets adapter não implementado. Use STORAGE_ADAPTER=memory.');
}

async function updateSession(sessao, data) {
  throw new Error('Google Sheets adapter não implementado.');
}

async function createLead(data) {
  throw new Error('Google Sheets adapter não implementado.');
}

async function createClient(data) {
  throw new Error('Google Sheets adapter não implementado.');
}

async function createOther(data) {
  throw new Error('Google Sheets adapter não implementado.');
}

module.exports = { getSession, updateSession, createLead, createClient, createOther };
