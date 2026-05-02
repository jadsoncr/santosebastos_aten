import { describe, it, expect } from 'vitest'
import { suggestClassification, findSegmentIdByName } from './classificationSuggestion'

describe('suggestClassification', () => {
  it('suggests based on area_bot', () => {
    const result = suggestClassification({
      area_bot: 'trabalhista',
      area: null,
      alreadyClassified: false,
    })
    expect(result).not.toBeNull()
    expect(result!.segmentName).toBe('Trabalhista')
    expect(result!.confidence).toBe('high')
    expect(result!.source).toBe('Identificado pelo bot')
  })

  it('suggests familia correctly', () => {
    const result = suggestClassification({
      area_bot: 'familia',
      area: 'familia',
      alreadyClassified: false,
    })
    expect(result!.segmentName).toBe('Família')
  })

  it('returns null when already classified', () => {
    const result = suggestClassification({
      area_bot: 'trabalhista',
      area: 'trabalhista',
      alreadyClassified: true,
    })
    expect(result).toBeNull()
  })

  it('returns null when no area_bot', () => {
    const result = suggestClassification({
      area_bot: null,
      area: null,
      alreadyClassified: false,
    })
    expect(result).toBeNull()
  })

  it('returns null for unknown area_bot', () => {
    const result = suggestClassification({
      area_bot: 'desconhecido',
      area: null,
      alreadyClassified: false,
    })
    expect(result).toBeNull()
  })

  it('falls back to area when area_bot has no match', () => {
    const result = suggestClassification({
      area_bot: 'unknown',
      area: 'civel',
      alreadyClassified: false,
    })
    expect(result).not.toBeNull()
    expect(result!.segmentName).toBe('Cível')
    expect(result!.confidence).toBe('medium')
  })
})

describe('findSegmentIdByName', () => {
  const nodes = [
    { id: 'id-1', nome: 'Trabalhista', nivel: 1, parent_id: null },
    { id: 'id-2', nome: 'Família', nivel: 1, parent_id: null },
    { id: 'id-3', nome: 'Assédio Moral', nivel: 2, parent_id: 'id-1' },
  ]

  it('finds level 1 node by name', () => {
    expect(findSegmentIdByName(nodes, 'Trabalhista')).toBe('id-1')
    expect(findSegmentIdByName(nodes, 'Família')).toBe('id-2')
  })

  it('is case insensitive', () => {
    expect(findSegmentIdByName(nodes, 'trabalhista')).toBe('id-1')
  })

  it('returns null for non-existent', () => {
    expect(findSegmentIdByName(nodes, 'Penal')).toBeNull()
  })

  it('does not match level 2 nodes', () => {
    expect(findSegmentIdByName(nodes, 'Assédio Moral')).toBeNull()
  })
})
