import type { StatusNegocio } from './resolveClassification'

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
  aguardando_agendamento: {
    action: 'confirmar_reuniao',
    label: 'Confirmar reunião',
    descricao: 'Agendar data e local da reunião com o cliente',
    targetStatus: 'reuniao_agendada',
    preview: 'O caso avança para Reunião Agendada',
    fields: [],
  },
  reuniao_agendada: {
    action: 'enviar_proposta',
    label: 'Enviar proposta',
    descricao: 'Elaborar e enviar proposta de honorários ao cliente',
    targetStatus: 'aguardando_proposta',
    preview: 'O caso avança para Aguardando Proposta',
    fields: ['valor'],
  },
  aguardando_proposta: {
    action: 'iniciar_negociacao',
    label: 'Iniciar negociação',
    descricao: 'Cliente respondeu à proposta, iniciar negociação',
    targetStatus: 'negociacao',
    preview: 'O caso avança para Negociação',
    fields: [],
  },
  negociacao: {
    action: 'gerar_contrato',
    label: 'Gerar contrato',
    descricao: 'Termos acordados, gerar contrato para assinatura',
    targetStatus: 'aguardando_contrato',
    preview: 'O caso avança para Aguardando Contrato',
    fields: [],
  },
  aguardando_contrato: {
    action: 'fechar_contrato',
    label: 'Fechar contrato',
    descricao: 'Contrato assinado, finalizar caso',
    targetStatus: 'fechado',
    preview: 'O caso será fechado como convertido',
    fields: ['valor_contrato'],
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
  // Exceção: aguardando_proposta permite loop (ajustar proposta)
  aguardando_proposta: ['negociacao', 'aguardando_proposta', 'perdido'],
  // Terminais
  fechado: [],
  perdido: ['aguardando_agendamento'],
  resolvido: [],
}

/** Próximo status linear — derivado do ACTION_MAP */
export function getNextStatus(current: StatusNegocio): StatusNegocio | null {
  return ACTION_MAP[current]?.targetStatus ?? null
}

/** Próximo passo guiado — derivado do ACTION_MAP */
export function getNextStep(current: StatusNegocio): ActionConfig | null {
  return ACTION_MAP[current] ?? null
}

/** Labels legíveis — fonte única */
export const STATUS_LABELS: Record<StatusNegocio, string> = {
  aguardando_agendamento: 'Aguardando Agendamento',
  reuniao_agendada: 'Reunião Agendada',
  aguardando_proposta: 'Aguardando Proposta',
  negociacao: 'Negociação',
  aguardando_contrato: 'Aguardando Contrato',
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
 */
export function validateBusinessTransition(
  from: StatusNegocio,
  to: StatusNegocio
): TransitionResult {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) {
    return { allowed: false, error: `Estado "${from}" não reconhecido.` }
  }
  if (!allowed.includes(to)) {
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
