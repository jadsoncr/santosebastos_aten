/**
 * journeyModel.ts — Modelo de Jornada + SLA do escritório.
 *
 * Fonte única de verdade para etapas, SLAs, ordem e labels.
 * Tudo derivado de JOURNEY_STAGES — nunca hardcoded em componentes.
 *
 * Zero side effects. Zero imports externos. Testável em isolamento.
 */

// ── Tipos ──

export interface JourneyStage {
  /** Identificador (= status_negocio) */
  id: string
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
  /** Responsável padrão da etapa */
  responsavel_default: 'interno' | 'cliente'
}

// ── JOURNEY_STAGES — Fonte única de verdade ──

export const JOURNEY_STAGES: Record<string, JourneyStage> = {
  analise_viabilidade: {
    id: 'analise_viabilidade', label: 'Análise de Viabilidade', descricao: 'Avaliar viabilidade jurídica do caso',
    slaDias: 1, ordem: 0, terminal: false, proximaAcao: 'Analisar viabilidade', responsavel_default: 'interno',
  },
  retorno_cliente: {
    id: 'retorno_cliente', label: 'Retorno ao Cliente', descricao: 'Retornar contato ao cliente com parecer',
    slaDias: 1, ordem: 1, terminal: false, proximaAcao: 'Retornar ao cliente', responsavel_default: 'interno',
  },
  solicitacao_documentos: {
    id: 'solicitacao_documentos', label: 'Solicitação de Documentos', descricao: 'Solicitar documentos necessários ao cliente',
    slaDias: 1, ordem: 2, terminal: false, proximaAcao: 'Solicitar documentos', responsavel_default: 'interno',
  },
  envio_contrato: {
    id: 'envio_contrato', label: 'Envio de Contrato', descricao: 'Enviar contrato de honorários ao cliente',
    slaDias: 1, ordem: 3, terminal: false, proximaAcao: 'Enviar contrato', responsavel_default: 'interno',
  },
  esclarecimento_duvidas: {
    id: 'esclarecimento_duvidas', label: 'Esclarecimento de Dúvidas', descricao: 'Esclarecer dúvidas do cliente sobre contrato/processo',
    slaDias: 1, ordem: 4, terminal: false, proximaAcao: 'Esclarecer dúvidas', responsavel_default: 'cliente',
  },
  recebimento_documentos: {
    id: 'recebimento_documentos', label: 'Recebimento de Documentos', descricao: 'Aguardar recebimento dos documentos do cliente',
    slaDias: 3, ordem: 5, terminal: false, proximaAcao: 'Cobrar documentos', responsavel_default: 'cliente',
  },
  cadastro_interno: {
    id: 'cadastro_interno', label: 'Cadastro Interno', descricao: 'Cadastrar caso no sistema interno do escritório',
    slaDias: 1, ordem: 6, terminal: false, proximaAcao: 'Cadastrar internamente', responsavel_default: 'interno',
  },
  confeccao_inicial: {
    id: 'confeccao_inicial', label: 'Confecção Inicial', descricao: 'Elaborar peça inicial do processo',
    slaDias: 7, ordem: 7, terminal: false, proximaAcao: 'Elaborar peça inicial', responsavel_default: 'interno',
  },
  distribuicao: {
    id: 'distribuicao', label: 'Distribuição', descricao: 'Distribuir processo no tribunal',
    slaDias: 7, ordem: 8, terminal: false, proximaAcao: 'Distribuir processo', responsavel_default: 'interno',
  },
  fechado: {
    id: 'fechado', label: 'Fechado', descricao: 'Caso concluído com sucesso',
    slaDias: 0, ordem: 9, terminal: true, proximaAcao: null, responsavel_default: 'interno',
  },
  perdido: {
    id: 'perdido', label: 'Perdido', descricao: 'Caso não evoluiu ou cliente desistiu',
    slaDias: 0, ordem: 10, terminal: true, proximaAcao: null, responsavel_default: 'interno',
  },
  resolvido: {
    id: 'resolvido', label: 'Resolvido', descricao: 'Demanda resolvida sem necessidade de processo',
    slaDias: 0, ordem: 11, terminal: true, proximaAcao: null, responsavel_default: 'interno',
  },
}

// ── Legacy status → new status mapper (backward compatibility) ──

