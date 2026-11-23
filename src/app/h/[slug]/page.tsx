'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import type { TimeProject, TimeEntry } from '@/types/time'
import { applyCompanyTheme } from '@/lib/companyTheme'

const I18N = {
  es: {
    locale: 'es-ES',
    eyebrow: 'Registro de horas',
    total: 'Este mes',
    amount: 'Importe del mes',
    rate: 'Tarifa',
    empty: 'Aún no hay horas registradas.',
    notFound: 'Este registro de horas no existe o ya no está disponible.',
    updated: 'actualizado a',
    all: 'Todos',
    other: 'Otros',
  },
  en: {
    locale: 'en-GB',
    eyebrow: 'Time log',
    total: 'This month',
    amount: "Month's amount",
    rate: 'Rate',
    empty: 'No hours logged yet.',
    notFound: 'This time log does not exist or is no longer available.',
    updated: 'updated',
    all: 'All',
    other: 'Other',
  },
} as const

type Lang = keyof typeof I18N

function formatDate(iso: string, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatHours(h: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(h) + ' h'
}

function formatMoney(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
}

function monthLabel(iso: string, locale: string) {
  const d = new Date(iso + 'T00:00:00')
  const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function PublicHoursPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-paper" />}>
      <PublicHours />
    </Suspense>
  )
}

