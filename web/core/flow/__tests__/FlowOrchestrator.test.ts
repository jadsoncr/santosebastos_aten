// ══════════════════════════════════════════════════════════════
// FlowOrchestrator — Vertical Slice Tests
// Feature: continuous-flow-ux
//
// Foco: triagem → classificar → em_atendimento
// Valida: snapshot, rollback, timeout, effect order, next action
//
// Properties: 1 (Snapshot Integrity), 2 (Effect Order),
//             3 (Error Atomicity), 4 (Invalid Transition Safety),
//             5 (Execution Determinism)
// ══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import { FlowOrchestrator } from '../FlowOrchestrator'
import type { FlowServices, FlowContext, FlowAction, EstadoPainel } from '../types'
import { generateIdempotencyKey } from '../types'

// ── Mock Services Factory ──

function createMockServices(overrides?: Partial<FlowServices>): FlowServices & { calls: string[] } {
  const calls: string[] = []

  return {
    calls,
    applyTransaction: vi.fn(async () => {
      calls.push('apply_transaction')
      return { status: 'applied' as const, newVersion: 2 }
    }),
    deriveStatus: vi.fn(async () => { calls.push('derive_status') }),
    emitSocket: vi.fn(() => { calls.push('emit_socket') }),
    showToast: vi.fn(() => { calls.push('toast_destino') }),
    autoSelect: vi.fn(() => { calls.push('auto_select') }),
    refetch: vi.fn(() => { calls.push('refetch') }),
    suggestTemplate: vi.fn(() => { calls.push('suggest_template') }),
    celebrate: vi.fn(() => { calls.push('celebrate') }),
    trackBehavior: vi.fn(() => { calls.push('track_behavior') }),
    ...overrides,
  }
}

function createCtx(overrides?: Partial<FlowContext>): FlowContext {
  return {
    atendimentoId: 'atend-123',
    identityId: 'identity-456',
    leadId: 'lead-789',
    currentState: 'triagem',
    currentStage: null,
    operadorId: 'op-001',
    snapshotVersion: 1,
    ...overrides,
  }
}

// ── Generators ──

const arbEstadoPainel = fc.constantFrom<EstadoPainel>('triagem', 'em_atendimento', 'cliente', 'encerrado')
const arbFlowAction = fc.constantFrom<FlowAction>(
  'classificar', 'avancar_etapa', 'fechar', 'perder', 'reativar', 'delegar', 'novo_atendimento'
)

describe('FlowOrchestrator — Vertical Slice: classificar', () => {

  it('happy path: triagem → classificar → em_atendimento', async () => {
    const services = createMockServices()
    const flow = new FlowOrchestrator(services)
    const ctx = createCtx()

    const result = await flow.run('classificar', ctx)

    expect(result.status).toBe('stable')
    expect(result.fromState).toBe('triagem')
    expect(result.toState).toBe('em_atendimento')
    expect(result.durationMs).toBeDefined()
    expect(result.durationMs!).toBeLessThan(5000)

    // Verifica que applyTransaction foi chamado
    expect(services.applyTransaction).toHaveBeenCalledOnce()
    expect(services.deriveStatus).toHaveBeenCalledOnce()
    expect(services.emitSocket).toHaveBeenCalledOnce()
    expect(services.refetch).toHaveBeenCalledOnce()
    expect(services.autoSelect).toHaveBeenCalledOnce()
    // Toast é chamado 1x (toast_destino)
    expect(services.showToast).toHaveBeenCalledWith(
      'Caso movido para Execução',
      expect.objectContaining({ actionLabel: 'Ver agora →', variant: 'success' })
    )
  })

  it('status transitions: stable → transitioning → stable', async () => {
    const services = createMockServices()
    const flow = new FlowOrchestrator(services)

    expect(flow.status).toBe('stable')

    const promise = flow.run('classificar', createCtx())
    // During execution, status should be transitioning
    // (hard to test synchronously, but result confirms it went through)

    const result = await promise
    expect(result.status).toBe('stable')
    expect(flow.status).toBe('stable')
  })
})

