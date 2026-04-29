/**
 * behaviorTracker.pure.ts — Funções puras para decisão de eventos comportamentais.
 *
 * Separado do behaviorTracker.ts para permitir testes sem dependência do Supabase.
 * Zero imports externos. Zero efeitos colaterais.
 */

export type BehaviorEventType = 'became_critical' | 'lead_opened' | 'ignored_critical' | 'time_to_action'

export interface TrackEventParams {
  lead_id: string
  user_id: string
  event_type: BehaviorEventType
  metadata?: Record<string, unknown>
}

export interface LeadSelectParams {
  lead: { id: string; ultima_msg_em?: string | null; ultima_msg_de?: string | null }
  userId: string
  wasCritical: boolean
  criticalLeadIds: string[]
  positionInQueue: number
  now?: number
}

/**
 * Determina quais eventos disparar quando um lead é selecionado.
 * Pura — sem efeitos colaterais, determinística com `now`.
 */
export function resolveLeadSelectEvents(params: LeadSelectParams): TrackEventParams[] {
  const { lead, userId, wasCritical, criticalLeadIds, positionInQueue, now = Date.now() } = params
  const events: TrackEventParams[] = []

  // 1. lead_opened — sempre
  const timeSinceCritical = wasCritical && lead.ultima_msg_em
    ? Math.floor((now - new Date(lead.ultima_msg_em).getTime()) / 1000)
    : 0

  events.push({
    lead_id: lead.id,
    user_id: userId,
    event_type: 'lead_opened',
    metadata: {
      was_critical: wasCritical,
      time_since_critical: timeSinceCritical,
      position_in_queue: positionInQueue,
    },
  })

  // 2. ignored_critical — se lead não-crítico E existem críticos
  if (!wasCritical && criticalLeadIds.length > 0) {
    events.push({
      lead_id: lead.id,
      user_id: userId,
      event_type: 'ignored_critical',
      metadata: {
        critical_count: criticalLeadIds.length,
        opened_lead_id: lead.id,
        critical_lead_ids: criticalLeadIds,
      },
    })
  }

  // 3. time_to_action — se lead é crítico
  if (wasCritical && lead.ultima_msg_em) {
    events.push({
      lead_id: lead.id,
      user_id: userId,
      event_type: 'time_to_action',
      metadata: {
        seconds: Math.floor((now - new Date(lead.ultima_msg_em).getTime()) / 1000),
        was_critical: true,
      },
    })
  }

  return events
}

export interface BecameCriticalParams {
  newCriticalIds: string[]
  leads: Array<{ id: string; ultima_msg_em?: string | null }>
  userId: string
  now?: number
}

/**
 * Determina quais eventos disparar quando leads transicionam para crítico.
 * Pura — sem efeitos colaterais, determinística com `now`.
 */
export function resolveBecameCriticalEvents(params: BecameCriticalParams): TrackEventParams[] {
  const { newCriticalIds, leads, userId, now = Date.now() } = params
  const events: TrackEventParams[] = []

  for (const leadId of newCriticalIds) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) continue

    const elapsedMs = lead.ultima_msg_em
      ? now - new Date(lead.ultima_msg_em).getTime()
      : 0
    const elapsedMinutes = Math.floor(elapsedMs / 60000)

    events.push({
      lead_id: leadId,
      user_id: userId,
      event_type: 'became_critical',
      metadata: {
        elapsed_minutes: elapsedMinutes,
        stage: 'atendimento',
      },
    })
  }

  return events
}

/**
 * Calcula a taxa de priorização a partir de contagens.
 * Retorna null se ambos forem zero (divisão por zero).
 */
export function calculatePrioritizationRate(correct: number, ignored: number): number | null {
  const total = correct + ignored
  if (total === 0) return null
  return correct / total
}
