'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { displayPhone } from '@/utils/format'
import { cn } from '@/lib/utils'
import { getUrgencyStyle } from '@/utils/urgencyColors'
import { deriveGlobalPriority, isGlobalCritical } from '@/utils/globalPriority'
import { splitLeads } from '@/utils/criticalPressure'
import { useCriticalAlert } from '@/hooks/useCriticalAlert'
import { trackEvent, resolveLeadSelectEvents } from '@/utils/behaviorTracker'
import { getProximaAcao, getEtapaLabel, calcularProgresso, isSlaVencido, diasRestantes } from '@/utils/journeyModel'
import { getPrazoLabel } from '@/utils/painelStatus'
import type { Lead } from '../../tela1/page'

interface Props {
  selectedLeadId: string | null
  onSelectLead: (lead: Lead) => void
}

interface BackofficeItem extends Lead {
  ownerName?: string
  lastMessage?: string
  estadoPainel: 'em_atendimento' | 'cliente'
  status_negocio?: string | null
  valor_entrada?: string | null
  prazo_proxima_acao?: string | null
}

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function getInitials(nome: string | null, telefone: string | null): string {
  if (nome) {
    const parts = nome.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return nome.slice(0, 2).toUpperCase()
  }
  return telefone ? telefone.slice(-2) : '??'
}

