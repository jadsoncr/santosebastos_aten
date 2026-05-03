// ══════════════════════════════════════════════════════════════
// applyTransaction — Transação Atômica (update_state + log_transition)
// web/core/flow/effects/applyTransaction.ts
//
// Executa via RPC a função PostgreSQL `apply_flow_transition` que garante:
//   1. Check idempotency (se já executou → retorna cached)
//   2. Check version com SELECT FOR UPDATE (se stale → rejeita)
//   3. UPDATE atendimentos (estado_painel + snapshot_version)
//   4. INSERT flow_events (mesma transação)
//   5. COMMIT atômico
//
// Socket events são emitidos FORA desta função (após sucesso).
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApplyTransactionParams, ApplyTransactionResult } from '../types'

/**
 * Executa a transação atômica de fluxo via RPC do Supabase.
 *
 * @throws Error com mensagem 'STALE_STATE' se version mismatch
 * @throws Error com mensagem 'Atendimento não encontrado' se identity_id inválido
 * @throws Error genérico para falhas de rede/timeout
 */
export async function applyTransaction(
  supabase: SupabaseClient,
  params: ApplyTransactionParams
): Promise<ApplyTransactionResult> {
  const { ctx, toState, action, idempotencyKey, metadata } = params

  const { data, error } = await supabase.rpc('apply_flow_transition', {
    p_identity_id: ctx.identityId,
    p_atendimento_id: ctx.atendimentoId,
    p_action: action,
    p_from_state: ctx.currentState,
    p_to_state: toState,
    p_from_stage: ctx.currentStage,
    p_to_stage: (metadata?.toStage as string) ?? null,
    p_operador_id: ctx.operadorId,
    p_idempotency_key: idempotencyKey,
    p_snapshot_version: ctx.snapshotVersion,
    p_metadata: metadata ?? {},
  })

  if (error) {
    // Mapear erros do PostgreSQL para mensagens claras
    if (error.message?.includes('STALE_STATE')) {
      throw new Error('Caso já foi atualizado — recarregando...')
    }
    if (error.message?.includes('não encontrado')) {
      throw new Error('Atendimento não encontrado')
    }
    if (error.code === 'PGRST301' || error.message?.includes('timeout')) {
      throw new Error('Timeout — tente novamente')
    }
    throw new Error(error.message || 'Erro ao aplicar transição')
  }

  if (!data) {
    throw new Error('Resposta vazia do servidor')
  }

  // Resultado da função PostgreSQL
  const result = data as { status: string; new_version: number; event_id?: string }

  return {
    status: result.status === 'already_applied' ? 'already_applied' : 'applied',
    newVersion: result.new_version,
  }
}
