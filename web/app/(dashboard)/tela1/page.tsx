'use client'

import { useState } from 'react'
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
}

export default function Tela1Page() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const handleLeadClosed = () => {
    setSelectedLead(null)
  }

  return (
    <div className="flex h-full -m-6">
      <ConversasSidebar
        selectedLeadId={selectedLead?.id ?? null}
        onSelectLead={setSelectedLead}
      />
      <div className="flex-1 border-x border-border">
        <ChatCentral lead={selectedLead} />
      </div>
      <PainelLead lead={selectedLead} onLeadUpdate={setSelectedLead} onLeadClosed={handleLeadClosed} />
    </div>
  )
}
