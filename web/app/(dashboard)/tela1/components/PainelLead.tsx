'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import ScoreCircle from './ScoreCircle'
import PopupEnfileirar from './PopupEnfileirar'
import type { Lead } from '../page'

interface Props {
  lead: Lead | null
  onLeadUpdate: (lead: Lead) => void
}

const AREAS = ['Trabalhista', 'Civil', 'Família', 'Previdenciário', 'Criminal', 'Outros']
const URGENCIAS = ['Alta', 'Média', 'Baixa']

export default function PainelLead({ lead, onLeadUpdate }: Props) {
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [valorEstimado, setValorEstimado] = useState('')
  const [showEnfileirar, setShowEnfileirar] = useState(false)
  const [areaHumano, setAreaHumano] = useState<string | null>(null)
  const [showAreaDropdown, setShowAreaDropdown] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (lead) {
      setAreaHumano(lead.area_humano || lead.area_bot || lead.area || null)
      setValorEstimado('')
    }
  }, [lead?.id])

  const handleAreaChange = async (newArea: string) => {
    if (!lead || !operadorId) return
    setAreaHumano(newArea)
    setShowAreaDropdown(false)

    if (newArea !== lead.area_bot) {
      // Insert bot_feedback
      await supabase.from('bot_feedback').insert({
        lead_id: lead.id,
        area_bot: lead.area_bot || lead.area || '',
        area_humano: newArea,
        operador_id: operadorId,
      })
      // Update lead
      await supabase.from('leads').update({
        corrigido: true,
        area_humano: newArea,
      }).eq('id', lead.id)

      onLeadUpdate({ ...lead, area_humano: newArea, corrigido: true })
    } else {
      await supabase.from('leads').update({ area_humano: newArea }).eq('id', lead.id)
      onLeadUpdate({ ...lead, area_humano: newArea })
    }
  }

  const handleValorBlur = async () => {
    if (!lead || !valorEstimado) return
    await supabase
      .from('atendimentos')
      .update({ valor_estimado: parseFloat(valorEstimado) })
      .eq('lead_id', lead.id)
  }

  const handleStatusUpdate = async (status: string) => {
    if (!lead) return
    await supabase
      .from('atendimentos')
      .update({ status, classificacao_final: status, encerrado_em: new Date().toISOString() })
      .eq('lead_id', lead.id)
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

  if (!lead) {
    return (
      <div className="w-[280px] h-full bg-bg-surface flex items-center justify-center text-text-muted text-sm">
        Nenhum lead selecionado
      </div>
    )
  }

  return (
    <div className="w-[280px] h-full bg-bg-surface overflow-y-auto p-4 space-y-4">
      {/* Section 1: Score */}
      <div className="flex justify-center">
        <ScoreCircle score={lead.score} />
      </div>

      {/* Section 2: Classification pills */}
      <div className="space-y-2">
        <div>
          <span className="text-xs text-text-muted block mb-1">Área (bot)</span>
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-bg-surface-hover text-text-secondary">
            {lead.area_bot || lead.area || '—'}
          </span>
        </div>

        <div className="relative">
          <span className="text-xs text-text-muted block mb-1">Área (operador)</span>
          <button
            onClick={() => setShowAreaDropdown(!showAreaDropdown)}
            className="inline-block px-2 py-1 rounded-full text-xs bg-accent/10 text-accent cursor-pointer hover:bg-accent/20"
          >
            {areaHumano || 'Selecionar'} ▾
          </button>
          {showAreaDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-bg-primary border border-border rounded-md shadow-lg z-10">
              {AREAS.map(area => (
                <button
                  key={area}
                  onClick={() => handleAreaChange(area)}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-bg-surface-hover ${
                    area === areaHumano ? 'text-accent font-medium' : 'text-text-primary'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Bot data */}
      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-medium text-text-secondary uppercase">Dados coletados</h3>
        {[
          ['Nome', lead.nome],
          ['Telefone', lead.telefone],
          ['Área', lead.area],
          ['Score', String(lead.score)],
          ['Prioridade', lead.prioridade],
          ['Canal', lead.canal_origem],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="text-xs text-text-muted">{label}</span>
            <p className="text-sm text-text-primary">{value || '—'}</p>
          </div>
        ))}
      </div>

      {/* Section 4: Valor estimado */}
      <div className="border-t border-border pt-3">
        <span className="text-xs text-text-muted block mb-1">Valor estimado (R$)</span>
        <input
          type="number"
          value={valorEstimado}
          onChange={(e) => setValorEstimado(e.target.value)}
          onBlur={handleValorBlur}
          placeholder="0,00"
          className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Section 5: Action buttons */}
      <div className="border-t border-border pt-3 space-y-2">
        <button
          onClick={() => handleStatusUpdate('convertido')}
          className="w-full py-2 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90"
        >
          VIROU CLIENTE
        </button>
        <button
          onClick={() => handleStatusUpdate('nao_fechou')}
          className="w-full py-2 rounded-md text-sm font-medium bg-error/10 text-error hover:bg-error/20"
        >
          NÃO FECHOU
        </button>
        <button
          onClick={() => setShowEnfileirar(true)}
          className="w-full py-2 rounded-md text-sm font-medium bg-warning/10 text-warning hover:bg-warning/20"
        >
          ENCERRAR E ENFILEIRAR
        </button>
        {lead.telefone && (
          <button
            onClick={handleChamarWA}
            className="w-full py-2 rounded-md text-sm font-medium bg-success/10 text-success hover:bg-success/20"
          >
            Chamar no WA
          </button>
        )}
      </div>

      {/* Popup Enfileirar */}
      {showEnfileirar && operadorId && (
        <PopupEnfileirar
          leadId={lead.id}
          operadorId={operadorId}
          valorEstimadoInicial={valorEstimado ? parseFloat(valorEstimado) : undefined}
          onClose={() => setShowEnfileirar(false)}
          onSuccess={() => setShowEnfileirar(false)}
        />
      )}
    </div>
  )
}
