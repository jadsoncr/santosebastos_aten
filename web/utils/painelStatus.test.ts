import { describe, it, expect } from 'vitest'
import { getCorPainel, getEstadoLabel, getScoreVisual, calcularPrazo, getPrazoLabel } from './painelStatus'

describe('getCorPainel', () => {
  it('returns bg-gray-50 for null', () => {
    expect(getCorPainel(null)).toBe('bg-gray-50')
  })

  it('returns bg-gray-50 for triagem', () => {
    expect(getCorPainel('triagem')).toBe('bg-gray-50')
  })

  it('returns bg-blue-50 for em_atendimento', () => {
    expect(getCorPainel('em_atendimento')).toBe('bg-blue-50')
  })

  it('returns bg-green-50 for cliente', () => {
    expect(getCorPainel('cliente')).toBe('bg-green-50')
  })

  it('returns bg-gray-50/50 for encerrado', () => {
    expect(getCorPainel('encerrado')).toBe('bg-gray-50/50')
  })
})

describe('getEstadoLabel', () => {
  it('returns Triagem for null', () => {
    expect(getEstadoLabel(null)).toBe('Triagem')
  })

  it('returns Triagem for triagem', () => {
    expect(getEstadoLabel('triagem')).toBe('Triagem')
  })

  it('returns Em atendimento for em_atendimento', () => {
    expect(getEstadoLabel('em_atendimento')).toBe('Em atendimento')
  })

  it('returns Cliente ativo for cliente', () => {
    expect(getEstadoLabel('cliente')).toBe('Cliente ativo')
  })

  it('returns Encerrado for encerrado', () => {
    expect(getEstadoLabel('encerrado')).toBe('Encerrado')
  })
})

describe('getScoreVisual', () => {
  it('returns QUENTE for score >= 7', () => {
    const result = getScoreVisual(7)
    expect(result).toEqual({ icon: '🔥', label: 'QUENTE', colorClass: 'text-red-500' })
  })

  it('returns QUENTE for score 10', () => {
    expect(getScoreVisual(10).label).toBe('QUENTE')
  })

  it('returns MORNO for score >= 4 and < 7', () => {
    const result = getScoreVisual(4)
    expect(result).toEqual({ icon: '⚠️', label: 'MORNO', colorClass: 'text-yellow-500' })
  })

  it('returns MORNO for score 6', () => {
    expect(getScoreVisual(6).label).toBe('MORNO')
  })

  it('returns FRIO for score < 4', () => {
    const result = getScoreVisual(3)
    expect(result).toEqual({ icon: '❄️', label: 'FRIO', colorClass: 'text-gray-400' })
  })

  it('returns FRIO for score 0', () => {
    expect(getScoreVisual(0).label).toBe('FRIO')
  })
})

describe('calcularPrazo', () => {
  it('returns +2 days for aguardando_agendamento', () => {
    const before = Date.now()
    const result = calcularPrazo('aguardando_agendamento')
    const after = Date.now()
    const expected2Days = 2 * 24 * 60 * 60 * 1000
    expect(result.getTime()).toBeGreaterThanOrEqual(before + expected2Days)
    expect(result.getTime()).toBeLessThanOrEqual(after + expected2Days)
  })

  it('returns +3 days for aguardando_proposta', () => {
    const before = Date.now()
    const result = calcularPrazo('aguardando_proposta')
    const expected3Days = 3 * 24 * 60 * 60 * 1000
    expect(result.getTime()).toBeGreaterThanOrEqual(before + expected3Days)
    expect(result.getTime()).toBeLessThanOrEqual(before + expected3Days + 100)
  })

  it('returns +5 days for negociacao', () => {
    const before = Date.now()
    const result = calcularPrazo('negociacao')
    const expected5Days = 5 * 24 * 60 * 60 * 1000
    expect(result.getTime()).toBeGreaterThanOrEqual(before + expected5Days)
    expect(result.getTime()).toBeLessThanOrEqual(before + expected5Days + 100)
  })

  it('returns +7 days for unknown status', () => {
    const before = Date.now()
    const result = calcularPrazo('qualquer_coisa')
    const expected7Days = 7 * 24 * 60 * 60 * 1000
    expect(result.getTime()).toBeGreaterThanOrEqual(before + expected7Days)
    expect(result.getTime()).toBeLessThanOrEqual(before + expected7Days + 100)
  })
})

describe('getPrazoLabel', () => {
  it('returns empty string for null', () => {
    expect(getPrazoLabel(null)).toBe('')
  })

  it('returns ⚠️ Atrasado for past date', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(getPrazoLabel(yesterday)).toBe('⚠️ Atrasado')
  })

  it('returns ⏰ Hoje for today', () => {
    const today = new Date()
    expect(getPrazoLabel(today)).toBe('⏰ Hoje')
  })

  it('returns Amanhã for tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(getPrazoLabel(tomorrow)).toBe('Amanhã')
  })

  it('returns dd/MM for future dates beyond tomorrow', () => {
    const future = new Date(2025, 5, 15) // June 15, 2025
    // Only test if this date is in the future
    if (future.getTime() > Date.now() + 2 * 24 * 60 * 60 * 1000) {
      expect(getPrazoLabel(future)).toBe('15/06')
    }
  })

  it('accepts string dates', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 2)
    expect(getPrazoLabel(yesterday.toISOString())).toBe('⚠️ Atrasado')
  })
})
