'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getPlanning, savePlanning } from '@/lib/firestore/planning'
import { InteractiveGantt, EditableGantt } from '@/components/quote/GanttTimeline'
import type { TimelineEntry } from '@/types/quote'
import { Check } from 'lucide-react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

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
      setEntries(await getPlanning(cid))
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
      <p className="text-sm text-ink-40 mb-10">
        Organización interna: qué hay que hacer, de qué proyecto y cuándo. Lo terminado, se borra.
      </p>

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
