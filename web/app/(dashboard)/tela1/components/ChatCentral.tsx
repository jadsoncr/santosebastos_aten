'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import ProgressBar from './ProgressBar'
import QuickReplies from './QuickReplies'
import SmartSnippets from './SmartSnippets'
import PopupEnfileirar from './PopupEnfileirar'
import PopupAguardando from './PopupAguardando'
import { displayPhone, phoneTag } from '@/utils/format'
import { COPY } from '@/utils/copy'
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
  const [isAssumido, setIsAssumido] = useState(lead?.is_assumido ?? false)
  const [channelMap, setChannelMap] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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
    if (!lead) { setMensagens([]); setIsAssumido(false); return }
    setIsAssumido(lead.is_assumido ?? false)

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

  // Load channel map for badge display
  useEffect(() => {
    if (!lead) { setChannelMap({}); return }
    async function loadChannels() {
      const { data: leadData } = await supabase
        .from('leads')
        .select('identity_id')
        .eq('id', lead!.id)
        .maybeSingle()
      if (!leadData?.identity_id) return
      const { data: channels } = await supabase
        .from('identity_channels')
        .select('channel, channel_user_id')
        .eq('identity_id', leadData.identity_id)
      if (channels) {
        const map: Record<string, string> = {}
        channels.forEach(c => { map[c.channel_user_id] = c.channel })
        setChannelMap(map)
      }
    }
    loadChannels()
  }, [lead?.id])

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

    // Emit typing with 500ms debounce
    if (lead && socket && value.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('operador_digitando', {
          lead_id: lead.id,
          operador_nome: 'Operador',
        })
      }, 500)
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

    // Mensagem humana ativa o silenciador no server — atualizar badge local
    if (!isNotaInterna) {
      setIsAssumido(true)
    }

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
        {COPY.chat.selecioneConversa}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-bg-surface flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {lead.nome || displayPhone(lead.telefone) || 'Lead'}
          </span>
          {isAssumido ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent">
              {COPY.chat.atendimentoHumano}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/10 text-warning">
              {COPY.chat.automacaoAtiva}
            </span>
          )}
        </div>
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

      {/* Pipeline Progress */}
      <div className="px-4 py-1.5 border-b border-border bg-bg-primary">
        <ProgressBar currentStage={(lead as any).status_pipeline} />
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
                    <span className="text-xs font-medium text-warning">{COPY.chat.notaInterna}</span>
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
                  {!sent && msg.tipo !== 'sistema' && msg.tipo !== 'nota_interna' && channelMap[msg.de] ? (
                    <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded ${
                      channelMap[msg.de] === 'telegram'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-success/10 text-success'
                    }`}>
                      via {channelMap[msg.de] === 'telegram' ? 'Telegram' : 'WhatsApp'}
                    </span>
                  ) : (
                    !sent && phoneTag(msg.de) && <span className="ml-1 opacity-60">via {phoneTag(msg.de)}</span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area — estilo WhatsApp */}
      <div className="px-3 py-2 border-t border-border bg-bg-surface relative">
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

        {/* Toggle nota interna */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsNotaInterna(!isNotaInterna)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isNotaInterna
                ? 'bg-note-internal text-warning border border-warning/30'
                : 'bg-bg-surface-hover text-text-secondary hover:bg-border'
            }`}
          >
            {isNotaInterna ? COPY.chat.notaInterna : COPY.chat.mensagem}
          </button>
        </div>

        {/* Smart Snippets */}
        <SmartSnippets
          lead={lead}
          onInject={(text) => setInput(text)}
          onAssumir={async () => {
            if (!lead.is_assumido) {
              await supabase.from('leads').update({ is_assumido: true }).eq('id', lead.id)
              setIsAssumido(true)
            }
          }}
        />

        {/* Barra de input com botões */}
        <div className="flex items-end gap-2">
          {/* Botão anexo */}
          <button
            type="button"
            title="Anexar arquivo (em breve)"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-text-muted hover:text-text-secondary hover:bg-bg-surface-hover transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Campo de texto */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isNotaInterna ? 'Escreva uma nota interna...' : 'Digite uma mensagem ou / para atalhos'}
              rows={1}
              className={`w-full rounded-2xl border px-4 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 resize-none max-h-32 ${
                isNotaInterna
                  ? 'bg-note-internal border-warning/30 focus:border-warning focus:ring-warning'
                  : 'bg-bg-primary border-border focus:border-accent focus:ring-accent'
              }`}
              style={{ minHeight: '36px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = '36px'
                target.style.height = Math.min(target.scrollHeight, 128) + 'px'
              }}
            />
          </div>

          {/* Botão enviar OU botão áudio */}
          {input.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              title="Enviar mensagem"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              title="Gravar áudio (em breve)"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-text-muted hover:text-text-secondary hover:bg-bg-surface-hover transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}
        </div>
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
