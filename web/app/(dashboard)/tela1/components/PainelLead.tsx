'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import ScoreCircle from './ScoreCircle'
import PopupEnfileirar from './PopupEnfileirar'
import type { Lead } from '../page'

interface Props {
  lead: Lead | null
  onLeadUpdate: (lead: Lead) => void
  onLeadClosed: () => void
}

const AREAS = ['Trabalhista', 'Civil', 'Família', 'Previdenciário', 'Criminal', 'Outros']
const MOTIVOS_PERDA = [
  'Preço / Honorários',
  'Sem perfil (área errada)',
  'Já fechou com outro',
  'Decidiu não prosseguir',
  'Sem retorno',
  'Outro',
]

export default function PainelLead({ lead, onLeadUpdate, onLeadClosed }: Props) {
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [valorEstimado, setValorEstimado] = useState('')
  const [areaHumano, setAreaHumano] = useState<string | null>(null)
  const [showAreaDropdown, setShowAreaDropdown] = useState(false)
  const [showEnfileirar, setShowEnfileirar] = useState(false)
  const [showMotivoPopup, setShowMotivoPopup] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [motivoObs, setMotivoObs] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAssumido, setIsAssumido] = useState(false)
  const supabase = createClient()
  const socket = useSocket()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (lead) {
      setAreaHumano(lead.area_humano || lead.area_bot || lead.area || null)
      setValorEstimado('')
      setShowEnfileirar(false)
      setShowMotivoPopup(false)
      checkAssumido()
    }
  }, [lead?.id])

  async function checkAssumido() {
    if (!lead) return
    const { data } = await supabase
      .from('atendimentos')
      .select('owner_id')
      .eq('lead_id', lead.id)
      .maybeSingle()
    setIsAssumido(!!data)
  }

  const handleAreaChange = async (newArea: string) => {
    if (!lead || !operadorId) return
    setAreaHumano(newArea)
    setShowAreaDropdown(false)

    if (newArea !== (lead.area_bot || lead.area)) {
      await supabase.from('bot_feedback').insert({
        lead_id: lead.id,
        area_bot: lead.area_bot || lead.area || '',
        area_humano: newArea,
        operador_id: operadorId,
      })
      await supabase.from('leads').update({ corrigido: true, area_humano: newArea }).eq('id', lead.id)
      onLeadUpdate({ ...lead, area_humano: newArea, corrigido: true })
    } else {
      await supabase.from('leads').update({ area_humano: newArea }).eq('id', lead.id)
      onLeadUpdate({ ...lead, area_humano: newArea })
    }
  }

  const handleValorBlur = async () => {
    if (!lead || !valorEstimado || !isAssumido) return
    await supabase.from('atendimentos')
      .update({ valor_estimado: parseFloat(valorEstimado) })
      .eq('lead_id', lead.id)
  }

  // ── handleCloseAtendimento — motor central do circuito fechado ──
  async function handleCloseAtendimento(tipo: 'convertido' | 'nao_fechou' | 'enfileirado') {
    if (!lead || !operadorId) return
    setLoading(true)

    try {
      if (tipo === 'convertido') {
        // 1. INSERT clients (atômico: se falhar, não atualiza atendimento)
        const { error: clientErr } = await supabase.from('clients').insert({
          identity_id: lead.id, // usando lead.id como referência
          request_id: crypto.randomUUID(),
          nome: lead.nome,
          telefone: lead.telefone,
          urgencia: lead.prioridade,
          canal_origem: lead.canal_origem,
        })
        if (clientErr) throw new Error(`Erro ao criar cliente: ${clientErr.message}`)

        // 2. UPDATE atendimentos
        await supabase.from('atendimentos').update({
          status: 'convertido',
          classificacao_final: areaHumano || lead.area,
          valor_estimado: valorEstimado ? parseFloat(valorEstimado) : null,
          encerrado_em: new Date().toISOString(),
        }).eq('lead_id', lead.id)

      } else if (tipo === 'nao_fechou') {
        // 1. INSERT repescagem
        const { error: repErr } = await supabase.from('repescagem').insert({
          lead_id: lead.id,
          operador_id: operadorId,
          motivo: motivoSelecionado,
          observacao: motivoObs || null,
          data_retorno: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })
        if (repErr) throw new Error(`Erro ao registrar repescagem: ${repErr.message}`)

        // 2. UPDATE atendimentos
        await supabase.from('atendimentos').update({
          status: 'nao_fechou',
          motivo_perda: motivoSelecionado,
          classificacao_final: areaHumano || lead.area,
          encerrado_em: new Date().toISOString(),
        }).eq('lead_id', lead.id)
      }
      // enfileirado é tratado pelo PopupEnfileirar

      // Broadcast via socket
      if (socket) {
        socket.emit('lead_encerrado', { lead_id: lead.id, tipo })
      }

      // Limpar tela
      onLeadClosed()

    } catch (err: any) {
      alert(err.message || 'Erro ao encerrar atendimento')
    } finally {
      setLoading(false)
      setShowMotivoPopup(false)
    }
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

  // Botões de desfecho só habilitados se área foi preenchida
  const desfechoEnabled = !!areaHumano && isAssumido

  if (!lead) {
    return (
      <div className="w-[280px] h-full bg-bg-surface flex items-center justify-center text-text-muted text-sm">
        Nenhum lead selecionado
      </div>
    )
  }

  return (
    <div className="w-[280px] h-full bg-bg-surface overflow-y-auto p-4 space-y-4">
      {/* Score */}
      <div className="flex justify-center">
        <ScoreCircle score={lead.score} />
      </div>

      {/* Classification */}
      <div className="space-y-2">
        <div>
          <span className="text-xs text-text-muted block mb-1">Área (bot)</span>
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-bg-surface-hover text-text-secondary">
            {lead.area_bot || lead.area || '—'}
          </span>
        </div>
        <div className="relative">
          <span className="text-xs text-text-muted block mb-1">Área (operador) *</span>
          <button
            onClick={() => setShowAreaDropdown(!showAreaDropdown)}
            className="inline-block px-2 py-1 rounded-full text-xs bg-accent/10 text-accent cursor-pointer hover:bg-accent/20"
          >
            {areaHumano || 'Selecionar'} ▾
          </button>
          {showAreaDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-bg-primary border border-border rounded-md shadow-lg z-10">
              {AREAS.map(area => (
                <button key={area} onClick={() => handleAreaChange(area)}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-bg-surface-hover ${area === areaHumano ? 'text-accent font-medium' : 'text-text-primary'}`}
                >{area}</button>
              ))}
            </div>
          )}
        </div>
        {!areaHumano && (
          <p className="text-xs text-warning">Selecione a área para habilitar os desfechos</p>
        )}
      </div>

      {/* Bot data */}
      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-medium text-text-secondary uppercase">Dados coletados</h3>
        {[['Nome', lead.nome], ['Telefone', lead.telefone], ['Área', lead.area], ['Score', String(lead.score)], ['Prioridade', lead.prioridade], ['Canal', lead.canal_origem]].map(([label, value]) => (
          <div key={label}><span className="text-xs text-text-muted">{label}</span><p className="text-sm text-text-primary">{value || '—'}</p></div>
        ))}
      </div>

      {/* Valor estimado */}
      <div className="border-t border-border pt-3">
        <span className="text-xs text-text-muted block mb-1">Valor estimado (R$)</span>
        <input type="number" value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} onBlur={handleValorBlur} placeholder="0,00" disabled={!isAssumido}
          className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
        />
        {!isAssumido && <p className="text-xs text-text-muted mt-1">Assuma o lead primeiro</p>}
      </div>

      {/* Action buttons */}
      <div className="border-t border-border pt-3 space-y-2">
        <button onClick={() => handleCloseAtendimento('convertido')} disabled={!desfechoEnabled || loading}
          className="w-full py-2 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >VIROU CLIENTE</button>

        <button onClick={() => setShowMotivoPopup(true)} disabled={!desfechoEnabled || loading}
          className="w-full py-2 rounded-md text-sm font-medium bg-error/10 text-error hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >NÃO FECHOU</button>

        <button onClick={() => setShowEnfileirar(true)} disabled={!desfechoEnabled || loading}
          className="w-full py-2 rounded-md text-sm font-medium bg-warning/10 text-warning hover:bg-warning/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >ENCERRAR E ENFILEIRAR</button>

        {lead.telefone && (
          <button onClick={handleChamarWA}
            className="w-full py-2 rounded-md text-sm font-medium bg-success/10 text-success hover:bg-success/20"
          >Chamar no WA</button>
        )}
      </div>

      {/* Popup Motivo (NÃO FECHOU) */}
      {showMotivoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMotivoPopup(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-text-primary mb-4">Motivo da perda</h2>
            <div className="space-y-3">
              {MOTIVOS_PERDA.map(m => (
                <button key={m} onClick={() => setMotivoSelecionado(m)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${motivoSelecionado === m ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-primary hover:bg-bg-surface-hover'}`}
                >{m}</button>
              ))}
              <textarea value={motivoObs} onChange={e => setMotivoObs(e.target.value)} rows={2} placeholder="Observação (opcional)"
                className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowMotivoPopup(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-bg-surface-hover text-text-primary">Cancelar</button>
                <button onClick={() => handleCloseAtendimento('nao_fechou')} disabled={!motivoSelecionado || loading}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-error text-white hover:bg-error/90 disabled:opacity-40"
                >{loading ? 'Salvando...' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup Enfileirar */}
      {showEnfileirar && operadorId && (
        <PopupEnfileirar leadId={lead.id} operadorId={operadorId}
          valorEstimadoInicial={valorEstimado ? parseFloat(valorEstimado) : undefined}
          onClose={() => setShowEnfileirar(false)} onSuccess={onLeadClosed}
        />
      )}
    </div>
  )
}
