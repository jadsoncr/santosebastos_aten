'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSocket } from '@/components/providers/SocketProvider'
import type { EstadoPainel } from '@/utils/painelModes'

export interface PainelContext {
  lead_id: string
  identity_id: string | null
  atendimento_id: string | null
  estado_painel: EstadoPainel | null
  status_negocio: string | null
  owner_id: string | null
  owner_nome: string | null
  destino: string | null
  prazo_proxima_acao: string | null
  motivo_perda: string | null
  valor_contrato: number | null
  status_pagamento: string | null
  encerrado_em: string | null
  ciclo: number | null
  percentual_exito: number | null
  estado_valor: string | null
  snapshot_version: number
  loading: boolean
  refetch: () => void
}

const EMPTY_CTX: Omit<PainelContext, 'lead_id' | 'refetch'> = {
  identity_id: null,
  atendimento_id: null,
  estado_painel: null,
  status_negocio: null,
  owner_id: null,
  owner_nome: null,
  destino: null,
  prazo_proxima_acao: null,
  motivo_perda: null,
  valor_contrato: null,
  status_pagamento: null,
  encerrado_em: null,
  ciclo: null,
  percentual_exito: null,
  estado_valor: null,
  snapshot_version: 0,
  loading: false,
}

interface LeadInput {
  id: string
  identity_id?: string | null
}

/**
 * usePainelContext — Single source of truth for panel state.
 *
 * Loads atendimento context by identity_id (preferred) or lead_id (fallback).
 * Listens for `estado_painel_changed` socket events for real-time updates.
 */
export function usePainelContext(lead: LeadInput | null): PainelContext {
  const [ctx, setCtx] = useState<Omit<PainelContext, 'lead_id' | 'refetch'>>(EMPTY_CTX)
  const supabase = createClient()
  const socket = useSocket()

  const fetchContext = useCallback(async () => {
    if (!lead) {
      setCtx(EMPTY_CTX)
      return
    }

    setCtx(prev => ({ ...prev, loading: true }))

    try {
      let data: any = null

      // Query by identity_id — singleton per identity (no fallback to lead_id)
      if (lead.identity_id) {
        const res = await supabase
          .from('atendimentos')
          .select('id, owner_id, estado_painel, status_negocio, destino, prazo_proxima_acao, motivo_perda, valor_contrato, status_pagamento, encerrado_em, ciclo, percentual_exito, estado_valor, snapshot_version')
          .eq('identity_id', lead.identity_id)
          .maybeSingle()
        data = res.data
      }

      if (data) {
        // Fetch owner name from operadores table
        let ownerNome: string | null = null
        if (data.owner_id) {
          const { data: op } = await supabase
            .from('operadores')
            .select('nome')
            .eq('id', data.owner_id)
            .maybeSingle()
          ownerNome = op?.nome || 'Operador'
        }

        setCtx({
          identity_id: lead.identity_id || null,
          atendimento_id: data.id || null,
          estado_painel: data.estado_painel as EstadoPainel | null,
          status_negocio: data.status_negocio,
          owner_id: data.owner_id,
          owner_nome: ownerNome,
          destino: data.destino,
          prazo_proxima_acao: data.prazo_proxima_acao,
          motivo_perda: data.motivo_perda,
          valor_contrato: data.valor_contrato,
          status_pagamento: data.status_pagamento,
          encerrado_em: data.encerrado_em,
          ciclo: data.ciclo,
          percentual_exito: data.percentual_exito,
          estado_valor: data.estado_valor || 'indefinido',
          snapshot_version: data.snapshot_version ?? 1,
          loading: false,
        })
      } else {
        setCtx({ ...EMPTY_CTX, identity_id: lead.identity_id || null, atendimento_id: null })
      }
    } catch {
      setCtx(prev => ({ ...prev, loading: false }))
    }
  }, [lead?.id, lead?.identity_id])

  // Re-fetch when lead changes
  useEffect(() => {
    fetchContext()
  }, [fetchContext])

  // Listen for estado_painel_changed socket event
  useEffect(() => {
    if (!socket || !lead?.identity_id) return

    const handler = (payload: { identity_id?: string; lead_id?: string; estado_painel: string }) => {
      // Match by identity_id (primary) or lead_id (backward compat from server)
      const matches = payload.identity_id
        ? payload.identity_id === lead.identity_id
        : payload.lead_id === lead.id
      if (!matches) return

      // Full refetch to get all updated fields (status_negocio, prazo, etc.)
      fetchContext()
    }

    socket.on('estado_painel_changed', handler)
    return () => { socket.off('estado_painel_changed', handler) }
  }, [socket, lead?.identity_id])

  // Reconnect: refetch context when socket reconnects
  useEffect(() => {
    if (!socket || !lead?.identity_id) return
    const handleReconnect = () => { fetchContext() }
    socket.on('connect', handleReconnect)
    return () => { socket.off('connect', handleReconnect) }
  }, [socket, lead?.identity_id, fetchContext])

  return {
    lead_id: lead?.id || '',
    ...ctx,
    refetch: fetchContext,
  }
}
