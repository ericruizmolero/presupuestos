'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { getQuoteById, updateQuote } from '@/lib/firestore/quotes'
import { getCompany } from '@/lib/firestore/companies'
import { applySystemFont, injectFont } from '@/lib/fonts'
import { applyPalette, applyThemeColors, applyInkOpacities } from '@/lib/theme'
import type { Quote } from '@/types/quote'
import { GanttTimeline } from '@/components/quote/GanttTimeline'
import { FeatherIcon } from '@/components/ui/IconPicker'
import { ArrowLeft, Printer, Check, ChevronUp, ChevronDown } from 'lucide-react'

// ─── Shared rendering helpers ────────────────────────────────────────────────

function RichContent({ html }: { html: string }) {
  if (!html) return null
  return (
    <div
      className="prose-quote text-base leading-relaxed text-ink"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium tracking-[0.18em] uppercase mb-6 text-ink-40">
      {children}
    </p>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium tracking-[0.15em] uppercase mb-3 text-ink-40">
      {children}
    </p>
  )
}

// ─── Page break toggle zone ───────────────────────────────────────────────────

function PageBreakZone({
  sectionId,
  active,
  onToggle,
}: {
  sectionId: string
  active: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div
      className="no-print max-w-[794px] mx-auto flex items-center justify-center cursor-pointer group"
      style={{ height: active ? '48px' : '12px' }}
      onClick={() => onToggle(sectionId)}
    >
      {active ? (
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 border-t-2 border-dashed border-accent" />
          <span className="text-[10px] font-medium tracking-widest uppercase shrink-0 text-accent bg-white border border-accent px-3 py-1.5 rounded">
            ↵ Nueva página · clic para quitar
          </span>
          <div className="flex-1 border-t-2 border-dashed border-accent" />
        </div>
      ) : (
        <div className="flex items-center gap-3 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="flex-1 border-t border-dashed" style={{ borderColor: '#aaa' }} />
          <span className="text-[10px] tracking-widest uppercase shrink-0 px-3 py-1" style={{ color: '#888', background: '#d0d0d0' }}>
            + Salto de página
          </span>
          <div className="flex-1 border-t border-dashed" style={{ borderColor: '#aaa' }} />
        </div>
      )}
    </div>
  )
}

// ─── Export page ───────────────────────────────────────────────────────────────

export default function ExportPage() {
  return (
    <AuthGuard>
      <ExportContent />
    </AuthGuard>
  )
}

function ExportContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { company } = useAuth()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getQuoteById(id).then(async (q) => {
      if (!q) { router.replace('/dashboard'); return }
      if (!q.emitter.logoUrl && company?.logoUrl) q.emitter.logoUrl = company.logoUrl
      setQuote(q)
      setLoading(false)

      if (q.companyId) {
        const comp = await getCompany(q.companyId)
        if (comp) {
          if (comp.themeColors) applyThemeColors(comp.themeColors)
          else if (comp.paletteId) applyPalette(comp.paletteId)
          if (comp.inkOpacitySecondary != null || comp.inkOpacityTertiary != null)
            applyInkOpacities(comp.inkOpacitySecondary ?? 60, comp.inkOpacityTertiary ?? 40)
          if (comp.defaultFontName) {
            const f = comp.fonts.find((f) => f.name === comp.defaultFontName)
            if (f) injectFont(f)
            else applySystemFont(comp.defaultFontName)
          }
        }
      } else if (q.fontName) {
        applySystemFont(q.fontName)
      }
    })
  }, [id, router, company])

  // ── Print-to-PDF ─────────────────────────────────────────────────────────────
  // window.print() gives the browser's native PDF engine — vector text, perfect
  // fonts, zero quality loss. We set document.title to the desired filename so
  // the browser prefills it in the "Save as PDF" dialog.

  function handlePrint() {
    if (!quote) return
    const sanitize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

    const emitterName = sanitize(quote.emitter.companyName || 'empresa')
    const clientLabel = sanitize(quote.client.company || quote.client.name || 'cliente')
    const dateStr     = quote.date || new Date().toISOString().split('T')[0]
    const newTitle    = `${emitterName}_${clientLabel}_${dateStr}`

    const prev = document.title
    document.title = newTitle
    window.print()
    document.title = prev
  }

  // ── Page breaks ──────────────────────────────────────────────────────────────

  async function handleTogglePageBreak(sectionId: string) {
    if (!quote) return
    const current = new Set(quote.pageBreaksBefore ?? [])
    if (current.has(sectionId)) current.delete(sectionId)
    else current.add(sectionId)
    const newBreaks = [...current]
    setQuote((q) => q ? { ...q, pageBreaksBefore: newBreaks } : q)
    await updateQuote(id, { pageBreaksBefore: newBreaks })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Section reorder ───────────────────────────────────────────────────────────

  async function handleMoveSection(sectionId: string, direction: 'up' | 'down') {
    if (!quote) return
    // sectionOrder tracks the visible IDs in order; derive it from rendered secs below
    // We operate on the current rendered order (computed in render)
    const currentOrder = (quote.sectionOrder ?? []).length > 0
      ? quote.sectionOrder!
      : DEFAULT_SECTION_ORDER

    const idx = currentOrder.indexOf(sectionId)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= currentOrder.length) return

    const newOrder = [...currentOrder]
    ;[newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]]

    setQuote((q) => q ? { ...q, sectionOrder: newOrder } : q)
    await updateQuote(id, { sectionOrder: newOrder })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#d0d0d0]">
        <div className="w-4 h-4 border border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const breaks = new Set(quote.pageBreaksBefore ?? [])

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency', currency: quote.currency || 'EUR', maximumFractionDigits: 0,
    }).format(n)

  const formatDate = (d: string) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : ''

  const clientName     = quote.client.company || quote.client.name
  const phasesHaveDates = quote.timeline.some((e) => e.startDate && e.endDate)

  // ── Build section list ───────────────────────────────────────────────────────

  type SecDef = { id: string; label: string; node: React.ReactNode }
  const allSecs: SecDef[] = []

  allSecs.push({
    id: 'header', label: 'Portada',
    node: (
      <div style={{ minHeight: '72vh', paddingTop: '28vh' }}>
        <div className="space-y-3">
          <p className="text-sm text-ink">Presupuesto</p>
          {clientName && (
            <p className="text-[1.625rem] font-medium tracking-tight text-ink leading-snug">{clientName}</p>
          )}
          {quote.date && (
            <p className="text-sm text-ink">{formatDate(quote.date)}</p>
          )}
        </div>
      </div>
    ),
  })

  if (quote.emitter.companyName || quote.emitter.description) {
    allSecs.push({
      id: 'emitter', label: 'Empresa emisora',
      node: (
        <>
          <SectionLabel>{quote.emitter.companyName}</SectionLabel>
          {quote.emitter.description && <RichContent html={quote.emitter.description} />}
        </>
      ),
    })
  }

  allSecs.push({
    id: 'project', label: 'Proyecto',
    node: (
      <>
        <SectionLabel>Proyecto</SectionLabel>
        <div className="space-y-12">
          {quote.client.description && (
            <div>
              <SubLabel>Sobre {clientName || 'el cliente'}</SubLabel>
              <RichContent html={quote.client.description} />
            </div>
          )}
          {quote.project.mainObjective && (
            <div>
              <SubLabel>Objetivo principal</SubLabel>
              <RichContent html={quote.project.mainObjective} />
            </div>
          )}
          {quote.project.collaborationModel && (
            <div>
              <SubLabel>Modelo de colaboración</SubLabel>
              <RichContent html={quote.project.collaborationModel} />
            </div>
          )}
          {quote.project.scope && (
            <div>
              <SubLabel>Alcance</SubLabel>
              <RichContent html={quote.project.scope} />
            </div>
          )}
        </div>
      </>
    ),
  })

  if (quote.project.phases.length > 0) {
    allSecs.push({
      id: 'phases', label: 'Fases',
      node: (
        <>
          <SectionLabel>Fases del proyecto</SectionLabel>
          <div className="space-y-10">
            {quote.project.phases.map((phase, i) => (
              <div key={i}>
                <div className="flex items-center gap-4 mb-4">
                  {phase.icon ? (
                    <span
                      className="w-8 h-8 flex items-center justify-center rounded-md shrink-0"
                      style={{ background: 'var(--color-surface)', color: 'var(--color-accent)' }}
                    >
                      <FeatherIcon name={phase.icon} size={15} />
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium tracking-[0.15em] text-ink-40 w-8 text-center shrink-0">
                      0{i + 1}
                    </span>
                  )}
                  <h3 className="text-base font-medium text-ink leading-snug">{phase.name}</h3>
                </div>
                {phase.description && (
                  <div className="pl-12">
                    <RichContent html={phase.description} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ),
    })
  }

  if (phasesHaveDates) {
    allSecs.push({
      id: 'timeline', label: 'Timeline',
      node: (
        <>
          <SectionLabel>Timeline</SectionLabel>
          <GanttTimeline entries={quote.timeline.filter((e) => e.startDate && e.endDate)} />
        </>
      ),
    })
  }

  if (quote.budgetTable.items.length > 0) {
    allSecs.push({
      id: 'budget', label: 'Presupuesto',
      node: (
        <>
          <SectionLabel>Presupuesto</SectionLabel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-accent)' }}>
                <th className="text-left py-3 text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60">Concepto</th>
                <th className="text-left py-3 text-[10px] font-medium tracking-[0.15em] uppercase w-28 text-ink-60">Tiempo</th>
                <th className="text-right py-3 text-[10px] font-medium tracking-[0.15em] uppercase w-32 text-ink-60">Precio</th>
              </tr>
            </thead>
            <tbody>
              {quote.budgetTable.items.map((item, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-4 align-top text-ink">
                    <p className="font-medium">{item.concept}</p>
                    {item.notes && <p className="text-xs mt-1 font-normal leading-relaxed text-ink-40">{item.notes}</p>}
                  </td>
                  <td className="py-4 align-top text-ink-60">{item.time}</td>
                  <td className="py-4 text-right font-medium align-top tabular-nums text-ink">{fmt(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 space-y-2 text-sm">
            {quote.budgetTable.taxRate > 0 && (
              <>
                <div className="flex justify-between text-ink-60">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmt(quote.budgetTable.subtotal)}</span>
                </div>
                <div className="flex justify-between text-ink-60">
                  <span>IVA ({quote.budgetTable.taxRate}%)</span>
                  <span className="tabular-nums">{fmt(quote.budgetTable.total - quote.budgetTable.subtotal)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-medium text-base pt-4 border-t border-accent text-ink">
              <span>
                Total{' '}
                {quote.budgetTable.taxRate === 0 && (
                  <span className="font-normal text-sm text-ink-40">(IVA no incluido)</span>
                )}
              </span>
              <span className="tabular-nums">{fmt(quote.budgetTable.total)}</span>
            </div>
          </div>
        </>
      ),
    })
  }

  if (quote.budgetTableAdditional.enabled && quote.budgetTableAdditional.items.length > 0) {
    allSecs.push({
      id: 'budget-additional', label: 'Tabla adicional',
      node: (
        <>
          <SectionLabel>{quote.budgetTableAdditional.label || 'Servicios adicionales'}</SectionLabel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-accent)' }}>
                <th className="text-left py-3 text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60">Concepto</th>
                <th className="text-right py-3 text-[10px] font-medium tracking-[0.15em] uppercase w-40 text-ink-60">Precio unitario (IVA no inc.)</th>
              </tr>
            </thead>
            <tbody>
              {quote.budgetTableAdditional.items.map((item, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-4 text-ink">{item.concept}</td>
                  <td className="py-4 text-right font-medium tabular-nums text-ink">{fmt(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    })
  }

  if (Object.values(quote.acceptanceConditions).some(Boolean)) {
    allSecs.push({
      id: 'conditions', label: 'Condiciones',
      node: (
        <>
          <SectionLabel>Aceptación y facturación</SectionLabel>
          <div className="space-y-10">
            {(
              [
                ['paymentTerms',           'Forma de pago'],
                ['acceptanceCriteria',     'Criterios de aceptación'],
                ['clientResponsibilities', 'Responsabilidades del cliente'],
                ['penaltyClause',          'Cláusula de penalización'],
                ['annexes',               'Archivos / Información anexa'],
                ['dataProtection',        'Aceptación del tratamiento de datos personales'],
              ] as [keyof Quote['acceptanceConditions'], string][]
            ).map(([key, label]) =>
              quote.acceptanceConditions[key] ? (
                <div key={key}>
                  <SubLabel>{label}</SubLabel>
                  <RichContent html={quote.acceptanceConditions[key]} />
                </div>
              ) : null
            )}
          </div>
        </>
      ),
    })
  }

  if (quote.billingConditions) {
    allSecs.push({
      id: 'billing', label: 'Facturación',
      node: (
        <>
          <SectionLabel>Facturación</SectionLabel>
          <RichContent html={quote.billingConditions} />
        </>
      ),
    })
  }

  allSecs.push({
    id: 'conformity', label: 'Conformidad',
    node: (
      <>
        <SectionLabel>Conformidad</SectionLabel>
        <p className="text-sm text-ink-60 mb-16 leading-relaxed">
          La firma del presente documento se interpreta como la conformidad y la aceptación de todas las condiciones expuestas en él y el cumplimiento de las mismas.
        </p>
        <div className="grid grid-cols-2 gap-16">
          {[
            { label: 'Cliente',   data: quote.conformity.clientData  },
            { label: 'Proveedor', data: quote.conformity.emitterData },
          ].map(({ label, data }) => (
            <div key={label}>
              <SubLabel>{label}</SubLabel>
              {data && <div className="mb-8 text-sm"><RichContent html={data} /></div>}
              <div className="mt-16 border-t border-input pt-3">
                <p className="text-xs text-ink-40">Firma y fecha</p>
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  })

  // ── Apply custom order ───────────────────────────────────────────────────────
  // sectionOrder stores visible IDs in user's preferred sequence.
  // Sections absent from the stored order fall to the end (handles new sections).

  const storedOrder = quote.sectionOrder ?? []
  const secs = storedOrder.length > 0
    ? [...allSecs].sort((a, b) => {
        const ia = storedOrder.indexOf(a.id)
        const ib = storedOrder.indexOf(b.id)
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      })
    : allSecs

  // ── Group into pages ─────────────────────────────────────────────────────────

  const pages: SecDef[][] = [[]]
  for (const s of secs) {
    if (breaks.has(s.id) && pages[pages.length - 1].length > 0) pages.push([])
    pages[pages.length - 1].push(s)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div id="pdf-root" className="min-h-screen bg-[#d0d0d0] print:bg-white">

      {/* Print styles */}
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          #doc-wrapper { padding: 0 !important; }
          #pdf-root { background: white !important; min-height: 0 !important; }
          .a4-page { break-after: page; width: 100% !important; min-height: 0 !important; }
          .a4-page:last-of-type { break-after: auto; }
        }
      `}</style>

      {/* ── Top bar (no-print) ── */}
      <header className="no-print fixed top-0 left-0 right-0 z-20 h-14 bg-paper border-b border-line flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={`/dashboard/${id}`}
            className="flex items-center gap-2 text-sm text-ink-60 hover:text-ink transition-colors shrink-0"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Volver
          </Link>
          <span className="text-ink-40 shrink-0">·</span>
          <span className="text-sm text-ink truncate">
            {quote.quoteNumber || 'Presupuesto'}{clientName ? ` — ${clientName}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <p className="text-xs text-ink-40 hidden lg:block">
            Arrastra secciones · añade saltos de página
          </p>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-ink-60">
              <Check size={12} strokeWidth={2} /> Guardado
            </span>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-on-accent hover:bg-accent-hover transition-all hover:-translate-y-px"
          >
            <Printer size={14} strokeWidth={1.5} />
            Exportar PDF
          </button>
        </div>
      </header>

      {/* ── Pages ── */}
      <div id="doc-wrapper" className="pt-[72px] print:pt-0 pb-16 print:pb-0">
        {pages.map((pageSections, pageIdx) => (
          <div key={pageIdx}>

            {/* Inter-page active break strip */}
            {pageIdx > 0 && (
              <div className="no-print py-3">
                <PageBreakZone
                  sectionId={pageSections[0].id}
                  active={true}
                  onToggle={handleTogglePageBreak}
                />
              </div>
            )}

            {/* A4 sheet — 794 × 1123 px ≈ 210 × 297 mm at 96 dpi */}
            <div
              className="a4-page mx-auto bg-white"
              style={{ width: '794px', minHeight: '1123px' }}
            >
              {pageSections.map((sec, secIdx) => {
                // Position in the full flat secs list (for disable logic)
                const flatIdx = secs.indexOf(sec)
                const isFirst = flatIdx === 0
                const isLast  = flatIdx === secs.length - 1

                return (
                  <div key={sec.id} className="group/sec relative">

                    {/* Within-page inactive break zone (hover → add) */}
                    {secIdx > 0 && (
                      <div className="no-print">
                        <PageBreakZone
                          sectionId={sec.id}
                          active={false}
                          onToggle={handleTogglePageBreak}
                        />
                      </div>
                    )}

                    {/* Move controls — appear on section hover, hidden on print */}
                    <div className="no-print absolute top-4 right-4 z-10 flex items-center gap-0.5 opacity-0 group-hover/sec:opacity-100 transition-opacity">
                      <button
                        title="Subir sección"
                        disabled={isFirst}
                        onClick={() => handleMoveSection(sec.id, 'up')}
                        className="w-7 h-7 flex items-center justify-center rounded text-ink-40 hover:text-ink hover:bg-surface transition-colors disabled:opacity-20 disabled:cursor-default"
                      >
                        <ChevronUp size={14} strokeWidth={2} />
                      </button>
                      <button
                        title="Bajar sección"
                        disabled={isLast}
                        onClick={() => handleMoveSection(sec.id, 'down')}
                        className="w-7 h-7 flex items-center justify-center rounded text-ink-40 hover:text-ink hover:bg-surface transition-colors disabled:opacity-20 disabled:cursor-default"
                      >
                        <ChevronDown size={14} strokeWidth={2} />
                      </button>
                      {/* Section label pill */}
                      <span className="ml-1 text-[9px] tracking-widest uppercase text-ink-40 px-2 py-0.5 bg-surface rounded">
                        {sec.label}
                      </span>
                    </div>

                    {/* Content */}
                    <div id={sec.id} className="px-16 py-16">
                      {sec.node}
                    </div>

                  </div>
                )
              })}

              {/* Footer — last page only */}
              {pageIdx === pages.length - 1 && (
                <div className="px-16 pb-16">
                  <footer className="pt-6 border-t border-line flex items-center justify-end text-xs text-ink-40">
                    <span>{quote.emitter.companyName}</span>
                  </footer>
                </div>
              )}
            </div>

          </div>
        ))}
      </div>

    </div>
  )
}

// Default section order (matches the hardcoded build order above)
const DEFAULT_SECTION_ORDER = [
  'header', 'emitter', 'project', 'phases', 'timeline',
  'budget', 'budget-additional', 'conditions', 'billing', 'conformity',
]
