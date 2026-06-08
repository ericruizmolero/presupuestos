'use client'

import { useEffect, useRef, useState } from 'react'
import type { Quote } from '@/types/quote'
import { t } from '@/lib/quoteI18n'
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
  return <hr className="print-divider border-t my-20 border-line" />
}

interface TocItem { id: string; label: string }

const phasesHaveDates = (quote: Quote) =>
  quote.timeline.some((e) => e.startDate && e.endDate)

function buildToc(quote: Quote): TocItem[] {
  const l = t(quote.language)
  const items: TocItem[] = [{ id: 'header', label: l.quoteWord }]
  if (quote.emitter.description || quote.emitter.companyName) items.push({ id: 'emitter', label: quote.emitter.companyName || 'Emisora' })
  items.push({ id: 'project', label: l.project })
  if (quote.project.phases.length > 0) items.push({ id: 'phases', label: l.phases })
  if (phasesHaveDates(quote)) items.push({ id: 'timeline', label: l.timeline })
  if (quote.budgetTable.items.length > 0) items.push({ id: 'budget', label: l.budget })
  if (quote.budgetTableAdditional.enabled && quote.budgetTableAdditional.items.length > 0)
    items.push({ id: 'budget-additional', label: quote.budgetTableAdditional.label || l.budget })
  if (Object.values(quote.acceptanceConditions).some(Boolean)) items.push({ id: 'conditions', label: l.acceptanceAndBilling })
  if (quote.billingMilestones?.length || quote.billingConditions) items.push({ id: 'billing', label: l.billing })
  items.push({ id: 'conformity', label: l.conformity })
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

  const locale = quote.language === 'en' ? 'en-US' : 'es-ES'

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency', currency: quote.currency || 'EUR', maximumFractionDigits: 0,
    }).format(n)

  const formatDate = (d: string) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }) : ''

  const clientName = quote.client.company || quote.client.name
  const l = t(quote.language)

  return (
    <div className="flex flex-1 min-w-0">
      <TableOfContents items={tocItems} activeId={activeId} />

      <article className="print-article flex-1 min-w-0 max-w-4xl mx-auto px-4 sm:px-8 py-12 sm:py-20 print:py-0 print:px-0 print:max-w-none print:mx-0">

        {/* ── 1. Header — cover page ── */}
        <section id="header" className="mb-12 sm:mb-20" style={{ minHeight: '70vh', paddingTop: '22vh' }}>
          <div className="space-y-3">
            <p className="text-sm text-ink">{l.quoteWord}</p>
            {clientName && (
              <p className="text-[1.625rem] font-medium tracking-tight text-ink leading-snug">{clientName}</p>
            )}
            {quote.date && (
              <p className="text-sm text-ink">{formatDate(quote.date)}</p>
            )}
          </div>
        </section>

        {onTogglePageBreak && <PageBreakControl sectionId="emitter" active={breaks.has('emitter')} onToggle={onTogglePageBreak} />}

        {/* ── 2. Empresa emisora ── */}
        {(quote.emitter.companyName || quote.emitter.description) && (
          <>
            <section id="emitter" className="mb-12 sm:mb-20" style={pageBreakStyle('emitter')}>
              <SectionLabel>{quote.emitter.companyName}</SectionLabel>
              {quote.emitter.description && <RichContent html={quote.emitter.description} />}
            </section>
            {onTogglePageBreak && <PageBreakControl sectionId="project" active={breaks.has('project')} onToggle={onTogglePageBreak} />}
          </>
        )}

        {/* ── 3. Proyecto ── */}
        <section id="project" className="mb-12 sm:mb-20" style={pageBreakStyle('project')}>
          <SectionLabel>{l.project}</SectionLabel>
          <div className="space-y-12">
            {quote.client.description && (
              <div>
                <SubLabel>{l.aboutClient(clientName)}</SubLabel>
                <RichContent html={quote.client.description} />
              </div>
            )}
            {quote.project.mainObjective && (
              <div>
                <SubLabel>{l.mainObjective}</SubLabel>
                <RichContent html={quote.project.mainObjective} />
              </div>
            )}
            {quote.project.collaborationModel && (
              <div>
                <SubLabel>{l.collaborationModel}</SubLabel>
                <RichContent html={quote.project.collaborationModel} />
              </div>
            )}
            {quote.project.scope && (
              <div>
                <SubLabel>{l.scope}</SubLabel>
                <RichContent html={quote.project.scope} />
              </div>
            )}
          </div>
        </section>

        {/* ── 4. Fases ── */}
        {quote.project.phases.length > 0 && (
          <>
            {onTogglePageBreak && <PageBreakControl sectionId="phases" active={breaks.has('phases')} onToggle={onTogglePageBreak} />}
            <section id="phases" className="mb-12 sm:mb-20" style={pageBreakStyle('phases')}>
              <SectionLabel>{l.projectPhases}</SectionLabel>
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
                      <div className="pl-8 sm:pl-12">
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
            <section id="timeline" className="mb-12 sm:mb-20" style={pageBreakStyle('timeline')}>
              <SectionLabel>{l.timeline}</SectionLabel>
              {/* Break out of article's max-w-3xl on larger screens for a wider Gantt */}
              <GanttTimeline entries={quote.timeline.filter((e) => e.startDate && e.endDate)} lang={quote.language} />
            </section>
          </>
        )}

        {onTogglePageBreak && <PageBreakControl sectionId="budget" active={breaks.has('budget')} onToggle={onTogglePageBreak} />}
        <Divider />

        {/* ── 6. Presupuesto ── */}
        {quote.budgetTable.items.length > 0 && (
          <section id="budget" className="mb-12 sm:mb-20" style={pageBreakStyle('budget')}>
            <SectionLabel>{l.budget}</SectionLabel>

            {/* Column headers */}
            <div className="flex items-center gap-3 sm:gap-6 pb-3 border-b border-line mb-0">
              <span className="w-6 shrink-0 hidden xs:block" />
              <span className="flex-1 text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60">{l.concept}</span>
              <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60 text-right w-20 sm:w-28 shrink-0">{l.price}</span>
            </div>

            {/* Items */}
            <div>
              {quote.budgetTable.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 sm:gap-6 py-4 sm:py-5 border-b border-line">
                  <span className="text-[8px] font-light text-ink-20 w-6 shrink-0 mt-[3px] tabular-nums select-none tracking-wide hidden xs:block">
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
                  <span className="text-sm font-medium text-ink tabular-nums shrink-0 mt-[3px] w-20 sm:w-28 text-right">
                    {fmt(item.price)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="flex items-baseline gap-3 sm:gap-6 pt-4 sm:pt-5">
              <span className="w-6 shrink-0 hidden xs:block" />
              <span className="flex-1 text-sm font-medium text-ink">
                {quote.budgetTable.totalLabel || 'Total'}
                {quote.budgetTable.taxRate > 0 && (
                  <span className="font-normal text-ink-40 ml-1">{l.vatNotIncluded}</span>
                )}
              </span>
              <span className="text-sm font-medium text-ink tabular-nums w-20 sm:w-28 text-right shrink-0">
                {fmt(quote.budgetTable.subtotal)}
              </span>
            </div>
          </section>
        )}

        {/* ── 7. Tabla adicional ── */}
        {quote.budgetTableAdditional.enabled && quote.budgetTableAdditional.items.length > 0 && (
          <>
            {onTogglePageBreak && <PageBreakControl sectionId="budget-additional" active={breaks.has('budget-additional')} onToggle={onTogglePageBreak} />}
            <Divider />
            <section id="budget-additional" className="mb-12 sm:mb-20" style={pageBreakStyle('budget-additional')}>
              <SectionLabel>{quote.budgetTableAdditional.label || 'Servicios adicionales'}</SectionLabel>

              <div className="flex items-center gap-3 sm:gap-6 pb-3 border-b border-line mb-0">
                <span className="w-6 shrink-0 hidden xs:block" />
                <span className="flex-1 text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60">{l.concept}</span>
                <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-ink-60 text-right w-20 sm:w-28 shrink-0">{l.price}</span>
              </div>
              <div>
                {quote.budgetTableAdditional.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 sm:gap-6 py-4 sm:py-5 border-b border-line">
                    <span className="text-[8px] font-light text-ink-20 w-6 shrink-0 mt-[3px] tabular-nums select-none tracking-wide hidden xs:block">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink leading-snug">{item.concept}</p>
                      {item.notes && (
                        <p className="text-xs text-ink-40 mt-2 leading-relaxed">{item.notes}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-ink tabular-nums shrink-0 mt-[3px] w-20 sm:w-28 text-right">
                      {item.price > 0 ? fmt(item.price) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {onTogglePageBreak && <PageBreakControl sectionId="conditions" active={breaks.has('conditions')} onToggle={onTogglePageBreak} />}

        {/* ── 8. Condiciones de aceptación ── */}
        {Object.values(quote.acceptanceConditions).some(Boolean) && (
          <section id="conditions" className="mb-12 sm:mb-20" style={pageBreakStyle('conditions')}>
            <SectionLabel>{l.acceptanceAndBilling}</SectionLabel>
            <div className="space-y-10">
              {([
                ['paymentTerms',            l.paymentTerms],
                ['acceptanceCriteria',      l.acceptanceCriteria],
                ['clientResponsibilities',  l.clientResponsibilities],
                ['penaltyClause',           l.penaltyClause],
                ['annexes',                 l.annexes],
                ['dataProtection',          l.dataProtection],
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
        {(quote.billingMilestones?.length || quote.billingConditions) && (
          <>
            {onTogglePageBreak && <PageBreakControl sectionId="billing" active={breaks.has('billing')} onToggle={onTogglePageBreak} />}
            <section id="billing" className="mb-12 sm:mb-20" style={pageBreakStyle('billing')}>
              <SectionLabel>{l.billing}</SectionLabel>
              {quote.billingMilestones?.length ? (
                <div className="space-y-8">
                  {quote.billingMilestones.map((m) => {
                    const subtotal = quote.budgetTable?.subtotal || 0
                    const amount = subtotal > 0 ? subtotal * m.percentage / 100 : null
                    const formatted = amount != null
                      ? new Intl.NumberFormat(locale, { style: 'currency', currency: quote.currency || 'EUR' }).format(amount)
                      : null
                    return (
                      <div key={m.id}>
                        <p className="text-sm font-medium text-ink mb-1">
                          {m.label}{formatted ? `: ${formatted}` : ''}
                          {formatted && <span className="font-normal text-ink-60"> {l.vatNotIncluded}</span>}
                        </p>
                        {m.description && <p className="text-sm text-ink-60">{m.description}</p>}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <RichContent html={quote.billingConditions} />
              )}
            </section>
          </>
        )}

        {onTogglePageBreak && <PageBreakControl sectionId="conformity" active={breaks.has('conformity')} onToggle={onTogglePageBreak} />}

        {/* ── 10. Conformidad ── */}
        <section id="conformity" className="mb-12 sm:mb-20" style={pageBreakStyle('conformity')}>
          <SectionLabel>{l.conformity}</SectionLabel>
          <p className="text-sm text-ink-60 mb-16 leading-relaxed">
            {l.conformityIntro}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-16">
            {([
              { label: l.client, fields: [
                { label: l.company,       value: quote.client.company },
                { label: l.taxId,         value: quote.client.taxId },
                { label: l.address,       value: quote.client.address },
                { label: l.city,          value: quote.client.city },
                { label: l.representedBy, value: quote.client.name },
                { label: l.role,          value: quote.client.role },
              ]},
              { label: l.serviceProvider, fields: [
                { label: l.company,       value: quote.emitter.companyName },
                { label: l.taxId,         value: quote.emitter.taxId },
                { label: l.address,       value: quote.emitter.address },
                { label: l.city,          value: quote.emitter.city },
                { label: l.representedBy, value: quote.emitter.representativeName },
                { label: l.role,          value: quote.emitter.representativeRole },
              ]},
            ] as const).map(({ label, fields }) => (
              <div key={label} className="flex flex-col">
                <SubLabel>{label}</SubLabel>
                <div className="space-y-2">
                  {fields.filter(f => f.value).map(({ label: fl, value }) => (
                    <div key={fl} className="flex gap-3 text-sm">
                      <span className="text-ink-40 w-24 sm:w-32 shrink-0">{fl}:</span>
                      <span className="text-ink">{value}</span>
                    </div>
                  ))}
                </div>
                {/* Spacer: fills available height but always at least 48px */}
                <div className="flex-1 min-h-12" />
                <div className="border-t border-input pt-3">
                  <p className="text-xs text-ink-40">{l.signatureDate}</p>
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
