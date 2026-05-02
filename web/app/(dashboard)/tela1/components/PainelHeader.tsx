'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { getEstadoLabel } from '@/utils/painelStatus'
import { cn } from '@/lib/utils'
import type { EstadoPainel } from '@/utils/painelModes'

interface PainelHeaderProps {
  estadoPainel: EstadoPainel | null
  ownerNome: string | null
  isOwner: boolean
  leadId: string
  leadNome: string | null
  leadTelefone: string | null
  leadCanal: string | null
  operadorId: string | null
  role: string
  onDelegated?: () => void
}

interface OperatorWithLoad {
  id: string
  nome: string
  caseCount: number
  level: 'low' | 'medium' | 'high'
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

function getInitials(nome: string | null, telefone: string | null): string {
  if (nome) {
    const parts = nome.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return nome.slice(0, 2).toUpperCase()
  }
  return telefone ? telefone.slice(-2) : '??'
}

export default function PainelHeader({
  estadoPainel,
  ownerNome,
  isOwner,
  leadId,
  leadNome,
  leadTelefone,
  leadCanal,
  operadorId,
  role,
  onDelegated,
}: PainelHeaderProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showDelegateList, setShowDelegateList] = useState(false)
  const [operators, setOperators] = useState<OperatorWithLoad[]>([])
  const [loadingOps, setLoadingOps] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const socket = useSocket()

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setShowDelegateList(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleOpenDelegate() {
    setLoadingOps(true)
    try {
      const { data: ops } = await supabase.from('operadores').select('id, nome')
      const filtered = (ops || []).filter((op: any) => op.id !== operadorId)

      const { data: atendimentos } = await supabase
        .from('atendimentos')
        .select('owner_id')
        .in('estado_painel', ['em_atendimento', 'triagem'])

      const countMap = new Map<string, number>()
      for (const at of (atendimentos || [])) {
        if (at.owner_id) countMap.set(at.owner_id, (countMap.get(at.owner_id) || 0) + 1)
      }

      const withLoad: OperatorWithLoad[] = filtered.map((op: any) => {
        const count = countMap.get(op.id) || 0
        return { id: op.id, nome: op.nome || 'Operador', caseCount: count, level: getLoadLevel(count) }
      }).sort((a, b) => a.caseCount - b.caseCount)

      setOperators(withLoad)
      setShowDelegateList(true)
    } finally {
      setLoadingOps(false)
    }
  }

  function handleDelegate(toUserId: string) {
    if (socket && operadorId) {
      socket.emit('delegate_lead', { lead_id: leadId, from_user_id: operadorId, to_user_id: toUserId })
      setShowMenu(false)
      setShowDelegateList(false)
      onDelegated?.()
    }
  }

  const suggested = operators.length > 0 ? operators[0] : null

  return (
    <div className="px-4 py-3 border-b bg-white flex items-center gap-3 relative">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm shrink-0">
        {getInitials(leadNome, leadTelefone)}
      </div>

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 truncate">{leadNome || 'Contato'}</h3>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span>{leadCanal || 'WhatsApp'}</span>
          <span>•</span>
          <span className={cn(
            'font-bold uppercase',
            estadoPainel === 'em_atendimento' ? 'text-blue-500' :
            estadoPainel === 'cliente' ? 'text-green-500' :
            estadoPainel === 'encerrado' ? 'text-gray-400' : 'text-gray-400'
          )}>
            {getEstadoLabel(estadoPainel)}
          </span>
          {ownerNome && <><span>•</span><span>{ownerNome}</span></>}
        </div>
      </div>

      {/* Menu ⋯ */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => { setShowMenu(!showMenu); setShowDelegateList(false) }}
          className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showMenu && !showDelegateList && (
          <div className="absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
            {isOwner && (
              <button onClick={handleOpenDelegate} className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                Delegar caso
              </button>
            )}
            {role === 'owner' && (
              <button onClick={() => { /* handled elsewhere */ setShowMenu(false) }} className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                Alterar estado (admin)
              </button>
            )}
            <button onClick={() => setShowMenu(false)} className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Vincular identidade
            </button>
          </div>
        )}

        {/* Delegate list */}
        {showMenu && showDelegateList && (
          <div className="absolute right-0 top-10 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2 px-2">
            <button onClick={() => setShowDelegateList(false)} className="text-[9px] text-gray-400 mb-1 hover:text-gray-600">← Voltar</button>
            {loadingOps && <p className="text-xs text-gray-400 text-center py-2">Carregando...</p>}
            {!loadingOps && suggested && (
              <p className="text-[9px] text-blue-600 font-bold mb-1">⚡ Sugerido: {suggested.nome}</p>
            )}
            {!loadingOps && operators.map(op => {
              const badge = getLoadBadge(op.level)
              return (
                <button key={op.id} onClick={() => handleDelegate(op.id)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-50 flex items-center justify-between">
                  <span>{op.nome}</span>
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', badge.color)}>
                    {badge.label} {op.caseCount}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
