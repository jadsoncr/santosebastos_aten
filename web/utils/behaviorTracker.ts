/**
 * behaviorTracker.ts — Instrumentação invisível de comportamento do operador.
 *
 * Re-exporta funções puras de behaviorTracker.pure.ts + trackEvent com Supabase.
 * Zero bloqueio de UI. Tolerante a falhas. Sem feedback visual.
 */

import { createClient } from '@/utils/supabase/client'

// Re-export all pure functions and types
export {
  resolveLeadSelectEvents,
  resolveBecameCriticalEvents,
  calculatePrioritizationRate,
} from './behaviorTracker.pure'

export type {
  BehaviorEventType,
  TrackEventParams,
  LeadSelectParams,
  BecameCriticalParams,
} from './behaviorTracker.pure'

import type { TrackEventParams } from './behaviorTracker.pure'

// ── trackEvent — fire-and-forget ──

/**
 * Envia evento de comportamento ao Supabase.
 * Fire-and-forget: retorna void, não Promise. Falha silenciosa.
 */
export function trackEvent({ lead_id, user_id, event_type, metadata = {} }: TrackEventParams): void {
  try {
    const supabase = createClient()
    supabase
      .from('lead_behavior_events')
      .insert({ lead_id, user_id, event_type, metadata })
      .then(() => {}, () => {})
  } catch {
    // Silently fail if Supabase client is not available
  }
}
