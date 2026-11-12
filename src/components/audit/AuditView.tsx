'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
    s2sub: 'Webs en las que nos fijaríamos para el rediseño y qué tomaríamos de cada una.',
    avoid: 'Lo que evitaríamos',
    avoidTag: 'Evitar',
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
    s2sub: 'Sites we would look at for the redesign and what we would take from each.',
    avoid: 'What we would avoid',
    avoidTag: 'Avoid',
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

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-12">
      <h2 className="text-[1.5rem] sm:text-[1.75rem] font-medium tracking-tight text-ink leading-tight">{title}</h2>
      {sub && <p className="mt-3 text-base text-ink-60 leading-relaxed max-w-xl">{sub}</p>}
    </header>
  )
}

/** Referencia dentro de un punto: miniatura, nombre y lo que destacamos de ella */
function RefMini({ r, onOpen, t }: { r: AuditReference; onOpen: () => void; t: T }) {
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col text-left rounded-lg border border-line bg-paper overflow-hidden hover:border-ink-40 transition-colors">
      <span className="block aspect-[16/9] bg-surface overflow-hidden">
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image} alt={r.name} className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500" loading="lazy" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-xl font-medium text-ink-40">{r.name}</span>
        )}
      </span>
      <span className="block px-4 py-3">
        <span className="flex items-center gap-2">
          <span className={`text-sm font-medium ${r.avoid ? 'text-ink-60' : 'text-ink'}`}>{r.name}</span>
          {r.avoid && <span className="px-1.5 py-px rounded-full bg-surface text-[10px] font-medium text-ink-60">{t.avoidTag}</span>}
        </span>
        <span className="mt-1 block text-[13px] text-ink-60 leading-snug">{r.notes.join(' ')}</span>
      </span>
    </button>
  )
}

/** Tarjeta de referencia: miniatura arriba, lo que destacamos debajo y enlace a la web */
function RefCard({ r, onOpen, t }: { r: AuditReference; onOpen: () => void; t: T }) {
  return (
    <div id={`ref-${r.id}`} className="flex flex-col rounded-lg border border-line bg-paper overflow-hidden scroll-mt-24">
      <button type="button" onClick={onOpen} className="block aspect-[16/10] bg-surface overflow-hidden cursor-zoom-in">
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image} alt={r.name} className="w-full h-full object-cover object-top hover:scale-[1.02] transition-transform duration-500" loading="lazy" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-3xl font-medium text-ink-40">{r.name}</span>
        )}
      </button>
      <div className="flex flex-col flex-1 px-5 py-4">
        <h3 className={`text-base font-medium ${r.avoid ? 'text-ink-60' : 'text-ink'}`}>{r.name}</h3>
        <div className="mt-2 space-y-1.5 flex-1">
          {r.notes.map((n, i) => <p key={i} className="text-sm text-ink-60 leading-relaxed whitespace-pre-line">{n}</p>)}
        </div>
        {r.url && (
          <a href={r.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 self-start text-sm font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            {hostOf(r.url)}<ArrowUpRight size={13} strokeWidth={1.75} />
          </a>
        )}
      </div>
    </div>
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
              <div className="mt-4 space-y-2">
                {r.notes.map((n, i) => (
                  <p key={i} className="text-base text-ink-60 leading-relaxed whitespace-pre-line">{n}</p>
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

const zid = (s: string) => 'z-' + s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

interface TocItem { id: string; label: string; sub?: boolean }

/** Índice fijo a la izquierda, como en los presupuestos */
function Toc({ items, activeId }: { items: TocItem[]; activeId: string }) {
  return (
    <nav className="w-56 shrink-0 sticky top-0 h-screen overflow-auto py-20 pl-10 pr-6 hidden xl:block">
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
              className={`block py-1 transition-all duration-150 ${it.sub ? 'pl-3 text-[11px]' : 'text-xs mt-2 first:mt-0'} ${activeId === it.id ? 'text-ink font-medium translate-x-1' : 'text-ink-40 hover:text-ink-60'}`}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
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
  const toc: TocItem[] = [{ id: 'a-top', label: audit.summary?.length ? t.summary : (audit.clientCompany || audit.title) }]
  if (groups.length) {
    toc.push({ id: 'a-changes', label: t.s1 })
    groups.forEach((g) => toc.push({ id: zid(g.section), label: g.section, sub: true }))
  }
  if (refs.length) toc.push({ id: 'a-refs', label: t.s2 })
  if (plans.length) toc.push({ id: 'a-plans', label: t.s3 })

  const [activeId, setActiveId] = useState('a-top')
  const obs = useRef<IntersectionObserver | null>(null)
  const tocKey = toc.map((x) => x.id).join('|')
  useEffect(() => {
    obs.current?.disconnect()
    const els = tocKey.split('|').map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    obs.current = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting)
      if (vis.length) setActiveId(vis.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b)).target.id)
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 })
    els.forEach((el) => obs.current!.observe(el))
    return () => obs.current?.disconnect()
  }, [tocKey])

  return (
    <div className="flex">
    <Toc items={toc} activeId={activeId} />
    <div className="flex-1 min-w-0">
    <article className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
      <header id="a-top" className="mb-20 sm:mb-24 scroll-mt-8">
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
        <section id="a-changes" className="mb-28 scroll-mt-8">
          <SectionHead title={t.s1} sub={t.s1sub} />
          <div className="space-y-20">
            {groups.map((g) => (
              <div key={g.section} id={zid(g.section)} className="scroll-mt-8">
                <h3 className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-6">{g.section}</h3>
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
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {f.refs.map((id) => {
                            const r = refs.find((x) => x.id === id)
                            return r ? <RefMini key={id} r={r} t={t} onOpen={() => openRef(id)} /> : null
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
        <section id="a-refs" className="mb-28 scroll-mt-8">
          <SectionHead title={t.s2} sub={t.s2sub} />
          <div className="grid sm:grid-cols-2 gap-4">
            {like.map((r) => <RefCard key={r.id} r={r} t={t} onOpen={() => openRef(r.id)} />)}
          </div>
          {avoid.length > 0 && (
            <div className="mt-12">
              <h3 className="text-sm font-medium text-ink">{t.avoid}</h3>
              <p className="mt-1 mb-4 text-sm text-ink-60">{t.avoidSub}</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {avoid.map((r) => <RefCard key={r.id} r={r} t={t} onOpen={() => openRef(r.id)} />)}
              </div>
            </div>
          )}
        </section>
      )}

      {plans.length > 0 && (
        <section id="a-plans" className="mb-24 scroll-mt-8">
          <SectionHead title={t.s3} sub={audit.plansIntro} />
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
                  <p className="mt-6 text-sm text-ink"><span className="font-medium">{fmt(p.price)}</span> <span className="text-ink-40">{t.vat}</span></p>
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
    </div>
    <div className="w-56 shrink-0 hidden 2xl:block" aria-hidden />
    </div>
  )
}
