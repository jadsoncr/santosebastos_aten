import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { splitLeads, detectNewCriticalIds, shouldShowSeparator, type LeadForAlert } from './criticalPressure'
import { getUrgencyStyle } from './urgencyColors'

// --- Generator ---

const NOW = Date.now()

const leadArb = fc.record({
  id: fc.uuid(),
  ultima_msg_em: fc.oneof(
    fc.constant(null),
    fc.integer({ min: NOW - 2 * 60 * 60 * 1000, max: NOW }).map(ts => new Date(ts).toISOString())
  ),
  ultima_msg_de: fc.oneof(fc.constant(null), fc.constant('cliente'), fc.constant('operador')),
  prazo_proxima_acao: fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.integer({ min: NOW - 60 * 60 * 1000, max: NOW + 60 * 60 * 1000 }).map(ts => new Date(ts).toISOString())
  ),
})

const getUrgency = (lead: LeadForAlert) => getUrgencyStyle(
  lead.ultima_msg_em || null,
  lead.ultima_msg_de || null,
  lead.prazo_proxima_acao ?? undefined
)

// --- Property Tests ---

describe('Property 1: Corretude da Partição', () => {
  /**
   * **Validates: Requirements 1.1, 4.6, 5.6**
   *
   * For any list of leads with arbitrary timestamps, every lead in criticalLeads
   * must have getUrgencyStyle() returning level === 'critical', and every lead in
   * nonCriticalLeads must have level !== 'critical'.
   */
  it('every critical lead has level=critical and every non-critical has level!=critical', () => {
    fc.assert(
      fc.property(fc.array(leadArb), (leads) => {
        const { criticalLeads, nonCriticalLeads } = splitLeads(leads, getUrgency)

        for (const lead of criticalLeads) {
          expect(getUrgency(lead).level).toBe('critical')
        }
        for (const lead of nonCriticalLeads) {
          expect(getUrgency(lead).level).not.toBe('critical')
        }
      }),
      { numRuns: 100 }
    )
  })
})

describe('Property 2: Completude da Partição', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * For any list of leads, criticalLeads.length + nonCriticalLeads.length === input.length
   * and the concatenation contains exactly the same elements without duplicates.
   */
  it('no leads are lost or duplicated in the partition', () => {
    fc.assert(
      fc.property(fc.array(leadArb), (leads) => {
        const { criticalLeads, nonCriticalLeads } = splitLeads(leads, getUrgency)

        // Length invariant
        expect(criticalLeads.length + nonCriticalLeads.length).toBe(leads.length)

        // Same elements — every lead appears exactly once across both sublists
        const combined = [...criticalLeads, ...nonCriticalLeads]
        const combinedIds = combined.map(l => l.id).sort()
        const originalIds = leads.map(l => l.id).sort()
        expect(combinedIds).toEqual(originalIds)
      }),
      { numRuns: 100 }
    )
  })
})

describe('Property 3: Preservação de Ordem', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any list of leads, the relative order within each sublist must match
   * the original order. Indices in the original array are monotonically increasing
   * within each sublist.
   */
  it('relative order within each sublist matches original order', () => {
    fc.assert(
      fc.property(fc.array(leadArb), (leads) => {
        const { criticalLeads, nonCriticalLeads } = splitLeads(leads, getUrgency)

        // Build index map from original list
        const indexMap = new Map<string, number>()
        leads.forEach((lead, i) => indexMap.set(lead.id, i))

        // Check monotonically increasing indices in criticalLeads
        for (let i = 1; i < criticalLeads.length; i++) {
          const prevIdx = indexMap.get(criticalLeads[i - 1].id)!
          const currIdx = indexMap.get(criticalLeads[i].id)!
          expect(currIdx).toBeGreaterThan(prevIdx)
        }

        // Check monotonically increasing indices in nonCriticalLeads
        for (let i = 1; i < nonCriticalLeads.length; i++) {
          const prevIdx = indexMap.get(nonCriticalLeads[i - 1].id)!
          const currIdx = indexMap.get(nonCriticalLeads[i].id)!
          expect(currIdx).toBeGreaterThan(prevIdx)
        }
      }),
      { numRuns: 100 }
    )
  })
})

describe('Property 4: Visibilidade do Separador', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any pair (criticalCount, nonCriticalCount) of non-negative integers,
   * shouldShowSeparator returns true iff both > 0.
   */
  it('returns true iff both counts are greater than zero', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        (criticalCount, nonCriticalCount) => {
          const result = shouldShowSeparator(criticalCount, nonCriticalCount)
          const expected = criticalCount > 0 && nonCriticalCount > 0
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 5: Detecção de Transição', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any two sets of IDs, detectNewCriticalIds returns a non-empty set
   * iff there exists at least one ID in currentIds that was not in previousIds.
   */
  it('returns non-empty set iff there are new IDs not in previous set', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid()),
        fc.array(fc.uuid()),
        (currentArr, previousArr) => {
          const currentIds = new Set(currentArr)
          const previousIds = new Set(previousArr)
          const newIds = detectNewCriticalIds(currentIds, previousIds)

          // Check: non-empty iff there's at least one ID in current not in previous
          let hasNew = false
          Array.from(currentIds).forEach(id => {
            if (!previousIds.has(id)) {
              hasNew = true
            }
          })
          expect(newIds.size > 0).toBe(hasNew)

          // Also verify every returned ID is indeed new
          Array.from(newIds).forEach(id => {
            expect(currentIds.has(id)).toBe(true)
            expect(previousIds.has(id)).toBe(false)
          })
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 6: Idempotência', () => {
  /**
   * **Validates: Requirements 4.3**
   *
   * For any set S, detectNewCriticalIds(S, S) returns an empty set.
   */
  it('comparing a set with itself returns empty set', () => {
    fc.assert(
      fc.property(fc.array(fc.uuid()), (ids) => {
        const s = new Set(ids)
        const result = detectNewCriticalIds(s, s)
        expect(result.size).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})
