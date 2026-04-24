'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import CardBotTree from './CardBotTree'
import BlocoQualificacao from './BlocoQualificacao'
import type { Lead } from '../page'

interface Props {
  lead: Lead | null
  onLeadUpdate: (lead: Lead) => void
  onLeadClosed: () => void
}

export default function PainelLead({ lead, onLeadUpdate, onLeadClosed }: Props) {
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [isAssumido, setIsAssumido] = useState(false)
  const [isCliente, setIsCliente] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOperadorId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (lead) {
      checkStatus()
    }
  }, [lead?.id])

  async function checkStatus() {
    if (!lead) return
    const { data } = await supabase
      .from('atendimentos')
      .select('owner_id, status')
      .eq('lead_id', lead.id)
      .maybeSingle()
    setIsAssumido(!!data)
    setIsCliente(data?.status === 'convertido')
  }

  if (!lead) {
    return (
      <div className="w-[280px] h-full bg-bg-surface flex items-center justify-center text-text-muted text-sm">
        Nenhum lead selecionado
      </div>
    )
  }

  return (
    <div className="w-[280px] h-full bg-bg-surface overflow-y-auto p-4 space-y-4">
      <CardBotTree lead={lead} isCliente={isCliente} />
      <hr className="border-border" />
      <BlocoQualificacao
        lead={lead}
        isCliente={isCliente}
        isAssumido={isAssumido}
        operadorId={operadorId}
        onLeadUpdate={onLeadUpdate}
        onLeadClosed={onLeadClosed}
      />
    </div>
  )
}
