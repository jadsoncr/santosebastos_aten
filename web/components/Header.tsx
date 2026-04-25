'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface HeaderProps {
  displayName: string
  role: string
}

export default function Header({ displayName, role }: HeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-header items-center justify-between border-b border-border bg-bg-surface px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-text-primary">{displayName}</span>
        <span
          className={`rounded-sm px-2 py-0.5 font-mono text-xs font-medium ${
            role === 'owner'
              ? 'bg-accent/15 text-accent'
              : 'bg-blue-500/15 text-blue-400'
          }`}
        >
          {role}
        </span>
      </div>

      <button
        onClick={handleLogout}
        className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
      >
        Sair
      </button>
    </header>
  )
}
