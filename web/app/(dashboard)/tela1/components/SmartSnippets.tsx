'use client'

import { useState, useEffect } from 'react'
import type { Lead } from '../page'

interface SmartSnippetsProps {
  lead: Lead
  onInject: (text: string) => void
  onAssumir: () => void
}

function buildSnippets(lead: Lead, isCliente: boolean): string[] {
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

export { buildSnippets as getSnippets }

export default function SmartSnippets({ lead, onInject, onAssumir }: SmartSnippetsProps) {
  const status = lead.status?.toUpperCase() || ''
  const isCliente = status.includes('CLIENTE')

  const [texts, setTexts] = useState<string[]>(() => buildSnippets(lead, isCliente))
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  // Rebuild when lead changes
  useEffect(() => {
    setTexts(buildSnippets(lead, isCliente))
    setEditingIdx(null)
  }, [lead.id, lead.nome, lead.area, lead.area_humano, lead.area_bot])

  const handleInject = (text: string) => {
    onInject(text)
    onAssumir()
  }

  const handleStartEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditValue(texts[idx])
  }

  const handleSaveEdit = () => {
    if (editingIdx === null) return
    if (editValue.trim()) {
      setTexts(prev => {
        const next = [...prev]
        next[editingIdx] = editValue.trim()
        return next
      })
    }
    setEditingIdx(null)
  }

  return (
    <div className="space-y-1.5 mb-2">
      {texts.map((text, i) => (
        <div
          key={i}
          className="bg-blue-50 border border-dashed border-accent/30 rounded-lg px-3 py-2 flex items-start gap-2"
        >
          {editingIdx === i ? (
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSaveEdit()
                }
                if (e.key === 'Escape') {
                  setEditingIdx(null)
                }
              }}
              rows={2}
              className="flex-1 bg-white text-xs text-text-primary outline-none border border-accent/30 rounded px-2 py-1 resize-none focus:ring-1 focus:ring-accent"
            />
          ) : (
            <button
              type="button"
              onClick={() => handleInject(text)}
              className="flex-1 text-left text-xs text-accent hover:text-accent-hover transition-colors leading-relaxed"
              title="Clique para injetar no chat"
            >
              {text}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleStartEdit(i)
            }}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
            title="Editar template"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
