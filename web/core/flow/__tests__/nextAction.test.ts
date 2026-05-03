// ══════════════════════════════════════════════════════════════
// Property 8: Next Action Resolver Completeness
// Property 9: Next Action Resolver Purity
// Feature: continuous-flow-ux
//
// P8: Para todas as combinações válidas de (state, stage),
//     resolveNextAction retorna resultado não-nulo.
//
// P9: Para quaisquer inputs, chamar múltiplas vezes com
//     argumentos idênticos retorna resultados idênticos.
//
// Valida: Requisitos 3.8, 3.9
// ══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { resolveNextAction } from '../nextAction'
import type { EstadoPainel } from '../types'

// ── Generators ──

const arbEstadoPainel = fc.constantFrom<EstadoPainel>('triagem', 'em_atendimento', 'cliente', 'encerrado')

const arbStage = fc.option(fc.constantFrom(
  'analise_viabilidade', 'retorno_cliente', 'solicitacao_documentos',
  'envio_contrato', 'esclarecimento_duvidas', 'recebimento_documentos',
  'cadastro_interno', 'confeccao_inicial', 'distribuicao'
), { nil: null })

const arbResolverContext = fc.option(fc.record({
  valor_contrato: fc.option(fc.nat({ max: 100000 }), { nil: null }),
  ultima_msg_de: fc.option(fc.constantFrom('operador', 'cliente'), { nil: null }),
  tempo_desde_ultima_msg: fc.option(fc.nat({ max: 200 * 60 * 60 * 1000 }), { nil: null }),
  owner_id: fc.option(fc.uuid(), { nil: null }),
  operador_id: fc.option(fc.uuid(), { nil: null }),
}), { nil: undefined })

describe('Feature: continuous-flow-ux, Property 8: Next Action Resolver Completeness', () => {

  it('NUNCA retorna null para qualquer combinação válida de (state, stage, ctx)', () => {
    fc.assert(
      fc.property(
        arbEstadoPainel,
        arbStage,
        arbResolverContext,
        (state, stage, ctx) => {
          const result = resolveNextAction(state, stage, ctx ?? undefined)

          // Nunca null
          expect(result).not.toBeNull()
          expect(result).not.toBeUndefined()

          // Campos obrigatórios presentes
          expect(result.action).toBeTruthy()
          expect(result.label).toBeTruthy()
          expect(result.destination).toBeTruthy()
          expect(result.description).toBeTruthy()
          expect(result.confidence).toBeTruthy()
          expect(result.type).toBeTruthy()

          // Confidence é válido
          expect(['high', 'medium', 'low']).toContain(result.confidence)

          // Type é válido
          expect(['auto', 'assisted', 'blocked']).toContain(result.type)

          // Se blocked, deve ter reason
          if (result.type === 'blocked') {
            expect(result.reason).toBeTruthy()
            expect(result.unblockAction).toBeTruthy()
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('triagem → sempre retorna classificar', () => {
    const result = resolveNextAction('triagem', null)
    expect(result.action).toBe('classificar')
    expect(result.confidence).toBe('high')
  })

  it('em_atendimento com stage → retorna avancar_etapa', () => {
    const result = resolveNextAction('em_atendimento', 'retorno_cliente')
    expect(result.action).toBe('avancar_etapa')
    expect(result.confidence).toBe('high')
  })

  it('em_atendimento sem stage → retorna revisar (low confidence)', () => {
    const result = resolveNextAction('em_atendimento', null)
    expect(result.action).toBe('revisar')
    expect(result.confidence).toBe('low')
  })

  it('cliente sem valor → retorna registrar_financeiro', () => {
    const result = resolveNextAction('cliente', null, { valor_contrato: null })
    expect(result.action).toBe('registrar_financeiro')
  })

  it('cliente com valor → retorna acompanhar', () => {
    const result = resolveNextAction('cliente', null, { valor_contrato: 5000 })
    expect(result.action).toBe('acompanhar')
  })

  it('encerrado → retorna reativar', () => {
    const result = resolveNextAction('encerrado', null)
    expect(result.action).toBe('reativar')
  })

  it('follow-up: operador sem resposta > 24h', () => {
    const result = resolveNextAction('em_atendimento', 'retorno_cliente', {
      ultima_msg_de: 'operador',
      tempo_desde_ultima_msg: 25 * 60 * 60 * 1000, // 25h
    })
    expect(result.action).toBe('follow_up')
    expect(result.confidence).toBe('medium')
  })

  it('bloqueado: caso de outro operador', () => {
    const result = resolveNextAction('em_atendimento', 'retorno_cliente', {
      owner_id: 'other-op',
      operador_id: 'current-op',
    })
    expect(result.action).toBe('revisar')
    expect(result.type).toBe('blocked')
    expect(result.reason).toBeTruthy()
  })
})

describe('Feature: continuous-flow-ux, Property 9: Next Action Resolver Purity', () => {

  it('mesmos inputs → mesmos outputs (referential transparency)', () => {
    fc.assert(
      fc.property(
        arbEstadoPainel,
        arbStage,
        arbResolverContext,
        (state, stage, ctx) => {
          const result1 = resolveNextAction(state, stage, ctx ?? undefined)
          const result2 = resolveNextAction(state, stage, ctx ?? undefined)

          // Estruturalmente idênticos
          expect(result1).toEqual(result2)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('chamadas repetidas não alteram estado global', () => {
    // Chamar 100x com mesmos args
    const results = Array.from({ length: 100 }, () =>
      resolveNextAction('triagem', null)
    )

    // Todos idênticos
    for (const r of results) {
      expect(r).toEqual(results[0])
    }
  })
})
