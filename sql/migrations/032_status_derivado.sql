-- Migration 032: Status derivado automaticamente
-- status_caso: estado macro (em_andamento/aguardando_cliente/concluido)
-- status_motivo: motivo específico derivado da etapa

ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS status_caso TEXT DEFAULT 'em_andamento';
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS status_motivo TEXT;

-- CHECK constraint: status_caso must be one of the valid values
ALTER TABLE atendimentos DROP CONSTRAINT IF EXISTS check_status_caso;
ALTER TABLE atendimentos ADD CONSTRAINT check_status_caso
  CHECK (status_caso IN ('em_andamento', 'aguardando_cliente', 'concluido'));
