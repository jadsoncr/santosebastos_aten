// ══════════════════════════════════════════════════════════════
// Property 14: Reject-on-Stale Concurrency
// Property 7: Transition Idempotence (backend)
// Feature: continuous-flow-ux
//
// Property 14:
//   Para qualquer transição onde ctx.snapshotVersion não corresponde
//   à versão atual no banco, applyTransaction deve falhar.
//   Nenhuma mutação de estado deve ocorrer.
//   Nenhum flow_event deve ser inserido.
//
// Property 7:
//   Executar mesma transição 2x com mesmo idempotency_key →
//   segunda execução retorna 'already_applied' sem re-executar.
//
// Valida: Requisitos 19.2, 19.4, 2.6, 23.2, 23.6
// ══════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest'
import fc from 'fast-check'
import { applyTransaction } from '../effects/applyTransaction'
import type { ApplyTransactionParams, FlowContext, EstadoPainel, FlowAction } from '../types'
import { generateIdempotencyKey } from '../types'

// ── Mock Supabase ──

function createMockSupabase(options: {
  currentVersion?: number
  existingIdempotencyKey?: string | null
  shouldTimeout?: boolean
  shouldError5xx?: boolean
}) {
  const { currentVersion = 1, existingIdempotencyKey = null, shouldTimeout = false, shouldError5xx = false } = options

  return {
    rpc: vi.fn(async (_fnName: string, params: Record<string, unknown>) => {
      if (shouldTimeout) {
        return { data: null, error: { message: 'timeout', code: 'PGRST301' } }
      }
      if (shouldError5xx) {
        return { data: null, error: { message: 'Internal server error', code: '500' } }
      }

      const pVersion = params.p_snapshot_version as number
      const pIdempotencyKey = params.p_idempotency_key as string

      // 1. Check idempotency
      if (existingIdempotencyKey && pIdempotencyKey === existingIdempotencyKey) {
        return {
          data: { status: 'already_applied', new_version: pVersion, event_id: 'existing-uuid' },
          error: null,
        }
      }

      // 2. Check version (simulate STALE_STATE)
      if (pVersion !== currentVersion) {
        return {
          data: null,
          error: { message: `STALE_STATE: version esperada=${pVersion}, atual=${currentVersion}`, code: '40001' },
        }
      }

      // 3. Success
      return {
        data: { status: 'applied', new_version: pVersion + 1 },
        error: null,
      }
    }),
  } as any
}

// ── Generators ──

const arbEstadoPainel = fc.constantFrom<EstadoPainel>('triagem', 'em_atendimento', 'cliente', 'encerrado')
const arbFlowAction = fc.constantFrom<FlowAction>(
  'classificar', 'avancar_etapa', 'fechar', 'perder', 'reativar', 'delegar', 'novo_atendimento'
)
const arbVersion = fc.nat({ max: 1000 })

const arbFlowContext = fc.record({
  atendimentoId: fc.uuid(),
  identityId: fc.uuid(),
  leadId: fc.uuid(),
  currentState: arbEstadoPainel,
  currentStage: fc.option(fc.constantFrom(
    'analise_viabilidade', 'retorno_cliente', 'solicitacao_documentos',
    'envio_contrato', 'distribuicao'
  ), { nil: null }),
  operadorId: fc.uuid(),
  snapshotVersion: arbVersion,
}) as fc.Arbitrary<FlowContext>

