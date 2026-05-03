'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getEtapaLabel, resolveStatus, JOURNEY_STAGES } from '@/utils/journeyModel'
import { getNextStep } from '@/utils/businessStateMachine'
import { cn } from '@/lib/utils'

interface Props {
  identityId: string | null
  currentStage: string | null
}

interface TransitionItem {
  status_novo: string
  created_at: string
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`

  const diffHours = Math.floor(diffMin / 60)
  const isToday = date.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString()

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `hoje ${time}`
  if (isYesterday) return `ontem ${time}`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ` ${time}`
}

export default function StageTimeline({ identityId, currentStage }: Props) {
  const [transitions, setTransitions] = useState<TransitionItem[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!identityId) { setTransitions([]); return }

    async function load() {
      // Get atendimento_id for this identity
      const { data: at } = await supabase
        .from('atendimentos')
        .select('id')
        .eq('identity_id', identityId)
        .maybeSingle()

      if (!at) { setTransitions([]); return }

      // Get transitions ordered chronologically
      const { data } = await supabase
        .from('status_transitions')
        .select('status_novo, created_at')
        .eq('atendimento_id', at.id)
        .order('created_at', { ascending: true })

      setTransitions(data || [])
    }

    load()
  }, [identityId, currentStage]) // refetch when stage changes

  if (!currentStage) return null

  const resolvedCurrent = resolveStatus(currentStage)

  // Build timeline: completed transitions + current + next
  const completedStages = transitions
    .filter(t => t.status_novo && t.status_novo !== resolvedCurrent)
    .filter(t => {
      // Only show non-terminal stages that are part of the journey
      const stage = JOURNEY_STAGES[resolveStatus(t.status_novo)]
      return stage && !stage.terminal
    })
    .slice(-5) // Last 5 completed (avoid huge lists)

  // Next stage
  const nextStep = getNextStep(resolvedCurrent as any)
  const nextLabel = nextStep ? getEtapaLabel(nextStep.targetStatus) : null

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Jornada</div>
      <div className="space-y-1.5">
        {/* Completed stages */}
        {completedStages.map((t, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-green-500 text-xs w-4 text-center">✓</span>
            <span className="text-xs text-gray-500 flex-1">{getEtapaLabel(t.status_novo)}</span>
            <span className="text-[9px] text-gray-300">{formatRelativeTime(t.created_at)}</span>
          </div>
        ))}

        {/* Current stage */}
        <div className="flex items-center gap-2">
          <span className="text-blue-600 text-xs w-4 text-center font-bold">●</span>
          <span className="text-xs text-blue-700 font-bold flex-1">{getEtapaLabel(resolvedCurrent)}</span>
          <span className="text-[9px] text-blue-400">agora</span>
        </div>

        {/* Next stage */}
        {nextLabel && (
          <div className="flex items-center gap-2 opacity-50">
            <span className="text-gray-300 text-xs w-4 text-center">○</span>
            <span className="text-xs text-gray-400 flex-1">Próximo: {nextLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
