'use client'

import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { RichTextEditor } from './RichTextEditor'
import { BudgetTable } from './BudgetTable'
import type { Quote, QuoteFormData, ProjectPhase } from '@/types/quote'
import { Plus, Trash2, ChevronDown, ChevronUp, Check, Loader } from 'lucide-react'
import { AIAssistant, type AISection } from './AIAssistant'
import { IconPicker } from '@/components/ui/IconPicker'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { EditableGantt, InteractiveGantt } from './GanttTimeline'

interface Props {
  initialData: QuoteFormData
  companyData?: Partial<Quote['emitter']> & { defaultConditions?: Quote['acceptanceConditions'] }
  onSave: (data: QuoteFormData) => Promise<void>
  saving?: boolean
}

const SECTION_LABEL = 'text-xs font-medium tracking-widest uppercase text-ink-40 flex items-center justify-between'
const FIELD_LABEL = 'block text-sm font-medium text-ink mb-2'
const INPUT = 'w-full px-4 py-3 border border-input rounded-md text-base text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'
const GRID2 = 'grid grid-cols-1 sm:grid-cols-2 gap-6'

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

// ── Collapsible animated section ──────────────────────────────────────────────
function CollapsibleSection({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const initialOpen = useRef(open)
  const initialized = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!initialized.current) {
      initialized.current = true
      return // initial state already set via inline style
    }

    if (open) {
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.38, ease: 'power3.out' }
      )
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.24, ease: 'power3.in' })
    }
  }, [open])

  return (
    <div
      ref={ref}
      className="overflow-hidden"
      style={initialOpen.current ? undefined : { height: 0, opacity: 0 }}
    >
      <div className="pb-8">{children}</div>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({
  label, open, onToggle, optional, saveStatus, aiTouched,
}: {
  label: string; open: boolean; onToggle: () => void
  optional?: boolean; saveStatus?: SaveStatus; aiTouched?: boolean
}) {
  return (
    <div className={SECTION_LABEL + ' w-full cursor-pointer py-6 group/header'} onClick={onToggle}>
      <span className="flex items-center gap-2 group-hover/header:text-ink-60 transition-colors">
        {label}
        {optional && (
          <span className="text-ink-40 normal-case font-normal tracking-normal text-xs">(opcional)</span>
        )}
        {aiTouched && (
          <span title="Rellenado con IA">
            <Loader size={11} strokeWidth={1.5} className="text-ink-40" />
          </span>
        )}
      </span>
      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        {open && saveStatus === 'saving' && (
          <span className="w-2.5 h-2.5 border border-ink-40 border-t-transparent rounded-full animate-spin" />
        )}
        {open && saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-[10px] text-ink-40 font-normal tracking-normal normal-case">
            <Check size={10} strokeWidth={2.5} />
            Guardado
          </span>
        )}
        {open && saveStatus === 'error' && (
          <span className="text-[10px] font-normal tracking-normal normal-case" style={{ color: 'var(--color-error, #dc2626)' }}>
            Error al guardar
          </span>
        )}
        <span className="text-ink-40 group-hover/header:text-ink-60 transition-colors">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>
    </div>
  )
}

