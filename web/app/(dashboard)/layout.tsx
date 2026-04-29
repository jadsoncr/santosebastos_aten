import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import SocketProvider from '@/components/providers/SocketProvider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = (user.user_metadata?.role as string) || 'operador'
  const email = user.email || ''
  const displayName = (user.user_metadata?.nome as string)
    || (user.user_metadata?.full_name as string)
    || email.split('@')[0]

  return (
    <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header displayName={displayName} role={role} />
        <main className="flex-1 overflow-auto">
          <SocketProvider>
            {children}
          </SocketProvider>
        </main>
      </div>
    </div>
  )
}
