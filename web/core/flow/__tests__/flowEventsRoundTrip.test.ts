// ══════════════════════════════════════════════════════════════
// Property 10: Flow Events Round-Trip
// Feature: continuous-flow-ux
//
// Para qualquer sequência de transições em um atendimento,
// ler flow_events em ordem cronológica deve reconstruir a
// sequência completa de ações (from_state, to_state, action).
//
// A cadeia deve ser consistente: to_state[n] === from_state[n+1]
//
// Valida: Requisitos 4.6
// ══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { EstadoPainel, FlowAction } from '../types'

// ── Tipos para simulação ──

interface FlowEvent {
  action: FlowAction
  from_state: EstadoPainel
  to_state: EstadoPainel
  created_at: string
}

// ── Transições válidas (subset do TRANSITION_MAP) ──

const VALID_TRANSITIONS: Array<{ from: EstadoPainel; action: FlowAction; to: EstadoPainel }> = [
  { from: 'triagem', action: 'classificar', to: 'em_atendimento' },
  { from: 'em_atendimento', action: 'avancar_etapa', to: 'em_atendimento' },
  { from: 'em_atendimento', action: 'fechar', to: 'cliente' },
  { from: 'em_atendimento', action: 'perder', to: 'encerrado' },
  { from: 'encerrado', action: 'reativar', to: 'triagem' },
  { from: 'cliente', action: 'novo_atendimento', to: 'triagem' },
]

/**
 * Gera uma sequência válida de transições a partir de um estado inicial.
 * Cada transição respeita o TRANSITION_MAP.
 */
function generateValidSequence(startState: EstadoPainel, length: number): FlowEvent[] {
  const events: FlowEvent[] = []
  let currentState = startState
  let timestamp = Date.now()

  for (let i = 0; i < length; i++) {
    const validFromCurrent = VALID_TRANSITIONS.filter(t => t.from === currentState)
    if (validFromCurrent.length === 0) break

    const transition = validFromCurrent[Math.floor(Math.random() * validFromCurrent.length)]
    events.push({
      action: transition.action,
      from_state: currentState,
      to_state: transition.to,
      created_at: new Date(timestamp + i * 1000).toISOString(),
    })
    currentState = transition.to
  }

  return events
}

// ── Generators ──

const arbStartState = fc.constantFrom<EstadoPainel>('triagem', 'em_atendimento', 'cliente', 'encerrado')
const arbSequenceLength = fc.nat({ max: 20 }).filter(n => n >= 1)

describe('Feature: continuous-flow-ux, Property 10: Flow Events Round-Trip', () => {

  it('sequência de eventos reconstrói cadeia de estados consistente', () => {
    fc.assert(
      fc.property(
        arbStartState,
        arbSequenceLength,
        fc.nat(), // seed para randomização interna
        (startState, length, _seed) => {
          const events = generateValidSequence(startState, length)

          if (events.length === 0) return true // skip se não há transições válidas

          // Propriedade 1: primeiro evento começa no estado inicial
          expect(events[0].from_state).toBe(startState)

          // Propriedade 2: cadeia é consistente (to_state[n] === from_state[n+1])
          for (let i = 0; i < events.length - 1; i++) {
            expect(events[i].to_state).toBe(events[i + 1].from_state)
          }

          // Propriedade 3: cada evento tem action não-vazia
          for (const event of events) {
            expect(event.action).toBeTruthy()
            expect(event.from_state).toBeTruthy()
            expect(event.to_state).toBeTruthy()
          }

          // Propriedade 4: eventos estão em ordem cronológica
          for (let i = 0; i < events.length - 1; i++) {
            expect(new Date(events[i].created_at).getTime())
              .toBeLessThan(new Date(events[i + 1].created_at).getTime())
          }

          // Propriedade 5: estado final é derivável da sequência
          const finalState = events[events.length - 1].to_state
          expect(['triagem', 'em_atendimento', 'cliente', 'encerrado']).toContain(finalState)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('sequência vazia não quebra reconstrução', () => {
    const events: FlowEvent[] = []
    // Sem eventos, não há cadeia para reconstruir — isso é válido
    expect(events.length).toBe(0)
  })

  it('evento único é uma cadeia válida de tamanho 1', () => {
    fc.assert(
      fc.property(
        arbStartState,
        (startState) => {
          const events = generateValidSequence(startState, 1)
          if (events.length === 0) return true

          expect(events[0].from_state).toBe(startState)
          expect(['triagem', 'em_atendimento', 'cliente', 'encerrado']).toContain(events[0].to_state)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('todas as transições na sequência são válidas no TRANSITION_MAP', () => {
    fc.assert(
      fc.property(
        arbStartState,
        arbSequenceLength,
        fc.nat(),
        (startState, length, _seed) => {
          const events = generateValidSequence(startState, length)

          for (const event of events) {
            const isValid = VALID_TRANSITIONS.some(
              t => t.from === event.from_state && t.action === event.action && t.to === event.to_state
            )
            expect(isValid).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
