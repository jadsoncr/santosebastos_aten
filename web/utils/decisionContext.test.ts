import { describe, it, expect } from 'vitest'
import { getDecisionContext } from './decisionContext'

const NOW = new Date('2026-05-02T12:00:00Z').getTime()

describe('getDecisionContext', () => {
  it('returns critical + stale for overdue case with client response', () => {
    const ctx = getDecisionContext({
      ultima_msg_em: new Date(NOW - 5 * 60000).toISOString(), // 5min ago
      ultima_msg_de: 'cliente',
      created_at: new Date(NOW - 3 * 86400000).toISOString(),
      estado_painel: 'em_atendimento',
      status_negocio: 'solicitacao_documentos',
      prazo_proxima_acao: new Date(NOW - 48 * 3600000).toISOString(), // 48h overdue
    }, NOW)

    expect(ctx.isCritical).toBe(true)
    expect(ctx.isStale).toBe(true)
    expect(ctx.hasPrereq).toBe(true)
    expect(ctx.prereqQuestion).toBe('Documentos foram solicitados ao cliente?')
    expect(ctx.nextAction).toBe('Solicitar documentos')
    expect(ctx.responsavel).toBe('interno')
    expect(ctx.summary).toContain('parado')
  })

  it('returns non-critical for case within SLA', () => {
    const ctx = getDecisionContext({
      ultima_msg_em: new Date(NOW - 2 * 3600000).toISOString(), // 2h ago
      ultima_msg_de: 'operador',
      created_at: new Date(NOW - 86400000).toISOString(),
      estado_painel: 'em_atendimento',
      status_negocio: 'analise_viabilidade',
      prazo_proxima_acao: new Date(NOW + 12 * 3600000).toISOString(), // 12h in future
    }, NOW)

    expect(ctx.isCritical).toBe(false)
    expect(ctx.isStale).toBe(false)
    expect(ctx.hasPrereq).toBe(false)
    expect(ctx.responsavel).toBe('cliente') // operador sent last → waiting for client
    expect(ctx.summary).toContain('Aguardando resposta externa')
  })

  it('returns prereq info for stages with prerequisites', () => {
    const ctx = getDecisionContext({
      ultima_msg_em: null,
      ultima_msg_de: null,
      created_at: new Date(NOW - 86400000).toISOString(),
      estado_painel: 'em_atendimento',
      status_negocio: 'recebimento_documentos',
      prazo_proxima_acao: new Date(NOW + 3600000).toISOString(),
    }, NOW)

    expect(ctx.hasPrereq).toBe(true)
    expect(ctx.prereqKey).toBe('docs_recebidos')
    expect(ctx.prereqQuestion).toBe('Todos os documentos foram recebidos?')
  })

  it('returns no prereq for stages without prerequisites', () => {
    const ctx = getDecisionContext({
      ultima_msg_em: null,
      ultima_msg_de: null,
      created_at: new Date(NOW - 86400000).toISOString(),
      estado_painel: 'em_atendimento',
      status_negocio: 'analise_viabilidade',
      prazo_proxima_acao: new Date(NOW + 3600000).toISOString(),
    }, NOW)

    expect(ctx.hasPrereq).toBe(false)
    expect(ctx.prereqKey).toBeNull()
  })

  it('handles triagem state correctly', () => {
    const ctx = getDecisionContext({
      ultima_msg_em: new Date(NOW - 10 * 60000).toISOString(),
      ultima_msg_de: 'cliente',
      created_at: new Date(NOW - 3600000).toISOString(),
      estado_painel: 'triagem',
      status_negocio: null,
      prazo_proxima_acao: null,
    }, NOW)

    expect(ctx.isStale).toBe(false) // inactivity only for em_atendimento
    expect(ctx.hasPrereq).toBe(false)
    expect(ctx.nextAction).toBeNull()
  })

  it('generates correct priority reason for recent client response', () => {
    const ctx = getDecisionContext({
      ultima_msg_em: new Date(NOW - 3 * 60000).toISOString(), // 3min ago
      ultima_msg_de: 'cliente',
      created_at: new Date(NOW - 86400000).toISOString(),
      estado_painel: 'em_atendimento',
      status_negocio: 'retorno_cliente',
      prazo_proxima_acao: new Date(NOW + 24 * 3600000).toISOString(), // 24h in future (well within SLA)
    }, NOW)

    expect(ctx.priorityReason).toBe('Acabou de responder')
    expect(ctx.responsavel).toBe('interno') // client sent last → operator's turn
  })
})
