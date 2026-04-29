import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  deriveGlobalPriority,
  comparePriority,
  isGlobalCritical,
  type PriorityInput,
  type PriorityResult,
} from './globalPriority'

// --- Constants ---

const NOW = Date.now()
const MS_PER_MIN = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MIN

// --- Generators ---

/** Timestamp in the past (1min to 4h ago) */
const pastTimestampArb = fc.integer({ min: NOW - 4 * MS_PER_HOUR, max: NOW - MS_PER_MIN })
  .map(ts => new Date(ts).toISOString())

/** Timestamp for created_at (1min to 6h ago) */
const createdAtArb = fc.integer({ min: NOW - 6 * MS_PER_HOUR, max: NOW - MS_PER_MIN })
  .map(ts => new Date(ts).toISOString())

/** Generic PriorityInput generator */
const priorityInputArb: fc.Arbitrary<PriorityInput> = fc.record({
  ultima_msg_em: fc.oneof(
    fc.constant(null),
    fc.integer({ min: NOW - 4 * MS_PER_HOUR, max: NOW }).map(ts => new Date(ts).toISOString())
  ),
  ultima_msg_de: fc.oneof(fc.constant(null), fc.constant('cliente'), fc.constant('operador')),
  prazo_proxima_acao: fc.oneof(
    fc.constant(null),
    fc.integer({ min: NOW - 2 * MS_PER_HOUR, max: NOW + 2 * MS_PER_HOUR }).map(ts => new Date(ts).toISOString())
  ),
  created_at: createdAtArb,
  estado_painel: fc.oneof(fc.constant(null), fc.constant('em_atendimento'), fc.constant('cliente'), fc.constant('lead')),
  now: fc.constant(NOW),
})

// --- Property Tests ---

