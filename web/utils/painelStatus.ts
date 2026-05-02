/**
 * painelStatus.ts — Utilitários visuais do PainelLead
 *
 * Funções puras para cor, label, score e prazo.
 * Sem side effects. Sem API calls. Testável em isolamento.
 */

import type { EstadoPainel } from './painelModes'
import { getSlaDias } from './journeyModel'

// --- Cor do painel por estado ---

export function getCorPainel(estadoPainel: EstadoPainel | null): string {
  switch (estadoPainel) {
    case 'em_atendimento':
      return 'bg-blue-50'
    case 'cliente':
      return 'bg-green-50'
    case 'encerrado':
      return 'bg-gray-50/50'
    case 'triagem':
    case null:
    default:
      return 'bg-gray-50'
  }
}

// --- Label humano do estado ---

export function getEstadoLabel(estadoPainel: EstadoPainel | null): string {
  switch (estadoPainel) {
    case 'em_atendimento':
      return 'Em execução'
    case 'cliente':
      return 'Estado ativo'
    case 'encerrado':
      return 'Decisão encerrada'
    case 'triagem':
    case null:
    default:
      return 'Entrada'
  }
}

// --- Score visual ---

export interface ScoreVisual {
  icon: string
  label: string
  colorClass: string
}

export function getScoreVisual(score: number): ScoreVisual {
  if (score >= 7) return { icon: '🔥', label: 'QUENTE', colorClass: 'text-red-500' }
  if (score >= 4) return { icon: '⚠️', label: 'MORNO', colorClass: 'text-yellow-500' }
  return { icon: '❄️', label: 'FRIO', colorClass: 'text-gray-400' }
}

// --- Prazo da próxima ação (derivado de journeyModel) ---

export function calcularPrazo(statusNegocio: string): Date {
  const now = new Date()
  const dias = getSlaDias(statusNegocio)
  return new Date(now.getTime() + dias * 24 * 60 * 60 * 1000)
}

// --- Label de urgência do prazo ---

export function getPrazoLabel(prazo: Date | string | null): string {
  if (!prazo) return ''

  const prazoDate = typeof prazo === 'string' ? new Date(prazo) : prazo
  const now = new Date()

  // Normalizar para início do dia para comparação de datas
  const prazoDay = new Date(prazoDate.getFullYear(), prazoDate.getMonth(), prazoDate.getDate())
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = prazoDay.getTime() - todayDay.getTime()
  const diffDias = Math.round(diffMs / (24 * 60 * 60 * 1000))

  if (diffDias < 0) return '⚠️ Atrasado'
  if (diffDias === 0) return '⏰ Hoje'
  if (diffDias === 1) return 'Amanhã'

  const dd = String(prazoDate.getDate()).padStart(2, '0')
  const mm = String(prazoDate.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}
