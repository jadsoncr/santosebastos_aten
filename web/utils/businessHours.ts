/**
 * businessHours.ts — Cálculo de horas úteis e classificação de inatividade
 * Horário útil: Seg-Sex, 09:00-18:00
 */

const WORK_START = 9  // 09:00
const WORK_END = 18   // 18:00
const WORK_HOURS_PER_DAY = WORK_END - WORK_START // 9h

/**
 * Calcula horas úteis entre duas datas.
 * Considera apenas Seg-Sex, 09:00-18:00.
 */
export function calcularHorasUteis(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0

  let totalMinutos = 0
  const cursor = new Date(inicio)

  while (cursor < fim) {
    const dia = cursor.getDay() // 0=dom, 6=sab
    const hora = cursor.getHours()
    const minuto = cursor.getMinutes()

    // Pular fins de semana
    if (dia === 0 || dia === 6) {
      // Avançar para segunda 09:00
      const diasAteSegunda = dia === 0 ? 1 : 2
      cursor.setDate(cursor.getDate() + diasAteSegunda)
      cursor.setHours(WORK_START, 0, 0, 0)
      continue
    }

    // Antes do expediente
    if (hora < WORK_START) {
      cursor.setHours(WORK_START, 0, 0, 0)
      continue
    }

    // Depois do expediente
    if (hora >= WORK_END) {
      // Avançar para próximo dia útil 09:00
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(WORK_START, 0, 0, 0)
      continue
    }

    // Dentro do expediente — contar minutos até fim do expediente ou fim do período
    const fimExpedienteHoje = new Date(cursor)
    fimExpedienteHoje.setHours(WORK_END, 0, 0, 0)

    const fimContagem = fim < fimExpedienteHoje ? fim : fimExpedienteHoje
    const diffMs = fimContagem.getTime() - cursor.getTime()
    totalMinutos += diffMs / 60000

    // Avançar cursor
    if (fim <= fimExpedienteHoje) {
      break
    }
    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(WORK_START, 0, 0, 0)
  }

  return totalMinutos / 60 // retorna em horas
}

export type LeadStatus = 'ativo' | 'esfriando' | 'sem_resposta'

/**
 * Classifica o lead com base na última mensagem do cliente.
 * - Ativo: ≤ 2h corridas
 * - Esfriando: > 2h corridas E ≤ 24h úteis
 * - Sem resposta: > 24h úteis
 */
export function classificarInatividade(ultimaMsgCliente: string | null): LeadStatus {
  if (!ultimaMsgCliente) return 'sem_resposta'

  const agora = new Date()
  const ultima = new Date(ultimaMsgCliente)

  // Ativo: ≤ 2h corridas (não úteis — para urgência imediata)
  const diffHorasCorridas = (agora.getTime() - ultima.getTime()) / (1000 * 60 * 60)
  if (diffHorasCorridas <= 2) return 'ativo'

  // Calcular horas úteis
  const horasUteis = calcularHorasUteis(ultima, agora)

  if (horasUteis <= 24) return 'esfriando'
  return 'sem_resposta'
}

export const STATUS_STYLES: Record<LeadStatus, { label: string; bg: string; text: string }> = {
  ativo: { label: 'Ativo', bg: 'bg-[#EEF6FF]', text: 'text-[#3B82F6]' },
  esfriando: { label: 'Esfriando', bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]' },
  sem_resposta: { label: 'Sem resposta', bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' },
}
