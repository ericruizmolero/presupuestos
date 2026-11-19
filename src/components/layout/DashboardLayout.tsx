'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { Faces } from '@/components/studio/StudioMarks'
import { myName } from '@/components/studio/boardUtils'
import { ChevronDown, FileText, Settings, LogOut, Plus, Palette, Clock, StickyNote, Crosshair, Plug, ClipboardList, ScanSearch } from 'lucide-react'
import { getQuotes } from '@/lib/firestore/quotes'
import { getUserCompanyId } from '@/lib/firestore/companies'

const navLinks: Array<{ href: string; label: string; icon: typeof FileText; children?: Array<{ href: string; label: string }> }> = [
  { href: '/dashboard', label: 'Presupuestos', icon: FileText },
  { href: '/dashboard/cuestionarios', label: 'Cuestionarios', icon: ClipboardList },
  { href: '/dashboard/auditorias', label: 'Auditorías', icon: ScanSearch },
  { href: '/dashboard/horas', label: 'Horas', icon: Clock },
  { href: '/dashboard/proyectos', label: 'Proyectos', icon: StickyNote },
  {
    href: '/dashboard/prospeccion', label: 'Prospección', icon: Crosshair,
    children: [
      { href: '/dashboard/prospeccion', label: 'Pipeline' },
      { href: '/dashboard/prospeccion/agente', label: 'Prospect agent' },
    ],
  },
  { href: '/dashboard/mcp', label: 'MCP', icon: Plug },
  { href: '/settings', label: 'Configuración', icon: Settings },
  { href: '/tematica', label: 'Temática', icon: Palette },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, company } = useAuth()
  const [quoteCount, setQuoteCount] = useState<number | null>(null)
  // Grupos del menú plegados o desplegados: lo decide cada uno y se recuerda en este navegador
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try { setOpenGroups(JSON.parse(localStorage.getItem('nav-groups') || '{}')) } catch {}
  }, [])
  function toggleGroup(href: string, open: boolean) {
    setOpenGroups((g) => {
      const next = { ...g, [href]: open }
      try { localStorage.setItem('nav-groups', JSON.stringify(next)) } catch {}
      return next
    })
  }

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/savvia-logo-cacao.svg" alt="Savvia" className="h-6 w-auto" />
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
          {navLinks.map(({ href, label, icon: Icon, children }) => {
            if (children) {
              const inside = children.some((c) => pathname === c.href)
              const isOpen = openGroups[href] ?? true
              return (
                <div key={href}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(href, !isOpen)}
                    aria-expanded={isOpen}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors hover:bg-surface-hover hover:text-ink ${
                      !isOpen && inside ? 'text-ink font-medium' : 'text-ink-60'
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.5} />
                    {label}
                    <ChevronDown size={13} strokeWidth={1.75} className={`ml-auto text-ink-40 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-[1.4rem] pl-3 border-l border-line space-y-0.5 mt-0.5">
                      {children.map((c) => {
                        const on = pathname === c.href
                        return (
                          <Link
                            key={c.href}
                            href={c.href}
                            className={`block px-3 py-1.5 rounded-md text-[13px] transition-colors ${on ? 'bg-accent text-on-accent' : 'text-ink-60 hover:bg-surface-hover hover:text-ink'}`}
                          >
                            {c.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
            const active = (pathname === href || pathname.startsWith(href + '/'))
              && !(href === '/dashboard' && navLinks.some((l) => l.href !== '/dashboard' && pathname.startsWith(l.href)))
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
          <div className="flex items-center gap-2.5 px-3 py-2 min-w-0">
            <Faces who={myName(user?.displayName, user?.email)} size={28} ring="var(--color-surface)" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{user?.displayName || myName(user?.displayName, user?.email)}</p>
              <p className="text-xs text-ink-40 truncate">{user?.email}</p>
            </div>
          </div>
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
