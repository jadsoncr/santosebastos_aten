'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import QuickReplies from './QuickReplies'
import SmartSnippets from './SmartSnippets'
import PopupEnfileirar from './PopupEnfileirar'
import PopupAguardando from './PopupAguardando'
import { displayPhone, phoneTag } from '@/utils/format'
import { COPY } from '@/utils/copy'
import { validateFileSize, validateFileType, formatFileSize } from '@/utils/fileValidation'
import type { Lead } from '../page'

interface Mensagem {
  id: string
  lead_id: string
  de: string
  tipo: string
  conteudo: string
  operador_id: string | null
  created_at: string
  arquivo_url?: string | null
  arquivo_nome?: string | null
  arquivo_tipo?: string | null
  arquivo_tamanho?: number | null
}

interface MensagemLocal extends Mensagem {
  _status?: 'sending' | 'sent' | 'failed'
  _tempId?: string
}

interface Props {
  lead: Lead | null
}

export default function ChatCentral({ lead }: Props) {
  const [mensagens, setMensagens] = useState<MensagemLocal[]>([])
  const [input, setInput] = useState('')
  const [isNotaInterna, setIsNotaInterna] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [quickReplyQuery, setQuickReplyQuery] = useState('')
  const [showEnfileirar, setShowEnfileirar] = useState(false)
  const [showAguardando, setShowAguardando] = useState(false)
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [isAssumido, setIsAssumido] = useState(lead?.is_assumido ?? false)
  const [channelMap, setChannelMap] = useState<Record<string, string>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Presence state (Task 5.1)
  const [viewers, setViewers] = useState<{user_id: string; user_name: string}[]>([])
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Collision warning state (Task 5.3)
  const [currentOwner, setCurrentOwner] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const socket = useSocket()
  const supabase = createClient()

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
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
          // Check if this confirms an optimistic message we sent
          const optimistic = prev.find(m => m._tempId && m._status === 'sending' && m.conteudo === msg.conteudo && m.de === msg.de)
          if (optimistic) {
            return prev.map(m => m._tempId === optimistic._tempId ? { ...msg, _status: 'sent' as const } : m)
          }
          // Dedup by id
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })

        // Browser notification when tab is not focused
        if (document.hidden && Notification.permission === 'granted') {
          new Notification('Nova mensagem', {
            body: msg.conteudo?.slice(0, 100) || 'Mensagem recebida',
            icon: '/favicon.ico',
          })
        }
      }
    }

    const handleErroAssimir = (data: { mensagem: string }) => {
      alert(data.mensagem)
    }

    const handlePipelineError = (data: { lead_id: string; error: string }) => {
      if (data.lead_id === lead.id) {
        alert(`Erro no pipeline: ${data.error}`)
      }
    }

    socket.on('nova_mensagem_salva', handleNovaMensagem)
    socket.on('erro_assumir', handleErroAssimir)
    socket.on('pipeline_error', handlePipelineError)

    return () => {
      socket.off('nova_mensagem_salva', handleNovaMensagem)
      socket.off('erro_assumir', handleErroAssimir)
      socket.off('pipeline_error', handlePipelineError)
    }
  }, [socket, lead?.id])

  // Reconnect: refetch messages when socket reconnects
  useEffect(() => {
    if (!socket) return
    const handleReconnect = () => { loadMessages() }
    socket.on('connect', handleReconnect)
    return () => { socket.off('connect', handleReconnect) }
  }, [socket, loadMessages])

  // Presence: emit user_viewing on mount/lead change, heartbeat every 10s (Task 5.1)
  useEffect(() => {
    if (!socket || !lead || !operadorId) return

    const emitViewing = () => {
      socket.emit('user_viewing', {
        lead_id: lead.id,
        user_id: operadorId,
        user_name: 'Operador',
      })
    }

    emitViewing()
    presenceIntervalRef.current = setInterval(emitViewing, 10000)

    return () => {
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current)
      socket.emit('user_left', { lead_id: lead.id, user_id: operadorId })
    }
  }, [socket, lead?.id, operadorId])

  // Presence indicator: listen for viewing_update (Task 5.2)
  useEffect(() => {
    if (!socket || !lead) return
    const handleViewingUpdate = (data: { lead_id: string; viewers: {user_id: string; user_name: string}[] }) => {
      if (data.lead_id === lead.id) {
        setViewers(data.viewers.filter(v => v.user_id !== operadorId))
      }
    }
    socket.on('viewing_update', handleViewingUpdate)
    return () => { socket.off('viewing_update', handleViewingUpdate) }
  }, [socket, lead?.id, operadorId])

  // Collision warning: listen for assignment_updated (Task 5.3 / 5.4)
  useEffect(() => {
    if (!socket || !lead) return
    const handleAssignment = (data: { lead_id: string; owner_name: string }) => {
      if (data.lead_id === lead.id) setCurrentOwner(data.owner_name)
    }
    socket.on('assignment_updated', handleAssignment)
    return () => { socket.off('assignment_updated', handleAssignment) }
  }, [socket, lead?.id])

  // Reset presence state on lead change (Task 5.4)
  useEffect(() => {
    setViewers([])
    setCurrentOwner(null)
  }, [lead?.id])

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

    const tempId = crypto.randomUUID()
    const conteudo = input.trim()
    const tipo = isNotaInterna ? 'nota_interna' : 'mensagem'

    // Optimistic: add message to local state immediately
    const optimisticMsg: MensagemLocal = {
      id: tempId,
      _tempId: tempId,
      _status: 'sending',
      lead_id: lead.id,
      de: operadorId,
      tipo,
      conteudo,
      operador_id: operadorId,
      created_at: new Date().toISOString(),
    }
    setMensagens(prev => [...prev, optimisticMsg])

    // Timeout: mark as failed if no confirmation in 5s
    setTimeout(() => {
      setMensagens(prev => prev.map(m =>
        m._tempId === tempId && m._status === 'sending'
          ? { ...m, _status: 'failed' }
          : m
      ))
    }, 5000)

    socket.emit('nova_mensagem', {
      lead_id: lead.id,
      de: operadorId,
      conteudo,
      tipo,
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

  // Retry failed message
  const handleRetrySend = (msg: MensagemLocal) => {
    if (!lead || !socket || !operadorId || !msg._tempId) return

    // Reset status to sending
    setMensagens(prev => prev.map(m =>
      m._tempId === msg._tempId ? { ...m, _status: 'sending' as const } : m
    ))

    // Set new timeout
    const tempId = msg._tempId
    setTimeout(() => {
      setMensagens(prev => prev.map(m =>
        m._tempId === tempId && m._status === 'sending'
          ? { ...m, _status: 'failed' as const }
          : m
      ))
    }, 5000)

    socket.emit('nova_mensagem', {
      lead_id: lead.id,
      de: operadorId,
      conteudo: msg.conteudo,
      tipo: msg.tipo,
      operador_id: operadorId,
      origem: 'humano',
    })
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

  // Handle file selection and upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !lead || !socket || !operadorId) return

    // Reset file input so the same file can be selected again
    e.target.value = ''

    // Client-side validation: file size
    const sizeCheck = validateFileSize(file.size)
    if (!sizeCheck.valid) {
      setUploadError(sizeCheck.error ?? 'Arquivo excede o limite de 10 MB')
      setTimeout(() => setUploadError(null), 3000)
      return
    }

    // Client-side validation: MIME type
    const typeCheck = validateFileType(file.type)
    if (!typeCheck.valid) {
      setUploadError(typeCheck.error ?? 'Tipo de arquivo não permitido')
      setTimeout(() => setUploadError(null), 3000)
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('lead_id', lead.id)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Falha no envio do arquivo. Tente novamente.')
        setTimeout(() => setUploadError(null), 3000)
        return
      }

      // Emit file message via socket
      socket.emit('nova_mensagem', {
        lead_id: lead.id,
        de: operadorId,
        conteudo: data.nome,
        tipo: 'arquivo',
        operador_id: operadorId,
        origem: 'humano',
        arquivo_url: data.url,
        arquivo_nome: data.nome,
        arquivo_tipo: data.tipo,
        arquivo_tamanho: data.tamanho,
      })

      setIsAssumido(true)
    } catch {
      setUploadError('Falha no envio do arquivo. Tente novamente.')
      setTimeout(() => setUploadError(null), 3000)
    } finally {
      setIsUploading(false)
    }
  }

  // Format timestamp
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  // Determine message alignment
  const isSent = (msg: Mensagem) => msg.de === 'bot' || msg.de === operadorId

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <svg className="w-10 h-10 text-text-muted/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
        <p className="text-sm text-text-muted">{COPY.chat.selecioneConversa}</p>
        <p className="text-[11px] text-text-muted mt-1">Escolha um prospecto na barra lateral para iniciar</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#E6E8EC]/20 flex items-center justify-between bg-white z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold border border-gray-100 overflow-hidden shadow-sm bg-gray-100 text-gray-400">
            {(lead.nome || displayPhone(lead.telefone) || 'L')?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm tracking-tight">
              {lead.nome || displayPhone(lead.telefone) || 'Lead'}
            </h3>
            <p className="text-[10px] text-gray-400 flex items-center font-bold uppercase tracking-widest gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-blue-500" />
              Online
            </p>
            {viewers.length > 0 && (
              <div className="flex items-center gap-1 ml-2">
                {viewers.map(v => (
                  <span key={v.user_id} className="text-[9px] text-orange-500 font-bold">
                    {v.user_name} está visualizando
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F6F8FC]">
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

          // File message rendering
          if (msg.tipo === 'arquivo') {
            const isImage = msg.arquivo_tipo?.startsWith('image/')
            return (
              <div key={msg.id} className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] px-3 py-2 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                    sent
                      ? 'bg-[#2563EB] text-white rounded-2xl rounded-tr-none'
                      : 'bg-white text-gray-900 rounded-2xl rounded-tl-none border border-white'
                  }`}
                >
                  {isImage && msg.arquivo_url ? (
                    <div>
                      <img
                        src={msg.arquivo_url}
                        alt={msg.arquivo_nome || 'Imagem'}
                        className="max-w-[280px] max-h-[200px] rounded-lg"
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-text-secondary truncate">
                          {msg.arquivo_nome}
                        </span>
                        <a
                          href={msg.arquivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline flex-shrink-0"
                        >
                          Baixar
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-bg-surface flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{msg.arquivo_nome || 'Arquivo'}</p>
                        <p className="text-xs text-text-muted">
                          {msg.arquivo_tamanho ? formatFileSize(msg.arquivo_tamanho) : ''}
                        </p>
                      </div>
                      {msg.arquivo_url && (
                        <a
                          href={msg.arquivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                        >
                          Baixar
                        </a>
                      )}
                    </div>
                  )}
                  <span className="block mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">
                    {formatTime(msg.created_at)}
                    {!sent && channelMap[msg.de] ? (
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
          }

          // Audio message rendering
          if (msg.tipo === 'audio') {
            return (
              <div key={msg.id} className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] px-3 py-2 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                    sent
                      ? 'bg-[#2563EB] text-white rounded-2xl rounded-tr-none'
                      : 'bg-white text-gray-900 rounded-2xl rounded-tl-none border border-white'
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    {msg.arquivo_url && (
                      <audio controls src={msg.arquivo_url} className="max-w-[260px]" />
                    )}
                    <span className="text-xs text-text-secondary truncate">
                      {msg.arquivo_nome || 'Áudio'}
                    </span>
                  </div>
                  <span className="block mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">
                    {formatTime(msg.created_at)}
                    {!sent && channelMap[msg.de] ? (
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
          }

          return (
            <div key={msg.id} className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[70%] px-3 py-2 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                  sent
                    ? 'bg-[#2563EB] text-white rounded-2xl rounded-tr-none'
                    : 'bg-white text-gray-900 rounded-2xl rounded-tl-none border border-white'
                }`}
              >
                <p>{msg.conteudo}</p>
                <span className="block mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">
                  {formatTime(msg.created_at)}
                  {sent && msg._status === 'sending' && <span className="ml-1 text-gray-300">⏳</span>}
                  {sent && msg._status === 'sent' && <span className="ml-1 text-green-300">✓</span>}
                  {sent && msg._status === 'failed' && (
                    <span className="ml-1 text-red-300 cursor-pointer" onClick={() => handleRetrySend(msg)} title="Reenviar">⚠</span>
                  )}
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
      <div className="border-t border-[#E6E8EC]/10 bg-white p-6 relative">
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
        <div className="flex items-end gap-3 bg-[#F8FAFC] p-3 rounded-2xl border border-gray-100/50 shadow-inner">
          {/* Botão anexo */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Anexar arquivo"
            className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 019.95 9" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ogg,.mp3,.mp4,.webm,.wav"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Campo de texto */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isNotaInterna ? 'Escreva uma nota interna...' : 'Digite uma mensagem ou / para atalhos'}
              rows={1}
              className={`w-full text-[13px] font-medium bg-transparent border-none focus:ring-0 resize-none max-h-32 py-1.5 placeholder:text-gray-400 ${
                isNotaInterna
                  ? 'text-warning'
                  : 'text-gray-900'
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
              className="flex-shrink-0 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              title="Gravar áudio (em breve)"
              className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
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

        {/* Upload error message */}
        {uploadError && (
          <div className="mt-2 px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs">
            {uploadError}
          </div>
        )}
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
