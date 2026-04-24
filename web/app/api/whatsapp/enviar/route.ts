import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { lead_id, telefone, mensagem } = await request.json()

  if (!lead_id || !telefone || !mensagem) {
    return NextResponse.json({ error: 'Campos obrigatórios: lead_id, telefone, mensagem' }, { status: 400 })
  }

  const webhookUrl = process.env.WEBHOOK_N8N_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'WEBHOOK_N8N_URL não configurada' }, { status: 500 })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, mensagem }),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Falha ao enviar: ${res.status}` },
        { status: res.status }
      )
    }

    // Save sent message to mensagens table
    await supabase.from('mensagens').insert({
      lead_id,
      de: user.id,
      tipo: 'mensagem',
      conteudo: mensagem,
      operador_id: user.id,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao conectar com webhook' },
      { status: 502 }
    )
  }
}
