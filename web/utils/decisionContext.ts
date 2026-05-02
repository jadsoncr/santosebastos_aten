/**
 * decisionContext.ts — Camada de decisão unificada do TORIS.
 *
 * Consolida todas as automações (#1 prioridade, #2 checklist, #5 inatividade)
 * em uma única função que retorna o contexto completo de decisão para um caso.
 *
 * Zero side effects. Reutiliza lógica existente. Testável em isolamento.
 */

import { deriveGlobalPriority, isGlobalCritical, type PriorityResult } from './globalPriority'
import { detectInactivity, type InactivityNudge } from './inactivityNudge'
import { getPrereq, getProximaAcao, resolveStatus, getEtapaLabel, getResponsavel } from './journeyModel'

// ── Tipos ──

export interface DecisionContext {
  /** Prioridade calculada (nível 0-5) */
  priority: PriorityResult
  /** Se é crítico (precisa ação imediata) */
  isCritical: boolean
  /** Motivo da prioridade em texto legível */
  priorityReason: string

  /** Se existe pré-requisito para avançar */
  hasPrereq: boolean
  /** Pergunta do pré-requisito (null se não tem) */
  prereqQuestion: string | null
  /** Key do pré-requisito para persistência */
  prereqKey: string | null

  /** Nudge de inatividade (null se dentro do prazo) */
  inactivity: InactivityNudge | null
  /** Se o caso está parado (24h+ sem ação) */
  isStale: boolean

  /** Próxima ação sugerida pelo modelo */
  nextAction: string | null
  /** Etapa atual legível */
  currentStage: string | null
  /** Responsável atual (interno/cliente) */
  responsavel: 'interno' | 'cliente'

  /** Resumo executivo — frase única que descreve o estado do caso */
  summary: string
}

export interface DecisionInput {
  ultima_msg_em: string | null
  ultima_msg_de: string | null
  created_at: string
  estado_painel: string | null
  status_negocio: string | null
  prazo_proxima_acao: string | null
}

// ── Função principal ──

/**
 * Retorna o contexto completo de decisão para um caso.
 * Unifica prioridade + checklist + inatividade + próxima ação.
 *
 * Uso: sidebar (recomendação), cockpit (nudge + ação), futuro (pré-preenchimento).
 */
export function getDecisionContext(input: DecisionInput, now?: number): DecisionContext {
  const currentTime = now ?? Date.now()

  // ── 1. Prioridade ──
  const priority = deriveGlobalPriority({
    ultima_msg_em: input.ultima_msg_em,
    ultima_msg_de: input.ultima_msg_de,
    created_at: input.created_at,
    estado_painel: input.estado_painel,
    prazo_proxima_acao: input.prazo_proxima_acao,
    now: currentTime,
  })
  const isCritical = isGlobalCritical(priority)
  const priorityReason = derivePriorityReason(input, priority, currentTime)

  // ── 2. Checklist (prereq) ──
  const resolved = input.status_negocio ? resolveStatus(input.status_negocio) : null
  const prereq = resolved ? getPrereq(resolved) : null
  const hasPrereq = prereq !== null
  const prereqQuestion = prereq?.question ?? null
  const prereqKey = prereq?.key ?? null

  // ── 3. Inatividade ──
  const inactivity = detectInactivity({
    prazo_proxima_acao: input.prazo_proxima_acao,
    status_negocio: input.status_negocio,
    ultima_msg_de: input.ultima_msg_de,
    estado_painel: input.estado_painel,
  }, currentTime)
  const isStale = inactivity !== null

  // ── 4. Próxima ação + etapa ──
  const nextAction = resolved ? getProximaAcao(resolved) : null
  const currentStage = resolved ? getEtapaLabel(resolved) : null
  const responsavel = getResponsavel(input.status_negocio, input.ultima_msg_de)

  // ── 5. Resumo executivo ──
  const summary = buildSummary({ isCritical, isStale, inactivity, nextAction, responsavel, currentStage })

  return {
    priority,
    isCritical,
    priorityReason,
    hasPrereq,
    prereqQuestion,
    prereqKey,
    inactivity,
    isStale,
    nextAction,
    currentStage,
    responsavel,
    summary,
  }
}

// ── Helpers internos ──

function derivePriorityReason(input: DecisionInput, priority: PriorityResult, now: number): string {
  if (priority.level === 0) return 'Prazo vencido'
  if (input.ultima_msg_de === 'cliente' && input.ultima_msg_em) {
    const diffMin = Math.floor((now - new Date(input.ultima_msg_em).getTime()) / 60000)
    if (diffMin < 5) return 'Acabou de responder'
    if (diffMin < 30) return `Respondeu há ${diffMin}min`
    if (diffMin < 60) return 'Aguardando há mais de 30min'
    return `Sem resposta há ${Math.floor(diffMin / 60)}h`
  }
  if (priority.level <= 2) return 'Aguardando ação'
  return 'Dentro do prazo'
}

function buildSummary(ctx: {
  isCritical: boolean
  isStale: boolean
  inactivity: InactivityNudge | null
  nextAction: string | null
  responsavel: 'interno' | 'cliente'
  currentStage: string | null
}): string {
  if (ctx.isCritical && ctx.isStale) {
    return `⚠️ Caso parado ${ctx.inactivity?.message?.toLowerCase() || ''} — ${ctx.nextAction || 'ação necessária'}`
  }
  if (ctx.isCritical) {
    return `🔴 Ação imediata: ${ctx.nextAction || 'responder agora'}`
  }
  if (ctx.isStale) {
    return `⏰ ${ctx.inactivity?.message || 'Caso parado'} — ${ctx.nextAction || 'verificar'}`
  }
  if (ctx.responsavel === 'cliente') {
    return `⏳ Aguardando resposta externa${ctx.currentStage ? ` (${ctx.currentStage})` : ''}`
  }
  if (ctx.nextAction) {
    return `👉 Próximo: ${ctx.nextAction}`
  }
  return '✓ Em dia'
}
