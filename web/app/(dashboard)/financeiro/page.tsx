'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface FinanceiroData {
  receitaEstimada: number
  receitaConfirmada: number
  aReceber: number
  ticketMedio: number
  totalFechados: number
  operadores: { email: string; fechados: number; valor: number }[]
  gapBot: number
}

export default function FinanceiroPage() {
  const [data, setData] = useState<FinanceiroData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const mesInicio = new Date()
    mesInicio.setDate(1)
    mesInicio.setHours(0, 0, 0, 0)
    const mesISO = mesInicio.toISOString()

    // Pot tratamento do mês
    const { data: potData } = await supabase
      .from('pot_tratamento')
      .select('valor_estimado, valor_confirmado, operador_id')
      .gte('created_at', mesISO)

    const pot = potData || []
    const estimado = pot.reduce((s, p) => s + (p.valor_estimado || 0), 0)
    const confirmado = pot.reduce((s, p) => s + (p.valor_confirmado || 0), 0)

    // Atendimentos fechados do mês
    const { data: atData } = await supabase
      .from('atendimentos')
      .select('owner_id, status, valor_estimado')
      .gte('assumido_em', mesISO)
      .in('status', ['convertido', 'enfileirado', 'nao_fechou'])

    const at = atData || []
    const fechados = at.filter(a => a.status === 'convertido').length
    const ticketMedio = fechados > 0
      ? at.filter(a => a.status === 'convertido').reduce((s, a) => s + (a.valor_estimado || 0), 0) / fechados
      : 0

    // Agrupar por operador
    const opMap = new Map<string, { fechados: number; valor: number }>()
    at.forEach(a => {
      const curr = opMap.get(a.owner_id) || { fechados: 0, valor: 0 }
      if (a.status === 'convertido') {
        curr.fechados++
        curr.valor += a.valor_estimado || 0
      }
      opMap.set(a.owner_id, curr)
    })

    // Bot feedback gap
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .gte('created_at', mesISO)

    const { count: corrigidos } = await supabase
      .from('bot_feedback')
      .select('id', { count: 'exact' })
      .gte('created_at', mesISO)

    const gap = totalLeads && totalLeads > 0 ? Math.round(((corrigidos || 0) / totalLeads) * 100) : 0

    setData({
      receitaEstimada: estimado,
      receitaConfirmada: confirmado,
      aReceber: estimado - confirmado,
      ticketMedio,
      totalFechados: fechados,
      operadores: Array.from(opMap.entries()).map(([id, v]) => ({
        email: id.slice(0, 8) + '...',
        fechados: v.fechados,
        valor: v.valor,
      })),
      gapBot: gap,
    })
    setLoading(false)
  }

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Carregando...
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold text-text-primary">💰 Painel Financeiro</h1>

      {/* Cards principais */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Receita estimada" value={fmt(data.receitaEstimada)} />
        <MetricCard label="Receita confirmada" value={fmt(data.receitaConfirmada)} accent />
        <MetricCard label="A receber" value={fmt(data.aReceber)} warning={data.aReceber > 0} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Fechamentos" value={String(data.totalFechados)} />
        <MetricCard label="Ticket médio" value={fmt(data.ticketMedio)} />
        <MetricCard label="Gap bot vs humano" value={`${data.gapBot}% corrigidos`} />
      </div>

      {/* Tabela operadores */}
      <div className="bg-bg-surface rounded-md border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium text-text-primary">Fechamentos por operador</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs">
              <th className="text-left px-4 py-2">Operador</th>
              <th className="text-right px-4 py-2">Fechados</th>
              <th className="text-right px-4 py-2">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {data.operadores.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-text-muted text-xs">
                  Nenhum fechamento no mês
                </td>
              </tr>
            )}
            {data.operadores.map((op, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text-primary font-mono text-xs">{op.email}</td>
                <td className="px-4 py-2 text-right font-mono text-xs">{op.fechados}</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-success">{fmt(op.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricCard({ label, value, accent, warning }: {
  label: string; value: string; accent?: boolean; warning?: boolean
}) {
  return (
    <div className={`rounded-md border p-4 ${
      accent ? 'bg-success/5 border-success/20' :
      warning ? 'bg-warning/5 border-warning/20' :
      'bg-bg-surface border-border'
    }`}>
      <span className="text-xs text-text-muted block mb-1">{label}</span>
      <span className={`text-lg font-mono font-bold ${
        accent ? 'text-success' : warning ? 'text-warning' : 'text-text-primary'
      }`}>{value}</span>
    </div>
  )
}
