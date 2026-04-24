'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Props {
  leadId: string
  operadorId: string
  onClose: () => void
  onSuccess: () => void
}

const TIPOS_ESPERA = ['Aguardando Documento', 'Aguardando Assinatura']
const PRAZOS = [
  { label: '24 horas', hours: 24 },
  { label: '48 horas', hours: 48 },
  { label: '72 horas', hours: 72 },
  { label: '7 dias', hours: 168 },
]

export default function PopupAguardando({ leadId, operadorId, onClose, onSuccess }: Props) {
  const [tipo, setTipo] = useState(TIPOS_ESPERA[0])
  const [prazoHours, setPrazoHours] = useState(48)
  const [taxaReajuste, setTaxaReajuste] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const prazoSla = new Date(Date.now() + prazoHours * 60 * 60 * 1000).toISOString()

    try {
      await supabase.from('pendencias').insert({
        lead_id: leadId,
        operador_id: operadorId,
        tipo,
        prazo_sla: prazoSla,
        taxa_reajuste: taxaReajuste ? parseFloat(taxaReajuste) : null,
      })

      await supabase.from('atendimentos').update({
        status: 'aguardando',
        tipo_espera: tipo,
        prazo_sla: prazoSla,
      }).eq('lead_id', leadId)

      onSuccess()
    } catch {
      alert('Erro ao registrar pendência')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg border border-border p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-display font-bold text-text-primary mb-4">Definir pendência</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Tipo de espera</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
              {TIPOS_ESPERA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Prazo de SLA</label>
            <div className="grid grid-cols-2 gap-2">
              {PRAZOS.map(p => (
                <button key={p.hours} type="button" onClick={() => setPrazoHours(p.hours)}
                  className={`px-3 py-2 rounded-md text-sm border transition-colors ${prazoHours === p.hours ? 'border-accent bg-accent/10 text-accent font-medium' : 'border-border text-text-primary hover:bg-bg-surface-hover'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Taxa após vencimento (%) — opcional</label>
            <input type="number" value={taxaReajuste} onChange={e => setTaxaReajuste(e.target.value)} placeholder="12"
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-bg-surface-hover text-text-primary">Cancelar</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-medium bg-warning text-white hover:bg-warning/90 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
