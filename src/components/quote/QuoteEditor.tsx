'use client'

import { useState } from 'react'
import { RichTextEditor } from './RichTextEditor'
import { BudgetTable } from './BudgetTable'
import type { Quote, QuoteFormData, ProjectPhase } from '@/types/quote'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { IconPicker } from '@/components/ui/IconPicker'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { EditableGantt } from './GanttTimeline'
import { nanoid } from 'nanoid'

interface Props {
  initialData: QuoteFormData
  companyData?: Partial<Quote['emitter']> & { defaultConditions?: Quote['acceptanceConditions'] }
  onSave: (data: QuoteFormData) => Promise<void>
  saving?: boolean
}

const SECTION = 'mb-10'
const SECTION_LABEL = 'text-xs font-medium tracking-widest uppercase text-ink-40 mb-6 flex items-center justify-between'
const FIELD_LABEL = 'block text-sm font-medium text-ink mb-2'
const INPUT = 'w-full px-4 py-3 border border-input rounded-md text-base text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'
const GRID2 = 'grid grid-cols-1 sm:grid-cols-2 gap-6'

function SectionHeader({ label, open, onToggle, optional }: { label: string; open: boolean; onToggle: () => void; optional?: boolean }) {
  return (
    <button type="button" onClick={onToggle} className={SECTION_LABEL + ' w-full text-left cursor-pointer hover:text-ink-60'}>
      <span>{label}{optional && <span className="ml-2 text-ink-40 normal-case font-normal tracking-normal text-xs">(opcional)</span>}</span>
      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  )
}

export function QuoteEditor({ initialData, onSave, saving }: Props) {
  const [form, setForm] = useState<QuoteFormData>(initialData)
  const [open, setOpen] = useState<Record<string, boolean>>({
    meta: true, emitter: false, client: false,
    project: false, phases: false, timeline: false,
    budget: false, budgetAdditional: false,
    acceptance: false, billing: false, conformity: false,
  })

  function toggle(key: string) {
    setOpen((o) => ({ ...o, [key]: !o[key] }))
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-8 py-12">

      {/* Meta */}
      <div className={SECTION}>
        <SectionHeader label="Datos del presupuesto" open={open.meta} onToggle={() => toggle('meta')} />
        {open.meta && (
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
                <label className={FIELD_LABEL}>Fecha</label>
                <DatePicker className={INPUT} value={form.date} onChange={(v) => set('date', v)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Válido hasta</label>
                <DatePicker className={INPUT} value={form.validUntil} onChange={(v) => set('validUntil', v)} />
              </div>
            </div>
          </div>
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Empresa emisora */}
      <div className={SECTION}>
        <SectionHeader label="Empresa emisora" open={open.emitter} onToggle={() => toggle('emitter')} />
        {open.emitter && (
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
                <input className={INPUT} value={form.emitter.address} onChange={(e) => setNested('emitter', 'address', e.target.value)} placeholder="Calle, número, ciudad" />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Descripción de la empresa</label>
              <RichTextEditor value={form.emitter.description} onChange={(v) => setNested('emitter', 'description', v)} placeholder="Descripción de tu empresa..." minHeight="80px" />
            </div>
          </div>
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Cliente */}
      <div className={SECTION}>
        <SectionHeader label="Empresa receptora / Cliente" open={open.client} onToggle={() => toggle('client')} />
        {open.client && (
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
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Dirección</label>
                <input className={INPUT} value={form.client.address} onChange={(e) => setNested('client', 'address', e.target.value)} placeholder="Dirección del cliente" />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Descripción de la empresa receptora</label>
              <RichTextEditor value={form.client.description} onChange={(v) => setNested('client', 'description', v)} placeholder="Contexto del cliente..." minHeight="80px" />
            </div>
          </div>
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Proyecto */}
      <div className={SECTION}>
        <SectionHeader label="Proyecto" open={open.project} onToggle={() => toggle('project')} />
        {open.project && (
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
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Fases */}
      <div className={SECTION}>
        <SectionHeader label="Fases" open={open.phases} onToggle={() => toggle('phases')} />
        {open.phases && (
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
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Tareas y tiempos */}
      <div className={SECTION}>
        <SectionHeader label="Tareas y tiempos" open={open.timeline} onToggle={() => toggle('timeline')} />
        {open.timeline && (
          <EditableGantt
            entries={form.timeline}
            phases={form.project.phases}
            onChange={(v) => set('timeline', v)}
          />
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Presupuesto principal */}
      <div className={SECTION}>
        <SectionHeader label="Tabla de presupuesto" open={open.budget} onToggle={() => toggle('budget')} />
        {open.budget && (
          <BudgetTable value={form.budgetTable} onChange={(v) => set('budgetTable', v)} currency={form.currency} />
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Presupuesto adicional */}
      <div className={SECTION}>
        <SectionHeader label="Tabla adicional" open={open.budgetAdditional} onToggle={() => toggle('budgetAdditional')} optional />
        {open.budgetAdditional && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="additionalEnabled"
                checked={form.budgetTableAdditional.enabled}
                onChange={(e) => setNested('budgetTableAdditional', 'enabled', e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <label htmlFor="additionalEnabled" className="text-sm text-ink">Incluir tabla adicional</label>
            </div>
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
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Condiciones de aceptación */}
      <div className={SECTION}>
        <SectionHeader label="Condiciones de aceptación" open={open.acceptance} onToggle={() => toggle('acceptance')} />
        {open.acceptance && (
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
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Condiciones de facturación */}
      <div className={SECTION}>
        <SectionHeader label="Condiciones de facturación y pagos" open={open.billing} onToggle={() => toggle('billing')} />
        {open.billing && (
          <RichTextEditor value={form.billingConditions} onChange={(v) => set('billingConditions', v)} placeholder="Detalle de los pagos, plazos, facturación..." minHeight="100px" />
        )}
      </div>

      <hr className="border-t border-line mb-10" />

      {/* Conformidad */}
      <div className={SECTION}>
        <SectionHeader label="Conformidad y firmas" open={open.conformity} onToggle={() => toggle('conformity')} />
        {open.conformity && (
          <div className="space-y-6">
            <div>
              <label className={FIELD_LABEL}>Datos empresa emisora (para firma)</label>
              <RichTextEditor value={form.conformity.emitterData} onChange={(v) => setNested('conformity', 'emitterData', v)} placeholder="Nombre, cargo, empresa..." minHeight="60px" />
            </div>
            <div>
              <label className={FIELD_LABEL}>Datos empresa receptora (para firma)</label>
              <RichTextEditor value={form.conformity.clientData} onChange={(v) => setNested('conformity', 'clientData', v)} placeholder="Nombre, cargo, empresa del cliente..." minHeight="60px" />
            </div>
            <p className="text-xs text-ink-40">Integración con DocuSign disponible próximamente.</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-paper border-t border-line py-4 flex justify-end gap-3 -mx-8 px-8">
        <button
          type="submit"
          disabled={saving}
          className="text-sm font-medium px-6 py-2.5 rounded-md hover:-translate-y-px transition-all disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-accent text-on-accent hover:bg-accent-hover"
        >
          {saving ? 'Guardando...' : 'Guardar presupuesto'}
        </button>
      </div>
    </form>
  )
}
