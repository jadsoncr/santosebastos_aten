'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { useRouter } from 'next/navigation'
import { displayPhone, telLink } from '@/utils/format'
import PopupEnfileirar from './PopupEnfileirar'
import { COPY } from '@/utils/copy'
import { resolveClassification } from '@/utils/resolveClassification'
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

  // Classification preview (template visual port)
  const [classificationPreview, setClassificationPreview] = useState<{ status_negocio: string; destino: string } | null>(null)

  // Dirty state for unsaved changes indicator
  const [isDirty, setIsDirty] = useState(false)

  // Toast state (inline toast system — Task 6.2)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; persistent: boolean } | null>(null)

  // Botoeira modals (replacing prompt())
  const [showAgendarModal, setShowAgendarModal] = useState(false)
  const [agendarData, setAgendarData] = useState('')
  const [agendarLocal, setAgendarLocal] = useState('')

  const [showSolicitarModal, setShowSolicitarModal] = useState(false)
  const [solicitarDocs, setSolicitarDocs] = useState('')

  const [showPropostaModal, setShowPropostaModal] = useState(false)
  const [propostaValor, setPropostaValor] = useState('')

  const [showContratoConfirm, setShowContratoConfirm] = useState(false)

  // Delegate popover state (Task 7.1)
  const [showDelegatePopover, setShowDelegatePopover] = useState(false)
  const [operators, setOperators] = useState<{id: string; nome: string}[]>([])

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
    setIsDirty(false)
  }, [lead.id])

  // Classification preview — compute when especificacao changes
  useEffect(() => {
    if (selectedEspecificacao) {
      const node = segmentNodes.find(n => n.id === selectedEspecificacao)
      if (node) {
        const result = resolveClassification(node.nome, node)
        setClassificationPreview(result)
      }
    } else {
      setClassificationPreview(null)
    }
  }, [selectedEspecificacao, segmentNodes])

  async function loadNotas() {
    // Load notas by identity_id for cross-lead consolidation, fallback to lead_id
    if (lead.identity_id) {
      const { data: allLeads } = await supabase.from('leads').select('id').eq('identity_id', lead.identity_id)
      const leadIds = (allLeads || []).map((l: any) => l.id)
      if (leadIds.length > 0) {
        const { data } = await supabase
          .from('mensagens')
          .select('id, conteudo, created_at')
          .in('lead_id', leadIds)
          .eq('tipo', 'nota_interna')
          .order('created_at', { ascending: false })
        if (data) setNotas(data)
        return
      }
    }
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
    setIsDirty(true)
    await supabase.from('leads').update({ segmento_id: segmentoId, assunto_id: null, especificacao_id: null }).eq('id', lead.id)
  }

  async function handleAssuntoChange(assuntoId: string) {
    setSelectedAssunto(assuntoId)
    setSelectedEspecificacao(null)
    setIsDirty(true)
    await supabase.from('leads').update({ assunto_id: assuntoId, especificacao_id: null }).eq('id', lead.id)
  }

  async function handleEspecificacaoChange(especificacaoId: string) {
    setSelectedEspecificacao(especificacaoId)
    setIsDirty(true)
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

    // Update atendimento with status_negocio
    await supabase.from('atendimentos').upsert({
      identity_id: lead.identity_id,
      lead_id: lead.id,
      owner_id: operadorId,
      status_negocio: 'reuniao_agendada',
      destino: 'backoffice',
    }, { onConflict: 'identity_id' })

    // Timeline event
    await supabase.from('timeline_events').insert({
      lead_id: lead.id,
      tipo: 'reuniao_agendada',
      descricao: `Reunião agendada: ${agendarData} - ${agendarLocal}`,
      operador_id: operadorId,
      metadata: { data: agendarData, local: agendarLocal },
    })

    // Audit trail
    const { data: at } = await supabase.from('atendimentos').select('id').eq('lead_id', lead.id).maybeSingle()
    if (at) {
      await supabase.from('status_transitions').insert({
        atendimento_id: at.id,
        status_anterior: null,
        status_novo: 'reuniao_agendada',
        operador_id: operadorId,
      })
    }

    // Socket event for sidebar removal + backoffice update
    socket.emit('conversa_classificada', {
      lead_id: lead.id,
      status_negocio: 'reuniao_agendada',
      destino: 'backoffice',
    })

    showToast('backoffice')
    setShowAgendarModal(false)
    setAgendarData('')
    setAgendarLocal('')
    onLeadClosed()
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

    // This is an action during conversation, doesn't change status_negocio
    // Just records the timeline event
    showToast('relacionamento')
    setShowSolicitarModal(false)
    setSolicitarDocs('')
  }

  async function handleConfirmProposta() {
    if (!socket || !lead || !operadorId || !propostaValor) return

    await supabase.from('atendimentos').upsert({
      identity_id: lead.identity_id,
      lead_id: lead.id,
      owner_id: operadorId,
      status_negocio: 'aguardando_proposta',
      destino: 'backoffice',
      valor_estimado: parseFloat(propostaValor),
    }, { onConflict: 'identity_id' })

    await supabase.from('timeline_events').insert({
      lead_id: lead.id,
      tipo: 'proposta_enviada',
      descricao: `Proposta enviada: R$ ${propostaValor}`,
      operador_id: operadorId,
      metadata: { valor: propostaValor },
    })

    const { data: at } = await supabase.from('atendimentos').select('id').eq('lead_id', lead.id).maybeSingle()
    if (at) {
      await supabase.from('status_transitions').insert({
        atendimento_id: at.id,
        status_anterior: null,
        status_novo: 'aguardando_proposta',
        operador_id: operadorId,
      })
    }

    socket.emit('conversa_classificada', {
      lead_id: lead.id,
      status_negocio: 'aguardando_proposta',
      destino: 'backoffice',
    })

    showToast('backoffice')
    setShowPropostaModal(false)
    setPropostaValor('')
    onLeadClosed()
  }

  async function handleConfirmContrato() {
    if (!socket || !lead || !operadorId) return

    await supabase.from('atendimentos').upsert({
      identity_id: lead.identity_id,
      lead_id: lead.id,
      owner_id: operadorId,
      status_negocio: 'aguardando_contrato',
      destino: 'backoffice',
    }, { onConflict: 'identity_id' })

    await supabase.from('timeline_events').insert({
      lead_id: lead.id,
      tipo: 'contrato_gerado',
      descricao: 'Contrato gerado e enviado ao cliente',
      operador_id: operadorId,
      metadata: { documento_enviado: true },
    })

    const { data: at } = await supabase.from('atendimentos').select('id').eq('lead_id', lead.id).maybeSingle()
    if (at) {
      await supabase.from('status_transitions').insert({
        atendimento_id: at.id,
        status_anterior: null,
        status_novo: 'aguardando_contrato',
        operador_id: operadorId,
      })
    }

    socket.emit('conversa_classificada', {
      lead_id: lead.id,
      status_negocio: 'aguardando_contrato',
      destino: 'backoffice',
    })

    showToast('backoffice')
    setShowContratoConfirm(false)
    onLeadClosed()
  }

  // --- Toast helpers (Task 6.2) ---
  const TOAST_MESSAGES: Record<string, string> = {
    backoffice: 'Encaminhado para operação',
    encerrado: 'Lead encerrado',
    sidebar: 'Lead movido para sidebar',
    relacionamento: 'Encaminhado para relacionamento',
  }

  function showToast(destino: string, error?: boolean) {
    const message = error
      ? 'Erro ao salvar classificação. Tente novamente.'
      : TOAST_MESSAGES[destino] || 'Classificação salva'
    setToast({ message, type: error ? 'error' : 'success', persistent: !!error })
    if (!error) {
      setTimeout(() => setToast(null), 3000)
    }
  }

  // --- Classificar (Task 6.1) ---
  async function handleClassificar() {
    if (!selectedEspecificacao || !operadorId) return
    setLoading(true)

    try {
      // 1. Resolve subcategoria name
      const subcategoriaNode = segmentNodes.find(n => n.id === selectedEspecificacao)
      if (!subcategoriaNode) throw new Error('Subcategoria não encontrada')

      // 2. Resolve classification
      const { status_negocio, destino } = resolveClassification(subcategoriaNode.nome, subcategoriaNode)

      // 3. Upsert atendimento with classification data
      const { error: atError } = await supabase
        .from('atendimentos')
        .upsert({
          identity_id: lead.identity_id,
          lead_id: lead.id,
          owner_id: operadorId,
          status: 'classificado',
          status_negocio,
          destino,
          classificacao_entrada: subcategoriaNode.nome,
          motivo_id: selectedSegmento,
          categoria_id: selectedAssunto,
          subcategoria_id: selectedEspecificacao,
        }, { onConflict: 'identity_id' })

      if (atError) throw atError

      // 4. Get the atendimento id for audit
      const { data: atendimento } = await supabase
        .from('atendimentos')
        .select('id')
        .eq('lead_id', lead.id)
        .maybeSingle()

      // 5. Insert audit record
      if (atendimento) {
        await supabase.from('status_transitions').insert({
          atendimento_id: atendimento.id,
          status_anterior: null,
          status_novo: status_negocio,
          operador_id: operadorId,
        })
      }

      // 6. Emit socket event for sidebar removal
      if (socket) {
        socket.emit('conversa_classificada', {
          lead_id: lead.id,
          status_negocio,
          destino,
        })
      }

      // 7. Toast feedback
      showToast(destino)

      // 8. Reset dirty state
      setIsDirty(false)

      // 9. Clear selection
      onLeadClosed()
    } catch (err: any) {
      showToast('', true)
      console.error('[handleClassificar]', err.message)
    } finally {
      setLoading(false)
    }
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
          estado_painel: 'cliente',
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
          estado_painel: 'encerrado',
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
    <div className="space-y-4 pb-32">

      {/* ═══ BLOCO 1 — CONTEXTO (Quem é) ═══ */}
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contexto</span>
      </div>

      {/* Editable name */}
      <div>
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-1">Nome</span>
        {editingNome ? (
          <input
            autoFocus
            value={nomeValue}
            onChange={(e) => setNomeValue(e.target.value)}
            onBlur={saveNome}
            onKeyDown={(e) => { if (e.key === 'Enter') saveNome() }}
            className="w-full border-b border-gray-100 focus-within:border-blue-600 bg-transparent border-none p-0 text-sm font-bold text-gray-900 focus:ring-0"
          />
        ) : (
          <p
            onClick={() => setEditingNome(true)}
            className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
            title="Clique para editar"
          >
            {lead.nome || '—'}
          </p>
        )}
      </div>

      {/* Editable phone */}
      <div>
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-1">Telefone</span>
        {editingTelefone ? (
          <input
            autoFocus
            value={telefoneValue}
            onChange={(e) => setTelefoneValue(e.target.value)}
            onBlur={saveTelefone}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTelefone() }}
            className="w-full border-b border-gray-100 focus-within:border-blue-600 bg-transparent border-none p-0 text-sm font-bold text-gray-900 focus:ring-0"
          />
        ) : (
          <div>
            {telLink(lead.telefone) ? (
              <a href={telLink(lead.telefone)!} className="text-sm font-bold text-gray-900 hover:text-blue-600 block">
                {displayPhone(lead.telefone)}
              </a>
            ) : (
              <p className="text-sm font-bold text-gray-900">{displayPhone(lead.telefone)}</p>
            )}
            <button
              onClick={() => setEditingTelefone(true)}
              className="text-xs text-blue-600 hover:text-blue-700 mt-0.5"
            >
              {COPY.qualificacao.editarTelefone}
            </button>
          </div>
        )}
      </div>

      {/* Editable email (Change A) */}
      <div>
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-1">E-mail</span>
        {editingEmail ? (
          <input
            autoFocus
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            onBlur={saveEmail}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEmail() }}
            className="w-full border-b border-gray-100 focus-within:border-blue-600 bg-transparent border-none p-0 text-sm font-bold text-gray-900 focus:ring-0"
            placeholder="email@exemplo.com"
          />
        ) : (
          <p
            onClick={() => setEditingEmail(true)}
            className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
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
          className="w-full text-center text-[10px] text-blue-600 font-bold uppercase py-2.5 bg-blue-50/30 rounded-xl border border-blue-50 hover:bg-blue-50 transition-colors tracking-tight"
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

      <div className="pt-4 border-t border-[#E6E8EC]/20" />

      {/* ═══ BLOCO 2 — CLASSIFICAÇÃO (Decidir) ═══ */}
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Classificacao</span>
      </div>

      {/* Cascading Segment Dropdowns */}
      <div className="space-y-2">
        {/* Segmento (Level 1) */}
        <div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">{COPY.qualificacao.segmento}</span>
          <select
            value={selectedSegmento || ''}
            onChange={(e) => handleSegmentoChange(e.target.value)}
            className="w-full text-xs font-bold bg-white border border-[#E6E8EC]/20 rounded-xl p-3 focus:ring-1 focus:ring-blue-100 outline-none shadow-sm"
          >
            <option value="">Selecionar...</option>
            {filterChildren(segmentNodes, null, 1).map(n => (
              <option key={n.id} value={n.id}>{n.nome}</option>
            ))}
          </select>
        </div>

        {/* Assunto (Level 2) */}
        <div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">{COPY.qualificacao.assunto}</span>
          <select
            value={selectedAssunto || ''}
            onChange={(e) => handleAssuntoChange(e.target.value)}
            disabled={!selectedSegmento || filterChildren(segmentNodes, selectedSegmento, 2).length === 0}
            className="w-full text-xs font-bold bg-white border border-[#E6E8EC]/20 rounded-xl p-3 focus:ring-1 focus:ring-blue-100 outline-none shadow-sm disabled:opacity-40"
          >
            <option value="">{selectedSegmento && filterChildren(segmentNodes, selectedSegmento, 2).length === 0 ? COPY.qualificacao.nenhumaOpcao : 'Selecionar...'}</option>
            {filterChildren(segmentNodes, selectedSegmento, 2).map(n => (
              <option key={n.id} value={n.id}>{n.nome}</option>
            ))}
          </select>
        </div>

        {/* Especificação (Level 3) */}
        <div>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic underline underline-offset-4 block mb-1">{COPY.qualificacao.especificacao}</span>
          <select
            value={selectedEspecificacao || ''}
            onChange={(e) => handleEspecificacaoChange(e.target.value)}
            disabled={!selectedAssunto || filterChildren(segmentNodes, selectedAssunto, 3).length === 0}
            className="w-full text-xs font-black bg-blue-50/30 border border-blue-100 text-blue-700 rounded-2xl p-4 outline-none shadow-sm disabled:opacity-40"
          >
            <option value="">{selectedAssunto && filterChildren(segmentNodes, selectedAssunto, 3).length === 0 ? COPY.qualificacao.nenhumaOpcao : 'Selecionar...'}</option>
            {filterChildren(segmentNodes, selectedAssunto, 3).map(n => (
              <option key={n.id} value={n.id}>{n.nome}</option>
            ))}
          </select>
        </div>

        {!selectedSegmento && <p className="text-xs text-warning mt-1">Selecione o segmento para habilitar os desfechos</p>}
      </div>

      {/* "Vai acontecer" preview block */}
      {classificationPreview && (
        <div className="p-4 bg-gray-900 rounded-2xl">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Vai acontecer:</p>
          <div className="space-y-1">
            <p className="text-xs font-bold text-white flex justify-between">
              <span className="opacity-50">Status:</span>
              <span>{classificationPreview.status_negocio.replace(/_/g, ' ')}</span>
            </p>
            <p className="text-xs font-bold text-white flex justify-between">
              <span className="opacity-50">Destino:</span>
              <span className="text-blue-400">
                {classificationPreview.destino === 'backoffice' ? 'Operação (Backoffice)' :
                 classificationPreview.destino === 'encerrado' ? 'Encerrado' : classificationPreview.destino}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Valor estimado — só pra LEAD */}
      {!isCliente && (
        <div>
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-1">Valor estimado (R$)</span>
          <input
            type="number"
            value={valorEstimado}
            onChange={(e) => setValorEstimado(e.target.value)}
            onBlur={handleValorBlur}
            placeholder="0,00"
            disabled={!isAssumido}
            className="w-full text-xs font-bold bg-white border border-[#E6E8EC]/20 rounded-xl p-3 focus:ring-1 focus:ring-blue-100 outline-none shadow-sm disabled:opacity-40"
          />
          {!isAssumido && <p className="text-xs text-text-muted mt-1">Assuma o lead primeiro</p>}
        </div>
      )}

      <div className="pt-4 border-t border-[#E6E8EC]/20" />

      {/* ═══ BLOCO 3 — AÇÕES (O que fazer) ═══ */}
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acoes</span>
      </div>

      {/* Botoeira de Jornada — 4 action buttons (Change C) */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setShowAgendarModal(true)} className="px-2 py-2 rounded-xl text-xs font-bold bg-white border border-[#E6E8EC]/20 text-gray-600 hover:bg-gray-50 shadow-sm transition-colors">
          {COPY.botoeira.agendarReuniao}
        </button>
        <button onClick={() => setShowSolicitarModal(true)} className="px-2 py-2 rounded-xl text-xs font-bold bg-white border border-[#E6E8EC]/20 text-gray-600 hover:bg-gray-50 shadow-sm transition-colors">
          {COPY.botoeira.solicitarDados}
        </button>
        <button onClick={() => setShowPropostaModal(true)} className="px-2 py-2 rounded-xl text-xs font-bold bg-white border border-[#E6E8EC]/20 text-gray-600 hover:bg-gray-50 shadow-sm transition-colors">
          {COPY.botoeira.enviarProposta}
        </button>
        <button onClick={() => setShowContratoConfirm(true)} className="px-2 py-2 rounded-xl text-xs font-bold bg-white border border-[#E6E8EC]/20 text-gray-600 hover:bg-gray-50 shadow-sm transition-colors">
          {COPY.botoeira.gerarContrato}
        </button>
      </div>

      {/* Dossiê Estratégico — auto-save on blur (Change B) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{COPY.qualificacao.dossieEstrategico}</span>
          {notaSalva && (
            <span className="text-xs text-success animate-pulse">Salvo</span>
          )}
        </div>
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
            className="w-full text-[11px] font-medium bg-white border border-[#E6E8EC]/20 rounded-xl p-4 min-h-[100px] outline-none resize-none placeholder:text-gray-200 shadow-sm"
          />
        {notas.length > 0 && (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {notas.map((n) => (
              <div key={n.id} className="text-xs bg-bg-primary border border-border rounded-lg px-2.5 py-1.5 font-mono">
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
        <div className="space-y-3 border-t border-[#E6E8EC]/20 pt-3">
          <div>
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-1">{COPY.qualificacao.valorEntrada}</span>
            <input
              type="number"
              value={valorEntrada}
              onChange={(e) => setValorEntrada(e.target.value)}
              placeholder="0,00"
              disabled={!isAssumido}
              className="w-full text-xs font-bold bg-white border border-[#E6E8EC]/20 rounded-xl p-3 focus:ring-1 focus:ring-blue-100 outline-none shadow-sm disabled:opacity-40"
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
            <span className="text-xs font-bold text-gray-600">Contrato Assinado</span>
          </label>
        </div>
      )}

      {/* Fixed bottom section */}
      <div className="fixed bottom-0 right-0 w-80 p-6 bg-[#FBFBFC] border-t border-[#E6E8EC]/20 space-y-3 z-40">
        {isDirty && (
          <p className="text-[10px] font-black text-[#92400E] bg-[#FEF3C7] py-1 px-3 rounded-md uppercase tracking-widest text-center animate-pulse">
            Alterações não salvas
          </p>
        )}
        {isCliente ? (
          <button
            onClick={() => router.push(`/tela2?lead=${lead.id}`)}
            className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] bg-[#2563EB] text-white shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            IR PARA ACOMPANHAMENTO
          </button>
        ) : (
          <>
            <button
              onClick={handleClassificar}
              disabled={!selectedEspecificacao || !isAssumido || loading}
              className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${
                selectedEspecificacao && isAssumido
                  ? 'bg-[#2563EB] text-white shadow-blue-100 hover:bg-blue-700'
                  : 'bg-[#E5E7EB] text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              {loading ? 'Processando...' : 'Confirmar e encaminhar'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConversaoPopup(true)}
                disabled={!converterEnabled || loading}
                className="flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
              >
                Converter
              </button>
              <button
                onClick={() => setShowMotivoPopup(true)}
                disabled={!desfechoEnabled || loading}
                className="flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
              >
                Não fechou
              </button>
              <button
                onClick={() => setShowEnfileirar(true)}
                disabled={!desfechoEnabled || loading}
                className="flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-40 transition-colors"
              >
                Enfileirar
              </button>
            </div>
          </>
        )}
        {(lead as any).is_reaquecido && (
          <button
            onClick={async () => {
              await supabase.from('leads').update({ is_reaquecido: false }).eq('id', lead.id)
              if (socket) socket.emit('lead_encerrado', { lead_id: lead.id, tipo: 'arquivado' })
              onLeadClosed()
            }}
            className="w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight text-gray-400 hover:bg-gray-50 transition-colors"
          >
            Arquivar interação
          </button>
        )}
        {/* Delegate button + popover */}
        {isAssumido && (
          <div className="relative">
            <button
              onClick={async () => {
                if (!showDelegatePopover) {
                  const { data } = await supabase.from('operadores').select('id, nome, role')
                  setOperators((data || []).filter((op: any) => op.id !== operadorId).map((op: any) => ({ id: op.id, nome: op.nome || 'Operador' })))
                }
                setShowDelegatePopover(!showDelegatePopover)
              }}
              className="w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight text-blue-600 bg-blue-50/30 border border-blue-50 hover:bg-blue-50 transition-colors"
            >
              Delegar para outro operador
            </button>
            {showDelegatePopover && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-50 max-h-48 overflow-y-auto">
                {operators.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">Nenhum operador disponível</p>
                )}
                {operators.map(op => (
                  <button
                    key={op.id}
                    onClick={() => {
                      if (socket && operadorId) {
                        socket.emit('delegate_lead', {
                          lead_id: lead.id,
                          from_user_id: operadorId,
                          to_user_id: op.id,
                        })
                        showToast('relacionamento')
                        setShowDelegatePopover(false)
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    {op.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BOTOEIRA MODALS ═══ */}

      {/* Modal Agendar Reunião */}
      {showAgendarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAgendarModal(false)}>
          <div className="bg-bg-primary rounded-xl border border-border p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary mb-3">Agendar Reuniao</h3>
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
                <button onClick={() => setShowAgendarModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">Cancelar</button>
                <button onClick={handleConfirmAgendar} disabled={!agendarData || !agendarLocal}
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-40 hover:bg-accent-hover transition-colors">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solicitar Dados */}
      {showSolicitarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSolicitarModal(false)}>
          <div className="bg-bg-primary rounded-xl border border-border p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary mb-3">Solicitar Dados</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Quais documentos solicitar?</label>
                <textarea value={solicitarDocs} onChange={e => setSolicitarDocs(e.target.value)} rows={3} placeholder="Descreva os documentos necessários..."
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowSolicitarModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">Cancelar</button>
                <button onClick={handleConfirmSolicitar} disabled={!solicitarDocs.trim()}
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-40 hover:bg-accent-hover transition-colors">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Proposta */}
      {showPropostaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPropostaModal(false)}>
          <div className="bg-bg-primary rounded-xl border border-border p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary mb-3">Enviar Proposta</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Valor da proposta (R$)</label>
                <input type="number" value={propostaValor} onChange={e => setPropostaValor(e.target.value)} placeholder="0,00"
                  className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowPropostaModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">Cancelar</button>
                <button onClick={handleConfirmProposta} disabled={!propostaValor}
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-40 hover:bg-accent-hover transition-colors">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerar Contrato (confirmation) */}
      {showContratoConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowContratoConfirm(false)}>
          <div className="bg-bg-primary rounded-xl border border-border p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary mb-3">Gerar Contrato</h3>
            <p className="text-xs text-text-secondary mb-4">Confirma a geracao e envio do contrato ao cliente?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowContratoConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">Cancelar</button>
              <button onClick={handleConfirmContrato}
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Conversão */}
      {showConversaoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConversaoPopup(false)}>
          <div className="bg-bg-primary rounded-xl border border-border p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold text-text-primary mb-4">Conversao de cliente</h2>
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
                <button onClick={() => setShowConversaoPopup(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleConversao}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-success text-white hover:bg-success/90 disabled:opacity-50 transition-colors"
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
          <div className="bg-bg-primary rounded-xl border border-border p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
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
                <button onClick={() => setShowMotivoPopup(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleNaoFechou}
                  disabled={!motivoSelecionado || loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-error text-white hover:bg-error/90 disabled:opacity-40 transition-colors"
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

      {/* Inline toast (Task 6.2) */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-opacity duration-150 ${
          toast.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'
        }`}>
          {toast.message}
          {toast.persistent && (
            <button onClick={() => setToast(null)} className="ml-3 text-white/80 hover:text-white">✕</button>
          )}
        </div>
      )}
    </div>
  )
}
