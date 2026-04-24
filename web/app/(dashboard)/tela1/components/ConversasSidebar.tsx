'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { displayPhone } from '@/utils/format'
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

function getPriorityStyle(score: number) {
  if (score >= 7) return { bg: 'bg-[#FFF0E8]', text: 'text-score-hot' }
  if (score >= 4) return { bg: 'bg-[#FFFBEB]', text: 'text-score-warm' }
  return { bg: 'bg-bg-surface', text: 'text-score-cold' }
}

export default function ConversasSidebar({ selectedLeadId, onSelectLead }: Props) {
  const [urgentes, setUrgentes] = useState<LeadWithMeta[]>([])
  const [emAtendimento, setEmAtendimento] = useState<LeadWithMeta[]>([])
  const [aguardando, setAguardando] = useState<LeadWithMeta[]>([])
  const [collapsed, setCollapsed] = useState({ urgente: false, emCurso: false, aguardando: false })
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const socket = useSocket()
  const supabase = createClient()

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

  const total = urgentes.length + emAtendimento.length + aguardando.length

  function renderLeadItem(lead: LeadWithMeta) {
    const priority = getPriorityStyle(lead.score)
    const isSelected = lead.id === selectedLeadId
    const slaVencido = lead._slaVencido

    return (
      <div key={lead.id}
        onClick={() => {
          onSelectLead(lead)
          if (socket && operadorId && !lead.is_reaquecido) {
            socket.emit('assumir_lead', { lead_id: lead.id, operador_id: operadorId })
          }
        }}
        className={`px-3 py-2.5 cursor-pointer border-b border-border transition-colors ${
          isSelected ? 'bg-bg-surface-hover' : 'hover:bg-bg-surface-hover'
        } ${slaVencido ? 'border-l-2 border-l-warning' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${priority.bg} ${priority.text}`}>
            {getInitials(lead.nome, lead.telefone)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-text-primary truncate">{lead.nome || displayPhone(lead.telefone) || 'Lead'}</span>
              {lead._tipo === 'reaquecido' && <span className="text-xs">🔥</span>}
              {lead._tipo === 'cliente_reaquecido' && <span className="text-xs px-1 py-0.5 rounded bg-success/10 text-success">👤</span>}
              {(lead as any).status_alegado === 'cliente_nao_encontrado' && <span className="text-xs px-1 py-0.5 rounded bg-warning/10 text-warning">⚠️</span>}
              {slaVencido && <span className="text-xs px-1 py-0.5 rounded bg-warning/10 text-warning font-mono">⏰</span>}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {lead.canal_origem && (
                <span className={`text-xs px-1 py-0.5 rounded ${lead.canal_origem === 'telegram' ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'}`}>
                  {lead.canal_origem === 'telegram' ? 'TG' : 'WA'}
                </span>
              )}
              <span className="text-xs text-text-muted truncate">{lead.area || '—'}</span>
              <span className="text-xs font-mono text-text-muted">· {lead.score}pts</span>
              <span className="text-xs font-mono text-text-muted ml-auto">{timeAgo(lead.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function SectionHeader({ label, count, color, section }: { label: string; count: number; color: string; section: 'urgente' | 'emCurso' | 'aguardando' }) {
    return (
      <button onClick={() => setCollapsed(p => ({ ...p, [section]: !p[section] }))}
        className="w-full flex items-center justify-between px-3 py-2 bg-bg-surface border-b border-border text-xs font-medium">
        <span className={color}>{collapsed[section] ? '▸' : '▾'} {label}</span>
        <span className="font-mono text-text-muted">{count}</span>
      </button>
    )
  }

  return (
    <div className="w-[280px] h-full bg-sidebar-bg overflow-y-auto flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">Operação Ativa</span>
        <span className="bg-accent/10 text-accent text-xs font-mono font-medium px-2 py-0.5 rounded-full">{total}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SectionHeader label="🔥 PRIORIDADE MÁXIMA" count={urgentes.length} color="text-error" section="urgente" />
        {!collapsed.urgente && urgentes.map(renderLeadItem)}
        {!collapsed.urgente && urgentes.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">Nenhum lead urgente</p>}

        <SectionHeader label="💬 EM CURSO" count={emAtendimento.length} color="text-accent" section="emCurso" />
        {!collapsed.emCurso && emAtendimento.map(renderLeadItem)}
        {!collapsed.emCurso && emAtendimento.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">Nenhum em curso</p>}

        <SectionHeader label="⏳ EM PAUSA" count={aguardando.length} color="text-warning" section="aguardando" />
        {!collapsed.aguardando && aguardando.map(renderLeadItem)}
        {!collapsed.aguardando && aguardando.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">Nenhum aguardando</p>}
      </div>
    </div>
  )
}