describe('Property 1: Prazo vencido always level 0', () => {
  /**
   * For any lead with prazo_proxima_acao in the past,
   * deriveGlobalPriority returns level 0 with reason 'prazo_vencido'.
   */
  it('returns level 0 with reason prazo_vencido when prazo is in the past', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: NOW - 4 * MS_PER_HOUR, max: NOW - MS_PER_MIN }).map(ts => new Date(ts).toISOString()),
        createdAtArb,
        fc.oneof(fc.constant(null), fc.constant('cliente'), fc.constant('operador')),
        fc.oneof(
          fc.constant(null),
          fc.integer({ min: NOW - 4 * MS_PER_HOUR, max: NOW }).map(ts => new Date(ts).toISOString())
        ),
        fc.oneof(fc.constant(null), fc.constant('em_atendimento'), fc.constant('cliente')),
        (prazo, createdAt, ultimaMsgDe, ultimaMsgEm, estadoPainel) => {
          const result = deriveGlobalPriority({
            prazo_proxima_acao: prazo,
            created_at: createdAt,
            ultima_msg_de: ultimaMsgDe,
            ultima_msg_em: ultimaMsgEm,
            estado_painel: estadoPainel,
            now: NOW,
          })
          expect(result.level).toBe(0)
          expect(result.reason).toBe('prazo_vencido')
          expect(result.isUrgent).toBe(true)
          expect(result.label).toBe('🔴 Atrasado')
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 2: Client waiting >30min always level 0', () => {
  /**
   * For any lead with ultima_msg_de='cliente' and elapsed > 30min
   * (and no prazo vencido), returns level 0 with reason 'resposta_critica'.
   */
  it('returns level 0 with reason resposta_critica when client waits >30min', () => {
    fc.assert(
      fc.property(
        // ultima_msg_em: 31min to 4h ago
        fc.integer({ min: NOW - 4 * MS_PER_HOUR, max: NOW - 31 * MS_PER_MIN }).map(ts => new Date(ts).toISOString()),
        createdAtArb,
        fc.oneof(fc.constant(null), fc.constant('em_atendimento'), fc.constant('cliente')),
        (ultimaMsgEm, createdAt, estadoPainel) => {
          const result = deriveGlobalPriority({
            ultima_msg_em: ultimaMsgEm,
            ultima_msg_de: 'cliente',
            prazo_proxima_acao: null, // no prazo vencido
            created_at: createdAt,
            estado_painel: estadoPainel,
            now: NOW,
          })
          expect(result.level).toBe(0)
          expect(result.reason).toBe('resposta_critica')
          expect(result.isUrgent).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 3: Triagem >2h always level 0', () => {
  /**
   * For any lead with estado_painel=null and created_at > 2h ago
   * (and no prazo vencido, no client waiting), returns level 0 with reason 'triagem_critica'.
   */
  it('returns level 0 with reason triagem_critica when triagem exceeds 2h', () => {
    fc.assert(
      fc.property(
        // created_at: 2h1min to 6h ago
        fc.integer({ min: NOW - 6 * MS_PER_HOUR, max: NOW - 2 * MS_PER_HOUR - MS_PER_MIN }).map(ts => new Date(ts).toISOString()),
        (createdAt) => {
          const result = deriveGlobalPriority({
            ultima_msg_em: null,
            ultima_msg_de: null,
            prazo_proxima_acao: null,
            created_at: createdAt,
            estado_painel: null,
            now: NOW,
          })
          expect(result.level).toBe(0)
          expect(result.reason).toBe('triagem_critica')
          expect(result.isUrgent).toBe(true)
          expect(result.label).toBe('SLA estourado')
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 4: Level ordering is total (transitivity)', () => {
  /**
   * For any three leads, if comparePriority(a, b) <= 0 and comparePriority(b, c) <= 0,
   * then comparePriority(a, c) <= 0 (transitivity).
   */
  it('comparePriority is transitive', () => {
    fc.assert(
      fc.property(
        priorityInputArb,
        priorityInputArb,
        priorityInputArb,
        (inputA, inputB, inputC) => {
          const a = { ...deriveGlobalPriority(inputA), ultima_msg_em: inputA.ultima_msg_em }
          const b = { ...deriveGlobalPriority(inputB), ultima_msg_em: inputB.ultima_msg_em }
          const c = { ...deriveGlobalPriority(inputC), ultima_msg_em: inputC.ultima_msg_em }

          const ab = comparePriority(a, b)
          const bc = comparePriority(b, c)
          const ac = comparePriority(a, c)

          if (ab <= 0 && bc <= 0) {
            expect(ac).toBeLessThanOrEqual(0)
          }
          if (ab >= 0 && bc >= 0) {
            expect(ac).toBeGreaterThanOrEqual(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 5: isGlobalCritical iff level === 0', () => {
  /**
   * For any PriorityResult, isGlobalCritical returns true iff level === 0.
   */
  it('isGlobalCritical matches level === 0 for all inputs', () => {
    fc.assert(
      fc.property(priorityInputArb, (input) => {
        const result = deriveGlobalPriority(input)
        expect(isGlobalCritical(result)).toBe(result.level === 0)
      }),
      { numRuns: 100 }
    )
  })
})

describe('Property 6: Same level leads sorted by recency', () => {
  /**
   * For any two leads with the same priority level,
   * comparePriority sorts by ultima_msg_em DESC (more recent first).
   */
  it('within same level, more recent ultima_msg_em comes first', () => {
    fc.assert(
      fc.property(
        // Two timestamps guaranteed to be different
        fc.integer({ min: NOW - 4 * MS_PER_HOUR, max: NOW - 2 * MS_PER_MIN }),
        fc.integer({ min: NOW - 4 * MS_PER_HOUR, max: NOW - 2 * MS_PER_MIN }),
        (tsA, tsB) => {
          // Both are client messages within 1-14min (level 2)
          const recentOffset = 5 * MS_PER_MIN // 5min ago base
          const msgTimeA = NOW - recentOffset + (tsA % (10 * MS_PER_MIN)) // vary within 0-10min
          const msgTimeB = NOW - recentOffset + (tsB % (10 * MS_PER_MIN))

          // Clamp to ensure they stay within 1-14min range for level 2
          const clampedA = Math.max(NOW - 14 * MS_PER_MIN, Math.min(NOW - MS_PER_MIN, msgTimeA))
          const clampedB = Math.max(NOW - 14 * MS_PER_MIN, Math.min(NOW - MS_PER_MIN, msgTimeB))

          const isoA = new Date(clampedA).toISOString()
          const isoB = new Date(clampedB).toISOString()

          const resultA = {
            ...deriveGlobalPriority({
              ultima_msg_em: isoA,
              ultima_msg_de: 'cliente',
              prazo_proxima_acao: null,
              created_at: new Date(NOW - 3 * MS_PER_HOUR).toISOString(),
              estado_painel: 'em_atendimento',
              now: NOW,
            }),
            ultima_msg_em: isoA,
          }

          const resultB = {
            ...deriveGlobalPriority({
              ultima_msg_em: isoB,
              ultima_msg_de: 'cliente',
              prazo_proxima_acao: null,
              created_at: new Date(NOW - 3 * MS_PER_HOUR).toISOString(),
              estado_painel: 'em_atendimento',
              now: NOW,
            }),
            ultima_msg_em: isoB,
          }

          // Both should be level 2 (client msg < 15min)
          expect(resultA.level).toBe(2)
          expect(resultB.level).toBe(2)

          const cmp = comparePriority(resultA, resultB)

          if (clampedA > clampedB) {
            // A is more recent → A should come first → negative
            expect(cmp).toBeLessThanOrEqual(0)
          } else if (clampedA < clampedB) {
            // B is more recent → B should come first → positive
            expect(cmp).toBeGreaterThanOrEqual(0)
          } else {
            // Same time → equal
            expect(cmp).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
