-- ============================================================
-- BRO Resolve — Migração 006: Operação Ativa
-- Campos de última mensagem + status de snooze
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_msg_de TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_msg_em TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_operacao TEXT DEFAULT 'novo';
-- status_operacao: 'novo' | 'ativo' | 'em_pausa' | 'fechado'

ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS motivo_fechamento TEXT;
-- motivo_fechamento: 'abandono_triagem' | 'abandono_atendimento' | 'sem_perfil' | 'preco' | 'concorrente' | 'perda_contato' | 'erro_bot'
