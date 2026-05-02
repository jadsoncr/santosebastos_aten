'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { MessageSquare, LayoutGrid, DollarSign, Archive, Settings, LogOut, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COPY } from '@/utils/copy'

interface SidebarProps {
  role: string
}

const links = [
  { href: '/cco', label: 'Decisões', icon: BarChart3 },
  { href: '/tela1', label: 'Entrada', icon: MessageSquare },
  { href: '/tela2', label: 'Execução', icon: LayoutGrid },
  { href: '/encerrados', label: 'Encerrados', icon: Archive },
  { href: '/financeiro', label: 'Receita', icon: DollarSign, ownerOnly: true },
]

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-20 lg:w-64 flex-shrink-0 flex flex-col bg-white border-r border-gray-100 z-50 transition-all">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center lg:justify-start px-6 border-b border-gray-50">
        <img src="/logos/toris-icon-sage.svg" alt="TORIS" className="w-8 h-8" />
        <span className="ml-3 hidden lg:block"><img src="/logos/toris-horizontal-dark.svg" alt="TORIS" className="h-5 hidden lg:block" /></span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => {
          if (link.ownerOnly && role !== 'owner') return null

          const isActive = pathname === link.href

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-all group",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              )}
            >
              <link.icon size={22} className={cn("transition-transform group-active:scale-90", isActive ? "scale-110" : "")} />
              <span className="ml-3 font-semibold hidden lg:block">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-2 border-t border-gray-50">
        <button className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-gray-400 hover:bg-gray-50 transition-colors">
          <Settings size={22} />
          <span className="ml-3 font-semibold hidden lg:block">Configurações</span>
        </button>
        <button onClick={async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.href = '/login'
        }} className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-red-400 hover:bg-red-50 transition-colors">
          <LogOut size={22} />
          <span className="ml-3 font-semibold hidden lg:block">Sair</span>
        </button>
      </div>
    </aside>
  )
}
