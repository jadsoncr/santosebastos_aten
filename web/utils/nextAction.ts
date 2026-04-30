import { resolveStatus } from './journeyModel'

export const STATUS_NEXT_ACTION: Record<string, string> = {
  analise_viabilidade: 'Analisar viabilidade',
  retorno_cliente: 'Retornar ao cliente',
  solicitacao_documentos: 'Solicitar documentos',
  envio_contrato: 'Enviar contrato',
  esclarecimento_duvidas: 'Esclarecer dúvidas',
  recebimento_documentos: 'Cobrar documentos',
  cadastro_interno: 'Cadastrar internamente',
  confeccao_inicial: 'Elaborar peça inicial',
  distribuicao: 'Distribuir processo',
}

export function getNextActionLabel(statusNegocio: string | null): string | null {
  if (!statusNegocio) return null
  const resolved = resolveStatus(statusNegocio)
  return STATUS_NEXT_ACTION[resolved] || null
}
