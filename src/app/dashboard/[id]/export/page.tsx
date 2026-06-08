'use client'

import { useEffect, useRef, useState } from 'react'
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
import { ArrowLeft, FileDown, Check } from 'lucide-react'

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

// ─── Spacing handle ───────────────────────────────────────────────────────────

function SpacingHandle({
  value,
  onChange,
}: {
  value: number
  onChange: (delta: number) => void
}) {
  return (
    <div
      className="no-print group/sp flex items-center justify-center cursor-ns-resize transition-[height]"
      style={{ height: Math.max(8, value) + 'px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="opacity-0 group-hover/sp:opacity-100 flex items-center gap-2 transition-opacity select-none">
        <button
          onClick={() => onChange(-16)}
          className="w-5 h-5 rounded text-ink-40 hover:text-ink hover:bg-surface text-sm leading-none flex items-center justify-center"
        >
          −
        </button>
        {value > 0 && (
          <span className="text-[9px] text-ink-40 tabular-nums">{value}px</span>
        )}
        <button
          onClick={() => onChange(+16)}
          className="w-5 h-5 rounded text-ink-40 hover:text-ink hover:bg-surface text-sm leading-none flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
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

  // ── PDF export (window.print — same as /p/[id]) ─────────────────────────

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

  // ── HTML overrides (saltos de línea y edición libre en vista previa) ─────────

  // Refs to content divs so we can set innerHTML imperatively (uncontrolled)
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Cuando el quote termina de cargar: restaurar overrides y pre-centrar primeras 2 secciones
  const centeredApplied = useRef(false)
  useEffect(() => {
    if (loading || !quote || centeredApplied.current) return
    centeredApplied.current = true

    const overrides = quote.sectionHtmlOverrides ?? {}
    const CENTERED = new Set(['header', 'emitter'])
    // Secciones con datos estructurados: nunca aplicar override (siempre renderizar desde JSX)
    const DATA_DRIVEN = new Set(['budget', 'budget-additional', 'conformity'])
    const EMPTY_LINES = Array.from({ length: 18 }, () => '<p><br></p>').join('')

    // Restaurar overrides guardados para secciones NO centradas y NO data-driven
    for (const [secId, html] of Object.entries(overrides)) {
      if (CENTERED.has(secId) || DATA_DRIVEN.has(secId)) continue
      const el = contentRefs.current[secId]
      if (el) el.innerHTML = html
    }

    // Secciones centradas: restaurar override SI ya tiene líneas vacías iniciales,
    // de lo contrario añadir EMPTY_LINES (maneja overrides guardados antes de este feature)
    for (const secId of CENTERED) {
      const el = contentRefs.current[secId]
      if (!el) continue
      const savedHtml = overrides[secId]
      if (savedHtml) {
        // /<p[^>]*>\s*<br/ detecta primer <p> con <br> inmediato (= ya centrado)
        const alreadyCentered = /<p[^>]*>\s*<br/.test(savedHtml.slice(0, 300))
        el.innerHTML = alreadyCentered ? savedHtml : EMPTY_LINES + savedHtml
      } else {
        el.innerHTML = EMPTY_LINES + el.innerHTML
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]) // se dispara cuando loading pasa a false (quote ya cargado y DOM renderizado)

  async function handleSaveHtmlOverride(sectionId: string, html: string) {
    if (!quote) return
    // No guardar overrides para secciones con datos estructurados (siempre desde JSX)
    if (['budget', 'budget-additional', 'conformity'].includes(sectionId)) return
    const current = quote.sectionHtmlOverrides ?? {}
    const newOverrides = { ...current, [sectionId]: html }
    setQuote((q) => q ? { ...q, sectionHtmlOverrides: newOverrides } : q)
    await updateQuote(id, { sectionHtmlOverrides: newOverrides })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Section spacing ──────────────────────────────────────────────────────────

  async function handleUpdateSpacing(sectionId: string, edge: 'top' | 'bottom', delta: number) {
    if (!quote) return
    const current = quote.sectionSpacing ?? {}
    const prev = current[sectionId] ?? { top: 0, bottom: 0 }
    const next = { ...prev, [edge]: Math.max(0, Math.min(320, prev[edge] + delta)) }
    const newSpacing = { ...current, [sectionId]: next }
    setQuote((q) => q ? { ...q, sectionSpacing: newSpacing } : q)
    await updateQuote(id, { sectionSpacing: newSpacing })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Merge / split pages ───────────────────────────────────────────────────────

  async function handleToggleMerge(sectionId: string) {
    if (!quote) return
    const current = new Set(quote.sectionsMerged ?? [])
    if (current.has(sectionId)) current.delete(sectionId)
    else current.add(sectionId)
    const newMerged = [...current]
    setQuote((q) => q ? { ...q, sectionsMerged: newMerged } : q)
    await updateQuote(id, { sectionsMerged: newMerged })
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

  type SecDef = { id: string; label: string; node: React.ReactNode; landscape?: boolean }
  const allSecs: SecDef[] = []

  allSecs.push({
    id: 'header', label: 'Portada',
    node: (
      <div className="space-y-3">
        <p className="text-sm text-ink">Presupuesto</p>
        {clientName && (
          <p className="text-[1.625rem] font-medium tracking-tight text-ink leading-snug">{clientName}</p>
        )}
        {quote.date && (
          <p className="text-sm text-ink">{formatDate(quote.date)}</p>
        )}
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
      landscape: true,
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

          {/* Column headers */}
          <div className="flex items-center gap-6 pb-3 border-b border-line mb-0">
            <span className="w-6 shrink-0" />
            <span className="flex-1 text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60">Concepto</span>
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60 text-right w-28 shrink-0">Precio</span>
          </div>

          {/* Items */}
          <div>
            {quote.budgetTable.items.map((item, i) => (
              <div key={i} className="flex items-start gap-6 py-5 border-b border-line">
                <span className="text-[8px] font-light text-ink-20 w-6 shrink-0 mt-[3px] tabular-nums select-none tracking-wide">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink leading-snug">{item.concept}</p>
                  {item.time && (
                    <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-ink-40 mt-1">{item.time}</p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-ink-40 mt-2 leading-relaxed">{item.notes}</p>
                  )}
                </div>
                <span className="text-sm font-medium text-ink tabular-nums shrink-0 mt-[3px] w-28 text-right">
                  {fmt(item.price)}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-baseline gap-6 pt-5">
            <span className="w-6 shrink-0" />
            <span className="flex-1 text-sm font-medium text-ink">
              {quote.budgetTable.totalLabel || 'Total'}
              {quote.budgetTable.taxRate > 0 && (
                <span className="font-normal text-ink-40 ml-1">(IVA no incluido)</span>
              )}
            </span>
            <span className="text-sm font-medium text-ink tabular-nums w-28 text-right shrink-0">
              {fmt(quote.budgetTable.subtotal)}
            </span>
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

          {/* Column headers */}
          <div className="flex items-center gap-6 pb-3 border-b border-line mb-0">
            <span className="w-6 shrink-0" />
            <span className="flex-1 text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60">Concepto</span>
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60 text-right w-28 shrink-0">Precio</span>
          </div>

          {/* Items */}
          <div>
            {quote.budgetTableAdditional.items.map((item, i) => (
              <div key={i} className="flex items-start gap-6 py-5 border-b border-line">
                <span className="text-[8px] font-light text-ink-20 w-6 shrink-0 mt-[3px] tabular-nums select-none tracking-wide">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink leading-snug">{item.concept}</p>
                  {item.notes && (
                    <p className="text-xs text-ink-40 mt-2 leading-relaxed">{item.notes}</p>
                  )}
                </div>
                <span className="text-sm font-medium text-ink tabular-nums shrink-0 mt-[3px] w-28 text-right">
                  {item.price > 0 ? fmt(item.price) : '—'}
                </span>
              </div>
            ))}
          </div>
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
          {([
            { label: 'Cliente', fields: [
              { label: 'Empresa',          value: quote.client.company },
              { label: 'CIF',              value: quote.client.taxId },
              { label: 'Dirección',        value: quote.client.address },
              { label: 'Ciudad',           value: quote.client.city },
              { label: 'Representada por', value: quote.client.name },
              { label: 'Cargo',            value: quote.client.role },
            ]},
            { label: 'Proveedor', fields: [
              { label: 'Empresa',          value: quote.emitter.companyName },
              { label: 'CIF',              value: quote.emitter.taxId },
              { label: 'Dirección',        value: quote.emitter.address },
              { label: 'Ciudad',           value: quote.emitter.city },
              { label: 'Representada por', value: quote.emitter.representativeName },
              { label: 'Cargo',            value: quote.emitter.representativeRole },
            ]},
          ] as const).map(({ label, fields }) => (
            <div key={label}>
              <SubLabel>{label}</SubLabel>
              <div className="space-y-2 mb-16">
                {fields.filter(f => f.value).map(({ label: fl, value }) => (
                  <div key={fl} className="flex gap-3 text-sm">
                    <span className="text-ink-40 w-32 shrink-0">{fl}:</span>
                    <span className="text-ink">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 border-t border-input pt-3">
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

  // Cada sección = su propia página A4
  const pages: SecDef[][] = secs.map((s) => [s])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div id="pdf-root" className="min-h-screen bg-[#d0d0d0] print:bg-white">

      {/* Print styles */}
      <style>{`
        /* Named page rules for mixed portrait/landscape in a single print job */
        @page           { size: A4 portrait;  margin: 20mm 20mm; }
        @page landscape { size: A4 landscape; margin: 15mm 20mm; }

        @media print {
          /* Hide all preview chrome */
          .no-print { display: none !important; }

          /* Remove preview zoom + grid layout; let @page rules handle sizing */
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          #pdf-root { background: white !important; min-height: 0 !important; padding: 0 !important; }
          #doc-wrapper-inner {
            display: block !important;
            zoom: 1 !important;
            padding: 0 !important;
            gap: 0 !important;
            width: 100% !important;
          }

          /* Each A4 div becomes exactly one printed page */
          .a4-page {
            page: auto;
            break-after: page;
            width: 100% !important;
            min-height: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
          }
          .a4-page-landscape {
            page: landscape;
            break-after: page;
            width: 100% !important;
            min-height: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
          }

          /* No trailing page break on the very last page */
          .a4-page:last-of-type,
          .a4-page-landscape:last-of-type { break-after: auto; }

          /* Clean up editable chrome */
          [contenteditable] { outline: none !important; }
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
            onClick={() => window.print()}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-on-accent hover:bg-accent-hover transition-all hover:-translate-y-px"
          >
            <FileDown size={14} strokeWidth={1.5} />
            Exportar PDF
          </button>
        </div>
      </header>

      {/* ── Pages ── */}
      {/* Header-offset spacer (outside zoom so respects fixed header height) */}
      <div className="no-print h-[72px]" />

      <div id="doc-wrapper-inner" style={{
        zoom: 0.65,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 794px)',
        gap: '48px',
        justifyContent: 'center',
        padding: '32px 20px 64px',
      }}>
        {pages.map((pageSections, pageIdx) => {
          const isLandscape = pageSections.some((s) => s.landscape)
          // A4 portrait: 794×1123 px | A4 landscape: 1123×794 px (at 96 dpi)
          const pageW = isLandscape ? 1123 : 794
          const pageH = isLandscape ? 794  : 1123

          return (
          <div
            key={pageIdx}
            className={isLandscape ? 'a4-page-landscape bg-white' : 'a4-page bg-white'}
            style={{
              width: `${pageW}px`,
              minHeight: `${pageH}px`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              // Landscape pages span both grid columns and self-center
              ...(isLandscape ? { gridColumn: '1 / -1', justifySelf: 'center' } : {}),
            }}
          >
              {pageSections.map((sec) => {
                const spacingTop    = (quote.sectionSpacing ?? {})[sec.id]?.top    ?? 0
                const spacingBottom = (quote.sectionSpacing ?? {})[sec.id]?.bottom ?? 0
                // Landscape pages use less vertical padding to maximise gantt height
                const padV = isLandscape ? 40 : 64

                return (
                  <div key={sec.id}>

                    {/* Spacing top handle */}
                    <SpacingHandle
                      value={spacingTop}
                      onChange={(d) => handleUpdateSpacing(sec.id, 'top', d)}
                    />

                    {/* Content — editable, padding dinámico */}
                    <div
                      ref={(el) => { contentRefs.current[sec.id] = el }}
                      id={sec.id}
                      contentEditable
                      suppressContentEditableWarning
                      className="px-16 outline-none focus:outline-none"
                      style={{
                        paddingTop:    `${padV + spacingTop}px`,
                        paddingBottom: `${padV + spacingBottom}px`,
                        cursor: 'text',
                        caretColor: 'var(--color-ink)',
                      }}
                      onBlur={(e) => handleSaveHtmlOverride(sec.id, e.currentTarget.innerHTML)}
                    >
                      {sec.node}
                    </div>

                    {/* Spacing bottom handle */}
                    <SpacingHandle
                      value={spacingBottom}
                      onChange={(d) => handleUpdateSpacing(sec.id, 'bottom', d)}
                    />

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
          )
        })}
      </div>


    </div>
  )
}

// Default section order (matches the hardcoded build order above)
const DEFAULT_SECTION_ORDER = [
  'header', 'emitter', 'project', 'phases', 'timeline',
  'budget', 'budget-additional', 'conditions', 'billing', 'conformity',
]
