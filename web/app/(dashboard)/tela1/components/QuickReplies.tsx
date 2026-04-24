'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

interface QuickReply {
  id: string
  atalho: string
  conteudo: string
}

interface Props {
  query: string
  operadorId: string
  onSelect: (conteudo: string) => void
  onClose: () => void
}

export default function QuickReplies({ query, operadorId, onSelect, onClose }: Props) {
  const [replies, setReplies] = useState<QuickReply[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const supabase = createClient()

  const loadReplies = useCallback(async () => {
    const { data } = await supabase
      .from('quick_replies')
      .select('id, atalho, conteudo')
      .or(`compartilhado.eq.true,criado_por.eq.${operadorId}`)

    if (data) setReplies(data)
  }, [operadorId])

  useEffect(() => { loadReplies() }, [loadReplies])

  const filtered = replies.filter(r =>
    !query || r.atalho.toLowerCase().includes(query.toLowerCase()) ||
    r.conteudo.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => { setSelectedIndex(0) }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        onSelect(filtered[selectedIndex].conteudo)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, selectedIndex, onSelect, onClose])

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 w-full max-h-48 overflow-y-auto bg-bg-primary border border-border rounded-md shadow-lg z-10 mb-2">
      {filtered.map((reply, i) => (
        <div
          key={reply.id}
          onClick={() => onSelect(reply.conteudo)}
          className={`px-3 py-2 cursor-pointer ${
            i === selectedIndex ? 'bg-bg-surface-hover' : 'hover:bg-bg-surface-hover'
          }`}
        >
          <span className="text-xs font-mono text-accent">/{reply.atalho}</span>
          <p className="text-sm text-text-primary truncate">{reply.conteudo}</p>
        </div>
      ))}
    </div>
  )
}
