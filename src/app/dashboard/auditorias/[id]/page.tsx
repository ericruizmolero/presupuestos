'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { subscribeAudit, deleteAudit, type Audit } from '@/lib/firestore/audits'
import { AuditView } from '@/components/audit/AuditView'
import { ArrowLeft, Check, Copy, ExternalLink, Trash2 } from 'lucide-react'

const BASE = 'https://client.savvia.studio'

export default function AuditoriaPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <Content />
      </DashboardLayout>
    </AuthGuard>
  )
}

function Content() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [audit, setAudit] = useState<Audit | null>(null)
  const [missing, setMissing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => subscribeAudit(id, (a) => { if (!a) setMissing(true); else setAudit(a) }), [id])

  if (missing) return <div className="px-8 py-12 text-sm text-ink-40">Esta auditoría no existe.</div>
  if (!audit) return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>

  const link = `${BASE}/auditoria/${audit.slug}`

  return (
    <div>
      <div className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-line px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3">
        <Link href="/dashboard/auditorias" className="inline-flex items-center gap-1.5 text-xs text-ink-40 hover:text-ink">
          <ArrowLeft size={12} strokeWidth={1.75} />Auditorías
        </Link>
        <span className="text-sm font-medium text-ink truncate flex-1 min-w-0">{audit.clientCompany || audit.title}</span>
        <span className="hidden md:inline text-xs text-ink-40">Para cambiar algo, pídeselo a Claude: se actualiza aquí en directo.</span>
        <button
          onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover"
        >
          {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}{copied ? 'Copiado' : 'Copiar enlace'}
        </button>
        <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-60 border border-line rounded-md hover:text-ink hover:bg-surface">
          <ExternalLink size={13} strokeWidth={1.75} />Abrir
        </a>
        {confirmDelete ? (
          <button onClick={async () => { await deleteAudit(audit.id); router.push('/dashboard/auditorias') }} className="px-3 py-1.5 text-sm font-medium text-[#DC2626] border border-[#DC2626]/30 rounded-md hover:bg-[#DC2626]/5">
            Borrar de verdad
          </button>
        ) : (
          <button onClick={() => setConfirmDelete(true)} aria-label="Borrar" className="p-2 text-ink-40 hover:text-[#DC2626] rounded-md">
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <AuditView audit={audit} />
    </div>
  )
}