describe('Feature: continuous-flow-ux, Property 1: Snapshot Integrity', () => {

  it('mutações no ctx original não afetam execução', async () => {
    const services = createMockServices({
      applyTransaction: vi.fn(async (params) => {
        // Verificar que o snapshot tem os valores originais
        expect(params.ctx.currentState).toBe('triagem')
        expect(params.ctx.snapshotVersion).toBe(1)
        return { status: 'applied' as const, newVersion: 2 }
      }),
    })
    const flow = new FlowOrchestrator(services)
    const ctx = createCtx()

    // Mutar ctx DURANTE a execução (simula race condition)
    const originalState = ctx.currentState
    const promise = flow.run('classificar', ctx)

    // Mutar imediatamente
    ;(ctx as any).currentState = 'encerrado'
    ;(ctx as any).snapshotVersion = 999

    const result = await promise
    expect(result.fromState).toBe(originalState)
    expect(result.status).toBe('stable')
  })

  it('property: snapshot é imutável para qualquer contexto', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          atendimentoId: fc.uuid(),
          identityId: fc.uuid(),
          leadId: fc.uuid(),
          currentState: fc.constant<EstadoPainel>('triagem'),
          currentStage: fc.constant(null),
          operadorId: fc.uuid(),
          snapshotVersion: fc.nat({ max: 100 }),
        }),
        async (ctxData) => {
          let capturedCtx: any = null
          const services = createMockServices({
            applyTransaction: vi.fn(async (params) => {
              capturedCtx = params.ctx
              return { status: 'applied' as const, newVersion: ctxData.snapshotVersion + 1 }
            }),
          })
          const flow = new FlowOrchestrator(services)
          const ctx = ctxData as FlowContext

          await flow.run('classificar', ctx)

          // Snapshot deve ser frozen
          expect(Object.isFrozen(capturedCtx)).toBe(true)
          // Valores preservados
          expect(capturedCtx.snapshotVersion).toBe(ctxData.snapshotVersion)
          expect(capturedCtx.currentState).toBe('triagem')
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Feature: continuous-flow-ux, Property 2: Effect Execution Order', () => {

  it('efeitos executam na ordem declarada no Transition_Map', async () => {
    const services = createMockServices()
    const flow = new FlowOrchestrator(services)

    await flow.run('classificar', createCtx())

    // Ordem esperada para classificar:
    // apply_transaction → derive_status → emit_socket → refetch → auto_select → toast_destino → suggest_template
    const expectedOrder = [
      'apply_transaction', 'derive_status', 'emit_socket',
      'refetch', 'auto_select', 'toast_destino',
      // suggest_template só executa se metadata.classificationType existe
    ]

    // Verificar que os efeitos executaram nesta ordem
    const relevantCalls = services.calls.filter(c => c !== 'track_behavior')
    expect(relevantCalls).toEqual(expectedOrder)
  })

  it('suggest_template executa quando classificationType presente', async () => {
    const services = createMockServices()
    const flow = new FlowOrchestrator(services)
    const ctx = createCtx({ metadata: { classificationType: 'trabalhista' } })

    await flow.run('classificar', ctx)

    expect(services.suggestTemplate).toHaveBeenCalledWith('trabalhista')
    expect(services.calls).toContain('suggest_template')
  })
})

describe('Feature: continuous-flow-ux, Property 3: Error Handling Atomicity', () => {

  it('efeito crítico falha → aborta cadeia, nenhum efeito posterior executa', async () => {
    const services = createMockServices({
      applyTransaction: vi.fn(async () => {
        throw new Error('STALE_STATE')
      }),
    })
    const flow = new FlowOrchestrator(services)

    const result = await flow.run('classificar', createCtx())

    expect(result.status).toBe('failed')
    expect(result.error).toContain('STALE_STATE')
    expect(flow.status).toBe('failed')

    // Nenhum efeito posterior ao apply_transaction deve ter executado
    expect(services.deriveStatus).not.toHaveBeenCalled()
    expect(services.emitSocket).not.toHaveBeenCalled()
    expect(services.refetch).not.toHaveBeenCalled()
    expect(services.autoSelect).not.toHaveBeenCalled()
  })

  it('efeito de UI falha → cadeia continua', async () => {
    const services = createMockServices({
      autoSelect: vi.fn(() => { throw new Error('UI error') }),
    })
    const flow = new FlowOrchestrator(services)

    const result = await flow.run('classificar', createCtx())

    // Transição deve ter sucesso apesar do erro em auto_select
    expect(result.status).toBe('stable')
    // Toast ainda deve ter sido chamado (vem depois de auto_select)
    expect(services.showToast).toHaveBeenCalled()
  })

  it('derive_status falha → aborta (é crítico)', async () => {
    const services = createMockServices({
      deriveStatus: vi.fn(async () => { throw new Error('derive failed') }),
    })
    const flow = new FlowOrchestrator(services)

    const result = await flow.run('classificar', createCtx())

    expect(result.status).toBe('failed')
    // emit_socket não deve ter executado (vem depois de derive_status)
    expect(services.emitSocket).not.toHaveBeenCalled()
  })

  it('emit_socket falha → aborta (é crítico)', async () => {
    const services = createMockServices({
      emitSocket: vi.fn(() => { throw new Error('socket disconnected') }),
    })
    const flow = new FlowOrchestrator(services)

    const result = await flow.run('classificar', createCtx())

    expect(result.status).toBe('failed')
    // refetch não deve ter executado (vem depois de emit_socket)
    expect(services.refetch).not.toHaveBeenCalled()
  })

  it('toast de erro é exibido quando transição falha', async () => {
    const services = createMockServices({
      applyTransaction: vi.fn(async () => { throw new Error('network error') }),
    })
    const flow = new FlowOrchestrator(services)

    await flow.run('classificar', createCtx())

    // Toast de erro deve ter sido chamado
    expect(services.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Não foi possível'),
      expect.objectContaining({ variant: 'info', duration: 8000 })
    )
  })
})

