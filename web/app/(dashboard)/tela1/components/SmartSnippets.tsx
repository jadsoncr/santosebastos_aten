'use client'

import { useState } from 'react'
import type { Lead } from '../page'

interface SmartSnippetsProps {
  lead: Lead
  onInject: (text: string) => void
  onAssumir: () => void
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

  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleClick = (text: string) => {
    onInject(text)
    onAssumir()
  }

  const handleEdit = (idx: number, text: string) => {
    setEditingIdx(idx)
    setEditValue(text)
  }

  const handleSaveEdit = (idx: number) => {
    if (editValue.trim()) {
      snippets[idx] = editValue.trim()
    }
    setEditingIdx(null)
  }

  return (
    <div className="space-y-1.5 mb-2">
      {snippets.map((text, i) => (
        <div
          key={i}
          className="bg-blue-50 border border-dashed border-accent/30 rounded-lg px-3 py-2 flex items-start gap-2"
        >
          {editingIdx === i ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSaveEdit(i)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(i) }}
              className="flex-1 bg-transparent text-xs text-text-primary outline-none border-b border-accent/30 pb-0.5"
            />
          ) : (
            <button
              type="button"
              onClick={() => handleClick(text)}
              className="flex-1 text-left text-xs text-accent hover:text-accent-hover transition-colors leading-relaxed"
              title="Clique para injetar no chat"
            >
              {text}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleEdit(i, text)}
            className="shrink-0 w-5 h-5 flex items-center justify-center text-text-muted hover:text-accent transition-colors"
            title="Editar template"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
