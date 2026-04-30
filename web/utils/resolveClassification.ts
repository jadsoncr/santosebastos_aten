export type StatusNegocio =
  // New operational stages
  | 'analise_viabilidade'
  | 'retorno_cliente'
  | 'solicitacao_documentos'
  | 'envio_contrato'
  | 'esclarecimento_duvidas'
  | 'recebimento_documentos'
  | 'cadastro_interno'
  | 'confeccao_inicial'
  | 'distribuicao'
  // Legacy (mapped via LEGACY_STATUS_MAP)
  | 'aguardando_agendamento'
  | 'reuniao_agendada'
  | 'aguardando_proposta'
  | 'negociacao'
  | 'aguardando_contrato'
  // Terminal
  | 'fechado'
  | 'perdido'
  | 'resolvido'

export type Destino = 'backoffice' | 'encerrado'

export interface ClassificationResult {
  status_negocio: StatusNegocio
  destino: Destino
  fila?: 'fica' | 'sai'
  acao?: string
}

/**
 * Resolve classificação a partir de um nó da segment_trees.
 * Lookup direto nas colunas status_negocio/destino do nó.
 * SEM fallback regex — árvore é 100% determinística.
 *
 * @throws Error se o nó não tiver status_negocio ou destino definido
 */
export function resolveClassification(
  subcategoriaNome: string,
  nodeData?: { status_negocio?: string | null; destino?: string | null; fila?: string | null; acao?: string | null }
): ClassificationResult {
  if (!nodeData?.status_negocio || !nodeData?.destino) {
    throw new Error(`Subcategoria "${subcategoriaNome}" não tem decisão definida na árvore. Configure status_negocio e destino na segment_trees.`)
  }

  return {
    status_negocio: nodeData.status_negocio as StatusNegocio,
    destino: nodeData.destino as Destino,
    fila: (nodeData.fila as 'fica' | 'sai') || 'sai',
    acao: nodeData.acao || undefined,
  }
}
