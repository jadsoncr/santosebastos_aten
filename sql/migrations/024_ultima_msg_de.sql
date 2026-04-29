-- 024: Add ultima_msg_de field to leads table
-- Tracks who sent the last message: 'operador' or 'cliente'
-- Used by sweep conditions and sidebar filters

ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_msg_de TEXT;

-- Backfill: set based on last message per lead
UPDATE leads l SET ultima_msg_de = (
  SELECT CASE WHEN m.de = 'bot' OR m.operador_id IS NOT NULL THEN 'operador' ELSE 'cliente' END
  FROM mensagens m WHERE m.lead_id = l.id ORDER BY m.created_at DESC LIMIT 1
) WHERE ultima_msg_de IS NULL;
