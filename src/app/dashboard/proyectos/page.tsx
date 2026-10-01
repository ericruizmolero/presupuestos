'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getPlanning, savePlanning } from '@/lib/firestore/planning'
import { getTimeProjects } from '@/lib/firestore/time'
import { InteractiveGantt, EditableGantt } from '@/components/quote/GanttTimeline'
import type { TimelineEntry } from '@/types/quote'
import { Select } from '@/components/ui/Select'
import { Check, Plus } from 'lucide-react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const INPUT = 'w-full px-4 py-3 border border-input rounded-md text-base text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'

function madridToday(): Date {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return new Date(iso + 'T00:00:00')
}

/** Lunes y domingo de la semana actual (Madrid), como YYYY-MM-DD */
function currentWeekRange(): { start: string; end: string } {
  const today = madridToday()
  const dow = (today.getDay() + 6) % 7 // lunes = 0
  const monday = new Date(today); monday.setDate(today.getDate() - dow)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(monday), end: fmt(sunday) }
}

export default function ProyectosPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <ProyectosContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function ProyectosContent() {
  const { user } = useAuth()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [clients, setClients] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const isFirstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      const [planning, projects] = await Promise.all([getPlanning(cid), getTimeProjects(cid)])
      setEntries(planning)
      const names = projects.map((p) => p.name).filter(Boolean).sort((a, b) => a.localeCompare(b))
      setClients(names)
      setSelectedClient(names[0] ?? '')
      setLoading(false)
    })
  }, [user])

  // Auto-save con debounce, como el editor de presupuestos
  useEffect(() => {
    if (loading) return
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (!companyId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (clearTimer.current) clearTimeout(clearTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await savePlanning(companyId, entries)
        setSaveStatus('saved')
        clearTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
      } catch (err) {
        console.error('[proyectos] Error al guardar el planning:', err)
        setSaveStatus('error')
      }
    }, 1200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries])

  const existingGroups = useMemo(
    () => [...new Set(entries.map((e) => e.group ?? ''))],
    [entries]
  )

  const availableClients = clients.filter((c) => !existingGroups.includes(c))
  const effectiveClient = availableClients.includes(selectedClient)
    ? selectedClient
    : (availableClients[0] ?? '')

  function addClientGroup() {
    const name = effectiveClient.trim()
    if (!name || existingGroups.includes(name)) return
    setEntries((es) => [...es, { phase: '', group: name, startDate: '', endDate: '' }])
  }

  // Tareas que tocan la semana actual, agrupadas por cliente
  const week = useMemo(() => {
    const { start, end } = currentWeekRange()
    const byClient = new Map<string, TimelineEntry[]>()
    let undated = 0
    for (const e of entries) {
      if (!e.phase) continue
      if (!e.startDate || !e.endDate) { undated++; continue }
      if (e.startDate <= end && e.endDate >= start) {
        const g = e.group || 'Sin cliente'
        if (!byClient.has(g)) byClient.set(g, [])
        byClient.get(g)!.push(e)
      }
    }
    return { byClient: [...byClient.entries()], undated, start, end }
  }, [entries])

  if (loading) {
    return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>
  }

  return (
    <div className="px-8 py-12 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Proyectos</h1>
        <div className="h-5">
          {saveStatus === 'saving' && (
            <span className="w-2.5 h-2.5 inline-block border border-ink-40 border-t-transparent rounded-full animate-spin" />
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[10px] text-ink-40">
              <Check size={10} strokeWidth={2.5} />
              Guardado
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-[10px]" style={{ color: '#dc2626' }}>Error al guardar</span>
          )}
        </div>
      </div>
      <p className="text-sm text-ink-40 mb-8">
        Organización interna por cliente: qué hay que hacer y cuándo. Lo terminado, se borra.
      </p>

      {/* Esta semana */}
      <div className="border border-line rounded-md p-4 bg-surface mb-8">
        <p className="text-[10px] font-medium tracking-widest uppercase text-ink-40 mb-3">Esta semana</p>
        {week.byClient.length === 0 ? (
          <p className="text-sm text-ink-40">Nada con fechas en esta semana.</p>
        ) : (
          <div className="space-y-2">
            {week.byClient.map(([client, tasks]) => (
              <div key={client} className="flex gap-3 text-sm">
                <span className="font-medium text-ink shrink-0 w-44 truncate">{client}</span>
                <span className="text-ink-60">
                  {tasks.map((t) => t.phase).join(' · ')}
                </span>
              </div>
            ))}
          </div>
        )}
        {week.undated > 0 && (
          <p className="text-xs text-ink-40 mt-3">
            {week.undated} tarea{week.undated > 1 ? 's' : ''} sin fechas — ponles fechas para verlas aquí y en el timeline.
          </p>
        )}
      </div>

      {/* Añadir cliente al planning */}
      {availableClients.length > 0 && (
        <div className="flex items-end gap-3 mb-8">
          <div className="flex-1 max-w-xs">
            <Select
              value={effectiveClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className={INPUT}
            >
              {availableClients.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <button
            onClick={addClientGroup}
            className="flex items-center gap-1.5 px-4 py-3 text-sm border border-line rounded-md hover:border-input transition-colors text-ink-60 hover:text-ink"
          >
            <Plus size={14} strokeWidth={1.5} />
            Añadir cliente al planning
          </button>
        </div>
      )}

      {entries.some((e) => e.startDate && e.endDate) && (
        <div className="border border-line rounded-md p-4 bg-surface mb-8">
          <p className="text-[10px] font-medium tracking-widest uppercase text-ink-40 mb-4">Timeline</p>
          <InteractiveGantt entries={entries} onChange={setEntries} />
        </div>
      )}

      <EditableGantt entries={entries} onChange={setEntries} />
    </div>
  )
}
