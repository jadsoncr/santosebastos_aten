'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { MessageSquare, Users, CheckCircle, Archive, Clock, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'

interface Counters {
  leadsHoje: number
  emAtendimento: number
  clientesAtivos: number
  encerrados: number
}

interface Metricas {
  semResposta: number
  taxaConversao: number
  tempoMedioPipeline: number | null
}

interface ValorCards {
  valorPipeline: number
  valorReceitaMes: number
  valorPerdido: number
}

export default function CCOPage() {
  const [counters, setCounters] = useState<Counters>({ leadsHoje: 0, emAtendimento: 0, clientesAtivos: 0, encerrados: 0 })
  const [metricas, setMetricas] = useState<Metricas>({ semResposta: 0, taxaConversao: 0, tempoMedioPipeline: null })
  const [valores, setValores] = useState<ValorCards>({ valorPipeline: 0, valorReceitaMes: 0, valorPerdido: 0 })
  const supabase = createClient()

  const load = useCallback(async () => {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      const [leads, atendimentos, semRespostaResult] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', hoje.toISOString()),
        supabase.from('atendimentos').select('estado_painel, assumido_em, encerrado_em'),
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('ultima_msg_de', 'cliente')
          .lt('ultima_msg_em', new Date(Date.now() - 30 * 60 * 1000).toISOString()),
      ])

      const ats = atendimentos.data || []

      // Contadores
      setCounters({
        leadsHoje: leads.count || 0,
        emAtendimento: ats.filter(a => a.estado_painel === 'em_atendimento').length,
        clientesAtivos: ats.filter(a => a.estado_painel === 'cliente').length,
        encerrados: ats.filter(a => a.estado_painel === 'encerrado').length,
      })

      // Taxa conversão: clientes / (clientes + encerrados)
      const clientesMes = ats.filter(a => a.estado_painel === 'cliente').length
      const encerradosMes = ats.filter(a => a.estado_painel === 'encerrado').length
      const taxaConversao = clientesMes + encerradosMes > 0
        ? Math.round((clientesMes / (clientesMes + encerradosMes)) * 100)
        : 0

      // Tempo médio pipeline (assumido_em → encerrado_em) em dias
      const comPipeline = ats.filter(a => a.assumido_em && a.encerrado_em)
      let tempoMedioPipeline: number | null = null
      if (comPipeline.length > 0) {
        const totalDias = comPipeline.reduce((sum, a) => {
          const diff = new Date(a.encerrado_em).getTime() - new Date(a.assumido_em).getTime()
          return sum + diff / (1000 * 60 * 60 * 24)
        }, 0)
        tempoMedioPipeline = Math.round((totalDias / comPipeline.length) * 10) / 10
      }

      setMetricas({
        semResposta: semRespostaResult.count || 0,
        taxaConversao,
        tempoMedioPipeline,
      })

      // Money cards
      // Valor em pipeline
      const { data: pipeline } = await supabase
        .from('atendimentos')
        .select('valor_entrada')
        .eq('estado_painel', 'em_atendimento')
      const valorPipeline = (pipeline || []).reduce((s, a) => s + (parseFloat(a.valor_entrada) || 0), 0)

      // Receita mês (pagos este mês)
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
      const { data: receitaMes } = await supabase
        .from('atendimentos')
        .select('valor_entrada')
        .eq('status_pagamento', 'pago')
        .gte('encerrado_em', inicioMes)
      const valorReceitaMes = (receitaMes || []).reduce((s, a) => s + (parseFloat(a.valor_entrada) || 0), 0)

      // Valor perdido
      const { data: perdidos } = await supabase
        .from('atendimentos')
        .select('valor_entrada')
        .eq('estado_painel', 'encerrado')
      const valorPerdido = (perdidos || []).reduce((s, a) => s + (parseFloat(a.valor_entrada) || 0), 0)

      setValores({ valorPipeline, valorReceitaMes, valorPerdido })
  }, [])

  // Initial load
  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  const row1 = [
    { label: 'Leads hoje', value: counters.leadsHoje, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Em atendimento', value: counters.emAtendimento, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Clientes', value: counters.clientesAtivos, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Encerrados', value: counters.encerrados, icon: Archive, color: 'text-gray-600', bg: 'bg-gray-50' },
  ]

  const row2 = [
    { label: 'Sem resposta (>30min)', value: metricas.semResposta, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Taxa conversão', value: `${metricas.taxaConversao}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Tempo médio pipeline', value: metricas.tempoMedioPipeline !== null ? `${metricas.tempoMedioPipeline}d` : '—', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  const fmtMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`

  const row3 = [
    { label: 'Valor em pipeline', value: fmtMoney(valores.valorPipeline), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Receita mês', value: fmtMoney(valores.valorReceitaMes), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Valor perdido', value: fmtMoney(valores.valorPerdido), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">CCO — Centro de Comando Operacional</h1>

      {/* Row 1: Contadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {row1.map(card => (
          <div key={card.label} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className={`p-2 rounded-lg w-fit ${card.bg} mb-3`}>
              <card.icon size={20} className={card.color} />
            </div>
            <p className="text-3xl font-black text-gray-900">{card.value}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Métricas de produtividade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {row2.map(card => (
          <div key={card.label} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className={`p-2 rounded-lg w-fit ${card.bg} mb-3`}>
              <card.icon size={20} className={card.color} />
            </div>
            <p className="text-3xl font-black text-gray-900">{card.value}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Row 3: Valor / Receita */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {row3.map(card => (
          <div key={card.label} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className={`p-2 rounded-lg w-fit ${card.bg} mb-3`}>
              <card.icon size={20} className={card.color} />
            </div>
            <p className="text-3xl font-black text-gray-900">{card.value}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
