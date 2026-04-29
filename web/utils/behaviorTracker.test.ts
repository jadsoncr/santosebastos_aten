import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  resolveLeadSelectEvents,
  resolveBecameCriticalEvents,
  calculatePrioritizationRate,
} from './behaviorTracker.pure'

// --- Generators ---

const NOW = Date.now()

const leadArb = fc.record({
  id: fc.uuid(),
  ultima_msg_em: fc.oneof(
    fc.constant(null),
    fc.integer({ min: NOW - 2 * 60 * 60 * 1000, max: NOW }).map(ts => new Date(ts).toISOString())
  ),
  ultima_msg_de: fc.oneof(fc.constant(null), fc.constant('cliente'), fc.constant('operador')),
})

// --- Property 1: Um became_critical por transição ---

describe('Property 1: Um became_critical por transição', () => {
  it('retorna exatamente um evento por ID em newCriticalIds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        fc.uuid(),
        (ids, userId) => {
          const uniqueIds = Array.from(new Set(ids))
          const leads = uniqueIds.map(id => ({
            id,
            ultima_msg_em: new Date(NOW - 45 * 60000).toISOString(),
          }))

          const events = resolveBecameCriticalEvents({
            newCriticalIds: uniqueIds,
            leads,
            userId,
            now: NOW,
          })

          // Exactly one event per unique ID
          expect(events.length).toBe(uniqueIds.length)

          // Each event has correct lead_id and type
          for (let i = 0; i < uniqueIds.length; i++) {
            expect(events[i].lead_id).toBe(uniqueIds[i])
            expect(events[i].event_type).toBe('became_critical')
            expect(events[i].user_id).toBe(userId)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Property 2: Metadata correta no became_critical ---

describe('Property 2: Metadata correta no became_critical', () => {
  it('elapsed_minutes calculado corretamente a partir de ultima_msg_em', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: NOW - 3 * 60 * 60 * 1000, max: NOW }),
        (leadId, userId, msgTimestamp) => {
          const ultimaMsgEm = new Date(msgTimestamp).toISOString()
          const leads = [{ id: leadId, ultima_msg_em: ultimaMsgEm }]

          const events = resolveBecameCriticalEvents({
            newCriticalIds: [leadId],
            leads,
            userId,
            now: NOW,
          })

          expect(events.length).toBe(1)
          const meta = events[0].metadata as Record<string, unknown>
          const expectedMinutes = Math.floor((NOW - msgTimestamp) / 60000)
          expect(meta.elapsed_minutes).toBe(expectedMinutes)
          expect(meta.stage).toBe('atendimento')
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Property 3: lead_opened com metadata correta ---

describe('Property 3: lead_opened com metadata correta', () => {
  it('sempre inclui exatamente um lead_opened com metadata correta', () => {
    fc.assert(
      fc.property(
        leadArb,
        fc.uuid(),
        fc.boolean(),
        fc.array(fc.uuid(), { maxLength: 5 }),
        fc.nat({ max: 50 }),
        (lead, userId, wasCritical, criticalIds, position) => {
          const events = resolveLeadSelectEvents({
            lead,
            userId,
            wasCritical,
            criticalLeadIds: criticalIds,
            positionInQueue: position,
            now: NOW,
          })

          // Always has at least one event (lead_opened)
          const openedEvents = events.filter(e => e.event_type === 'lead_opened')
          expect(openedEvents.length).toBe(1)

          const meta = openedEvents[0].metadata as Record<string, unknown>
          expect(meta.was_critical).toBe(wasCritical)
          expect(meta.position_in_queue).toBe(position)
          expect(typeof meta.time_since_critical).toBe('number')
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Property 4: ignored_critical condicional ---

describe('Property 4: ignored_critical condicional', () => {
  it('presente sse lead não-crítico E criticalLeadIds não-vazio', () => {
    fc.assert(
      fc.property(
        leadArb,
        fc.uuid(),
        fc.boolean(),
        fc.array(fc.uuid(), { maxLength: 5 }),
        fc.nat({ max: 50 }),
        (lead, userId, wasCritical, criticalIds, position) => {
          const events = resolveLeadSelectEvents({
            lead,
            userId,
            wasCritical,
            criticalLeadIds: criticalIds,
            positionInQueue: position,
            now: NOW,
          })

          const ignoredEvents = events.filter(e => e.event_type === 'ignored_critical')
          const shouldExist = !wasCritical && criticalIds.length > 0

          expect(ignoredEvents.length).toBe(shouldExist ? 1 : 0)

          if (shouldExist) {
            const meta = ignoredEvents[0].metadata as Record<string, unknown>
            expect(meta.critical_count).toBe(criticalIds.length)
            expect(meta.opened_lead_id).toBe(lead.id)
            expect(meta.critical_lead_ids).toEqual(criticalIds)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Property 5: time_to_action condicional ---

describe('Property 5: time_to_action condicional', () => {
  it('presente sse lead é crítico com ultima_msg_em válido', () => {
    fc.assert(
      fc.property(
        leadArb,
        fc.uuid(),
        fc.boolean(),
        fc.nat({ max: 50 }),
        (lead, userId, wasCritical, position) => {
          const events = resolveLeadSelectEvents({
            lead,
            userId,
            wasCritical,
            criticalLeadIds: [],
            positionInQueue: position,
            now: NOW,
          })

          const ttaEvents = events.filter(e => e.event_type === 'time_to_action')
          const shouldExist = wasCritical && lead.ultima_msg_em != null

          expect(ttaEvents.length).toBe(shouldExist ? 1 : 0)

          if (shouldExist) {
            const meta = ttaEvents[0].metadata as Record<string, unknown>
            const expectedSeconds = Math.floor(
              (NOW - new Date(lead.ultima_msg_em!).getTime()) / 1000
            )
            expect(meta.seconds).toBe(expectedSeconds)
            expect(meta.was_critical).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Property 6: Fórmula de priorização ---

describe('Property 6: Fórmula de priorização', () => {
  it('correct / (correct + ignored) quando soma > 0, null quando ambos zero', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        (correct, ignored) => {
          const result = calculatePrioritizationRate(correct, ignored)
          const total = correct + ignored

          if (total === 0) {
            expect(result).toBeNull()
          } else {
            expect(result).toBeCloseTo(correct / total, 10)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
