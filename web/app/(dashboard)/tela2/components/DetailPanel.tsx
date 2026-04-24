'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { LeadCliente } from '../page'

interface Atendimento {
  id: string
  owner_id: string
  status: string
  assumido_em: string
  encerrado_em: string | null
}

interface Props {
  lead: LeadCliente | null
}

export default function DetailPanel({ lead }: Props) {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [valorEstimado, setValorEstimado] = useState<number | null>(null)
  const [valorConfirmado, setValorConfirmado] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!lead) return
    loadDetails()
  }, [lead?.id])

  async function loadDetails() {
    if (!lead) return

    const { data: atData } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('lead_id', lead.id)
      .order('assumido_em', { ascending: false })

    if (atData) setAtendimentos(atData)

    const { data: potData } = await supabase
      .from('pot_tratamento')
      .select('valor_estimado, valor_confirmado')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (potData) {
      setValorEstimado(potData.valor_estimado)
      setValorConfirmado(potData.valor_confirmado)
    }
  }

  const handleAbrirChat = () => {
    if (lead) router.push(`/tela1?lead=${lead.id}`)
  }

  const handleChamarWA = async () => {
    if (!lead?.telefone) return
    try {
      await fetch('/api/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          telefone: lead.telefone,
          mensagem: `Olá${lead.nome ? ` ${lead.nome}` : ''}! Sou do escritório Santos & Bastos. Podemos conversar?`,
        }),
      })
    } catch {
      alert('Erro ao enviar mensagem via WhatsApp')
    }
  }

  const fmt = (v: number | null) =>
    v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

  if (!lead) {
    return (
      <div className="w-[260px] h-full bg-bg-surface flex items-center justify-center text-text-muted text-sm">
        Selecione um lead
      </div>
    )
  }

  const scoreColor = lead.score >= 7 ? 'text-score-hot' : lead.score >= 4 ? 'text-score-warm' : 'text-score-cold'

  return (
    <div className="w-[260px] h-full bg-bg-surface overflow-y-auto p-4 space-y-4">
      {/* Score */}
      <div className="text-center">
        <span className={`text-3xl font-mono font-bold ${scoreColor}`}>{lead.score}</span>
        <span className="block text-xs text-text-muted mt-1">
          {lead.score >= 7 ? 'QUENTE' : lead.score >= 4 ? 'MORNO' : 'FRIO'}
        </span>
      </div>

      {/* Classification */}
      <div className="space-y-1">
        <span className="text-xs text-text-muted">Classificação</span>
        <div className="flex gap-1 flex-wrap">
          {lead.area_bot && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-bg-surface-hover text-text-secondary">
              Bot: {lead.area_bot}
            </span>
          )}
          {lead.area_humano && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
              {lead.area_humano}
            </span>
          )}
        </div>
      </div>

      {/* Data */}
      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-medium text-text-muted uppercase">Dados</h3>
        {[
          ['Nome', lead.nome],
          ['Telefone', lead.telefone],
          ['Área', lead.area],
          ['Canal', lead.canal_origem],
          ['Prioridade', lead.prioridade],
        ].map(([label, value]) => (
          <div key={label as string}>
            <span className="text-xs text-text-muted">{label}</span>
            <p className="text-sm text-text-primary">{(value as string) || '—'}</p>
          </div>
        ))}
      </div>

      {/* Atendimentos + Timeline */}
      {atendimentos.length > 0 && (
        <div className="border-t border-border pt-3">
          <h3 className="text-xs font-medium text-text-muted uppercase mb-2">Timeline</h3>
          <div className="space-y-2 relative before:absolute before:left-2 before:top-0 before:bottom-0 before:w-px before:bg-border">
            {/* Entrada */}
            <div className="flex items-start gap-2 pl-5 relative">
              <span className="absolute left-0.5 top-1 w-3 h-3 rounded-full bg-accent" />
              <div>
                <span className="text-xs font-medium text-text-primary">Entrada (Bot)</span>
                <span className="text-xs text-text-muted block">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            {/* Atendimentos */}
            {atendimentos.map(at => (
              <div key={at.id} className="flex items-start gap-2 pl-5 relative">
                <span className={`absolute left-0.5 top-1 w-3 h-3 rounded-full ${
                  at.status === 'convertido' ? 'bg-success' :
                  at.status === 'nao_fechou' ? 'bg-error' :
                  at.status === 'aguardando' ? 'bg-warning' :
                  'bg-accent'
                }`} />
                <div>
                  <span className="text-xs font-medium text-text-primary capitalize">{at.status.replace('_', ' ')}</span>
                  <span className="text-xs text-text-muted block">{new Date(at.assumido_em).toLocaleDateString('pt-BR')}</span>
                  {at.encerrado_em && <span className="text-xs text-text-muted block">Encerrado: {new Date(at.encerrado_em).toLocaleDateString('pt-BR')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Valores */}
      <div className="border-t border-border pt-3">
        <h3 className="text-xs font-medium text-text-muted uppercase mb-1">Valores</h3>
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Estimado</span>
          <span className="font-mono text-text-primary">{fmt(valorEstimado)}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-text-muted">Confirmado</span>
          <span className="font-mono text-success">{fmt(valorConfirmado)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border pt-3 space-y-2">
        <button
          onClick={handleAbrirChat}
          className="w-full py-2 rounded-md text-sm font-medium bg-accent text-text-on-accent hover:bg-accent-hover"
        >
          Abrir no chat
        </button>
        <button
          onClick={handleChamarWA}
          disabled={!lead.telefone}
          className="w-full py-2 rounded-md text-sm font-medium bg-success/10 text-success hover:bg-success/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Chamar no WA
        </button>
      </div>
    </div>
  )
}
