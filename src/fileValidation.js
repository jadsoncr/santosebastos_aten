/**
 * fileValidation.js — Validação e utilitários para arquivos do chat (CommonJS)
 *
 * Constantes e funções compartilhadas para validação de uploads.
 * Espelha web/utils/fileValidation.ts para o backend Node.js.
 */

const { randomUUID } = require('crypto');

/** Limite máximo de tamanho por arquivo: 10 MB */
const LIMITE_TAMANHO = 10 * 1024 * 1024;

/** Tipos MIME aceitos para upload */
const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/wav',
];

/**
 * Valida se o tamanho do arquivo está dentro do limite.
 * Retorna { valid: true } se size <= 10 MB, senão { valid: false, error }.
 */
function validateFileSize(size) {
  if (size <= LIMITE_TAMANHO) {
    return { valid: true };
  }
  return { valid: false, error: 'Arquivo excede o limite de 10 MB' };
}

/**
 * Valida se o tipo MIME do arquivo é permitido.
 * Retorna { valid: true } se mimeType está em TIPOS_PERMITIDOS, senão { valid: false, error }.
 */
function validateFileType(mimeType) {
  if (TIPOS_PERMITIDOS.includes(mimeType)) {
    return { valid: true };
  }
  return { valid: false, error: 'Tipo de arquivo não permitido' };
}

/**
 * Sanitiza o nome do arquivo: prepend UUID, remove caracteres especiais.
 * Mantém apenas alfanuméricos, hífens, underscores e pontos.
 */
function sanitizeFileName(name) {
  const uuid = randomUUID();
  // Remove tudo que não é alfanumérico, hífen, underscore ou ponto
  const sanitized = name.replace(/[^a-zA-Z0-9\-_.]/g, '');
  return `${uuid}_${sanitized}`;
}

/**
 * Formata tamanho em bytes para string legível ("1.5 MB", "340 KB").
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${parseFloat(mb.toFixed(1))} MB`;
  }

  if (bytes >= 1024) {
    const kb = bytes / 1024;
    return `${parseFloat(kb.toFixed(1))} KB`;
  }

  return `${bytes} B`;
}

module.exports = {
  LIMITE_TAMANHO,
  TIPOS_PERMITIDOS,
  validateFileSize,
  validateFileType,
  sanitizeFileName,
  formatFileSize,
};