export default function BackofficeSidebar({ selectedLeadId, onSelectLead }: Props) {
  const [cases, setCases] = useState<BackofficeItem[]>([])
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const socket = useSocket()
  const supabase = createClient()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  const loadCases = useCallback(async () => {
    // 1. Get atendimentos in backoffice states
    const { data: atendimentos } = await supabase
      .from('atendimentos')
      .select('identity_id, estado_painel, owner_id, status_negocio, valor_entrada, prazo_proxima_acao')
      .in('estado_painel', ['em_atendimento', 'cliente'])

    if (!atendimentos || atendimentos.length === 0) {
      if (mountedRef.current) setCases([])
      return
    }

    // 2. Get leads for these identities (most recent per identity)
    const identityIds = atendimentos.map(a => a.identity_id).filter(Boolean)
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .in('identity_id', identityIds)
      .order('ultima_msg_em', { ascending: false, nullsFirst: false })

    // 3. Dedup leads by identity_id (keep most recent)
    const leadByIdentity = new Map<string, any>()
    for (const lead of (leadsData || [])) {
      if (!leadByIdentity.has(lead.identity_id)) {
        leadByIdentity.set(lead.identity_id, lead)
      }
    }

    // 4. Map atendimentos to identity
    const atMap = new Map(atendimentos.map(a => [a.identity_id, a]))

    // 5. Fetch owner names
    const ownerIds = Array.from(new Set(atendimentos.map(a => a.owner_id).filter(Boolean)))
    const ownerNameMap = new Map<string, string>()
    if (ownerIds.length > 0) {
      const { data: ops } = await supabase.from('operadores').select('id, nome').in('id', ownerIds)
      if (ops) ops.forEach((op: any) => ownerNameMap.set(op.id, op.nome || 'Operador'))
    }

    // 6. Fetch last messages
    const leadIds = Array.from(leadByIdentity.values()).map((l: any) => l.id)
    const { data: lastMsgs } = leadIds.length > 0
      ? await supabase.from('mensagens').select('lead_id, conteudo')
          .in('lead_id', leadIds).neq('de', 'bot').neq('tipo', 'sistema').neq('tipo', 'nota_interna')
          .order('created_at', { ascending: false })
      : { data: [] as any[] }
    const msgMap = new Map<string, string>()
    if (lastMsgs) for (const m of lastMsgs) { if (!msgMap.has(m.lead_id)) msgMap.set(m.lead_id, m.conteudo) }

    // 7. Build final list, ordered by ultima_msg_em DESC
    const result: BackofficeItem[] = []
    Array.from(atMap.entries()).forEach(([identityId, at]) => {
      const lead = leadByIdentity.get(identityId)
      if (!lead) return
      result.push({
        ...lead,
        corrigido: lead.corrigido ?? false,
        ownerName: at.owner_id ? ownerNameMap.get(at.owner_id) : undefined,
        lastMessage: msgMap.get(lead.id),
        estadoPainel: at.estado_painel,
        status_negocio: at.status_negocio || null,
        valor_entrada: at.valor_entrada || null,
        prazo_proxima_acao: at.prazo_proxima_acao || null,
      })
    })

    // Sort by ultima_msg_em DESC
    result.sort((a, b) => {
      const aTime = new Date(a.ultima_msg_em || a.created_at).getTime()
      const bTime = new Date(b.ultima_msg_em || b.created_at).getTime()
      return bTime - aTime
    })

    if (mountedRef.current) setCases(result.slice(0, 100))
  }, [])

  // Initial load
  useEffect(() => { loadCases() }, [loadCases])

  // Debounced reload
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadCasesDebounced = useCallback(debounce(() => loadCases(), 300), [loadCases])

  // Socket handlers
  useEffect(() => {
    if (!socket) return

    const handleNovaMensagem = (msg: any) => {
      // Optimistic move-to-top on new message
      setCases(prev => {
        const idx = prev.findIndex(c => c.id === msg.lead_id)
        if (idx <= 0) return prev
        const item = prev[idx]
        return [
          { ...item, ultima_msg_em: msg.created_at, lastMessage: msg.conteudo },
          ...prev.slice(0, idx),
          ...prev.slice(idx + 1),
        ]
      })
      loadCasesDebounced()
    }

    const handleAssignmentUpdate = (data: { lead_id: string; owner_name: string }) => {
      setCases(prev => prev.map(c =>
        c.id === data.lead_id ? { ...c, ownerName: data.owner_name } : c
      ))
    }

    socket.on('nova_mensagem_salva', handleNovaMensagem)
    socket.on('estado_painel_changed', loadCasesDebounced)
    socket.on('conversa_classificada', loadCasesDebounced)
    socket.on('assignment_updated', handleAssignmentUpdate)
    socket.on('connect', loadCases)

    return () => {
      socket.off('nova_mensagem_salva', handleNovaMensagem)
      socket.off('estado_painel_changed', loadCasesDebounced)
      socket.off('conversa_classificada', loadCasesDebounced)
      socket.off('assignment_updated', handleAssignmentUpdate)
      socket.off('connect', loadCases)
    }
  }, [socket, loadCasesDebounced, loadCases])

  // Urgency-sorted cases (unified priority engine)
  const prioritizedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      const pa = deriveGlobalPriority({ ultima_msg_em: a.ultima_msg_em, ultima_msg_de: a.ultima_msg_de, prazo_proxima_acao: a.prazo_proxima_acao, created_at: a.created_at, estado_painel: a.estadoPainel })
      const pb = deriveGlobalPriority({ ultima_msg_em: b.ultima_msg_em, ultima_msg_de: b.ultima_msg_de, prazo_proxima_acao: b.prazo_proxima_acao, created_at: b.created_at, estado_painel: b.estadoPainel })
      if (pa.level !== pb.level) return pa.level - pb.level
      const aTime = new Date(a.ultima_msg_em || a.created_at).getTime()
      const bTime = new Date(b.ultima_msg_em || b.created_at).getTime()
      return bTime - aTime
    })
  }, [cases])

  // ── Critical pressure layer ──
  const { criticalLeads: criticalCases, nonCriticalLeads: nonCriticalCases, criticalCount } = useMemo(() => {
    return splitLeads(prioritizedCases, (item) => ({
      level: isGlobalCritical(deriveGlobalPriority({
        ultima_msg_em: item.ultima_msg_em,
        ultima_msg_de: item.ultima_msg_de,
        prazo_proxima_acao: item.prazo_proxima_acao,
        created_at: item.created_at,
        estado_painel: item.estadoPainel,
      })) ? 'critical' : 'normal'
    }))
  }, [prioritizedCases])

  // ── Sound alert on critical transition ──
  useCriticalAlert(prioritizedCases, operadorId)

  // ── Critical filter toggle ──
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(false)

  useEffect(() => {
    if (criticalCount === 0 && filterCriticalOnly) {
      setFilterCriticalOnly(false)
    }
  }, [criticalCount, filterCriticalOnly])

  // Auto-select first case if none selected
  useEffect(() => {
    if (!selectedLeadId && prioritizedCases.length > 0) {
      onSelectLead(prioritizedCases[0])
    }
  }, [prioritizedCases.length, selectedLeadId])

  function renderCaseItem(item: BackofficeItem) {
    const isSelected = item.id === selectedLeadId
    const displayName = item.nome || displayPhone(item.telefone) || 'Contato'
    const preview = item.lastMessage
      ? (item.lastMessage.length > 50 ? item.lastMessage.slice(0, 50) + '...' : item.lastMessage)
      : '\u00A0'

    const urgency = getUrgencyStyle(item.ultima_msg_em || null, item.ultima_msg_de || null, item.prazo_proxima_acao)
    const prazoVencido = item.prazo_proxima_acao && new Date(item.prazo_proxima_acao).getTime() < Date.now()

    return (
      <button
        key={item.id}
        onClick={() => {
          onSelectLead(item)

          // --- Behavior tracking (fire-and-forget) ---
          if (operadorId) {
            const priority = deriveGlobalPriority({
              ultima_msg_em: item.ultima_msg_em,
              ultima_msg_de: item.ultima_msg_de,
              prazo_proxima_acao: item.prazo_proxima_acao,
              created_at: item.created_at,
              estado_painel: item.estadoPainel,
            })
            const wasCritical = isGlobalCritical(priority)
            const allCases = [...criticalCases, ...nonCriticalCases]
            const positionInQueue = allCases.findIndex(c => c.id === item.id)

            const events = resolveLeadSelectEvents({
              lead: item,
              userId: operadorId,
              wasCritical,
              criticalLeadIds: criticalCases.map(c => c.id),
              positionInQueue,
            })
            for (const event of events) {
              trackEvent(event)
            }
          }
        }}
        className={cn(
          'w-full p-[14px] flex gap-3 text-left transition-all rounded-xl',
          isSelected
            ? 'bg-white shadow-sm border-l-4 border-blue-600'
            : cn(
                'bg-transparent hover:bg-white/50 border-l-4',
                prazoVencido ? 'border-red-500' : 'border-transparent'
              )
        )}
      >
        {/* Avatar */}
        <div className="relative w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold uppercase bg-gray-100 text-gray-300 overflow-hidden">
          {getInitials(item.nome, item.telefone)}
        </div>

        {/* Content — decision-first hierarchy */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Etapa + Responsabilidade + SLA */}
          <div className="flex items-center gap-1.5 mb-1">
            {item.status_negocio && (
              <span className={cn(
                'text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full truncate max-w-[110px]',
                prazoVencido ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              )}>
                {getEtapaLabel(item.status_negocio)}
              </span>
            )}
            <span className={cn(
              'text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0',
              item.ultima_msg_de === 'operador'
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-blue-50 text-blue-700'
            )}>
              {item.ultima_msg_de === 'operador' ? '⏳ Cliente' : '👉 Ação'}
            </span>
            {item.prazo_proxima_acao && (
              <span className={cn(
                'text-[8px] font-bold ml-auto shrink-0',
                prazoVencido ? 'text-red-600' : 'text-gray-400'
              )}>
                {getPrazoLabel(item.prazo_proxima_acao)}
              </span>
            )}
          </div>

          {/* Line 2: Name + Time */}
          <div className="flex justify-between items-baseline mb-0.5">
            <h3 className="font-bold text-gray-900 truncate text-sm">{displayName}</h3>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {urgency.level === 'critical' && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <span className={cn('text-[9px] font-bold', urgency.level !== 'normal' ? urgency.textColor : 'text-gray-300')}>
                {timeAgo(item.ultima_msg_em || item.created_at)}
              </span>
            </div>
          </div>

          {/* Line 3: Próxima ação (dominant) */}
          {item.status_negocio && getProximaAcao(item.status_negocio) && (
            <div className={cn(
              'text-[10px] font-bold truncate',
              prazoVencido ? 'text-red-600' : 'text-blue-600'
            )}>
              → {getProximaAcao(item.status_negocio)}
            </div>
          )}

          {/* Line 4: Preview (subtle) */}
          <p className="text-[10px] text-gray-300 truncate mt-0.5">{preview}</p>

          {/* Line 5: Owner + Badge */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] text-gray-400 truncate">
              {item.ownerName || 'Livre'}
            </span>
            <span className={cn(
              'text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full',
              item.estadoPainel === 'em_atendimento'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-green-100 text-green-600'
            )}>
              {item.estadoPainel === 'em_atendimento' ? 'Atendendo' : 'Cliente'}
            </span>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="w-80 h-full bg-[#F1F3F6] flex flex-col border-r border-[#E6E8EC]/20">
      <div className="pt-6 px-4 pb-4 border-b border-[#E6E8EC]/20">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Backoffice</h2>
        <p className="text-xs text-gray-400 mt-1">{prioritizedCases.length} casos ativos</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 scrollbar-hide">
        {/* Critical banner — clickable toggle filter */}
        {criticalCount > 0 && (
          <button
            onClick={() => setFilterCriticalOnly(prev => !prev)}
            className={`sticky top-0 z-10 mx-0 mb-1 px-3 py-2 rounded-lg text-left w-full transition-all ${
              filterCriticalOnly
                ? 'bg-red-600 border border-red-700'
                : 'bg-red-50 border border-red-300 hover:bg-red-100'
            }`}
          >
            <p className={`text-xs font-bold ${filterCriticalOnly ? 'text-white' : 'text-red-700'}`}>
              🔴 {criticalCount} {criticalCount === 1 ? 'caso precisa' : 'casos precisam'} de atenção
              {filterCriticalOnly && <span className="ml-2 opacity-75">✕ ver todos</span>}
            </p>
          </button>
        )}

        {prioritizedCases.length === 0 && (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">Nenhum caso ativo</p>
        )}

        {/* Render in two sections: critical, separator, rest */}
        {criticalCases.length > 0 && (
          <>
            {criticalCases.map(renderCaseItem)}
            {!filterCriticalOnly && nonCriticalCases.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] font-bold uppercase text-red-500">🔴 URGENTE</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}
            {!filterCriticalOnly && nonCriticalCases.map(renderCaseItem)}
          </>
        )}
        {criticalCases.length === 0 && prioritizedCases.map(renderCaseItem)}
      </div>
    </div>
  )
}
