'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getAudits, type Audit } from '@/lib/firestore/audits'
import { ChevronRight } from 'lucide-react'

export default function AuditoriasPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <Content />
      </DashboardLayout>
    </AuthGuard>
  )
}

function Content() {
  const { user } = useAuth()
  const [items, setItems] = useState<Audit[] | null>(null)

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setItems([]); return }
      const a = await getAudits(cid)
      a.sort((x, y) => String(x.slug).localeCompare(String(y.slug)))
      setItems(a)
    })
  }, [user])

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      <h1 className="text-2xl font-medium tracking-tight text-ink mb-2">Auditorías</h1>
      <p className="text-sm text-ink-60 mb-8 max-w-2xl leading-relaxed">
        Lo que entregamos al cliente tras auditar su web: qué cambiaríamos, en qué nos inspiraríamos y qué sacamos según las horas. Se comparten por enlace y las prepara Claude desde el conector MCP, a partir de las notas de la reunión y del tablero de Criterio.
      </p>

      {items === null ? (
        <p className="text-sm text-ink-40">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-40">Aún no hay auditorías. Pídele a Claude que prepare una.</p>
      ) : (
        <div className="border border-line rounded-md bg-paper divide-y divide-line">
          {items.map((a) => (
            <Link key={a.id} href={`/dashboard/auditorias/${a.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-hover transition-colors">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink truncate">{a.clientCompany || a.title}</span>
                <span className="block text-xs text-ink-40 truncate">{a.title}</span>
              </span>
              <span className="text-xs text-ink-60 tabular-nums whitespace-nowrap">{a.findings?.length || 0} puntos, {a.references?.length || 0} referencias</span>
              <ChevronRight size={14} strokeWidth={1.5} className="text-ink-40" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
