'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getQuestionnaires, createQuestionnaire, webAuditTemplate, fieldsOf, type Questionnaire } from '@/lib/firestore/questionnaires'
import { Plus, ChevronRight } from 'lucide-react'

const INPUT = 'w-full px-3 py-2 border border-input rounded-md text-sm text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'

export default function CuestionariosPage() {
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
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<Questionnaire[] | null>(null)
  const [company, setCompany] = useState('')
  const [person, setPerson] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setItems([]); return }
      setCompanyId(cid)
      const qs = await getQuestionnaires(cid)
      qs.sort((a, b) => String(b.slug).localeCompare(String(a.slug)))
      setItems(qs)
    })
  }, [user])

  async function create() {
    if (!companyId || !company.trim()) return
    setCreating(true)
    try {
      const id = await createQuestionnaire({
        companyId,
        title: `Antes de la auditoría de ${company.trim()}`,
        clientCompany: company.trim(),
        clientName: person.trim() || undefined,
        intro: 'Antes de la auditoría nos ayuda mucho entender cómo veis la web. Son 5 preguntas y te llevará unos 10 minutos. No hace falta que sea perfecto: con un par de líneas por pregunta nos vale.',
        language: 'es',
        questions: webAuditTemplate(),
      })
      router.push(`/dashboard/cuestionarios/${id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      <h1 className="text-2xl font-medium tracking-tight text-ink mb-2">Cuestionarios</h1>
      <p className="text-sm text-ink-60 mb-8 max-w-2xl leading-relaxed">
        Preguntas que compartimos con el cliente por enlace, como los presupuestos. Responde desde ahí y sus respuestas aparecen aquí en directo.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-10 max-w-2xl">
        <input className={`${INPUT} flex-1 min-w-[10rem]`} placeholder="Empresa (5050 Growth…)" value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        <input className={`${INPUT} w-40`} placeholder="Persona (Nacho…)" value={person} onChange={(e) => setPerson(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        <button onClick={create} disabled={!company.trim() || creating} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover disabled:opacity-40">
          <Plus size={14} strokeWidth={2} />Auditoría web
        </button>
      </div>

      {items === null ? (
        <p className="text-sm text-ink-40">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-40">Aún no hay cuestionarios.</p>
      ) : (
        <div className="border border-line rounded-md bg-paper divide-y divide-line">
          {items.map((q) => {
            const total = q.questions.length
            const done = q.questions.filter((qq) => fieldsOf(qq).some((f) => (q.answers?.[f.id] || '').trim())).length
            return (
              <Link key={q.id} href={`/dashboard/cuestionarios/${q.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-hover transition-colors">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink truncate">{q.title}</span>
                  <span className="block text-xs text-ink-40 truncate">{[q.clientCompany, q.clientName].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="text-xs text-ink-60 tabular-nums whitespace-nowrap">{done}/{total}</span>
                <span className={`px-1.5 py-px rounded text-[11px] font-medium whitespace-nowrap ${q.status === 'respondido' ? 'bg-accent text-on-accent' : 'border border-line text-ink-60'}`}>
                  {q.status === 'respondido' ? 'Respondido' : 'Pendiente'}
                </span>
                <ChevronRight size={14} strokeWidth={1.5} className="text-ink-40" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
