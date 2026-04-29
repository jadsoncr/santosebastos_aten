/**
 * Pure utility functions for the Behavioral Pressure Layer.
 *
 * These functions contain zero side effects, no React imports,
 * and no external dependencies beyond the LeadForAlert interface.
 * They are designed to be easily testable via property-based testing.
 */

export interface LeadForAlert {
  id: string
  ultima_msg_em?: string | null
  ultima_msg_de?: string | null
  prazo_proxima_acao?: string | null
}

/**
 * Partitions a list of leads into critical and non-critical sublists
 * using the provided urgency function as the single source of truth.
 *
 * Preserves the relative order of leads within each sublist.
 */
export function splitLeads<T extends LeadForAlert>(
  leads: T[],
  getUrgency: (lead: T) => { level: string }
): { criticalLeads: T[]; nonCriticalLeads: T[]; criticalCount: number } {
  const criticalLeads: T[] = []
  const nonCriticalLeads: T[] = []

  for (const lead of leads) {
    const urgency = getUrgency(lead)
    if (urgency.level === 'critical') {
      criticalLeads.push(lead)
    } else {
      nonCriticalLeads.push(lead)
    }
  }

  return { criticalLeads, nonCriticalLeads, criticalCount: criticalLeads.length }
}

/**
 * Returns the set of IDs present in `currentIds` but NOT in `previousIds`.
 * These represent leads that just transitioned to critical state.
 */
export function detectNewCriticalIds(
  currentIds: Set<string>,
  previousIds: Set<string>
): Set<string> {
  const newIds = new Set<string>()
  Array.from(currentIds).forEach(id => {
    if (!previousIds.has(id)) {
      newIds.add(id)
    }
  })
  return newIds
}

/**
 * Returns true only when BOTH counts are greater than zero,
 * meaning there are leads in both the critical and non-critical sections.
 */
export function shouldShowSeparator(
  criticalCount: number,
  nonCriticalCount: number
): boolean {
  return criticalCount > 0 && nonCriticalCount > 0
}
