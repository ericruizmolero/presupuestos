'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getBoard, saveBoard, BOARD_COLORS, DEFAULT_LANES, type Board } from '@/lib/firestore/planning'
import { Check, Plus, X, Trash2 } from 'lucide-react'

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
  const [board, setBoard] = useState<Board>({ lanes: [...DEFAULT_LANES], groups: [], chips: [] })
  const [newLane, setNewLane] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [newGroup, setNewGroup] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null)
  const isFirstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      setBoard(await getBoard(cid))
      setLoading(false)
    })
  }, [user])

  // Auto-save con debounce
  useEffect(() => {
    if (loading) return
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (!companyId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (clearTimer.current) clearTimeout(clearTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await saveBoard(companyId, board)
        setSaveStatus('saved')
        clearTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
      } catch (err) {
        console.error('[proyectos] Error al guardar:', err)
        setSaveStatus('error')
      }
    }, 1200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board])

  function addGroup() {
    const name = newGroup.trim()
    if (!name || board.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) return
    const color = BOARD_COLORS[board.groups.length % BOARD_COLORS.length]
    setBoard((b) => ({ ...b, groups: [...b.groups, { name, color, status: b.lanes[0] }] }))
    setNewGroup('')
  }

  function cycleColor(name: string) {
    setBoard((b) => ({
      ...b,
      groups: b.groups.map((g) => {
        if (g.name !== name) return g
        const idx = BOARD_COLORS.indexOf(g.color)
        return { ...g, color: BOARD_COLORS[(idx + 1) % BOARD_COLORS.length] }
      }),
    }))
  }

  function setGroupStatus(name: string, status: string) {
    setBoard((b) => ({
      ...b,
      groups: b.groups.map((g) => (g.name === name ? { ...g, status } : g)),
    }))
  }

  function renameLane(oldName: string, newName: string) {
    setBoard((b) => ({
      ...b,
      lanes: b.lanes.map((l) => (l === oldName ? newName : l)),
      groups: b.groups.map((g) => (g.status === oldName ? { ...g, status: newName } : g)),
    }))
  }

  function addLane() {
    const name = newLane.trim()
    if (!name || board.lanes.some((l) => l.toLowerCase() === name.toLowerCase())) return
    setBoard((b) => ({ ...b, lanes: [...b.lanes, name] }))
    setNewLane('')
  }

  function deleteLane(name: string) {
    setBoard((b) => {
      if (b.lanes.length <= 1) return b
      const rest = b.lanes.filter((l) => l !== name)
      return {
        ...b,
        lanes: rest,
        groups: b.groups.map((g) => (g.status === name ? { ...g, status: rest[0] } : g)),
      }
    })
  }

  function deleteGroup(name: string) {
    setBoard((b) => ({
      ...b,
      groups: b.groups.filter((g) => g.name !== name),
      chips: b.chips.filter((c) => c.group !== name),
    }))
    setConfirmDeleteGroup(null)
  }

  function addChip(group: string) {
    const text = (drafts[group] || '').trim()
    if (!text) return
    setBoard((b) => ({ ...b, chips: [...b.chips, { group, text }] }))
    setDrafts((d) => ({ ...d, [group]: '' }))
  }

  function removeChip(group: string, index: number) {
    setBoard((b) => {
      let seen = -1
      return {
        ...b,
        chips: b.chips.filter((c) => {
          if (c.group !== group) return true
          seen++
          return seen !== index
        }),
      }
    })
  }

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
        Post-its por proyecto: apunta, tacha y fuera. El punto de color cambia el color del proyecto.
      </p>

      {/* Nuevo proyecto */}
      <div className="flex items-center gap-3 mb-10">
        <input
          className="flex-1 max-w-xs px-4 py-3 border border-input rounded-md text-base text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors"
          placeholder="Nuevo proyecto (Kymatio, Interno…)"
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGroup()}
        />
        <button
          onClick={addGroup}
          disabled={!newGroup.trim()}
          className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} strokeWidth={2} />
          Añadir
        </button>
      </div>

      {board.groups.length === 0 ? (
        <p className="text-sm text-ink-40 text-center py-6 border border-line rounded-md">
          Crea un proyecto y empieza a soltar post-its
        </p>
      ) : (
        <div className="space-y-12">
          {board.lanes.map((lane, li) => {
            const laneGroups = board.groups.filter((g) => (g.status ?? board.lanes[0]) === lane)
            return (
              <section key={li}>
                <div className="flex items-center gap-2 mb-5 group/lane">
                  <input
                    className={`text-[10px] font-medium tracking-[0.18em] uppercase bg-transparent outline-none w-48 ${li === 0 ? 'text-ink' : 'text-ink-40'} focus:text-ink transition-colors`}
                    value={lane}
                    onChange={(e) => renameLane(lane, e.target.value)}
                    title="Renombrar carril"
                  />
                  {laneGroups.length === 0 && board.lanes.length > 1 && (
                    <button
                      onClick={() => deleteLane(lane)}
                      className="opacity-0 group-hover/lane:opacity-100 text-ink-40 hover:text-[#DC2626] transition-all"
                      title="Eliminar carril"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                {laneGroups.length === 0 && (
                  <p className="text-xs text-ink-40 -mt-2">Sin proyectos</p>
                )}
                <div className="space-y-8">
                  {laneGroups.map((g) => {
            const chips = board.chips.filter((c) => c.group === g.name)
            return (
              <div key={g.name}>
                {/* Group header */}
                <div className="flex items-center gap-2.5 mb-3 group/header">
                  <button
                    onClick={() => cycleColor(g.name)}
                    title="Cambiar color"
                    className="w-3.5 h-3.5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                    style={{ background: g.color }}
                  />
                  <h2 className="text-sm font-medium text-ink">{g.name}</h2>
                  <span className="text-xs text-ink-40">{chips.length}</span>
                  <span className="flex items-center border border-line rounded-md overflow-hidden ml-1">
                    {board.lanes.map((l) => {
                      const isActive = (g.status ?? board.lanes[0]) === l
                      return (
                        <button
                          key={l}
                          onClick={() => setGroupStatus(g.name, l)}
                          className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                            isActive ? 'bg-accent text-on-accent' : 'text-ink-40 hover:bg-surface-hover hover:text-ink-60'
                          }`}
                        >
                          {l}
                        </button>
                      )
                    })}
                  </span>
                  {confirmDeleteGroup === g.name ? (
                    <span className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => deleteGroup(g.name)}
                        className="px-2 py-0.5 text-xs font-medium bg-[#DC2626] text-white rounded hover:bg-[#B91C1C] transition-colors"
                      >
                        Eliminar
                      </button>
                      <button onClick={() => setConfirmDeleteGroup(null)} className="text-xs text-ink-60 hover:text-ink">
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteGroup(g.name)}
                      className="opacity-0 group-hover/header:opacity-100 text-ink-40 hover:text-[#DC2626] transition-all"
                      title="Eliminar proyecto"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  )}
                </div>

                {/* Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  {chips.map((c, i) => (
                    <span
                      key={`${c.text}-${i}`}
                      className="group/chip inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-md text-sm text-ink border border-black/[0.06]"
                      style={{ background: g.color }}
                    >
                      {c.text}
                      <button
                        onClick={() => removeChip(g.name, i)}
                        className="opacity-40 group-hover/chip:opacity-100 hover:!opacity-100 transition-opacity"
                        title="Quitar"
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="px-3 py-1.5 text-sm border border-dashed border-line rounded-md bg-transparent text-ink placeholder-ink-40 focus:outline-none focus:border-input transition-colors w-44"
                    placeholder="Añadir…"
                    value={drafts[g.name] || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [g.name]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addChip(g.name)}
                  />
                </div>
              </div>
                  )})}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Nuevo carril */}
      <div className="mt-12 pt-6 border-t border-line flex items-center gap-2">
        <input
          className="px-3 py-1.5 text-xs border border-dashed border-line rounded-md bg-transparent text-ink placeholder-ink-40 focus:outline-none focus:border-input transition-colors w-44 uppercase tracking-wider"
          placeholder="Nuevo carril…"
          value={newLane}
          onChange={(e) => setNewLane(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addLane()}
        />
        <button
          onClick={addLane}
          disabled={!newLane.trim()}
          className="text-ink-40 hover:text-ink transition-colors disabled:opacity-40"
          title="Añadir carril"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
