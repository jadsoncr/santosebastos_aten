// ══════════════════════════════════════════════════════════════
// FlowOrchestrator — Motor Central de Transição
// web/core/flow/FlowOrchestrator.ts
//
// Ponto único de controle para TODAS as transições de estado.
// Nenhum handler de componente executa lógica de transição diretamente.
//
// Fluxo:
//   1. Snapshot imutável do contexto
//   2. Gerar transition_id + idempotency_key
//   3. Lookup no Transition_Map
//   4. Executar efeitos em ordem (com timeout 5s)
//   5. Efeitos críticos abortam cadeia se falham
//   6. Efeitos de UI continuam em try-catch individual
//   7. Track behavior + SLA warning
// ══════════════════════════════════════════════════════════════

import type {
  FlowAction,
  FlowContext,
  FlowServices,
  FlowTransitionResult,
  TransitionStatus,
  FlowEffectType,
  Transition,
} from './types'
import { generateIdempotencyKey } from './types'
import { TRANSITION_MAP } from './transitions'

// Efeitos críticos — falha aborta a cadeia inteira
const CRITICAL_EFFECTS: Set<FlowEffectType> = new Set<FlowEffectType>([
  'apply_transaction',
  'derive_status',
  'emit_socket',
])

export class FlowOrchestrator {
  private services: FlowServices
  private _status: TransitionStatus = 'stable'
  private _lastResult: FlowTransitionResult | null = null
  private _isExecuting = false
  private _queue: Array<{
    resolve: (r: FlowTransitionResult) => void
    reject: (e: Error) => void
    action: FlowAction
    ctx: FlowContext
  }> = []

  constructor(services: FlowServices) {
    this.services = services
  }

  get status(): TransitionStatus {
    return this._status
  }

  get lastResult(): FlowTransitionResult | null {
    return this._lastResult
  }

  /**
   * Executa uma transição de estado.
   * Se já está executando, enfileira e aguarda.
   */
  async run(action: FlowAction, ctx: FlowContext): Promise<FlowTransitionResult> {
    if (this._isExecuting) {
      return new Promise<FlowTransitionResult>((resolve, reject) => {
        this._queue.push({ resolve, reject, action, ctx })
      })
    }

    return this._execute(action, ctx)
  }

  private async _execute(action: FlowAction, ctx: FlowContext): Promise<FlowTransitionResult> {
    this._isExecuting = true
    const startedAt = performance.now()

    // 1. Snapshot imutável
    const snapshot: Readonly<FlowContext> = Object.freeze({ ...ctx })

    // 2. Gerar IDs
    const transitionId = crypto.randomUUID()
    const idempotencyKey = generateIdempotencyKey(action, snapshot.atendimentoId, snapshot.snapshotVersion)

    // 3. Lookup no mapa
    const stateMap = TRANSITION_MAP[snapshot.currentState]
    const transition = stateMap?.[action] as Transition | undefined

    if (!transition) {
      console.warn(`[FlowOrchestrator] Transição inválida: ${snapshot.currentState} + ${action}`)
      this._isExecuting = false
      this._drainQueue()
      const result: FlowTransitionResult = {
        transitionId,
        idempotencyKey,
        snapshotVersion: snapshot.snapshotVersion,
        action,
        fromState: snapshot.currentState,
        toState: snapshot.currentState,
        effects: [],
        status: 'stable',
        startedAt,
        completedAt: performance.now(),
        durationMs: performance.now() - startedAt,
      }
      this._lastResult = result
      return result
    }

    // 4. Iniciar transição
    this._status = 'transitioning'

    const result: FlowTransitionResult = {
      transitionId,
      idempotencyKey,
      snapshotVersion: snapshot.snapshotVersion,
      action,
      fromState: snapshot.currentState,
      toState: transition.toState,
      effects: transition.effects,
      status: 'transitioning',
      startedAt,
    }

    try {
      // 5. Executar efeitos com timeout de 5s
      await Promise.race([
        this._executeEffects(snapshot, transition, action, idempotencyKey),
        this._timeout(5000),
      ])

      // 6. Sucesso
      result.status = 'stable'
      result.completedAt = performance.now()
      result.durationMs = result.completedAt - startedAt
      this._status = 'stable'

      // 7. Track behavior
      this.services.trackBehavior({
        leadId: snapshot.leadId,
        userId: snapshot.operadorId,
        eventType: `flow_${action}_completed`,
        metadata: {
          fromState: snapshot.currentState,
          toState: transition.toState,
          durationMs: result.durationMs,
        },
      })

      // 8. SLA warning
      if (result.durationMs > 3000) {
        console.warn(
          `[FlowOrchestrator] SLA warning: ${action} levou ${Math.round(result.durationMs)}ms`
        )
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      result.status = 'failed'
      result.error = errorMessage
      result.completedAt = performance.now()
      result.durationMs = result.completedAt - startedAt
      this._status = 'failed'

      // Toast de erro
      this.services.showToast(
        `Não foi possível ${action.replace(/_/g, ' ')} — tente novamente`,
        { variant: 'info', duration: 8000 }
      )
    } finally {
      this._lastResult = result
      this._isExecuting = false
      this._drainQueue()
    }

    return result
  }

  private async _executeEffects(
    snapshot: Readonly<FlowContext>,
    transition: Transition,
    action: FlowAction,
    idempotencyKey: string,
  ): Promise<void> {
    for (const effect of transition.effects) {
      const isCritical = CRITICAL_EFFECTS.has(effect)

      try {
        await this._executeEffect(effect, snapshot, transition, action, idempotencyKey)
      } catch (error) {
        if (isCritical) {
          // Efeito crítico falhou → abortar cadeia
          throw error
        }
        // Efeito de UI falhou → log e continuar
        console.warn(`[FlowOrchestrator] Efeito não-crítico falhou: ${effect}`, error)
      }
    }
  }

  private async _executeEffect(
    effect: FlowEffectType,
    snapshot: Readonly<FlowContext>,
    transition: Transition,
    action: FlowAction,
    idempotencyKey: string,
  ): Promise<void> {
    switch (effect) {
      case 'apply_transaction':
        await this.services.applyTransaction({
          ctx: snapshot,
          toState: transition.toState,
          action,
          idempotencyKey,
          metadata: snapshot.metadata,
        })
        break

      case 'derive_status':
        await this.services.deriveStatus(snapshot, transition.toState)
        break

      case 'emit_socket':
        this.services.emitSocket('estado_painel_changed', {
          identity_id: snapshot.identityId,
          lead_id: snapshot.leadId,
          estado_painel: transition.toState,
          transition_id: idempotencyKey,
          snapshot_version: snapshot.snapshotVersion + 1,
        })
        break

      case 'refetch':
        this.services.refetch()
        break

      case 'auto_select':
        this.services.autoSelect(snapshot.leadId)
        break

      case 'toast_destino':
        this.services.showToast(transition.toastMessage, {
          actionLabel: transition.toastAction,
          variant: transition.toastVariant,
          duration: 5000,
        })
        break

      case 'suggest_template':
        if (snapshot.metadata?.classificationType) {
          this.services.suggestTemplate(snapshot.metadata.classificationType as string)
        }
        break

      case 'celebrate':
        this.services.celebrate()
        break
    }
  }

  private _timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: execução excedeu ${ms}ms`)), ms)
    )
  }

  private _drainQueue(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!
      this._execute(next.action, next.ctx).then(next.resolve, next.reject)
    }
  }
}
