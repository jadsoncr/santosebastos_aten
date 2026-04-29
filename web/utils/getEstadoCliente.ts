/**
 * Classifica o estado comportamental do cliente baseado nas mensagens.
 * Detecta: confuso (loops), perdido (respostas inválidas), ativo (normal).
 */

export type EstadoCliente = 'ativo' | 'confuso' | 'perdido'

export interface MensagemParaEstado {
  conteudo: string
  de?: string | null
  tipo?: string | null
}

export function getEstadoCliente(mensagens: MensagemParaEstado[]): EstadoCliente {
  // Só mensagens do cliente
  const msgsCliente = mensagens
    .filter(m => m.de !== 'bot' && m.tipo !== 'sistema' && m.tipo !== 'nota_interna')
    .slice(-20)

  if (msgsCliente.length === 0) return 'ativo'

  let repeticoes = 0
  let respostasInvalidas = 0
  let reiniciosFluxo = 0

  for (const m of msgsCliente) {
    const texto = (m.conteudo || '').trim().toLowerCase()

    // Detectar loops (oi, olá, ola repetidos)
    if (/^(oi|ol[aá]|hey|opa|bom dia|boa tarde|boa noite)$/i.test(texto)) {
      repeticoes++
    }

    // Respostas muito curtas ou só números (possível confusão com menu)
    if (texto.length <= 2) {
      respostasInvalidas++
    }

    // Reinício de fluxo (palavras que indicam "começar de novo")
    if (/^(voltar|menu|inicio|começar|recomeçar)$/i.test(texto)) {
      reiniciosFluxo++
    }
  }

  if (repeticoes >= 4 || reiniciosFluxo >= 3) return 'confuso'
  if (respostasInvalidas >= 6) return 'perdido'

  return 'ativo'
}

export function getEstadoLabel(estado: EstadoCliente): string {
  switch (estado) {
    case 'confuso': return 'Confuso'
    case 'perdido': return 'Perdido'
    case 'ativo': return 'Ativo'
  }
}

export function getEstadoColor(estado: EstadoCliente): string {
  switch (estado) {
    case 'confuso': return 'text-yellow-600'
    case 'perdido': return 'text-red-500'
    case 'ativo': return 'text-green-600'
  }
}