describe('Feature: continuous-flow-ux, Property 14: Reject-on-Stale Concurrency', () => {

  it('version mismatch → rejeita com erro STALE_STATE', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlowContext,
        arbFlowAction,
        arbEstadoPainel,
        fc.nat({ max: 100 }).filter(v => v > 0), // offset para criar mismatch
        async (ctx, action, toState, offset) => {
          // Backend tem versão diferente (ctx.version + offset)
          const supabase = createMockSupabase({ currentVersion: ctx.snapshotVersion + offset })
          const idempotencyKey = generateIdempotencyKey(action, ctx.atendimentoId, ctx.snapshotVersion)

          const params: ApplyTransactionParams = { ctx, toState, action, idempotencyKey }

          await expect(applyTransaction(supabase, params)).rejects.toThrow('Caso já foi atualizado')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('version match → transição aplicada com sucesso', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlowContext,
        arbFlowAction,
        arbEstadoPainel,
        async (ctx, action, toState) => {
          // Backend tem mesma versão
          const supabase = createMockSupabase({ currentVersion: ctx.snapshotVersion })
          const idempotencyKey = generateIdempotencyKey(action, ctx.atendimentoId, ctx.snapshotVersion)

          const params: ApplyTransactionParams = { ctx, toState, action, idempotencyKey }
          const result = await applyTransaction(supabase, params)

          expect(result.status).toBe('applied')
          expect(result.newVersion).toBe(ctx.snapshotVersion + 1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: continuous-flow-ux, Property 7: Transition Idempotence (backend)', () => {

  it('mesma idempotency_key 2x → segunda retorna already_applied sem re-executar', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlowContext,
        arbFlowAction,
        arbEstadoPainel,
        async (ctx, action, toState) => {
          const idempotencyKey = generateIdempotencyKey(action, ctx.atendimentoId, ctx.snapshotVersion)

          // Simula que a key já existe no banco
          const supabase = createMockSupabase({
            currentVersion: ctx.snapshotVersion,
            existingIdempotencyKey: idempotencyKey,
          })

          const params: ApplyTransactionParams = { ctx, toState, action, idempotencyKey }
          const result = await applyTransaction(supabase, params)

          expect(result.status).toBe('already_applied')
          // Versão não incrementa (não re-executou)
          expect(result.newVersion).toBe(ctx.snapshotVersion)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('idempotency_key diferente (nova versão) → nova transição', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlowContext,
        arbFlowAction,
        arbEstadoPainel,
        async (ctx, action, toState) => {
          const idempotencyKey = generateIdempotencyKey(action, ctx.atendimentoId, ctx.snapshotVersion)

          // Key existente é de uma versão anterior
          const oldKey = generateIdempotencyKey(action, ctx.atendimentoId, Math.max(0, ctx.snapshotVersion - 1))

          const supabase = createMockSupabase({
            currentVersion: ctx.snapshotVersion,
            existingIdempotencyKey: oldKey !== idempotencyKey ? oldKey : null,
          })

          const params: ApplyTransactionParams = { ctx, toState, action, idempotencyKey }
          const result = await applyTransaction(supabase, params)

          expect(result.status).toBe('applied')
          expect(result.newVersion).toBe(ctx.snapshotVersion + 1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: continuous-flow-ux, Error handling', () => {

  it('timeout → erro com mensagem clara', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlowContext,
        arbFlowAction,
        arbEstadoPainel,
        async (ctx, action, toState) => {
          const supabase = createMockSupabase({ shouldTimeout: true })
          const idempotencyKey = generateIdempotencyKey(action, ctx.atendimentoId, ctx.snapshotVersion)

          const params: ApplyTransactionParams = { ctx, toState, action, idempotencyKey }

          await expect(applyTransaction(supabase, params)).rejects.toThrow('Timeout')
        }
      ),
      { numRuns: 20 }
    )
  })

  it('erro 5xx → erro propagado', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFlowContext,
        arbFlowAction,
        arbEstadoPainel,
        async (ctx, action, toState) => {
          const supabase = createMockSupabase({ shouldError5xx: true })
          const idempotencyKey = generateIdempotencyKey(action, ctx.atendimentoId, ctx.snapshotVersion)

          const params: ApplyTransactionParams = { ctx, toState, action, idempotencyKey }

          await expect(applyTransaction(supabase, params)).rejects.toThrow()
        }
      ),
      { numRuns: 20 }
    )
  })
})
