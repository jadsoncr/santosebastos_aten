'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { displayPhone } from '@/utils/format'
import { cn } from '@/lib/utils'

interface EncerradoItem {
  id: string
  identity_id: string
  nome: string | null
  telefone: string | null
  canal_origem: string | null
  score: number
  motivo_fechamento: string | null
  motivo_perda: string | null
  encerrado_em: string | null
  ciclo: number
  valor_entrada: number
}

const MOTIVO_LABELS: Record<string, string> = {
  abandono_ura: 'Abandono (bot)',
  abandono_operador: 'Abandono (operador)',
  bad_call: 'Bad call',
  sem_perfil: 'Sem perfil',
  nao_evoluiu: 'Não evoluiu',
  resolvido: 'Resolvido',
  preco: 'Preço',
  ja_fechou_outro: 'Fechou com outro',
  sem_retorno: 'Sem retorno',
}

const MOTIVO_COLORS: Record<string, string> = {
  abandono_ura: 'bg-gray-100 text-gray-600',
  abandono_operador: 'bg-orange-100 text-orange-600',
  bad_call: 'bg-red-100 text-red-600',
  sem_perfil: 'bg-yellow-100 text-yellow-600',
  nao_evoluiu: 'bg-gray-100 text-gray-600',
  resolvido: 'bg-green-100 text-green-600',
  preco: 'bg-purple-100 text-purple-600',
  ja_fechou_outro: 'bg-blue-100 text-blue-600',
  sem_retorno: 'bg-gray-100 text-gray-600',
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

export default function EncerradosPage() {
  const [items, setItems] = useState<EncerradoItem[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [valorPerdidoTotal, setValorPerdidoTotal] = useState(0)
  const [filtroMotivo, setFiltroMotivo] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const supabase = createClient()
  const socket = useSocket()

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Get current operator
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  const loadEncerrados = useCallback(async () => {
    // 1. Get atendimentos with estado_painel = 'encerrado'
    const { data: atendimentos } = await supabase
      .from('atendimentos')
      .select('identity_id, motivo_fechamento, motivo_perda, encerrado_em, ciclo, valor_entrada')
      .eq('estado_painel', 'encerrado')
      .order('encerrado_em', { ascending: false, nullsFirst: false })
      .limit(100)

    if (!atendimentos || atendimentos.length === 0) {
      if (mountedRef.current) setItems([])
      return
    }

    // 2. Get leads for these identities
    const identityIds = atendimentos.map(a => a.identity_id).filter(Boolean)
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, identity_id, nome, telefone, canal_origem, score')
      .in('identity_id', identityIds)
      .order('ultima_msg_em', { ascending: false, nullsFirst: false })

    // 3. Dedup leads by identity (keep most recent)
    const leadByIdentity = new Map<string, any>()
    for (const lead of (leadsData || [])) {
      if (!leadByIdentity.has(lead.identity_id)) {
        leadByIdentity.set(lead.identity_id, lead)
      }
    }

    // 4. Map atendimentos to items
    const atMap = new Map(atendimentos.map(a => [a.identity_id, a]))
    const result: EncerradoItem[] = []
    atMap.forEach((at, identityId) => {
      const lead = leadByIdentity.get(identityId)
      if (!lead) return
      result.push({
        id: lead.id,
        identity_id: identityId,
        nome: lead.nome,
        telefone: lead.telefone,
        canal_origem: lead.canal_origem,
        score: lead.score || 0,
        motivo_fechamento: at.motivo_fechamento,
        motivo_perda: at.motivo_perda,
        encerrado_em: at.encerrado_em,
        ciclo: at.ciclo || 1,
        valor_entrada: parseFloat(at.valor_entrada) || 0,
      })
    })

    // Sort by valor_entrada DESC
    result.sort((a, b) => b.valor_entrada - a.valor_entrada)

    const total = result.reduce((s, i) => s + i.valor_entrada, 0)
    if (mountedRef.current) {
      setItems(result)
      setValorPerdidoTotal(total)
    }
  }, [])

  // Initial load
  useEffect(() => { loadEncerrados() }, [loadEncerrados])

  // Socket handlers
  useEffect(() => {
    if (!socket) return

    const handleEstadoChanged = (data: any) => {
      if (data.estado_painel === 'encerrado') loadEncerrados()
    }

    const handleReaquecido = (data: any) => {
      setItems(prev => prev.filter(i => i.id !== data.lead_id))
    }

    socket.on('estado_painel_changed', handleEstadoChanged)
    socket.on('lead_reaquecido', handleReaquecido)
    socket.on('connect', loadEncerrados)

    return () => {
      socket.off('estado_painel_changed', handleEstadoChanged)
      socket.off('lead_reaquecido', handleReaquecido)
      socket.off('connect', loadEncerrados)
    }
  }, [socket, loadEncerrados])

  async function handleReengajar(item: EncerradoItem) {
    setLoadingId(item.id)
    try {
      await supabase.from('atendimentos').update({
        estado_painel: 'lead',
        ciclo: item.ciclo + 1,
        status_negocio: null,
        destino: null,
        prazo_proxima_acao: null,
        motivo_perda: null,
        motivo_fechamento: null,
        encerrado_em: null,
      }).eq('identity_id', item.identity_id)

      // Audit trail
      const { data: at } = await supabase
        .from('atendimentos')
        .select('id')
        .eq('identity_id', item.identity_id)
        .maybeSingle()

      if (at && operadorId) {
        await supabase.from('status_transitions').insert({
          atendimento_id: at.id,
          status_anterior: 'encerrado',
          status_novo: 'lead',
          operador_id: operadorId,
        })
      }

      // Socket events
      if (socket) {
        socket.emit('estado_painel_changed', {
          identity_id: item.identity_id,
          lead_id: item.id,
          estado_painel: 'lead',
        })
        socket.emit('lead_reaquecido', {
          lead_id: item.id,
          status_anterior: 'encerrado',
        })
      }

      // Remove from local list
      setItems(prev => prev.filter(i => i.identity_id !== item.identity_id))
    } catch (err: any) {
      console.error('Erro ao reengajar:', err.message)
    } finally {
      setLoadingId(null)
    }
  }

  const displayItems = filtroMotivo ? items.filter(i => i.motivo_fechamento === filtroMotivo) : items
  const reengajadosCount = items.filter(i => i.ciclo > 1).length

  return (
    <div className="flex flex-col h-full bg-[#F7F8FA]">
      {/* Header */}
      <div className="p-6 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Encerrados</h1>
            <p className="text-sm text-gray-400 mt-1">
              {items.length} casos encerrados
              {reengajadosCount > 0 && (
                <span className="ml-2 text-blue-500 font-bold">{reengajadosCount} reengajados</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Valor perdido card */}
        {valorPerdidoTotal > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm font-bold text-red-700">Valor perdido total</span>
            <span className="text-xl font-black text-red-700">R$ {valorPerdidoTotal.toLocaleString('pt-BR')}</span>
          </div>
        )}

        {/* Filtro por motivo */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFiltroMotivo(null)} className={cn('text-xs px-3 py-1 rounded-full', !filtroMotivo ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600')}>Todos</button>
          {Array.from(new Set(items.map(i => i.motivo_fechamento).filter(Boolean))).map(m => (
            <button key={m} onClick={() => setFiltroMotivo(m)} className={cn('text-xs px-3 py-1 rounded-full', filtroMotivo === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600')}>{MOTIVO_LABELS[m!] || m}</button>
          ))}
        </div>

        {displayItems.map(item => (
          <div
            key={item.identity_id}
            className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-300 text-sm">
                {getInitials(item.nome, item.telefone)}
              </div>
              {/* Info */}
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {item.nome || displayPhone(item.telefone) || 'Contato'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Motivo badge */}
                  <span
                    className={cn(
                      'text-[9px] font-bold uppercase px-2 py-0.5 rounded-full',
                      MOTIVO_COLORS[item.motivo_fechamento || ''] || 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {MOTIVO_LABELS[item.motivo_fechamento || ''] || item.motivo_perda || 'Encerrado'}
                  </span>
                  {/* Time */}
                  <span className="text-[10px] text-gray-300">
                    {item.encerrado_em ? timeAgo(item.encerrado_em) : '—'}
                  </span>
                  {/* Ciclo */}
                  {item.ciclo > 1 && (
                    <span className="text-[9px] text-blue-400 font-bold">ciclo {item.ciclo}</span>
                  )}
                  {/* Valor */}
                  {item.valor_entrada > 0 && (
                    <span className="text-[9px] font-mono font-bold text-green-600">R$ {item.valor_entrada.toLocaleString('pt-BR')}</span>
                  )}
                </div>
              </div>
            </div>
            {/* Reengajar button */}
            <button
              onClick={() => handleReengajar(item)}
              disabled={loadingId === item.id}
              className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-40"
            >
              {loadingId === item.id ? '...' : 'Reengajar'}
            </button>
          </div>
        ))}
        {displayItems.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">Nenhum caso encerrado</p>
        )}
      </div>
    </div>
  )
}
