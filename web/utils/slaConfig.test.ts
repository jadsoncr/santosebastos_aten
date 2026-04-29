import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_SLA_CONFIG,
  getSlaConfig,
  updateSlaConfig,
  resetSlaConfig,
  getThresholdsMs,
} from './slaConfig'

beforeEach(() => {
  resetSlaConfig()
})

describe('slaConfig — Sprint 9', () => {
  it('getSlaConfig returns default values initially', () => {
    const config = getSlaConfig()
    expect(config.resposta_critica_min).toBe(30)
    expect(config.resposta_alerta_min).toBe(15)
    expect(config.triagem_critica_horas).toBe(2)
    expect(config.sound_enabled).toBe(true)
    expect(config.highlight_enabled).toBe(true)
    expect(config.tracking_enabled).toBe(true)
  })

  it('updateSlaConfig merges partial updates', () => {
    updateSlaConfig({ resposta_critica_min: 45, sound_enabled: false })
    const config = getSlaConfig()
    expect(config.resposta_critica_min).toBe(45)
    expect(config.sound_enabled).toBe(false)
    // Other values unchanged
    expect(config.resposta_alerta_min).toBe(15)
    expect(config.highlight_enabled).toBe(true)
  })

  it('resetSlaConfig restores defaults', () => {
    updateSlaConfig({ resposta_critica_min: 99 })
    expect(getSlaConfig().resposta_critica_min).toBe(99)
    resetSlaConfig()
    expect(getSlaConfig().resposta_critica_min).toBe(30)
  })

  it('getThresholdsMs converts correctly', () => {
    const ms = getThresholdsMs()
    expect(ms.resposta_critica_ms).toBe(30 * 60 * 1000)
    expect(ms.resposta_alerta_ms).toBe(15 * 60 * 1000)
    expect(ms.triagem_critica_ms).toBe(2 * 60 * 60 * 1000)
  })

  it('getThresholdsMs respects updated config', () => {
    updateSlaConfig({ resposta_critica_min: 60 })
    const ms = getThresholdsMs()
    expect(ms.resposta_critica_ms).toBe(60 * 60 * 1000)
  })

  it('DEFAULT_SLA_CONFIG is immutable reference', () => {
    updateSlaConfig({ resposta_critica_min: 99 })
    expect(DEFAULT_SLA_CONFIG.resposta_critica_min).toBe(30)
  })
})