export function QuoteEditor({ initialData, onSave }: Props) {
  const [form, setForm] = useState<QuoteFormData>(initialData)
  const [open, setOpen] = useState<Record<string, boolean>>({
    meta: false, emitter: false, client: false,
    project: false, phases: false, timeline: false,
    budget: false, budgetAdditional: false,
    acceptance: false, billing: false, conformity: false,
  })
  const [aiSection, setAiSection] = useState<AISection | null>(null)
  const [aiTouched, setAiTouched] = useState<Set<string>>(new Set())

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const isFirstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const SECTION_KEYS = ['meta','emitter','client','project','phases','timeline','budget','budgetAdditional','acceptance','billing','conformity']
  const allOpen = SECTION_KEYS.every((k) => open[k])

  function toggleAll() {
    const next = !allOpen
    setOpen(Object.fromEntries(SECTION_KEYS.map((k) => [k, next])))
  }

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }

    setSaveStatus('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (clearTimer.current) clearTimeout(clearTimer.current)

    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await onSave(form)
        setSaveStatus('saved')
        clearTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 1200)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  function toggle(key: string) {
    setOpen((o) => {
      const opening = !o[key]
      if (opening) setAiTouched((t) => { const n = new Set(t); n.delete(key); return n })
      return { ...o, [key]: opening }
    })
  }

  // Map form keys → section ids for AI-touch detection
  const AI_SECTION_MAP: Array<[string, (f: QuoteFormData) => unknown]> = [
    ['client',     (f) => f.client],
    ['project',    (f) => ({ ...f.project, phases: undefined })],
    ['phases',     (f) => f.project.phases],
    ['timeline',   (f) => f.timeline],
    ['budget',     (f) => f.budgetTable],
    ['acceptance', (f) => f.acceptanceConditions],
    ['billing',    (f) => f.billingConditions],
    ['conformity', (f) => f.conformity],
  ]

  function handleAIApply(updater: (prev: QuoteFormData) => QuoteFormData) {
    setForm((prev) => {
      const next = updater(prev)
      const touched = new Set<string>()
      for (const [sectionKey, extract] of AI_SECTION_MAP) {
        if (JSON.stringify(extract(prev)) !== JSON.stringify(extract(next))) {
          touched.add(sectionKey)
        }
      }
      if (touched.size > 0) setAiTouched((t) => new Set([...t, ...touched]))
      return next
    })
  }

  function set<K extends keyof QuoteFormData>(key: K, value: QuoteFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setNested<K extends keyof QuoteFormData, NK extends keyof QuoteFormData[K]>(
    key: K,
    nestedKey: NK,
    value: QuoteFormData[K][NK]
  ) {
    setForm((f) => ({ ...f, [key]: { ...(f[key] as object), [nestedKey]: value } }))
  }

  function setAcceptance(key: keyof QuoteFormData['acceptanceConditions'], value: string) {
    setForm((f) => ({ ...f, acceptanceConditions: { ...f.acceptanceConditions, [key]: value } }))
  }

  function addPhase() {
    const phase: ProjectPhase = { name: '', description: '', order: form.project.phases.length }
    setNested('project', 'phases', [...form.project.phases, phase])
  }

  function updatePhase(i: number, field: keyof ProjectPhase, value: string | number) {
    const phases = form.project.phases.map((p, idx) => (idx === i ? { ...p, [field]: value } : p))
    setNested('project', 'phases', phases)
  }

  function removePhase(i: number) {
    setNested('project', 'phases', form.project.phases.filter((_, idx) => idx !== i))
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">

      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setAiSection('all')}
          className="flex items-center gap-1.5 text-xs text-ink-40 hover:text-ink transition-colors"
        >
          <Loader size={11} strokeWidth={1.5} />
          Completar con IA
        </button>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-ink-40 hover:text-ink-60 transition-colors"
        >
          {allOpen ? 'Plegar todo' : 'Desplegar todo'}
        </button>
      </div>

      {/* Meta */}
      <div id="meta">
        <SectionHeader label="Datos del presupuesto" open={open.meta} onToggle={() => toggle('meta')} saveStatus={saveStatus} />
        <CollapsibleSection open={open.meta}>
          <div className="space-y-6">
            <div className={GRID2}>
              <div>
                <label className={FIELD_LABEL}>Número de presupuesto</label>
                <input className={INPUT} value={form.quoteNumber} onChange={(e) => set('quoteNumber', e.target.value)} placeholder="P-2026-001" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Moneda</label>
                <Select className={INPUT} value={form.currency} onChange={(e) => set('currency', e.target.value as QuoteFormData['currency'])}>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="MXN">MXN — Peso mexicano</option>
                </Select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Idioma del presupuesto</label>
                <Select className={INPUT} value={form.language ?? 'es'} onChange={(e) => set('language', e.target.value as 'es' | 'en')}>
                  <option value="es">🇪🇸 Español</option>
                  <option value="en">🇺🇸 English</option>
                </Select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Contraseña de acceso</label>
                <input
                  className={INPUT}
                  type="text"
                  value={form.accessPassword ?? ''}
                  onChange={(e) => set('accessPassword', e.target.value || undefined)}
                  placeholder="Dejar vacío = sin protección"
                />
                <p className="text-xs text-ink-40 mt-1">El cliente la necesitará para ver el presupuesto.</p>
              </div>
              <div>
                <label className={FIELD_LABEL}>Fecha</label>
                <DatePicker className={INPUT} value={form.date} onChange={(v) => set('date', v)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Válido hasta</label>
                <DatePicker className={INPUT} value={form.validUntil} onChange={(v) => set('validUntil', v)} />
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Empresa emisora */}
      <div id="emitter">
        <SectionHeader label="Empresa emisora" open={open.emitter} onToggle={() => toggle('emitter')} saveStatus={saveStatus} />
        <CollapsibleSection open={open.emitter}>
          <div className="space-y-6">
            <div className={GRID2}>
              <div>
                <label className={FIELD_LABEL}>Nombre</label>
                <input className={INPUT} value={form.emitter.companyName} onChange={(e) => setNested('emitter', 'companyName', e.target.value)} placeholder="Tu empresa S.L." />
              </div>
              <div>
                <label className={FIELD_LABEL}>Email</label>
                <input className={INPUT} type="email" value={form.emitter.email} onChange={(e) => setNested('emitter', 'email', e.target.value)} placeholder="hola@tuempresa.com" />
              </div>
              <div>
                <label className={FIELD_LABEL}>CIF / NIF</label>
                <input className={INPUT} value={form.emitter.taxId} onChange={(e) => setNested('emitter', 'taxId', e.target.value)} placeholder="B12345678" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Dirección</label>
                <input className={INPUT} value={form.emitter.address} onChange={(e) => setNested('emitter', 'address', e.target.value)} placeholder="Calle, número, CP" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Ciudad</label>
                <input className={INPUT} value={form.emitter.city} onChange={(e) => setNested('emitter', 'city', e.target.value)} placeholder="Ciudad" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Representada por</label>
                <input className={INPUT} value={form.emitter.representativeName} onChange={(e) => setNested('emitter', 'representativeName', e.target.value)} placeholder="Nombre Apellido" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Cargo</label>
                <input className={INPUT} value={form.emitter.representativeRole} onChange={(e) => setNested('emitter', 'representativeRole', e.target.value)} placeholder="Ej: Fundador, CEO…" />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Descripción de la empresa</label>
              <RichTextEditor value={form.emitter.description} onChange={(v) => setNested('emitter', 'description', v)} placeholder="Descripción de tu empresa..." minHeight="80px" />
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Cliente */}
      <div id="client">
        <SectionHeader label="Empresa receptora / Cliente" open={open.client} onToggle={() => toggle('client')} saveStatus={saveStatus} aiTouched={aiTouched.has('client')} />
        <CollapsibleSection open={open.client}>
          <div className="space-y-6">
            <div className={GRID2}>
              <div>
                <label className={FIELD_LABEL}>Empresa</label>
                <input className={INPUT} value={form.client.company} onChange={(e) => setNested('client', 'company', e.target.value)} placeholder="Empresa del cliente" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Nombre de contacto</label>
                <input className={INPUT} value={form.client.name} onChange={(e) => setNested('client', 'name', e.target.value)} placeholder="Nombre Apellido" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Email</label>
                <input className={INPUT} type="email" value={form.client.email} onChange={(e) => setNested('client', 'email', e.target.value)} placeholder="cliente@empresa.com" />
              </div>
              <div>
                <label className={FIELD_LABEL}>CIF / NIF</label>
                <input className={INPUT} value={form.client.taxId} onChange={(e) => setNested('client', 'taxId', e.target.value)} placeholder="A12345678" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Dirección</label>
                <input className={INPUT} value={form.client.address} onChange={(e) => setNested('client', 'address', e.target.value)} placeholder="Calle, número, CP" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Ciudad</label>
                <input className={INPUT} value={form.client.city} onChange={(e) => setNested('client', 'city', e.target.value)} placeholder="Ciudad" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Representada por</label>
                <input className={INPUT} value={form.client.name} onChange={(e) => setNested('client', 'name', e.target.value)} placeholder="Nombre Apellido" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Cargo</label>
                <input className={INPUT} value={form.client.role} onChange={(e) => setNested('client', 'role', e.target.value)} placeholder="Ej: CEO, Director…" />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Descripción de la empresa receptora</label>
              <RichTextEditor value={form.client.description} onChange={(v) => setNested('client', 'description', v)} placeholder="Contexto del cliente..." minHeight="80px" />
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Proyecto */}
      <div id="project">
        <SectionHeader label="Proyecto" open={open.project} onToggle={() => toggle('project')} saveStatus={saveStatus} aiTouched={aiTouched.has('project')} />
        <CollapsibleSection open={open.project}>
          <div className="space-y-6">
            <div>
              <label className={FIELD_LABEL}>Objetivo principal</label>
              <RichTextEditor value={form.project.mainObjective} onChange={(v) => setNested('project', 'mainObjective', v)} placeholder="¿Qué se quiere conseguir con este proyecto?" minHeight="80px" />
            </div>
            <div>
              <label className={FIELD_LABEL}>
                Modelo de colaboración
                <span className="ml-2 text-ink-40 font-normal text-xs">(opcional)</span>
              </label>
              <RichTextEditor value={form.project.collaborationModel} onChange={(v) => setNested('project', 'collaborationModel', v)} placeholder="Ej: proyecto cerrado, horas pactadas, retainer mensual..." minHeight="60px" />
            </div>
            <div>
              <label className={FIELD_LABEL}>Alcance del proyecto</label>
              <RichTextEditor value={form.project.scope} onChange={(v) => setNested('project', 'scope', v)} placeholder="¿Qué incluye y qué no incluye este presupuesto?" minHeight="80px" />
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Fases */}
      <div id="phases">
        <SectionHeader label="Fases" open={open.phases} onToggle={() => toggle('phases')} saveStatus={saveStatus} aiTouched={aiTouched.has('phases')} />
        <CollapsibleSection open={open.phases}>
          <div className="space-y-4">
            {form.project.phases.map((phase, i) => (
              <div key={i} className="border border-line rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-40 font-medium uppercase tracking-widest">Fase {i + 1}</span>
                  <button type="button" onClick={() => removePhase(i)} className="text-ink-40 hover:text-[#DC2626] transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <IconPicker value={phase.icon} onChange={(icon) => updatePhase(i, 'icon', icon ?? '')} />
                  <input
                    className={INPUT}
                    placeholder="Nombre de la fase"
                    value={phase.name}
                    onChange={(e) => updatePhase(i, 'name', e.target.value)}
                  />
                </div>
                <RichTextEditor
                  value={phase.description}
                  onChange={(v) => updatePhase(i, 'description', v)}
                  placeholder="Descripción de la fase..."
                  minHeight="60px"
                />
              </div>
            ))}
            <button type="button" onClick={addPhase} className="flex items-center gap-2 text-sm text-ink-60 hover:text-ink transition-colors">
              <Plus size={14} strokeWidth={2} /> Añadir fase
            </button>
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Tareas y tiempos */}
      <div id="timeline">
        <SectionHeader label="Tareas y tiempos" open={open.timeline} onToggle={() => toggle('timeline')} saveStatus={saveStatus} aiTouched={aiTouched.has('timeline')} />
        <CollapsibleSection open={open.timeline}>
          <div className="space-y-6">
            {form.timeline.some(e => e.startDate && e.endDate) && (
              <div className="border border-line rounded-md p-4 bg-surface">
                <p className="text-[10px] font-medium tracking-widest uppercase text-ink-40 mb-4">Vista previa interactiva — arrastra para ajustar fechas</p>
                <InteractiveGantt
                  entries={form.timeline}
                  onChange={(t) => set('timeline', t)}
                />
              </div>
            )}
            <EditableGantt
              entries={form.timeline}
              phases={form.project.phases}
              onChange={(v) => set('timeline', v)}
            />
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Presupuesto principal */}
      <div id="budget">
        <SectionHeader label="Tabla de presupuesto" open={open.budget} onToggle={() => toggle('budget')} saveStatus={saveStatus} aiTouched={aiTouched.has('budget')} />
        <CollapsibleSection open={open.budget}>
          <BudgetTable value={form.budgetTable} onChange={(v) => set('budgetTable', v)} currency={form.currency} />
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Presupuesto adicional */}
      <div id="budget-additional">
        <SectionHeader label="Tabla adicional" open={open.budgetAdditional} onToggle={() => toggle('budgetAdditional')} optional />
        <CollapsibleSection open={open.budgetAdditional}>
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setNested('budgetTableAdditional', 'enabled', !form.budgetTableAdditional.enabled)}
              className="flex items-center gap-3 group"
            >
              <span className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${form.budgetTableAdditional.enabled ? 'bg-ink border-ink' : 'bg-transparent border-line group-hover:border-ink-60'}`}>
                {form.budgetTableAdditional.enabled && <Check size={10} strokeWidth={2.5} className="text-paper" />}
              </span>
              <span className="text-sm text-ink">Incluir tabla adicional</span>
            </button>
            {form.budgetTableAdditional.enabled && (
              <>
                <div>
                  <label className={FIELD_LABEL}>Título de la tabla adicional</label>
                  <input className={INPUT} value={form.budgetTableAdditional.label} onChange={(e) => setNested('budgetTableAdditional', 'label', e.target.value)} placeholder="Ej: Servicios adicionales" />
                </div>
                <BudgetTable
                  value={{ items: form.budgetTableAdditional.items, subtotal: form.budgetTableAdditional.subtotal, taxRate: 0, total: form.budgetTableAdditional.total }}
                  onChange={(v) => set('budgetTableAdditional', { ...form.budgetTableAdditional, items: v.items, subtotal: v.subtotal, total: v.total })}
                  currency={form.currency}
                  showTax={false}
                />
              </>
            )}
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Condiciones de aceptación */}
      <div id="acceptance">
        <SectionHeader label="Condiciones de aceptación" open={open.acceptance} onToggle={() => toggle('acceptance')} saveStatus={saveStatus} aiTouched={aiTouched.has('acceptance')} />
        <CollapsibleSection open={open.acceptance}>
          <div className="space-y-6">
            {([
              ['paymentTerms', 'Forma de pago'],
              ['acceptanceCriteria', 'Criterios de aceptación'],
              ['clientResponsibilities', 'Responsabilidades del cliente'],
              ['penaltyClause', 'Cláusula de penalización'],
              ['annexes', 'Archivos o información anexa'],
              ['dataProtection', 'Aceptación de tratamiento de datos personales'],
            ] as [keyof QuoteFormData['acceptanceConditions'], string][]).map(([key, label]) => (
              <div key={key}>
                <label className={FIELD_LABEL}>{label}</label>
                <RichTextEditor value={form.acceptanceConditions[key]} onChange={(v) => setAcceptance(key, v)} placeholder={`${label}...`} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Condiciones de facturación */}
      <div id="billing">
        <SectionHeader label="Condiciones de facturación y pagos" open={open.billing} onToggle={() => toggle('billing')} saveStatus={saveStatus} aiTouched={aiTouched.has('billing')} />
        <CollapsibleSection open={open.billing}>
          <div className="space-y-4">
            {(form.billingMilestones ?? []).map((milestone, i) => {
              const subtotal = form.budgetTable.subtotal || 0
              const amount = subtotal > 0 ? (subtotal * milestone.percentage / 100) : null
              const currency = form.currency || 'EUR'
              const formatted = amount != null
                ? new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
                : null

              function updateMilestone<K extends keyof typeof milestone>(key: K, value: typeof milestone[K]) {
                const updated = (form.billingMilestones ?? []).map((m, idx) => idx === i ? { ...m, [key]: value } : m)
                set('billingMilestones', updated)
              }

              return (
                <div key={milestone.id} className="border border-line rounded-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-40 uppercase tracking-widest">Pago {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => set('billingMilestones', (form.billingMilestones ?? []).filter((_, idx) => idx !== i))}
                      className="text-ink-40 hover:text-[#DC2626] transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className={FIELD_LABEL}>Nombre</label>
                      <input
                        className={INPUT}
                        value={milestone.label}
                        onChange={(e) => updateMilestone('label', e.target.value)}
                        placeholder="Pago inicial…"
                      />
                    </div>
                    <div className="w-36">
                      <label className={FIELD_LABEL}>% de pago</label>
                      <div className="relative">
                        <input
                          className={INPUT + ' pr-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'}
                          type="number"
                          min={0}
                          max={100}
                          value={milestone.percentage}
                          onChange={(e) => updateMilestone('percentage', Number(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-40 text-sm pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                  {formatted && (
                    <p className="text-xs text-ink-40">
                      Importe: <span className="text-ink font-medium">{formatted}</span> <span className="text-ink-40">(IVA no incluido)</span>
                    </p>
                  )}
                  <div>
                    <label className={FIELD_LABEL}>Condiciones de pago</label>
                    <textarea
                      className={INPUT + ' resize-none'}
                      rows={2}
                      value={milestone.description}
                      onChange={(e) => updateMilestone('description', e.target.value)}
                      placeholder="La forma de pago será a la recepción de la factura…"
                    />
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => set('billingMilestones', [
                ...(form.billingMilestones ?? []),
                { id: Math.random().toString(36).slice(2, 10), label: '', percentage: 0, description: '' },
              ])}
              className="flex items-center gap-2 text-sm text-ink-60 hover:text-ink transition-colors"
            >
              <Plus size={14} strokeWidth={2} /> Añadir hito
            </button>
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Conformidad */}
      <div id="conformity">
        <SectionHeader label="Conformidad y firmas" open={open.conformity} onToggle={() => toggle('conformity')} saveStatus={saveStatus} aiTouched={aiTouched.has('conformity')} />
        <CollapsibleSection open={open.conformity}>
          <div className="space-y-6">
            <p className="text-xs text-ink-60 leading-relaxed">
              La firma del presente documento se interpreta como la conformidad y la aceptación de todas las condiciones expuestas en él y el cumplimiento de las mismas.
            </p>
            <div className="grid grid-cols-2 gap-8">
              {/* Cliente */}
              {([
                { side: 'Cliente', rows: [
                  { label: 'Empresa',          section: 'client'  as const, field: 'company'   as const, ph: 'Empresa del cliente' },
                  { label: 'CIF',              section: 'client'  as const, field: 'taxId'     as const, ph: 'A12345678' },
                  { label: 'Dirección',        section: 'client'  as const, field: 'address'   as const, ph: 'Calle, número, CP', multiline: true },
                  { label: 'Ciudad',           section: 'client'  as const, field: 'city'      as const, ph: 'Ciudad' },
                  { label: 'Representada por', section: 'client'  as const, field: 'name'      as const, ph: 'Nombre Apellido' },
                  { label: 'Cargo',            section: 'client'  as const, field: 'role'      as const, ph: 'Ej: CEO, Director…' },
                ]},
                { side: 'Proveedor', rows: [
                  { label: 'Empresa',          section: 'emitter' as const, field: 'companyName'        as const, ph: 'Nombre S.L.' },
                  { label: 'CIF',              section: 'emitter' as const, field: 'taxId'              as const, ph: 'B12345678' },
                  { label: 'Dirección',        section: 'emitter' as const, field: 'address'            as const, ph: 'Calle, número, CP', multiline: true },
                  { label: 'Ciudad',           section: 'emitter' as const, field: 'city'               as const, ph: 'Ciudad' },
                  { label: 'Representada por', section: 'emitter' as const, field: 'representativeName' as const, ph: 'Nombre Apellido' },
                  { label: 'Cargo',            section: 'emitter' as const, field: 'representativeRole' as const, ph: 'Ej: Fundador, CEO…' },
                ]},
              ]).map(({ side, rows }) => (
                <div key={side}>
                  <p className="text-[10px] font-medium tracking-widest uppercase text-ink-40 mb-4">{side}</p>
                  <div className="space-y-3">
                    {rows.map(({ label, section, field, ph, multiline }) => {
                      const cls = 'flex-1 bg-transparent border-0 border-b border-transparent hover:border-line focus:border-ink-40 focus:outline-none px-0 py-0.5 text-sm text-ink placeholder-ink-40 transition-colors w-full'
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const val = ((form[section] as any)[field] as string) || ''
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNested(section, field as any, e.target.value)
                      return (
                        <div key={field} className={`flex gap-3 ${multiline ? 'items-start' : 'items-center'}`}>
                          <span className={`text-xs text-ink-40 w-28 shrink-0 ${multiline ? 'pt-1' : ''}`}>{label}</span>
                          {multiline
                            ? <textarea className={cls + ' resize-none leading-snug'} rows={2} value={val} onChange={onChange} placeholder={ph} />
                            : <input   className={cls}                                value={val} onChange={onChange} placeholder={ph} />
                          }
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-6 pt-3 border-t border-line">
                    <p className="text-xs text-ink-40">Firma</p>
                  </div>
                </div>
              ))}
            </div>
            {(!form.emitter.representativeName || !form.emitter.representativeRole) && (
              <p className="text-xs text-ink-40">
                Configura "Representada por" y "Cargo" del proveedor en{' '}
                <a href="/settings" className="underline hover:text-ink transition-colors">Configuración</a>.
              </p>
            )}
          </div>
        </CollapsibleSection>
      </div>

      <hr className="border-t border-line" />

      {/* Bottom spacer */}
      <div className="h-10" />

      {/* AI Assistant modal */}
      {aiSection && (
        <AIAssistant
          section={aiSection}
          form={form}
          onApply={handleAIApply}
          onClose={() => setAiSection(null)}
        />
      )}

      {/* Fixed toast */}
      {saveStatus !== 'idle' && saveStatus !== 'pending' && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 bg-paper border border-line rounded-md shadow-sm text-xs text-ink-40 transition-opacity">
          {saveStatus === 'saving' && (
            <>
              <span className="w-2.5 h-2.5 border border-ink-40 border-t-transparent rounded-full animate-spin shrink-0" />
              Guardando…
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check size={11} strokeWidth={2.5} />
              Guardado
            </>
          )}
          {saveStatus === 'error' && (
            <span style={{ color: 'var(--color-error, #dc2626)' }}>Error al guardar</span>
          )}
        </div>
      )}
    </div>
  )
}
