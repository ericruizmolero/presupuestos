'use client'

import { useEffect, useRef, useState } from 'react'
import type { Quote } from '@/types/quote'
import { GanttTimeline } from './GanttTimeline'
import { FeatherIcon } from '@/components/ui/IconPicker'

interface Props {
  quote: Quote
  pageBreaksBefore?: string[]
  onTogglePageBreak?: (sectionId: string) => void
}

function PageBreakControl({ sectionId, active, onToggle }: { sectionId: string; active: boolean; onToggle: (id: string) => void }) {
  return (
    <div className="no-print flex items-center gap-3 my-1 group cursor-pointer" onClick={() => onToggle(sectionId)}>
      <div className={`flex-1 border-t border-dashed transition-colors ${active ? 'border-accent' : 'border-line group-hover:border-input'}`} />
      <span className={`text-[10px] font-medium tracking-widest uppercase shrink-0 transition-colors ${active ? 'text-accent' : 'text-ink-40 group-hover:text-ink-60'}`}>
        {active ? '↵ Nueva página' : '+ Salto de página'}
      </span>
      <div className={`flex-1 border-t border-dashed transition-colors ${active ? 'border-accent' : 'border-line group-hover:border-input'}`} />
    </div>
  )
}

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

function Divider() {
  return <hr className="border-t my-20 border-line" />
}

interface TocItem { id: string; label: string }

const phasesHaveDates = (quote: Quote) =>
  quote.timeline.some((e) => e.startDate && e.endDate)

function buildToc(quote: Quote): TocItem[] {
  const items: TocItem[] = [{ id: 'header', label: 'Cabecera' }]
  if (quote.emitter.description || quote.emitter.companyName) items.push({ id: 'emitter', label: quote.emitter.companyName || 'Emisora' })
  items.push({ id: 'project', label: 'Proyecto' })
  if (quote.project.phases.length > 0) items.push({ id: 'phases', label: 'Fases' })
  if (phasesHaveDates(quote)) items.push({ id: 'timeline', label: 'Tareas y tiempos' })
  if (quote.budgetTable.items.length > 0) items.push({ id: 'budget', label: 'Presupuesto' })
  if (quote.budgetTableAdditional.enabled && quote.budgetTableAdditional.items.length > 0)
    items.push({ id: 'budget-additional', label: quote.budgetTableAdditional.label || 'Adicional' })
  if (Object.values(quote.acceptanceConditions).some(Boolean)) items.push({ id: 'conditions', label: 'Condiciones' })
  if (quote.billingConditions) items.push({ id: 'billing', label: 'Facturación' })
  items.push({ id: 'conformity', label: 'Conformidad' })
  return items
}

