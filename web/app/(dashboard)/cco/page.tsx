'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getDecisionContext, type DecisionContext } from '@/utils/decisionContext'
import { cn } from '@/lib/utils'

interface AtendimentoRow {
  id: string
  created_at: string
  estado_painel: string
  status_negocio: string | null
  prazo_proxima_acao: string | null
  owner_id: string | null
  valor_entrada: number | null
  valor_contrato: number | null
  estado_valor: string | null
  status_pagamento: string | null
  encerrado_em: string | null
  lead_id: string | null
  leads: Array<{ ultima_msg_em: string | null; ultima_msg_de: string | null; created_at: string; nome: string | null }> | null
}

interface OperadorInfo {
  id: string
  nome: string
}

export default function CCOPage() {
  const [atendimentos, setAtendimentos] = useState<AtendimentoRow[]>([])
  const [operadores, setOperadores] = useState<OperadorInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [operatorFilter, setOperatorFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('30d')
  const supabase = createClient()
  const realtimeRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async () => {
    const [atsRes, opsRes] = await Promise.all([
      supabase
        .from('atendimentos')
        .select('id, created_at, estado_painel, status_negocio, prazo_proxima_acao, owner_id, valor_entrada, valor_contrato, estado_valor, status_pagamento, encerrado_em, lead_id, leads(ultima_msg_em, ultima_msg_de, created_at, nome)')
        .in('estado_painel', ['triagem', 'em_atendimento', 'cliente', 'encerrado']),
      supabase.from('operadores').select('id, nome'),
    ])

    setAtendimentos((atsRes.data || []) as AtendimentoRow[])
    setOperadores((opsRes.data || []).map((op: any) => ({ id: op.id, nome: op.nome || 'Operador' })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Real-time: debounced refetch on atendimentos changes
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos' }, () => {
        if (realtimeRef.current) return
        realtimeRef.current = setTimeout(() => {
          load()
          realtimeRef.current = null
        }, 1000)
      })
      .subscribe()

    return () => {
      if (realtimeRef.current) clearTimeout(realtimeRef.current)
      supabase.removeChannel(channel)
    }
  }, [load])

  // ── Filters ──
  const filteredAtendimentos = useMemo(() => {
    return atendimentos.filter(at => {
      // Operator filter
      if (operatorFilter !== 'all' && at.owner_id !== operatorFilter) return false
      // Date filter
      const created = new Date(at.created_at).getTime()
      const now = Date.now()
      if (dateFilter === 'today') {
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
        if (created < startOfDay.getTime()) return false
      } else if (dateFilter === '7d') {
        if (now - created > 7 * 86400000) return false
      } else if (dateFilter === '30d') {
        if (now - created > 30 * 86400000) return false
      }
      return true
    })
  }, [atendimentos, operatorFilter, dateFilter])

  // ── Derive all contexts using the decision engine ──
  const activeAts = useMemo(() =>
    filteredAtendimentos.filter(a => a.estado_painel === 'triagem' || a.estado_painel === 'em_atendimento'),
  [filteredAtendimentos])

  const contexts = useMemo(() =>
    activeAts.map(at => {
      const lead = at.leads?.[0] ?? null
      return {
        at,
        ctx: getDecisionContext({
          ultima_msg_em: lead?.ultima_msg_em ?? null,
          ultima_msg_de: lead?.ultima_msg_de ?? null,
          created_at: lead?.created_at ?? at.created_at,
          estado_painel: at.estado_painel,
          status_negocio: at.status_negocio,
          prazo_proxima_acao: at.prazo_proxima_acao,
        }),
      }
    }),
  [activeAts])

  // ── Metrics derived from contexts ──
  const criticalCount = useMemo(() => contexts.filter(c => c.ctx.isCritical).length, [contexts])
  const staleCount = useMemo(() => contexts.filter(c => c.ctx.isStale).length, [contexts])

  // Workload per operator
  const workload = useMemo(() => {
    const map = new Map<string, number>()
    for (const at of activeAts) {
      if (at.owner_id) map.set(at.owner_id, (map.get(at.owner_id) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([id, count]) => ({ id, nome: operadores.find(o => o.id === id)?.nome || 'Operador', count }))
      .sort((a, b) => b.count - a.count)
  }, [activeAts, operadores])

  // Top bottleneck (most common nextAction)
  const bottleneck = useMemo((): { action: string; count: number } | null => {
    const actionMap = new Map<string, number>()
    for (const c of contexts) {
      if (c.ctx.nextAction) actionMap.set(c.ctx.nextAction, (actionMap.get(c.ctx.nextAction) || 0) + 1)
    }
    let top: { action: string; count: number } | null = null
    actionMap.forEach((count, action) => {
      if (!top || count > top.count) top = { action, count }
    })
    return top
  }, [contexts])

  // Financial metrics
  const financeiro = useMemo(() => {
    const emExecucao = filteredAtendimentos.filter(a => a.estado_painel === 'em_atendimento')
    const clientes = filteredAtendimentos.filter(a => a.estado_painel === 'cliente')
    const encerrados = filteredAtendimentos.filter(a => a.estado_painel === 'encerrado')

    const valorPipeline = emExecucao.reduce((s, a) => s + (Number(a.valor_contrato) || 0), 0)
    const valorRealizado = clientes.reduce((s, a) => s + (Number(a.valor_contrato) || 0), 0)
    const valorPerdido = encerrados.reduce((s, a) => s + (Number(a.valor_entrada) || 0), 0)

    const taxaConversao = clientes.length + encerrados.length > 0
      ? Math.round((clientes.length / (clientes.length + encerrados.length)) * 100)
      : 0

    return { valorPipeline, valorRealizado, valorPerdido, taxaConversao, clientesAtivos: clientes.length, encerradosTotal: encerrados.length }
  }, [filteredAtendimentos])

  // Counters
  const totalAtivos = activeAts.length

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  const fmtMoney = (v: number) => v > 0 ? `R$ ${v.toLocaleString('pt-BR')}` : '—'

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centro de Decisão Operacional</h1>
          <p className="text-sm text-gray-400 mt-1">{totalAtivos} decisões ativas • Real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={operatorFilter}
            onChange={e => setOperatorFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 bg-white"
          >
            <option value="all">Todos operadores</option>
            {operadores.map(op => (
              <option key={op.id} value={op.id}>{op.nome}</option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 bg-white"
          >
            <option value="today">Hoje</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {/* ═══ ROW 1: Ação imediata (decision cards) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Critical */}
        <div className={cn("rounded-xl p-5 border", criticalCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-100")}>
          <p className={cn("text-3xl font-black", criticalCount > 0 ? "text-red-700" : "text-gray-300")}>{criticalCount}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Casos críticos</p>
          {criticalCount > 0 && <p className="text-[10px] text-red-500 mt-1">Ação imediata necessária</p>}
        </div>

        {/* Stale */}
        <div className={cn("rounded-xl p-5 border", staleCount > 0 ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-100")}>
          <p className={cn("text-3xl font-black", staleCount > 0 ? "text-yellow-700" : "text-gray-300")}>{staleCount}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Casos parados</p>
          {staleCount > 0 && <p className="text-[10px] text-yellow-600 mt-1">Sem ação há 24h+</p>}
        </div>

        {/* Total active */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-3xl font-black text-blue-700">{totalAtivos}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Decisões ativas</p>
          <p className="text-[10px] text-gray-400 mt-1">Triagem + Execução</p>
        </div>

        {/* Conversion rate */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-3xl font-black text-green-700">{financeiro.taxaConversao}%</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Eficiência de decisão</p>
          <p className="text-[10px] text-gray-400 mt-1">{financeiro.clientesAtivos} clientes / {financeiro.clientesAtivos + financeiro.encerradosTotal} total</p>
        </div>
      </div>

      {/* ═══ ROW 2: Bottleneck + Workload ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bottleneck */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Principal gargalo</p>
          {bottleneck ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-orange-600">{bottleneck.count}</span>
              <div>
                <p className="text-sm font-bold text-gray-900">{bottleneck.action}</p>
                <p className="text-[10px] text-gray-400">casos aguardando esta ação</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-300">Nenhum gargalo identificado</p>
          )}
        </div>

        {/* Workload distribution */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Carga por operador</p>
          {workload.length > 0 ? (
            <div className="space-y-2">
              {workload.map(op => {
                const level = op.count <= 3 ? 'low' : op.count <= 7 ? 'medium' : 'high'
                const barWidth = Math.min(100, (op.count / (workload[0]?.count || 1)) * 100)
                return (
                  <div key={op.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700 w-24 truncate">{op.nome}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all",
                          level === 'low' ? 'bg-green-400' : level === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className={cn("text-xs font-black w-6 text-right",
                      level === 'low' ? 'text-green-600' : level === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    )}>{op.count}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-300">Nenhum operador com casos</p>
          )}
        </div>
      </div>

      {/* ═══ ROW 3: Financeiro ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-3xl font-black text-blue-700">{fmtMoney(financeiro.valorPipeline)}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Receita em decisão</p>
          <p className="text-[10px] text-gray-400 mt-1">Estimado (em execução)</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-3xl font-black text-green-700">{fmtMoney(financeiro.valorRealizado)}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Receita realizada</p>
          <p className="text-[10px] text-gray-400 mt-1">Clientes ativos</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className={cn("text-3xl font-black", financeiro.valorPerdido > 0 ? "text-red-600" : "text-gray-300")}>{fmtMoney(financeiro.valorPerdido)}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Receita perdida</p>
          <p className="text-[10px] text-gray-400 mt-1">Casos encerrados</p>
        </div>
      </div>
    </div>
  )
}
