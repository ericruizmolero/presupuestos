'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getQuotes } from '@/lib/firestore/quotes'
import {
  getTimeProjects, createTimeProject, updateTimeProject, deleteTimeProject,
  getTimeEntries, addTimeEntry, deleteTimeEntry,
} from '@/lib/firestore/time'
import type { TimeProject, TimeEntry } from '@/types/time'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { Plus, Trash2, ExternalLink, Copy, Check, X } from 'lucide-react'

const INPUT = 'w-full px-4 py-3 border border-input rounded-md text-base text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'
const FIELD_LABEL = 'block text-sm font-medium text-ink mb-2'
const SECTION_LABEL = 'text-xs font-medium tracking-widest uppercase text-ink-60'

const OTHER = '__other__'

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

/** "Eric Ruiz" → "Eric"; fallback: capitalized email prefix */
function defaultPerson(displayName?: string | null, email?: string | null) {
  const first = (displayName || '').trim().split(/\s+/)[0]
  if (first) return first
  const prefix = (email || '').split('@')[0]
  if (!prefix) return ''
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

export default function HorasPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <HorasContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function HorasContent() {
  const { user, company } = useAuth()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [projects, setProjects] = useState<TimeProject[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(false)

  // New project: pick a client and go
  const [creating, setCreating] = useState(false)
  const [clientOptions, setClientOptions] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [customClient, setCustomClient] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false)

  // New entry form: fecha + concepto + horas
  const [date, setDate] = useState(todayISO())
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      const [ps, quotes] = await Promise.all([getTimeProjects(cid), getQuotes(cid)])
      setProjects(ps)
      const clients = [...new Set(
        quotes.map((q) => q.client?.company || q.client?.name || '').filter(Boolean)
      )].sort((a, b) => a.localeCompare(b))
      setClientOptions(clients)
      setSelectedClient(clients[0] ?? OTHER)
      if (ps.length > 0) setActiveId(ps[0].id)
      else setCreating(true)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!activeId) { setEntries([]); return }
    setLoadingEntries(true)
    getTimeEntries(activeId)
      .then(setEntries)
      .finally(() => setLoadingEntries(false))
  }, [activeId])

  const active = projects.find((p) => p.id === activeId) ?? null

  const totals = useMemo(() => {
    const byPerson = new Map<string, number>()
    let total = 0
    for (const e of entries) {
      total += e.hours || 0
      byPerson.set(e.person, (byPerson.get(e.person) || 0) + (e.hours || 0))
    }
    return { total, byPerson: [...byPerson.entries()].sort((a, b) => b[1] - a[1]) }
  }, [entries])

  const newProjectClient = selectedClient === OTHER ? customClient.trim() : selectedClient

  async function handleCreateProject() {
    if (!user || !companyId || !newProjectClient || savingProject) return
    setSavingProject(true)
    try {
      const p = await createTimeProject(
        {
          name: newProjectClient,
          clientName: newProjectClient,
          companyName: company?.name || '',
          logoUrl: company?.logoUrl || '',
          language: 'es',
        },
        user.uid, companyId
      )
      setProjects((ps) => [...ps, p].sort((a, b) => a.name.localeCompare(b.name)))
      setActiveId(p.id)
      setCustomClient(''); setCreating(false)
    } catch (err) {
      console.error('[horas] Error creando proyecto:', err)
    } finally {
      setSavingProject(false)
    }
  }

  async function handleDeleteProject() {
    if (!active) return
    try {
      await deleteTimeProject(active.id)
      setProjects((ps) => {
        const rest = ps.filter((p) => p.id !== active.id)
        setActiveId(rest[0]?.id ?? null)
        return rest
      })
    } catch (err) {
      console.error('[horas] Error eliminando proyecto:', err)
    } finally {
      setConfirmDeleteProject(false)
    }
  }

  async function handleSetLanguage(lang: 'es' | 'en') {
    if (!active || active.language === lang) return
    setProjects((ps) => ps.map((p) => p.id === active.id ? { ...p, language: lang } : p))
    try {
      await updateTimeProject(active.id, { language: lang })
    } catch (err) {
      console.error('[horas] Error cambiando idioma:', err)
    }
  }

  async function handleAddEntry() {
    const h = parseFloat(hours.replace(',', '.'))
    const person = defaultPerson(user?.displayName, user?.email)
    if (!user || !companyId || !active || !h || h <= 0 || !person || savingEntry) return
    setSavingEntry(true)
    try {
      const data = {
        projectId: active.id,
        person,
        date,
        hours: h,
        description: description.trim(),
      }
      const id = await addTimeEntry(data, user.uid, companyId)
      setEntries((es) => [{ id, companyId, createdBy: user.uid, ...data }, ...es]
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')))
      setHours(''); setDescription('')
    } catch (err) {
      console.error('[horas] Error guardando entrada:', err)
    } finally {
      setSavingEntry(false)
    }
  }

  async function handleDeleteEntry(id: string) {
    try {
      await deleteTimeEntry(id)
      setEntries((es) => es.filter((e) => e.id !== id))
    } catch (err) {
      console.error('[horas] Error eliminando entrada:', err)
    }
  }

  function copyPublicLink() {
    if (!active) return
    navigator.clipboard.writeText(`${window.location.origin}/horas/${active.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>
  }

  return (
    <div className="px-8 py-12 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Horas</h1>
        {active && (
          <div className="flex items-center gap-2">
            {/* Idioma de la vista cliente */}
            <div className="flex items-center border border-line rounded-md overflow-hidden mr-2">
              {(['es', 'en'] as const).map((lang) => {
                const isActive = (active.language ?? 'es') === lang
                return (
                  <button
                    key={lang}
                    onClick={() => handleSetLanguage(lang)}
                    className={`px-3 py-2 text-xs font-medium uppercase transition-colors ${
                      isActive ? 'bg-accent text-on-accent' : 'text-ink-60 hover:bg-surface-hover'
                    }`}
                  >
                    {lang}
                  </button>
                )
              })}
            </div>
            <button
              onClick={copyPublicLink}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-line rounded-md hover:border-input transition-colors text-ink"
            >
              {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.5} />}
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
            <a
              href={`/horas/${active.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-line rounded-md hover:border-input transition-colors text-ink"
            >
              <ExternalLink size={14} strokeWidth={1.5} />
              Vista cliente
            </a>
          </div>
        )}
      </div>

      {/* Project selector */}
      <div className="flex items-end gap-3 mb-10">
        {projects.length > 0 && (
          <div className="flex-1 max-w-xs">
            <label className={FIELD_LABEL}>Proyecto</label>
            <Select value={activeId ?? ''} onChange={(e) => setActiveId(e.target.value)} className={INPUT}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        )}
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-1.5 px-4 py-3 text-sm border border-line rounded-md hover:border-input transition-colors text-ink-60 hover:text-ink"
        >
          {creating ? <X size={14} strokeWidth={1.5} /> : <Plus size={14} strokeWidth={1.5} />}
          {creating ? 'Cancelar' : 'Nuevo proyecto'}
        </button>
        {active && !creating && (
          confirmDeleteProject ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteProject}
                className="px-3 py-1.5 text-xs font-medium bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors"
              >
                Eliminar proyecto y sus horas
              </button>
              <button
                onClick={() => setConfirmDeleteProject(false)}
                className="text-sm text-ink-60 hover:text-ink transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteProject(true)}
              title="Eliminar proyecto"
              className="px-3 py-3 text-ink-40 hover:text-[#DC2626] transition-colors"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          )
        )}
      </div>

      {/* New project: pick client → create */}
      {creating && (
        <div className="flex items-end gap-3 mb-10 p-6 border border-line rounded-md bg-surface">
          <div className="flex-1 max-w-xs">
            <label className={FIELD_LABEL}>Cliente</label>
            <Select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className={INPUT}
            >
              {clientOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={OTHER}>Otro cliente…</option>
            </Select>
          </div>
          {selectedClient === OTHER && (
            <div className="flex-1 max-w-xs">
              <label className={FIELD_LABEL}>Nombre del cliente</label>
              <input
                className={INPUT}
                value={customClient}
                onChange={(e) => setCustomClient(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                placeholder="Acme S.L."
                autoFocus
              />
            </div>
          )}
          <button
            onClick={handleCreateProject}
            disabled={!newProjectClient || savingProject}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} strokeWidth={2} />
            Crear
          </button>
        </div>
      )}

      {active && (
        <>
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

          {/* Totals */}
          <div className="flex items-center gap-6 mb-6">
            <p className={SECTION_LABEL}>Registro</p>
            <div className="ml-auto flex items-center gap-4 text-sm text-ink-60">
              {totals.byPerson.length > 1 && totals.byPerson.map(([name, h]) => (
                <span key={name}>{name}: <span className="text-ink font-medium">{formatHours(h)}</span></span>
              ))}
              <span className="text-ink font-medium">Total: {formatHours(totals.total)}</span>
            </div>
          </div>

          {/* Entries table */}
          {loadingEntries ? (
            <p className="text-sm text-ink-40 py-6">Cargando horas…</p>
          ) : entries.length === 0 ? (
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
                  {entries.map((e, i) => (
                    <tr key={e.id} className={`border-b border-line last:border-b-0 ${i % 2 === 1 ? 'bg-surface' : 'bg-paper'}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-60">{formatDate(e.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{e.person}</td>
                      <td className="px-4 py-3 text-ink-60">{e.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatHours(e.hours)}</td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => handleDeleteEntry(e.id)}
                          className="text-ink-40 hover:text-[#DC2626] transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
