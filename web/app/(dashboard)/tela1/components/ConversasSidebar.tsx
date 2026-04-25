'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { displayPhone } from '@/utils/format'
import { COPY } from '@/utils/copy'
import type { Lead } from '../page'

interface Props {
  selectedLeadId: string | null
  onSelectLead: (lead: Lead) => void
}

interface LeadWithMeta extends Lead {
  _tipo: string
  _slaVencido?: boolean
  _prazoSla?: string
  lastMessage?: string
  unread?: boolean
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

export default function ConversasSidebar({ selectedLeadId, onSelectLead }: Props) {
  const [urgentes, setUrgentes] = useState<LeadWithMeta[]>([])
  const [emAtendimento, setEmAtendimento] = useState<LeadWithMeta[]>([])
  const [aguardando, setAguardando] = useState<LeadWithMeta[]>([])
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const socket = useSocket()
  const supabase = createClient()

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LeadWithMeta[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activePill, setActivePill] = useState<'tudo' | 'naoLidas' | 'retorno'>('tudo')
  const [showNewContactModal, setShowNewContactModal] = useState(false)
  const [newContact, setNewContact] = useState({ nome: '', telefone: '', canal: 'whatsapp', segmento: '' })
  const [isSavingContact, setIsSavingContact] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  // Timer global — re-render a cada 60s pra atualizar SLA
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const loadLeads = useCallback(async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [leadsRes, reaquecidosRes, clientesReaquecidosRes, atendimentosRes] = await Promise.all([
      supabase.from('leads').select('*').eq('is_reaquecido', false).order('score', { ascending: false }),
      supabase.from('leads').select('*').eq('is_reaquecido', true).order('reaquecido_em', { ascending: false }),
      supabase.from('clients').select('*').gte('last_interaction', ontem).order('last_interaction', { ascending: false }),
      supabase.from('atendimentos').select('lead_id, owner_id, status, prazo_sla, tipo_espera'),
    ])

    const atMap = new Map((atendimentosRes.data || []).map((a: any) => [a.lead_id, a]))

    const allLeads = [
      ...(reaquecidosRes.data || []).map((l: any) => ({ ...l, _tipo: 'reaquecido' })),
      ...(clientesReaquecidosRes.data || []).map((c: any) => ({ ...c, _tipo: 'cliente_reaquecido', score: 0, prioridade: 'MEDIO', area: 'cliente' })),
      ...(leadsRes.data || []).map((l: any) => ({ ...l, _tipo: 'lead' })),
    ]

    const urgList: LeadWithMeta[] = []
    const emCursoList: LeadWithMeta[] = []
    const aguardList: LeadWithMeta[] = []

    for (const lead of allLeads) {
      const at = atMap.get(lead.id)
      const mapped: LeadWithMeta = {
        id: lead.id, nome: lead.nome, telefone: lead.telefone, area: lead.area,
        area_bot: lead.area_bot, area_humano: lead.area_humano, score: lead.score || 0,
        prioridade: lead.prioridade || 'FRIO', canal_origem: lead.canal_origem,
        created_at: lead.created_at, resumo: lead.resumo, corrigido: lead.corrigido ?? false,
        is_reaquecido: lead.is_reaquecido, _tipo: lead._tipo,
      }

      if (at?.status === 'aguardando') {
        mapped._prazoSla = at.prazo_sla
        mapped._slaVencido = at.prazo_sla ? new Date(at.prazo_sla).getTime() < now : false
        aguardList.push(mapped)
      } else if (at?.status === 'aberto' && at.owner_id === operadorId) {
        emCursoList.push(mapped)
      } else if (!at || lead._tipo === 'reaquecido') {
        urgList.push(mapped)
      }
    }

    // SLA vencidos no topo dos aguardando
    aguardList.sort((a, b) => {
      if (a._slaVencido && !b._slaVencido) return -1
      if (!a._slaVencido && b._slaVencido) return 1
      return 0
    })

    // Fetch last messages for all leads (client messages only, no bot/system)
    const allLeadIds = [...urgList, ...emCursoList, ...aguardList].map(l => l.id)
    if (allLeadIds.length > 0) {
      const { data: lastMsgs } = await supabase
        .from('mensagens')
        .select('lead_id, conteudo')
        .in('lead_id', allLeadIds)
        .neq('de', 'bot')
        .neq('tipo', 'sistema')
        .neq('tipo', 'nota_interna')
        .order('created_at', { ascending: false })

      if (lastMsgs) {
        const msgMap = new Map<string, string>()
        for (const msg of lastMsgs) {
          if (!msgMap.has(msg.lead_id)) {
            msgMap.set(msg.lead_id, msg.conteudo)
          }
        }
        for (const list of [urgList, emCursoList, aguardList]) {
          for (const lead of list) {
            lead.lastMessage = msgMap.get(lead.id) || undefined
          }
        }
      }
    }

    setUrgentes(urgList)
    setEmAtendimento(emCursoList)
    setAguardando(aguardList)
  }, [operadorId, now])

