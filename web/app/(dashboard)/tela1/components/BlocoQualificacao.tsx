'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { useRouter } from 'next/navigation'
import { displayPhone, telLink } from '@/utils/format'
import PopupEnfileirar from './PopupEnfileirar'
import { COPY } from '@/utils/copy'
import { filterChildren } from '@/utils/segmentTree'
import type { SegmentNode } from '@/utils/segmentTree'
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

  // Editable email (Change A)
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailValue, setEmailValue] = useState(lead.email || '')

  // Identity linking (task 6.3)
  const [showIdentitySearch, setShowIdentitySearch] = useState(false)
  const [identityQuery, setIdentityQuery] = useState('')
  const [identityResults, setIdentityResults] = useState<IdentityResult[]>([])
  const [identitySearchLoading, setIdentitySearchLoading] = useState(false)
  const [identitySearchDone, setIdentitySearchDone] = useState(false)

  // Segment tree state
  const [segmentNodes, setSegmentNodes] = useState<SegmentNode[]>([])
  const [selectedSegmento, setSelectedSegmento] = useState<string | null>(null)
  const [selectedAssunto, setSelectedAssunto] = useState<string | null>(null)
  const [selectedEspecificacao, setSelectedEspecificacao] = useState<string | null>(null)

  // Valor estimado
  const [valorEstimado, setValorEstimado] = useState('')

  // Internal notes (Dossiê Estratégico) — auto-save on blur (Change B)
  const [notaTexto, setNotaTexto] = useState('')
  const [notas, setNotas] = useState<Nota[]>([])
  const [notaSalva, setNotaSalva] = useState(false)
  const notaSalvaTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Converter validation (Change D)
  const [valorEntrada, setValorEntrada] = useState('')
  const [contratoAssinado, setContratoAssinado] = useState(false)

  // Popups
  const [showEnfileirar, setShowEnfileirar] = useState(false)
  const [showMotivoPopup, setShowMotivoPopup] = useState(false)
  const [showConversaoPopup, setShowConversaoPopup] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [motivoObs, setMotivoObs] = useState('')
  const [valorContrato, setValorContrato] = useState('')
  const [statusPagamento, setStatusPagamento] = useState('Pendente')
  const [loading, setLoading] = useState(false)

  // Botoeira modals (replacing prompt())
  const [showAgendarModal, setShowAgendarModal] = useState(false)
  const [agendarData, setAgendarData] = useState('')
  const [agendarLocal, setAgendarLocal] = useState('')

  const [showSolicitarModal, setShowSolicitarModal] = useState(false)
  const [solicitarDocs, setSolicitarDocs] = useState('')

  const [showPropostaModal, setShowPropostaModal] = useState(false)
  const [propostaValor, setPropostaValor] = useState('')

  const [showContratoConfirm, setShowContratoConfirm] = useState(false)

  const supabase = createClient()
  const socket = useSocket()
  const router = useRouter()

  // Reset state when lead changes
  useEffect(() => {
    setNomeValue(lead.nome || '')
    setTelefoneValue(lead.telefone || '')
    setEmailValue(lead.email || '')
    setValorEstimado('')
    setValorEntrada('')
    setContratoAssinado(false)
    setEditingNome(false)
    setEditingTelefone(false)
    setEditingEmail(false)
    setShowEnfileirar(false)
    setShowMotivoPopup(false)
    setShowConversaoPopup(false)
    setShowIdentitySearch(false)
    setIdentityQuery('')
    setIdentityResults([])
    setIdentitySearchDone(false)
    setNotaTexto('')
    setNotaSalva(false)
    // Reset botoeira modals
    setShowAgendarModal(false)
    setAgendarData('')
    setAgendarLocal('')
    setShowSolicitarModal(false)
    setSolicitarDocs('')
    setShowPropostaModal(false)
    setPropostaValor('')
    setShowContratoConfirm(false)
    loadNotas()
  }, [lead.id])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (notaSalvaTimerRef.current) clearTimeout(notaSalvaTimerRef.current)
    }
  }, [])

  // Load segment tree on mount
  useEffect(() => {
    async function loadSegments() {
      const { data } = await supabase
        .from('segment_trees')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (data) setSegmentNodes(data as SegmentNode[])
    }
    loadSegments()
  }, [])

  // Initialize selections from lead data
  useEffect(() => {
    setSelectedSegmento((lead as any).segmento_id || null)
    setSelectedAssunto((lead as any).assunto_id || null)
    setSelectedEspecificacao((lead as any).especificacao_id || null)
  }, [lead.id])

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
    try {
      const { data: leadData } = await supabase
        .from('leads')
        .select('identity_id')
        .eq('id', lead.id)
        .maybeSingle()
      if (leadData?.identity_id) {
        // Fonte única: identities.nome
        const { error: idErr } = await supabase.from('identities').update({ nome: trimmed }).eq('id', leadData.identity_id)
        if (idErr) console.error('[SAVE NOME] identities error:', idErr.message)
        // Espelhar em TODOS os leads desta identidade
        const { error: ldErr } = await supabase.from('leads').update({ nome: trimmed }).eq('identity_id', leadData.identity_id)
        if (ldErr) console.error('[SAVE NOME] leads error:', ldErr.message)
      } else {
        // Fallback: salvar só no lead atual
        await supabase.from('leads').update({ nome: trimmed }).eq('id', lead.id)
      }
      onLeadUpdate({ ...lead, nome: trimmed })
    } catch (err) {
      console.error('[SAVE NOME] exception:', err)
    }
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

  // --- Email editing (Change A) ---
  async function saveEmail() {
    if (!emailValue.trim()) {
      setEditingEmail(false)
      setEmailValue(lead.email || '')
      return
    }
    const trimmed = emailValue.trim()
    const { data: leadData } = await supabase
      .from('leads')
      .select('identity_id')
      .eq('id', lead.id)
      .maybeSingle()
    if (leadData?.identity_id) {
      await supabase.from('identities').update({ email: trimmed }).eq('id', leadData.identity_id)
    }
    onLeadUpdate({ ...lead, email: trimmed })
    setEditingEmail(false)
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
    const { data: leadData } = await supabase
      .from('leads')
      .select('identity_id')
      .eq('id', lead.id)
      .maybeSingle()

    if (leadData?.identity_id) {
      await supabase
        .from('identity_channels')
        .update({ identity_id: targetIdentityId })
        .eq('identity_id', leadData.identity_id)
    }

    await supabase
      .from('leads')
      .update({ identity_id: targetIdentityId })
      .eq('id', lead.id)

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

  // --- Cascading dropdown handlers ---
  async function handleSegmentoChange(segmentoId: string) {
    setSelectedSegmento(segmentoId)
    setSelectedAssunto(null)
    setSelectedEspecificacao(null)
    await supabase.from('leads').update({ segmento_id: segmentoId, assunto_id: null, especificacao_id: null }).eq('id', lead.id)
  }

  async function handleAssuntoChange(assuntoId: string) {
    setSelectedAssunto(assuntoId)
    setSelectedEspecificacao(null)
    await supabase.from('leads').update({ assunto_id: assuntoId, especificacao_id: null }).eq('id', lead.id)
  }

  async function handleEspecificacaoChange(especificacaoId: string) {
    setSelectedEspecificacao(especificacaoId)
    await supabase.from('leads').update({ especificacao_id: especificacaoId }).eq('id', lead.id)
  }

  // --- Valor estimado ---
  const handleValorBlur = async () => {
    if (!valorEstimado || !isAssumido) return
    await supabase
      .from('atendimentos')
      .update({ valor_estimado: parseFloat(valorEstimado) })
      .eq('lead_id', lead.id)
  }

  // --- Internal notes — auto-save on blur (Change B) ---
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
    // Show "Salvo" feedback
    setNotaSalva(true)
    if (notaSalvaTimerRef.current) clearTimeout(notaSalvaTimerRef.current)
    notaSalvaTimerRef.current = setTimeout(() => setNotaSalva(false), 1500)
  }

  function handleNotaBlur() {
    if (notaTexto.trim()) {
      handleSaveNota()
    }
  }

  // --- Botoeira de Jornada handlers (Change C) — now using modals ---
  async function handleConfirmAgendar() {
    if (!socket || !lead || !operadorId || !agendarData || !agendarLocal) return

    // Update atendimento
    await supabase.from('atendimentos').update({
      location: 'backoffice',
      agendamento_data: new Date(agendarData).toISOString(),
      agendamento_local: agendarLocal,
    }).eq('lead_id', lead.id)

    // Timeline event
    await supabase.from('timeline_events').insert({
      lead_id: lead.id,
      tipo: 'reuniao_agendada',
      descricao: `Reunião agendada: ${agendarData} - ${agendarLocal}`,
      operador_id: operadorId,
      metadata: { data: agendarData, local: agendarLocal },
    })

    // Pipeline transition
    socket.emit('pipeline_transition', {
      lead_id: lead.id,
      target_stage: 'AGENDAMENTO',
      conditions: { agendamento_data: agendarData, agendamento_local: agendarLocal },
    })

    setShowAgendarModal(false)
    setAgendarData('')
    setAgendarLocal('')
  }

  async function handleConfirmSolicitar() {
    if (!socket || !lead || !operadorId || !solicitarDocs) return

    await supabase.from('timeline_events').insert({
      lead_id: lead.id,
      tipo: 'documento_solicitado',
      descricao: `Documentos solicitados: ${solicitarDocs}`,
      operador_id: operadorId,
      metadata: { documentos: solicitarDocs },
    })

    socket.emit('pipeline_transition', {
      lead_id: lead.id,
      target_stage: 'DEVOLUTIVA',
      conditions: { documento_enviado: true },
    })

    setShowSolicitarModal(false)
    setSolicitarDocs('')
  }

  async function handleConfirmProposta() {
    if (!socket || !lead || !operadorId || !propostaValor) return

    await supabase.from('atendimentos').update({
      valor_estimado: parseFloat(propostaValor),
    }).eq('lead_id', lead.id)

    await supabase.from('timeline_events').insert({
      lead_id: lead.id,
      tipo: 'proposta_enviada',
      descricao: `Proposta enviada: R$ ${propostaValor}`,
      operador_id: operadorId,
      metadata: { valor: propostaValor },
    })

    socket.emit('pipeline_transition', {
      lead_id: lead.id,
      target_stage: 'PAGAMENTO_PENDENTE',
      conditions: { documento_assinado: true },
    })

    setShowPropostaModal(false)
    setPropostaValor('')
  }

  async function handleConfirmContrato() {
    if (!socket || !lead || !operadorId) return

    await supabase.from('atendimentos').update({
      documento_enviado: true,
    }).eq('lead_id', lead.id)

    await supabase.from('timeline_events').insert({
      lead_id: lead.id,
      tipo: 'contrato_gerado',
      descricao: 'Contrato gerado e enviado ao cliente',
      operador_id: operadorId,
      metadata: { documento_enviado: true },
    })

    socket.emit('pipeline_transition', {
      lead_id: lead.id,
      target_stage: 'DEVOLUTIVA',
      conditions: { documento_enviado: true },
    })

    setShowContratoConfirm(false)
  }

  // --- Conversão (Change D — enhanced validation) ---
  async function handleConversao() {
    if (!operadorId) return
    setLoading(true)
    try {
      const { error: clientErr } = await supabase.from('clients').insert({
        identity_id: lead.identity_id || lead.id,
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
          classificacao_final: segmentNodes.find(n => n.id === selectedSegmento)?.nome || lead.area,
          valor_contrato: valorContrato ? parseFloat(valorContrato) : null,
          status_pagamento: statusPagamento,
          valor_entrada: valorEntrada ? parseFloat(valorEntrada) : null,
          contrato_assinado: contratoAssinado,
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
          classificacao_final: segmentNodes.find(n => n.id === selectedSegmento)?.nome || lead.area,
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

  // Change D: CONVERTER enabled only when email + valorEntrada + contratoAssinado + segmento
  const converterEnabled = !!emailValue.trim() && parseFloat(valorEntrada) > 0 && contratoAssinado && !!selectedSegmento && isAssumido
  const desfechoEnabled = !!selectedSegmento && isAssumido

  return (
    <div className="space-y-4">

      {/* ═══ BLOCO 1 — CONTEXTO (Quem é) ═══ */}
      <div>
        <span className="text-xs font-medium text-text-secondary uppercase">Contexto</span>
      </div>

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

      {/* Editable email (Change A) */}
      <div>
        <span className="text-xs text-text-muted block mb-1">E-mail</span>
        {editingEmail ? (
          <input
            autoFocus
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            onBlur={saveEmail}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEmail() }}
            className="w-full rounded-md border border-accent bg-bg-primary px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="email@exemplo.com"
          />
        ) : (
          <p
            onClick={() => setEditingEmail(true)}
            className="text-sm text-text-primary cursor-pointer hover:text-accent transition-colors"
            title="Clique para editar"
          >
            {emailValue || lead.email || '—'}
          </p>
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

      <hr className="border-border my-3" />

      {/* ═══ BLOCO 2 — CLASSIFICAÇÃO (Decidir) ═══ */}
      <div>
        <span className="text-xs font-medium text-text-secondary uppercase">Classificação</span>
      </div>

      {/* Cascading Segment Dropdowns */}
      <div className="space-y-2">
        {/* Segmento (Level 1) */}
        <div>
          <span className="text-xs text-text-muted block mb-1">{COPY.qualificacao.segmento}</span>
          <select
            value={selectedSegmento || ''}
            onChange={(e) => handleSegmentoChange(e.target.value)}
            className="w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Selecionar...</option>
            {filterChildren(segmentNodes, null, 1).map(n => (
              <option key={n.id} value={n.id}>{n.nome}</option>
            ))}
          </select>
        </div>

        {/* Assunto (Level 2) */}
        <div>
          <span className="text-xs text-text-muted block mb-1">{COPY.qualificacao.assunto}</span>
          <select
            value={selectedAssunto || ''}
            onChange={(e) => handleAssuntoChange(e.target.value)}
            disabled={!selectedSegmento || filterChildren(segmentNodes, selectedSegmento, 2).length === 0}
            className="w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
          >
            <option value="">{selectedSegmento && filterChildren(segmentNodes, selectedSegmento, 2).length === 0 ? COPY.qualificacao.nenhumaOpcao : 'Selecionar...'}</option>
            {filterChildren(segmentNodes, selectedSegmento, 2).map(n => (
              <option key={n.id} value={n.id}>{n.nome}</option>
            ))}
          </select>
        </div>

        {/* Especificação (Level 3) */}
        <div>
          <span className="text-xs text-text-muted block mb-1">{COPY.qualificacao.especificacao}</span>
          <select
            value={selectedEspecificacao || ''}
            onChange={(e) => handleEspecificacaoChange(e.target.value)}
            disabled={!selectedAssunto || filterChildren(segmentNodes, selectedAssunto, 3).length === 0}
            className="w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
          >
            <option value="">{selectedAssunto && filterChildren(segmentNodes, selectedAssunto, 3).length === 0 ? COPY.qualificacao.nenhumaOpcao : 'Selecionar...'}</option>
            {filterChildren(segmentNodes, selectedAssunto, 3).map(n => (
              <option key={n.id} value={n.id}>{n.nome}</option>
            ))}
          </select>
        </div>

        {!selectedSegmento && <p className="text-xs text-warning mt-1">Selecione o segmento para habilitar os desfechos</p>}
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

      <hr className="border-border my-3" />

      {/* ═══ BLOCO 3 — AÇÕES (O que fazer) ═══ */}
      <div>
        <span className="text-xs font-medium text-text-secondary uppercase">Ações</span>
      </div>

      {/* Botoeira de Jornada — 4 action buttons (Change C) */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setShowAgendarModal(true)} className="px-2 py-1.5 rounded-md text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20">
          {COPY.botoeira.agendarReuniao}
        </button>
        <button onClick={() => setShowSolicitarModal(true)} className="px-2 py-1.5 rounded-md text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20">
          {COPY.botoeira.solicitarDados}
        </button>
        <button onClick={() => setShowPropostaModal(true)} className="px-2 py-1.5 rounded-md text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20">
          {COPY.botoeira.enviarProposta}
        </button>
        <button onClick={() => setShowContratoConfirm(true)} className="px-2 py-1.5 rounded-md text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20">
          {COPY.botoeira.gerarContrato}
        </button>
      </div>

      {/* Dossiê Estratégico — auto-save on blur (Change B) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{COPY.qualificacao.dossieEstrategico}</span>
          {notaSalva && (
            <span className="text-xs text-success animate-pulse">Salvo</span>
          )}
        </div>
        <div className="bg-bg-surface border border-border rounded-md p-2">
          <textarea
            value={notaTexto}
            onChange={(e) => setNotaTexto(e.target.value)}
            onBlur={handleNotaBlur}
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

      {/* Converter validation fields (Change D) */}
      {!isCliente && (
        <div className="space-y-3 border-t border-border pt-3">
          <div>
            <span className="text-xs text-text-muted block mb-1">{COPY.qualificacao.valorEntrada}</span>
            <input
              type="number"
              value={valorEntrada}
              onChange={(e) => setValorEntrada(e.target.value)}
              placeholder="0,00"
              disabled={!isAssumido}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={contratoAssinado}
              onChange={(e) => setContratoAssinado(e.target.checked)}
              disabled={!isAssumido}
              className="rounded border-border text-accent focus:ring-accent disabled:opacity-40"
            />
            <span className="text-xs text-text-primary">Contrato Assinado</span>
          </label>
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
              disabled={!converterEnabled || loading}
              className="w-full py-2 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed"
              title={!converterEnabled ? 'Preencha e-mail, valor de entrada, marque contrato assinado e selecione segmento' : ''}
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

      {/* ═══ BOTOEIRA MODALS ═══ */}

      {/* Modal Agendar Reunião */}
      {showAgendarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAgendarModal(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary mb-3">Agendar Reunião</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Data e Hora</label>
                <input type="datetime-local" value={agendarData} onChange={e => setAgendarData(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Local / Link</label>
                <input type="text" value={agendarLocal} onChange={e => setAgendarLocal(e.target.value)} placeholder="Escritório ou link da call"
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAgendarModal(false)} className="px-3 py-1.5 text-xs font-medium text-text-secondary">Cancelar</button>
                <button onClick={handleConfirmAgendar} disabled={!agendarData || !agendarLocal}
                  className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md disabled:opacity-40">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solicitar Dados */}
      {showSolicitarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSolicitarModal(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary mb-3">Solicitar Dados</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Quais documentos solicitar?</label>
                <textarea value={solicitarDocs} onChange={e => setSolicitarDocs(e.target.value)} rows={3} placeholder="Descreva os documentos necessários..."
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowSolicitarModal(false)} className="px-3 py-1.5 text-xs font-medium text-text-secondary">Cancelar</button>
                <button onClick={handleConfirmSolicitar} disabled={!solicitarDocs.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md disabled:opacity-40">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Proposta */}
      {showPropostaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPropostaModal(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary mb-3">Enviar Proposta</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Valor da proposta (R$)</label>
                <input type="number" value={propostaValor} onChange={e => setPropostaValor(e.target.value)} placeholder="0,00"
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowPropostaModal(false)} className="px-3 py-1.5 text-xs font-medium text-text-secondary">Cancelar</button>
                <button onClick={handleConfirmProposta} disabled={!propostaValor}
                  className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md disabled:opacity-40">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerar Contrato (confirmation) */}
      {showContratoConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowContratoConfirm(false)}>
          <div className="bg-bg-primary rounded-lg border border-border p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary mb-3">Gerar Contrato</h3>
            <p className="text-xs text-text-secondary mb-4">Confirma a geração e envio do contrato ao cliente?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowContratoConfirm(false)} className="px-3 py-1.5 text-xs font-medium text-text-secondary">Cancelar</button>
              <button onClick={handleConfirmContrato}
                className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md">Confirmar</button>
            </div>
          </div>
        </div>
      )}

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
