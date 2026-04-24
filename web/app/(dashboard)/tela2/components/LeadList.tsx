'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import type { LeadCliente, Filters } from '../page'

interface Props {
  filters: Filters
  selectedLeadId: string | null
  onSelectLead: (lead: LeadCliente) => void
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
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : nome.slice(0, 2).toUpperCase()
  }
  return telefone ? telefone.slice(-2) : '??'
}

function getPriorityBorder(score: number) {
  if (score >= 7) return 'border-score-hot'
  if (score >= 4) return 'border-score-warm'
  return 'border-score-cold'
}

export default function LeadList({ filters, selectedLeadId, onSelectLead }: Props) {
  const [leads, setLeads] = useState<LeadCliente[]>([])
  const socket = useSocket()
  const supabase = createClient()

  const loadLeads = useCallback(async () => {
    const [leadsRes, clientsRes, othersRes, abandonosRes, potRes, atRes] = await Promise.all([
      supabase.from('leads').select('*').order('score', { ascending: false }),
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('others').select('*').order('created_at', { ascending: false }),
      supabase.from('abandonos').select('*').order('created_at', { ascending: false }),
      supabase.from('pot_tratamento').select('lead_id').eq('status', 'ativo'),
      supabase.from('atendimentos').select('lead_id, status, status_pagamento'),
    ])

    if (leadsRes.error) {
      console.error('[LeadList] erro ao carregar leads:', leadsRes.error.message)
    }

    const atMap = new Map((atRes.data || []).map((a: any) => [a.lead_id, a]))

    const potLeadIds = new Set((potRes.data || []).map((p: any) => p.lead_id))

    const allEntries = [
      ...(leadsRes.data || []).map((l: any) => ({
        ...l,
        _tipo: potLeadIds.has(l.id) ? 'pot' : 'lead',
        _atStatus: atMap.get(l.id)?.status || null,
        _pgStatus: atMap.get(l.id)?.status_pagamento || null,
      })),
      ...(clientsRes.data || []).map((c: any) => ({ ...c, _tipo: 'cliente', score: 0, prioridade: 'MEDIO', area: 'cliente' })),
      ...(othersRes.data || []).map((o: any) => ({ ...o, _tipo: 'outros', score: 0, prioridade: 'FRIO', area: 'outros' })),
      ...(abandonosRes.data || []).map((a: any) => ({
        ...a,
        _tipo: 'abandono',
        nome: a.nome || 'Abandono',
        score: a.score || 0,
        prioridade: a.prioridade || 'FRIO',
        area: a.fluxo || 'abandono',
        telefone: null,
        canal_origem: a.canal_origem,
      })),
    ].sort((a: any, b: any) => (b.score || 0) - (a.score || 0))

    console.log('[LeadList] entradas carregadas:', allEntries.length)

    if (allEntries) {
      setLeads(allEntries.map((l: any) => ({
        ...l,
        corrigido: l.corrigido ?? false,
        status: l.status || 'NOVO',
      })))
    }
  }, [])

  useEffect(() => { loadLeads() }, [loadLeads])

  useEffect(() => {
    if (!socket) return
    const handleAssumido = () => loadLeads()
    socket.on('lead_assumido', handleAssumido)
    return () => { socket.off('lead_assumido', handleAssumido) }
  }, [socket, loadLeads])

  // Apply filters
  let filtered = leads

  // Status filter
  if (filters.status) {
    filtered = filtered.filter(l => {
      const tipo = (l as any)._tipo
      const atStatus = (l as any)._atStatus
      const pgStatus = (l as any)._pgStatus
      switch (filters.status) {
        case 'recebidos': return tipo === 'lead' || tipo === 'cliente'
        case 'desprezados': return tipo === 'outros' || tipo === 'abandono' || l.score < 4
        case 'potAtivo': return tipo === 'pot'
        case 'convertido': return atStatus === 'convertido'
        case 'pgPendente': return atStatus === 'convertido' && pgStatus === 'Pendente'
        case 'pgPago': return atStatus === 'convertido' && pgStatus === 'Pago'
        case 'aguardando': return atStatus === 'aguardando'
        default: return true
      }
    })
  } else {
    // Por padrão, esconder desprezados e abandonos
    filtered = filtered.filter(l => {
      const tipo = (l as any)._tipo
      return tipo !== 'abandono'
    })
  }

  if (filters.prioridade) {
    filtered = filtered.filter(l => {
      if (filters.prioridade === 'QUENTE') return l.score >= 7
      if (filters.prioridade === 'MORNO') return l.score >= 4 && l.score < 7
      return l.score < 4
    })
  }
  if (filters.area) {
    filtered = filtered.filter(l => l.area === filters.area || l.area_humano === filters.area)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {filtered.length === 0 && (
        <div className="flex items-center justify-center h-32 text-text-muted text-sm">
          Nenhum lead encontrado
        </div>
      )}

      {filtered.map(lead => {
        const isSelected = lead.id === selectedLeadId
        return (
          <div
            key={lead.id}
            onClick={() => onSelectLead(lead)}
            className={`px-4 py-3 cursor-pointer border-b border-border transition-colors flex items-center gap-3 ${
              isSelected ? 'bg-bg-surface-hover border-l-2 border-l-success' : 'hover:bg-bg-surface-hover'
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0 border-2 bg-bg-surface ${getPriorityBorder(lead.score)}`}>
              {getInitials(lead.nome, lead.telefone)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate">
                  {lead.nome || lead.telefone || 'Lead'}
                </span>
                <span className="text-xs font-mono font-medium text-text-muted">{lead.score}</span>
                {lead.canal_origem && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    lead.canal_origem === 'telegram' ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'
                  }`}>
                    {lead.canal_origem === 'telegram' ? 'TG' : 'WA'}
                  </span>
                )}
                {(lead.area_humano || lead.area) && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-bg-surface text-text-secondary">
                    {lead.area_humano || lead.area}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-text-muted truncate">
                  {lead.resumo ? JSON.parse(lead.resumo).tipo || '—' : '—'}
                </span>
                <span className="text-xs font-mono text-text-muted shrink-0 ml-2">
                  {timeAgo(lead.created_at)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