  useEffect(() => { if (operadorId) loadLeads() }, [loadLeads, operadorId])

  useEffect(() => {
    if (!socket) return
    const reload = () => loadLeads()
    socket.on('lead_assumido', reload)
    socket.on('nova_mensagem_salva', reload)
    socket.on('lead_encerrado', reload)
    socket.on('lead_reaquecido', reload)
    socket.on('lead_status_changed', reload)
    return () => {
      socket.off('lead_assumido', reload)
      socket.off('nova_mensagem_salva', reload)
      socket.off('lead_encerrado', reload)
      socket.off('lead_reaquecido', reload)
      socket.off('lead_status_changed', reload)
    }
  }, [socket, loadLeads])

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

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
        .order('score', { ascending: false })
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

  // ── Build flat list sorted by score (highest first) ──
  function getAllLeadsFlat(): LeadWithMeta[] {
    const all = [...urgentes, ...emAtendimento, ...aguardando]
    // Deduplicate by id
    const seen = new Set<string>()
    const unique: LeadWithMeta[] = []
    for (const lead of all) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        unique.push(lead)
      }
    }
    // Sort by score descending
    unique.sort((a, b) => b.score - a.score)
    return unique
  }

  // ── Filter leads by active pill ──
  function getFilteredLeads(): LeadWithMeta[] {
    const hasSearch = searchQuery.trim().length > 0

    if (hasSearch) {
      let results = [...searchResults]
      if (activePill === 'retorno') {
        const aguardandoIds = new Set(aguardando.map(l => l.id))
        results = results.filter(l => aguardandoIds.has(l.id))
      }
      return results
    }

    if (activePill === 'retorno') {
      return aguardando
    }

    // 'tudo' and 'naoLidas' — flat list of all leads
    return getAllLeadsFlat()
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

      // 3. Create lead
      const { data: lead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          identity_id: identity.id,
          nome: newContact.nome.trim(),
          telefone: newContact.telefone.trim(),
          canal_origem: newContact.canal,
          status: 'aberto',
          is_assumido: true,
          status_pipeline: 'EM_ATENDIMENTO',
        })
        .select('*')
        .single()

      if (leadErr || !lead) throw leadErr

      // 4. Select the new lead
      onSelectLead({ ...lead, corrigido: lead.corrigido ?? false })

      // 5. Close modal and reset form
      setShowNewContactModal(false)
      setNewContact({ nome: '', telefone: '', canal: 'whatsapp', segmento: '' })

      // Reload sidebar
      loadLeads()
    } catch (err) {
      console.error('Erro ao criar contato:', err)
    } finally {
      setIsSavingContact(false)
    }
  }

  const total = urgentes.length + emAtendimento.length + aguardando.length
  const filteredLeads = getFilteredLeads()

  function renderLeadItem(lead: LeadWithMeta) {
    const isSelected = lead.id === selectedLeadId
    const hasSearch = searchQuery.trim().length > 0

    // Border-left by propensity score (calorimetria)
    const borderLeftClass = lead.score >= 7
      ? 'border-l-4 border-l-score-hot'
      : lead.score >= 4
      ? 'border-l-4 border-l-score-warm'
      : 'border-l-4 border-l-score-cold'

    const displayName = lead.nome || displayPhone(lead.telefone) || 'Contato'
    const preview = lead.lastMessage
      ? (lead.lastMessage.length > 45 ? lead.lastMessage.slice(0, 45) + '...' : lead.lastMessage)
      : ''

    return (
      <div key={lead.id}
        onClick={() => {
          onSelectLead(lead)
          if (socket && operadorId && !lead.is_reaquecido) {
            socket.emit('assumir_lead', { lead_id: lead.id, operador_id: operadorId })
          }
        }}
        className={`px-3 py-3 cursor-pointer border-b border-border transition-colors ${
          isSelected ? 'bg-bg-surface-hover' : 'hover:bg-bg-surface-hover'
        } ${borderLeftClass}`}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-bg-surface-hover flex items-center justify-center text-sm font-medium text-text-secondary shrink-0">
            {getInitials(lead.nome, lead.telefone)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Name + Time */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary truncate">
                {hasSearch ? highlightMatch(displayName, searchQuery) : displayName}
              </span>
              <span className="text-[11px] text-text-muted shrink-0 ml-2">
                {timeAgo(lead.created_at)}
              </span>
            </div>

            {/* Row 2: Last message preview */}
            <p className="text-xs text-text-muted truncate mt-0.5">
              {preview || '\u00A0'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const pillClasses = (pill: 'tudo' | 'naoLidas' | 'retorno') =>
    `px-3 py-1 rounded-full text-xs font-medium transition-colors ${
      activePill === pill
        ? 'bg-accent text-white'
        : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-hover'
    }`

  return (
    <div className="w-[280px] h-full bg-sidebar-bg overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{COPY.conversas.operacaoAtiva}</span>
        <span className="bg-accent/10 text-accent text-xs font-mono font-medium px-2 py-0.5 rounded-full">{total}</span>
      </div>

      {/* Search bar + "+" button */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={COPY.busca.placeholder}
            className="w-full bg-bg-surface rounded-full pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>
        <button
          onClick={() => setShowNewContactModal(true)}
          className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-colors shrink-0"
          aria-label={COPY.busca.novoContato}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Filter pills */}
      <div className="px-3 pb-2 flex items-center gap-1.5">
        <button className={pillClasses('tudo')} onClick={() => setActivePill('tudo')}>
          {COPY.pills.tudo}
        </button>
        <button className={pillClasses('naoLidas')} onClick={() => setActivePill('naoLidas')}>
          {COPY.pills.naoLidas}
        </button>
        <button className={pillClasses('retorno')} onClick={() => setActivePill('retorno')}>
          {COPY.pills.retorno}
        </button>
      </div>

      {/* Lead list — FLAT, no sections */}
      <div className="flex-1 overflow-y-auto">
        {isSearching && (
          <p className="px-3 py-4 text-xs text-text-muted text-center">Buscando...</p>
        )}

        {!isSearching && filteredLeads.length === 0 && searchQuery.trim().length > 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-text-muted">{COPY.busca.nenhumResultado}</p>
            <button
              onClick={() => setShowNewContactModal(true)}
              className="text-xs text-accent hover:underline mt-1"
            >
              {COPY.busca.adicionarNovo}
            </button>
          </div>
        )}

        {!isSearching && filteredLeads.length === 0 && searchQuery.trim().length === 0 && (
          <p className="px-3 py-4 text-xs text-text-muted text-center">Nenhum prospecto ativo</p>
        )}

        {!isSearching && filteredLeads.map(renderLeadItem)}
      </div>

      {/* New Contact Modal */}
      {showNewContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-bg-primary rounded-lg shadow-xl w-[360px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">{COPY.busca.novoContato}</h3>
              <button
                onClick={() => setShowNewContactModal(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label="Fechar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Nome</label>
                <input
                  type="text"
                  value={newContact.nome}
                  onChange={(e) => setNewContact(p => ({ ...p, nome: e.target.value }))}
                  className="w-full bg-bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent/30"
                  placeholder="Nome do contato"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Telefone</label>
                <input
                  type="text"
                  value={newContact.telefone}
                  onChange={(e) => setNewContact(p => ({ ...p, telefone: e.target.value }))}
                  className="w-full bg-bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent/30"
                  placeholder="+55 (21) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Canal</label>
                <select
                  value={newContact.canal}
                  onChange={(e) => setNewContact(p => ({ ...p, canal: e.target.value }))}
                  className="w-full bg-bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent/30"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">{COPY.qualificacao.segmento}</label>
                <input
                  type="text"
                  value={newContact.segmento}
                  onChange={(e) => setNewContact(p => ({ ...p, segmento: e.target.value }))}
                  className="w-full bg-bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent/30"
                  placeholder="Ex: Trabalhista"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowNewContactModal(false)}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNewContact}
                disabled={isSavingContact || !newContact.nome.trim() || !newContact.telefone.trim()}
                className="px-4 py-2 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
