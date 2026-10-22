'use client'

import { useEffect, useState } from 'react'
import { Clock, FileText, StickyNote } from 'lucide-react'
import { madridToday, type Board } from '@/lib/firestore/planning'
import type { TimeProject, TimeEntry } from '@/types/time'
import type { Quote } from '@/types/quote'
import { Faces, ProjectMark } from './StudioMarks'
import {
  NEWS_LIMIT, NOVEDADES_DIAS_MAX, QUOTE_STATUS, countdown, dayLabel, daysUntil, effectiveWho, fmtDay, fmtH,
  includesMe, sameProject, shiftDays, toISODate,
} from './boardUtils'

const EYEBROW = 'text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40'

interface Billing {
  year: number; base: number; pending: number; invoices: number; byMonth: number[]
}

const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

/** Facturación anual desde Holded (vía /api/holded/summary; la clave nunca llega al navegador) */
function BillingSection({ today }: { today: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'off' | 'error'>('loading')
  const [data, setData] = useState<Billing | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        const token = await auth.currentUser?.getIdToken()
        if (!token) { if (!cancelled) setState('off'); return }
        const res = await fetch(`/api/holded/summary?year=${today.slice(0, 4)}`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.status === 503) { if (!cancelled) setState('off'); return }
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as Billing
        if (!cancelled) { setData(json); setState('ok') }
      } catch (err) {
        console.error('[holded] No se pudo leer la facturación:', err)
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [today])

  if (state === 'off') return null
  const monthIdx = Number(today.slice(5, 7)) - 1
  const monthName = new Date(today + 'T00:00:00').toLocaleDateString('es-ES', { month: 'long' })
  const max = data ? Math.max(...data.byMonth, 1) : 1

  return (
    <section className="pt-5 border-t border-line">
      <div className="flex items-baseline justify-between mb-2">
        <p className={EYEBROW}>Facturación {today.slice(0, 4)}</p>
        <span className="text-[10px] text-ink-40">Holded</span>
      </div>
      {state === 'loading' && <div className="h-14 rounded bg-surface animate-pulse" />}
      {state === 'error' && <p className="text-sm text-ink-40">No se pudo leer Holded ahora mismo.</p>}
      {state === 'ok' && data && (
        <>
          <p className="text-xl font-medium tracking-tight text-ink tabular-nums">{eur(data.base)}</p>
          <p className="text-xs text-ink-40 mb-3">base imponible · {data.invoices} factura{data.invoices === 1 ? '' : 's'}</p>
          <div className="flex items-end gap-[3px] h-10 mb-2" aria-label="Facturación por mes">
            {data.byMonth.map((v, i) => (
              <div
                key={i}
                title={`${new Date(Number(today.slice(0, 4)), i, 1).toLocaleDateString('es-ES', { month: 'long' })}: ${eur(v)}`}
                className={`flex-1 rounded-sm ${i === monthIdx ? 'bg-accent' : i < monthIdx ? 'bg-ink' : 'bg-line'}`}
                style={{ height: `${Math.max(v > 0 ? 8 : 4, (Math.max(v, 0) / max) * 100)}%`, opacity: i === monthIdx ? 1 : i < monthIdx ? 0.35 : 1 }}
              />
            ))}
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-60 capitalize">{monthName}</dt>
              <dd className="tabular-nums text-ink">{eur(data.byMonth[monthIdx] || 0)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  )
}

interface Props {
  board: Board
  timeProjects: TimeProject[]
  timeEntries: TimeEntry[]
  quotes: Quote[]
  lastSeen: string | null
  me: string
}

type Ev = {
  key: string; date: string; kind: 'nota' | 'horas' | 'presupuesto'
  project: string; color: string; showLogo?: boolean
  text: string; who?: string; meta: string; mine: boolean
}

export function StudioSidebar({ board, timeProjects, timeEntries, quotes, lastSeen, me }: Props) {
  const [showAll, setShowAll] = useState(false)
  const today = madridToday()
  const groupFor = (name: string) => board.groups.find((g) => sameProject(g.name, name))

  // ── Próximas entregas ──
  // Entregas de proyecto (30 días) y reuniones/fechas de notas (14 días), juntas por fecha
  type Upcoming = { key: string; date: string; time?: string; label: string; project: string; color: string; showLogo?: boolean }
  const upcoming: Upcoming[] = [
    ...board.groups
      .filter((g) => g.deadline && daysUntil(g.deadline, today) <= 30)
      .map((g): Upcoming => ({ key: `p${g.name}`, date: g.deadline!, label: g.deadlineLabel || 'Entrega', project: g.name, color: g.color, showLogo: g.showLogo })),
    ...board.chips
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.due && c.state !== 'esperando' && daysUntil(c.due, today) >= -1 && daysUntil(c.due, today) <= 14)
      .map(({ c, i }): Upcoming => {
        const g = board.groups.find((x) => x.name === c.group)
        return { key: `n${i}`, date: c.due!, time: c.time, label: c.text, project: c.group, color: g?.color ?? '#E5E5E5', showLogo: g?.showLogo }
      }),
  ].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))

  // ── Este mes ──
  const month = today.slice(0, 7)
  const monthRows = timeProjects.map((p) => {
    let h = 0
    for (const e of timeEntries) if (e.projectId === p.id && e.date?.startsWith(month)) h += e.hours || 0
    return { p, h, g: groupFor(p.name || '') }
  }).filter((r) => r.h > 0).sort((a, b) => b.h - a.h)
  const monthTotal = monthRows.reduce((s, r) => s + r.h, 0)
  const monthName = new Date(today + 'T00:00:00').toLocaleDateString('es-ES', { month: 'long' })

  // ── Novedades: notas, horas y presupuestos desde la última visita ──
  const floor = shiftDays(today, -NOVEDADES_DIAS_MAX)
  const cutoff = lastSeen && lastSeen > floor ? lastSeen : floor
  const events: Ev[] = []
  board.chips.forEach((c, i) => {
    if (!c.date || c.date < cutoff) return
    const g = board.groups.find((x) => x.name === c.group)
    const eff = effectiveWho(c.who, g?.owner)
    events.push({
      key: `n${i}`, date: c.date, kind: 'nota', project: c.group, color: g?.color ?? '#E5E5E5', showLogo: g?.showLogo,
      text: c.text, who: eff,
      meta: (eff === 'Eric y Andoni' ? 'los dos' : eff === me ? 'para ti' : `para ${eff}`) + (c.by && c.by !== eff ? ` · de ${c.by}` : ''),
      mine: includesMe(eff, me),
    })
  })
  const byDayProject = new Map<string, TimeEntry[]>()
  for (const e of timeEntries) {
    if (!e.date || e.date < cutoff) continue
    const k = `${e.date}|${e.projectId}`
    if (!byDayProject.has(k)) byDayProject.set(k, [])
    byDayProject.get(k)!.push(e)
  }
  byDayProject.forEach((list, k) => {
    const [date, projectId] = k.split('|')
    const pname = timeProjects.find((p) => p.id === projectId)?.name ?? 'Proyecto'
    const g = groupFor(pname)
    const total = list.reduce((s, e) => s + (e.hours || 0), 0)
    const people = [...new Set(list.map((e) => e.person).filter(Boolean))]
    const who = people.length === 1 ? people[0] : 'Eric y Andoni'
    const concepts = list.map((e) => e.description).filter(Boolean)
    events.push({
      key: `h${k}`, date, kind: 'horas', project: g?.name ?? pname, color: g?.color ?? '#E5E5E5', showLogo: g?.showLogo,
      text: `${fmtH(total)} h${concepts[0] ? ` — ${concepts[0]}` : ''}${concepts.length > 1 ? ` (+${concepts.length - 1})` : ''}`,
      who, meta: who === 'Eric y Andoni' ? 'los dos' : who === me ? 'tú' : who, mine: includesMe(who, me),
    })
  })
  for (const q of quotes) {
    const date = toISODate((q as unknown as { createdAt?: unknown }).createdAt)
    if (!date || date < cutoff) continue
    const client = q.client?.company || q.client?.name || 'Sin cliente'
    const g = groupFor(client)
    events.push({
      key: `q${q.id}`, date, kind: 'presupuesto', project: g?.name ?? client, color: g?.color ?? '#E5E5E5', showLogo: g?.showLogo,
      text: `Nuevo presupuesto${q.quoteNumber ? ` ${q.quoteNumber}` : ''} · ${QUOTE_STATUS[q.status] ?? q.status}`,
      meta: 'presupuesto', mine: true,
    })
  }
  events.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
  const visible = showAll ? events : events.slice(0, NEWS_LIMIT)
  const newsHeader = lastSeen && lastSeen > floor ? `Desde tu última visita · ${dayLabel(lastSeen, today).toLowerCase()}` : 'Novedades'

  // ── Parados: sin notas, estado ni horas en 14 días ──
  const staleCut = shiftDays(today, -14)
  const stale = board.groups.filter((g) => {
    let last = g.statusDate ?? ''
    for (const c of board.chips) if (c.group === g.name && c.date && c.date > last) last = c.date
    for (const p of timeProjects) {
      if (!sameProject(p.name || '', g.name)) continue
      for (const e of timeEntries) if (e.projectId === p.id && e.date && e.date > last) last = e.date
    }
    return !last || last < staleCut
  })

  const KindIcon = ({ kind }: { kind: Ev['kind'] }) =>
    kind === 'horas' ? <Clock size={11} strokeWidth={1.5} />
    : kind === 'presupuesto' ? <FileText size={11} strokeWidth={1.5} />
    : <StickyNote size={11} strokeWidth={1.5} />

  return (
    <aside className="space-y-6 lg:sticky lg:top-6">
      {upcoming.length > 0 && (
        <section>
          <p className={`${EYEBROW} mb-2.5`}>Próximas fechas</p>
          <ul className="space-y-2.5">
            {upcoming.map((u) => {
              const cd = countdown(u.date, today)
              return (
                <li key={u.key}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0"><ProjectMark name={u.project} color={u.color} showLogo={u.showLogo} size={18} compact /></span>
                    <span className={`shrink-0 whitespace-nowrap px-1.5 py-px rounded text-[11px] font-medium ${cd.pill}`}>{cd.text}</span>
                  </div>
                  <p className="text-xs text-ink-60 mt-0.5 pl-[26px] line-clamp-2">{u.label}</p>
                  <p className="text-[11px] text-ink-40 pl-[26px]">{fmtDay(u.date)}{u.time ? ` · ${u.time}` : ''}</p>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className={upcoming.length > 0 ? 'pt-5 border-t border-line' : ''}>
        <div className="flex items-baseline justify-between mb-2.5">
          <p className={EYEBROW}>Este mes · {monthName}</p>
          <span className="text-sm font-medium text-ink tabular-nums">{fmtH(monthTotal)} h</span>
        </div>
        {monthRows.length > 0 ? (
          <ul className="space-y-1.5">
            {monthRows.map(({ p, h, g }) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0"><ProjectMark name={g?.name ?? p.name} color={g?.color ?? '#E5E5E5'} showLogo={g?.showLogo} size={18} compact /></span>
                <span className="tabular-nums text-ink-60 shrink-0">{fmtH(h)} h</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-40">Aún no hay horas este mes.</p>
        )}
      </section>

      {(() => {
        const waiting = board.chips
          .filter((c) => c.state === 'esperando')
          .sort((a, b) => (a.stateDate ?? '').localeCompare(b.stateDate ?? ''))
        if (waiting.length === 0) return null
        return (
          <section className="pt-5 border-t border-line">
            <div className="flex items-baseline justify-between mb-2.5">
              <p className={EYEBROW}>Esperando feedback</p>
              <span className="text-[11px] text-[#B45309] tabular-nums">{waiting.length}</span>
            </div>
            <ul className="space-y-2">
              {waiting.map((c, i) => {
                const g = board.groups.find((x) => x.name === c.group)
                const days = c.stateDate ? -daysUntil(c.stateDate, today) : 0
                return (
                  <li key={i} className="text-sm">
                    <div className="flex items-center justify-between gap-2 text-xs text-ink-40">
                      <span className="truncate text-ink-60">{c.group}</span>
                      <span className={`shrink-0 tabular-nums ${days >= 7 ? 'text-[#B45309]' : ''}`}>
                        {days <= 0 ? 'hoy' : days === 1 ? 'desde ayer' : `hace ${days} días`}
                      </span>
                    </div>
                    <p className="text-ink leading-snug line-clamp-2" title={g ? `${g.name}` : undefined}>{c.text}</p>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })()}

      <BillingSection today={today} />

      <section className="pt-5 border-t border-line">
        <p className={`${EYEBROW} mb-2.5`}>{newsHeader}</p>
        {events.length === 0 ? (
          <p className="text-sm text-ink-40">Nada nuevo: ni notas, ni horas, ni presupuestos.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {visible.map((ev) => (
                <li key={ev.key} className={ev.mine ? '' : 'opacity-55'}>
                  <div className="flex items-center gap-1.5 text-xs text-ink-40">
                    <KindIcon kind={ev.kind} />
                    <span className="tabular-nums">{dayLabel(ev.date, today)}</span>
                    <span>·</span>
                    <span className="truncate text-ink-60">{ev.project}</span>
                    <span className="ml-auto shrink-0 flex items-center gap-1">
                      {ev.who && <Faces who={ev.who} size={14} />}
                    </span>
                  </div>
                  <p className="text-sm text-ink leading-snug mt-0.5 line-clamp-2">{ev.text}</p>
                  {ev.kind === 'nota' && ev.meta && (
                    <p className={`text-[11px] mt-0.5 ${ev.meta.startsWith('para ti') ? 'text-ink font-medium' : 'text-ink-40'}`}>{ev.meta}</p>
                  )}
                </li>
              ))}
            </ul>
            {events.length > NEWS_LIMIT && (
              <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs text-ink-40 hover:text-ink transition-colors">
                {showAll ? 'Ver menos' : `Ver todo (${events.length})`}
              </button>
            )}
          </>
        )}
      </section>

      {stale.length > 0 && (
        <section className="pt-5 border-t border-line">
          <p className={`${EYEBROW} mb-1.5`}>Sin movimiento en 14+ días</p>
          <p className="text-sm text-ink-60 leading-relaxed">{stale.map((g) => g.name).join(' · ')}</p>
        </section>
      )}

      <section className="pt-5 border-t border-line">
        <p className={`${EYEBROW} mb-1.5`}>Para el sync semanal</p>
        <p className="text-xs text-ink-60 leading-relaxed">¿Qué se entregó? · ¿Qué está bloqueado? · ¿Seguimos construyendo lo mismo?</p>
      </section>
    </aside>
  )
}
