/**
 * conversationStatus.ts — Classificação temporal de conversas por horas corridas.
 * Substitui classificarInatividade() de businessHours.ts que usava horas úteis.
 *
 * Thresholds:
 *   < 8h   → active
 *   8-34h  → waiting
 *   34h-7d → no_response
 *   ≥ 7d   → inativo
 */

export type ConversationStatus = 'active' | 'waiting' | 'no_response' | 'inativo'

export interface ConversationStatusResult {
  status: ConversationStatus
  diffHours: number
  diffDays: number
}

/**
 * Classifica o status temporal de uma conversa usando horas corridas.
 *
 * @param ultimaMsgEm - Timestamp da última mensagem (ISO string ou null)
 * @param createdAt - Timestamp de criação do lead como fallback (ISO string ou null)
 * @param now - Data de referência para cálculo (default: new Date())
 */
export function getConversationStatus(
  ultimaMsgEm: string | null,
  createdAt?: string | null,
  now?: Date
): ConversationStatusResult {
  const currentTime = now || new Date()
  const reference = ultimaMsgEm || createdAt || null

  if (!reference) {
    return { status: 'no_response', diffHours: Infinity, diffDays: Infinity }
  }

  const diffMs = currentTime.getTime() - new Date(reference).getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays >= 7) return { status: 'inativo', diffHours, diffDays }
  if (diffHours >= 34) return { status: 'no_response', diffHours, diffDays }
  if (diffHours >= 8) return { status: 'waiting', diffHours, diffDays }
  return { status: 'active', diffHours, diffDays }
}

export const CONVERSATION_STATUS_STYLES: Record<ConversationStatus, {
  label: string; bg: string; text: string
}> = {
  active:      { label: 'Ativo',        bg: 'bg-[#EEF6FF]', text: 'text-[#3B82F6]' },
  waiting:     { label: 'Aguardando',   bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]' },
  no_response: { label: 'Sem resposta', bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' },
  inativo:     { label: 'Inativo',      bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
}
