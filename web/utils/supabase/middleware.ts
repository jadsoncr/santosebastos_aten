import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const OWNER_ONLY_ROUTES = ['/financeiro']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Não autenticado → redirecionar para /login
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Autenticado acessando /login → redirecionar para /tela1
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/tela1'
    return NextResponse.redirect(url)
  }

  // Checar rotas owner-only
  if (user && OWNER_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
    const role = user.user_metadata?.role || 'operador'
    if (role !== 'owner') {
      const url = request.nextUrl.clone()
      url.pathname = '/tela1'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
