'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import ScoreCircle from './ScoreCircle'
import PopupEnfileirar from './PopupEnfileirar'
import { useRouter } from 'next/navigation'
import type { Lead } from '../page'

interface Props {
  lead: Lead | null
  onLeadUpdate: (lead: Lead) => void
  onLeadClosed: () => void
}

const MOTIVOS_PERDA = [
  'Preço / Honorários',
  'Sem perfil (área errada)',
  'Já fechou com outro',
  'Decidiu não prosseguir',
  'Sem retorno',
  'Perda de contato',
  'Erro de bot',
  'Outro',
]

export default function PainelLead({ lead, onLeadUpdate, onLeadClosed }: Props) {
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [valorEstimado, setValorEstimado] = useState('')
  const [areaHumano, setAreaHumano] = useState<string | null>(null)
  const [areas, setAreas] = useState<string[]>([])
  const [showAreaDropdown, setShowAreaDropdown] = useState(false)
  const [showAddArea, setShowAddArea] = useState(false)
  const [newArea, setNewArea] = useState('')
  const [showEnfileirar, setShowEnfileirar] = useState(false)
  const [showMotivoPopup, setShowMotivoPopup] = useState(false)
  const [showConversaoPopup, setShowConversaoPopup] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [motivoObs, setMotivoObs] = useState('')
  const [valorContrato, setValorContrato] = useState('')
  const [statusPagamento, setStatusPagamento] = useState('Pendente')
  const [loading, setLoading] = useState(false)
  const [isAssumido, setIsAssumido] = useState(false)
  const [isCliente, setIsCliente] = useState(false)
  const supabase = createClient()
  const socket = useSocket()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
    loadAreas()
  }, [])

  async function loadAreas() {
    const { data } = await supabase.from('areas_juridicas').select('nome').eq('ativo', true).order('nome')
    if (data) setAreas(data.map(a => a.nome))
  }

  useEffect(() => {
    if (lead) {
      setAreaHumano(lead.area_humano || lead.area_bot || lead.area || null)
      setValorEstimado('')
      setShowEnfileirar(false)
      setShowMotivoPopup(false)
      setShowConversaoPopup(false)
      checkStatus()
    }
  }, [lead?.id])

  async function checkStatus() {
    if (!lead) return
    const { data } = await supabase.from('atendimentos').select('owner_id, status').eq('lead_id', lead.id).maybeSingle()
    setIsAssumido(!!data)
    setIsCliente(data?.status === 'convertido')
  }

  const handleAreaChange = async (newAreaVal: string) => {
    if (!lead || !operadorId) return
    setAreaHumano(newAreaVal)
    setShowAreaDropdown(false)
    if (newAreaVal !== (lead.area_bot || lead.area)) {
      await supabase.from('bot_feedback').insert({ lead_id: lead.id, area_bot: lead.area_bot || lead.area || '', area_humano: newAreaVal, operador_id: operadorId })
      await supabase.from('leads').update({ corrigido: true, area_humano: newAreaVal }).eq('id', lead.id)
      onLeadUpdate({ ...lead, area_humano: newAreaVal, corrigido: true })
    } else {
      await supabase.from('leads').update({ area_humano: newAreaVal }).eq('id', lead.id)
      onLeadUpdate({ ...lead, area_humano: newAreaVal })
    }
  }

  const handleAddArea = async () => {
    if (!newArea.trim()) return
    await supabase.from('areas_juridicas').insert({ nome: newArea.trim() })
    setNewArea('')
    setShowAddArea(false)
    loadAreas()
  }

  const handleValorBlur = async () => {
    if (!lead || !valorEstimado || !isAssumido) return
    await supabase.from('atendimentos').update({ valor_estimado: parseFloat(valorEstimado) }).eq('lead_id', lead.id)
  }

  async function handleConversao() {
    if (!lead || !operadorId) return
    setLoading(true)
    try {
      const { error: clientErr } = await supabase.from('clients').insert({
        identity_id: lead.id, request_id: crypto.randomUUID(),
        nome: lead.nome, telefone: lead.telefone, urgencia: lead.prioridade, canal_origem: lead.canal_origem,
      })
      if (clientErr) throw new Error(`Erro ao criar cliente: ${clientErr.message}`)
      await supabase.from('atendimentos').update({
        status: 'convertido', classificacao_final: areaHumano || lead.area,
        valor_contrato: valorContrato ? parseFloat(valorContrato) : null,
        status_pagamento: statusPagamento, encerrado_em: new Date().toISOString(),
      }).eq('lead_id', lead.id)
      if (socket) socket.emit('lead_encerrado', { lead_id: lead.id, tipo: 'convertido' })
      onLeadClosed()
    } catch (err: any) {
      alert(err.message || 'Erro ao converter')
    } finally { setLoading(false); setShowConversaoPopup(false) }
  }

  async function handleNaoFechou() {
    if (!lead || !operadorId || !motivoSelecionado) return
    setLoading(true)
    try {
      await supabase.from('repescagem').insert({ lead_id: lead.id, operador_id: operadorId, motivo: motivoSelecionado, observacao: motivoObs || null, data_retorno: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] })
      await supabase.from('atendimentos').update({ status: 'nao_fechou', motivo_perda: motivoSelecionado, classificacao_final: areaHumano || lead.area, encerrado_em: new Date().toISOString() }).eq('lead_id', lead.id)
      if (socket) socket.emit('lead_encerrado', { lead_id: lead.id, tipo: 'nao_fechou' })
      onLeadClosed()
    } catch (err: any) { alert(err.message) } finally { setLoading(false); setShowMotivoPopup(false) }
  }

  const handleChamarWA = async () => {
    if (!lead?.telefone) return
    try {
      await fetch('/api/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, telefone: lead.telefone, mensagem: `Olá${lead.nome ? ` ${lead.nome}` : ''}! Sou do escritório Santos & Bastos. Podemos conversar?` }) })
    } catch { alert('Erro ao enviar via WhatsApp') }
  }

  const desfechoEnabled = !!areaHumano && isAssumido

  if (!lead) {
    return <div className="w-[280px] h-full bg-bg-surface flex items-center justify-center text-text-muted text-sm">Nenhum lead selecionado</div>
  }

  return (
    <div className="w-[280px] h-full bg-bg-surface overflow-y-auto p-4 space-y-4">
      {/* Badge de identidade */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-1 rounded ${isCliente ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'}`}>
          {isCliente ? '👤 CLIENTE' : '🎯 LEAD'}
        </span>
        {(lead as any).is_reaquecido && <span className="text-xs px-2 py-1 rounded bg-score-hot/10 text-score-hot font-medium">🔥 REAQUECIDO</span>}
      </div>

      {/* Score — só pra LEAD */}
      {!isCliente && (
        <div className="flex justify-center"><ScoreCircle score={lead.score} /></div>
      )}

      {/* Área — dropdown dinâmico do banco */}
      <div className="space-y-2">
        <div>
          <span className="text-xs text-text-muted block mb-1">Área (bot)</span>
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-bg-surface-hover text-text-secondary">{lead.area_bot || lead.area || '—'}</span>
        </div>
        <div className="relative">
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-muted">Área (operador) *</span>
            <button onClick={() => setShowAddArea(true)} className="text-xs text-accent hover:text-accent-hover font-bold">+</button>
          </div>
          <button onClick={() => setShowAreaDropdown(!showAreaDropdown)}
            className="mt-1 inline-block px-2 py-1 rounded-full text-xs bg-accent/10 text-accent cursor-pointer hover:bg-accent/20">
            {areaHumano || 'Selecionar'} ▾
          </button>
          {showAreaDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-bg-primary border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
              {areas.map(area => (
                <button key={area} onClick={() => handleAreaChange(area)}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-bg-surface-hover ${area === areaHumano ? 'text-accent font-medium' : 'text-text-primary'}`}>{area}</button>
              ))}
            </div>
          )}
          {showAddArea && (
            <div className="mt-2 flex gap-1">
              <input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="Nova área"
                className="flex-1 rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary" />
              <button onClick={handleAddArea} className="px-2 py-1 rounded-md text-xs bg-accent text-text-on-accent">OK</button>
              <button onClick={() => setShowAddArea(false)} className="px-2 py-1 rounded-md text-xs text-text-muted">✕</button>
            </div>
          )}
        </div>
        {!areaHumano && <p className="text-xs text-warning">Selecione a área para habilitar os desfechos</p>}
      </div>

      {/* Dados coletados */}
      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-medium text-text-secondary uppercase">Dados coletados</h3>
        {[['Nome', lead.nome], ['Telefone', lead.telefone], ['Área', lead.area], ...(isCliente ? [] : [['Score', String(lead.score)], ['Prioridade', lead.prioridade]]), ['Canal', lead.canal_origem]].map(([label, value]) => (
          <div key={label as string}><span className="text-xs text-text-muted">{label}</span><p className="text-sm text-text-primary">{(value as string) || '—'}</p></div>
        ))}
      </div>

      {/* Valor estimado — só pra LEAD */}
      {!isCliente && (
        <div className="border-t border-border pt-3">
          <span className="text-xs text-text-muted block mb-1">Valor estimado (R$)</span>
          <input type="number" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} onBlur={handleValorBlur} placeholder="0,00" disabled={!isAssumido}
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40" />
          {!isAssumido && <p className="text-xs text-text-muted mt-1">Assuma o lead primeiro</p>}
        </div>
      )}

      {/* Ações */}
      <div className="border-t border-border pt-3 space-y-2">
        {isCliente ? (
          <button onClick={() => router.push(`/tela2?lead=${lead.id}`)}
            className="w-full py-2 rounded-md text-sm font-medium bg-accent text-text-on-accent hover:bg-accent-hover">IR PARA ACOMPANHAMENTO</button>
        ) : (
          <>
            <button onClick={() => setShowConversaoPopup(true)} disabled={!desfechoEnabled || loading}
              className="w-full py-2 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed">CONVERTER — VIRAR CLIENTE</button>
            <button onClick={() => setShowMotivoPopup(true)} disabled={!desfechoEnabled || loading}
              className="w-full py-2 rounded-md text-sm font-medium bg-error/10 text-error hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed">NÃO FECHOU</button>
            <button onClick={() => setShowEnfileirar(true)} disabled={!desfechoEnabled || loading}
              className="w-full py-2 rounded-md text-sm font-medium bg-warning/10 text-warning hover:bg-warning/20 disabled:opacity-40 disabled:cursor-not-allowed">ENCERRAR E ENFILEIRAR</button>
          </>
        )}
        {lead.telefone && <button onClick={handleChamarWA} className="w-full py-2 rounded-md text-sm font-medium bg-success/10 text-success hover:bg-success/20">Chamar no WA</button>}
        {(lead as any).is_reaquecido && (
          <button onClick={async () => { await supabase.from('leads').update({ is_reaquecido: false }).eq('id', lead.id); if (socket) socket.emit('lead_encerrado', { lead_id: lead.id, tipo: 'arquivado' }); onLeadClosed() }}
            className="w-full py-2 rounded-md text-xs font-medium bg-bg-surface-hover text-text-secondary hover:bg-border">Arquivar interação</button>
        )}
      </div>

      {/* Popup Conversão */}
      {showConversaoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConversaoPopup(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-text-primary mb-4">Conversão de cliente</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Valor do contrato (R$)</label>
                <input type="number" value={valorContrato} onChange={e => setValorContrato(e.target.value)} placeholder="0,00"
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Status do pagamento</label>
                <select value={statusPagamento} onChange={e => setStatusPagamento(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowConversaoPopup(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-bg-surface-hover text-text-primary">Cancelar</button>
                <button onClick={handleConversao} disabled={loading}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90 disabled:opacity-50">{loading ? 'Salvando...' : 'Confirmar conversão'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup Motivo */}
      {showMotivoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMotivoPopup(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-text-primary mb-4">Motivo da perda</h2>
            <div className="space-y-3">
              {MOTIVOS_PERDA.map(m => (
                <button key={m} onClick={() => setMotivoSelecionado(m)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${motivoSelecionado === m ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-primary hover:bg-bg-surface-hover'}`}>{m}</button>
              ))}
              <textarea value={motivoObs} onChange={e => setMotivoObs(e.target.value)} rows={2} placeholder="Observação (opcional)"
                className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none" />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowMotivoPopup(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-bg-surface-hover text-text-primary">Cancelar</button>
                <button onClick={handleNaoFechou} disabled={!motivoSelecionado || loading}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-error text-white hover:bg-error/90 disabled:opacity-40">{loading ? 'Salvando...' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEnfileirar && operadorId && (
        <PopupEnfileirar leadId={lead.id} operadorId={operadorId}
          valorEstimadoInicial={valorEstimado ? parseFloat(valorEstimado) : undefined}
          onClose={() => setShowEnfileirar(false)} onSuccess={onLeadClosed} />
      )}
    </div>
  )
}
