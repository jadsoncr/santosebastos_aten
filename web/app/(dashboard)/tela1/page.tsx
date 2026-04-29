'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ConversasSidebar from './components/ConversasSidebar'
import ChatCentral from './components/ChatCentral'
import PainelLead from './components/PainelLead'

export interface Lead {
  id: string
  nome: string | null
  telefone: string | null
  area: string | null
  area_bot: string | null
  area_humano: string | null
  score: number
  prioridade: string
  canal_origem: string | null
  created_at: string
  resumo: string | null
  corrigido: boolean
  is_reaquecido?: boolean
  is_assumido?: boolean
  status?: string | null
  status_pipeline?: string | null
  segmento_id?: string | null
  assunto_id?: string | null
  especificacao_id?: string | null
  email?: string | null
  identity_id?: string | null
  ultima_msg_em?: string | null
  ultima_msg_de?: string | null
  channel_user_id?: string | null
}

export default function Tela1Page() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [closedLeadId, setClosedLeadId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Handle ?lead=UUID from Tela 2 "Abrir no chat"
  useEffect(() => {
    const leadId = searchParams.get('lead')
    if (leadId && !selectedLead) {
      supabase.from('leads').select('*').eq('id', leadId).maybeSingle().then(({ data }) => {
        if (data) setSelectedLead({ ...data, corrigido: data.corrigido ?? false })
      })
    }
  }, [searchParams])

  const handleLeadClosed = () => {
    if (selectedLead) setClosedLeadId(selectedLead.id)
    setSelectedLead(null)
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#F7F8FA]">
      <ConversasSidebar
        selectedLeadId={selectedLead?.id ?? null}
        onSelectLead={setSelectedLead}
        closedLeadId={closedLeadId}
      />
      <div className="flex-1 flex flex-col bg-[#F6F8FC]">
        <ChatCentral lead={selectedLead} />
      </div>
      <PainelLead lead={selectedLead} onLeadUpdate={setSelectedLead} onLeadClosed={handleLeadClosed} />
    </div>
  )
}
