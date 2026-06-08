'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Quote } from '@/types/quote'
import { GanttTimeline } from './GanttTimeline'
import { FeatherIcon } from '@/components/ui/IconPicker'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'

// ─── Helper components ───────────────────────────────────────────────────────

function RC({ html }: { html: string }) {
  if (!html) return null
  return (
    <div
      className="prose-quote text-sm leading-relaxed text-ink"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function PL({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-medium tracking-[0.2em] uppercase mb-8 text-ink-40">
      {children}
    </p>
  )
}

function SL({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-medium tracking-[0.15em] uppercase mb-2 text-ink-40">
      {children}
    </p>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

type AnimPhase = 'idle' | 'exit' | 'enter-prepare' | 'enter'

interface PageDef {
  id: string
  label: string
  render: () => React.ReactNode
}

interface Dims {
  width: number
  height: number
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PageFlipView({ quote }: { quote: Quote }) {
  const [dims, setDims] = useState<Dims>({ width: 595, height: 842 })
  const [current, setCurrent] = useState(0)
  const [displayPage, setDisplayPage] = useState(0)
  const [animPhase, setAnimPhase] = useState<AnimPhase>('idle')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [peelSize, setPeelSize] = useState(0)

  const pageRef = useRef<HTMLDivElement>(null)
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Formatting helpers ──────────────────────────────────────────────────

  const fmt = useCallback(
    (n: number) =>
      new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: quote.currency || 'EUR',
        maximumFractionDigits: 0,
      }).format(n),
    [quote.currency]
  )

  const formatDate = useCallback(
    (d: string) =>
      d
        ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : '',
    []
  )

  const clientName = quote.client.company || quote.client.name
  const hasTimeline = quote.timeline.some((e) => e.startDate && e.endDate)

  // ── Build pages ─────────────────────────────────────────────────────────

  const pages: PageDef[] = []

  // 1. Cover
  pages.push({
    id: 'cover',
    label: 'Portada',
    render: () => (
      <div className="flex flex-col h-full px-14 py-12">
        <div className="flex-1 flex flex-col items-center justify-center">
          {clientName && (
            <p
              className="font-medium tracking-tight text-ink leading-snug text-center"
              style={{ fontSize: Math.round(dims.height * 0.038) }}
            >
              {clientName}
            </p>
          )}
          {quote.date && (
            <p className="text-sm text-ink-40 mt-4">{formatDate(quote.date)}</p>
          )}
          {quote.quoteNumber && (
            <p className="text-[10px] tracking-[0.18em] uppercase text-ink-40 mt-2">
              {quote.quoteNumber}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {quote.emitter.logoUrl ? (
            <img
              src={quote.emitter.logoUrl}
              alt={quote.emitter.companyName}
              className="object-contain"
              style={{ maxHeight: '1.5rem', maxWidth: '8rem' }}
            />
          ) : (
            <p className="text-xs font-medium text-ink">{quote.emitter.companyName}</p>
          )}
        </div>
      </div>
    ),
  })

  // 2. Emitter
  if (quote.emitter.companyName || quote.emitter.description) {
    pages.push({
      id: 'emitter',
      label: quote.emitter.companyName || 'Emisora',
      render: () => (
        <div className="px-14 py-12">
          {quote.emitter.companyName && <PL>{quote.emitter.companyName}</PL>}
          {quote.emitter.description && <RC html={quote.emitter.description} />}
        </div>
      ),
    })
  }

  // 3. Project
  pages.push({
    id: 'project',
    label: 'Proyecto',
    render: () => (
      <div className="px-14 py-12 overflow-y-auto h-full">
        <PL>Proyecto</PL>
        <div className="space-y-8">
          {quote.client.description && (
            <div>
              <SL>Sobre {clientName || 'el cliente'}</SL>
              <RC html={quote.client.description} />
            </div>
          )}
          {quote.project.mainObjective && (
            <div>
              <SL>Objetivo principal</SL>
              <RC html={quote.project.mainObjective} />
            </div>
          )}
          {quote.project.collaborationModel && (
            <div>
              <SL>Modelo de colaboración</SL>
              <RC html={quote.project.collaborationModel} />
            </div>
          )}
          {quote.project.scope && (
            <div>
              <SL>Alcance</SL>
              <RC html={quote.project.scope} />
            </div>
          )}
        </div>
      </div>
    ),
  })

  // 4. Phases
  if (quote.project.phases.length > 0) {
    pages.push({
      id: 'phases',
      label: 'Fases del proyecto',
      render: () => (
        <div className="px-14 py-12 overflow-y-auto h-full">
          <PL>Fases del proyecto</PL>
          <div className="space-y-7">
            {quote.project.phases.map((phase, i) => (
              <div key={i}>
                <div className="flex items-center gap-4 mb-2">
                  {phase.icon ? (
                    <span
                      className="w-7 h-7 flex items-center justify-center rounded-md shrink-0"
                      style={{
                        background: 'var(--color-surface)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      <FeatherIcon name={phase.icon} size={13} />
                    </span>
                  ) : (
                    <span className="text-[8px] font-medium tracking-[0.15em] text-ink-40 w-7 text-center shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  )}
                  <h3 className="text-sm font-medium text-ink leading-snug">{phase.name}</h3>
                </div>
                {phase.description && (
                  <div className="pl-11">
                    <RC html={phase.description} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ),
    })
  }

  // 5. Timeline
  if (hasTimeline) {
    pages.push({
      id: 'timeline',
      label: 'Timeline',
      render: () => (
        <div className="px-14 py-12 overflow-auto h-full">
          <PL>Timeline</PL>
          <GanttTimeline
            entries={quote.timeline.filter((e) => e.startDate && e.endDate)}
          />
        </div>
      ),
    })
  }

  // 6. Budget
  if (quote.budgetTable.items.length > 0) {
    pages.push({
      id: 'budget',
      label: 'Presupuesto',
      render: () => (
        <div className="px-14 py-12 overflow-y-auto h-full">
          <PL>Presupuesto</PL>

          {/* Column headers */}
          <div className="flex items-center gap-5 pb-2.5 border-b border-line mb-0">
            <span className="w-5 shrink-0" />
            <span className="flex-1 text-[9px] font-medium tracking-[0.15em] uppercase text-ink-60">
              Concepto
            </span>
            <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-ink-60 text-right w-24 shrink-0">
              Precio
            </span>
          </div>

          {/* Items */}
          <div>
            {quote.budgetTable.items.map((item, i) => (
              <div key={i} className="flex items-start gap-5 py-4 border-b border-line">
                <span className="text-[8px] font-light text-ink-20 w-5 shrink-0 mt-[2px] tabular-nums select-none tracking-wide">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink leading-snug">{item.concept}</p>
                  {item.time && (
                    <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-ink-40 mt-0.5">
                      {item.time}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-ink-40 mt-1.5 leading-relaxed">{item.notes}</p>
                  )}
                </div>
                <span className="text-sm font-medium text-ink tabular-nums shrink-0 mt-[2px] w-24 text-right">
                  {fmt(item.price)}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-baseline gap-5 pt-4">
            <span className="w-5 shrink-0" />
            <span className="flex-1 text-sm font-medium text-ink">
              {quote.budgetTable.totalLabel || 'Total'}
              {quote.budgetTable.taxRate > 0 && (
                <span className="font-normal text-ink-40 ml-1">(IVA no incluido)</span>
              )}
            </span>
            <span className="text-sm font-medium text-ink tabular-nums w-24 text-right shrink-0">
              {fmt(quote.budgetTable.subtotal)}
            </span>
          </div>
        </div>
      ),
    })
  }

  // 7. Budget additional
  if (
    quote.budgetTableAdditional.enabled &&
    quote.budgetTableAdditional.items.length > 0
  ) {
    pages.push({
      id: 'budget-additional',
      label: quote.budgetTableAdditional.label || 'Servicios adicionales',
      render: () => (
        <div className="px-14 py-12 overflow-y-auto h-full">
          <PL>{quote.budgetTableAdditional.label || 'Servicios adicionales'}</PL>

          <div className="flex items-center gap-5 pb-2.5 border-b border-line mb-0">
            <span className="w-5 shrink-0" />
            <span className="flex-1 text-[9px] font-medium tracking-[0.15em] uppercase text-ink-60">
              Concepto
            </span>
            <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-ink-60 text-right w-24 shrink-0">
              Precio
            </span>
          </div>

          <div>
            {quote.budgetTableAdditional.items.map((item, i) => (
              <div key={i} className="flex items-start gap-5 py-4 border-b border-line">
                <span className="text-[8px] font-light text-ink-20 w-5 shrink-0 mt-[2px] tabular-nums select-none tracking-wide">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink leading-snug">{item.concept}</p>
                  {item.notes && (
                    <p className="text-xs text-ink-40 mt-1.5 leading-relaxed">{item.notes}</p>
                  )}
                </div>
                <span className="text-sm font-medium text-ink tabular-nums shrink-0 mt-[2px] w-24 text-right">
                  {item.price > 0 ? fmt(item.price) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    })
  }

  // 8. Conditions
  const conditionFields = [
    ['paymentTerms', 'Forma de pago'],
    ['acceptanceCriteria', 'Criterios de aceptación'],
    ['clientResponsibilities', 'Responsabilidades del cliente'],
    ['penaltyClause', 'Cláusula de penalización'],
    ['annexes', 'Archivos / Información anexa'],
    ['dataProtection', 'Aceptación del tratamiento de datos personales'],
  ] as const

  if (Object.values(quote.acceptanceConditions).some(Boolean)) {
    pages.push({
      id: 'conditions',
      label: 'Condiciones de aceptación',
      render: () => (
        <div className="px-14 py-12 overflow-y-auto h-full">
          <PL>Condiciones de aceptación</PL>
          <div className="space-y-7">
            {conditionFields.map(([key, label]) =>
              quote.acceptanceConditions[key] ? (
                <div key={key}>
                  <SL>{label}</SL>
                  <RC html={quote.acceptanceConditions[key]} />
                </div>
              ) : null
            )}
          </div>
        </div>
      ),
    })
  }

  // 9. Billing
  if (quote.billingMilestones?.length || quote.billingConditions) {
    pages.push({
      id: 'billing',
      label: 'Facturación',
      render: () => (
        <div className="px-14 py-12 overflow-y-auto h-full">
          <PL>Facturación</PL>
          {quote.billingMilestones?.length ? (
            <div className="space-y-6">
              {quote.billingMilestones.map((m) => {
                const subtotal = quote.budgetTable?.subtotal || 0
                const amount = subtotal > 0 ? (subtotal * m.percentage) / 100 : null
                const formatted =
                  amount != null
                    ? new Intl.NumberFormat('es-ES', {
                        style: 'currency',
                        currency: quote.currency || 'EUR',
                      }).format(amount)
                    : null
                return (
                  <div key={m.id}>
                    <p className="text-sm font-medium text-ink mb-1">
                      {m.label}
                      {formatted ? `: ${formatted}` : ''}
                      {formatted && (
                        <span className="font-normal text-ink-60"> (IVA no incluido)</span>
                      )}
                    </p>
                    {m.description && (
                      <p className="text-sm text-ink-60">{m.description}</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <RC html={quote.billingConditions} />
          )}
        </div>
      ),
    })
  }

  // 10. Conformity
  pages.push({
    id: 'conformity',
    label: 'Conformidad',
    render: () => (
      <div className="px-14 py-12 overflow-y-auto h-full">
        <PL>Conformidad</PL>
        <p className="text-xs text-ink-60 mb-10 leading-relaxed">
          La firma del presente documento se interpreta como la conformidad y la aceptación
          de todas las condiciones expuestas en él y el cumplimiento de las mismas.
        </p>

        <div className="grid grid-cols-2 gap-10">
          {(
            [
              {
                label: 'Cliente',
                fields: [
                  { label: 'Empresa', value: quote.client.company },
                  { label: 'CIF', value: quote.client.taxId },
                  { label: 'Dirección', value: quote.client.address },
                  { label: 'Ciudad', value: quote.client.city },
                  { label: 'Representada por', value: quote.client.name },
                  { label: 'Cargo', value: quote.client.role },
                ],
              },
              {
                label: 'Proveedor',
                fields: [
                  { label: 'Empresa', value: quote.emitter.companyName },
                  { label: 'CIF', value: quote.emitter.taxId },
                  { label: 'Dirección', value: quote.emitter.address },
                  { label: 'Ciudad', value: quote.emitter.city },
                  { label: 'Representada por', value: quote.emitter.representativeName },
                  { label: 'Cargo', value: quote.emitter.representativeRole },
                ],
              },
            ] as const
          ).map(({ label, fields }) => (
            <div key={label}>
              <SL>{label}</SL>
              <div className="space-y-1.5 mb-10">
                {fields
                  .filter((f) => f.value)
                  .map(({ label: fl, value }) => (
                    <div key={fl} className="flex gap-2 text-xs">
                      <span className="text-ink-40 w-28 shrink-0">{fl}:</span>
                      <span className="text-ink">{value}</span>
                    </div>
                  ))}
              </div>
              <div className="mt-6 border-t border-input pt-2.5">
                <p className="text-[10px] text-ink-40">Firma y fecha</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  })

  // ── Page sizing ─────────────────────────────────────────────────────────

  useEffect(() => {
    function compute() {
      const maxH = window.innerHeight * 0.88
      const maxW = window.innerWidth * 0.78
      const byHeight = { height: maxH, width: maxH / 1.4142 }
      const byWidth = { height: maxW * 1.4142, width: maxW }
      const d = byHeight.width <= maxW ? byHeight : byWidth
      setDims({ width: Math.round(d.width), height: Math.round(d.height) })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  // ── Animation ───────────────────────────────────────────────────────────

  const goTo = useCallback(
    (idx: number) => {
      if (idx === current || idx < 0 || idx >= pages.length) return
      if (animTimerRef.current) clearTimeout(animTimerRef.current)

      const dir = idx > current ? 1 : -1
      setDirection(dir as 1 | -1)
      setAnimPhase('exit')

      animTimerRef.current = setTimeout(() => {
        setDisplayPage(idx)
        setCurrent(idx)
        setAnimPhase('enter-prepare')

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setAnimPhase('enter')

            animTimerRef.current = setTimeout(() => {
              setAnimPhase('idle')
            }, 420)
          })
        })
      }, 330)
    },
    // pages.length is derived from quote data; safe to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, pages.length]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
    }
  }, [])

  // ── Keyboard navigation ─────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        goTo(current + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goTo(current - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, goTo])

  // ── Corner peel mouse tracking ──────────────────────────────────────────

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!pageRef.current || current >= pages.length - 1) {
      setPeelSize(0)
      return
    }
    const rect = pageRef.current.getBoundingClientRect()
    const distX = rect.right - e.clientX
    const distY = rect.bottom - e.clientY
    const dist = Math.sqrt(distX * distX + distY * distY)
    if (dist < 120) {
      setPeelSize(Math.round((1 - dist / 120) * 80))
    } else {
      setPeelSize(0)
    }
  }

  function onMouseLeave() {
    setPeelSize(0)
  }

  // ── Page transform styles ───────────────────────────────────────────────

  function pageStyle(): React.CSSProperties {
    switch (animPhase) {
      case 'exit':
        return {
          transform:
            direction === 1
              ? 'perspective(1400px) rotateY(-35deg) translateX(-8%) scale(0.97)'
              : 'perspective(1400px) rotateY(35deg) translateX(8%) scale(0.97)',
          opacity: 0,
          transition: 'transform 330ms ease-in, opacity 330ms ease-in',
        }
      case 'enter-prepare':
        return {
          transform:
            direction === 1
              ? 'perspective(1400px) rotateY(25deg) translateX(6%) scale(0.97)'
              : 'perspective(1400px) rotateY(-25deg) translateX(-6%) scale(0.97)',
          opacity: 0,
          transition: 'none',
        }
      case 'enter':
        return {
          transform: 'perspective(1400px) rotateY(0deg) translateX(0) scale(1)',
          opacity: 1,
          transition:
            'transform 420ms cubic-bezier(0.16,1,0.3,1), opacity 380ms ease-out',
        }
      case 'idle':
      default:
        return { opacity: 1 }
    }
  }

  const page = pages[displayPage]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#EBEBEB] py-10">
      {/* Fixed print button */}
      <button
        onClick={() => window.print()}
        className="no-print fixed top-5 right-5 z-50 flex items-center gap-2 text-xs text-ink-60 hover:text-ink bg-paper border border-line rounded-md px-3 py-2 shadow-sm transition-colors"
      >
        <Printer size={13} strokeWidth={1.5} />
        Exportar PDF
      </button>

      {/* Page */}
      <div
        ref={pageRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="relative bg-paper overflow-hidden"
        style={{
          width: dims.width,
          height: dims.height,
          boxShadow:
            '0 25px 70px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08)',
          ...pageStyle(),
        }}
      >
        {/* Page content */}
        {page && <div className="w-full h-full">{page.render()}</div>}

        {/* Corner peel */}
        {peelSize > 0 && current < pages.length - 1 && (
          <>
            {/* Shadow */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: peelSize * 1.3,
                height: peelSize * 1.3,
                background:
                  'radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.15) 0%, transparent 65%)',
                transition: 'width 0.12s, height 0.12s',
                pointerEvents: 'none',
              }}
            />
            {/* Flap */}
            <div
              onClick={() => goTo(current + 1)}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: peelSize,
                height: peelSize,
                clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                background:
                  'linear-gradient(225deg, #d4d4d4 0%, #ebebeb 40%, #f5f5f5 52%, transparent 54%)',
                cursor: 'pointer',
                transition: 'width 0.12s, height 0.12s',
              }}
            />
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="no-print flex flex-col items-center gap-3 mt-6">
        {/* Dots */}
        <div className="flex items-center gap-2">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir a página ${i + 1}`}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                background:
                  i === current
                    ? 'var(--color-ink)'
                    : 'color-mix(in srgb, var(--color-ink) 20%, transparent)',
              }}
            />
          ))}
        </div>

        {/* Prev / Next arrows */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="p-1.5 rounded-md transition-colors disabled:opacity-20 text-ink-40 hover:text-ink hover:bg-black/5 disabled:hover:bg-transparent disabled:hover:text-ink-40"
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <span className="text-[10px] tracking-[0.12em] uppercase text-ink-40 select-none min-w-[6rem] text-center">
            {current + 1} / {pages.length}
          </span>
          <button
            onClick={() => goTo(current + 1)}
            disabled={current === pages.length - 1}
            className="p-1.5 rounded-md transition-colors disabled:opacity-20 text-ink-40 hover:text-ink hover:bg-black/5 disabled:hover:bg-transparent disabled:hover:text-ink-40"
            aria-label="Página siguiente"
          >
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
