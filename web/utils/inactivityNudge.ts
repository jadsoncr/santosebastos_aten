/**
 * inactivityNudge.ts — Detecção de inatividade por caso.
 *
 * Regras simples baseadas em prazo_proxima_acao e responsabilidade.
 * Sem IA. Sem side effects. Testável em isolamento.
 */

import { getProximaAcao, getResponsavel, resolveStatus } from './journeyModel'

export interface InactivityNudge {
  /** Severity: 'warning' (24-48h) | 'critical' (48h+) */
  severity: 'warning' | 'critical'
  /** Human-readable message */
  message: string
  /** Suggested action */
  action: string | null
  /** Hours overdue */
  hoursOverdue: number
}

interface NudgeInput {
  prazo_proxima_acao: string | null
  status_negocio: string | null
  ultima_msg_de: string | null
  estado_painel: string | null
}

/**
 * Detects if a case is inactive and returns a nudge if needed.
 * Returns null if the case is within SLA or not applicable.
 *
 * Rules:
 * - Only applies to estado_painel = 'em_atendimento'
 * - Only when responsavel = 'interno' (not waiting for client)
 * - 24h+ overdue = warning
 * - 48h+ overdue = critical
 */
export function detectInactivity(input: NudgeInput, now?: number): InactivityNudge | null {
  const currentTime = now ?? Date.now()

  // Only for active cases
  if (input.estado_painel !== 'em_atendimento') return null

  // Must have a deadline
  if (!input.prazo_proxima_acao) return null

  // Only nudge when it's the operator's turn (not waiting for client)
  const responsavel = getResponsavel(input.status_negocio, input.ultima_msg_de)
  if (responsavel === 'cliente') return null

  const prazoMs = new Date(input.prazo_proxima_acao).getTime()
  const overdueMs = currentTime - prazoMs

  // Not overdue yet
  if (overdueMs <= 0) return null

  const hoursOverdue = Math.floor(overdueMs / (1000 * 60 * 60))

  // Less than 24h overdue — no nudge yet (covered by urgency colors)
  if (hoursOverdue < 24) return null

  const severity: 'warning' | 'critical' = hoursOverdue >= 48 ? 'critical' : 'warning'

  // Get suggested action from journey model
  const action = input.status_negocio ? getProximaAcao(resolveStatus(input.status_negocio)) : null

  const daysOverdue = Math.floor(hoursOverdue / 24)
  const message = daysOverdue === 1
    ? 'Sem ação há 1 dia'
    : `Sem ação há ${daysOverdue} dias`

  return { severity, message, action, hoursOverdue }
}

/**
 * Counts inactive cases from a list of items.
 * Useful for sidebar banners.
 */
export function countInactive(
  items: Array<{ prazo_proxima_acao: string | null; status_negocio: string | null; ultima_msg_de: string | null; estado_painel: string | null }>,
  now?: number
): number {
  return items.filter(item => detectInactivity(item, now) !== null).length
}
