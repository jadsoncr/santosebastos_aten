/**
 * classificationSuggestion.ts — Sugestão inteligente de classificação.
 *
 * Baseado em area_bot do lead (identificada pelo bot na conversa).
 * Mapeia area_bot → nome do segmento nível 1 na árvore.
 *
 * Regras:
 * - Só sugere quando area_bot existe e tem mapeamento
 * - Nunca sobrescreve input do usuário
 * - Retorna null quando não tem confiança
 *
 * Zero side effects. Zero imports externos pesados. Testável em isolamento.
 */

export interface ClassificationSuggestion {
  /** Nome do segmento sugerido (nível 1) — para match com segment_trees */
  segmentName: string
  /** Label legível para exibir ao usuário */
  label: string
  /** Confiança da sugestão */
  confidence: 'high' | 'medium'
  /** Fonte da sugestão */
  source: string
}

/**
 * Mapeamento area_bot → nome do segmento nível 1.
 * Mantém sincronizado com os nomes em segment_trees.
 * Inclui sinônimos e variações comuns.
 */
const AREA_BOT_MAP: Record<string, { segmentName: string; label: string }> = {
  trabalhista: { segmentName: 'Trabalhista', label: 'Trabalhista' },
  familia: { segmentName: 'Família', label: 'Família' },
  família: { segmentName: 'Família', label: 'Família' },
  civel: { segmentName: 'Cível', label: 'Cível' },
  cível: { segmentName: 'Cível', label: 'Cível' },
  civil: { segmentName: 'Cível', label: 'Cível' },
  consumidor: { segmentName: 'Consumidor', label: 'Consumidor' },
  previdenciario: { segmentName: 'Previdenciário', label: 'Previdenciário' },
  previdenciário: { segmentName: 'Previdenciário', label: 'Previdenciário' },
}

export interface SuggestionInput {
  area_bot: string | null
  area: string | null
  /** Se o operador já selecionou algo (não sobrescrever) */
  alreadyClassified: boolean
}

/**
 * Retorna sugestão de classificação baseada nos sinais disponíveis.
 * Retorna null quando não há confiança suficiente.
 */
export function suggestClassification(input: SuggestionInput): ClassificationSuggestion | null {
  // Never suggest if operator already classified
  if (input.alreadyClassified) return null

  // Primary signal: area_bot (identified by bot during conversation)
  if (input.area_bot) {
    const normalized = input.area_bot.toLowerCase().trim()
    const match = AREA_BOT_MAP[normalized]
    if (match) {
      return {
        segmentName: match.segmentName,
        label: match.label,
        confidence: 'high',
        source: 'Identificado pelo bot',
      }
    }
  }

  // Secondary signal: area field (may be same as area_bot or manually set)
  if (input.area && input.area !== input.area_bot) {
    const normalized = input.area.toLowerCase().trim()
    const match = AREA_BOT_MAP[normalized]
    if (match) {
      return {
        segmentName: match.segmentName,
        label: match.label,
        confidence: 'medium',
        source: 'Área identificada',
      }
    }
  }

  return null
}

/**
 * Finds the segment_tree node ID that matches the suggestion.
 * Used to pre-select the dropdown.
 */
export function findSegmentIdByName(
  nodes: Array<{ id: string; nome: string; nivel: number; parent_id: string | null }>,
  segmentName: string
): string | null {
  const match = nodes.find(n => n.nivel === 1 && n.nome.toLowerCase() === segmentName.toLowerCase())
  return match?.id ?? null
}
