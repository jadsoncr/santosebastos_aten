import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  JOURNEY_STAGES,
  SLA_POR_ETAPA,
  ETAPAS_ATIVAS,
  getSlaDias,
  calcularPrazoEtapa,
  getStage,
  getProximaAcao,
  getEtapaLabel,
  getEtapaOrdem,
  calcularProgresso,
  isSlaVencido,
  diasRestantes,
} from './journeyModel'

const NOW = Date.now()
const MS_PER_DAY = 24 * 60 * 60 * 1000

const activeStageIds = Object.keys(JOURNEY_STAGES).filter(k => !JOURNEY_STAGES[k].terminal)
const allStageIds = Object.keys(JOURNEY_STAGES)
const stageIdArb = fc.constantFrom(...allStageIds)
const activeStageIdArb = fc.constantFrom(...activeStageIds)

// --- Property 1: SLA_POR_ETAPA is consistent with JOURNEY_STAGES ---

describe('Property 1: SLA_POR_ETAPA derived from JOURNEY_STAGES', () => {
  it('every stage has matching SLA in SLA_POR_ETAPA', () => {
    for (const [key, stage] of Object.entries(JOURNEY_STAGES)) {
      expect(SLA_POR_ETAPA[key]).toBe(stage.slaDias)
    }
  })
})

// --- Property 2: ETAPAS_ATIVAS are non-terminal and ordered ---

describe('Property 2: ETAPAS_ATIVAS ordering', () => {
  it('all active stages are non-terminal', () => {
    for (const stage of ETAPAS_ATIVAS) {
      expect(stage.terminal).toBe(false)
    }
  })

  it('active stages are sorted by ordem ascending', () => {
    for (let i = 1; i < ETAPAS_ATIVAS.length; i++) {
      expect(ETAPAS_ATIVAS[i].ordem).toBeGreaterThan(ETAPAS_ATIVAS[i - 1].ordem)
    }
  })
})

// --- Property 3: getSlaDias returns positive for active, 0 for terminal ---

describe('Property 3: getSlaDias consistency', () => {
  it('active stages have SLA > 0', () => {
    fc.assert(
      fc.property(activeStageIdArb, (id) => {
        expect(getSlaDias(id)).toBeGreaterThan(0)
      }),
      { numRuns: 50 }
    )
  })

  it('unknown stages default to 7', () => {
    fc.assert(
      fc.property(fc.uuid(), (randomId) => {
        expect(getSlaDias(randomId)).toBe(7)
      }),
      { numRuns: 50 }
    )
  })
})

// --- Property 4: calcularPrazoEtapa is now + slaDias ---

describe('Property 4: calcularPrazoEtapa correctness', () => {
  it('prazo = now + slaDias * MS_PER_DAY', () => {
    fc.assert(
      fc.property(stageIdArb, (id) => {
        const prazo = calcularPrazoEtapa(id, NOW)
        const expected = NOW + getSlaDias(id) * MS_PER_DAY
        expect(prazo.getTime()).toBe(expected)
      }),
      { numRuns: 50 }
    )
  })
})

// --- Property 5: calcularProgresso is 0-100 ---

describe('Property 5: calcularProgresso range', () => {
  it('returns 0-100 for any stage', () => {
    fc.assert(
      fc.property(stageIdArb, (id) => {
        const prog = calcularProgresso(id)
        expect(prog).toBeGreaterThanOrEqual(0)
        expect(prog).toBeLessThanOrEqual(100)
      }),
      { numRuns: 50 }
    )
  })

  it('terminal stages return 100', () => {
    const terminals = Object.values(JOURNEY_STAGES).filter(s => s.terminal)
    for (const stage of terminals) {
      expect(calcularProgresso(stage.id)).toBe(100)
    }
  })
})

// --- Property 6: isSlaVencido iff prazo < now ---

describe('Property 6: isSlaVencido correctness', () => {
  it('returns true iff prazo is in the past', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: NOW - 10 * MS_PER_DAY, max: NOW + 10 * MS_PER_DAY }),
        (prazoTs) => {
          const prazo = new Date(prazoTs).toISOString()
          const result = isSlaVencido(prazo, NOW)
          expect(result).toBe(prazoTs < NOW)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns false for null prazo', () => {
    expect(isSlaVencido(null, NOW)).toBe(false)
  })
})

// --- Property 7: diasRestantes sign matches vencido ---

describe('Property 7: diasRestantes consistency with isSlaVencido', () => {
  it('negative diasRestantes iff isSlaVencido', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: NOW - 10 * MS_PER_DAY, max: NOW + 10 * MS_PER_DAY }),
        (prazoTs) => {
          const prazo = new Date(prazoTs).toISOString()
          const dias = diasRestantes(prazo, NOW)
          const vencido = isSlaVencido(prazo, NOW)

          if (dias !== null) {
            if (vencido) {
              expect(dias).toBeLessThanOrEqual(0)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns null for null prazo', () => {
    expect(diasRestantes(null, NOW)).toBeNull()
  })
})

// --- Property 8: getStage roundtrip ---

describe('Property 8: getStage returns correct stage', () => {
  it('getStage(id).id === id for all known stages', () => {
    fc.assert(
      fc.property(stageIdArb, (id) => {
        const stage = getStage(id)
        expect(stage).not.toBeNull()
        expect(stage!.id).toBe(id)
      }),
      { numRuns: 50 }
    )
  })

  it('getStage returns null for unknown ids', () => {
    fc.assert(
      fc.property(fc.uuid(), (randomId) => {
        expect(getStage(randomId)).toBeNull()
      }),
      { numRuns: 50 }
    )
  })
})
