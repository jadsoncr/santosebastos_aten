import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  validateFileSize,
  validateFileType,
  sanitizeFileName,
} from '@/utils/fileValidation'

/**
 * POST /api/upload
 *
 * Recebe arquivo via multipart/form-data e faz upload para o Supabase Storage.
 * Usa a service_role key para acesso admin ao bucket `chat-files`.
 *
 * Body (FormData):
 *   - file: File
 *   - lead_id: string
 *
 * Retorna: { url, nome, tipo, tamanho } ou { error } com status adequado.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const leadId = formData.get('lead_id') as string | null

    if (!file || !leadId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: file, lead_id' },
        { status: 400 }
      )
    }

    // Server-side validation: file size
    const sizeCheck = validateFileSize(file.size)
    if (!sizeCheck.valid) {
      return NextResponse.json(
        { error: sizeCheck.error },
        { status: 400 }
      )
    }

    // Server-side validation: MIME type
    const typeCheck = validateFileType(file.type)
    if (!typeCheck.valid) {
      return NextResponse.json(
        { error: typeCheck.error },
        { status: 400 }
      )
    }

    // Sanitize file name (UUID prefix + safe characters)
    const sanitizedName = sanitizeFileName(file.name)

    // Create Supabase admin client with service_role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables for upload')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage bucket `chat-files`
    const storagePath = `${leadId}/${sanitizedName}`

    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Falha no upload do arquivo' },
        { status: 500 }
      )
    }

    // Generate signed URL with 7-day validity (604800 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('chat-files')
      .createSignedUrl(storagePath, 604800)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Supabase signed URL error:', signedUrlError)
      return NextResponse.json(
        { error: 'Falha ao gerar URL do arquivo' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      nome: file.name,
      tipo: file.type,
      tamanho: file.size,
    })
  } catch (err) {
    console.error('Upload route unexpected error:', err)
    return NextResponse.json(
      { error: 'Erro interno no upload' },
      { status: 500 }
    )
  }
}
