-- ============================================================
-- BRO Resolve — Migração 014: Chat Attachments
-- Adiciona colunas de metadados de arquivo na tabela mensagens
-- Idempotente: todas as operações usam IF NOT EXISTS
-- ============================================================

-- 1. URL do arquivo no Supabase Storage (signed URL)
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS arquivo_url TEXT;

-- 2. Nome original do arquivo (sanitizado)
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS arquivo_nome TEXT;

-- 3. Tipo MIME do arquivo (ex: application/pdf, image/jpeg)
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS arquivo_tipo TEXT;

-- 4. Tamanho do arquivo em bytes
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS arquivo_tamanho BIGINT;