export const LEGACY_STATUS_MAP: Record<string, string> = {
  aguardando_agendamento: 'analise_viabilidade',
  reuniao_agendada: 'retorno_cliente',
  aguardando_proposta: 'envio_contrato',
  negociacao: 'esclarecimento_duvidas',
  aguardando_contrato: 'recebimento_documentos',
}

/**
 * Resolves a status_negocio to its canonical form.
 * Maps legacy values to new ones. Returns as-is if already canonical.
 */
export function resolveStatus(status: string): string {
  return LEGACY_STATUS_MAP[status] || status
}

/**
 * Hybrid responsibility: uses ultima_msg_de as override, falls back to stage default.
 * Rule: if operator sent last message → waiting for client. If client sent → operator's turn.
 */
export function getResponsavel(
  statusNegocio: string | null,
  ultimaMsgDe: string | null
): 'interno' | 'cliente' {
  // Message-based override (real-time truth)
  if (ultimaMsgDe === 'operador') return 'cliente'
  if (ultimaMsgDe === 'cliente') return 'interno'
  // Fall back to stage default
  if (statusNegocio) {
    const resolved = resolveStatus(statusNegocio)
    const stage = JOURNEY_STAGES[resolved]
    if (stage) return stage.responsavel_default
  }
  return 'interno'
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
  const resolved = resolveStatus(statusNegocio)
  return SLA_POR_ETAPA[resolved] ?? 7
}

/**
 * Calcula a data de prazo a partir de uma data base + SLA da etapa.
 * Usa `now` injetável para testes determinísticos.
 */
export function calcularPrazoEtapa(statusNegocio: string, now?: number): Date {
  const currentTime = now ?? Date.now()
  const resolved = resolveStatus(statusNegocio)
  const dias = SLA_POR_ETAPA[resolved] ?? 7
  return new Date(currentTime + dias * 24 * 60 * 60 * 1000)
}

/**
 * Retorna o stage completo para um status_negocio.
 * Retorna null se não encontrado.
 */
export function getStage(statusNegocio: string): JourneyStage | null {
  const resolved = resolveStatus(statusNegocio)
  return JOURNEY_STAGES[resolved] ?? null
}

/**
 * Retorna a próxima ação imperativa para o operador.
 * Retorna null se etapa terminal ou não encontrada.
 */
export function getProximaAcao(statusNegocio: string): string | null {
  const resolved = resolveStatus(statusNegocio)
  return JOURNEY_STAGES[resolved]?.proximaAcao ?? null
}

/**
 * Retorna o label legível de uma etapa.
 */
export function getEtapaLabel(statusNegocio: string): string {
  const resolved = resolveStatus(statusNegocio)
  return JOURNEY_STAGES[resolved]?.label ?? statusNegocio
}

/**
 * Retorna a ordem numérica de uma etapa (para progress bars).
 * Retorna -1 se não encontrada.
 */
export function getEtapaOrdem(statusNegocio: string): number {
  const resolved = resolveStatus(statusNegocio)
  return JOURNEY_STAGES[resolved]?.ordem ?? -1
}

/**
 * Calcula o progresso da jornada como percentual (0-100).
 * Baseado na ordem da etapa atual vs total de etapas ativas.
 */
export function calcularProgresso(statusNegocio: string): number {
  const resolved = resolveStatus(statusNegocio)
  const stage = JOURNEY_STAGES[resolved]
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


// ── Estado de Valor Jurídico ──

export type EstadoValor = 'indefinido' | 'estimado' | 'realizado'

/**
 * Retorna o label legível para o estado de valor.
 */
export function getEstadoValorLabel(estado: EstadoValor | null): string {
  switch (estado) {
    case 'estimado': return 'Estimativa interna (não vinculante)'
    case 'realizado': return 'Valor realizado'
    case 'indefinido':
    default: return 'Valor a ser definido'
  }
}

/**
 * Retorna a classe de cor Tailwind para o estado de valor.
 */
export function getEstadoValorColor(estado: EstadoValor | null): string {
  switch (estado) {
    case 'estimado': return 'text-yellow-600'
    case 'realizado': return 'text-green-600'
    case 'indefinido':
    default: return 'text-gray-400'
  }
}

/**
 * Retorna o ícone/badge para o estado de valor.
 */
export function getEstadoValorBadge(estado: EstadoValor | null): string {
  switch (estado) {
    case 'estimado': return '🟡'
    case 'realizado': return '🟢'
    case 'indefinido':
    default: return '⚪'
  }
}
