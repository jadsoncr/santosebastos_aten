'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import QuickReplies from './QuickReplies'
import PopupEnfileirar from './PopupEnfileirar'
import PopupAguardando from './PopupAguardando'
import { displayPhone, phoneTag } from '@/utils/format'
import type { Lead } from '../page'

interface Mensagem {
  id: string
  lead_id: string
  de: string
  tipo: string
  conteudo: string
  operador_id: string | null
  created_at: string
}

interface Props {
  lead: Lead | null
}

export default function ChatCentral({ lead }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [isNotaInterna, setIsNotaInterna] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [quickReplyQuery, setQuickReplyQuery] = useState('')
  const [showEnfileirar, setShowEnfileirar] = useState(false)
  const [showAguardando, setShowAguardando] = useState(false)
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const socket = useSocket()
  const supabase = createClient()

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  // Load messages when lead changes
  const loadMessages = useCallback(async () => {
    if (!lead) { setMensagens([]); return }

    // Buscar todas as mensagens de todos os leads deste identity_id
    // Primeiro, pegar o identity_id do lead
    const { data: leadData } = await supabase
      .from('leads')
      .select('identity_id')
      .eq('id', lead.id)
      .maybeSingle()

    if (!leadData?.identity_id) {
      // Fallback: buscar por lead_id direto
      const { data } = await supabase
        .from('mensagens')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })
      if (data) setMensagens(data)
      return
    }

    // Buscar todos os leads deste identity_id
    const { data: allLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('identity_id', leadData.identity_id)

    const leadIds = (allLeads || []).map(l => l.id)
    if (leadIds.length === 0) { setMensagens([]); return }

    // Buscar mensagens de todos os leads
    const { data } = await supabase
      .from('mensagens')
      .select('*')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: true })
    if (data) setMensagens(data)
  }, [lead?.id])

  useEffect(() => { loadMessages() }, [loadMessages])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Socket: listen for new messages
  useEffect(() => {
    if (!socket || !lead) return

    const handleNovaMensagem = (msg: Mensagem) => {
      if (msg.lead_id === lead.id) {
        setMensagens(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      }
    }

    const handleErroAssimir = (data: { mensagem: string }) => {
      alert(data.mensagem)
    }

    socket.on('nova_mensagem_salva', handleNovaMensagem)
    socket.on('erro_assumir', handleErroAssimir)

    return () => {
      socket.off('nova_mensagem_salva', handleNovaMensagem)
      socket.off('erro_assumir', handleErroAssimir)
    }
  }, [socket, lead?.id])

  // Handle input change with '/' detection
  const handleInputChange = (value: string) => {
    setInput(value)
    if (value.startsWith('/')) {
      setShowQuickReplies(true)
      setQuickReplyQuery(value.slice(1))
    } else {
      setShowQuickReplies(false)
      setQuickReplyQuery('')
    }
  }

  // Send message
  const handleSend = () => {
    if (!input.trim() || !lead || !socket || !operadorId) return

    socket.emit('nova_mensagem', {
      lead_id: lead.id,
      de: operadorId,
      conteudo: input.trim(),
      tipo: isNotaInterna ? 'nota_interna' : 'mensagem',
      operador_id: operadorId,
      origem: 'humano',
    })

    setInput('')
    setShowQuickReplies(false)
  }

  // Key handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setShowQuickReplies(false)
    }
  }

  // Actions
  const handleAssumir = () => {
    if (!socket || !lead || !operadorId) return
    socket.emit('assumir_lead', { lead_id: lead.id, operador_id: operadorId })
  }

  const handleEncerrar = () => setShowEnfileirar(true)

  // Format timestamp
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  // Determine message alignment
  const isSent = (msg: Mensagem) => msg.de === 'bot' || msg.de === operadorId

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Selecione uma conversa
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-bg-surface flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">
          {lead.nome || displayPhone(lead.telefone) || 'Lead'}
        </span>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-bg-surface-hover text-text-primary hover:bg-border">
            DELEGAR
          </button>
          <button onClick={() => setShowAguardando(true)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-warning/10 text-warning hover:bg-warning/20">
            AGUARDANDO
          </button>
          <button
            onClick={handleEncerrar}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-error/10 text-error hover:bg-error/20"
          >
            ENCERRAR
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensagens.map(msg => {
          // System log (bot analysis)
          if (msg.tipo === 'sistema') {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="px-3 py-1.5 rounded-full bg-bg-surface text-text-muted text-xs font-mono">
                  {msg.conteudo}
                </div>
              </div>
            )
          }

          if (msg.tipo === 'nota_interna') {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="max-w-[70%] rounded-lg px-3 py-2 bg-note-internal text-text-primary text-sm border border-warning/30">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-medium text-warning">📝 Nota interna</span>
                  </div>
                  <p>{msg.conteudo}</p>
                  <span className="font-mono text-xs text-text-muted block mt-1">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            )
          }

          const sent = isSent(msg)
          return (
            <div key={msg.id} className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[70%] px-3 py-2 text-sm text-text-primary ${
                  sent
                    ? 'bg-chat-sent rounded-[12px_0_12px_12px]'
                    : 'bg-chat-received rounded-[0_12px_12px_12px]'
                }`}
              >
                <p>{msg.conteudo}</p>
                <span className="font-mono text-xs text-text-muted block mt-1">
                  {formatTime(msg.created_at)}
                  {!sent && phoneTag(msg.de) && <span className="ml-1 opacity-60">via {phoneTag(msg.de)}</span>}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border bg-bg-surface relative">
        {showQuickReplies && operadorId && (
          <QuickReplies
            query={quickReplyQuery}
            operadorId={operadorId}
            onSelect={(conteudo) => {
              setInput(conteudo)
              setShowQuickReplies(false)
              inputRef.current?.focus()
            }}
            onClose={() => setShowQuickReplies(false)}
          />
        )}

        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsNotaInterna(!isNotaInterna)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              isNotaInterna
                ? 'bg-note-internal text-warning border border-warning/30'
                : 'bg-bg-surface-hover text-text-secondary hover:bg-border'
            }`}
          >
            {isNotaInterna ? '📝 Nota interna' : '💬 Mensagem'}
          </button>
        </div>

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isNotaInterna ? 'Escreva uma nota interna...' : 'Digite uma mensagem ou / para respostas rápidas'}
          rows={1}
          className={`w-full rounded-md border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 resize-none ${
            isNotaInterna
              ? 'bg-note-internal border-warning/30 focus:border-warning focus:ring-warning'
              : 'bg-bg-primary border-border focus:border-accent focus:ring-accent'
          }`}
        />
      </div>

      {/* Popup Enfileirar */}
      {showEnfileirar && operadorId && (
        <PopupEnfileirar
          leadId={lead.id}
          operadorId={operadorId}
          onClose={() => setShowEnfileirar(false)}
          onSuccess={() => setShowEnfileirar(false)}
        />
      )}

      {/* Popup Aguardando */}
      {showAguardando && operadorId && (
        <PopupAguardando
          leadId={lead.id}
          operadorId={operadorId}
          onClose={() => setShowAguardando(false)}
          onSuccess={() => setShowAguardando(false)}
        />
      )}
    </div>
  )
}
