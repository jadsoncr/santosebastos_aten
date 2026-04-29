export type UrgencyLevel = 'normal' | 'alert' | 'critical'

export interface UrgencyStyle {
  level: UrgencyLevel
  bg: string
  border: string
  textColor: string
  label: string
}

export function getUrgencyStyle(
  ultimaMsgEm: string | null,
  ultimaMsgDe: string | null,
  prazoProximaAcao?: string | null
): UrgencyStyle {
  // Critical: prazo vencido
  if (prazoProximaAcao) {
    const prazoDate = new Date(prazoProximaAcao)
    if (prazoDate.getTime() < Date.now()) {
      return { level: 'critical', bg: 'bg-red-50', border: 'border-red-300', textColor: 'text-red-600', label: '🔴 Atrasado' }
    }
  }

  // Only show urgency when client is waiting (ultima_msg_de = 'cliente')
  if (ultimaMsgDe !== 'cliente' || !ultimaMsgEm) {
    // If operator sent last msg, show "Aguardando resposta"
    if (ultimaMsgDe === 'operador' && ultimaMsgEm) {
      return { level: 'normal', bg: '', border: '', textColor: 'text-gray-400', label: 'Aguardando resposta' }
    }
    return { level: 'normal', bg: '', border: '', textColor: 'text-gray-300', label: '' }
  }

  const diffMs = Date.now() - new Date(ultimaMsgEm).getTime()
  const diffMin = Math.floor(diffMs / 60000)

  // Critical: > 30min without response to client
  if (diffMin >= 30) {
    return { level: 'critical', bg: 'bg-red-50', border: 'border-red-300', textColor: 'text-red-600', label: `⏱ ${diffMin}min` }
  }

  // Alert: > 15min
  if (diffMin >= 15) {
    return { level: 'alert', bg: 'bg-yellow-50', border: 'border-yellow-300', textColor: 'text-yellow-600', label: `⏱ ${diffMin}min` }
  }

  // Normal: < 15min
  if (diffMin >= 1) {
    return { level: 'normal', bg: '', border: '', textColor: 'text-blue-500', label: `⏱ ${diffMin}min` }
  }

  return { level: 'normal', bg: '', border: '', textColor: 'text-blue-500', label: '⏱ agora' }
}

// SLA check for classification (lead > 2h without being classified)
export function getTriagemSLA(createdAt: string): UrgencyStyle | null {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours >= 2) {
    return { level: 'critical', bg: 'bg-red-50', border: 'border-red-300', textColor: 'text-red-600', label: 'SLA estourado' }
  }
  return null
}
