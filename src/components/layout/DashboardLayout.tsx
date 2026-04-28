'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { FileText, Settings, LogOut, Plus, Palette } from 'lucide-react'

const navLinks = [
  { href: '/dashboard', label: 'Presupuestos', icon: FileText },
  { href: '/settings', label: 'Configuración', icon: Settings },
  { href: '/tematica', label: 'Temática', icon: Palette },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-6 py-8 border-b border-line">
          <span className="text-sm font-medium tracking-widest uppercase text-ink">
            Presupuestos
          </span>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-accent text-on-accent'
                    : 'text-ink-60 hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <Icon size={15} strokeWidth={1.5} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-line space-y-1">
          <div className="px-3 py-2 text-xs text-ink-40 truncate">{user?.email}</div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink-60 hover:bg-surface-hover hover:text-ink transition-colors"
          >
            <LogOut size={15} strokeWidth={1.5} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-line flex items-center justify-between px-8">
          <div />
          <Link
            href="/dashboard/nuevo"
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-all hover:-translate-y-px bg-accent text-on-accent hover:bg-accent-hover"
          >
            <Plus size={14} strokeWidth={2} />
            Nuevo presupuesto
          </Link>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
