'use client'

import { useState } from 'react'
import FilterSidebar from './components/FilterSidebar'
import MetricsPanel from './components/MetricsPanel'
import LeadList from './components/LeadList'
import DetailPanel from './components/DetailPanel'

export interface LeadCliente {
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
  status: string | null
}

export interface Filters {
  status: string | null
  prioridade: string | null
  area: string | null
}

export default function TelaClientesPage() {
  const [selectedLead, setSelectedLead] = useState<LeadCliente | null>(null)
  const [filters, setFilters] = useState<Filters>({ status: null, prioridade: null, area: null })

  return (
    <div className="flex h-full -m-6">
      <FilterSidebar filters={filters} onFilterChange={setFilters} />
      <div className="flex-1 flex flex-col border-x border-border overflow-hidden">
        <MetricsPanel />
        <LeadList
          filters={filters}
          selectedLeadId={selectedLead?.id ?? null}
          onSelectLead={setSelectedLead}
        />
      </div>
      <DetailPanel lead={selectedLead} />
    </div>
  )
}
