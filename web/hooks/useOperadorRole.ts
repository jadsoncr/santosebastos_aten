'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type OperadorRole = 'owner' | 'operador' | null

export function useOperadorRole(): { role: OperadorRole; operadorId: string | null } {
  const [role, setRole] = useState<OperadorRole>(null)
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setOperadorId(user.id)

      const { data: op } = await supabase
        .from('operadores')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      setRole((op?.role as OperadorRole) || 'operador')
    }
    load()
  }, [])

  return { role, operadorId }
}
