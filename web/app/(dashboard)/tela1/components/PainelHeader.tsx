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

export default function PainelHeader({
  estadoPainel,
  ownerNome,
  isOwner,
  leadId,
  operadorId,
  onDelegated,
}: PainelHeaderProps) {
  const [showPopover, setShowPopover] = useState(false)
  const [operators, setOperators] = useState<{ id: string; nome: string }[]>([])
  const supabase = createClient()
  const socket = useSocket()

  async function handleTogglePopover() {
    if (!showPopover) {
      const { data } = await supabase.from('operadores').select('id, nome')
      setOperators(
        (data || [])
          .filter((op: any) => op.id !== operadorId)
          .map((op: any) => ({ id: op.id, nome: op.nome || 'Operador' }))
      )
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
              Delegar
            </button>
          )}
        </div>
      </div>

      {showPopover && (
        <div className="px-4 py-2 border-b bg-blue-50/50 space-y-1">
          {operators.length === 0 && (
            <p className="text-xs text-gray-400 text-center">Nenhum operador</p>
          )}
          {operators.map(op => (
            <button
              key={op.id}
              onClick={() => handleDelegate(op.id)}
              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100"
            >
              {op.nome}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
