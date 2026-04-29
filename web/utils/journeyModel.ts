/**
 * journeyModel.ts — Modelo de Jornada + SLA do escritório.
 *
 * Fonte única de verdade para etapas, SLAs, ordem e labels.
 * Tudo derivado de JOURNEY_STAGES — nunca hardcoded em componentes.
 *
 * Zero side effects. Zero imports externos. Testável em isolamento.
 */

import type { StatusNegocio } from './resolveClassification'

// ── Tipos ──

export interface JourneyStage {
  /** Identificador (= status_negocio) */
  id: StatusNegocio
  /** Label legível */
  label: string
  /** Descrição curta da etapa */
  descricao: string
  /** SLA em dias corridos para completar esta etapa */
  slaDias: number
  /** Ordem na jornada (0 = primeira etapa) */
  ordem: number
  /** Se é etapa terminal (sem próxima ação) */
  terminal: boolean
  /** Próxima ação imperativa para o operador */
  proximaAcao: string | null
}

// ── JOURNEY_STAGES — Fonte única de verdade ──

export const JOURNEY_STAGES: Record<string, JourneyStage> = {
  aguardando_agendamento: {
    id: 'aguardando_agendamento',
    label: 'Aguardando Agendamento',
    descricao: 'Cliente aguarda agendamento de reunião',
    slaDias: 2,
    ordem: 0,
    terminal: false,
    proximaAcao: 'Agendar reunião',
  },
  reuniao_agendada: {
    id: 'reuniao_agendada',
    label: 'Reunião Agendada',
    descricao: 'Reunião marcada, aguardando realização',
    slaDias: 3,
    ordem: 1,
    terminal: false,
    proximaAcao: 'Enviar proposta',
  },
  aguardando_proposta: {
    id: 'aguardando_proposta',
    label: 'Aguardando Proposta',
    descricao: 'Cliente aguarda proposta de honorários',
    slaDias: 3,
    ordem: 2,
    terminal: false,
    proximaAcao: 'Iniciar negociação',
  },
  negociacao: {
    id: 'negociacao',
    label: 'Negociação',
    descricao: 'Proposta em negociação com o cliente',
    slaDias: 5,
    ordem: 3,
    terminal: false,
    proximaAcao: 'Gerar contrato',
  },
  aguardando_contrato: {
    id: 'aguardando_contrato',
    label: 'Aguardando Contrato',
    descricao: 'Contrato gerado, aguardando assinatura',
    slaDias: 7,
    ordem: 4,
    terminal: false,
    proximaAcao: 'Fechar contrato',
  },
  fechado: {
    id: 'fechado',
    label: 'Fechado',
    descricao: 'Contrato assinado, caso convertido',
    slaDias: 0,
    ordem: 5,
    terminal: true,
    proximaAcao: null,
  },
  perdido: {
    id: 'perdido',
    label: 'Perdido',
    descricao: 'Caso não evoluiu ou cliente desistiu',
    slaDias: 0,
    ordem: 6,
    terminal: true,
    proximaAcao: null,
  },
  resolvido: {
    id: 'resolvido',
    label: 'Resolvido',
    descricao: 'Demanda resolvida sem necessidade de contrato',
    slaDias: 0,
    ordem: 7,
    terminal: true,
    proximaAcao: null,
  },
}

// ── SLA_POR_ETAPA — Derivado de JOURNEY_STAGES ──

export const SLA_POR_ETAPA: Record<string, number> = Object.fromEntries(
  Object.entries(JOURNEY_STAGES).map(([key, stage]) => [key, stage.slaDias])
)

// ── Etapas ativas (não-terminais) em ordem ──

export const ETAPAS_ATIVAS: JourneyStage[] = Object.values(JOURNEY_STAGES)
  .filter(s => !s.terminal)
  .sort((a, b) => a.ordem - b.ordem)

// ── Funções puras ──

/**
 * Retorna o SLA em dias para uma etapa. Default 7 se não mapeada.
 */
export function getSlaDias(statusNegocio: string): number {
  return SLA_POR_ETAPA[statusNegocio] ?? 7
}

/**
 * Calcula a data de prazo a partir de uma data base + SLA da etapa.
 * Usa `now` injetável para testes determinísticos.
 */
export function calcularPrazoEtapa(statusNegocio: string, now?: number): Date {
  const currentTime = now ?? Date.now()
  const dias = getSlaDias(statusNegocio)
  return new Date(currentTime + dias * 24 * 60 * 60 * 1000)
}

/**
 * Retorna o stage completo para um status_negocio.
 * Retorna null se não encontrado.
 */
export function getStage(statusNegocio: string): JourneyStage | null {
  return JOURNEY_STAGES[statusNegocio] ?? null
}

/**
 * Retorna a próxima ação imperativa para o operador.
 * Retorna null se etapa terminal ou não encontrada.
 */
export function getProximaAcao(statusNegocio: string): string | null {
  return JOURNEY_STAGES[statusNegocio]?.proximaAcao ?? null
}

/**
 * Retorna o label legível de uma etapa.
 */
export function getEtapaLabel(statusNegocio: string): string {
  return JOURNEY_STAGES[statusNegocio]?.label ?? statusNegocio
}

/**
 * Retorna a ordem numérica de uma etapa (para progress bars).
 * Retorna -1 se não encontrada.
 */
export function getEtapaOrdem(statusNegocio: string): number {
  return JOURNEY_STAGES[statusNegocio]?.ordem ?? -1
}

/**
 * Calcula o progresso da jornada como percentual (0-100).
 * Baseado na ordem da etapa atual vs total de etapas ativas.
 */
export function calcularProgresso(statusNegocio: string): number {
  const stage = JOURNEY_STAGES[statusNegocio]
  if (!stage) return 0
  if (stage.terminal) return 100
  const totalAtivas = ETAPAS_ATIVAS.length
  if (totalAtivas === 0) return 0
  return Math.round((stage.ordem / totalAtivas) * 100)
}

/**
 * Verifica se o SLA de uma etapa está vencido.
 * Compara prazo_proxima_acao com o momento atual.
 */
export function isSlaVencido(prazoProximaAcao: string | null, now?: number): boolean {
  if (!prazoProximaAcao) return false
  const currentTime = now ?? Date.now()
  return new Date(prazoProximaAcao).getTime() < currentTime
}

/**
 * Calcula dias restantes até o prazo. Negativo = atrasado.
 */
export function diasRestantes(prazoProximaAcao: string | null, now?: number): number | null {
  if (!prazoProximaAcao) return null
  const currentTime = now ?? Date.now()
  const diffMs = new Date(prazoProximaAcao).getTime() - currentTime
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}
