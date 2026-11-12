'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { findingGroups, hostOf, type Audit, type AuditReference } from '@/lib/auditModel'

const I18N = {
  es: {
    eyebrow: (c: string) => (c ? `Auditoría web para ${c}` : 'Auditoría web'),
    hello: (n: string) => `Hola, ${n}`,
    summary: 'Lo esencial',
    s1: 'Lo que cambiaríamos',
    s1sub: 'Hemos recorrido la web de arriba abajo. Esto es lo que tocaríamos en cada parte, y lo que dejaríamos tal cual.',
    keep: 'Lo mantendríamos',
    s2: 'Dónde nos inspiraríamos',
    s2sub: 'Webs en las que nos fijaríamos para el rediseño. Pulsa cada una para ver qué nos gusta de ella.',
    avoid: 'Lo que evitaríamos',
    avoidSub: 'También tenemos claro por dónde no ir.',
    s3: 'Cómo lo haríamos',
    hours: 'horas',
    recommended: 'Recomendado',
    vat: '+ IVA',
    open: 'Abrir web',
    refs: 'Referencias',
    close: 'Cerrar',
  },
  en: {
    eyebrow: (c: string) => (c ? `Website audit for ${c}` : 'Website audit'),
    hello: (n: string) => `Hi ${n},`,
    summary: 'The essentials',
    s1: 'What we would change',
    s1sub: 'We went through the site top to bottom. This is what we would change in each part, and what we would keep.',
    keep: 'We would keep it',
    s2: 'Where we would look for inspiration',
    s2sub: 'Sites we would look at for the redesign. Click each one to see what we like about it.',
    avoid: 'What we would avoid',
    avoidSub: 'We are also clear about where not to go.',
    s3: 'How we would do it',
    hours: 'hours',
    recommended: 'Recommended',
    vat: '+ VAT',
    open: 'Open site',
    refs: 'References',
    close: 'Close',
  },
} as const

type T = (typeof I18N)['es'] | (typeof I18N)['en']

function SectionHead({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <header className="mb-10">
      <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-3 tabular-nums">{String(n).padStart(2, '0')}</p>
      <h2 className="text-[1.5rem] sm:text-[1.75rem] font-medium tracking-tight text-ink leading-tight">{title}</h2>
      {sub && <p className="mt-3 text-base text-ink-60 leading-relaxed max-w-xl">{sub}</p>}
    </header>
  )
}

/** Pastilla de referencia: miniatura + nombre; abre la ficha */
function RefPill({ r, onOpen, small }: { r: AuditReference; onOpen: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group inline-flex items-center gap-2 rounded-full border border-line bg-paper hover:border-ink-40 hover:bg-surface transition-colors ${small ? 'pl-1 pr-3 py-1 text-xs' : 'pl-1.5 pr-4 py-1.5 text-sm'} text-ink`}
    >
      <span className={`${small ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-[11px]'} rounded-full overflow-hidden bg-surface border border-line shrink-0 flex items-center justify-center font-medium text-ink-60`}>
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image} alt="" className="w-full h-full object-cover object-top" loading="lazy" />
        ) : r.name.slice(0, 1).toUpperCase()}
      </span>
      <span className={`font-medium ${r.avoid ? 'text-ink-60' : ''}`}>{r.name}</span>
    </button>
  )
}

