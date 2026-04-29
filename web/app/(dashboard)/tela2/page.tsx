'use client'

import { useState } from 'react'
import BackofficeSidebar from './components/BackofficeSidebar'
import ChatCentral from '../tela1/components/ChatCentral'
import PainelLead from '../tela1/components/PainelLead'
import type { Lead } from '../tela1/page'

export default function BackOfficePage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const handleLeadClosed = () => {
    setSelectedLead(null)
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#F7F8FA]">
      <BackofficeSidebar
        selectedLeadId={selectedLead?.id ?? null}
        onSelectLead={setSelectedLead}
      />
      <div className="flex-1 flex flex-col bg-[#F6F8FC]">
        <ChatCentral lead={selectedLead} />
      </div>
      <PainelLead
        lead={selectedLead}
        onLeadUpdate={setSelectedLead}
        onLeadClosed={handleLeadClosed}
      />
    </div>
  )
}
