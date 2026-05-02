'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { getCorPainel, getEstadoLabel } from '@/utils/painelStatus'
import { cn } from '@/lib/utils'
import type { EstadoPainel } from '@/utils/painelModes'

interface PainelHeaderProps {
  estadoPainel: EstadoPainel | null
  ownerNome: string | null
  isOwner: boolean
  leadId: string
  operadorId: string | null
  onDelegated?: () => void
}

interface OperatorWithLoad {
  id: string
  nome: string
  caseCount: number
  level: 'low' | 'medium' | 'high'
}

function getEstadoDot(estado: EstadoPainel | null): string {
  switch (estado) {
    case 'em_atendimento': return 'bg-blue-500'
    case 'cliente': return 'bg-green-500'
    case 'encerrado': return 'bg-gray-400'
    default: return 'bg-gray-400'
  }
}

function getEstadoBorder(estado: EstadoPainel | null): string {
  switch (estado) {
    case 'em_atendimento': return 'border-blue-200'
    case 'cliente': return 'border-green-200'
    case 'encerrado': return 'border-gray-200'
    default: return 'border-gray-100'
  }
}

function getLoadLevel(count: number): 'low' | 'medium' | 'high' {
  if (count <= 3) return 'low'
  if (count <= 7) return 'medium'
  return 'high'
}

function getLoadBadge(level: 'low' | 'medium' | 'high'): { color: string; label: string } {
  switch (level) {
    case 'low': return { color: 'bg-green-100 text-green-700', label: '🟢' }
    case 'medium': return { color: 'bg-yellow-100 text-yellow-700', label: '🟡' }
    case 'high': return { color: 'bg-red-100 text-red-700', label: '🔴' }
  }
}

export default function PainelHeader({
  estadoPainel,
  ownerNome,
  isOwner,
  leadId,
  operadorId,
  onDelegated,
}: PainelHeaderProps) {
  const [showPopover, setShowPopover] = useState(false)
  const [operators, setOperators] = useState<OperatorWithLoad[]>([])
  const [loadingOps, setLoadingOps] = useState(false)
  const supabase = createClient()
  const socket = useSocket()

  async function handleTogglePopover() {
    if (!showPopover) {
      setLoadingOps(true)
      try {
        // 1. Get all operators
        const { data: ops } = await supabase.from('operadores').select('id, nome')
        const filtered = (ops || []).filter((op: any) => op.id !== operadorId)

        // 2. Get case counts per operator (em_atendimento + triagem)
        const { data: atendimentos } = await supabase
          .from('atendimentos')
          .select('owner_id')
          .in('estado_painel', ['em_atendimento', 'triagem'])

        const countMap = new Map<string, number>()
        for (const at of (atendimentos || [])) {
          if (at.owner_id) {
            countMap.set(at.owner_id, (countMap.get(at.owner_id) || 0) + 1)
          }
        }

        // 3. Build operator list with load, sorted by caseCount ASC (least loaded first)
        const withLoad: OperatorWithLoad[] = filtered.map((op: any) => {
          const count = countMap.get(op.id) || 0
          return { id: op.id, nome: op.nome || 'Operador', caseCount: count, level: getLoadLevel(count) }
        }).sort((a, b) => a.caseCount - b.caseCount)

        setOperators(withLoad)
      } finally {
        setLoadingOps(false)
      }
    }
    setShowPopover(!showPopover)
  }

  function handleDelegate(toUserId: string) {
    if (socket && operadorId) {
      socket.emit('delegate_lead', {
        lead_id: leadId,
        from_user_id: operadorId,
        to_user_id: toUserId,
      })
      setShowPopover(false)
      onDelegated?.()
    }
  }

  const suggested = operators.length > 0 ? operators[0] : null

  return (
    <>
      <div className={cn(
        'px-4 py-3 border-b flex items-center justify-between',
        getCorPainel(estadoPainel),
        getEstadoBorder(estadoPainel),
      )}>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', getEstadoDot(estadoPainel))} />
          <span className="text-[10px] font-black uppercase tracking-wider">
            {getEstadoLabel(estadoPainel)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {ownerNome || 'Livre'}
          </span>
          {isOwner && (
            <button
              onClick={handleTogglePopover}
              className="text-[9px] text-blue-600 font-bold uppercase hover:underline"
            >
              {showPopover ? 'Fechar' : 'Delegar'}
            </button>
          )}
        </div>
      </div>

      {showPopover && (
        <div className="px-4 py-3 border-b bg-blue-50/50 space-y-1.5">
          {loadingOps && (
            <p className="text-xs text-gray-400 text-center py-1">Carregando...</p>
          )}
          {!loadingOps && operators.length === 0 && (
            <p className="text-xs text-gray-400 text-center">Nenhum operador disponível</p>
          )}
          {!loadingOps && suggested && (
            <p className="text-[9px] text-blue-600 font-bold uppercase mb-1">
              ⚡ Sugerido: {suggested.nome} (menor carga)
            </p>
          )}
          {!loadingOps && operators.map(op => {
            const badge = getLoadBadge(op.level)
            return (
              <button
                key={op.id}
                onClick={() => handleDelegate(op.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-between transition-colors"
              >
                <span>{op.nome}</span>
                <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full', badge.color)}>
                  {badge.label} {op.caseCount} {op.caseCount === 1 ? 'caso' : 'casos'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
