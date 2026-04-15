// src/storage/index.js
// Seleciona adapter por variável de ambiente STORAGE_ADAPTER.
// Valores aceitos: 'memory' (padrão) | 'sheets'

const adapter = process.env.STORAGE_ADAPTER === 'sheets'
  ? require('./googleSheets')
  : require('./inMemory');

module.exports = adapter;
