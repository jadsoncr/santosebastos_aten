'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  role: string
}

const links = [
  { href: '/tela1', label: 'Entrada', icon: '📥' },
  { href: '/tela2', label: 'Clientes', icon: '👥' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰', ownerOnly: true },
]

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-sidebar flex-col bg-bg-surface border-r border-border">
      <div className="px-5 py-4">
        <span className="font-display text-lg font-bold text-text-primary">
          BRO Resolve
        </span>
      </div>

      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {links.map((link) => {
            if (link.ownerOnly && role !== 'owner') return null

            const isActive = pathname === link.href

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-muted hover:bg-bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  <span>{link.icon}</span>
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
