'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Filters } from '../page'

interface Props {
  filters: Filters
  onFilterChange: (filters: Filters) => void
}

interface Counts {
  recebidos: number
  enviados: number
  aguardando: number
  potAtivo: number
  desprezados: number
  areas: Record<string, number>
}

const STATUS_OPTIONS = [
  { key: 'recebidos', label: 'Recebidos', icon: '📥' },
  { key: 'enviados', label: 'Enviados', icon: '📤' },
  { key: 'aguardando', label: 'Aguardando', icon: '⏳' },
  { key: 'potAtivo', label: 'Pot ativo', icon: '🔄' },
  { key: 'desprezados', label: 'Desprezados', icon: '🗂️' },
]

const PRIORIDADES = [
  { key: 'QUENTE', label: 'Quente', color: 'text-score-hot' },
  { key: 'MORNO', label: 'Morno', color: 'text-score-warm' },
  { key: 'FRIO', label: 'Frio', color: 'text-score-cold' },
]

export default function FilterSidebar({ filters, onFilterChange }: Props) {
  const [counts, setCounts] = useState<Counts>({
    recebidos: 0, enviados: 0, aguardando: 0, potAtivo: 0, desprezados: 0, areas: {},
  })
  const supabase = createClient()

  useEffect(() => { loadCounts() }, [])

  async function loadCounts() {
    const [leadsRes, potRes, othersRes, abandonosRes] = await Promise.all([
      supabase.from('leads').select('id, area, score'),
      supabase.from('pot_tratamento').select('id', { count: 'exact' }).eq('status', 'ativo'),
      supabase.from('others').select('id', { count: 'exact' }),
      supabase.from('abandonos').select('id', { count: 'exact' }),
    ])

    const leads = leadsRes.data || []
    const areas: Record<string, number> = {}
    let frios = 0
    leads.forEach(l => {
      if (l.area) areas[l.area] = (areas[l.area] || 0) + 1
      if (l.score < 4) frios++
    })

    setCounts({
      recebidos: leads.length,
      enviados: 0,
      aguardando: 0,
      potAtivo: potRes.count || 0,
      desprezados: (othersRes.count || 0) + frios + (abandonosRes.count || 0),
      areas,
    })
  }

  const handleStatus = (key: string) => {
    onFilterChange({ ...filters, status: filters.status === key ? null : key })
  }

  const handlePrioridade = (key: string) => {
    onFilterChange({ ...filters, prioridade: filters.prioridade === key ? null : key })
  }

  const handleArea = (key: string) => {
    onFilterChange({ ...filters, area: filters.area === key ? null : key })
  }

  return (
    <div className="w-[200px] h-full bg-sidebar-bg overflow-y-auto p-3 space-y-4">
      <div>
        <h3 className="text-xs font-medium text-text-muted uppercase mb-2">Status</h3>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleStatus(opt.key)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
              filters.status === opt.key
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:bg-bg-surface-hover'
            }`}
          >
            <span>{opt.icon} {opt.label}</span>
            <span className="font-mono">{(counts as any)[opt.key] || 0}</span>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-xs font-medium text-text-muted uppercase mb-2">Prioridade</h3>
        {PRIORIDADES.map(p => (
          <button
            key={p.key}
            onClick={() => handlePrioridade(p.key)}
            className={`w-full flex items-center px-2 py-1.5 rounded text-xs transition-colors ${
              filters.prioridade === p.key
                ? 'bg-accent/10 font-medium'
                : 'hover:bg-bg-surface-hover'
            } ${p.color}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-xs font-medium text-text-muted uppercase mb-2">Área</h3>
        {Object.entries(counts.areas).map(([area, count]) => (
          <button
            key={area}
            onClick={() => handleArea(area)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
              filters.area === area
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:bg-bg-surface-hover'
            }`}
          >
            <span>{area}</span>
            <span className="font-mono">{count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
