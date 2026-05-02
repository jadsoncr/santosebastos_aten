import { describe, it, expect } from 'vitest'
import { detectInactivity, countInactive } from './inactivityNudge'

const NOW = new Date('2026-05-02T12:00:00Z').getTime()

describe('detectInactivity', () => {
  it('returns null for non em_atendimento cases', () => {
    expect(detectInactivity({
      prazo_proxima_acao: new Date(NOW - 48 * 3600000).toISOString(),
      status_negocio: 'analise_viabilidade',
      ultima_msg_de: null,
      estado_painel: 'triagem',
    }, NOW)).toBeNull()
  })

  it('returns null when no prazo set', () => {
    expect(detectInactivity({
      prazo_proxima_acao: null,
      status_negocio: 'analise_viabilidade',
      ultima_msg_de: null,
      estado_painel: 'em_atendimento',
    }, NOW)).toBeNull()
  })

  it('returns null when responsavel is cliente', () => {
    expect(detectInactivity({
      prazo_proxima_acao: new Date(NOW - 72 * 3600000).toISOString(),
      status_negocio: 'recebimento_documentos',
      ultima_msg_de: 'operador', // operator sent last → waiting for client
      estado_painel: 'em_atendimento',
    }, NOW)).toBeNull()
  })

  it('returns null when within SLA (not overdue)', () => {
    expect(detectInactivity({
      prazo_proxima_acao: new Date(NOW + 3600000).toISOString(), // 1h in future
      status_negocio: 'analise_viabilidade',
      ultima_msg_de: 'cliente',
      estado_painel: 'em_atendimento',
    }, NOW)).toBeNull()
  })

  it('returns null when overdue less than 24h', () => {
    expect(detectInactivity({
      prazo_proxima_acao: new Date(NOW - 12 * 3600000).toISOString(), // 12h overdue
      status_negocio: 'analise_viabilidade',
      ultima_msg_de: 'cliente',
      estado_painel: 'em_atendimento',
    }, NOW)).toBeNull()
  })

  it('returns warning when 24-48h overdue', () => {
    const result = detectInactivity({
      prazo_proxima_acao: new Date(NOW - 30 * 3600000).toISOString(), // 30h overdue
      status_negocio: 'analise_viabilidade',
      ultima_msg_de: 'cliente',
      estado_painel: 'em_atendimento',
    }, NOW)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('warning')
    expect(result!.message).toBe('Sem ação há 1 dia')
    expect(result!.action).toBe('Analisar viabilidade')
  })

  it('returns critical when 48h+ overdue', () => {
    const result = detectInactivity({
      prazo_proxima_acao: new Date(NOW - 72 * 3600000).toISOString(), // 72h overdue
      status_negocio: 'solicitacao_documentos',
      ultima_msg_de: 'cliente',
      estado_painel: 'em_atendimento',
    }, NOW)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('critical')
    expect(result!.message).toBe('Sem ação há 3 dias')
    expect(result!.action).toBe('Solicitar documentos')
  })
})

describe('countInactive', () => {
  it('counts only inactive items', () => {
    const items = [
      { prazo_proxima_acao: new Date(NOW - 72 * 3600000).toISOString(), status_negocio: 'analise_viabilidade', ultima_msg_de: 'cliente', estado_painel: 'em_atendimento' },
      { prazo_proxima_acao: new Date(NOW + 3600000).toISOString(), status_negocio: 'retorno_cliente', ultima_msg_de: null, estado_painel: 'em_atendimento' },
      { prazo_proxima_acao: new Date(NOW - 48 * 3600000).toISOString(), status_negocio: 'envio_contrato', ultima_msg_de: null, estado_painel: 'em_atendimento' },
    ]
    expect(countInactive(items, NOW)).toBe(2)
  })
})
