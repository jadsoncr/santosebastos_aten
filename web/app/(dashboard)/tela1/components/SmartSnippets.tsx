'use client'

import type { Lead } from '../page'

interface SmartSnippetsProps {
  lead: Lead
  onInject: (text: string) => void  // inject text into chat input
  onAssumir: () => void             // mark is_assumido = true
}

export function getSnippets(lead: Lead, isCliente: boolean): string[] {
  const nome = lead.nome || 'cliente'
  const area = lead.area_humano || lead.area_bot || lead.area || 'seu caso'

  if (isCliente) {
    return [
      `Oi ${nome}, estou acessando seu prontuário de ${area} para te dar um retorno.`,
    ]
  }
  return [
    `Olá ${nome}, recebi seu caso de ${area}. Podemos falar agora?`,
  ]
}

export default function SmartSnippets({ lead, onInject, onAssumir }: SmartSnippetsProps) {
  const status = lead.status?.toUpperCase() || ''
  const isCliente = status.includes('CLIENTE')

  const snippets = getSnippets(lead, isCliente)

  const handleClick = (text: string) => {
    onInject(text)
    onAssumir()
  }

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {snippets.map((text, i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleClick(text)}
          className="bg-accent/5 border border-accent/20 text-accent text-xs rounded-full px-3 py-1 hover:bg-accent/10 transition-colors truncate max-w-full"
          title={text}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
