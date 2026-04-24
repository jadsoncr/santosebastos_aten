'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Metrics {
  entradasHoje: number
  tempoMedio: string
  quentes: number
  mornos: number
  frios: number
  abandonosHoje: number
}

export default function MetricsPanel() {
  const [metrics, setMetrics] = useState<Metrics>({
    entradasHoje: 0, tempoMedio: '—', quentes: 0, mornos: 0, frios: 0, abandonosHoje: 0,
  })
  const [role, setRole] = useState('operador')
  const [financeiro, setFinanceiro] = useState({ estimado: 0, confirmado: 0 })
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setRole(data.user.user_metadata?.role || 'operador')
    })
    loadMetrics()
  }, [])

  async function loadMetrics() {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeISO = hoje.toISOString()

    const [leadsRes, abandonosRes, allLeads] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact' }).gte('created_at', hojeISO),
      supabase.from('abandonos').select('id', { count: 'exact' }).gte('created_at', hojeISO),
      supabase.from('leads').select('score'),
    ])

    const scores = allLeads.data || []
    setMetrics({
      entradasHoje: leadsRes.count || 0,
      tempoMedio: '—',
      quentes: scores.filter(l => l.score >= 7).length,
      mornos: scores.filter(l => l.score >= 4 && l.score < 7).length,
      frios: scores.filter(l => l.score < 4).length,
      abandonosHoje: abandonosRes.count || 0,
    })

    // Financeiro (owner only)
    const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
    const { data: potData } = await supabase
      .from('pot_tratamento')
      .select('valor_estimado, valor_confirmado')
      .gte('created_at', mesInicio)

    if (potData) {
      setFinanceiro({
        estimado: potData.reduce((s, p) => s + (p.valor_estimado || 0), 0),
        confirmado: potData.reduce((s, p) => s + (p.valor_confirmado || 0), 0),
      })
    }
  }

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-4 border-b border-border">
      <div className="grid grid-cols-4 gap-3 mb-3">
        <Card label="Entradas hoje" value={String(metrics.entradasHoje)} />
        <Card label="Tempo médio" value={metrics.tempoMedio} />
        <div className="bg-bg-surface rounded-md border border-border p-3">
          <span className="text-xs text-text-muted block mb-1">Prioridades</span>
          <div className="flex gap-2">
            <span className="text-xs font-mono font-medium text-score-hot">{metrics.quentes} 🔥</span>
            <span className="text-xs font-mono font-medium text-score-warm">{metrics.mornos} ⚡</span>
            <span className="text-xs font-mono font-medium text-score-cold">{metrics.frios} ❄️</span>
          </div>
        </div>
        <Card label="Abandonos hoje" value={String(metrics.abandonosHoje)} />
      </div>

      {role === 'owner' && (
        <div className="grid grid-cols-3 gap-3">
          <Card label="Receita estimada" value={fmt(financeiro.estimado)} accent />
          <Card label="Receita confirmada" value={fmt(financeiro.confirmado)} accent />
          <Card label="A receber" value={fmt(financeiro.estimado - financeiro.confirmado)} accent />
        </div>
      )}
    </div>
  )
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${accent ? 'bg-accent/5 border-accent/20' : 'bg-bg-surface border-border'}`}>
      <span className="text-xs text-text-muted block mb-1">{label}</span>
      <span className={`text-sm font-mono font-medium ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</span>
    </div>
  )
}