/** Ficha de una referencia (o una imagen ampliada), con flechas entre referencias */
function Sheet({ refs, index, image, onClose, onIndex, t }: {
  refs: AuditReference[]; index: number | null; image: string | null; onClose: () => void; onIndex: (i: number) => void; t: T
}) {
  const r = index !== null ? refs[index] : null
  const go = useCallback((d: number) => { if (index !== null) onIndex((index + d + refs.length) % refs.length) }, [index, refs.length, onIndex])

  useEffect(() => {
    if (!r && !image) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (r && e.key === 'ArrowRight') go(1)
      if (r && e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [r, image, onClose, go])

  if (!r && !image) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-3xl max-h-[92vh] flex flex-col bg-paper sm:rounded-lg rounded-t-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label={t.close} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-paper/90 border border-line text-ink-60 hover:text-ink">
          <X size={15} strokeWidth={1.75} />
        </button>

        {image && !r ? (
          <div className="overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="w-full h-auto" />
          </div>
        ) : r ? (
          <div className="overflow-auto">
            {r.image && (
              <div className="bg-surface border-b border-line max-h-[52vh] overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.image} alt={r.name} className="w-full h-auto" />
              </div>
            )}
            <div className="px-6 sm:px-8 py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-xl font-medium tracking-tight text-ink">{r.name}</h3>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink">
                    {hostOf(r.url)}<ArrowUpRight size={13} strokeWidth={1.75} />
                  </a>
                )}
              </div>
              {r.avoid && <p className="mt-1 text-xs font-medium tracking-[0.12em] uppercase text-ink-40">{t.avoid}</p>}
              <div className="mt-5 space-y-3">
                {r.notes.map((n, i) => (
                  <p key={i} className="pl-4 border-l-2 border-line text-base text-ink leading-relaxed whitespace-pre-line">{n}</p>
                ))}
              </div>
              {r.tags && r.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {r.tags.map((tg) => <span key={tg} className="px-2 py-0.5 rounded-full bg-surface text-[11px] text-ink-60">{tg}</span>)}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {r && refs.length > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-line text-sm text-ink-60">
            <button onClick={() => go(-1)} className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-surface hover:text-ink"><ChevronLeft size={15} strokeWidth={1.75} />{refs[(index! - 1 + refs.length) % refs.length].name}</button>
            <span className="text-xs text-ink-40 tabular-nums">{index! + 1} / {refs.length}</span>
            <button onClick={() => go(1)} className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-surface hover:text-ink">{refs[(index! + 1) % refs.length].name}<ChevronRight size={15} strokeWidth={1.75} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

export function AuditView({ audit }: { audit: Audit }) {
  const t = I18N[audit.language === 'en' ? 'en' : 'es']
  const [open, setOpen] = useState<number | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

  // Orden de la ficha: primero las que nos inspiran, luego las que evitaríamos
  const refs = [...audit.references.filter((r) => !r.avoid), ...audit.references.filter((r) => r.avoid)]
  const openRef = (id: string) => { const i = refs.findIndex((r) => r.id === id); if (i >= 0) setOpen(i) }
  const groups = findingGroups(audit.findings || [])
  const like = refs.filter((r) => !r.avoid)
  const avoid = refs.filter((r) => r.avoid)
  const plans = audit.plans || []
  const fmt = (n: number) => new Intl.NumberFormat(audit.language === 'en' ? 'en-US' : 'es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions).format(n)
  let sec = 0

  return (
    <article className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
      <header className="mb-16 sm:mb-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/savvia-logo-cacao.svg" alt="Savvia" className="h-6 w-auto mb-12" />
        <p className="text-[10px] font-medium tracking-[0.18em] uppercase mb-4 text-ink-40">{t.eyebrow(audit.clientCompany || '')}</p>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-medium tracking-tight text-ink leading-[1.1]">{audit.title}</h1>
        {audit.siteUrl && (
          <a href={audit.siteUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink">
            {hostOf(audit.siteUrl)}<ArrowUpRight size={13} strokeWidth={1.75} />
          </a>
        )}
        {audit.clientName && <p className="mt-10 text-base text-ink">{t.hello(audit.clientName)}</p>}
        {audit.intro && <p className="mt-3 text-base text-ink-60 leading-relaxed whitespace-pre-line max-w-2xl">{audit.intro}</p>}

        {audit.summary && audit.summary.length > 0 && (
          <div className="mt-10 rounded-lg bg-surface px-6 py-5">
            <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-3">{t.summary}</p>
            <ul className="space-y-2">
              {audit.summary.map((s, i) => (
                <li key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)] text-base text-ink leading-relaxed">
                  <span className="mt-[0.7em] w-1 h-1 rounded-full bg-ink-40" /><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {groups.length > 0 && (
        <section className="mb-24">
          <SectionHead n={++sec} title={t.s1} sub={t.s1sub} />
          <div className="space-y-16">
            {groups.map((g) => (
              <div key={g.section}>
                <h3 className="text-sm font-medium text-ink pb-3 mb-8 border-b border-line">{g.section}</h3>
                <div className="space-y-12">
                  {g.items.map((f) => (
                    <div key={f.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-medium text-ink leading-snug">{f.title}</h4>
                        {f.keep && <span className="px-2 py-0.5 rounded-full bg-surface text-[11px] font-medium text-ink-60">{t.keep}</span>}
                      </div>
                      <p className="mt-2 text-base text-ink-60 leading-relaxed whitespace-pre-line">{f.body}</p>
                      {f.image && (
                        <button type="button" onClick={() => setZoom(f.image!)} className="mt-5 block w-full rounded-lg overflow-hidden border border-line bg-surface cursor-zoom-in">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.image} alt={f.title} className="w-full h-auto max-h-[28rem] object-cover object-top" loading="lazy" />
                        </button>
                      )}
                      {f.refs && f.refs.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                          {f.refs.map((id) => {
                            const r = refs.find((x) => x.id === id)
                            return r ? <RefPill key={id} r={r} small onOpen={() => openRef(id)} /> : null
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {refs.length > 0 && (
        <section className="mb-24">
          <SectionHead n={++sec} title={t.s2} sub={t.s2sub} />
          <div className="flex flex-wrap gap-2">
            {like.map((r) => <RefPill key={r.id} r={r} onOpen={() => openRef(r.id)} />)}
          </div>
          {avoid.length > 0 && (
            <div className="mt-12">
              <h3 className="text-sm font-medium text-ink">{t.avoid}</h3>
              <p className="mt-1 mb-4 text-sm text-ink-60">{t.avoidSub}</p>
              <div className="flex flex-wrap gap-2">
                {avoid.map((r) => <RefPill key={r.id} r={r} onOpen={() => openRef(r.id)} />)}
              </div>
            </div>
          )}
        </section>
      )}

      {plans.length > 0 && (
        <section className="mb-24">
          <SectionHead n={++sec} title={t.s3} sub={audit.plansIntro} />
          <div className={`grid gap-4 ${plans.length >= 3 ? 'sm:grid-cols-3' : plans.length === 2 ? 'sm:grid-cols-2' : ''}`}>
            {plans.map((p) => (
              <div key={p.id} className={`flex flex-col rounded-lg border px-5 py-6 ${p.recommended ? 'border-ink bg-paper' : 'border-line bg-paper'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[2rem] font-medium tracking-tight text-ink leading-none tabular-nums">{p.hours}<span className="ml-1.5 text-sm font-normal text-ink-40">{t.hours}</span></p>
                  {p.recommended && <span className="px-2 py-0.5 rounded-full bg-accent text-on-accent text-[11px] font-medium">{t.recommended}</span>}
                </div>
                <h3 className="mt-5 text-base font-medium text-ink">{p.title}</h3>
                {p.summary && <p className="mt-1.5 text-sm text-ink-60 leading-relaxed">{p.summary}</p>}
                <ul className="mt-4 space-y-2 flex-1">
                  {p.items.map((it, i) => (
                    <li key={i} className="grid grid-cols-[1rem_minmax(0,1fr)] text-sm text-ink leading-relaxed"><span className="mt-[0.7em] w-1 h-1 rounded-full bg-ink-40" /><span>{it}</span></li>
                  ))}
                </ul>
                {typeof p.price === 'number' && p.price > 0 && (
                  <p className="mt-5 pt-4 border-t border-line text-sm text-ink"><span className="font-medium">{fmt(p.price)}</span> <span className="text-ink-40">{t.vat}</span></p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {audit.closing && <p className="text-base text-ink leading-relaxed whitespace-pre-line max-w-2xl">{audit.closing}</p>}

      <p className="mt-16 text-xs text-ink-40">savvia.studio</p>

      <Sheet refs={refs} index={open} image={zoom} onClose={() => { setOpen(null); setZoom(null) }} onIndex={setOpen} t={t} />
    </article>
  )
}
