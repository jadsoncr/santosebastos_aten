// ══════════════════════════════════════════════════════════════
// Transition Map — Fonte Única de Verdade
// web/core/flow/transitions.ts
//
// Mapa declarativo: (estado_atual, ação) → (estado_destino, efeitos[])
// Ordem formal: apply_transaction → derive_status → emit_socket →
//              refetch → auto_select → toast_destino → suggest_template → celebrate
//
// Socket events são emitidos FORA da transação (após commit).
// ══════════════════════════════════════════════════════════════

import type { EstadoPainel, FlowAction, Transition } from './types'

export const TRANSITION_MAP: Record<EstadoPainel, Partial<Record<FlowAction, Transition>>> = {

  triagem: {
    classificar: {
      toState: 'em_atendimento',
      effects: [
        'apply_transaction', 'derive_status', 'emit_socket',
        'refetch', 'auto_select', 'toast_destino', 'suggest_template',
      ],
      toastMessage: 'Caso movido para Execução',
      toastAction: 'Ver agora →',
      toastVariant: 'success',
    },
  },

  em_atendimento: {
    avancar_etapa: {
      toState: 'em_atendimento',
      effects: ['apply_transaction', 'derive_status', 'emit_socket', 'refetch'],
      toastMessage: 'Etapa avançada',
      toastVariant: 'success',
    },
    fechar: {
      toState: 'cliente',
      effects: [
        'apply_transaction', 'derive_status', 'emit_socket',
        'refetch', 'auto_select', 'toast_destino', 'celebrate',
      ],
      toastMessage: 'Caso fechado com sucesso 🎉',
      toastAction: 'Ver financeiro →',
      toastVariant: 'celebration',
    },
    perder: {
      toState: 'encerrado',
      effects: [
        'apply_transaction', 'emit_socket',
        'auto_select', 'toast_destino',
      ],
      toastMessage: 'Decisão encerrada',
      toastVariant: 'info',
    },
    delegar: {
      toState: 'em_atendimento',
      effects: ['apply_transaction', 'emit_socket', 'refetch'],
      toastMessage: 'Caso delegado',
      toastVariant: 'info',
    },
  },

  encerrado: {
    reativar: {
      toState: 'triagem',
      effects: [
        'apply_transaction', 'emit_socket',
        'refetch', 'toast_destino',
      ],
      toastMessage: 'Caso reativado',
      toastAction: 'Ver na triagem →',
      toastVariant: 'info',
    },
  },

  cliente: {
    novo_atendimento: {
      toState: 'triagem',
      effects: [
        'apply_transaction', 'emit_socket',
        'auto_select', 'toast_destino',
      ],
      toastMessage: 'Novo atendimento iniciado',
      toastAction: 'Ver na triagem →',
      toastVariant: 'info',
    },
  },
}

/**
 * Variante para classificação com destino encerrado.
 * Usado quando o operador classifica como BadCall ou encerramento direto.
 */
export const CLASSIFICAR_ENCERRADO: Transition = {
  toState: 'encerrado',
  effects: ['apply_transaction', 'emit_socket', 'auto_select', 'toast_destino'],
  toastMessage: 'Decisão encerrada',
  toastVariant: 'info',
}

/**
 * Resolve a transição correta para classificação baseado no destino.
 */
export function resolveClassificarTransition(destino: 'backoffice' | 'encerrado'): Transition {
  if (destino === 'encerrado') return CLASSIFICAR_ENCERRADO
  return TRANSITION_MAP.triagem.classificar!
}
