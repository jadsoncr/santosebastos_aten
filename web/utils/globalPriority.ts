/**
 * globalPriority.ts — Unified Priority Engine for BRO Resolve.
 *
 * Derives a single numeric priority (0 = most urgent, 5 = least urgent)
 * from ALL SLA signals: prazo, response time, triagem SLA.
 *
 * Pure functions, zero side effects, injectable `now` for deterministic testing.
 */

import { getThresholdsMs } from './slaConfig'

export type PriorityLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface PriorityResult {
  level: PriorityLevel
  reason: string        // human-readable reason
  label: string         // display label
  textColor: string     // tailwind class
  isUrgent: boolean     // level <= 1
}

export interface PriorityInput {
  ultima_msg_em?: string | null
  ultima_msg_de?: string | null
  prazo_proxima_acao?: string | null
  created_at: string
  estado_painel?: string | null  // null = triagem
  now?: number  // injectable for testing
}

const MS_PER_MIN = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MIN

/**
 * Derives a unified priority from all SLA signals.
 *
 * Priority hierarchy (strict order):
 *   Level 0: prazo vencido | client waiting >30min | triagem >2h
 *   Level 1: client waiting 15-30min
 *   Level 2: client waiting <15min
 *   Level 3: operator sent last message (awaiting client)
 *   Level 4: everything else
 *   Level 5: no data
 */
export function deriveGlobalPriority(input: PriorityInput): PriorityResult {
  const now = input.now ?? Date.now()
  const { resposta_critica_ms, resposta_alerta_ms, triagem_critica_ms } = getThresholdsMs()

  // --- Level 0: prazo_proxima_acao in the past ---
  if (input.prazo_proxima_acao) {
    const prazoTime = new Date(input.prazo_proxima_acao).getTime()
    if (prazoTime < now) {
      return {
        level: 0,
        reason: 'prazo_vencido',
        label: '🔴 Atrasado',
        textColor: 'text-red-600',
        isUrgent: true,
      }
    }
  }

  // --- Level 0/1/2: client waiting (ultima_msg_de === 'cliente') ---
  if (input.ultima_msg_de === 'cliente' && input.ultima_msg_em) {
    const elapsed = now - new Date(input.ultima_msg_em).getTime()
    const elapsedMin = Math.floor(elapsed / MS_PER_MIN)

    if (elapsed > resposta_critica_ms) {
      return {
        level: 0,
        reason: 'resposta_critica',
        label: `⏱ ${elapsedMin}min`,
        textColor: 'text-red-600',
        isUrgent: true,
      }
    }

    if (elapsed >= resposta_alerta_ms) {
      return {
        level: 1,
        reason: 'resposta_alerta',
        label: `⏱ ${elapsedMin}min`,
        textColor: 'text-yellow-600',
        isUrgent: true,
      }
    }

    // < 15min
    const label = elapsedMin >= 1 ? `⏱ ${elapsedMin}min` : '⏱ agora'
    return {
      level: 2,
      reason: 'nova_msg_cliente',
      label,
      textColor: 'text-blue-500',
      isUrgent: false,
    }
  }

  // --- Level 0: triagem SLA (estado_painel is null AND created_at > 2h ago) ---
  if (input.estado_painel === null || input.estado_painel === undefined) {
    const createdTime = new Date(input.created_at).getTime()
    const elapsed = now - createdTime
    if (elapsed > triagem_critica_ms) {
      return {
        level: 0,
        reason: 'triagem_critica',
        label: 'SLA estourado',
        textColor: 'text-red-600',
        isUrgent: true,
      }
    }
  }

  // --- Level 3: operator sent last message ---
  if (input.ultima_msg_de === 'operador') {
    return {
      level: 3,
      reason: 'aguardando_cliente',
      label: 'Aguardando resposta',
      textColor: 'text-gray-400',
      isUrgent: false,
    }
  }

  // --- Level 4: everything else ---
  if (input.ultima_msg_em || input.ultima_msg_de) {
    return {
      level: 4,
      reason: 'normal',
      label: '',
      textColor: 'text-gray-300',
      isUrgent: false,
    }
  }

  // --- Level 5: no data ---
  return {
    level: 5,
    reason: 'sem_dados',
    label: '',
    textColor: 'text-gray-300',
    isUrgent: false,
  }
}

/**
 * Comparator for sorting leads by priority.
 *
 * Returns negative if `a` is more urgent, positive if `b` is more urgent.
 * Within the same level, sorts by recency (more recent ultima_msg_em first).
 */
export function comparePriority(
  a: PriorityResult & { ultima_msg_em?: string | null },
  b: PriorityResult & { ultima_msg_em?: string | null }
): number {
  if (a.level !== b.level) return a.level - b.level

  // Within same level: more recent first (DESC)
  const aTime = a.ultima_msg_em ? new Date(a.ultima_msg_em).getTime() : 0
  const bTime = b.ultima_msg_em ? new Date(b.ultima_msg_em).getTime() : 0
  return bTime - aTime
}

/**
 * Returns true if the priority result is globally critical (level 0).
 */
export function isGlobalCritical(result: PriorityResult): boolean {
  return result.level === 0
}
