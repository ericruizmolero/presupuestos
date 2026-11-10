'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { getQuestionnaireBySlug, saveAnswers, fieldsOf, type Questionnaire } from '@/lib/firestore/questionnaires'

const I18N = {
  es: {
    eyebrow: (c: string) => (c ? `Cuestionario para ${c}` : 'Cuestionario'),
    hello: (n: string) => `Hola, ${n}`,
    saving: 'Guardando…',
    saved: 'Guardado',
    error: 'No se pudo guardar. Revisa tu conexión.',
    submit: 'He terminado',
    resubmit: 'He terminado',
    sending: 'Enviando…',
    thanks: (n: string) => `¡Gracias${n ? `, ${n}` : ''}! Hemos recibido tus respuestas.`,
    thanksSub: 'Puedes seguir editándolas: los cambios se guardan solos.',
    autosave: 'Tus respuestas se guardan solas mientras escribes: puedes cerrar y volver cuando quieras con este mismo enlace. Cuando acabes, pulsa «He terminado».',
    notFound: 'Este cuestionario no existe o ya no está disponible.',
    placeholder: 'Escribe aquí…',
    answered: (a: number, t: number) => `${a} de ${t} respondidas. Se guarda solo.`,
  },
  en: {
    eyebrow: (c: string) => (c ? `Questionnaire for ${c}` : 'Questionnaire'),
    hello: (n: string) => `Hi ${n},`,
    saving: 'Saving…',
    saved: 'Saved',
    error: "Couldn't save. Check your connection.",
    submit: "I'm done",
    resubmit: "I'm done",
    sending: 'Sending…',
    thanks: (n: string) => `Thanks${n ? `, ${n}` : ''}! We've received your answers.`,
    thanksSub: 'You can keep editing them: changes save automatically.',
    autosave: "Your answers save automatically as you type: close this page and come back any time with the same link. When you're finished, click «I'm done».",
    notFound: 'This questionnaire does not exist or is no longer available.',
    placeholder: 'Type here…',
    answered: (a: number, t: number) => `${a} of ${t} answered. Saves automatically.`,
  },
} as const

/** Textarea que crece con el contenido */
function AutoText({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 112)}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full resize-none px-4 py-3 border border-input rounded-md bg-paper text-base text-ink leading-relaxed placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors"
    />
  )
}

export function QuestionnaireClient() {
  const { slug } = useParams<{ slug: string }>()
  const [q, setQ] = useState<Questionnaire | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!slug) return
    getQuestionnaireBySlug(slug)
      .then((data) => {
        if (!data) { setState('notfound'); return }
        setQ(data)
        setAnswers(data.answers || {})
        setSubmitted(data.status === 'respondido')
        document.title = `${data.clientCompany || data.title}, Savvia`
        setState('ready')
      })
      .catch(() => setState('notfound'))
  }, [slug])

  // Autoguardado
  useEffect(() => {
    if (!q || !dirty.current) return
    if (timer.current) clearTimeout(timer.current)
    setSave('saving')
    timer.current = setTimeout(async () => {
      try {
        await saveAnswers(q.id, answers)
        dirty.current = false
        setSave('saved')
      } catch {
        setSave('error')
      }
    }, 900)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [answers, q])

  function setAnswer(id: string, v: string) {
    dirty.current = true
    setAnswers((a) => ({ ...a, [id]: v }))
  }

  async function submit() {
    if (!q) return
    if (timer.current) clearTimeout(timer.current)
    setSending(true)
    try {
      await saveAnswers(q.id, answers, true)
      dirty.current = false
      setSave('saved')
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSave('error')
    } finally {
      setSending(false)
    }
  }

  if (state === 'loading') {
    return <main className="min-h-screen bg-paper flex items-center justify-center text-sm text-ink-40">…</main>
  }
  if (state === 'notfound' || !q) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center px-6">
        <p className="text-sm text-ink-40">{I18N.es.notFound}</p>
      </main>
    )
  }

  const t = I18N[q.language === 'en' ? 'en' : 'es']
  const answered = q.questions.filter((qq) => fieldsOf(qq).some((f) => (answers[f.id] || '').trim())).length

  return (
    <main className="min-h-screen bg-paper">
      <article className="max-w-2xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        <header className="mb-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/savvia-logo-cacao.svg" alt="Savvia" className="h-6 w-auto mb-12" />
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase mb-4 text-ink-40">
            {t.eyebrow(q.clientCompany || '')}
          </p>
          <h1 className="text-[1.75rem] sm:text-[2rem] font-medium tracking-tight text-ink leading-tight">{q.title}</h1>

          {submitted ? (
            <div className="mt-8 rounded-md border border-line bg-surface px-5 py-4">
              <p className="text-base text-ink font-medium">{t.thanks(q.clientName || '')}</p>
              <p className="mt-1 text-sm text-ink-60">{t.thanksSub}</p>
            </div>
          ) : (
            <>
              {q.clientName && <p className="mt-8 text-base text-ink">{t.hello(q.clientName)}</p>}
              {q.intro && <p className="mt-3 text-base text-ink-60 leading-relaxed whitespace-pre-line">{q.intro}</p>}
              <p className="mt-6 text-sm text-ink-40 leading-relaxed">{t.autosave}</p>
            </>
          )}
        </header>

        <ol className="space-y-14">
          {q.questions.map((qq, i) => {
            const fields = fieldsOf(qq)
            return (
              <li key={qq.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] sm:grid-cols-[3rem_minmax(0,1fr)]">
                <span className="pt-1 text-sm text-ink-40 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h2 className="text-lg font-medium text-ink leading-snug">{qq.title}</h2>
                  {qq.help && <p className="mt-2 text-sm text-ink-60 leading-relaxed">{qq.help}</p>}
                  <div className="mt-5 space-y-5">
                    {fields.map((f) => (
                      <label key={f.id} className="block">
                        {f.label && <span className="block mb-2 text-sm font-medium text-ink">{f.label}</span>}
                        <AutoText value={answers[f.id] || ''} onChange={(v) => setAnswer(f.id, v)} placeholder={f.placeholder || t.placeholder} />
                      </label>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <footer className="mt-16 pt-8 border-t border-line flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-ink-40">
            {save === 'saving' ? t.saving : save === 'error' ? <span className="text-[#DC2626]">{t.error}</span> : t.answered(answered, q.questions.length)}
          </span>
          <button
            onClick={submit}
            disabled={sending || answered === 0}
            className="px-6 py-3 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? t.sending : submitted ? t.resubmit : t.submit}
          </button>
        </footer>

        <p className="mt-16 text-xs text-ink-40">savvia.studio</p>
      </article>
    </main>
  )
}