function TableOfContents({ items, activeId }: { items: TocItem[]; activeId: string }) {
  return (
    <nav className="no-print w-52 shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-auto py-16 pl-10 pr-6 hidden xl:block">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`block text-xs py-1 transition-all duration-150 ${
                activeId === item.id
                  ? 'text-ink font-medium translate-x-1'
                  : 'text-ink-40 hover:text-ink-60'
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function QuotePreview({ quote, pageBreaksBefore = [], onTogglePageBreak }: Props) {
  const breaks = new Set(pageBreaksBefore)
  const pageBreakStyle = (id: string): React.CSSProperties =>
    breaks.has(id) ? { breakBefore: 'page' } : {}
  const [activeId, setActiveId] = useState('header')
  const tocItems = buildToc(quote)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current?.disconnect()
    const sections = tocItems.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[]
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          )
          setActiveId(topmost.target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    )
    sections.forEach((s) => observerRef.current!.observe(s))
    return () => observerRef.current?.disconnect()
  }, [quote])

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency', currency: quote.currency || 'EUR', maximumFractionDigits: 0,
    }).format(n)

  const formatDate = (d: string) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : ''

  const clientName = quote.client.company || quote.client.name

  return (
    <div className="flex flex-1 min-w-0">
      <TableOfContents items={tocItems} activeId={activeId} />

      <article className="flex-1 max-w-2xl mx-auto px-8 py-20 print:py-0 print:max-w-none print:mx-0">

        {/* ── 1. Header — cover page ── */}
        <section id="header" className="mb-20" style={{ minHeight: '72vh', paddingTop: '28vh' }}>
          <div className="space-y-3">
            <p className="text-sm text-ink">Presupuesto</p>
            {clientName && (
              <p className="text-[1.625rem] font-medium tracking-tight text-ink leading-snug">{clientName}</p>
            )}
            {quote.date && (
              <p className="text-sm text-ink">{formatDate(quote.date)}</p>
            )}
          </div>
        </section>

        {onTogglePageBreak && <PageBreakControl sectionId="emitter" active={breaks.has('emitter')} onToggle={onTogglePageBreak} />}
        <Divider />

        {/* ── 2. Empresa emisora ── */}
        {(quote.emitter.companyName || quote.emitter.description) && (
          <>
            <section id="emitter" className="mb-20" style={pageBreakStyle('emitter')}>
              <SectionLabel>{quote.emitter.companyName}</SectionLabel>
              {quote.emitter.description && <RichContent html={quote.emitter.description} />}
            </section>
            {onTogglePageBreak && <PageBreakControl sectionId="project" active={breaks.has('project')} onToggle={onTogglePageBreak} />}
            <Divider />
          </>
        )}

        {/* ── 3. Proyecto ── */}
        <section id="project" className="mb-20" style={pageBreakStyle('project')}>
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
        </section>

        {/* ── 4. Fases ── */}
        {quote.project.phases.length > 0 && (
          <>
            {onTogglePageBreak && <PageBreakControl sectionId="phases" active={breaks.has('phases')} onToggle={onTogglePageBreak} />}
            <Divider />
            <section id="phases" className="mb-20" style={pageBreakStyle('phases')}>
              <SectionLabel>Fases del proyecto</SectionLabel>
              <div className="space-y-10">
                {quote.project.phases.map((phase, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-4 mb-4">
                      {phase.icon ? (
                        <span className="w-8 h-8 flex items-center justify-center rounded-md shrink-0" style={{ background: 'var(--color-surface)', color: 'var(--color-accent)' }}>
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
            </section>
          </>
        )}

        {/* ── 5. Timeline Gantt ── */}
        {phasesHaveDates(quote) && (
          <>
            {onTogglePageBreak && <PageBreakControl sectionId="timeline" active={breaks.has('timeline')} onToggle={onTogglePageBreak} />}
            <Divider />
            <section id="timeline" className="mb-20" style={pageBreakStyle('timeline')}>
              <SectionLabel>Timeline</SectionLabel>
              <GanttTimeline entries={quote.timeline.filter((e) => e.startDate && e.endDate)} />
            </section>
          </>
        )}

        {onTogglePageBreak && <PageBreakControl sectionId="budget" active={breaks.has('budget')} onToggle={onTogglePageBreak} />}
        <Divider />

        {/* ── 6. Presupuesto ── */}
        {quote.budgetTable.items.length > 0 && (
          <section id="budget" className="mb-20" style={pageBreakStyle('budget')}>
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
                    <span>Subtotal</span><span className="tabular-nums">{fmt(quote.budgetTable.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-ink-60">
                    <span>IVA ({quote.budgetTable.taxRate}%)</span>
                    <span className="tabular-nums">{fmt(quote.budgetTable.total - quote.budgetTable.subtotal)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-medium text-base pt-4 border-t border-accent text-ink">
                <span>Total {quote.budgetTable.taxRate === 0 && <span className="font-normal text-sm text-ink-40">(IVA no incluido)</span>}</span>
                <span className="tabular-nums">{fmt(quote.budgetTable.total)}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── 7. Tabla adicional ── */}
        {quote.budgetTableAdditional.enabled && quote.budgetTableAdditional.items.length > 0 && (
          <>
            {onTogglePageBreak && <PageBreakControl sectionId="budget-additional" active={breaks.has('budget-additional')} onToggle={onTogglePageBreak} />}
            <Divider />
            <section id="budget-additional" className="mb-20" style={pageBreakStyle('budget-additional')}>
              <SectionLabel>{quote.budgetTableAdditional.label || 'Servicios adicionales'}</SectionLabel>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-accent">
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
            </section>
          </>
        )}

        {onTogglePageBreak && <PageBreakControl sectionId="conditions" active={breaks.has('conditions')} onToggle={onTogglePageBreak} />}
        <Divider />

        {/* ── 8. Condiciones de aceptación ── */}
        {Object.values(quote.acceptanceConditions).some(Boolean) && (
          <section id="conditions" className="mb-20" style={pageBreakStyle('conditions')}>
            <SectionLabel>Aceptación y facturación</SectionLabel>
            <div className="space-y-10">
              {([
                ['paymentTerms', 'Forma de pago'],
                ['acceptanceCriteria', 'Criterios de aceptación'],
                ['clientResponsibilities', 'Responsabilidades del cliente'],
                ['penaltyClause', 'Cláusula de penalización'],
                ['annexes', 'Archivos / Información anexa'],
                ['dataProtection', 'Aceptación del tratamiento de datos personales'],
              ] as [keyof Quote['acceptanceConditions'], string][]).map(([key, label]) =>
                quote.acceptanceConditions[key] ? (
                  <div key={key}>
                    <SubLabel>{label}</SubLabel>
                    <RichContent html={quote.acceptanceConditions[key]} />
                  </div>
                ) : null
              )}
            </div>
          </section>
        )}

        {/* ── 9. Facturación ── */}
        {quote.billingConditions && (
          <>
            {onTogglePageBreak && <PageBreakControl sectionId="billing" active={breaks.has('billing')} onToggle={onTogglePageBreak} />}
            <Divider />
            <section id="billing" className="mb-20" style={pageBreakStyle('billing')}>
              <SectionLabel>Facturación</SectionLabel>
              <RichContent html={quote.billingConditions} />
            </section>
          </>
        )}

        {onTogglePageBreak && <PageBreakControl sectionId="conformity" active={breaks.has('conformity')} onToggle={onTogglePageBreak} />}
        <Divider />

        {/* ── 10. Conformidad ── */}
        <section id="conformity" className="mb-20" style={pageBreakStyle('conformity')}>
          <SectionLabel>Conformidad</SectionLabel>
          <p className="text-sm text-ink-60 mb-16 leading-relaxed">
            La firma del presente documento se interpreta como la conformidad y la aceptación de todas las condiciones expuestas en él y el cumplimiento de las mismas.
          </p>

          <div className="grid grid-cols-2 gap-16">
            {[
              { label: 'Cliente', data: quote.conformity.clientData },
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
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-line flex items-center justify-end text-xs text-ink-40">
          <span>{quote.emitter.companyName}</span>
        </footer>

      </article>
    </div>
  )
}
