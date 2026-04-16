// src/storage/index.js
// Sessões sempre em memória (stateful, por request).
// Persistência final (createLead/createClient/createOther) usa o adapter configurado.
//   STORAGE_ADAPTER=memory  → tudo em memória (padrão/dev)
//   STORAGE_ADAPTER=sheets  → sessões em memória, persistência no Google Sheets

const memory = require('./inMemory');
const sheets = require('./googleSheets');

const useSheets = process.env.STORAGE_ADAPTER === 'sheets';

module.exports = {
  getSession:    memory.getSession,
  updateSession: memory.updateSession,
  createLead:    useSheets ? sheets.createLead   : memory.createLead,
  createClient:  useSheets ? sheets.createClient : memory.createClient,
  createOther:   useSheets ? sheets.createOther  : memory.createOther,
  _clear:        memory._clear,
  _getAll:       memory._getAll,
};
