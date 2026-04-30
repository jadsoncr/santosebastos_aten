'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import { usePainelContext } from '@/hooks/usePainelContext'
import { useOperadorRole } from '@/hooks/useOperadorRole'
import { usePainelMode } from '@/utils/painelModes'
import { resolveTreatment, TREATMENT_TIPOS, TREATMENT_DETALHES, type TreatmentTipo, type TreatmentResult } from '@/utils/resolveTreatment'
import { calcularPrazo, getPrazoLabel } from '@/utils/painelStatus'
import { getIntencaoAtual } from '@/utils/getIntencaoAtual'
import { getNextActionLabel } from '@/utils/nextAction'
import { filterChildren, type SegmentNode } from '@/utils/segmentTree'
import { cn } from '@/lib/utils'
import PainelHeader from './PainelHeader'
import type { Lead } from '../page'

interface Props {
  lead: Lead | null
  onLeadUpdate: (lead: Lead) => void
  onLeadClosed: () => void
}

interface HistoricoItem {
  id: string
  status_negocio: string | null
  destino: string | null
  classificacao_tratamento_tipo: string | null
  created_at: string
}

const MOTIVOS_PERDA = [
  'Preço / Honorários', 'Sem perfil (área errada)', 'Já fechou com outro',
  'Decidiu não prosseguir', 'Sem retorno', 'Perda de contato', 'Erro de bot', 'Outro',
]

