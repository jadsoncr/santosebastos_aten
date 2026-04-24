'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import type { Lead } from '../page'

interface Props {
  selectedLeadId: string | null
  onSelectLead: (lead: Lead) => void
}

interface LeadWithPreview extends Lead {
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
  const days = Math.floor(hrs / 24)
  return `${days}d`
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
  if (score >= 7) return { bg: 'bg-[#FFF0E8]', text: 'text-score-hot', dot: 'bg-score-hot' }
  if (score >= 4) return { bg: 'bg-[#FFFBEB]', text: 'text-score-warm', dot: 'bg-score-warm' }
  return { bg: 'bg-bg-surface', text: 'text-score-cold', dot: 'bg-score-cold' }
}

export default function ConversasSidebar({ selectedLeadId, onSelectLead }: Props) {
  const [leads, setLeads] = useState<LeadWithPreview[]>([])
  const socket = useSocket()
  const supabase = createClient()

  const loadLeads = useCallback(async () => {
    // Carregar todos os leads, depois filtrar os que não têm atendimento
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('score', { ascending: false })

    if (error) {
      console.error('[ConversasSidebar] erro ao carregar leads:', error.message)
      return
    }

    if (!data || data.length === 0) {
      console.log('[ConversasSidebar] nenhum lead encontrado na tabela')
      setLeads([])
      return
    }

    // Buscar leads que já foram assumidos
    const { data: atendimentos } = await supabase
      .from('atendimentos')
      .select('lead_id')

    const assumidos = new Set((atendimentos || []).map(a => a.lead_id))

    // Filtrar leads não assumidos
    const naoAssumidos = data.filter((l: any) => !assumidos.has(l.id))

    if (naoAssumidos.length > 0) {
      setLeads(naoAssumidos.map((l: any) => ({
        id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        area: l.area,
        area_bot: l.area_bot,
        area_humano: l.area_humano,
        score: l.score,
        prioridade: l.prioridade,
        canal_origem: l.canal_origem,
        created_at: l.created_at,
        resumo: l.resumo,
        corrigido: l.corrigido ?? false,
      })))
    }
  }, [])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  useEffect(() => {
    if (!socket) return

    const handleLeadAssumido = ({ lead_id }: { lead_id: string }) => {
      setLeads(prev => prev.filter(l => l.id !== lead_id))
    }

    const handleNovaMensagem = (msg: { lead_id: string; conteudo: string }) => {
      setLeads(prev =>
        prev.map(l =>
          l.id === msg.lead_id
            ? { ...l, lastMessage: msg.conteudo, unread: l.id !== selectedLeadId }
            : l
        )
      )
    }

    socket.on('lead_assumido', handleLeadAssumido)
    socket.on('nova_mensagem_salva', handleNovaMensagem)

    return () => {
      socket.off('lead_assumido', handleLeadAssumido)
      socket.off('nova_mensagem_salva', handleNovaMensagem)
    }
  }, [socket, selectedLeadId])

  return (
    <div className="w-[280px] h-full bg-sidebar-bg overflow-y-auto flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">Em atendimento</span>
        <span className="bg-accent/10 text-accent text-xs font-mono font-medium px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            Nenhum lead na fila
          </div>
        )}

        {leads.map(lead => {
          const priority = getPriorityStyle(lead.score)
          const isSelected = lead.id === selectedLeadId

          return (
            <div
              key={lead.id}
              onClick={() => {
                onSelectLead(lead)
                setLeads(prev =>
                  prev.map(l => l.id === lead.id ? { ...l, unread: false } : l)
                )
              }}
              className={`px-4 py-3 cursor-pointer border-b border-border transition-colors ${
                isSelected ? 'bg-bg-surface-hover' : 'hover:bg-bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${priority.bg} ${priority.text}`}
                >
                  {getInitials(lead.nome, lead.telefone)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {lead.nome || lead.telefone || 'Lead'}
                    </span>
                    <span className="text-xs font-mono text-text-muted shrink-0 ml-2">
                      {timeAgo(lead.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-text-muted truncate">
                      {lead.lastMessage || lead.area || 'Sem mensagens'}
                    </span>
                    {lead.unread && (
                      <span className="w-2 h-2 rounded-full bg-success shrink-0 ml-2" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
