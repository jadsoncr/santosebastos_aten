-- Migration 033: Continuous Flow UX — flow_events + snapshot_version
-- Suporta o FlowOrchestrator com log semântico, optimistic locking e idempotência.
--
-- Componentes:
--   1. snapshot_version na tabela atendimentos (optimistic locking)
--   2. Tabela flow_events (log semântico de transições)
--   3. Índices otimizados para query patterns
--   4. Constraint de idempotência (UNIQUE atendimento_id + idempotency_key)
--   5. RLS policies
--   6. Statement timeout para proteção contra queries lentas

-- ══════════════════════════════════════════════════════════════
-- 1. SNAPSHOT VERSION — Optimistic Locking
-- ══════════════════════════════════════════════════════════════

ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS snapshot_version INTEGER NOT NULL DEFAULT 1;

-- Índice para version check rápido no WHERE clause do UPDATE
CREATE INDEX IF NOT EXISTS idx_atendimentos_identity_version
  ON atendimentos (identity_id, snapshot_version);

-- ══════════════════════════════════════════════════════════════
-- 2. TABELA FLOW_EVENTS — Log Semântico de Transições
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT,
  operador_id UUID,
  idempotency_key TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 3. ÍNDICES — Query Patterns Otimizados
-- ══════════════════════════════════════════════════════════════

-- Timeline por atendimento (mais recente primeiro)
CREATE INDEX IF NOT EXISTS idx_flow_events_atendimento_created
  ON flow_events (atendimento_id, created_at DESC);

-- Métricas por ação
CREATE INDEX IF NOT EXISTS idx_flow_events_action
  ON flow_events (action);

-- Filtro por estado destino
CREATE INDEX IF NOT EXISTS idx_flow_events_to_state
  ON flow_events (to_state);

-- Produtividade por operador
CREATE INDEX IF NOT EXISTS idx_flow_events_operador_created
  ON flow_events (operador_id, created_at DESC);

-- Relatórios por período
CREATE INDEX IF NOT EXISTS idx_flow_events_created
  ON flow_events (created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 4. CONSTRAINT DE IDEMPOTÊNCIA
-- ══════════════════════════════════════════════════════════════

-- Garante que a mesma transição não é registrada duas vezes
-- idempotency_key = hash(action + atendimento_id + snapshot_version)
ALTER TABLE flow_events
  ADD CONSTRAINT uq_flow_events_idempotency
  UNIQUE (atendimento_id, idempotency_key);

-- ══════════════════════════════════════════════════════════════
-- 5. RLS — Row Level Security
-- ══════════════════════════════════════════════════════════════

ALTER TABLE flow_events ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total
CREATE POLICY "service_role_full_flow_events" ON flow_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Operadores autenticados podem inserir
CREATE POLICY "authenticated_insert_flow_events" ON flow_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Operadores autenticados podem ler
CREATE POLICY "authenticated_select_flow_events" ON flow_events
  FOR SELECT TO authenticated
  USING (true);

-- ══════════════════════════════════════════════════════════════
-- 6. FUNÇÃO applyTransition — Transação Atômica
-- ══════════════════════════════════════════════════════════════
-- Executa update_state + log_transition na mesma transação.
-- Garante: idempotência, version check, timeout.

CREATE OR REPLACE FUNCTION apply_flow_transition(
  p_identity_id UUID,
  p_atendimento_id UUID,
  p_action TEXT,
  p_from_state TEXT,
  p_to_state TEXT,
  p_from_stage TEXT DEFAULT NULL,
  p_to_stage TEXT DEFAULT NULL,
  p_operador_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_snapshot_version INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_version INTEGER;
  v_new_version INTEGER;
  v_existing_event UUID;
  v_result JSONB;
BEGIN
  -- Timeout de 5s para proteção contra queries lentas/deadlocks
  SET LOCAL statement_timeout = '5000';

  -- 1. CHECK IDEMPOTENCY — se já executou, retorna resultado cacheado
  SELECT id INTO v_existing_event
  FROM flow_events
  WHERE atendimento_id = p_atendimento_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_event IS NOT NULL THEN
    -- Já executada — retorna sucesso sem re-executar (safe retry)
    RETURN jsonb_build_object(
      'status', 'already_applied',
      'event_id', v_existing_event,
      'new_version', p_snapshot_version
    );
  END IF;

  -- 2. CHECK VERSION — lock otimista via SELECT FOR UPDATE
  SELECT snapshot_version INTO v_current_version
  FROM atendimentos
  WHERE identity_id = p_identity_id
  FOR UPDATE;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'Atendimento não encontrado para identity_id: %', p_identity_id;
  END IF;

  IF v_current_version != p_snapshot_version THEN
    -- Version mismatch — outro operador já atualizou
    RAISE EXCEPTION 'STALE_STATE: version esperada=%, atual=%', p_snapshot_version, v_current_version
      USING ERRCODE = '40001'; -- serialization_failure
  END IF;

  -- 3. UPDATE STATE + INCREMENT VERSION (mesma transação)
  v_new_version := v_current_version + 1;

  UPDATE atendimentos
  SET estado_painel = p_to_state,
      snapshot_version = v_new_version,
      ultima_msg_em = now()  -- reset display time em transições
  WHERE identity_id = p_identity_id
    AND snapshot_version = p_snapshot_version;

  -- 4. LOG TRANSITION (mesma transação — atômico com update)
  INSERT INTO flow_events (
    atendimento_id, action, from_state, to_state,
    from_stage, to_stage, operador_id, idempotency_key, metadata
  ) VALUES (
    p_atendimento_id, p_action, p_from_state, p_to_state,
    p_from_stage, p_to_stage, p_operador_id, p_idempotency_key, p_metadata
  );

  -- 5. RETORNAR RESULTADO
  v_result := jsonb_build_object(
    'status', 'applied',
    'new_version', v_new_version,
    'from_state', p_from_state,
    'to_state', p_to_state
  );

  RETURN v_result;
END;
$$;

-- Permissão para authenticated chamar a função
GRANT EXECUTE ON FUNCTION apply_flow_transition TO authenticated;
GRANT EXECUTE ON FUNCTION apply_flow_transition TO service_role;
