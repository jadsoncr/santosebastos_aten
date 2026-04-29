-- 027_behavior_events.sql
-- Tabela de eventos comportamentais do operador.
-- Append-only para analytics — sem foreign keys para evitar overhead em inserts fire-and-forget.

CREATE TABLE IF NOT EXISTS lead_behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  user_id UUID,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice composto para consultas de métricas diárias (filtro por tipo + data)
CREATE INDEX IF NOT EXISTS idx_behavior_events_type_created
  ON lead_behavior_events (event_type, created_at);

-- Consulta de métrica diária de priorização (referência):
-- SELECT
--   COUNT(*) FILTER (WHERE event_type = 'lead_opened' AND metadata->>'was_critical' = 'true') AS correct,
--   COUNT(*) FILTER (WHERE event_type = 'ignored_critical') AS ignored
-- FROM lead_behavior_events
-- WHERE created_at >= NOW() - INTERVAL '1 day';
