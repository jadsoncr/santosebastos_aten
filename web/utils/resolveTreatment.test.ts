import { describe, it, expect } from 'vitest'
import { resolveTreatment, TREATMENT_TIPOS, TREATMENT_DETALHES } from './resolveTreatment'
import { JOURNEY_STAGES } from './journeyModel'

const VALID_STATUS = new Set(Object.keys(JOURNEY_STAGES))

describe('resolveTreatment — Sprint 2 validation', () => {
  it('all treatment results map to valid JOURNEY_STAGES status_negocio', () => {
    for (const tipo of TREATMENT_TIPOS) {
      const detalhes = TREATMENT_DETALHES[tipo]
      for (const detalhe of detalhes) {
        const result = resolveTreatment(tipo, detalhe)
        expect(
          VALID_STATUS.has(result.status_negocio),
          `Treatment "${tipo}::${detalhe}" returns status_negocio "${result.status_negocio}" which is NOT in JOURNEY_STAGES`
        ).toBe(true)
      }
    }
  })

  it('all backoffice treatments have non-terminal status_negocio', () => {
    for (const tipo of TREATMENT_TIPOS) {
      const detalhes = TREATMENT_DETALHES[tipo]
      for (const detalhe of detalhes) {
        const result = resolveTreatment(tipo, detalhe)
        if (result.destino === 'backoffice') {
          const stage = JOURNEY_STAGES[result.status_negocio]
          expect(
            stage && !stage.terminal,
            `Backoffice treatment "${tipo}::${detalhe}" maps to terminal stage "${result.status_negocio}"`
          ).toBe(true)
        }
      }
    }
  })

  it('all encerrado treatments have terminal status_negocio', () => {
    for (const tipo of TREATMENT_TIPOS) {
      const detalhes = TREATMENT_DETALHES[tipo]
      for (const detalhe of detalhes) {
        const result = resolveTreatment(tipo, detalhe)
        if (result.destino === 'encerrado') {
          const stage = JOURNEY_STAGES[result.status_negocio]
          expect(
            stage && stage.terminal,
            `Encerrado treatment "${tipo}::${detalhe}" maps to non-terminal stage "${result.status_negocio}"`
          ).toBe(true)
        }
      }
    }
  })
})
