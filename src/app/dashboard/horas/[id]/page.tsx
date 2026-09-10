'use client'

import { useEffect, useMemo, useState } from 'react'
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

function formatHours(h: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(h) + ' h'
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

/** "Eric Ruiz" → "Eric"; fallback: capitalized email prefix */
function defaultPerson(displayName?: string | null, email?: string | null) {
  const first = (displayName || '').trim().split(/\s+/)[0]
  if (first) return first
  const prefix = (email || '').split('@')[0]
  if (!prefix) return ''
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

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
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)

  // Inline entry editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editHours, setEditHours] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (!user) return
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

  const totals = useMemo(() => {
    const byPerson = new Map<string, number>()
    let total = 0
    for (const e of entries) {
      total += e.hours || 0
      byPerson.set(e.person, (byPerson.get(e.person) || 0) + (e.hours || 0))
    }
    return { total, byPerson: [...byPerson.entries()].sort((a, b) => b[1] - a[1]) }
  }, [entries])

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
    const person = defaultPerson(user?.displayName, user?.email)
    if (!user || !companyId || !project || !h || h <= 0 || !person || savingEntry) return
    setSavingEntry(true)
    try {
      const data = {
        projectId: project.id,
        person,
        date,
        hours: h,
        description: description.trim(),
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
    setEditHours(String(e.hours).replace('.', ','))
    setEditDescription(e.description || '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit() {
    if (!editingId || savingEdit) return
    const h = parseFloat(editHours.replace(',', '.'))
    if (!h || h <= 0 || !editDate) return
    setSavingEdit(true)
    try {
      const patch = { date: editDate, hours: h, description: editDescription.trim() }
      await updateTimeEntry(editingId, patch)
      setEntries((es) => es.map((e) => e.id === editingId ? { ...e, ...patch } : e)
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

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-medium tracking-tight text-ink">{project.name}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={copyPublicLink}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-line rounded-md hover:border-input transition-colors text-ink"
          >
            {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.5} />}
            {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
          <a
            href={`/h/${project.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-line rounded-md hover:border-input transition-colors text-ink"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
            Vista cliente
          </a>
        </div>
      </div>
      <p className="text-sm text-ink-40 mb-10 uppercase text-xs tracking-widest">
        Vista cliente en {project.language === 'en' ? 'inglés' : 'castellano'}
      </p>

      {/* New entry: fecha + concepto + horas */}
      <div className="grid grid-cols-2 sm:grid-cols-[10rem_1fr_6rem_auto] gap-3 items-end mb-10">
        <div>
          <label className={FIELD_LABEL}>Fecha</label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={FIELD_LABEL}>Concepto</label>
          <input
            className={INPUT} value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
            placeholder="Diseño de la home"
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Horas</label>
          <input
            className={INPUT} value={hours} inputMode="decimal"
            onChange={(e) => setHours(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
            placeholder="2,5"
          />
        </div>
        <button
          onClick={handleAddEntry}
          disabled={savingEntry || !parseFloat(hours.replace(',', '.'))}
          className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} strokeWidth={2} />
          Añadir
        </button>
      </div>

      {/* Totals + rate */}
      <div className="flex items-center gap-6 mb-6">
        <p className={SECTION_LABEL}>Registro</p>
        <div className="ml-auto flex items-center gap-4 text-sm text-ink-60">
          <span className="flex items-center gap-1.5">
            Tarifa
            <input
              className="w-20 px-2 py-1 border border-input rounded-md text-sm text-right text-ink focus:outline-none focus:border-accent transition-colors"
              value={rateInput}
              inputMode="decimal"
              onChange={(e) => setRateInput(e.target.value)}
              onBlur={handleRateBlur}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder="—"
            />
            €/h
          </span>
          {totals.byPerson.length > 1 && totals.byPerson.map(([name, h]) => (
            <span key={name}>{name}: <span className="text-ink font-medium">{formatHours(h)}</span></span>
          ))}
          <span className="text-ink font-medium">Total: {formatHours(totals.total)}</span>
          {project.hourlyRate ? (
            <span className="text-ink font-medium">{formatMoney(totals.total * project.hourlyRate)}</span>
          ) : null}
        </div>
      </div>

      {/* Entries table */}
      {entries.length === 0 ? (
        <p className="text-sm text-ink-40 text-center py-6 border border-line rounded-md">
          Aún no hay horas registradas en este proyecto
        </p>
      ) : (
        <div className="border border-line rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-widest uppercase text-ink-60 border-b border-line">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Persona</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium text-right">Horas</th>
                <th className="px-2 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const zebra = i % 2 === 1 ? 'bg-surface' : 'bg-paper'
                if (editingId === e.id) {
                  const EDIT_INPUT = 'w-full px-2 py-1.5 border border-input rounded-md text-sm text-ink focus:outline-none focus:border-accent transition-colors'
                  return (
                    <tr key={e.id} className={`border-b border-line last:border-b-0 ${zebra}`}>
                      <td className="px-2 py-2 whitespace-nowrap w-36">
                        <DatePicker value={editDate} onChange={setEditDate} />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-ink-60">{e.person}</td>
                      <td className="px-2 py-2">
                        <input
                          className={EDIT_INPUT}
                          value={editDescription}
                          onChange={(ev) => setEditDescription(ev.target.value)}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') handleSaveEdit(); if (ev.key === 'Escape') cancelEdit() }}
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
                            disabled={savingEdit || !parseFloat(editHours.replace(',', '.'))}
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
