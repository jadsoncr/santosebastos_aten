/**
 * systemFlow.ts — Declaração explícita de todas as transições entre sistemas.
 *
 * NÃO é lógica executável. É documentação viva que:
 * 1. Formaliza o que os handlers já fazem
 * 2. Serve como referência pra qualquer dev
 * 3. Base pra métricas de conversão por etapa
 * 4. Evita regressão silenciosa
 *
 * REGRA: se mudar um handler, atualiza aqui.
 */

// ═══════════════════════════════════════════════════════════════
// SISTEMAS (onde o lead pode estar)
// ═══════════════════════════════════════════════════════════════

export type Sistema = 'entrada' | 'relacionamento' | 'backoffice' | 'recuperacao' | 'financeiro' | 'encerrado'

// ═══════════════════════════════════════════════════════════════
// TRANSIÇÕES ENTRE SISTEMAS
// ═══════════════════════════════════════════════════════════════

export interface Transicao {
  de: Sistema
  para: Sistema
  trigger: string           // o que dispara
  handler: string           // onde está no código
  condicao: string          // quando acontece
  socket_event?: string     // evento emitido
}

export const SYSTEM_TRANSITIONS: Transicao[] = [
  // ENTRADA → RELACIONAMENTO
  {
    de: 'entrada',
    para: 'relacionamento',
    trigger: 'Mensagem do cliente (bot/URA)',
    handler: 'server.js → webhook → upsert lead',
    condicao: 'Primeiro contato ou lead sem atendimento',
    socket_event: 'lead_novo',
  },

  // RELACIONAMENTO → BACKOFFICE
  {
    de: 'relacionamento',
    para: 'backoffice',
    trigger: 'Operador classifica com destino=backoffice',
    handler: 'PainelLead.tsx → handleClassificar()',
    condicao: 'resolveClassification(subcategoria).destino === "backoffice"',
    socket_event: 'conversa_classificada',
  },

  // RELACIONAMENTO → ENCERRADO
  {
    de: 'relacionamento',
    para: 'encerrado',
    trigger: 'Operador classifica com destino=encerrado',
    handler: 'PainelLead.tsx → handleClassificar()',
    condicao: 'resolveClassification(subcategoria).destino === "encerrado"',
    socket_event: 'conversa_classificada',
  },

  // RELACIONAMENTO → ENCERRADO (não fechou)
  {
    de: 'relacionamento',
    para: 'encerrado',
    trigger: 'Operador marca "Não fechou"',
    handler: 'PainelLead.tsx → handleNaoFechou()',
    condicao: 'Motivo de perda selecionado',
    socket_event: 'lead_encerrado',
  },

  // BACKOFFICE → BACKOFFICE (progressão no pipeline)
  {
    de: 'backoffice',
    para: 'backoffice',
    trigger: 'Operador avança status',
    handler: 'tela2/page.tsx → handleAvancar()',
    condicao: 'ACTION_MAP[status_atual].targetStatus',
    socket_event: 'status_negocio_changed',
  },

  // BACKOFFICE → RECUPERAÇÃO (perdido)
  {
    de: 'backoffice',
    para: 'recuperacao',
    trigger: 'Operador marca "Desistiu"',
    handler: 'tela2/page.tsx → handleDesistiu()',
    condicao: 'validateBusinessTransition(current, "perdido")',
    socket_event: 'status_negocio_changed',
  },

  // RECUPERAÇÃO → BACKOFFICE (reengajar)
  {
    de: 'recuperacao',
    para: 'backoffice',
    trigger: 'Operador clica "Reengajar"',
    handler: 'tela2/page.tsx → handleReengajar()',
    condicao: 'validateBusinessTransition("perdido", "aguardando_agendamento")',
    socket_event: 'conversa_resgatada',
  },

  // RECUPERAÇÃO → RELACIONAMENTO (resgate de abandonado/outro)
  {
    de: 'recuperacao',
    para: 'relacionamento',
    trigger: 'Operador clica ChevronRight no card de recuperação',
    handler: 'tela2/page.tsx → handleRescue()',
    condicao: 'Sempre (redireciona pra tela1)',
    socket_event: 'conversa_resgatada',
  },

  // BACKOFFICE → FINANCEIRO (fechado)
  {
    de: 'backoffice',
    para: 'financeiro',
    trigger: 'Operador avança até "fechado"',
    handler: 'tela2/page.tsx → handleAvancar() com targetStatus="fechado"',
    condicao: 'ACTION_MAP["aguardando_contrato"].targetStatus === "fechado"',
    socket_event: 'status_negocio_changed',
  },

  // ENCERRADO → RECUPERAÇÃO (visível na seção amarela)
  {
    de: 'encerrado',
    para: 'recuperacao',
    trigger: 'Automático (query de recuperação inclui encerrados)',
    handler: 'tela2/page.tsx → loadData() → query destino="encerrado"',
    condicao: 'Sempre visível na seção de recuperação',
  },

  // ENTRADA → RELACIONAMENTO (reentrada / reaquecido)
  {
    de: 'entrada',
    para: 'relacionamento',
    trigger: 'Cliente manda mensagem após encerramento',
    handler: 'server.js → webhook → is_reaquecido = true',
    condicao: 'Lead com atendimento encerrado/convertido/nao_fechou',
    socket_event: 'lead_reaquecido',
  },
]

// ═══════════════════════════════════════════════════════════════
// PIPELINE DO BACKOFFICE (ACTION_MAP states)
// ═══════════════════════════════════════════════════════════════

export const PIPELINE_STATES = [
  'aguardando_agendamento',
  'reuniao_agendada',
  'aguardando_proposta',
  'negociacao',
  'aguardando_contrato',
  'fechado',
] as const

export const TERMINAL_STATES = ['fechado', 'perdido', 'resolvido'] as const

// ═══════════════════════════════════════════════════════════════
// VISIBILIDADE POR TELA (onde cada lead aparece)
// ═══════════════════════════════════════════════════════════════

export const VISIBILITY_RULES = {
  sidebar_tela1: 'leads SEM status_negocio (não classificados)',
  lista_tela2: 'atendimentos com status_negocio IS NOT NULL AND destino = "backoffice" AND status_negocio NOT IN ("fechado", "perdido")',
  ganhos_tela2: 'atendimentos com status_negocio = "fechado"',
  perdidos_tela2: 'atendimentos com status_negocio = "perdido" AND destino = "backoffice"',
  recuperacao_encerrados: 'atendimentos com destino = "encerrado"',
  recuperacao_abandonados: 'abandonos table',
  recuperacao_outros: 'others table',
  financeiro: 'atendimentos com status_negocio = "fechado" OR status = "convertido"',
} as const
