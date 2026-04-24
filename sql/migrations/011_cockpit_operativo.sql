-- 011_cockpit_operativo.sql
-- Cockpit Operativo v1.0: colunas de suporte para canal de origem e persona bot
-- Idempotente: todas as operações usam IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

-- 1. Coluna canal_origem na mensagens (rastrear canal de cada mensagem)
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS canal_origem TEXT;

-- 2. Coluna persona_nome na mensagens (nome da persona bot que enviou)
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS persona_nome TEXT;

-- 3. Índice em identity_channels(identity_id) para buscas rápidas
-- Nota: já existe como idx_identity_channels_identity no schema.sql,
-- mas garantimos idempotência caso o nome seja diferente
CREATE INDEX IF NOT EXISTS idx_identity_channels_identity_id
  ON identity_channels(identity_id);

-- 4. Índice para busca de identidades por nome (vinculação de canais)
CREATE INDEX IF NOT EXISTS idx_identities_nome
  ON identities(nome);

-- 5. Índice para busca de identidades por telefone (vinculação de canais)
CREATE INDEX IF NOT EXISTS idx_identities_telefone
  ON identities(telefone);
