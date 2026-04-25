// web/utils/segmentTree.ts — Segment tree utility functions for cascading dropdowns

export interface SegmentNode {
  id: string
  parent_id: string | null
  nivel: 1 | 2 | 3
  nome: string
  persona: string | null
  ativo: boolean
  created_at: string
}

export interface CascadeSelection {
  segmento_id: string | null
  assunto_id: string | null
  especificacao_id: string | null
}

/**
 * Filtra nós ativos por nível e parent_id.
 * Usado pelos dropdowns cascata no BlocoQualificacao.
 */
export function filterChildren(
  nodes: SegmentNode[],
  parentId: string | null,
  nivel: 1 | 2 | 3
): SegmentNode[] {
  return nodes.filter(n =>
    n.ativo &&
    n.nivel === nivel &&
    (nivel === 1 ? n.parent_id === null : n.parent_id === parentId)
  )
}

/**
 * Resolve a persona para um dado segmento_id.
 * Retorna a persona do segmento ou o default.
 */
export function resolvePersona(
  nodes: SegmentNode[],
  segmentoId: string | null,
  defaultPersona = 'Atendimento Santos & Bastos'
): string {
  if (!segmentoId) return defaultPersona
  const node = nodes.find(n => n.id === segmentoId && n.nivel === 1)
  return node?.persona || defaultPersona
}

/**
 * Desativa um nó e todos os seus descendentes.
 * Retorna os IDs de todos os nós desativados.
 */
export function cascadeDeactivate(
  nodes: SegmentNode[],
  nodeId: string
): string[] {
  const deactivated: string[] = [nodeId]
  const queue = [nodeId]
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const children = nodes.filter(n => n.parent_id === currentId)
    for (const child of children) {
      deactivated.push(child.id)
      queue.push(child.id)
    }
  }
  return deactivated
}

/**
 * Valida se um nó pode ser criado na hierarquia.
 */
export function validateNodeCreation(
  nodes: SegmentNode[],
  parentId: string | null,
  nivel: 1 | 2 | 3,
  nome: string
): { valid: boolean; error?: string } {
  // Nível 1 deve ter parent_id null
  if (nivel === 1 && parentId !== null) {
    return { valid: false, error: 'Segmento (nível 1) não pode ter pai.' }
  }
  // Nível 2 deve ter pai de nível 1
  if (nivel === 2) {
    const parent = nodes.find(n => n.id === parentId && n.nivel === 1 && n.ativo)
    if (!parent) return { valid: false, error: 'Assunto (nível 2) deve ter um Segmento ativo como pai.' }
  }
  // Nível 3 deve ter pai de nível 2
  if (nivel === 3) {
    const parent = nodes.find(n => n.id === parentId && n.nivel === 2 && n.ativo)
    if (!parent) return { valid: false, error: 'Especificação (nível 3) deve ter um Assunto ativo como pai.' }
  }
  // Unicidade de nome entre irmãos
  const siblings = nodes.filter(n => n.parent_id === parentId && n.ativo)
  if (siblings.some(s => s.nome === nome)) {
    return { valid: false, error: 'Já existe um item com este nome neste nível.' }
  }
  return { valid: true }
}
