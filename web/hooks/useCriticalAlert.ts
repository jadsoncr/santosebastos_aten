'use client'

import { useRef, useEffect } from 'react'
import { getUrgencyStyle } from '@/utils/urgencyColors'
import { detectNewCriticalIds } from '@/utils/criticalPressure'
import { trackEvent, resolveBecameCriticalEvents } from '@/utils/behaviorTracker'
import type { LeadForAlert } from '@/utils/criticalPressure'

/**
 * useCriticalAlert — Detects when leads TRANSITION into critical state and plays a short alert sound.
 *
 * Rules:
 * - Plays ONLY on transition (new ID enters critical set)
 * - Does NOT play on re-render or refresh if same IDs are critical
 * - Does NOT play when tab is inactive (document.hidden)
 * - Fails silently if browser blocks autoplay
 * - Zero side effects on state — read-only hook
 */
export function useCriticalAlert(leads: LeadForAlert[], userId?: string | null): void {
  const prevCriticalIdsRef = useRef<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isFirstRenderRef = useRef(true)

  // Initialize Audio instance once (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/sounds/alert-critical.wav')
      audioRef.current.volume = 0.5
    }
    return () => {
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    // Calculate current critical IDs using getUrgencyStyle as single source of truth
    const currentCriticalIds = new Set<string>()
    for (const lead of leads) {
      const urgency = getUrgencyStyle(
        lead.ultima_msg_em || null,
        lead.ultima_msg_de || null,
        lead.prazo_proxima_acao ?? undefined
      )
      if (urgency.level === 'critical') {
        currentCriticalIds.add(lead.id)
      }
    }

    // Skip sound on first render (initial load shouldn't trigger alert)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      prevCriticalIdsRef.current = currentCriticalIds
      return
    }

    // Detect new critical IDs (transition)
    const newCriticalIds = detectNewCriticalIds(currentCriticalIds, prevCriticalIdsRef.current)

    // Play sound only if there are new critical IDs AND tab is visible
    if (newCriticalIds.size > 0 && !document.hidden && audioRef.current) {
      // Reset to start in case previous play hasn't finished
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }

    // Track became_critical events (fire-and-forget)
    if (newCriticalIds.size > 0 && userId) {
      const newIds = Array.from(newCriticalIds)
      const events = resolveBecameCriticalEvents({
        newCriticalIds: newIds,
        leads,
        userId,
      })
      for (const event of events) {
        trackEvent(event)
      }
    }

    // Update snapshot for next comparison
    prevCriticalIdsRef.current = currentCriticalIds
  }, [leads])
}