function PublicHours() {
  const { slug } = useParams<{ slug: string }>()
  const search = useSearchParams()
  // ?p=Wisable abre directamente ese subproyecto (enlace para compartir)
  const [sub, setSub] = useState(search.get('p') || '')
  const [project, setProject] = useState<TimeProject | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    if (!slug) return
    fetch(`/api/public/hours/${encodeURIComponent(slug)}`, { cache: 'no-store' }).then(async (res) => {
      if (!res.ok) { setState('notfound'); return }
      const { project: p, entries: es } = (await res.json()) as { project: TimeProject; entries: TimeEntry[] }
      await applyCompanyTheme(p.companyId)
      setProject(p)
      setEntries(es)
      setState('ready')
    }).catch(() => setState('notfound'))
  }, [slug])

  const subs = project?.subprojects || []
  const hasOther = subs.length > 0 && entries.some((e) => !e.subproject)
  const visible = useMemo(() => {
    if (!sub || !subs.length) return entries
    return entries.filter((e) => (sub === '__other' ? !e.subproject : e.subproject === sub))
  }, [entries, sub, subs.length])

  function pick(next: string) {
    setSub(next)
    const url = new URL(window.location.href)
    if (next) url.searchParams.set('p', next)
    else url.searchParams.delete('p')
    window.history.replaceState(null, '', url.toString())
  }

  const byMonth = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>()
    for (const e of visible) {
      const key = (e.date || '').slice(0, 7) // yyyy-mm
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(e)
    }
    // Newest month first; entries inside are already date-desc
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [visible])

  // Solo el mes en curso (Madrid): lo anterior ya está facturado
  const totals = useMemo(() => {
    const month = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit',
    }).format(new Date())
    let total = 0
    for (const e of visible) {
      if ((e.date || '').startsWith(month)) total += e.hours || 0
    }
    return { total }
  }, [visible])

  const lang: Lang = project?.language === 'en' ? 'en' : 'es'
  const t = I18N[lang]
  const { locale } = t

  if (state === 'loading') {
    return <main className="min-h-screen bg-paper flex items-center justify-center text-sm text-ink-40">…</main>
  }

  if (state === 'notfound' || !project) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-sm text-ink-40">{I18N.es.notFound}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-paper">
      <article className="max-w-2xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        {/* Header */}
        <header className="mb-12">
          {project.logoUrl && (
            <img
              src={project.logoUrl}
              alt={project.companyName || ''}
              className="object-contain mb-8"
              style={{ maxHeight: '1.5rem', maxWidth: '8rem' }}
            />
          )}
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase mb-4 text-ink-40">
            {t.eyebrow}
          </p>
          <h1 className="text-[1.625rem] font-medium tracking-tight text-ink leading-snug">
            {project.name}
          </h1>
          {project.clientName && project.clientName !== project.name && (
            <p className="text-base text-ink-60 mt-1">{project.clientName}</p>
          )}
        </header>

        {/* Subproyectos */}
        {subs.length > 0 && (
          <nav className="flex flex-wrap gap-1.5 mb-8">
            {[['', t.all], ...subs.map((x) => [x, x]), ...(hasOther ? [['__other', t.other]] : [])].map(([key, label]) => (
              <button
                key={key || 'all'}
                onClick={() => pick(key)}
                className={`h-8 px-3 rounded-full border text-sm transition-colors ${
                  sub === key ? 'border-accent bg-accent text-on-accent' : 'border-line text-ink-60 hover:border-input hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* Totals */}
        <section className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-12 pb-6 border-b border-line">
          <div>
            <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-1">{t.total}</p>
            <p className="text-2xl font-medium tracking-tight text-ink">{formatHours(totals.total, locale)}</p>
          </div>
          {project.hourlyRate ? (
            <div>
              <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-1">{t.amount}</p>
              <p className="text-lg font-medium tracking-tight text-ink-60">{formatMoney(totals.total * project.hourlyRate, locale)}</p>
              <p className="text-xs text-ink-40 mt-0.5">{formatMoney(project.hourlyRate, locale)}/h</p>
            </div>
          ) : null}
        </section>

        {/* Entries grouped by month */}
        {entries.length === 0 ? (
          <p className="text-sm text-ink-40 text-center py-6">{t.empty}</p>
        ) : (
          byMonth.map(([month, monthEntries], mi) => {
            const monthTotal = monthEntries.reduce((s, e) => s + (e.hours || 0), 0)
            const split = subs.length && !sub
              ? [...subs, ''].map((x) => [x || t.other, monthEntries.filter((e) => (x ? e.subproject === x : !e.subproject)).reduce((a, e) => a + (e.hours || 0), 0)] as const).filter(([, h]) => h > 0)
              : []
            return (
              <section key={month} className={mi === 0 ? 'mb-16' : 'mb-16 pt-10 border-t border-line'}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-lg font-medium tracking-tight text-ink">
                    {monthLabel(monthEntries[0].date, locale)}
                  </h2>
                  <span className="text-sm text-ink font-medium">
                    {formatHours(monthTotal, locale)}
                    {project.hourlyRate ? (
                      <span className="text-ink-40 font-normal"> · {formatMoney(monthTotal * project.hourlyRate, locale)}</span>
                    ) : null}
                  </span>
                </div>
                {split.length > 1 && (
                  <p className="-mt-2 mb-4 text-xs text-ink-60">
                    {split.map(([n, h], i) => (
                      <span key={n}>{i > 0 && ', '}{n} <span className="text-ink font-medium">{formatHours(h, locale)}</span></span>
                    ))}
                  </p>
                )}
                <div className="border border-line rounded-md overflow-hidden">
                  {/* Desktop: table */}
                  <table className="w-full text-sm hidden sm:table">
                    <tbody>
                      {monthEntries.map((e, i) => (
                        <tr key={e.id} className={`border-b border-line last:border-b-0 ${i % 2 === 1 ? 'bg-surface' : 'bg-paper'}`}>
                          <td className="px-4 py-3 whitespace-nowrap text-ink-60 w-28 align-top">{formatDate(e.date, locale)}</td>
                          <td className="px-4 py-3 text-ink-60">
                            {subs.length > 0 && !sub && e.subproject && (
                              <span className="inline-flex mr-2 px-1.5 py-px rounded border border-line text-[11px] text-ink align-[1px]">{e.subproject}</span>
                            )}
                            {e.description || '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap w-20 align-top">{formatHours(e.hours, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Mobile: stacked cards */}
                  <div className="sm:hidden">
                    {monthEntries.map((e, i) => (
                      <div key={e.id} className={`px-4 py-3 border-b border-line last:border-b-0 ${i % 2 === 1 ? 'bg-surface' : 'bg-paper'}`}>
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                          <span className="text-xs text-ink-40 whitespace-nowrap">
                            {formatDate(e.date, locale)}
                          </span>
                          <span className="text-sm font-medium whitespace-nowrap">{formatHours(e.hours, locale)}</span>
                        </div>
                        <p className="text-sm text-ink-60 leading-snug">
                          {subs.length > 0 && !sub && e.subproject && (
                            <span className="inline-flex mr-1.5 px-1.5 py-px rounded border border-line text-[11px] text-ink">{e.subproject}</span>
                          )}
                          {e.description || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )
          })
        )}

        <footer className="mt-16 pt-6 border-t border-line">
          <p className="text-xs text-ink-40">
            {project.companyName || 'Savvia Studio'} · {t.updated} {new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </footer>
      </article>
    </main>
  )
}
