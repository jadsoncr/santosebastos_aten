import type { StatusNegocio } from './resolveClassification'
import { resolveStatus } from './journeyModel'

// ═══════════════════════════════════════════════════════════════
// ACTION_MAP — FONTE ÚNICA DE VERDADE
// Toda lógica de transição, ação e campos deriva daqui.
// ═══════════════════════════════════════════════════════════════

export interface ActionConfig {
  action: string
  label: string
  descricao: string
  targetStatus: StatusNegocio
  preview: string
  fields: string[]
}

/** Mapa único: status_atual → ação principal + target + campos */
export const ACTION_MAP: Record<string, ActionConfig> = {
  analise_viabilidade: {
    action: 'retornar_cliente',
    label: 'Retornar ao cliente',
    descricao: 'Retornar contato com parecer de viabilidade',
    targetStatus: 'retorno_cliente',
    preview: 'Avança para Retorno ao Cliente',
    fields: [],
  },
  retorno_cliente: {
    action: 'solicitar_docs',
    label: 'Solicitar documentos',
    descricao: 'Solicitar documentos necessários',
    targetStatus: 'solicitacao_documentos',
    preview: 'Avança para Solicitação de Documentos',
    fields: [],
  },
  solicitacao_documentos: {
    action: 'enviar_contrato',
    label: 'Enviar contrato',
    descricao: 'Enviar contrato de honorários',
    targetStatus: 'envio_contrato',
    preview: 'Avança para Envio de Contrato',
    fields: [],
  },
  envio_contrato: {
    action: 'esclarecer_duvidas',
    label: 'Esclarecer dúvidas',
    descricao: 'Esclarecer dúvidas sobre contrato',
    targetStatus: 'esclarecimento_duvidas',
    preview: 'Avança para Esclarecimento de Dúvidas',
    fields: [],
  },
  esclarecimento_duvidas: {
    action: 'receber_docs',
    label: 'Receber documentos',
    descricao: 'Aguardar documentos do cliente',
    targetStatus: 'recebimento_documentos',
    preview: 'Avança para Recebimento de Documentos',
    fields: [],
  },
  recebimento_documentos: {
    action: 'cadastrar',
    label: 'Cadastrar internamente',
    descricao: 'Cadastrar caso no sistema interno',
    targetStatus: 'cadastro_interno',
    preview: 'Avança para Cadastro Interno',
    fields: [],
  },
  cadastro_interno: {
    action: 'confeccionar',
    label: 'Elaborar peça inicial',
    descricao: 'Elaborar peça inicial do processo',
    targetStatus: 'confeccao_inicial',
    preview: 'Avança para Confecção Inicial',
    fields: [],
  },
  confeccao_inicial: {
    action: 'distribuir',
    label: 'Distribuir processo',
    descricao: 'Distribuir processo no tribunal',
    targetStatus: 'distribuicao',
    preview: 'Avança para Distribuição',
    fields: [],
  },
  distribuicao: {
    action: 'fechar',
    label: 'Concluir caso',
    descricao: 'Caso distribuído, concluir',
    targetStatus: 'fechado',
    preview: 'Caso será concluído',
    fields: [],
  },
}

// ═══════════════════════════════════════════════════════════════
// DERIVADOS — Tudo vem do ACTION_MAP, nunca manual
// ═══════════════════════════════════════════════════════════════

/** Transições válidas — derivadas do ACTION_MAP + exceções (perdido/reengajar) */
export const VALID_TRANSITIONS: Record<string, StatusNegocio[]> = {
  ...(Object.fromEntries(
    Object.entries(ACTION_MAP).map(([status, cfg]) => [
      status,
      [cfg.targetStatus, 'perdido'],
    ])
  )),
  // Terminais
  fechado: [],
  perdido: ['analise_viabilidade'],
  resolvido: [],
}

/** Próximo status linear — derivado do ACTION_MAP */
export function getNextStatus(current: StatusNegocio): StatusNegocio | null {
  const resolved = resolveStatus(current)
  return ACTION_MAP[resolved]?.targetStatus ?? null
}

/** Próximo passo guiado — derivado do ACTION_MAP */
export function getNextStep(current: StatusNegocio): ActionConfig | null {
  const resolved = resolveStatus(current)
  return ACTION_MAP[resolved] ?? null
}

/** Labels legíveis — fonte única */
export const STATUS_LABELS: Record<string, string> = {
  analise_viabilidade: 'Análise de Viabilidade',
  retorno_cliente: 'Retorno ao Cliente',
  solicitacao_documentos: 'Solicitação de Documentos',
  envio_contrato: 'Envio de Contrato',
  esclarecimento_duvidas: 'Esclarecimento de Dúvidas',
  recebimento_documentos: 'Recebimento de Documentos',
  cadastro_interno: 'Cadastro Interno',
  confeccao_inicial: 'Confecção Inicial',
  distribuicao: 'Distribuição',
  fechado: 'Fechado',
  perdido: 'Perdido',
  resolvido: 'Resolvido',
}

// ═══════════════════════════════════════════════════════════════
// VALIDAÇÃO E AUDITORIA — Não mudou, usa VALID_TRANSITIONS
// ═══════════════════════════════════════════════════════════════

export interface TransitionResult {
  allowed: boolean
  error?: string
}

export interface AuditEntry {
  conversa_id: string
  status_anterior: StatusNegocio
  status_novo: StatusNegocio
  operador_id: string
  timestamp: string
}

/**
 * Valida se a transição de status_negocio é permitida.
 * Usa VALID_TRANSITIONS derivado do ACTION_MAP.
 * Resolves legacy status values before validation.
 */
export function validateBusinessTransition(
  from: StatusNegocio,
  to: StatusNegocio
): TransitionResult {
  const resolvedFrom = resolveStatus(from) as StatusNegocio
  const resolvedTo = resolveStatus(to) as StatusNegocio

  const allowed = VALID_TRANSITIONS[resolvedFrom]
  if (!allowed) {
    return { allowed: false, error: `Estado "${from}" não reconhecido.` }
  }
  if (!allowed.includes(resolvedTo)) {
    return {
      allowed: false,
      error: `Transição "${from}" → "${to}" não permitida. Válidas: ${allowed.join(', ') || 'nenhuma (terminal)'}.`,
    }
  }
  return { allowed: true }
}

/**
 * Cria entrada de auditoria para uma transição.
 */
export function createAuditEntry(
  conversaId: string,
  from: StatusNegocio,
  to: StatusNegocio,
  operadorId: string
): AuditEntry {
  return {
    conversa_id: conversaId,
    status_anterior: from,
    status_novo: to,
    operador_id: operadorId,
    timestamp: new Date().toISOString(),
  }
}
