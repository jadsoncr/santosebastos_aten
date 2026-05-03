// ══════════════════════════════════════════════════════════════
// Next Action Resolver — Função Pura
// web/core/flow/nextAction.ts
//
// Dado (estado, estágio, contexto) → retorna próxima ação recomendada.
// Garante: Cockpit SEMPRE tem sugestão de próximo passo.
// Propriedade: função pura, sem efeitos colaterais, determinística.
// ══════════════════════════════════════════════════════════════

import type { EstadoPainel, NextActionContext } from './types'

interface ResolverContext {
  valor_contrato?: number | null
  ultima_msg_de?: string | null
  tempo_desde_ultima_msg?: number | null
  owner_id?: string | null
  operador_id?: string | null
}

/**
 * resolveNextAction — Retorna a próxima ação recomendada para o caso.
 *
 * Regra: NUNCA retorna null para combinações válidas.
 * O Cockpit sempre tem uma sugestão de próximo passo.
 */
export function resolveNextAction(
  state: EstadoPainel,
  stage: string | null,
  ctx?: ResolverContext,
): NextActionContext {

  switch (state) {
    case 'triagem':
      return {
        action: 'classificar',
        label: 'Classificar este caso',
        destination: 'em_atendimento',
        description: 'Definir tipo de decisão e encaminhar',
        confidence: 'high',
        type: 'assisted',
      }

    case 'em_atendimento': {
      // Follow-up: operador enviou última msg há mais de 24h
      if (
        ctx?.ultima_msg_de === 'operador' &&
        ctx?.tempo_desde_ultima_msg != null &&
        ctx.tempo_desde_ultima_msg > 24 * 60 * 60 * 1000
      ) {
        return {
          action: 'follow_up',
          label: 'Fazer follow-up',
          destination: 'em_atendimento',
          description: 'Cliente sem resposta há mais de 24h',
          confidence: 'medium',
          type: 'assisted',
        }
      }

      // Bloqueado: caso de outro operador
      if (ctx?.owner_id && ctx?.operador_id && ctx.owner_id !== ctx.operador_id) {
        return {
          action: 'revisar',
          label: 'Caso de outro operador',
          destination: 'em_atendimento',
          description: 'Este caso pertence a outro operador',
          confidence: 'high',
          type: 'blocked',
          reason: 'Caso atribuído a outro operador',
          unblockAction: 'Transferir para você ou aguardar',
        }
      }

      // Com estágio definido → avançar
      if (stage) {
        return {
          action: 'avancar_etapa',
          label: `Avançar: ${formatStage(stage)}`,
          destination: 'em_atendimento',
          description: `Próxima etapa do fluxo jurídico`,
          confidence: 'high',
          type: 'assisted',
        }
      }

      // Sem estágio → dados incompletos
      return {
        action: 'revisar',
        label: 'Revisar caso',
        destination: 'em_atendimento',
        description: 'Dados incompletos para determinar próximo passo',
        confidence: 'low',
        type: 'assisted',
      }
    }

    case 'cliente':
      if (!ctx?.valor_contrato) {
        return {
          action: 'registrar_financeiro',
          label: 'Registrar financeiro',
          destination: 'cliente',
          description: 'Registrar valor de contrato e forma de pagamento',
          confidence: 'high',
          type: 'assisted',
        }
      }
      return {
        action: 'acompanhar',
        label: 'Acompanhar caso',
        destination: 'cliente',
        description: 'Caso em andamento — monitorar progresso',
        confidence: 'high',
        type: 'auto',
      }

    case 'encerrado':
      return {
        action: 'reativar',
        label: 'Reativar caso',
        destination: 'triagem',
        description: 'Reabrir caso para nova triagem',
        confidence: 'medium',
        type: 'assisted',
      }

    default:
      return {
        action: 'revisar',
        label: 'Revisar caso',
        destination: 'triagem',
        description: 'Estado desconhecido — revisar manualmente',
        confidence: 'low',
        type: 'assisted',
      }
  }
}

function formatStage(stage: string): string {
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
