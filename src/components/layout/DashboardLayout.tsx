'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { FileText, Settings, LogOut, Plus, Palette } from 'lucide-react'
import { getQuotes } from '@/lib/firestore/quotes'
import { getUserCompanyId } from '@/lib/firestore/companies'

const navLinks = [
  { href: '/dashboard', label: 'Presupuestos', icon: FileText },
  { href: '/settings', label: 'Configuración', icon: Settings },
  { href: '/tematica', label: 'Temática', icon: Palette },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, company } = useAuth()
  const [quoteCount, setQuoteCount] = useState<number | null>(null)

  function refreshCount() {
    if (!user) return
    getUserCompanyId(user.uid).then((cid) => {
      if (!cid) return
      getQuotes(cid).then((qs) => setQuoteCount(qs.length))
    })
  }

  useEffect(() => { refreshCount() }, [user, pathname])

  useEffect(() => {
    window.addEventListener('quotes-changed', refreshCount)
    return () => window.removeEventListener('quotes-changed', refreshCount)
  }, [user])

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 fixed top-0 left-0 h-screen border-r border-line bg-surface flex flex-col z-30">
        <div className="px-6 h-16 flex items-center gap-[6px] border-b border-line shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="18" viewBox="4 2 16 20" aria-hidden="true">
            <path d="M5 3 L19 3 L19 20 L5 16 Z"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          <Link
            href="/dashboard/nuevo"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-ink-60 hover:bg-surface-hover hover:text-ink"
          >
            <Plus size={15} strokeWidth={1.5} />
            Nuevo presupuesto
          </Link>
          <div className="my-4 border-t border-line" />
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
                {href === '/dashboard' && quoteCount ? (
                  <span className="ml-auto text-xs opacity-50">{quoteCount}</span>
                ) : null}
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

      <div className="flex-1 flex flex-col min-w-0 ml-56">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