function getScoreVisual(score: number) {
  if (score >= 7) return { icon: '🔥', label: 'QUENTE', color: 'text-red-600', bg: 'bg-red-50 border-red-200' }
  if (score >= 4) return { icon: '⚠️', label: 'MORNO', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' }
  return { icon: '❄️', label: 'FRIO', color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200' }
}

function formatStatusNegocio(status: string | null): string {
  if (!status) return '—'
  const MAP: Record<string, string> = {
    aguardando_agendamento: 'Aguardando agendamento',
    aguardando_contato: 'Aguardando contato',
    reuniao_agendada: 'Reunião agendada',
    aguardando_proposta: 'Aguardando proposta',
    negociacao: 'Em negociação',
    fechado: 'Fechado',
    perdido: 'Perdido',
    resolvido: 'Resolvido',
    nao_evoluiu: 'Não evoluiu',
  }
  return MAP[status] || status.replace(/_/g, ' ')
}

export default function PainelLead({ lead, onLeadUpdate, onLeadClosed }: Props) {
  const ctx = usePainelContext(lead)
  const mode = usePainelMode(ctx.estado_painel)

  const { role, operadorId } = useOperadorRole()

  // Editable fields
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // Dossiê
  const [observacao, setObservacao] = useState('')
  const [notas, setNotas] = useState<{ id: string; conteudo: string; created_at: string }[]>([])
  const [notaSalva, setNotaSalva] = useState(false)
  const notaTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Tratamento (2 níveis)
  const [tratamentoTipo, setTratamentoTipo] = useState<string>('')
  const [tratamentoDetalhe, setTratamentoDetalhe] = useState<string>('')
  const [treatment, setTreatment] = useState<TreatmentResult | null>(null)

  // Jurídico (3 níveis)
  const [segmentNodes, setSegmentNodes] = useState<SegmentNode[]>([])
  const [areaId, setAreaId] = useState<string | null>(null)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [subcategoriaId, setSubcategoriaId] = useState<string | null>(null)

  // Histórico
  const [historico, setHistorico] = useState<HistoricoItem[]>([])

  // UI state
  const [showFechamentoModal, setShowFechamentoModal] = useState(false)
  const [valorContrato, setValorContrato] = useState('')
  const [valorEntrada, setValorEntrada] = useState('0')
  const [percentualExito, setPercentualExito] = useState('30')
  const [tipoHonorario, setTipoHonorario] = useState('entrada_exito')
  const [formaPagamento, setFormaPagamento] = useState('pix')

  const [showMotivoPopup, setShowMotivoPopup] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [motivoObs, setMotivoObs] = useState('')
  const [showIdentitySearch, setShowIdentitySearch] = useState(false)
  const [identityQuery, setIdentityQuery] = useState('')
  const [identityResults, setIdentityResults] = useState<{ id: string; nome: string | null; telefone: string | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const supabase = createClient()
  const socket = useSocket()

  // Derived
  const isOwner = !ctx.owner_id || ctx.owner_id === operadorId
  const canSeeFinanceiro = role === 'owner' || ctx.owner_id === operadorId
  const canAssumir = role === 'owner' && ctx.owner_id !== operadorId

  // ── Init ──

  // ── Load segment tree ──
  useEffect(() => {
    supabase.from('segment_trees').select('*').eq('ativo', true).order('nome').then(({ data }) => {
      if (data) setSegmentNodes(data as SegmentNode[])
    })
  }, [])

  // ── Load histórico on lead change ──
  useEffect(() => {
    if (!lead) { setHistorico([]); return }
    if (lead.identity_id) {
      supabase.from('atendimentos')
        .select('id, status_negocio, destino, classificacao_tratamento_tipo, created_at')
        .eq('identity_id', lead.identity_id)
        .not('status_negocio', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => setHistorico(data || []))
    } else {
      setHistorico([])
    }
  }, [lead?.id])

  // ── Reset on lead change ──
  useEffect(() => {
    if (!lead) return
    setEditName(lead.nome || ''); setEditPhone(lead.telefone || ''); setEditEmail(lead.email || '')
    setObservacao(''); setTratamentoTipo(''); setTratamentoDetalhe(''); setTreatment(null)
    setAreaId(null); setCategoriaId(null); setSubcategoriaId(null)
    setShowMotivoPopup(false); setShowIdentitySearch(false)
    loadNotas()
  }, [lead?.id])

  useEffect(() => { return () => { if (notaTimerRef.current) clearTimeout(notaTimerRef.current) } }, [])

  // ── Resolve treatment ──
  useEffect(() => {
    if (tratamentoTipo && tratamentoDetalhe) {
      try { setTreatment(resolveTreatment(tratamentoTipo, tratamentoDetalhe)) }
      catch { setTreatment(null) }
    } else { setTreatment(null) }
  }, [tratamentoTipo, tratamentoDetalhe])

  // ── Helpers ──
  function showToastMsg(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ message: msg, type }); if (type === 'success') setTimeout(() => setToast(null), 3000)
  }

  async function loadNotas() {
    if (!lead) return
    if (lead.identity_id) {
      const { data: allLeads } = await supabase.from('leads').select('id').eq('identity_id', lead.identity_id)
      const leadIds = (allLeads || []).map(l => l.id)
      if (leadIds.length > 0) {
        const { data } = await supabase.from('mensagens').select('id, conteudo, created_at').in('lead_id', leadIds).eq('tipo', 'nota_interna').order('created_at', { ascending: false })
        if (data) setNotas(data)
        return
      }
    }
    const { data } = await supabase.from('mensagens').select('id, conteudo, created_at').eq('lead_id', lead.id).eq('tipo', 'nota_interna').order('created_at', { ascending: false })
    if (data) setNotas(data)
  }

  // ── Save handlers ──
  async function saveName() { if (!lead || !editName.trim()) return; const { data: ld } = await supabase.from('leads').select('identity_id').eq('id', lead.id).maybeSingle(); if (ld?.identity_id) { await supabase.from('identities').update({ nome: editName.trim() }).eq('id', ld.identity_id); await supabase.from('leads').update({ nome: editName.trim() }).eq('identity_id', ld.identity_id) } else { await supabase.from('leads').update({ nome: editName.trim() }).eq('id', lead.id) }; onLeadUpdate({ ...lead, nome: editName.trim() }) }
  async function savePhone() { if (!lead || !editPhone.trim()) return; const { data: ld } = await supabase.from('leads').select('identity_id').eq('id', lead.id).maybeSingle(); if (ld?.identity_id) await supabase.from('identities').update({ telefone: editPhone.trim() }).eq('id', ld.identity_id); onLeadUpdate({ ...lead, telefone: editPhone.trim() }) }
  async function saveEmail() { if (!lead || !editEmail.trim()) return; const { data: ld } = await supabase.from('leads').select('identity_id').eq('id', lead.id).maybeSingle(); if (ld?.identity_id) await supabase.from('identities').update({ email: editEmail.trim() }).eq('id', ld.identity_id); onLeadUpdate({ ...lead, email: editEmail.trim() }) }

  // ── Nota save ──
  async function handleSaveNota() {
    if (!observacao.trim() || !operadorId || !lead) return
    await supabase.from('mensagens').insert({ lead_id: lead.id, de: operadorId, tipo: 'nota_interna', conteudo: observacao.trim(), operador_id: operadorId })
    loadNotas(); setNotaSalva(true)
    if (notaTimerRef.current) clearTimeout(notaTimerRef.current)
    notaTimerRef.current = setTimeout(() => setNotaSalva(false), 1500)
  }

  // ══════════════════════════════════════════════
  // CONFIRMAR ENCAMINHAMENTO (triagem)
  // ══════════════════════════════════════════════
  async function handleConfirmar() {
    if (!treatment || !operadorId || !lead) return
    setLoading(true)
    try {
      if (observacao.trim()) await handleSaveNota()

      const { error } = await supabase.from('atendimentos').upsert({
        identity_id: lead.identity_id,           // PRIMARY lookup key
        lead_id: lead.id,                         // Keep for reference/routing
        owner_id: operadorId,
        status: 'classificado',
        status_negocio: treatment.status_negocio,
        destino: treatment.destino,
        estado_painel: treatment.destino === 'backoffice' ? 'em_atendimento' : 'encerrado',
        classificacao_tratamento_tipo: tratamentoTipo,
        classificacao_tratamento_detalhe: tratamentoDetalhe,
        motivo_id: areaId || null,
        categoria_id: categoriaId || null,
        subcategoria_id: subcategoriaId || null,
        observacao: observacao.trim() || null,
        prazo_proxima_acao: calcularPrazo(treatment.status_negocio)?.toISOString() || null,
      }, { onConflict: 'identity_id' })
      if (error) throw error

      if (areaId) {
        await supabase.from('leads').update({ segmento_id: areaId, assunto_id: categoriaId, especificacao_id: subcategoriaId }).eq('id', lead.id)
      }

      const { data: at } = await supabase.from('atendimentos').select('id').eq('identity_id', lead.identity_id).maybeSingle()
      if (at) await supabase.from('status_transitions').insert({ atendimento_id: at.id, status_anterior: null, status_novo: treatment.status_negocio, operador_id: operadorId })

      if (socket) {
        socket.emit('conversa_classificada', { lead_id: lead.id, status_negocio: treatment.status_negocio, destino: treatment.destino })
        socket.emit('estado_painel_changed', { identity_id: lead.identity_id, lead_id: lead.id, estado_painel: treatment.destino === 'backoffice' ? 'em_atendimento' : 'encerrado' })
      }
      showToastMsg(treatment.destino === 'backoffice' ? 'Encaminhado para operação' : 'Atendimento encerrado')
      ctx.refetch()
      onLeadClosed()
    } catch (err: any) { showToastMsg(err.message || 'Erro', 'error') }
    finally { setLoading(false) }
  }

  // ── Avançar status_negocio (em_atendimento pipeline) ──
  async function handleAvancarStatus(novoStatus: string) {
    if (!operadorId || !lead?.identity_id) return
    setLoading(true)
    try {
      const statusAnterior = ctx.status_negocio

      // Special cases: fechado → cliente, perdido → encerrado
      const novoEstadoPainel = novoStatus === 'fechado'
        ? 'cliente'
        : novoStatus === 'perdido'
        ? 'encerrado'
        : 'em_atendimento'

      await supabase.from('atendimentos').update({
        status_negocio: novoStatus,
        estado_painel: novoEstadoPainel,
        ...(novoStatus === 'perdido' ? { encerrado_em: new Date().toISOString() } : {}),
        ...(novoStatus !== 'fechado' && novoStatus !== 'perdido' ? { prazo_proxima_acao: calcularPrazo(novoStatus).toISOString() } : {}),
      }).eq('identity_id', lead.identity_id)

      // Audit trail
      const { data: at } = await supabase.from('atendimentos').select('id').eq('identity_id', lead.identity_id).maybeSingle()
      if (at) {
        await supabase.from('status_transitions').insert({
          atendimento_id: at.id,
          status_anterior: statusAnterior,
          status_novo: novoStatus,
          operador_id: operadorId,
        })
      }

      // Socket
      if (socket) {
        socket.emit('estado_painel_changed', { identity_id: lead.identity_id, lead_id: lead.id, estado_painel: novoEstadoPainel })
        if (novoStatus === 'fechado' || novoStatus === 'perdido') {
          socket.emit('status_negocio_changed', { lead_id: lead.id, status_anterior: statusAnterior, status_novo: novoStatus })
        }
      }

      showToastMsg(novoStatus === 'fechado' ? 'Cliente convertido' : novoStatus === 'perdido' ? 'Caso encerrado' : 'Status atualizado')
      ctx.refetch()
    } catch (err: any) { showToastMsg(err.message || 'Erro', 'error') }
    finally { setLoading(false) }
  }

  // ── Não fechou (em_atendimento → encerrado) ──
  async function handleNaoFechou() {
    if (!operadorId || !motivoSelecionado || !lead) return; setLoading(true)
    try {
      await supabase.from('repescagem').insert({ lead_id: lead.id, operador_id: operadorId, motivo: motivoSelecionado, observacao: motivoObs || null, data_retorno: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] })
      await supabase.from('atendimentos').update({
        status: 'nao_fechou',
        estado_painel: 'encerrado',
        status_negocio: 'perdido',
        motivo_perda: motivoSelecionado,
        motivo_fechamento: motivoSelecionado === 'Sem retorno' ? 'sem_retorno' : 'nao_evoluiu',
        encerrado_em: new Date().toISOString(),
      }).eq('identity_id', lead.identity_id)

      const { data: at } = await supabase.from('atendimentos').select('id').eq('identity_id', lead.identity_id).maybeSingle()
      if (at) await supabase.from('status_transitions').insert({ atendimento_id: at.id, status_anterior: ctx.status_negocio || 'em_atendimento', status_novo: 'perdido', operador_id: operadorId })

      if (socket) {
        socket.emit('lead_encerrado', { lead_id: lead.id, tipo: 'nao_fechou' })
        socket.emit('estado_painel_changed', { identity_id: lead.identity_id, lead_id: lead.id, estado_painel: 'encerrado' })
      }
      ctx.refetch()
      onLeadClosed()
    } catch (err: any) { showToastMsg(err.message, 'error') }
    finally { setLoading(false); setShowMotivoPopup(false) }
  }

  // ── Reengajar (encerrado → em_atendimento) ──
  async function handleReengajar() {
    if (!operadorId || !lead) return; setLoading(true)
    try {
      await supabase.from('atendimentos').update({
        estado_painel: 'em_atendimento',
        destino: 'backoffice',
        status_negocio: 'aguardando_agendamento',
        prazo_proxima_acao: calcularPrazo('aguardando_agendamento').toISOString(),
        motivo_perda: null,
        encerrado_em: null,
      }).eq('identity_id', lead.identity_id)

      const { data: at } = await supabase.from('atendimentos').select('id').eq('identity_id', lead.identity_id).maybeSingle()
      if (at) await supabase.from('status_transitions').insert({ atendimento_id: at.id, status_anterior: ctx.status_negocio || 'encerrado', status_novo: 'aguardando_agendamento', operador_id: operadorId })

      if (socket) socket.emit('estado_painel_changed', { identity_id: lead.identity_id, lead_id: lead.id, estado_painel: 'em_atendimento' })
      showToastMsg('Lead reengajado')
      ctx.refetch()
    } catch (err: any) { showToastMsg(err.message || 'Erro', 'error') }
    finally { setLoading(false) }
  }

  // ── Novo atendimento (cliente → triagem) ──
  async function handleNovoAtendimento() {
    if (!operadorId || !lead) return; setLoading(true)
    try {
      // Increment ciclo and reset state — same record, new cycle
      const { data: current } = await supabase
        .from('atendimentos')
        .select('ciclo')
        .eq('identity_id', lead.identity_id)
        .maybeSingle()

      await supabase.from('atendimentos').update({
        estado_painel: 'triagem',
        status_negocio: null,
        destino: null,
        motivo_perda: null,
        encerrado_em: null,
        classificacao_tratamento_tipo: null,
        classificacao_tratamento_detalhe: null,
        motivo_id: null,
        categoria_id: null,
        subcategoria_id: null,
        observacao: null,
        prazo_proxima_acao: null,
        ciclo: (current?.ciclo || 1) + 1,
        lead_id: lead.id,  // Update to current lead
        owner_id: operadorId,
      }).eq('identity_id', lead.identity_id)

      if (socket) socket.emit('estado_painel_changed', { identity_id: lead.identity_id, lead_id: lead.id, estado_painel: 'triagem' })
      showToastMsg('Novo atendimento iniciado')
      ctx.refetch()
    } catch (err: any) { showToastMsg(err.message || 'Erro', 'error') }
    finally { setLoading(false) }
  }

  // ── Identity search ──
  async function searchIdentities(q: string) { if (!q.trim()) { setIdentityResults([]); return }; const { data } = await supabase.from('identities').select('id, nome, telefone').or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`).limit(10); setIdentityResults(data || []) }

  // ── Fechamento com valor obrigatório ──
  async function handleFechamento() {
    if (!operadorId || !lead?.identity_id || !valorContrato) return
    setLoading(true)
    try {
      const statusAnterior = ctx.status_negocio

      await supabase.from('atendimentos').update({
        status_negocio: 'fechado',
        estado_painel: 'cliente',
        valor_contrato: parseFloat(valorContrato) || 0,
        valor_entrada: parseFloat(valorEntrada) || 0,
        percentual_exito: parseFloat(percentualExito) || 0,
        tipo_honorario: tipoHonorario,
        status_pagamento: parseFloat(valorEntrada) > 0 ? 'pendente' : 'nao_aplicavel',
        forma_pagamento: parseFloat(valorEntrada) > 0 ? formaPagamento : null,
        encerrado_em: new Date().toISOString(),
      }).eq('identity_id', lead.identity_id)

      const { data: at } = await supabase.from('atendimentos').select('id').eq('identity_id', lead.identity_id).maybeSingle()
      if (at) {
        await supabase.from('status_transitions').insert({
          atendimento_id: at.id,
          status_anterior: statusAnterior,
          status_novo: 'fechado',
          operador_id: operadorId,
        })
      }

      if (socket) {
        socket.emit('estado_painel_changed', { identity_id: lead.identity_id, lead_id: lead.id, estado_painel: 'cliente' })
        socket.emit('status_negocio_changed', { lead_id: lead.id, status_anterior: statusAnterior, status_novo: 'fechado' })
      }

      showToastMsg('Cliente convertido')
      setShowFechamentoModal(false)
      setValorContrato('')
      ctx.refetch()
    } catch (err: any) { showToastMsg(err.message || 'Erro', 'error') }
    finally { setLoading(false) }
  }

  // ── Marcar como pago ──
  async function handleMarcarPago() {
    if (!lead?.identity_id) return
    setLoading(true)
    try {
      await supabase.from('atendimentos').update({ status_pagamento: 'pago' }).eq('identity_id', lead.identity_id)
      showToastMsg('Pagamento confirmado')
      ctx.refetch()
    } catch (err: any) { showToastMsg(err.message || 'Erro', 'error') }
    finally { setLoading(false) }
  }

  async function handleAssumir() {
    if (!operadorId || !lead?.identity_id) return
    setLoading(true)
    try {
      await supabase.from('atendimentos').update({
        owner_id: operadorId,
      }).eq('identity_id', lead.identity_id)

      if (socket) {
        socket.emit('assignment_updated', {
          lead_id: lead.id,
          owner_id: operadorId,
          owner_name: 'Owner',
        })
      }

      showToastMsg('Caso assumido')
      ctx.refetch()
    } catch (err: any) { showToastMsg(err.message || 'Erro', 'error') }
    finally { setLoading(false) }
  }
  async function linkIdentity(targetId: string) { if (!lead) return; await supabase.from('leads').update({ identity_id: targetId }).eq('id', lead.id); const { data: updated } = await supabase.from('leads').select('*').eq('id', lead.id).maybeSingle(); if (updated) onLeadUpdate({ ...updated, corrigido: updated.corrigido ?? false }); setShowIdentitySearch(false) }

  // ── Derived state (triagem) ──
  const isBackoffice = treatment?.destino === 'backoffice'
  const isBadCall = tratamentoTipo === 'BadCall'
  const classificacaoJuridicaCompleta = !!areaId && !!categoriaId && !!subcategoriaId
  const podeConfirmar = !!treatment && !!operadorId && !loading && (
    isBadCall || treatment.destino === 'encerrado' || classificacaoJuridicaCompleta
  )
  const detalhes = tratamentoTipo ? (TREATMENT_DETALHES[tratamentoTipo as TreatmentTipo] || []) : []
  const areas = filterChildren(segmentNodes, null, 1)
  const categorias = filterChildren(segmentNodes, areaId, 2)
  const subcategorias = filterChildren(segmentNodes, categoriaId, 3)
  const scoreVisual = lead ? getScoreVisual(lead.score) : getScoreVisual(0)

  // ── Empty state ──
  if (!lead) {
    return (
      <div className="w-[360px] flex-shrink-0 flex flex-col bg-white border-l items-center justify-center text-center px-6">
        <p className="text-sm text-gray-400">Nenhum lead selecionado</p>
      </div>
    )
  }

  return (
    <div className="w-[360px] flex-shrink-0 flex flex-col h-full border-l bg-white">

      {/* ═══ HEADER — Estado + Responsável ═══ */}
      {mode.header && (
        <PainelHeader
          estadoPainel={ctx.estado_painel}
          ownerNome={ctx.owner_nome}
          isOwner={isOwner}
          leadId={lead.id}
          operadorId={operadorId}
          onDelegated={() => { showToastMsg('Lead delegado'); ctx.refetch() }}
        />
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ═══ IDENTIDADE + SCORE ═══ */}
        {mode.identidade && (
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Identificação</div>
              <div className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border", scoreVisual.bg)}>
                <span className={scoreVisual.color}>{scoreVisual.icon} {lead.score}/10 {scoreVisual.label}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-300 uppercase block mb-0.5">Nome</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} onBlur={saveName} disabled={!isOwner}
                className="w-full border-b border-gray-100 pb-1 text-sm font-bold text-gray-900 bg-transparent focus:border-blue-600 focus:outline-none disabled:opacity-50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-300 uppercase block mb-0.5">
                {lead.telefone ? 'Telefone' : 'Telefone (Usuário Telegram)'}
              </label>
              <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} onBlur={savePhone} disabled={!isOwner}
                placeholder={lead.channel_user_id ? `ID: ${lead.channel_user_id.slice(0, 12)}...` : 'Não informado'}
                className="w-full border-b border-gray-100 pb-1 text-sm text-gray-900 bg-transparent focus:border-blue-600 focus:outline-none placeholder:text-gray-300 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-300 uppercase block mb-0.5">E-mail</label>
              <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} onBlur={saveEmail} disabled={!isOwner}
                placeholder="email@exemplo.com" className="w-full border-b border-gray-100 pb-1 text-sm text-gray-900 bg-transparent focus:border-blue-600 focus:outline-none placeholder:text-gray-200 disabled:opacity-50" />
            </div>
            {/* Data entrada + ciclo */}
            <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
              <div>
                <span className="text-[9px] text-gray-300 uppercase block">Entrada</span>
                <span className="text-xs font-medium text-gray-600">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {ctx.estado_painel && (
                <div>
                  <span className="text-[9px] text-gray-300 uppercase block">Ciclo</span>
                  <span className="text-xs font-medium text-gray-600">{ctx.ciclo || 1}</span>
                </div>
              )}
              <div>
                <span className="text-[9px] text-gray-300 uppercase block">Canal</span>
                <span className="text-xs font-medium text-gray-600">{lead.canal_origem || '—'}</span>
              </div>
            </div>
            <button onClick={() => setShowIdentitySearch(!showIdentitySearch)} className="w-full text-center text-[10px] text-blue-600 font-bold uppercase py-2 bg-blue-50/30 rounded-lg border border-blue-50 hover:bg-blue-50">Vincular identidade</button>
            {showIdentitySearch && (
              <div className="space-y-2">
                <input value={identityQuery} onChange={e => { setIdentityQuery(e.target.value); searchIdentities(e.target.value) }} placeholder="Buscar..." className="w-full border rounded-lg px-3 py-2 text-xs" />
                {identityResults.map(id => (
                  <button key={id.id} onClick={() => linkIdentity(id.id)} className="w-full text-left px-3 py-2 rounded-lg text-xs border hover:bg-blue-50">
                    <span className="font-bold">{id.nome || 'Sem nome'}</span>{id.telefone && <span className="text-gray-400 ml-2">{id.telefone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ INTENÇÃO DO CLIENTE (triagem only) ═══ */}
        {mode.intencao && (
          <div className="p-4 border-b">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">O que o cliente quer</div>
            <div className="text-sm font-semibold text-gray-900">{getIntencaoAtual(lead as any)}</div>
            <div className="text-xs text-gray-400 mt-1">{lead.canal_origem || 'WhatsApp'} • {lead.area_bot || lead.area || '—'}</div>
          </div>
        )}

        {/* ═══ CLASSIFICAÇÃO JURÍDICA (triagem only) ═══ */}
        {mode.classJuridica && (
          <div className="p-4 border-b space-y-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Classificação jurídica</div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Área do caso</label>
              <select value={areaId || ''} onChange={e => { setAreaId(e.target.value || null); setCategoriaId(null); setSubcategoriaId(null) }} disabled={!isOwner}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium disabled:opacity-40">
                <option value="">Selecionar área...</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Tipo do problema</label>
              <select value={categoriaId || ''} onChange={e => { setCategoriaId(e.target.value || null); setSubcategoriaId(null) }} disabled={!areaId || !isOwner}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium disabled:opacity-40">
                <option value="">Selecionar tipo...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Detalhe do problema</label>
              <select value={subcategoriaId || ''} onChange={e => setSubcategoriaId(e.target.value || null)} disabled={!categoriaId || !isOwner}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium disabled:opacity-40">
                <option value="">Selecionar detalhe...</option>
                {subcategorias.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            {isBackoffice && !classificacaoJuridicaCompleta && treatment && (
              <p className="text-[10px] text-orange-500 font-medium">⚠ Obrigatória para backoffice</p>
            )}
          </div>
        )}

        {/* ═══ DOSSIÊ (always visible) ═══ */}
        {mode.dossie && (
          <div className="p-4 border-b space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Dossiê</div>
              {notaSalva && <span className="text-[10px] text-green-500 animate-pulse">Salvo</span>}
            </div>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} disabled={!isOwner}
              onBlur={() => { if (observacao.trim()) handleSaveNota() }}
              placeholder="O que você entendeu do caso..."
              className="w-full border rounded-lg p-3 text-sm resize-none min-h-[70px] placeholder:text-gray-300 disabled:opacity-50" />
            {notas.length > 0 && (
              <div className="space-y-1 max-h-16 overflow-y-auto">
                {notas.map(n => (
                  <div key={n.id} className="text-xs bg-gray-50 rounded px-2 py-1">
                    <span className="text-gray-700">{n.conteudo}</span>
                    <span className="text-gray-300 ml-2">{new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ TRATAMENTO (triagem only) ═══ */}
        {mode.tratamento && (
          <div className="p-4 border-b space-y-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tratamento</div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Tipo</label>
              <select value={tratamentoTipo} onChange={e => { setTratamentoTipo(e.target.value); setTratamentoDetalhe('') }} disabled={!isOwner}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium disabled:opacity-40">
                <option value="">Selecionar...</option>
                {TREATMENT_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Detalhe</label>
              <select value={tratamentoDetalhe} onChange={e => setTratamentoDetalhe(e.target.value)} disabled={!tratamentoTipo || !isOwner}
                className="w-full border border-blue-200 bg-blue-50/30 rounded-lg p-2.5 text-sm font-semibold text-blue-800 disabled:opacity-40">
                <option value="">Selecionar...</option>
                {detalhes.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {/* RESULTADO */}
            {mode.resultado && treatment && (
              <div className={cn("rounded-lg p-3 space-y-1.5 border", isBackoffice ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200")}>
                <div className="text-xs flex justify-between">
                  <span className="text-gray-400">Encaminhamento:</span>
                  <span className="font-bold text-gray-900">{isBackoffice ? '→ Backoffice' : '→ Encerrado'}</span>
                </div>
                <div className="text-xs flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="font-medium">{treatment.status_negocio.replace(/_/g, ' ')}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ STATUS ATUAL (em_atendimento) ═══ */}
        {mode.statusAtual && (
          <div className="p-4 border-b space-y-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status atual</div>
            {(() => {
              const prazoVencido = ctx.prazo_proxima_acao && new Date(ctx.prazo_proxima_acao).getTime() < Date.now()
              const nextAction = getNextActionLabel(ctx.status_negocio)
              const isClientWaiting = lead?.ultima_msg_de === 'operador'
              return (
                <div className={cn(
                  "border rounded-lg p-3 space-y-2",
                  prazoVencido ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"
                )}>
                  <div className="flex items-center justify-between">
                    <div className={cn("text-sm font-bold", prazoVencido ? "text-red-900" : "text-blue-900")}>
                      {formatStatusNegocio(ctx.status_negocio)}
                    </div>
                    {/* Responsibility indicator */}
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                      isClientWaiting
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                    )}>
                      {isClientWaiting ? '⏳ Aguardando cliente' : '👉 Sua ação'}
                    </span>
                  </div>
                  {ctx.prazo_proxima_acao && (
                    <div className={cn("text-xs", prazoVencido ? "text-red-700" : "text-blue-700")}>
                      <span className="text-gray-400">Prazo: </span>
                      <span className="font-medium">{getPrazoLabel(ctx.prazo_proxima_acao)}</span>
                    </div>
                  )}
                  {/* Dominant CTA — next action highlighted */}
                  {nextAction && !isClientWaiting && (
                    <div className={cn(
                      "text-sm font-black mt-1 px-3 py-2 rounded-lg text-center",
                      prazoVencido
                        ? "bg-red-600 text-white"
                        : "bg-blue-600 text-white"
                    )}>
                      🔴 {nextAction}
                    </div>
                  )}
                  {nextAction && isClientWaiting && (
                    <div className="text-xs text-gray-500 font-medium mt-1">
                      Próximo quando cliente responder: {nextAction}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* ═══ BOTÕES DE AÇÃO (em_atendimento) ═══ */}
        {mode.botoesAcao && (
          <div className="p-4 border-b space-y-2">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Próxima etapa</div>

            {/* Dynamic buttons based on current status_negocio */}
            {ctx.status_negocio === 'aguardando_agendamento' && (
              <button onClick={() => handleAvancarStatus('reuniao_agendada')} disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40">
                Reunião agendada
              </button>
            )}

            {ctx.status_negocio === 'reuniao_agendada' && (
              <button onClick={() => handleAvancarStatus('aguardando_proposta')} disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40">
                Enviar proposta
              </button>
            )}

            {ctx.status_negocio === 'aguardando_proposta' && (
              <button onClick={() => handleAvancarStatus('negociacao')} disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40">
                Iniciar negociação
              </button>
            )}

            {(ctx.status_negocio === 'negociacao' || ctx.status_negocio === 'aguardando_proposta' || ctx.status_negocio === 'reuniao_agendada') && (
              <button onClick={() => canSeeFinanceiro ? setShowFechamentoModal(true) : showToastMsg('Apenas o responsável pode fechar contratos', 'error')} disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40">
                Fechar contrato
              </button>
            )}

            {/* Perdido — always available in em_atendimento */}
            <button onClick={() => setShowMotivoPopup(true)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              Perdido
            </button>

            {/* Quick jump — operator can go to any stage */}
            <details className="mt-2">
              <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">Outras ações</summary>
              <div className="mt-2 space-y-1">
                {ctx.status_negocio !== 'aguardando_agendamento' && (
                  <button onClick={() => handleAvancarStatus('aguardando_agendamento')} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded">← Voltar para agendamento</button>
                )}
                {ctx.status_negocio !== 'reuniao_agendada' && (
                  <button onClick={() => handleAvancarStatus('reuniao_agendada')} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded">Marcar reunião agendada</button>
                )}
                {ctx.status_negocio !== 'aguardando_proposta' && (
                  <button onClick={() => handleAvancarStatus('aguardando_proposta')} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded">Aguardando proposta</button>
                )}
                {ctx.status_negocio !== 'negociacao' && (
                  <button onClick={() => handleAvancarStatus('negociacao')} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded">Em negociação</button>
                )}
              </div>
            </details>
          </div>
        )}

        {/* ═══ CONTRATO (cliente) ═══ */}
        {mode.contrato && (
          canSeeFinanceiro ? (
          <div className="p-4 border-b space-y-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Financeiro</div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">Entrada</span>
                <span className="text-sm font-black text-gray-900">
                  {ctx.valor_contrato && Number(ctx.valor_contrato) > 0 ? `R$ ${Number(ctx.valor_contrato).toLocaleString('pt-BR')}` : 'Não aplicável'}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">Êxito</span>
                <span className="text-sm font-bold text-green-700">
                  {ctx.percentual_exito ? `${ctx.percentual_exito}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">Pagamento</span>
                <span className={cn('text-xs font-bold uppercase px-2 py-0.5 rounded-full',
                  ctx.status_pagamento === 'pago' ? 'bg-green-100 text-green-600' :
                  ctx.status_pagamento === 'atraso' ? 'bg-red-100 text-red-600' :
                  ctx.status_pagamento === 'nao_aplicavel' ? 'bg-gray-100 text-gray-400' :
                  'bg-yellow-100 text-yellow-600'
                )}>
                  {ctx.status_pagamento === 'nao_aplicavel' ? 'Êxito puro' : ctx.status_pagamento || 'Pendente'}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">Fechamento</span>
                <span className="text-xs font-medium text-gray-600">
                  {ctx.encerrado_em ? new Date(ctx.encerrado_em).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </div>
            {ctx.status_pagamento === 'pendente' && (
              <button onClick={handleMarcarPago} disabled={loading}
                className="w-full py-2 rounded-lg text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-40">
                Marcar como pago
              </button>
            )}
          </div>
          ) : (
            <div className="p-4 border-b">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Financeiro</div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-400">Entrada</span>
                  <span className="text-sm font-black text-gray-300">R$ •••••</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-400">Êxito</span>
                  <span className="text-sm font-bold text-gray-300">••%</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-400">Pagamento</span>
                  <span className="text-xs font-bold text-gray-300">••••••</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-300 text-center mt-1">🔒 Visível apenas para o responsável</p>
            </div>
          )
        )}

        {/* ═══ MOTIVO ENCERRAMENTO (encerrado) ═══ */}
        {mode.motivoEncerramento && (
          <div className="p-4 border-b space-y-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Motivo do encerramento</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-700">
                {ctx.motivo_perda || formatStatusNegocio(ctx.status_negocio)}
              </div>
            </div>
          </div>
        )}

        {/* ═══ HISTÓRICO ═══ */}
        {historico.length > 0 && (
          <div className="p-4 border-b space-y-2">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Histórico</div>
            {historico.map(h => (
              <div key={h.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium text-gray-700">{h.classificacao_tratamento_tipo || '—'}</span>
                  <span className="text-gray-400 ml-1">→ {h.destino || '—'}</span>
                </div>
                <span className="text-gray-300">{new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ FOOTER — Botões fixos no bottom ═══ */}
      <div className="p-4 border-t bg-white space-y-2 mt-auto">

        {/* Botão Confirmação (triagem) */}
        {mode.botaoConfirmacao && (
          <>
            {treatment ? (
              <button onClick={handleConfirmar} disabled={!podeConfirmar}
                className={cn("w-full py-3 rounded-xl font-semibold text-sm transition-all",
                  isBackoffice ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-800 text-white hover:bg-gray-900',
                  !podeConfirmar && 'opacity-40 cursor-not-allowed'
                )}>
                {loading ? 'Processando...' : 'Confirmar encaminhamento'}
              </button>
            ) : (
              <button disabled className="w-full py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-400 cursor-not-allowed">
                Selecione o tratamento
              </button>
            )}
            {treatment && isBackoffice && (
              <button onClick={() => setShowMotivoPopup(true)} className="w-full text-xs border rounded-lg py-2 text-gray-600 hover:bg-gray-50">Não fechou</button>
            )}
          </>
        )}

        {/* Botão Reengajar (encerrado) */}
        {mode.botaoReengajar && (
          <button onClick={handleReengajar} disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-all">
            {loading ? 'Processando...' : 'Reengajar'}
          </button>
        )}

        {/* Botão Novo Atendimento (cliente) */}
        {mode.botaoNovoAtendimento && (
          <button onClick={handleNovoAtendimento} disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-all">
            {loading ? 'Processando...' : 'Iniciar novo atendimento'}
          </button>
        )}

        {/* Botão Assumir (owner only) */}
        {canAssumir && (
          <button onClick={handleAssumir} disabled={loading}
            className="w-full py-2 rounded-lg text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors disabled:opacity-40">
            Assumir caso
          </button>
        )}
      </div>

      {/* MODAL — Fechamento com valor */}
      {showFechamentoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFechamentoModal(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Fechar contrato</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Tipo de honorário</label>
                <div className="flex gap-2">
                  <button onClick={() => setTipoHonorario('entrada_exito')} className={cn('flex-1 py-2 rounded-lg text-xs font-bold border', tipoHonorario === 'entrada_exito' ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500')}>Entrada + Êxito</button>
                  <button onClick={() => { setTipoHonorario('somente_exito'); setValorEntrada('0') }} className={cn('flex-1 py-2 rounded-lg text-xs font-bold border', tipoHonorario === 'somente_exito' ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500')}>Somente Êxito</button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Valor entrada (R$)</label>
                <input type="number" value={valorEntrada} onChange={e => setValorEntrada(e.target.value)} placeholder="0"
                  disabled={tipoHonorario === 'somente_exito'}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium disabled:opacity-40" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Percentual êxito (%)</label>
                <input type="number" value={percentualExito} onChange={e => setPercentualExito(e.target.value)} placeholder="30"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium" />
              </div>
              {parseFloat(valorEntrada) > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Forma de pagamento</label>
                  <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium">
                    <option value="pix">PIX</option>
                    <option value="boleto">Boleto</option>
                    <option value="cartao">Cartão</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowFechamentoModal(false)} className="px-4 py-2 text-sm text-gray-400">Cancelar</button>
                <button onClick={handleFechamento} disabled={loading}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-40">
                  {loading ? 'Salvando...' : 'Confirmar fechamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL — Motivo perda */}
      {showMotivoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMotivoPopup(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Motivo da perda</h3>
            <div className="space-y-2">
              {MOTIVOS_PERDA.map(m => (
                <button key={m} onClick={() => setMotivoSelecionado(m)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm border", motivoSelecionado === m ? 'border-blue-400 bg-blue-50 text-blue-600' : 'hover:bg-gray-50')}>{m}</button>
              ))}
              <textarea value={motivoObs} onChange={e => setMotivoObs(e.target.value)} rows={2} placeholder="Observação (opcional)" className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowMotivoPopup(false)} className="px-4 py-2 text-sm text-gray-400">Cancelar</button>
                <button onClick={handleNaoFechou} disabled={!motivoSelecionado || loading} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-40">{loading ? 'Salvando...' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn("fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium", toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white')}>
          {toast.message}
          {toast.type === 'error' && <button onClick={() => setToast(null)} className="ml-3">✕</button>}
        </div>
      )}
    </div>
  )
}
