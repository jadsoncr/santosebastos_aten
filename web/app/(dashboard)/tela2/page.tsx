'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface LeadComAtendimento {
  id: string
  nome: string | null
  telefone: string | null
  area: string | null
  area_bot: string | null
  score: number
  canal_origem: string | null
  created_at: string
  segmento_id: string | null
  atendimento_status: string
  atendimento_valor: number | null
  assumido_em: string | null
  encerrado_em: string | null
}

const STATUS_GROUPS = [
  { key: 'aberto', label: 'Em Atendimento', color: 'text-accent', bg: 'bg-accent/10' },
  { key: 'aguardando', label: 'Em Negociacao', color: 'text-warning', bg: 'bg-warning/10' },
  { key: 'convertido', label: 'Convertidos', color: 'text-success', bg: 'bg-success/10' },
  { key: 'nao_fechou', label: 'Perdidos', color: 'text-text-muted', bg: 'bg-bg-surface' },
] as const

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

export default function BackOfficePage() {
  const [leads, setLeads] = useState<LeadComAtendimento[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const { data: atendimentos } = await supabase
      .from('atendimentos')
      .select('lead_id, status, valor_estimado, assumido_em, encerrado_em')
      .in('status', ['aberto', 'aguardando', 'convertido', 'nao_fechou', 'enfileirado'])
      .order('assumido_em', { ascending: false })

    if (!atendimentos || atendimentos.length === 0) {
      setLeads([])
      setLoading(false)
      return
    }

    const leadIds = atendimentos.map((a: any) => a.lead_id)
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, nome, telefone, area, area_bot, score, canal_origem, created_at, segmento_id')
      .in('id', leadIds)

    const leadMap = new Map((leadsData || []).map((l: any) => [l.id, l]))

    const merged: LeadComAtendimento[] = atendimentos
      .map((at: any) => {
        const lead = leadMap.get(at.lead_id)
        if (!lead) return null
        return {
          id: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          area: lead.area,
          area_bot: lead.area_bot,
          score: lead.score || 0,
          canal_origem: lead.canal_origem,
          created_at: lead.created_at,
          segmento_id: lead.segmento_id,
          atendimento_status: at.status === 'enfileirado' ? 'aguardando' : at.status,
          atendimento_valor: at.valor_estimado,
          assumido_em: at.assumido_em,
          encerrado_em: at.encerrado_em,
        }
      })
      .filter(Boolean) as LeadComAtendimento[]

    setLeads(merged)
    setLoading(false)
  }

  // Count per group
  const counts: Record<string, number> = {}
  for (const g of STATUS_GROUPS) {
    counts[g.key] = leads.filter(l => l.atendimento_status === g.key).length
  }

  // Filter by active group or show all
  const displayLeads = activeGroup
    ? leads.filter(l => l.atendimento_status === activeGroup)
    : leads

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {STATUS_GROUPS.map(g => (
          <button
            key={g.key}
            onClick={() => setActiveGroup(activeGroup === g.key ? null : g.key)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              activeGroup === g.key
                ? 'border-accent bg-accent/5'
                : 'border-border bg-bg-surface hover:bg-bg-surface-hover'
            }`}
          >
            <span className="text-xs text-text-muted block">{g.label}</span>
            <span className={`text-2xl font-mono font-bold ${g.color}`}>{counts[g.key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Lead list */}
      <div className="bg-bg-surface rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-text-primary">
            {activeGroup
              ? STATUS_GROUPS.find(g => g.key === activeGroup)?.label || 'Todos'
              : 'Todos os atendimentos'}
          </span>
          <span className="text-xs text-text-muted ml-2">({displayLeads.length})</span>
        </div>

        {displayLeads.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-text-muted">Nenhum atendimento encontrado</p>
        )}

        <div className="divide-y divide-border">
          {displayLeads.map(lead => {
            const group = STATUS_GROUPS.find(g => g.key === lead.atendimento_status)
            return (
              <div key={lead.id} className="px-4 py-3 flex items-center gap-4 hover:bg-bg-surface-hover transition-colors">
                {/* Status badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${group?.bg || 'bg-bg-surface'} ${group?.color || 'text-text-muted'}`}>
                  {group?.label || lead.atendimento_status}
                </span>

                {/* Name + area */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-primary truncate block">
                    {lead.nome || lead.telefone || 'Contato'}
                  </span>
                  <span className="text-xs text-text-muted">{lead.area_bot || lead.area || '—'}</span>
                </div>

                {/* Value */}
                {lead.atendimento_valor && (
                  <span className="text-xs font-mono text-success shrink-0">
                    R$ {lead.atendimento_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}

                {/* Time */}
                <span className="text-[11px] text-text-muted shrink-0">
                  {timeAgo(lead.assumido_em)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