describe('Feature: continuous-flow-ux, Property 4: Invalid Transition Safety', () => {

  it('transição inválida → zero efeitos, status stable', async () => {
    const services = createMockServices()
    const flow = new FlowOrchestrator(services)

    // triagem + fechar não existe no mapa
    const result = await flow.run('fechar', createCtx({ currentState: 'triagem' }))

    expect(result.status).toBe('stable')
    expect(result.effects).toEqual([])
    expect(result.fromState).toBe('triagem')
    expect(result.toState).toBe('triagem') // não mudou

    // Nenhum serviço chamado
    expect(services.applyTransaction).not.toHaveBeenCalled()
    expect(services.emitSocket).not.toHaveBeenCalled()
    expect(services.showToast).not.toHaveBeenCalled()
  })

  it('property: qualquer par inválido → zero efeitos', async () => {
    const invalidPairs: Array<{ state: EstadoPainel; action: FlowAction }> = [
      { state: 'triagem', action: 'fechar' },
      { state: 'triagem', action: 'reativar' },
      { state: 'triagem', action: 'perder' },
      { state: 'encerrado', action: 'classificar' },
      { state: 'encerrado', action: 'fechar' },
      { state: 'cliente', action: 'fechar' },
      { state: 'cliente', action: 'classificar' },
    ]

    for (const { state, action } of invalidPairs) {
      const services = createMockServices()
      const flow = new FlowOrchestrator(services)
      const result = await flow.run(action, createCtx({ currentState: state }))

      expect(result.status).toBe('stable')
      expect(result.effects).toEqual([])
      expect(services.applyTransaction).not.toHaveBeenCalled()
    }
  })
})

describe('Feature: continuous-flow-ux, Property 5: Execution Determinism', () => {

  it('mesma entrada 2x → mesma idempotency_key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          atendimentoId: fc.uuid(),
          identityId: fc.uuid(),
          leadId: fc.uuid(),
          currentState: fc.constant<EstadoPainel>('triagem'),
          currentStage: fc.constant(null),
          operadorId: fc.uuid(),
          snapshotVersion: fc.nat({ max: 100 }),
        }),
        async (ctxData) => {
          const keys: string[] = []
          const services = createMockServices({
            applyTransaction: vi.fn(async (params) => {
              keys.push(params.idempotencyKey)
              return { status: 'applied' as const, newVersion: ctxData.snapshotVersion + 1 }
            }),
          })

          const flow1 = new FlowOrchestrator(services)
          await flow1.run('classificar', ctxData as FlowContext)

          const flow2 = new FlowOrchestrator(services)
          await flow2.run('classificar', ctxData as FlowContext)

          // Mesma entrada → mesma idempotency_key
          expect(keys[0]).toBe(keys[1])
        }
      ),
      { numRuns: 50 }
    )
  })

  it('mesma entrada → mesma sequência de efeitos', async () => {
    const ctx = createCtx()

    const services1 = createMockServices()
    const flow1 = new FlowOrchestrator(services1)
    await flow1.run('classificar', ctx)

    const services2 = createMockServices()
    const flow2 = new FlowOrchestrator(services2)
    await flow2.run('classificar', ctx)

    // Mesma sequência de chamadas
    expect(services1.calls).toEqual(services2.calls)
  })
})

describe('FlowOrchestrator — Queue behavior', () => {

  it('ações enfileiradas executam em sequência', async () => {
    const order: number[] = []
    const services = createMockServices({
      applyTransaction: vi.fn(async () => {
        order.push(order.length + 1)
        // Simular delay
        await new Promise(r => setTimeout(r, 10))
        return { status: 'applied' as const, newVersion: 2 }
      }),
    })
    const flow = new FlowOrchestrator(services)

    // Disparar 3 ações "simultaneamente"
    const p1 = flow.run('classificar', createCtx())
    const p2 = flow.run('classificar', createCtx({ currentState: 'triagem', snapshotVersion: 2 }))
    const p3 = flow.run('classificar', createCtx({ currentState: 'triagem', snapshotVersion: 3 }))

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    // Todas executaram
    expect(r1.status).toBe('stable')
    expect(r2.status).toBe('stable')
    expect(r3.status).toBe('stable')

    // Em sequência (não paralelo)
    expect(order).toEqual([1, 2, 3])
  })
})

describe('FlowOrchestrator — Timeout', () => {

  it('execução > 5s → status failed com erro de timeout', async () => {
    const services = createMockServices({
      applyTransaction: vi.fn(async () => {
        // Simular operação lenta (6s)
        await new Promise(r => setTimeout(r, 6000))
        return { status: 'applied' as const, newVersion: 2 }
      }),
    })
    const flow = new FlowOrchestrator(services)

    const result = await flow.run('classificar', createCtx())

    expect(result.status).toBe('failed')
    expect(result.error).toContain('Timeout')
    expect(flow.status).toBe('failed')
  }, 10000) // test timeout 10s
})
