'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  subscribeQuestionnaire, updateQuestionnaire, deleteQuestionnaire, fieldsOf, type Questionnaire, type Question,
} from '@/lib/firestore/questionnaires'
import { ArrowLeft, Check, Copy, ExternalLink, Plus, Trash2, X } from 'lucide-react'

const LABEL = 'text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-2 block'
const INPUT = 'w-full px-3 py-2 border border-input rounded-md text-sm text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors bg-paper'
const BASE = 'https://client.savvia.studio'

export default function CuestionarioPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <Content />
      </DashboardLayout>
    </AuthGuard>
  )
}

function rid() { return Math.random().toString(36).slice(2, 8) }

function fmtWhen(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Content() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [q, setQ] = useState<Questionnaire | null>(null)
  const [missing, setMissing] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = useRef(false)
  const pending = useRef<Questionnaire | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // En directo: las respuestas del cliente entran solas; nuestras ediciones no se pisan
  useEffect(() => {
    return subscribeQuestionnaire(id, (remote, local) => {
      if (!remote) { setMissing(true); return }
      setQ((cur) => {
        if (!cur || (!local && !dirty.current)) return remote
        // edición local en curso: solo refrescamos lo que escribe el cliente
        return { ...cur, answers: remote.answers, status: remote.status, submittedAt: remote.submittedAt, answeredAt: remote.answeredAt }
      })
    })
  }, [id])

  function patch(p: Partial<Questionnaire>) {
    dirty.current = true
    setQ((cur) => {
      const next = cur ? { ...cur, ...p } : cur
      pending.current = next
      return next
    })
    if (timer.current) clearTimeout(timer.current)
    setSaved('saving')
    timer.current = setTimeout(async () => {
      try {
        const next = pending.current
        if (!next) return
        await updateQuestionnaire(id, { title: next.title, clientName: next.clientName, clientCompany: next.clientCompany, intro: next.intro, questions: next.questions, language: next.language })
        dirty.current = false
        setSaved('saved')
        setTimeout(() => setSaved('idle'), 1500)
      } catch {
        setSaved('error')
      }
    }, 800)
  }

  function setQuestion(i: number, qq: Question) {
    if (!q) return
    const questions = q.questions.map((x, j) => (j === i ? qq : x))
    patch({ questions })
  }

  if (missing) return <div className="px-8 py-12 text-sm text-ink-40">Este cuestionario no existe.</div>
  if (!q) return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>

  const link = `${BASE}/cuestionario/${q.slug}`

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      <Link href="/dashboard/cuestionarios" className="inline-flex items-center gap-1.5 text-xs text-ink-40 hover:text-ink mb-6">
        <ArrowLeft size={12} strokeWidth={1.75} />Cuestionarios
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="min-w-0 flex-1">
          <input
            className="w-full text-2xl font-medium tracking-tight text-ink bg-transparent outline-none"
            value={q.title}
            onChange={(e) => patch({ title: e.target.value })}
            aria-label="Título"
          />
          <p className="mt-1 text-sm text-ink-40">
            {q.status === 'respondido' ? `Respondido el ${fmtWhen(q.submittedAt)}` : q.answeredAt ? `Respondiendo · última respuesta ${fmtWhen(q.answeredAt)}` : 'Pendiente de respuesta'}
            {saved === 'saving' && ' · guardando…'}
            {saved === 'saved' && ' · guardado'}
            {saved === 'error' && <span className="text-[#DC2626]"> · error al guardar</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover"
          >
            {copied ? <><Check size={14} strokeWidth={2} />Copiado</> : <><Copy size={14} strokeWidth={1.75} />Copiar enlace</>}
          </button>
          <a href={link} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-line text-ink-60 hover:text-ink hover:bg-surface-hover" title="Ver como el cliente">
            <ExternalLink size={14} strokeWidth={1.5} />
          </a>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <label>
          <span className={LABEL}>Empresa</span>
          <input className={INPUT} value={q.clientCompany || ''} onChange={(e) => patch({ clientCompany: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>Persona</span>
          <input className={INPUT} value={q.clientName || ''} onChange={(e) => patch({ clientName: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>Idioma</span>
          <select className={INPUT} value={q.language || 'es'} onChange={(e) => patch({ language: e.target.value as 'es' | 'en' })}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>

      <label className="block mb-10">
        <span className={LABEL}>Introducción</span>
        <textarea className={`${INPUT} min-h-[5rem] leading-relaxed`} value={q.intro || ''} onChange={(e) => patch({ intro: e.target.value })} />
      </label>

      <span className={LABEL}>Preguntas y respuestas</span>
      <ol className="space-y-4">
        {q.questions.map((qq, i) => (
          <li key={qq.id} className="border border-line rounded-md bg-paper p-4">
            <div className="flex items-start gap-3">
              <span className="pt-2 text-sm text-ink-40 tabular-nums w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <input className={`${INPUT} font-medium`} value={qq.title} onChange={(e) => setQuestion(i, { ...qq, title: e.target.value })} placeholder="Pregunta" />
                <textarea className={`${INPUT} min-h-[3rem] text-ink-60`} value={qq.help || ''} onChange={(e) => setQuestion(i, { ...qq, help: e.target.value })} placeholder="Ayuda para el cliente (opcional)" />
                <div className="pt-2 space-y-3">
                  {fieldsOf(qq).map((f) => {
                    const a = (q.answers?.[f.id] || '').trim()
                    return (
                      <div key={f.id}>
                        {f.label && <span className="block text-xs font-medium text-ink-60 mb-1">{f.label}</span>}
                        <div className={`rounded-md px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${a ? 'bg-surface text-ink' : 'border border-dashed border-line text-ink-40'}`}>
                          {a || 'Sin respuesta todavía'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <button
                onClick={() => patch({ questions: q.questions.filter((_, j) => j !== i) })}
                className="p-1.5 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover"
                title="Quitar pregunta"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        onClick={() => patch({ questions: [...q.questions, { id: rid(), title: '', help: '' }] })}
        className="mt-3 flex items-center gap-1.5 text-sm text-ink-60 hover:text-ink"
      >
        <Plus size={14} strokeWidth={1.75} />Añadir pregunta
      </button>

      <div className="mt-12 pt-6 border-t border-line">
        {confirmDelete ? (
          <span className="flex items-center gap-3">
            <span className="text-sm text-ink-60">Se borra el cuestionario y sus respuestas.</span>
            <button onClick={async () => { await deleteQuestionnaire(id); router.replace('/dashboard/cuestionarios') }} className="px-3 py-1.5 text-xs font-medium bg-[#DC2626] text-white rounded-md">Eliminar</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-ink-60">Cancelar</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-ink-40 hover:text-[#B91C1C]"><Trash2 size={13} strokeWidth={1.5} />Eliminar cuestionario</button>
        )}
      </div>
    </div>
  )
}
