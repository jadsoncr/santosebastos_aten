// Utilitários de formatação — Zero ruído técnico na interface

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Formata telefone pra exibição. Se for UUID, retorna null.
 * Aceita: +5521999999999, 21999999999, 5521999999999
 */
export function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (UUID_REGEX.test(raw)) return null // UUID não é telefone

  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return raw // muito curto, retorna como está

  // BR: 55 + DDD(2) + número(8-9)
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const num = digits.slice(4)
    return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return raw
}

/**
 * Retorna telefone seguro pra exibição. Nunca mostra UUID.
 */
export function displayPhone(raw: string | null | undefined): string {
  const formatted = formatPhone(raw)
  return formatted || '—'
}

/**
 * Retorna link tel: se telefone válido, senão null.
 */
export function telLink(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (UUID_REGEX.test(raw)) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return null
  return `tel:+${digits.startsWith('55') ? digits : '55' + digits}`
}

/**
 * Extrai últimos 4 dígitos do número pra tag de origem no chat.
 */
export function phoneTag(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (UUID_REGEX.test(raw)) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 4) return null
  return `...${digits.slice(-4)}`
}

/**
 * Calcula dias entre duas datas.
 */
export function daysBetween(from: string, to: string): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
}
