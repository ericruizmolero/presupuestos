'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getQuotes } from '@/lib/firestore/quotes'
import { getTimeProjects, createTimeProject, getTimeEntriesByCompany } from '@/lib/firestore/time'
import type { TimeProject } from '@/types/time'
import { Select } from '@/components/ui/Select'
import { Plus, X, ChevronRight } from 'lucide-react'

const INPUT = 'w-full px-4 py-3 border border-input rounded-md text-base text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'
const FIELD_LABEL = 'block text-sm font-medium text-ink mb-2'

const OTHER = '__other__'

function formatHours(h: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(h) + ' h'
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

/** Per-client metadata pulled from their quotes: language of the latest
 *  quote (the "contract") and the hourly rate of the latest hourly quote. */
interface ClientMeta { language: 'es' | 'en'; hourlyRate?: number }

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
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [projects, setProjects] = useState<TimeProject[]>([])
  const [hoursByProject, setHoursByProject] = useState<Map<string, number>>(new Map())
  const [clientMeta, setClientMeta] = useState<Map<string, ClientMeta>>(new Map())
  const [clientOptions, setClientOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // New project form
  const [creating, setCreating] = useState(false)
  const [selectedClient, setSelectedClient] = useState('')
  const [customClient, setCustomClient] = useState('')
  const [savingProject, setSavingProject] = useState(false)

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      const [ps, quotes, entries] = await Promise.all([
        getTimeProjects(cid),
        getQuotes(cid),
        getTimeEntriesByCompany(cid),
      ])
      setProjects(ps)

      const sums = new Map<string, number>()
      for (const e of entries) {
        sums.set(e.projectId, (sums.get(e.projectId) || 0) + (e.hours || 0))
      }
      setHoursByProject(sums)

      // quotes come newest-first from getQuotes
      const meta = new Map<string, ClientMeta>()
      for (const q of quotes) {
        const name = q.client?.company || q.client?.name || ''
        if (!name) continue
        const m = meta.get(name) ?? { language: (q.language === 'en' ? 'en' : 'es') as 'es' | 'en' }
        if (m.hourlyRate === undefined && q.budgetTable?.mode === 'hourly' && q.budgetTable.hourlyRate) {
          m.hourlyRate = q.budgetTable.hourlyRate
        }
        meta.set(name, m)
      }
      setClientMeta(meta)

      const clients = [...meta.keys()].sort((a, b) => a.localeCompare(b))
      setClientOptions(clients)
      setSelectedClient(clients[0] ?? OTHER)
      if (ps.length === 0) setCreating(true)
      setLoading(false)
    })
  }, [user])

  const newProjectClient = selectedClient === OTHER ? customClient.trim() : selectedClient

  async function handleCreateProject() {
    if (!user || !companyId || !newProjectClient || savingProject) return
    setSavingProject(true)
    try {
      const meta = clientMeta.get(newProjectClient)
      const p = await createTimeProject(
        {
          name: newProjectClient,
          clientName: newProjectClient,
          companyName: company?.name || '',
          logoUrl: company?.logoUrl || '',
          language: meta?.language ?? 'es',
          hourlyRate: meta?.hourlyRate,
        },
        user.uid, companyId
      )
      router.push(`/dashboard/horas/${p.id}`)
    } catch (err) {
      console.error('[horas] Error creando proyecto:', err)
      setSavingProject(false)
    }
  }

  const rows = useMemo(
    () => projects.map((p) => ({ project: p, total: hoursByProject.get(p.id) || 0 })),
    [projects, hoursByProject]
  )

  if (loading) {
    return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>
  }

  return (
    <div className="px-8 py-12 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Horas</h1>
        <button
          onClick={() => setCreating((c) => !c)}
          className={creating
            ? 'flex items-center gap-1.5 px-4 py-2 text-sm border border-line rounded-md hover:border-input transition-colors text-ink-60 hover:text-ink'
            : 'flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors'}
        >
          {creating ? <X size={14} strokeWidth={1.5} /> : <Plus size={14} strokeWidth={2} />}
          {creating ? 'Cancelar' : 'Nuevo proyecto'}
        </button>
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

      {/* Project rows */}
      {rows.length === 0 ? (
        !creating && (
          <p className="text-sm text-ink-40 text-center py-6 border border-line rounded-md">
            Aún no hay proyectos de horas
          </p>
        )
      ) : (
        <div className="border border-line rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-widest uppercase text-ink-60 border-b border-line">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Idioma</th>
                <th className="px-4 py-3 font-medium text-right">Tarifa</th>
                <th className="px-4 py-3 font-medium text-right">Horas</th>
                <th className="px-4 py-3 font-medium text-right">Importe</th>
                <th className="px-2 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project: p, total }, i) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/dashboard/horas/${p.id}`)}
                  className={`border-b border-line last:border-b-0 cursor-pointer transition-colors hover:bg-surface-hover ${i % 2 === 1 ? 'bg-surface' : 'bg-paper'}`}
                >
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 uppercase text-xs text-ink-60">{p.language ?? 'es'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink-60">
                    {p.hourlyRate ? `${formatMoney(p.hourlyRate)}/h` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-medium">{formatHours(total)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink-60">
                    {p.hourlyRate ? formatMoney(total * p.hourlyRate) : '—'}
                  </td>
                  <td className="px-2 py-3 text-ink-40"><ChevronRight size={14} strokeWidth={1.5} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
