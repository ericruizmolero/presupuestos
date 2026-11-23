'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import {
  getTimeProjectById, updateTimeProject, deleteTimeProject,
  getTimeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry,
} from '@/lib/firestore/time'
import type { TimeProject, TimeEntry } from '@/types/time'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { Plus, Trash2, ExternalLink, Copy, Check, ArrowLeft, X } from 'lucide-react'

const INPUT = 'w-full px-4 py-3 border border-input rounded-md text-base text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'
const FIELD_LABEL = 'block text-sm font-medium text-ink mb-2'
const SECTION_LABEL = 'text-xs font-medium tracking-widest uppercase text-ink-60'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthLabel(key: string) {
  const d = new Date(key + '-01T00:00:00')
  const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatHours(h: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(h) + ' h'
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

/** Nombre del proyecto editable en el sitio: clic para editar, Enter o salir guarda, Esc cancela. El slug no cambia, así el enlace del cliente sigue valiendo. */
function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const cancelled = React.useRef(false)
  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])
  if (!editing) {
    return (
      <h1
        onClick={() => { cancelled.current = false; setEditing(true) }}
        title="Clic para cambiar el nombre"
        className="text-2xl font-medium tracking-tight text-ink cursor-text rounded-md -mx-2 px-2 hover:bg-surface transition-colors"
      >
        {value}
      </h1>
    )
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => { setEditing(false); if (!cancelled.current) onSave(draft) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') { cancelled.current = true; setDraft(value); (e.target as HTMLInputElement).blur() }
      }}
      className="text-2xl font-medium tracking-tight text-ink bg-transparent outline-none border-b border-line focus:border-ink -mx-2 px-2 min-w-0 flex-1 mr-4"
    />
  )
}

const PEOPLE = ['Eric', 'Andoni', 'Eric y Andoni']
const DEFAULT_PERSON = 'Eric y Andoni'

