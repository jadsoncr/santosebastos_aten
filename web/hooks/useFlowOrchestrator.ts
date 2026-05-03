'use client'

// ══════════════════════════════════════════════════════════════
// useFlowOrchestrator — Hook de integração real
// web/hooks/useFlowOrchestrator.ts
//
// Instancia o FlowOrchestrator com serviços reais:
//   - applyTransaction via Supabase RPC
//   - deriveStatus via journeyModel
//   - emitSocket via Socket.io (stub por enquanto)
//   - showToast via callback
//   - autoSelect via callback
//   - refetch via callback
//
// Uso:
//   const { run, status } = useFlowOrchestrator({ refetch, onLeadClosed })
//   await run('classificar', ctx)
// ══════════════════════════════════════════════════════════════

import { useRef, useState, useCallback } from 'react'
import { FlowOrchestrator } from '@/core/flow/FlowOrchestrator'
import type {
  FlowServices,
  FlowAction,
  FlowContext,
  TransitionStatus,
  FlowTransitionResult,
} from '@/core/flow/types'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'

interface UseFlowOrchestratorDeps {
  refetch: () => void
  onLeadClosed?: () => void
  onToast?: (message: string, type: 'success' | 'error') => void
}

export function useFlowOrchestrator(deps: UseFlowOrchestratorDeps) {
  const socket = useSocket()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const [status, setStatus] = useState<TransitionStatus>('stable')
  const [lastError, setLastError] = useState<string | null>(null)

  const orchestratorRef = useRef<FlowOrchestrator | null>(null)

  // Stable refs for deps (avoid stale closures)
  const depsRef = useRef(deps)
  depsRef.current = deps

  // Lazy init supabase client (only on client)
  if (!supabaseRef.current && typeof window !== 'undefined') {
    supabaseRef.current = createClient()
  }

  if (!orchestratorRef.current && typeof window !== 'undefined' && supabaseRef.current) {
    const services: FlowServices = {
      applyTransaction: async ({ ctx, toState, action, idempotencyKey, metadata }) => {
        const supabase = supabaseRef.current!

        console.log('[FlowOrchestrator] applyTransaction:', { action, toState, version: ctx.snapshotVersion })

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
          console.error('[FlowOrchestrator] applyTransaction error:', error)
          if (error.message?.includes('STALE_STATE')) {
            throw new Error('Caso já foi atualizado — recarregando...')
          }
          if (error.code === 'PGRST301' || error.message?.includes('timeout')) {
            throw new Error('Timeout — tente novamente')
          }
          throw new Error(error.message || 'Erro ao aplicar transição')
        }

        if (!data) throw new Error('Resposta vazia do servidor')

        const result = data as { status: string; new_version: number }
        console.log('[FlowOrchestrator] applyTransaction success:', result)

        return {
          status: result.status === 'already_applied' ? 'already_applied' as const : 'applied' as const,
          newVersion: result.new_version,
        }
      },

      deriveStatus: async (ctx, toState) => {
        // Derive status_caso + status_motivo based on the transition
        // For now, only derive on specific transitions
        const supabase = supabaseRef.current!
        if (toState === 'cliente') {
          await supabase
            .from('atendimentos')
            .update({ status_caso: 'concluido', status_motivo: 'finalizado' })
            .eq('identity_id', ctx.identityId)
        } else if (toState === 'encerrado') {
          await supabase
            .from('atendimentos')
            .update({ status_caso: 'concluido', status_motivo: 'perdido' })
            .eq('identity_id', ctx.identityId)
        }
        // em_atendimento → derive from journeyModel (handled by metadata in applyTransaction)
        console.log('[FlowOrchestrator] deriveStatus:', { toState })
      },

      emitSocket: (event, payload) => {
        console.log('[FlowOrchestrator] emitSocket:', event, payload)
        if (socket) {
          socket.emit(event, payload)
        }
      },

      showToast: (message, options) => {
        console.log('[FlowOrchestrator] showToast:', message, options)
        const type = options.variant === 'celebration' || options.variant === 'success' ? 'success' : 'error'
        depsRef.current.onToast?.(message, type as 'success' | 'error')
      },

      autoSelect: (excludeLeadId) => {
        console.log('[FlowOrchestrator] autoSelect: excluding', excludeLeadId)
        depsRef.current.onLeadClosed?.()
      },

      refetch: () => {
        console.log('[FlowOrchestrator] refetch')
        depsRef.current.refetch()
      },

      suggestTemplate: (classificationType) => {
        console.log('[FlowOrchestrator] suggestTemplate:', classificationType)
        // Phase 4: will show inline panel
      },

      celebrate: () => {
        console.log('[FlowOrchestrator] celebrate 🎉')
        // Phase 4: will trigger animation
      },

      trackBehavior: ({ leadId, userId, eventType, metadata }) => {
        console.log('[FlowOrchestrator] trackBehavior:', eventType, metadata)
        // Phase 5: will integrate with behaviorTracker
      },
    }

    orchestratorRef.current = new FlowOrchestrator(services)
  }

  const run = useCallback(async (
    action: FlowAction,
    ctx: FlowContext
  ): Promise<FlowTransitionResult> => {
    if (!orchestratorRef.current) {
      console.error('[FlowOrchestrator] Not initialized yet (SSR?)')
      return {
        transitionId: '',
        idempotencyKey: '',
        snapshotVersion: ctx.snapshotVersion,
        action,
        fromState: ctx.currentState,
        toState: ctx.currentState,
        effects: [],
        status: 'failed',
        error: 'Orchestrator not initialized',
        startedAt: 0,
        completedAt: 0,
        durationMs: 0,
      }
    }

    setStatus('transitioning')
    setLastError(null)

    console.log('[FlowOrchestrator] run:', action, {
      state: ctx.currentState,
      version: ctx.snapshotVersion,
    })

    const result = await orchestratorRef.current!.run(action, ctx)

    setStatus(result.status)
    if (result.error) {
      setLastError(result.error)
    }

    console.log('[FlowOrchestrator] result:', {
      status: result.status,
      duration: result.durationMs,
      error: result.error,
    })

    return result
  }, [])

  return {
    run,
    status,
    lastError,
    isTransitioning: status === 'transitioning',
    isFailed: status === 'failed',
  }
}
