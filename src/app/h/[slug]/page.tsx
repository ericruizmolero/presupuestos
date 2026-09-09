'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { getTimeProjectBySlug, getTimeEntries } from '@/lib/firestore/time'
import type { TimeProject, TimeEntry } from '@/types/time'

const I18N = {
  es: {
    locale: 'es-ES',
    eyebrow: 'Registro de horas',
    total: 'Total',
    amount: 'Importe',
    rate: 'Tarifa',
    empty: 'Aún no hay horas registradas.',
    notFound: 'Este registro de horas no existe o ya no está disponible.',
    updated: 'actualizado a',
  },
  en: {
    locale: 'en-GB',
    eyebrow: 'Time log',
    total: 'Total',
    amount: 'Amount',
    rate: 'Rate',
    empty: 'No hours logged yet.',
    notFound: 'This time log does not exist or is no longer available.',
    updated: 'updated',
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
  const { slug } = useParams<{ slug: string }>()
  const [project, setProject] = useState<TimeProject | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    if (!slug) return
    getTimeProjectBySlug(slug).then(async (p) => {
      if (!p) { setState('notfound'); return }
      setProject(p)
      setEntries(await getTimeEntries(p.id))
      setState('ready')
    }).catch(() => setState('notfound'))
  }, [slug])

  const byMonth = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>()
    for (const e of entries) {
      const key = (e.date || '').slice(0, 7) // yyyy-mm
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(e)
    }
    // Newest month first; entries inside are already date-desc
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])

  const totals = useMemo(() => {
    const byPerson = new Map<string, number>()
    let total = 0
    for (const e of entries) {
      total += e.hours || 0
      byPerson.set(e.person, (byPerson.get(e.person) || 0) + (e.hours || 0))
    }
    return { total, byPerson: [...byPerson.entries()].sort((a, b) => b[1] - a[1]) }
  }, [entries])

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
          {project.clientName && (
            <p className="text-base text-ink-60 mt-1">{project.clientName}</p>
          )}
        </header>

        {/* Totals */}
        <section className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-12 pb-6 border-b border-line">
          <div>
            <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-1">{t.total}</p>
            <p className="text-2xl font-medium tracking-tight text-ink">{formatHours(totals.total, locale)}</p>
          </div>
          {project.hourlyRate ? (
            <>
              <div>
                <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-1">{t.amount}</p>
                <p className="text-2xl font-medium tracking-tight text-ink">{formatMoney(totals.total * project.hourlyRate, locale)}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-1">{t.rate}</p>
                <p className="text-2xl font-medium tracking-tight text-ink-60">{formatMoney(project.hourlyRate, locale)}/h</p>
              </div>
            </>
          ) : null}
          {totals.byPerson.length > 1 && totals.byPerson.map(([name, h]) => (
            <div key={name}>
              <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-1">{name}</p>
              <p className="text-2xl font-medium tracking-tight text-ink-60">{formatHours(h, locale)}</p>
            </div>
          ))}
        </section>

        {/* Entries grouped by month */}
        {entries.length === 0 ? (
          <p className="text-sm text-ink-40 text-center py-6">{t.empty}</p>
        ) : (
          byMonth.map(([month, monthEntries]) => {
            const monthTotal = monthEntries.reduce((s, e) => s + (e.hours || 0), 0)
            return (
              <section key={month} className="mb-10">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40">
                    {monthLabel(monthEntries[0].date, locale)}
                  </h2>
                  <span className="text-xs text-ink-60 font-medium">
                    {formatHours(monthTotal, locale)}
                    {project.hourlyRate ? ` · ${formatMoney(monthTotal * project.hourlyRate, locale)}` : ''}
                  </span>
                </div>
                <div className="border border-line rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {monthEntries.map((e, i) => (
                        <tr key={e.id} className={`border-b border-line last:border-b-0 ${i % 2 === 1 ? 'bg-surface' : 'bg-paper'}`}>
                          <td className="px-4 py-3 whitespace-nowrap text-ink-60 w-28">{formatDate(e.date, locale)}</td>
                          <td className="px-4 py-3 whitespace-nowrap w-24">{e.person}</td>
                          <td className="px-4 py-3 text-ink-60">{e.description || '—'}</td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap w-20">{formatHours(e.hours, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })
        )}

        <footer className="mt-16 pt-6 border-t border-line">
          <p className="text-xs text-ink-40">
            {project.companyName || 'treseiscero'} · {t.updated} {new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </footer>
      </article>
    </main>
  )
}