export default function HorasProjectPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <HorasProjectContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function HorasProjectContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [project, setProject] = useState<TimeProject | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  // Rate editing
  const [rateInput, setRateInput] = useState('')

  // New entry form
  const [date, setDate] = useState(todayISO())
  const [person, setPerson] = useState('')
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [sub, setSub] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  // Filtro por subproyecto ('' = todos, '__none' = sin asignar)
  const [subFilter, setSubFilter] = useState('')

  // Inline entry editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editPerson, setEditPerson] = useState('')
  const [editHours, setEditHours] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSub, setEditSub] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (!user) return
    setPerson((p) => p || DEFAULT_PERSON)
    Promise.all([
      getUserCompanyId(user.uid),
      getTimeProjectById(id),
      getTimeEntries(id),
    ]).then(([cid, p, es]) => {
      if (!p) { router.replace('/dashboard/horas'); return }
      setCompanyId(cid)
      setProject(p)
      setRateInput(p.hourlyRate ? String(p.hourlyRate).replace('.', ',') : '')
      setEntries(es)
      setLoading(false)
    })
  }, [user, id, router])

  const subs = project?.subprojects || []
  const visible = useMemo(() => (
    !subFilter ? entries : entries.filter((e) => (subFilter === '__none' ? !e.subproject : e.subproject === subFilter))
  ), [entries, subFilter])

  // Horas por subproyecto (para el resumen y los filtros)
  const subTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) m.set(e.subproject || '__none', (m.get(e.subproject || '__none') || 0) + (e.hours || 0))
    return m
  }, [entries])

  // Entradas agrupadas por mes (más reciente primero; entries ya vienen date-desc)
  const byMonth = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>()
    for (const e of visible) {
      const key = (e.date || '').slice(0, 7)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(e)
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [visible])

  const totals = useMemo(() => {
    const byPerson = new Map<string, number>()
    let total = 0
    for (const e of visible) {
      total += e.hours || 0
      byPerson.set(e.person, (byPerson.get(e.person) || 0) + (e.hours || 0))
    }
    return { total, byPerson: [...byPerson.entries()].sort((a, b) => b[1] - a[1]) }
  }, [visible])

  async function saveSubprojects(next: string[]) {
    if (!project) return
    setProject({ ...project, subprojects: next })
    try {
      await updateTimeProject(project.id, { subprojects: next })
    } catch (err) {
      console.error('[horas] Error guardando subproyectos:', err)
    }
  }

  async function handleRename(name: string) {
    if (!project) return
    const clean = name.trim()
    if (!clean || clean === project.name) return
    const prev = project.name
    setProject({ ...project, name: clean })
    try {
      await updateTimeProject(project.id, { name: clean })
    } catch (err) {
      console.error('[horas] Error renombrando proyecto:', err)
      setProject((p) => (p ? { ...p, name: prev } : p))
    }
  }

  async function handleSetLanguage(lang: 'es' | 'en') {
    if (!project || (project.language ?? 'es') === lang) return
    setProject({ ...project, language: lang })
    try {
      await updateTimeProject(project.id, { language: lang })
    } catch (err) {
      console.error('[horas] Error cambiando idioma:', err)
    }
  }

  async function handleRateBlur() {
    if (!project) return
    const rate = parseFloat(rateInput.replace(',', '.'))
    const newRate = rate > 0 ? rate : undefined
    if (newRate === project.hourlyRate) return
    setProject({ ...project, hourlyRate: newRate })
    try {
      await updateTimeProject(project.id, { hourlyRate: newRate })
    } catch (err) {
      console.error('[horas] Error guardando tarifa:', err)
    }
  }

  async function handleAddEntry() {
    const h = parseFloat(hours.replace(',', '.'))
    if (!user || !companyId || !project || !h || h <= 0 || !person || savingEntry) return
    setSavingEntry(true)
    try {
      const data = {
        projectId: project.id,
        person,
        date,
        hours: h,
        description: description.trim(),
        ...(subs.length && (sub || subs[0]) ? { subproject: sub || subs[0] } : {}),
      }
      const entryId = await addTimeEntry(data, user.uid, companyId)
      setEntries((es) => [{ id: entryId, companyId, createdBy: user.uid, ...data }, ...es]
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')))
      setHours(''); setDescription('')
    } catch (err) {
      console.error('[horas] Error guardando entrada:', err)
    } finally {
      setSavingEntry(false)
    }
  }

  function startEdit(e: TimeEntry) {
    setEditingId(e.id)
    setEditDate(e.date)
    setEditPerson(e.person || '')
    setEditHours(String(e.hours).replace('.', ','))
    setEditDescription(e.description || '')
    setEditSub(e.subproject || '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit() {
    if (!editingId || savingEdit) return
    const h = parseFloat(editHours.replace(',', '.'))
    if (!h || h <= 0 || !editDate || !editPerson.trim()) return
    setSavingEdit(true)
    try {
      const patch = { date: editDate, person: editPerson.trim(), hours: h, description: editDescription.trim(), ...(subs.length ? { subproject: editSub } : {}) }
      await updateTimeEntry(editingId, patch)
      setEntries((es) => es.map((e) => e.id === editingId ? { ...e, ...patch, subproject: subs.length ? (editSub || undefined) : e.subproject } : e)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')))
      setEditingId(null)
    } catch (err) {
      console.error('[horas] Error editando entrada:', err)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteEntry(entryId: string) {
    try {
      await deleteTimeEntry(entryId)
      setEntries((es) => es.filter((e) => e.id !== entryId))
    } catch (err) {
      console.error('[horas] Error eliminando entrada:', err)
    }
  }

  async function handleDeleteProject() {
    if (!project) return
    try {
      await deleteTimeProject(project.id)
      router.replace('/dashboard/horas')
    } catch (err) {
      console.error('[horas] Error eliminando proyecto:', err)
      setConfirmDelete(false)
    }
  }

  function copyPublicLink() {
    if (!project) return
    navigator.clipboard.writeText(`${window.location.origin}/h/${project.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading || !project) {
    return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>
  }

  return (
    <div className="px-8 py-12 max-w-4xl">
      <Link
        href="/dashboard/horas"
        className="inline-flex items-center gap-1.5 text-sm text-ink-60 hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Horas
      </Link>

      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
        <EditableTitle value={project.name} onSave={handleRename} />
        <div className="flex items-center gap-2">
          <button
            onClick={copyPublicLink}
            className="flex items-center gap-1.5 h-9 px-3.5 text-sm border border-line rounded-md hover:border-input transition-colors text-ink"
          >
            {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.5} />}
            {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
          <a
            href={`/h/${project.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 h-9 px-3.5 text-sm border border-line rounded-md hover:border-input transition-colors text-ink"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
            Vista cliente
          </a>
        </div>
      </div>

      {/* Ajustes en una línea: idioma, tarifa y subproyectos */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 text-xs text-ink-60">
        <span className="flex items-center gap-2">
          Idioma
          <span className="flex items-center border border-line rounded-md overflow-hidden">
            {(['es', 'en'] as const).map((lang) => {
              const isActive = (project.language ?? 'es') === lang
              return (
                <button
                  key={lang}
                  onClick={() => handleSetLanguage(lang)}
                  className={`px-2 h-6 text-[11px] font-medium uppercase transition-colors ${
                    isActive ? 'bg-accent text-on-accent' : 'text-ink-60 hover:bg-surface-hover'
                  }`}
                >
                  {lang}
                </button>
              )
            })}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          Tarifa
          <input
            className="w-16 h-6 px-1.5 border border-line rounded-md text-xs text-right text-ink focus:outline-none focus:border-accent transition-colors"
            value={rateInput}
            inputMode="decimal"
            onChange={(e) => setRateInput(e.target.value)}
            onBlur={handleRateBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="0"
          />
          €/h
        </span>
        <SubprojectsEditor value={subs} onChange={saveSubprojects} />
      </div>

      {/* Apuntar horas: una barra compacta */}
      <div className="flex flex-wrap sm:flex-nowrap items-stretch rounded-lg border border-input bg-paper mb-10 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-black/[0.06] transition-colors">
        <div className="w-32 shrink-0 border-r border-line" title="Fecha">
          <DatePicker value={date} onChange={setDate} className="h-11 flex items-center pl-3.5 pr-9 text-sm" />
        </div>
        <div className="w-40 shrink-0 border-r border-line">
          <Select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Persona" className="w-full h-11 px-3.5 text-sm text-ink">
            {PEOPLE.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
        {subs.length > 0 && (
          <div className="w-36 shrink-0 border-r border-line">
            <Select value={sub || subs[0]} onChange={(e) => setSub(e.target.value)} aria-label="Subproyecto" className="w-full h-11 px-3.5 text-sm text-ink font-medium">
              {subs.map((s2) => <option key={s2} value={s2}>{s2}</option>)}
            </Select>
          </div>
        )}
        <input
          className="flex-1 min-w-[12rem] h-11 px-3.5 bg-transparent text-sm text-ink placeholder-ink-40 focus:outline-none"
          value={description}
          aria-label="Concepto"
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
          placeholder="Qué se ha hecho"
        />
        <input
          className="w-20 shrink-0 h-11 px-3 border-l border-line bg-transparent text-sm text-right text-ink placeholder-ink-40 focus:outline-none"
          value={hours}
          aria-label="Horas"
          inputMode="decimal"
          onChange={(e) => setHours(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
          placeholder="0 h"
        />
        <div className="p-1 shrink-0">
          <button
            onClick={handleAddEntry}
            disabled={savingEntry || !parseFloat(hours.replace(',', '.'))}
            className="flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} strokeWidth={2} />
            Añadir
          </button>
        </div>
      </div>

      {/* Resumen: filtros por subproyecto a la izquierda, total a la derecha */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        {subs.length > 0 && entries.length > 0 ? (
          <div className="inline-flex flex-wrap rounded-md border border-line bg-paper p-0.5 text-[13px]">
            {[['', 'Todos', entries.reduce((t, e) => t + (e.hours || 0), 0)] as const,
              ...subs.map((s2) => [s2, s2, subTotals.get(s2) || 0] as const),
              ...(subTotals.get('__none') ? [['__none', 'Sin asignar', subTotals.get('__none') || 0] as const] : []),
            ].map(([key, label, h]) => (
              <button
                key={key || 'all'}
                onClick={() => setSubFilter(key)}
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-[5px] transition-colors ${
                  subFilter === key ? 'bg-surface text-ink font-medium' : 'text-ink-60 hover:text-ink'
                } ${key === '__none' && subFilter !== key ? 'text-[#B45309]' : ''}`}
              >
                {label}
                <span className="text-[11px] tabular-nums text-ink-40 font-normal">{formatHours(h)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className={SECTION_LABEL}>Registro</p>
        )}
        <div
          className="flex items-baseline gap-3"
          title={totals.byPerson.map(([n, h]) => `${n}: ${formatHours(h)}`).join('\n')}
        >
          <span className="text-xl font-medium tracking-tight text-ink tabular-nums">{formatHours(totals.total)}</span>
          {project.hourlyRate ? (
            <span className="text-sm text-ink-60 tabular-nums">{formatMoney(totals.total * project.hourlyRate)}</span>
          ) : null}
        </div>
      </div>

      {/* Entries table */}
      {entries.length === 0 ? (
        <p className="text-sm text-ink-40 text-center py-6 border border-line rounded-md">
          Aún no hay horas registradas en este proyecto
        </p>
      ) : (
        <div className="border border-line rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-widest uppercase text-ink-60 border-b border-line">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Persona</th>
                {subs.length > 0 && <th className="px-4 py-3 font-medium">Subproyecto</th>}
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium text-right">Horas</th>
                <th className="px-2 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {byMonth.map(([month, monthEntries]) => {
                const monthTotal = monthEntries.reduce((s, e) => s + (e.hours || 0), 0)
                return (
                  <React.Fragment key={month}>
                    <tr className="bg-surface border-y border-line">
                      <td colSpan={subs.length ? 6 : 5} className="px-4 py-2">
                        <span className="flex items-baseline justify-between">
                          <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-60">
                            {monthLabel(month)}
                          </span>
                          <span className="text-xs text-ink-60 font-medium">
                            {formatHours(monthTotal)}
                            {project.hourlyRate ? (
                              <span className="text-ink-40 font-normal"> · {formatMoney(monthTotal * project.hourlyRate)}</span>
                            ) : null}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {monthEntries.map((e, i) => {
                const zebra = i % 2 === 1 ? 'bg-surface' : 'bg-paper'
                if (editingId === e.id) {
                  const EDIT_INPUT = 'w-full px-2 py-1.5 border border-input rounded-md text-sm text-ink focus:outline-none focus:border-accent transition-colors'
                  return (
                    <tr key={e.id} className={`border-b border-line last:border-b-0 ${zebra}`}>
                      <td className="px-2 py-2 whitespace-nowrap w-36">
                        <DatePicker value={editDate} onChange={setEditDate} />
                      </td>
                      <td className="px-2 py-2 w-36">
                        <Select
                          className={EDIT_INPUT}
                          value={editPerson}
                          onChange={(ev) => setEditPerson(ev.target.value)}
                          onKeyDown={(ev) => { if (ev.key === 'Escape') cancelEdit() }}
                        >
                          {!PEOPLE.includes(editPerson) && editPerson && (
                            <option value={editPerson}>{editPerson}</option>
                          )}
                          {PEOPLE.map((p) => <option key={p} value={p}>{p}</option>)}
                        </Select>
                      </td>
                      {subs.length > 0 && (
                        <td className="px-2 py-2 w-36">
                          <Select className={EDIT_INPUT} value={editSub} onChange={(ev) => setEditSub(ev.target.value)}>
                            <option value="">Sin asignar</option>
                            {subs.map((s2) => <option key={s2} value={s2}>{s2}</option>)}
                          </Select>
                        </td>
                      )}
                      <td className="px-2 py-2">
                        <textarea
                          ref={(el) => {
                            if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
                          }}
                          className={EDIT_INPUT + ' resize-none overflow-hidden leading-snug'}
                          value={editDescription}
                          rows={1}
                          onChange={(ev) => {
                            setEditDescription(ev.target.value)
                            ev.target.style.height = 'auto'
                            ev.target.style.height = ev.target.scrollHeight + 'px'
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); handleSaveEdit() }
                            if (ev.key === 'Escape') cancelEdit()
                          }}
                          autoFocus
                        />
                      </td>
                      <td className="px-2 py-2 w-24">
                        <input
                          className={EDIT_INPUT + ' text-right'}
                          value={editHours}
                          inputMode="decimal"
                          onChange={(ev) => setEditHours(ev.target.value)}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') handleSaveEdit(); if (ev.key === 'Escape') cancelEdit() }}
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingEdit || !parseFloat(editHours.replace(',', '.')) || !editPerson.trim()}
                            className="p-1.5 rounded bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-40"
                            title="Guardar"
                          >
                            <Check size={13} strokeWidth={2} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded text-ink-60 hover:bg-surface-hover transition-colors"
                            title="Cancelar"
                          >
                            <X size={13} strokeWidth={2} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr
                    key={e.id}
                    onClick={() => startEdit(e)}
                    className={`border-b border-line last:border-b-0 cursor-pointer transition-colors hover:bg-surface-hover ${zebra}`}
                    title="Editar"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-ink-60">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.person}</td>
                    {subs.length > 0 && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {e.subproject
                          ? <span className="inline-flex px-2 py-0.5 rounded border border-line bg-surface text-xs text-ink">{e.subproject}</span>
                          : <span className="text-xs text-[#B45309]">Sin asignar</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-ink-60">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatHours(e.hours)}</td>
                    <td className="px-2 py-3" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        onClick={() => handleDeleteEntry(e.id)}
                        className="text-ink-40 hover:text-[#DC2626] transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                )
                    })}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Danger zone */}
      <div className="mt-12 pt-6 border-t border-line">
        {confirmDelete ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteProject}
              className="px-3 py-1.5 text-xs font-medium bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors"
            >
              Eliminar proyecto y sus horas
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-sm text-ink-60 hover:text-ink transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-sm text-ink-40 hover:text-[#DC2626] transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.5} />
            Eliminar proyecto
          </button>
        )}
      </div>
    </div>
  )
}

/** Subproyectos del proyecto (p. ej. Farco: SurePayroll, Wisable, Farco). Se factura todo junto; las horas se separan */
function SubprojectsEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  function add() {
    const v = draft.trim()
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v])
    setDraft('')
    setAdding(false)
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5">Subproyectos</span>
      {value.map((s) => (
        <span key={s} className="group inline-flex items-center gap-0.5 h-6 pl-2 pr-1 rounded-md border border-line text-xs text-ink">
          {s}
          <button
            onClick={() => { if (confirm(`¿Quitar el subproyecto ${s}? Sus horas se quedan, sin asignar.`)) onChange(value.filter((x) => x !== s)) }}
            className="p-0.5 rounded text-ink-40 opacity-0 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
            aria-label={`Quitar ${s}`}
          >
            <X size={11} strokeWidth={2} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setDraft(''); setAdding(false) } }}
          placeholder="Wisable"
          className="h-6 w-28 px-2 rounded-md border border-input text-xs text-ink focus:outline-none focus:border-accent"
        />
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-xs text-ink-40 hover:text-ink hover:bg-surface-hover">
          <Plus size={12} strokeWidth={2} />{value.length ? 'Añadir' : 'Separar en subproyectos'}
        </button>
      )}
    </span>
  )
}
