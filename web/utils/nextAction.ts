export const STATUS_NEXT_ACTION: Record<string, string> = {
  aguardando_agendamento: 'Agendar reunião',
  reuniao_agendada: 'Enviar proposta',
  aguardando_proposta: 'Iniciar negociação',
  negociacao: 'Fechar contrato',
  aguardando_contrato: 'Confirmar contrato',
}

export function getNextActionLabel(statusNegocio: string | null): string | null {
  if (!statusNegocio) return null
  return STATUS_NEXT_ACTION[statusNegocio] || null
}
