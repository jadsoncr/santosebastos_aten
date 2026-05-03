// ══════════════════════════════════════════════════════════════
// Property 15: Idempotency Key Determinism
// Feature: continuous-flow-ux
//
// Para qualquer tupla (action, atendimento_id, snapshot_version):
//   - A chave gerada deve ser determinística (mesma entrada → mesma saída)
//   - Tuplas com versão diferente devem produzir chaves diferentes
//   - Tuplas com action diferente devem produzir chaves diferentes
//   - Tuplas com atendimento_id diferente devem produzir chaves diferentes
//
// Valida: Requisitos 23.1, 23.7
// ══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { generateIdempotencyKey } from '../types'

// ── Generators ──

const arbFlowAction = fc.constantFrom(
  'classificar', 'avancar_etapa', 'fechar', 'perder', 'reativar', 'delegar', 'novo_atendimento'
)

const arbUuid = fc.uuid()

const arbVersion = fc.nat({ max: 10000 })

describe('Feature: continuous-flow-ux, Property 15: Idempotency Key Determinism', () => {

  it('mesma entrada → mesma saída (determinismo)', () => {
    fc.assert(
      fc.property(
        arbFlowAction,
        arbUuid,
        arbVersion,
        (action, atendimentoId, version) => {
          const key1 = generateIdempotencyKey(action, atendimentoId, version)
          const key2 = generateIdempotencyKey(action, atendimentoId, version)
          expect(key1).toBe(key2)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('versões diferentes → chaves diferentes', () => {
    fc.assert(
      fc.property(
        arbFlowAction,
        arbUuid,
        arbVersion,
        fc.nat({ max: 10000 }).filter(v => v > 0),
        (action, atendimentoId, version1, offset) => {
          const version2 = version1 + offset
          const key1 = generateIdempotencyKey(action, atendimentoId, version1)
          const key2 = generateIdempotencyKey(action, atendimentoId, version2)
          expect(key1).not.toBe(key2)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('actions diferentes → chaves diferentes', () => {
    fc.assert(
      fc.property(
        arbUuid,
        arbVersion,
        fc.tuple(arbFlowAction, arbFlowAction).filter(([a, b]) => a !== b),
        (atendimentoId, version, [action1, action2]) => {
          const key1 = generateIdempotencyKey(action1, atendimentoId, version)
          const key2 = generateIdempotencyKey(action2, atendimentoId, version)
          expect(key1).not.toBe(key2)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('atendimento_ids diferentes → chaves diferentes', () => {
    fc.assert(
      fc.property(
        arbFlowAction,
        fc.tuple(arbUuid, arbUuid).filter(([a, b]) => a !== b),
        arbVersion,
        (action, [id1, id2], version) => {
          const key1 = generateIdempotencyKey(action, id1, version)
          const key2 = generateIdempotencyKey(action, id2, version)
          expect(key1).not.toBe(key2)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('chave sempre começa com prefixo "flow_" e contém versão', () => {
    fc.assert(
      fc.property(
        arbFlowAction,
        arbUuid,
        arbVersion,
        (action, atendimentoId, version) => {
          const key = generateIdempotencyKey(action, atendimentoId, version)
          expect(key).toMatch(/^flow_[a-z0-9]+_v\d+$/)
          expect(key).toContain(`_v${version}`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('chave é uma string não-vazia para qualquer input válido', () => {
    fc.assert(
      fc.property(
        arbFlowAction,
        arbUuid,
        arbVersion,
        (action, atendimentoId, version) => {
          const key = generateIdempotencyKey(action, atendimentoId, version)
          expect(key.length).toBeGreaterThan(0)
          expect(typeof key).toBe('string')
        }
      ),
      { numRuns: 100 }
    )
  })
})
