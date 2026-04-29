/**
 * resolveTreatment.ts — Classificação de TRATAMENTO (operacional)
 * 
 * Separada da árvore jurídica. Define encaminhamento na triagem.
 * 2 níveis: Tipo de tratamento → Detalhe
 * 
 * REGRA: quem decide o fluxo é o tratamento, não o problema jurídico.
 */

export type TreatmentTipo = 'Informação' | 'Solicitação' | 'Retorno' | 'BadCall'

export interface TreatmentResult {
  destino: 'backoffice' | 'encerrado'
  status_negocio: string
}

export const TREATMENT_TIPOS: TreatmentTipo[] = ['Informação', 'Solicitação', 'Retorno', 'BadCall']

export const TREATMENT_DETALHES: Record<TreatmentTipo, string[]> = {
  'Informação': ['Horário de funcionamento', 'Endereço', 'Outros'],
  'Solicitação': ['Reunião', 'Contato', 'Proposta', 'Revisão/Proposta'],
  'Retorno': ['Revisão/Proposta'],
  'BadCall': ['Sem retorno', 'Trote'],
}

const TREATMENT_MAP: Record<string, TreatmentResult> = {
  // Informação → tudo encerrado
  'Informação::Horário de funcionamento': { destino: 'encerrado', status_negocio: 'resolvido' },
  'Informação::Endereço': { destino: 'encerrado', status_negocio: 'resolvido' },
  'Informação::Outros': { destino: 'encerrado', status_negocio: 'resolvido' },

  // Solicitação → backoffice
  'Solicitação::Reunião': { destino: 'backoffice', status_negocio: 'aguardando_agendamento' },
  'Solicitação::Contato': { destino: 'backoffice', status_negocio: 'aguardando_agendamento' },
  'Solicitação::Proposta': { destino: 'backoffice', status_negocio: 'aguardando_proposta' },
  'Solicitação::Revisão/Proposta': { destino: 'backoffice', status_negocio: 'negociacao' },

  // Retorno → backoffice
  'Retorno::Revisão/Proposta': { destino: 'backoffice', status_negocio: 'negociacao' },

  // BadCall → encerrado (NÃO exige classificação jurídica)
  'BadCall::Sem retorno': { destino: 'encerrado', status_negocio: 'perdido' },
  'BadCall::Trote': { destino: 'encerrado', status_negocio: 'perdido' },
}

/**
 * Resolve o tratamento operacional a partir de tipo + detalhe.
 * Retorna destino e status_negocio inicial.
 */
export function resolveTreatment(tipo: string, detalhe: string): TreatmentResult {
  const key = `${tipo}::${detalhe}`
  const result = TREATMENT_MAP[key]
  if (!result) {
    throw new Error(`Tratamento não mapeado: "${key}"`)
  }
  return result
}
