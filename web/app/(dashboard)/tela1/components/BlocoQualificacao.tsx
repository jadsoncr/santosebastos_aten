'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { useRouter } from 'next/navigation'
import { displayPhone, telLink } from '@/utils/format'
import PopupEnfileirar from './PopupEnfileirar'
import { COPY } from '@/utils/copy'
import type { Lead } from '../page'

interface BlocoQualificacaoProps {
  lead: Lead
  isCliente: boolean
  isAssumido: boolean
  operadorId: string | null
  onLeadUpdate: (lead: Lead) => void
  onLeadClosed: () => void
}

interface Nota {
  id: string
  conteudo: string
  created_at: string
}

interface IdentityResult {
  id: string
  nome: string | null
  telefone: string | null
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

export default function BlocoQualificacao({
  lead,
  isCliente,
  isAssumido,
  operadorId,
  onLeadUpdate,
  onLeadClosed,
}: BlocoQualificacaoProps) {
  // Editable name
  const [editingNome, setEditingNome] = useState(false)
  const [nomeValue, setNomeValue] = useState(lead.nome || '')

  // Editable phone
  const [editingTelefone, setEditingTelefone] = useState(false)
  const [telefoneValue, setTelefoneValue] = useState(lead.telefone || '')

  // Identity linking (task 6.3)
  const [showIdentitySearch, setShowIdentitySearch] = useState(false)
  const [identityQuery, setIdentityQuery] = useState('')
  const [identityResults, setIdentityResults] = useState<IdentityResult[]>([])
  const [identitySearchLoading, setIdentitySearchLoading] = useState(false)
  const [identitySearchDone, setIdentitySearchDone] = useState(false)

  // Area dropdown
  const [areaHumano, setAreaHumano] = useState<string | null>(lead.area_humano || lead.area_bot || lead.area || null)
  const [areas, setAreas] = useState<string[]>([])
  const [showAreaDropdown, setShowAreaDropdown] = useState(false)
  const [showAddArea, setShowAddArea] = useState(false)
  const [newArea, setNewArea] = useState('')

  // Valor estimado
  const [valorEstimado, setValorEstimado] = useState('')

  // Internal notes (Post-it)
  const [notaTexto, setNotaTexto] = useState('')
  const [notas, setNotas] = useState<Nota[]>([])

  // Popups
  const [showEnfileirar, setShowEnfileirar] = useState(false)
  const [showMotivoPopup, setShowMotivoPopup] = useState(false)
  const [showConversaoPopup, setShowConversaoPopup] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [motivoObs, setMotivoObs] = useState('')
  const [valorContrato, setValorContrato] = useState('')
  const [statusPagamento, setStatusPagamento] = useState('Pendente')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const socket = useSocket()
  const router = useRouter()

  // Reset state when lead changes
  useEffect(() => {
    setNomeValue(lead.nome || '')
    setTelefoneValue(lead.telefone || '')
    setAreaHumano(lead.area_humano || lead.area_bot || lead.area || null)
    setValorEstimado('')
    setEditingNome(false)
    setEditingTelefone(false)
    setShowEnfileirar(false)
    setShowMotivoPopup(false)
    setShowConversaoPopup(false)
    setShowIdentitySearch(false)
    setIdentityQuery('')
    setIdentityResults([])
    setIdentitySearchDone(false)
    setNotaTexto('')
    loadNotas()
  }, [lead.id])

  useEffect(() => {
    loadAreas()
  }, [])

  async function loadAreas() {
    const { data } = await supabase
      .from('areas_juridicas')
      .select('nome')
      .eq('ativo', true)
      .order('nome')
    if (data) setAreas(data.map((a) => a.nome))
  }

  async function loadNotas() {
    const { data } = await supabase
      .from('mensagens')
      .select('id, conteudo, created_at')
      .eq('lead_id', lead.id)
      .eq('tipo', 'nota_interna')
      .order('created_at', { ascending: false })
    if (data) setNotas(data)
  }

  // --- Name editing ---
  async function saveNome() {
    if (!nomeValue.trim()) {
      setEditingNome(false)
      setNomeValue(lead.nome || '')
      return
    }
    const trimmed = nomeValue.trim()
    const { data: leadData } = await supabase
      .from('leads')
      .select('identity_id')
      .eq('id', lead.id)
      .maybeSingle()
    if (leadData?.identity_id) {
      await supabase.from('identities').update({ nome: trimmed }).eq('id', leadData.identity_id)
    }
    await supabase.from('leads').update({ nome: trimmed }).eq('id', lead.id)
    onLeadUpdate({ ...lead, nome: trimmed })
    setEditingNome(false)
  }

  // --- Phone editing ---
  async function saveTelefone() {
    if (!telefoneValue.trim()) {
      setEditingTelefone(false)
      setTelefoneValue(lead.telefone || '')
      return
    }
    const trimmed = telefoneValue.trim()
    const { data: leadData } = await supabase
      .from('leads')
      .select('identity_id')
      .eq('id', lead.id)
      .maybeSingle()
    if (leadData?.identity_id) {
      await supabase.from('identities').update({ telefone: trimmed }).eq('id', leadData.identity_id)
    }
    onLeadUpdate({ ...lead, telefone: trimmed })
    setEditingTelefone(false)
  }

  // --- Identity linking (task 6.3) ---
  async function searchIdentities(query: string) {
    if (!query.trim()) {
      setIdentityResults([])
      setIdentitySearchDone(false)
      return
    }
    setIdentitySearchLoading(true)
    const { data } = await supabase
      .from('identities')
      .select('id, nome, telefone')
      .or(`nome.ilike.%${query}%,telefone.ilike.%${query}%`)
      .limit(10)
    setIdentityResults(data || [])
    setIdentitySearchDone(true)
    setIdentitySearchLoading(false)
  }

  async function linkToIdentity(targetIdentityId: string) {
    // Get current identity_id
    const { data: leadData } = await supabase
      .from('leads')
      .select('identity_id')
      .eq('id', lead.id)
      .maybeSingle()

    if (leadData?.identity_id) {
      // Transfer identity_channels from current identity to target
      await supabase
        .from('identity_channels')
        .update({ identity_id: targetIdentityId })
        .eq('identity_id', leadData.identity_id)
    }

    // Update lead's identity_id
    await supabase
      .from('leads')
      .update({ identity_id: targetIdentityId })
      .eq('id', lead.id)

    // Reload lead data
    const { data: updatedLead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead.id)
      .maybeSingle()

    if (updatedLead) {
      onLeadUpdate({ ...updatedLead, corrigido: updatedLead.corrigido ?? false })
    }

    setShowIdentitySearch(false)
    setIdentityQuery('')
    setIdentityResults([])
    setIdentitySearchDone(false)
  }

  // --- Area change ---
  const handleAreaChange = async (newAreaVal: string) => {
    if (!operadorId) return
    setAreaHumano(newAreaVal)
    setShowAreaDropdown(false)
    if (newAreaVal !== (lead.area_bot || lead.area)) {
      await supabase.from('bot_feedback').insert({
        lead_id: lead.id,
        area_bot: lead.area_bot || lead.area || '',
        area_humano: newAreaVal,
        operador_id: operadorId,
      })
      await supabase
        .from('leads')
        .update({ corrigido: true, area_humano: newAreaVal })
        .eq('id', lead.id)
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

  // --- Valor estimado ---
  const handleValorBlur = async () => {
    if (!valorEstimado || !isAssumido) return
    await supabase
      .from('atendimentos')
      .update({ valor_estimado: parseFloat(valorEstimado) })
      .eq('lead_id', lead.id)
  }

  // --- Internal notes ---
  async function handleSaveNota() {
    if (!notaTexto.trim() || !operadorId) return
    await supabase.from('mensagens').insert({
      lead_id: lead.id,
      de: operadorId,
      tipo: 'nota_interna',
      conteudo: notaTexto.trim(),
      operador_id: operadorId,
    })
    setNotaTexto('')
    loadNotas()
  }

  // --- Conversão ---
  async function handleConversao() {
    if (!operadorId) return
    setLoading(true)
    try {
      const { error: clientErr } = await supabase.from('clients').insert({
        identity_id: lead.id,
        request_id: crypto.randomUUID(),
        nome: lead.nome,
        telefone: lead.telefone,
        urgencia: lead.prioridade,
        canal_origem: lead.canal_origem,
      })
      if (clientErr) throw new Error(`Erro ao criar cliente: ${clientErr.message}`)
      await supabase
        .from('atendimentos')
        .update({
          status: 'convertido',
          classificacao_final: areaHumano || lead.area,
          valor_contrato: valorContrato ? parseFloat(valorContrato) : null,
          status_pagamento: statusPagamento,
          encerrado_em: new Date().toISOString(),
        })
        .eq('lead_id', lead.id)
      if (socket) socket.emit('lead_encerrado', { lead_id: lead.id, tipo: 'convertido' })
      onLeadClosed()
    } catch (err: any) {
      alert(err.message || 'Erro ao converter')
    } finally {
      setLoading(false)
      setShowConversaoPopup(false)
    }
  }

  // --- Não fechou ---
  async function handleNaoFechou() {
    if (!operadorId || !motivoSelecionado) return
    setLoading(true)
    try {
      await supabase.from('repescagem').insert({
        lead_id: lead.id,
        operador_id: operadorId,
        motivo: motivoSelecionado,
        observacao: motivoObs || null,
        data_retorno: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      })
      await supabase
        .from('atendimentos')
        .update({
          status: 'nao_fechou',
          motivo_perda: motivoSelecionado,
          classificacao_final: areaHumano || lead.area,
          encerrado_em: new Date().toISOString(),
        })
        .eq('lead_id', lead.id)
      if (socket) socket.emit('lead_encerrado', { lead_id: lead.id, tipo: 'nao_fechou' })
      onLeadClosed()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
      setShowMotivoPopup(false)
    }
  }

  // --- WA link ---
  function buildWaLink(): string | null {
    if (!lead.telefone) return null
    const phone = lead.telefone.replace(/\D/g, '')
    const nome = lead.nome || 'cliente'
    const area = areaHumano || lead.area_bot || lead.area || 'seu caso'

    const msg = isCliente
      ? `Oi ${nome}, estou acessando seu prontuário de ${area} para te dar um retorno.`
      : `Olá ${nome}, recebi seu caso de ${area}. Podemos falar agora?`

    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  }

  const desfechoEnabled = !!areaHumano && isAssumido
  const waLink = buildWaLink()

  return (
    <div className="space-y-4">
      {/* Editable name */}
      <div>
        <span className="text-xs text-text-muted block mb-1">Nome</span>
        {editingNome ? (
          <input
            autoFocus
            value={nomeValue}
            onChange={(e) => setNomeValue(e.target.value)}
            onBlur={saveNome}
            onKeyDown={(e) => { if (e.key === 'Enter') saveNome() }}
            className="w-full rounded-md border border-accent bg-bg-primary px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <p
            onClick={() => setEditingNome(true)}
            className="text-sm text-text-primary cursor-pointer hover:text-accent transition-colors"
            title="Clique para editar"
          >
            {lead.nome || '—'}
          </p>
        )}
      </div>

      {/* Editable phone */}
      <div>
        <span className="text-xs text-text-muted block mb-1">Telefone</span>
        {editingTelefone ? (
          <input
            autoFocus
            value={telefoneValue}
            onChange={(e) => setTelefoneValue(e.target.value)}
            onBlur={saveTelefone}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTelefone() }}
            className="w-full rounded-md border border-accent bg-bg-primary px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <div>
            {telLink(lead.telefone) ? (
              <a href={telLink(lead.telefone)!} className="text-sm text-accent hover:underline block">
                {displayPhone(lead.telefone)}
              </a>
            ) : (
              <p className="text-sm text-text-primary">{displayPhone(lead.telefone)}</p>
            )}
            <button
              onClick={() => setEditingTelefone(true)}
              className="text-xs text-accent hover:text-accent-hover mt-0.5"
            >
              {COPY.qualificacao.editarTelefone}
            </button>
          </div>
        )}
      </div>

      {/* Identity linking (task 6.3) */}
      <div>
        <button
          onClick={() => setShowIdentitySearch(!showIdentitySearch)}
          className="text-xs text-accent hover:text-accent-hover font-medium"
        >
          {COPY.qualificacao.vincularIdentidade}
        </button>
        {showIdentitySearch && (
          <div className="mt-2 space-y-2">
            <input
              value={identityQuery}
              onChange={(e) => {
                setIdentityQuery(e.target.value)
                searchIdentities(e.target.value)
              }}
              placeholder="Buscar por nome ou telefone..."
              className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {identitySearchLoading && (
              <p className="text-xs text-text-muted">Buscando...</p>
            )}
            {identitySearchDone && identityResults.length === 0 && (
              <p className="text-xs text-text-muted">Nenhuma identidade encontrada</p>
            )}
            {identityResults.map((identity) => (
              <button
                key={identity.id}
                onClick={() => linkToIdentity(identity.id)}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs border border-border hover:bg-bg-surface-hover transition-colors"
              >
                <span className="font-medium text-text-primary">{identity.nome || 'Sem nome'}</span>
                {identity.telefone && (
                  <span className="text-text-muted ml-2">{identity.telefone}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Area dropdown */}
      <div className="relative">
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted">Área (operador) *</span>
          <button onClick={() => setShowAddArea(true)} className="text-xs text-accent hover:text-accent-hover font-bold">
            +
          </button>
        </div>
        <button
          onClick={() => setShowAreaDropdown(!showAreaDropdown)}
          className="mt-1 inline-block px-2 py-1 rounded-full text-xs bg-accent/10 text-accent cursor-pointer hover:bg-accent/20"
        >
          {areaHumano || 'Selecionar'} ▾
        </button>
        {showAreaDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-bg-primary border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
            {areas.map((area) => (
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
        {showAddArea && (
          <div className="mt-2 flex gap-1">
            <input
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="Nova área"
              className="flex-1 rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary"
            />
            <button onClick={handleAddArea} className="px-2 py-1 rounded-md text-xs bg-accent text-text-on-accent">
              OK
            </button>
            <button onClick={() => setShowAddArea(false)} className="px-2 py-1 rounded-md text-xs text-text-muted">
              ✕
            </button>
          </div>
        )}
        {!areaHumano && <p className="text-xs text-warning mt-1">Selecione a área para habilitar os desfechos</p>}
      </div>

      {/* Internal Notes (Post-it) */}
      <div className="space-y-2">
        <span className="text-xs text-text-muted block">{COPY.qualificacao.dossieEstrategico}</span>
        <div className="bg-bg-surface border border-border rounded-md p-2 space-y-2">
          <textarea
            value={notaTexto}
            onChange={(e) => setNotaTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSaveNota()
              }
            }}
            placeholder="Escreva uma nota..."
            rows={2}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none font-mono"
          />
          <button
            onClick={handleSaveNota}
            disabled={!notaTexto.trim()}
            className="text-xs font-medium text-accent hover:text-accent/80 disabled:opacity-40"
          >
            {COPY.qualificacao.salvarNota}
          </button>
        </div>
        {notas.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {notas.map((n) => (
              <div key={n.id} className="text-xs bg-bg-surface border border-border rounded px-2 py-1 font-mono">
                <p className="text-text-primary">{n.conteudo}</p>
                <span className="text-text-muted text-[10px]">
                  {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contato via WhatsApp */}
      <div>
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full block text-center py-2 rounded-md text-sm font-medium bg-success/10 text-success hover:bg-success/20"
          >
            {COPY.qualificacao.contatoWhatsApp}
          </a>
        ) : (
          <button
            disabled
            title="Telefone não disponível"
            className="w-full py-2 rounded-md text-sm font-medium bg-success/10 text-success opacity-40 cursor-not-allowed"
          >
            {COPY.qualificacao.contatoWhatsApp}
          </button>
        )}
      </div>

      {/* Valor estimado — só pra LEAD */}
      {!isCliente && (
        <div>
          <span className="text-xs text-text-muted block mb-1">Valor estimado (R$)</span>
          <input
            type="number"
            value={valorEstimado}
            onChange={(e) => setValorEstimado(e.target.value)}
            onBlur={handleValorBlur}
            placeholder="0,00"
            disabled={!isAssumido}
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
          />
          {!isAssumido && <p className="text-xs text-text-muted mt-1">Assuma o lead primeiro</p>}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        {isCliente ? (
          <button
            onClick={() => router.push(`/tela2?lead=${lead.id}`)}
            className="w-full py-2 rounded-md text-sm font-medium bg-accent text-text-on-accent hover:bg-accent-hover"
          >
            IR PARA ACOMPANHAMENTO
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowConversaoPopup(true)}
              disabled={!desfechoEnabled || loading}
              className="w-full py-2 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              CONVERTER — VIRAR CLIENTE
            </button>
            <button
              onClick={() => setShowMotivoPopup(true)}
              disabled={!desfechoEnabled || loading}
              className="w-full py-2 rounded-md text-sm font-medium bg-error/10 text-error hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              NÃO FECHOU
            </button>
            <button
              onClick={() => setShowEnfileirar(true)}
              disabled={!desfechoEnabled || loading}
              className="w-full py-2 rounded-md text-sm font-medium bg-warning/10 text-warning hover:bg-warning/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ENCERRAR E ENFILEIRAR
            </button>
          </>
        )}
        {(lead as any).is_reaquecido && (
          <button
            onClick={async () => {
              await supabase.from('leads').update({ is_reaquecido: false }).eq('id', lead.id)
              if (socket) socket.emit('lead_encerrado', { lead_id: lead.id, tipo: 'arquivado' })
              onLeadClosed()
            }}
            className="w-full py-2 rounded-md text-xs font-medium bg-bg-surface-hover text-text-secondary hover:bg-border"
          >
            Arquivar interação
          </button>
        )}
      </div>

      {/* Popup Conversão */}
      {showConversaoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConversaoPopup(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-text-primary mb-4">Conversão de cliente</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Valor do contrato (R$)</label>
                <input
                  type="number"
                  value={valorContrato}
                  onChange={(e) => setValorContrato(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Status do pagamento</label>
                <select
                  value={statusPagamento}
                  onChange={(e) => setStatusPagamento(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowConversaoPopup(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-bg-surface-hover text-text-primary">
                  Cancelar
                </button>
                <button
                  onClick={handleConversao}
                  disabled={loading}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Confirmar conversão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup Motivo */}
      {showMotivoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMotivoPopup(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-text-primary mb-4">Motivo da perda</h2>
            <div className="space-y-3">
              {MOTIVOS_PERDA.map((m) => (
                <button
                  key={m}
                  onClick={() => setMotivoSelecionado(m)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                    motivoSelecionado === m
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-primary hover:bg-bg-surface-hover'
                  }`}
                >
                  {m}
                </button>
              ))}
              <textarea
                value={motivoObs}
                onChange={(e) => setMotivoObs(e.target.value)}
                rows={2}
                placeholder="Observação (opcional)"
                className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowMotivoPopup(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-bg-surface-hover text-text-primary">
                  Cancelar
                </button>
                <button
                  onClick={handleNaoFechou}
                  disabled={!motivoSelecionado || loading}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-error text-white hover:bg-error/90 disabled:opacity-40"
                >
                  {loading ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup Enfileirar */}
      {showEnfileirar && operadorId && (
        <PopupEnfileirar
          leadId={lead.id}
          operadorId={operadorId}
          valorEstimadoInicial={valorEstimado ? parseFloat(valorEstimado) : undefined}
          onClose={() => setShowEnfileirar(false)}
          onSuccess={onLeadClosed}
        />
      )}
    </div>
  )
}
