/**
 * Resolve a intenção consolidada do cliente baseada nas mensagens recentes.
 * NÃO depende cegamente da URA — interpreta comportamento real.
 */

export interface MensagemSimples {
  conteudo: string
  tipo?: string | null
  de?: string | null
}

export interface LeadParaIntencao {
  resumo?: string | null
  area_bot?: string | null
  area?: string | null
  mensagens?: MensagemSimples[]
}

const KEYWORDS: [RegExp, string][] = [
  [/advogad/i, 'Falar com advogado'],
  [/trabalh|demiss|rescis|fgts|clt/i, 'Problema trabalhista'],
  [/fam[ií]l|pens[aã]o|div[oó]rc|guard/i, 'Questão de família'],
  [/consum|compra|produto|loja|devol/i, 'Direito do consumidor'],
  [/contrat|honor[aá]r|valor|pre[cç]o/i, 'Consulta sobre valores'],
  [/j[aá]\s*(sou|é)\s*client/i, 'Já é cliente'],
  [/urgent|r[aá]pid|agora|precis/i, 'Atendimento urgente'],
]

export function getIntencaoAtual(lead: LeadParaIntencao): string {
  const mensagens = lead.mensagens || []

  // Pegar últimas mensagens do cliente (ignorar bot/sistema/nota)
  const msgsCliente = mensagens
    .filter(m => m.de !== 'bot' && m.tipo !== 'sistema' && m.tipo !== 'nota_interna')
    .slice(-15)

  if (msgsCliente.length > 0) {
    const textoCompleto = msgsCliente.map(m => (m.conteudo || '').toLowerCase()).join(' ')

    for (const [regex, label] of KEYWORDS) {
      if (regex.test(textoCompleto)) return label
    }
  }

  // Fallback: usar resumo se for texto legível (não números/códigos)
  if (lead.resumo && !lead.resumo.startsWith('{') && lead.resumo.length > 5 && !/^\d[\s—\-\d]+$/.test(lead.resumo.trim())) {
    return lead.resumo
  }

  // Fallback: interpretar JSON antigo
  if (lead.resumo && lead.resumo.startsWith('{')) {
    return normalizarResumo(lead.resumo, lead.area_bot)
  }

  // Fallback final
  return lead.area_bot || lead.area || 'Cliente não especificou'
}

/**
 * Transforma JSON bruto da URA em texto humano.
 */
export function normalizarResumo(resumo: string, areBot?: string | null): string {
  try {
    const obj = JSON.parse(resumo)
    const parts: string[] = []

    if (obj.area || areBot) parts.push(obj.area || areBot)
    if (obj.tipo) parts.push(obj.tipo)
    if (obj.status) parts.push(obj.status)
    if (obj.assunto) parts.push(obj.assunto)

    if (parts.length > 0) return parts.join(' — ')
    return areBot || 'Atendimento'
  } catch {
    return resumo || 'Sem resumo'
  }
}
