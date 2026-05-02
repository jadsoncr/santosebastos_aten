'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { displayPhone } from '@/utils/format'
import { cn } from '@/lib/utils'
import { COPY } from '@/utils/copy'
import { getConversationStatus, type ConversationStatusResult } from '@/utils/conversationStatus'
import { getIntencaoAtual } from '@/utils/getIntencaoAtual'
import { getUrgencyStyle, getTriagemSLA } from '@/utils/urgencyColors'
import { splitLeads } from '@/utils/criticalPressure'
import { deriveGlobalPriority, isGlobalCritical } from '@/utils/globalPriority'
import { useCriticalAlert } from '@/hooks/useCriticalAlert'
import { trackEvent, resolveLeadSelectEvents } from '@/utils/behaviorTracker'
import type { Lead } from '../page'

interface Props {
  selectedLeadId: string | null
  onSelectLead: (lead: Lead) => void
  closedLeadId?: string | null
}

interface LeadWithMeta extends Lead {
  _tipo: string
  _slaVencido?: boolean
  _prazoSla?: string
  lastMessage?: string
  unread?: boolean
  _conversationStatus?: ConversationStatusResult
  unreadCount?: number
  ownerName?: string
  lastActionTime?: string
}

function timeAgo(dateStr: string): string {
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

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-accent/20 text-accent rounded-sm">{part}</mark> : part
  )
}

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export default function ConversasSidebar({ selectedLeadId, onSelectLead, closedLeadId }: Props) {
  const [leads, setLeads] = useState<LeadWithMeta[]>([])
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const socket = useSocket()
  const supabase = createClient()

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LeadWithMeta[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activePill, setActivePill] = useState<'todos' | 'aguardando' | 'sem_retorno'>('todos')
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(false)
  const [showNewContactModal, setShowNewContactModal] = useState(false)
  const [newContact, setNewContact] = useState({ nome: '', telefone: '', canal: 'whatsapp', segmento: '', estadoPainel: 'triagem' })
  const [isSavingContact, setIsSavingContact] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  const loadLeads = useCallback(async () => {
    // 1. Get all leads ordered by ultima_msg_em DESC (WhatsApp style)
    const { data: allLeads } = await supabase
      .from('leads')
      .select('*')
      .order('ultima_msg_em', { ascending: false, nullsFirst: false })
      .limit(200) // fetch more, filter client-side

    if (!allLeads) { setLeads([]); return }

    // 2. Get atendimentos to filter by estado_painel
    const identityIds = allLeads.map(l => l.identity_id).filter(Boolean)
    const { data: atendimentos } = identityIds.length > 0
      ? await supabase
          .from('atendimentos')
          .select('identity_id, estado_painel, owner_id')
          .in('identity_id', identityIds)
      : { data: [] as any[] }

    const atMap = new Map((atendimentos || []).map((a: any) => [a.identity_id, a]))

    // 3. Filter: only leads in triagem (or without atendimento)
    const filtered = allLeads.filter((lead: any) => {
      if (!lead.identity_id) return true // no identity = new lead = show
      const at = atMap.get(lead.identity_id)
      if (!at) return true // no atendimento = show
      return at.estado_painel === null || at.estado_painel === 'lead' || at.estado_painel === 'triagem'
    })

    // 4. Dedup by identity_id (keep most recent — already sorted by ultima_msg_em DESC)
    const identityDedup = new Map<string, typeof filtered[0]>()
    for (const lead of filtered) {
      const key = lead.identity_id || lead.id
      if (!identityDedup.has(key)) {
        identityDedup.set(key, lead)
      }
    }

    // 5. Take first 100
    const result = Array.from(identityDedup.values()).slice(0, 100)

    // 6. Fetch owner names
    const ownerIds = Array.from(new Set(result.map(l => atMap.get(l.identity_id)?.owner_id).filter(Boolean)))
    const ownerNameMap = new Map<string, string>()
    if (ownerIds.length > 0) {
      const { data: ops } = await supabase.from('operadores').select('id, nome').in('id', ownerIds)
      if (ops) ops.forEach((op: any) => ownerNameMap.set(op.id, op.nome || 'Operador'))
    }

    // 7. Fetch last messages
    const leadIds = result.map(l => l.id)
    const { data: lastMsgs } = leadIds.length > 0
      ? await supabase
          .from('mensagens')
          .select('lead_id, conteudo')
          .in('lead_id', leadIds)
          .neq('de', 'bot')
          .neq('tipo', 'sistema')
          .neq('tipo', 'nota_interna')
          .order('created_at', { ascending: false })
      : { data: [] as any[] }

    const msgMap = new Map<string, string>()
    if (lastMsgs) {
      for (const msg of lastMsgs) {
        if (!msgMap.has(msg.lead_id)) msgMap.set(msg.lead_id, msg.conteudo)
      }
    }

    // 8. Map to LeadWithMeta
    const mapped: LeadWithMeta[] = result.map((lead: any) => ({
      ...lead,
      corrigido: lead.corrigido ?? false,
      _tipo: lead.is_reaquecido ? 'reaquecido' : 'lead',
      ownerName: atMap.get(lead.identity_id)?.owner_id
        ? ownerNameMap.get(atMap.get(lead.identity_id)!.owner_id)
        : undefined,
      lastMessage: msgMap.get(lead.id),
      _conversationStatus: getConversationStatus(lead.ultima_msg_em || null, lead.created_at),
    }))

    setLeads(mapped)
  }, [operadorId])

  useEffect(() => { if (operadorId) loadLeads() }, [loadLeads, operadorId])

  // Remove lead from local list when closed via PainelLead
  useEffect(() => {
    if (!closedLeadId) return
    setLeads(prev => prev.filter(l => l.id !== closedLeadId))
  }, [closedLeadId])

  // Debounced loadLeads for socket events (300ms)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadLeadsDebounced = useCallback(debounce(() => loadLeads(), 300), [loadLeads])

  // Socket handlers — optimistic + debounce
  useEffect(() => {
    if (!socket) return

    const handleNovaMensagem = (msg: any) => {
      // Optimistic: move to top
      setLeads(prev => {
        const idx = prev.findIndex(l => l.id === msg.lead_id)
        if (idx <= 0) return prev
        const lead = prev[idx]
        return [{ ...lead, ultima_msg_em: msg.created_at, lastMessage: msg.conteudo, ultima_msg_de: 'cliente' }, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
      })
      loadLeadsDebounced()
    }

    socket.on('nova_mensagem_salva', handleNovaMensagem)
    socket.on('lead_assumido', loadLeadsDebounced)
    socket.on('lead_encerrado', loadLeadsDebounced)
    socket.on('lead_reaquecido', loadLeadsDebounced)
    socket.on('estado_painel_changed', loadLeadsDebounced)
    socket.on('conversa_classificada', (data: { lead_id: string }) => {
      setLeads(prev => prev.filter(l => l.id !== data.lead_id))
    })
    socket.on('assignment_updated', (data: { lead_id: string; owner_name: string }) => {
      setLeads(prev => prev.map(l => l.id === data.lead_id ? { ...l, ownerName: data.owner_name } : l))
    })

    return () => {
      socket.off('nova_mensagem_salva', handleNovaMensagem)
      socket.off('lead_assumido', loadLeadsDebounced)
      socket.off('lead_encerrado', loadLeadsDebounced)
      socket.off('lead_reaquecido', loadLeadsDebounced)
      socket.off('estado_painel_changed', loadLeadsDebounced)
      socket.off('conversa_classificada')
      socket.off('assignment_updated')
    }
  }, [socket, loadLeadsDebounced])

  // Reconnect: refetch leads when socket reconnects
  useEffect(() => {
    if (!socket) return
    const handleReconnect = () => { loadLeads() }
    socket.on('connect', handleReconnect)
    return () => { socket.off('connect', handleReconnect) }
  }, [socket, loadLeads])

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  // ── Filtering (single useMemo) ──
  const filteredLeads = useMemo(() => {
    if (searchQuery.trim().length > 0) return searchResults

    let list = leads

    if (activePill === 'aguardando') {
      list = leads.filter(l => {
        if (l.ultima_msg_de !== 'operador') return false
        const diffMs = Date.now() - new Date(l.ultima_msg_em || l.created_at).getTime()
        return diffMs < 2 * 60 * 60 * 1000
      })
    } else if (activePill === 'sem_retorno') {
      list = leads.filter(l => {
        if (l.ultima_msg_de !== 'operador') return false
        const diffMs = Date.now() - new Date(l.ultima_msg_em || l.created_at).getTime()
        return diffMs >= 2 * 60 * 60 * 1000 && diffMs < 7 * 24 * 60 * 60 * 1000
      })
    }

    return list
  }, [leads, activePill, searchQuery, searchResults])

  // ── Urgency sort (unified priority engine) ──
  const prioritizedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      const pa = deriveGlobalPriority({ ultima_msg_em: a.ultima_msg_em, ultima_msg_de: a.ultima_msg_de, created_at: a.created_at, estado_painel: null })
      const pb = deriveGlobalPriority({ ultima_msg_em: b.ultima_msg_em, ultima_msg_de: b.ultima_msg_de, created_at: b.created_at, estado_painel: null })
      if (pa.level !== pb.level) return pa.level - pb.level
      // Within same level: most recent first
      const aTime = new Date(a.ultima_msg_em || a.created_at).getTime()
      const bTime = new Date(b.ultima_msg_em || b.created_at).getTime()
      return bTime - aTime
    })
  }, [filteredLeads])

  // ── Critical pressure layer — split into critical vs non-critical ──
  const { criticalLeads, nonCriticalLeads, criticalCount } = useMemo(() => {
    return splitLeads(prioritizedLeads, (lead) => ({
      level: isGlobalCritical(deriveGlobalPriority({
        ultima_msg_em: lead.ultima_msg_em,
        ultima_msg_de: lead.ultima_msg_de,
        created_at: lead.created_at,
        estado_painel: null,
      })) ? 'critical' : 'normal'
    }))
  }, [prioritizedLeads])

  // ── Sound alert on critical transition ──
  useCriticalAlert(prioritizedLeads, operadorId)

  // Auto-disable critical filter when no more critical leads
  useEffect(() => {
    if (criticalCount === 0 && filterCriticalOnly) {
      setFilterCriticalOnly(false)
    }
  }, [criticalCount, filterCriticalOnly])

  // ── Priority recommendation — top 1 lead that needs attention ──
  const recommendation = useMemo(() => {
    if (prioritizedLeads.length === 0) return null
    const top = prioritizedLeads[0]
    if (!top) return null
    // Only recommend if it's actually urgent
    const priority = deriveGlobalPriority({
      ultima_msg_em: top.ultima_msg_em,
      ultima_msg_de: top.ultima_msg_de,
      created_at: top.created_at,
      estado_painel: null,
    })
    if (priority.level > 2) return null // Only levels 0-2 (critical/urgent)
    const name = top.nome || displayPhone(top.telefone) || 'Contato'
    const diffMs = Date.now() - new Date(top.ultima_msg_em || top.created_at).getTime()
    const diffMin = Math.floor(diffMs / 60000)
    let reason = ''
    if (priority.level === 0) reason = 'prazo vencido'
    else if (diffMin < 5) reason = 'acabou de responder'
    else if (diffMin < 30) reason = `respondeu há ${diffMin}min`
    else reason = 'aguardando ação'
    return { lead: top, name, reason, level: priority.level }
  }, [prioritizedLeads])

  // ── Counters (includes temperature distribution) ──
  const counters = useMemo(() => {
    let waiting = 0, noResponse = 0, hot = 0, warm = 0, cold = 0
    for (const l of leads) {
      // Temperature by score
      if (l.score >= 7) hot++
      else if (l.score >= 4) warm++
      else cold++

      // Existing filters
      if (l.ultima_msg_de === 'operador') {
        const diffMs = Date.now() - new Date(l.ultima_msg_em || l.created_at).getTime()
        if (diffMs < 2 * 60 * 60 * 1000) waiting++
        else if (diffMs < 7 * 24 * 60 * 60 * 1000) noResponse++
      }
    }
    return { total: leads.length, waiting, noResponse, hot, warm, cold }
  }, [leads])

  // ── Search logic with 300ms debounce ──
  function handleSearch(query: string) {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .or(`nome.ilike.%${query}%,telefone.ilike.%${query}%`)
        .order('ultima_msg_em', { ascending: false, nullsFirst: false })
        .limit(20)

      if (data) {
        const mapped = data.map((l: any) => ({
          ...l, corrigido: l.corrigido ?? false, _tipo: 'lead' as const,
        }))
        setSearchResults(mapped)
      }
      setIsSearching(false)
    }, 300)
  }

  // Fade transition state for pill changes
  const [fadeIn, setFadeIn] = useState(true)

  // Auto-select first lead if none selected
  useEffect(() => {
    if (!selectedLeadId && prioritizedLeads.length > 0) {
      onSelectLead(prioritizedLeads[0])
    }
  }, [prioritizedLeads.length, selectedLeadId])

  function handlePillChange(pill: typeof activePill) {
    setFadeIn(false)
    setActivePill(pill)
    setTimeout(() => setFadeIn(true), 10)
  }

  // ── New contact save ──
  async function handleSaveNewContact() {
    if (!newContact.nome.trim() || !newContact.telefone.trim()) return
    setIsSavingContact(true)

    try {
      // 1. Create identity
      const { data: identity, error: idErr } = await supabase
        .from('identities')
        .insert({ nome: newContact.nome.trim(), telefone: newContact.telefone.trim() })
        .select('id')
        .single()

      if (idErr || !identity) throw idErr

      // 2. Create identity_channel
      await supabase.from('identity_channels').insert({
        identity_id: identity.id,
        channel: newContact.canal,
        channel_user_id: newContact.telefone.trim(),
      })

      // 3. Create lead (with origem_entrada = 'manual')
      const { data: lead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          identity_id: identity.id,
          nome: newContact.nome.trim(),
          telefone: newContact.telefone.trim(),
          canal_origem: newContact.canal,
          origem_entrada: 'manual',
          status: 'aberto',
          is_assumido: true,
          status_pipeline: 'EM_ATENDIMENTO',
        })
        .select('*')
        .single()

      if (leadErr || !lead) throw leadErr

      // 4. Create atendimento with selected estado_painel
      const estadoPainel = newContact.estadoPainel as 'triagem' | 'em_atendimento' | 'cliente'
      // cliente manual → 'em_andamento' (não 'fechado' — fechado = contrato assinado)
      const statusNegocio = estadoPainel === 'em_atendimento'
        ? 'analise_viabilidade'
        : estadoPainel === 'cliente'
        ? 'em_andamento'
        : null

      await supabase.from('atendimentos').insert({
        identity_id: identity.id,
        lead_id: lead.id,
        owner_id: operadorId,
        estado_painel: estadoPainel,
        status_negocio: statusNegocio,
        destino: estadoPainel !== 'triagem' ? 'backoffice' : null,
        estado_valor: 'indefinido',
        ...(statusNegocio ? {
          prazo_proxima_acao: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        } : {}),
      })

      // 5. Audit trail — register initial transition
      const { data: at } = await supabase
        .from('atendimentos')
        .select('id')
        .eq('identity_id', identity.id)
        .maybeSingle()

      if (at && operadorId) {
        await supabase.from('status_transitions').insert({
          atendimento_id: at.id,
          status_anterior: null,
          status_novo: statusNegocio || 'triagem',
          operador_id: operadorId,
        })
      }

      // 6. Select the new lead
      onSelectLead({ ...lead, corrigido: lead.corrigido ?? false })

      // 7. Close modal, reset form, show feedback
      setShowNewContactModal(false)
      setNewContact({ nome: '', telefone: '', canal: 'whatsapp', segmento: '', estadoPainel: 'triagem' })

      // Reload sidebar
      loadLeads()
    } catch (err) {
      console.error('Erro ao criar contato:', err)
    } finally {
      setIsSavingContact(false)
    }
  }

  function renderLeadItem(lead: LeadWithMeta) {
    const isSelected = lead.id === selectedLeadId
    const hasSearch = searchQuery.trim().length > 0

    // Urgency indicators
    const urgency = getUrgencyStyle(lead.ultima_msg_em || null, lead.ultima_msg_de || null)
    const triagemSla = getTriagemSLA(lead.created_at)

    const displayName = lead.nome || displayPhone(lead.telefone) || (lead.channel_user_id ? 'Telegram' : 'Contato')
    const intencao = getIntencaoAtual(lead as any)
    const preview = lead.lastMessage
      ? (lead.lastMessage.length > 50 ? lead.lastMessage.slice(0, 50) + '...' : lead.lastMessage)
      : intencao

    // Responsible display
    const responsibleText = lead.ownerName
      ? (lead.ownerName === operadorId ? 'Você' : lead.ownerName)
      : 'Livre'
    const responsibleColor = lead.ownerName
      ? (lead.ownerName === operadorId ? 'text-blue-600' : 'text-gray-400')
      : 'text-yellow-600'

    // Priority visual layer — subtle, no text, operator "feels" it
    const diffMs = Date.now() - new Date(lead.ultima_msg_em || lead.created_at).getTime()
    const diffMin = diffMs / 60000
    const hasUnread = (lead.unreadCount ?? 0) > 0

    const isUrgent = diffMin < 5 || hasUnread
    const needsAttention = diffMin >= 30 && diffMin < 1440
    const isStale = diffMin >= 1440

    const nameWeight = isUrgent ? 'font-black' : 'font-bold'
    const cardBg = isUrgent && !isSelected ? 'bg-blue-50/30' : ''
    const timeColor = urgency.level === 'critical' ? urgency.textColor : isUrgent ? 'text-blue-600' : needsAttention ? 'text-yellow-600' : isStale ? 'text-gray-200' : 'text-gray-300'
    const cardOpacity = isStale ? 'opacity-60' : 'opacity-100'
    const slaLeftBorder = triagemSla ? 'border-l-red-500' : ''

    return (
      <button
        key={lead.id}
        onClick={() => {
          onSelectLead(lead)

          // --- Behavior tracking (fire-and-forget) ---
          if (operadorId) {
            const urgency = getUrgencyStyle(lead.ultima_msg_em || null, lead.ultima_msg_de || null)
            const wasCritical = urgency.level === 'critical'
            const allLeads = [...criticalLeads, ...nonCriticalLeads]
            const positionInQueue = allLeads.findIndex(l => l.id === lead.id)

            const events = resolveLeadSelectEvents({
              lead,
              userId: operadorId,
              wasCritical,
              criticalLeadIds: criticalLeads.map(l => l.id),
              positionInQueue,
            })
            for (const event of events) {
              trackEvent(event)
            }
          }

          if (socket && operadorId && !lead.is_reaquecido) {
            socket.emit('assumir_lead', { lead_id: lead.id, operador_id: operadorId })
          }
        }}
        className={`w-full p-[14px] flex gap-3 text-left transition-all border-l-4 rounded-xl ${cardOpacity} ${
          isSelected
            ? 'bg-white shadow-sm border-blue-600'
            : `${cardBg || 'bg-transparent'} ${slaLeftBorder || 'border-transparent'} hover:bg-white/50`
        }`}
      >
        {/* Avatar */}
        <div className="relative w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold uppercase bg-gray-100 text-gray-300 overflow-hidden">
          {getInitials(lead.nome, lead.telefone)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Name ... Time */}
          <div className="flex justify-between items-baseline mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className={`${nameWeight} text-gray-900 truncate text-sm`}>
                {hasSearch ? highlightMatch(displayName, searchQuery) : displayName}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {urgency.level === 'critical' && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <span className={`text-[9px] font-bold uppercase shrink-0 ${timeColor}`}>
                {timeAgo(lead.ultima_msg_em || lead.created_at)}
              </span>
            </div>
          </div>
          {/* Line 2: Preview + Score */}
          <div className="flex justify-between items-baseline">
            <p className="text-xs text-gray-400 truncate font-medium flex-1">{preview || '\u00A0'}</p>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {urgency.label && <span className={`text-[9px] font-bold ${urgency.textColor}`}>{urgency.label}</span>}
            </div>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="w-80 h-full bg-[#F1F3F6] flex flex-col border-r border-[#E6E8EC]/20">
      {/* Header with tabs and search */}
      <div className="pt-6 px-4 pb-4 border-b border-[#E6E8EC]/20 flex flex-col">
        <h2 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Entradas</h2>
        {(counters.waiting + counters.noResponse) > 0 && (
          <p className="text-[11px] text-gray-400 mb-2">{counters.waiting + counters.noResponse} decisões pendentes</p>
        )}

        {/* Underline tabs */}
        <div className="flex items-center gap-4 mb-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handlePillChange('todos')}
            className={`flex items-center gap-1.5 text-[11px] whitespace-nowrap transition-all relative border-b-2 pb-1 ${
              activePill === 'todos'
                ? 'text-blue-600 font-semibold border-blue-400'
                : 'text-[#9CA3AF] font-normal border-transparent hover:text-gray-500'
            }`}
          >
            Todas entradas {counters.total}
          </button>
          <button
            onClick={() => handlePillChange('aguardando')}
            className={`text-[11px] whitespace-nowrap transition-all border-b-2 pb-1 ${
              activePill === 'aguardando'
                ? 'text-blue-600 font-semibold border-blue-400'
                : 'text-[#9CA3AF] font-normal border-transparent hover:text-gray-500'
            }`}
          >
            Sem decisão {counters.waiting}
          </button>
          <button
            onClick={() => handlePillChange('sem_retorno')}
            className={`text-[11px] whitespace-nowrap transition-all border-b-2 pb-1 ${
              activePill === 'sem_retorno'
                ? 'text-blue-600 font-semibold border-blue-400'
                : 'text-[#9CA3AF] font-normal border-transparent hover:text-gray-500'
            }`}
          >
            Sem avanço {counters.noResponse}
          </button>
        </div>

        {/* Temperature distribution — contextual, not a filter */}
        {counters.total > 0 && (
          <div className="flex items-center gap-2 mb-3">
            {counters.hot > 0 && (
              <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                🔥 {counters.hot}
              </span>
            )}
            {counters.warm > 0 && (
              <span className="text-[9px] font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                ⚠️ {counters.warm}
              </span>
            )}
            {counters.cold > 0 && (
              <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                ❄️ {counters.cold}
              </span>
            )}
          </div>
        )}

        {/* Search bar */}
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar entrada..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#F7F8FA] border border-[#E6E8EC]/10 rounded-xl text-xs focus:ring-1 focus:ring-blue-100 outline-none placeholder:text-gray-300 shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowNewContactModal(true)}
            className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shrink-0"
            aria-label={COPY.busca.novoContato}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Lead list — with critical pressure layer */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 scrollbar-hide transition-opacity duration-200" style={{ opacity: fadeIn ? 1 : 0 }}>
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
              🔴 {criticalCount} lead{criticalCount > 1 ? 's' : ''} decisão atrasada
              {filterCriticalOnly && <span className="ml-2 opacity-75">✕ ver todas</span>}
            </p>
          </button>
        )}

        {/* Priority recommendation — explicit suggestion */}
        {recommendation && recommendation.lead.id !== selectedLeadId && criticalCount === 0 && (
          <button
            onClick={() => onSelectLead(recommendation.lead)}
            className="mx-0 mb-1 px-3 py-2 rounded-lg text-left w-full bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all"
          >
            <p className="text-[11px] font-bold text-blue-700">
              ⚡ Atender {recommendation.name} — {recommendation.reason}
            </p>
          </button>
        )}
        {isSearching && (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">Buscando...</p>
        )}

        {!isSearching && filteredLeads.length === 0 && searchQuery.trim().length > 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-gray-400">{COPY.busca.nenhumResultado}</p>
            <button
              onClick={() => setShowNewContactModal(true)}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              {COPY.busca.adicionarNovo}
            </button>
          </div>
        )}

        {!isSearching && prioritizedLeads.length === 0 && searchQuery.trim().length === 0 && (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">Nenhuma entrada pendente</p>
        )}

        {/* Render in two sections: critical leads, separator, then rest */}
        {!isSearching && criticalLeads.length > 0 && (
          <>
            {criticalLeads.map(renderLeadItem)}
            {!filterCriticalOnly && nonCriticalLeads.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] font-bold uppercase text-red-500">🔴 URGENTE</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}
            {!filterCriticalOnly && nonCriticalLeads.map(renderLeadItem)}
          </>
        )}
        {!isSearching && criticalLeads.length === 0 && !filterCriticalOnly && prioritizedLeads.map(renderLeadItem)}
      </div>

      {/* New Contact Modal */}
      {showNewContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-[360px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">{COPY.busca.novoContato}</h3>
              <button
                onClick={() => setShowNewContactModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Fechar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={newContact.nome}
                  onChange={(e) => setNewContact(p => ({ ...p, nome: e.target.value }))}
                  className="w-full bg-[#F7F8FA] border border-[#E6E8EC]/10 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-100"
                  placeholder="Nome do contato"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Telefone</label>
                <input
                  type="text"
                  value={newContact.telefone}
                  onChange={(e) => setNewContact(p => ({ ...p, telefone: e.target.value }))}
                  className="w-full bg-[#F7F8FA] border border-[#E6E8EC]/10 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-100"
                  placeholder="+55 (21) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Canal</label>
                <select
                  value={newContact.canal}
                  onChange={(e) => setNewContact(p => ({ ...p, canal: e.target.value }))}
                  className="w-full bg-[#F7F8FA] border border-[#E6E8EC]/10 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-100"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">{COPY.qualificacao.segmento}</label>
                <input
                  type="text"
                  value={newContact.segmento}
                  onChange={(e) => setNewContact(p => ({ ...p, segmento: e.target.value }))}
                  className="w-full bg-[#F7F8FA] border border-[#E6E8EC]/10 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-100"
                  placeholder="Ex: Trabalhista"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Estágio do caso</label>
                <div className="flex gap-2">
                  {([
                    { value: 'triagem', label: 'Triagem' },
                    { value: 'em_atendimento', label: 'Em execução' },
                    { value: 'cliente', label: 'Cliente' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewContact(p => ({ ...p, estadoPainel: opt.value }))}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-bold border transition-colors',
                        newContact.estadoPainel === opt.value
                          ? 'border-blue-400 bg-blue-50 text-blue-600'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowNewContactModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNewContact}
                disabled={isSavingContact || !newContact.nome.trim() || !newContact.telefone.trim()}
                className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingContact ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
