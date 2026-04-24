'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Props {
  leadId: string
  operadorId: string
  valorEstimadoInicial?: number
  onClose: () => void
  onSuccess: () => void
}

const ACOES = [
  'Ligar',
  'Enviar proposta',
  'Cobrar documento',
  'Aguardar retorno',
  'Encerrar',
]

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function PopupEnfileirar({ leadId, operadorId, valorEstimadoInicial, onClose, onSuccess }: Props) {
  const [proximaAcao, setProximaAcao] = useState('Ligar')
  const [dataAcao, setDataAcao] = useState(getTomorrow())
  const [valorEstimado, setValorEstimado] = useState(valorEstimadoInicial?.toString() || '')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Insert pot_tratamento
      await supabase.from('pot_tratamento').insert({
        lead_id: leadId,
        operador_id: operadorId,
        proxima_acao: proximaAcao,
        data_acao: dataAcao,
        valor_estimado: valorEstimado ? parseFloat(valorEstimado) : null,
        observacao: observacao || null,
      })

      // Update atendimentos
      await supabase
        .from('atendimentos')
        .update({
          status: 'enfileirado',
          encerrado_em: new Date().toISOString(),
        })
        .eq('lead_id', leadId)

      onSuccess()
    } catch {
      alert('Erro ao enfileirar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg border border-border p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-display font-bold text-text-primary mb-4">
          Enfileirar para tratamento
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Próxima ação</label>
            <select
              value={proximaAcao}
              onChange={e => setProximaAcao(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {ACOES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Data da ação</label>
            <input
              type="date"
              value={dataAcao}
              onChange={e => setDataAcao(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Valor estimado (R$)</label>
            <input
              type="number"
              value={valorEstimado}
              onChange={e => setValorEstimado(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1 block">Observação</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={3}
              placeholder="Observações sobre o lead..."
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium bg-bg-surface-hover text-text-primary hover:bg-border"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-medium bg-accent text-text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
