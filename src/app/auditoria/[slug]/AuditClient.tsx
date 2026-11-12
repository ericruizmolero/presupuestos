'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getAudit, type Audit } from '@/lib/firestore/audits'
import { AuditView } from '@/components/audit/AuditView'

export function AuditClient() {
  const { slug } = useParams<{ slug: string }>()
  const [audit, setAudit] = useState<Audit | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    if (!slug) return
    getAudit(slug)
      .then((a) => {
        if (!a) { setState('notfound'); return }
        setAudit(a)
        document.title = a.clientCompany ? (a.language === 'en' ? `Website audit for ${a.clientCompany} | Savvia` : `Auditoría web de ${a.clientCompany} | Savvia`) : 'Savvia'
        setState('ready')
      })
      .catch(() => setState('notfound'))
  }, [slug])

  if (state === 'loading') return <main className="min-h-screen bg-paper flex items-center justify-center text-sm text-ink-40">…</main>
  if (state === 'notfound' || !audit) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center px-6">
        <p className="text-sm text-ink-40">Esta auditoría no existe o ya no está disponible.</p>
      </main>
    )
  }
  return <main className="min-h-screen bg-paper"><AuditView audit={audit} /></main>
}
