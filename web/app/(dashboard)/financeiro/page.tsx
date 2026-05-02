'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useOperadorRole } from '@/hooks/useOperadorRole'
import { Card } from '@/components/ui/Card'
import { ChevronLeft, ChevronRight, Lock, Plus, Trash2, Pencil } from 'lucide-react'

interface Custo { id: string; descricao: string; valor: number; categoria: string }

export default function FinanceiroPage() {
  const { role } = useOperadorRole()
  const supabase = createClient()
  const [mesOffset, setMesOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fechamento, setFechamento] = useState<any>(null)
  const [receitaEntrada, setReceitaEntrada] = useState(0)
  const [receitaPendente, setReceitaPendente] = useState(0)
  const [custos, setCustos] = useState<Custo[]>([])
  const [custosTotal, setCustosTotal] = useState(0)
  const [clientes, setClientes] = useState<any[]>([])
  const [novoCusto, setNovoCusto] = useState({ descricao: '', valor: '', categoria: 'outros' })
  const [editId, setEditId] = useState<string | null>(null)
  const [fechando, setFechando] = useState(false)

  const getMesKey = useCallback(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + mesOffset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [mesOffset])

  const mesLabel = useCallback(() => {
    const [y, m] = getMesKey().split('-')
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${meses[parseInt(m) - 1]} ${y}`
  }, [getMesKey])

  const isFechado = fechamento?.status === 'fechado'

  const loadData = useCallback(async () => {
    setLoading(true)
    const mesKey = getMesKey()
    const [y, m] = mesKey.split('-').map(Number)
    const inicioMes = `${mesKey}-01T00:00:00.000Z`
    const fimMes = new Date(y, m, 0, 23, 59, 59).toISOString()

    // Check fechamento status
    const { data: fech } = await supabase
      .from('fechamentos_mensais')
      .select('*')
      .eq('mes', mesKey)
      .maybeSingle()
    setFechamento(fech)

    if (fech?.status === 'fechado') {
      // Closed month: use frozen snapshot
      setReceitaEntrada(parseFloat(fech.receita_entrada) || 0)
      setReceitaPendente(parseFloat(fech.receita_pendente) || 0)
      setCustosTotal(parseFloat(fech.custos_total) || 0)
    } else {
      // Open month: calculate real-time
      const { data: pagos } = await supabase
        .from('atendimentos')
        .select('valor_entrada, identity_id')
        .eq('status_pagamento', 'pago')
        .gte('encerrado_em', inicioMes)
        .lte('encerrado_em', fimMes)

      const re = (pagos || []).reduce((s, a) => s + (parseFloat(a.valor_entrada) || 0), 0)
      setReceitaEntrada(re)

      const { data: pend } = await supabase
        .from('atendimentos')
        .select('valor_entrada, identity_id')
        .eq('status_pagamento', 'pendente')
        .gte('encerrado_em', inicioMes)
        .lte('encerrado_em', fimMes)

      const rp = (pend || []).reduce((s, a) => s + (parseFloat(a.valor_entrada) || 0), 0)
      setReceitaPendente(rp)

      // Custos total from custos_mensais
      const { data: cm } = await supabase.from('custos_mensais').select('*').eq('mes', mesKey)
      const ct = (cm || []).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)
      setCustosTotal(ct)

      // Build client list from atendimentos
      const all = [...(pagos || []), ...(pend || [])]

      // Fetch lead names for display
      const identityIds = all.map(a => a.identity_id).filter(Boolean)
      const { data: leadNames } = identityIds.length > 0
        ? await supabase.from('leads').select('identity_id, nome').in('identity_id', identityIds)
        : { data: [] as any[] }
      const nameMap = new Map((leadNames || []).map((l: any) => [l.identity_id, l.nome]))

      setClientes(all.map(a => ({
        identity_id: a.identity_id,
        nome: nameMap.get(a.identity_id) || null,
        valor: parseFloat(a.valor_entrada) || 0,
        status: (pagos || []).some(p => p.identity_id === a.identity_id) ? 'pago' : 'pendente',
      })))
    }

    // Always load custos for CRUD
    const { data: custosData } = await supabase.from('custos_mensais').select('*').eq('mes', mesKey)
    setCustos((custosData || []) as Custo[])
    setLoading(false)
  }, [getMesKey, supabase])

  useEffect(() => { loadData() }, [mesOffset])

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const resultado = receitaEntrada - custosTotal

  // CRUD custos
  const addCusto = async () => {
    if (!novoCusto.descricao || !novoCusto.valor) return
    await supabase.from('custos_mensais').insert({
      mes: getMesKey(),
      descricao: novoCusto.descricao,
      valor: parseFloat(novoCusto.valor),
      categoria: novoCusto.categoria,
    })
    setNovoCusto({ descricao: '', valor: '', categoria: 'outros' })
    loadData()
  }

  const deleteCusto = async (id: string) => {
    await supabase.from('custos_mensais').delete().eq('id', id)
    loadData()
  }

  const updateCusto = async (id: string, desc: string, val: number) => {
    await supabase.from('custos_mensais').update({ descricao: desc, valor: val }).eq('id', id)
    setEditId(null)
    loadData()
  }

  const fecharMes = async () => {
    if (isFechado || fechando) return
    setFechando(true)
    const mesKey = getMesKey()
    await supabase.from('fechamentos_mensais').upsert({
      mes: mesKey,
      status: 'fechado',
      receita_entrada: receitaEntrada,
      receita_pendente: receitaPendente,
      custos_total: custosTotal,
      resultado,
      fechado_em: new Date().toISOString(),
    }, { onConflict: 'mes' })
    setFechando(false)
    loadData()
  }

  if (role === null) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Carregando...</div>
  if (role !== 'owner') return <div className="flex items-center justify-center h-full text-red-500 font-bold text-lg">Acesso restrito</div>

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header + Month Selector */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900">Receita</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setMesOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-gray-200 transition"><ChevronLeft size={20} /></button>
            <span className="text-sm font-bold text-gray-700 min-w-[100px] text-center">{mesLabel()}</span>
            <button onClick={() => setMesOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-gray-200 transition"><ChevronRight size={20} /></button>
            <span className={`ml-3 px-3 py-1 rounded-full text-xs font-bold ${isFechado ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {isFechado ? '🔒 FECHADO' : '🟢 ABERTO'}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">Carregando...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Receita Realizada</p>
                <p className="text-xl font-black text-green-600">{fmt(receitaEntrada)}</p>
              </Card>
              <Card className="p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Receita em Decisão</p>
                <p className="text-xl font-black text-orange-500">{fmt(receitaPendente)}</p>
              </Card>
              <Card className="p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Custos</p>
                <p className="text-xl font-black text-red-500">{fmt(custosTotal)}</p>
              </Card>
              <Card className="p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Resultado Operacional</p>
                <p className={`text-xl font-black ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resultado)}</p>
              </Card>
            </div>

            {/* Client list (open months only) */}
            {!isFechado && clientes.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.15em]">Decisões do mês</h3>
                <Card>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="text-left px-4 py-3">Cliente</th>
                        <th className="text-right px-4 py-3">Valor</th>
                        <th className="text-right px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs font-medium text-gray-700">{c.nome || 'Contato'}</td>
                          <td className="px-4 py-3 text-right text-xs font-mono">{fmt(c.valor)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </section>
            )}

            {/* Custos section */}
            <section className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.15em]">Custos do mês</h3>
              <Card className="p-4 space-y-3">
                {custos.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    {editId === c.id ? (
                      <EditCustoRow custo={c} onSave={(d, v) => updateCusto(c.id, d, v)} onCancel={() => setEditId(null)} />
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{c.descricao}</p>
                          <p className="text-[10px] text-gray-400">{c.categoria}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-red-500">{fmt(c.valor)}</span>
                          {!isFechado && (
                            <>
                              <button onClick={() => setEditId(c.id)} className="p-1 text-gray-400 hover:text-blue-500"><Pencil size={14} /></button>
                              <button onClick={() => deleteCusto(c.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {custos.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Nenhum custo registrado</p>}

                {/* Add custo form */}
                {!isFechado && (
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <input value={novoCusto.descricao} onChange={e => setNovoCusto(p => ({ ...p, descricao: e.target.value }))}
                      placeholder="Descrição" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <input value={novoCusto.valor} onChange={e => setNovoCusto(p => ({ ...p, valor: e.target.value }))}
                      placeholder="Valor" type="number" className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <select value={novoCusto.categoria} onChange={e => setNovoCusto(p => ({ ...p, categoria: e.target.value }))}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200">
                      <option value="outros">Outros</option>
                      <option value="fixo">Fixo</option>
                      <option value="variavel">Variável</option>
                      <option value="pessoal">Pessoal</option>
                    </select>
                    <button onClick={addCusto} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </Card>
            </section>

            {/* Fechar mês button */}
            {!isFechado && role === 'owner' && (
              <div className="flex justify-end">
                <button onClick={fecharMes} disabled={fechando}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                  <Lock size={16} />
                  {fechando ? 'Fechando...' : 'Consolidar mês'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EditCustoRow({ custo, onSave, onCancel }: { custo: Custo; onSave: (d: string, v: number) => void; onCancel: () => void }) {
  const [desc, setDesc] = useState(custo.descricao)
  const [val, setVal] = useState(String(custo.valor))
  return (
    <div className="flex gap-2 w-full">
      <input value={desc} onChange={e => setDesc(e.target.value)} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1" />
      <input value={val} onChange={e => setVal(e.target.value)} type="number" className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-1" />
      <button onClick={() => onSave(desc, parseFloat(val) || 0)} className="text-xs font-bold text-green-600 hover:underline">Salvar</button>
      <button onClick={onCancel} className="text-xs font-bold text-gray-400 hover:underline">Cancelar</button>
    </div>
  )
}
