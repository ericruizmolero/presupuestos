'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import {
  getBoard, saveBoard, getBoardLastSeen, setBoardLastSeen, madridToday,
  BOARD_COLORS, DEFAULT_LANES, type Board, type BoardGroup, type BoardChip,
} from '@/lib/firestore/planning'
import { getTimeProjects, getTimeEntriesByCompany } from '@/lib/firestore/time'
import { getQuotes } from '@/lib/firestore/quotes'
import type { TimeProject, TimeEntry } from '@/types/time'
import type { Quote } from '@/types/quote'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Faces } from '@/components/studio/StudioMarks'
import { ProjectSummary } from '@/components/studio/ProjectSummary'
import { ProjectSheet } from '@/components/studio/ProjectSheet'
import { NoteList, type IndexedNote } from '@/components/studio/NoteList'
import { StudioSidebar } from '@/components/studio/StudioSidebar'
import { effectiveWho, includesMe, myName, ownerOf, type Person } from '@/components/studio/boardUtils'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type Toast = { message: string; undo?: () => void } | null

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
  const me = myName(user?.displayName, user?.email)

  // ── Datos ──────────────────────────────────────────────────────────────────
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [board, setBoard] = useState<Board>({ lanes: [...DEFAULT_LANES], groups: [], chips: [] })
  const [loading, setLoading] = useState(true)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [timeProjects, setTimeProjects] = useState<TimeProject[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [view, setView] = useState<'lista' | 'tablero'>('lista')
  const [onlyMine, setOnlyMine] = useState(false)
  const [openProject, setOpenProject] = useState<string | null>(null)
  const [addingInLane, setAddingInLane] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newLane, setNewLane] = useState('')
  const [dragChip, setDragChip] = useState<number | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  const [dragProject, setDragProject] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFirstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('proyectos-view')
      if (saved === 'tablero' || saved === 'lista') setView(saved)
    } catch { /* sin almacenamiento: vista por defecto */ }
  }, [])

  function switchView(v: 'lista' | 'tablero') {
    setView(v)
    try { window.localStorage.setItem('proyectos-view', v) } catch { /* noop */ }
  }

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      const [b, seen, tps, tes, qs] = await Promise.all([
        getBoard(cid), getBoardLastSeen(user.uid), getTimeProjects(cid), getTimeEntriesByCompany(cid), getQuotes(cid),
      ])
      setBoard(b)
      setLastSeen(seen)
      setTimeProjects(tps)
      setTimeEntries(tes)
      setQuotes(qs)
      setLoading(false)
      // marcar la visita (el feed de esta sesión usa el valor anterior)
      setBoardLastSeen(user.uid, madridToday())
    })
  }, [user])

  // Autoguardado con debounce
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

  function showToast(t: NonNullable<Toast>) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  // ── Proyectos ──────────────────────────────────────────────────────────────
  function patchGroup(name: string, patch: Partial<BoardGroup>) {
    setBoard((b) => ({ ...b, groups: b.groups.map((g) => (g.name === name ? { ...g, ...patch } : g)) }))
  }

  function clearDeadline(name: string) {
    setBoard((b) => ({
      ...b,
      groups: b.groups.map((g) => {
        if (g.name !== name) return g
        const { deadline: _d, deadlineLabel: _l, ...rest } = g
        return rest
      }),
    }))
  }

  function renameGroup(oldName: string, newName: string): boolean {
    if (board.groups.some((g) => g.name !== oldName && g.name.toLowerCase() === newName.toLowerCase())) return false
    setBoard((b) => ({
      ...b,
      groups: b.groups.map((g) => (g.name === oldName ? { ...g, name: newName } : g)),
      chips: b.chips.map((c) => (c.group === oldName ? { ...c, group: newName } : c)),
    }))
    setOpenProject((p) => (p === oldName ? newName : p))
    return true
  }

  function createProject(lane: string) {
    const name = newProjectName.trim()
    if (!name) { setAddingInLane(null); return }
    if (board.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      showToast({ message: `Ya existe un proyecto «${name}»` })
      return
    }
    const color = BOARD_COLORS[board.groups.length % BOARD_COLORS.length]
    setBoard((b) => ({ ...b, groups: [...b.groups, { name, color, status: lane }] }))
    setNewProjectName('')
    setAddingInLane(null)
    setOpenProject(name)
  }

  function deleteGroup(name: string) {
    const snapshot = board
    setBoard((b) => ({
      ...b,
      groups: b.groups.filter((g) => g.name !== name),
      chips: b.chips.filter((c) => c.group !== name),
    }))
    setOpenProject(null)
    showToast({ message: `«${name}» eliminado`, undo: () => setBoard(snapshot) })
  }

  // ── Carriles ───────────────────────────────────────────────────────────────
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
      return { ...b, lanes: rest, groups: b.groups.map((g) => (g.status === name ? { ...g, status: rest[0] } : g)) }
    })
  }

  // ── Notas ──────────────────────────────────────────────────────────────────
  function addChip(group: string, text: string, who?: Person, due?: string, time?: string) {
    const chip: BoardChip = {
      group, text, date: madridToday(), by: me,
      ...(who ? { who } : {}), ...(due ? { due } : {}), ...(due && time ? { time } : {}),
    }
    setBoard((b) => ({ ...b, chips: [...b.chips, chip] }))
  }

  function editChip(i: number, text: string) {
    setBoard((b) => ({ ...b, chips: b.chips.map((c, idx) => (idx === i ? { ...c, text } : c)) }))
  }

  function doneChip(i: number) {
    const removed = board.chips[i]
    if (!removed) return
    setBoard((b) => ({ ...b, chips: b.chips.filter((_, idx) => idx !== i) }))
    showToast({
      message: `Cerrada: ${removed.text}`,
      undo: () => setBoard((b) => {
        const chips = [...b.chips]
        chips.splice(Math.min(i, chips.length), 0, removed)
        return { ...b, chips }
      }),
    })
  }

  /** ○ pendiente → ◐ hecha, esperando feedback → cerrada (se quita, con deshacer) */
  function advanceChip(i: number) {
    const chip = board.chips[i]
    if (!chip) return
    if (chip.state === 'esperando') { doneChip(i); return }
    setBoard((b) => ({
      ...b,
      chips: b.chips.map((c, idx) => (idx === i ? { ...c, state: 'esperando', stateDate: madridToday() } : c)),
    }))
    showToast({
      message: `Esperando feedback: ${chip.text}`,
      undo: () => setBoard((b) => ({
        ...b,
        chips: b.chips.map((c, idx) => {
          if (idx !== i) return c
          const { state: _s, stateDate: _d, ...rest } = c
          return rest
        }),
      })),
    })
  }

  function setChipWhen(i: number, due?: string, time?: string) {
    setBoard((b) => ({
      ...b,
      chips: b.chips.map((c, idx) => {
        if (idx !== i) return c
        const { due: _d, time: _t, ...rest } = c
        return due ? { ...rest, due, ...(time ? { time } : {}) } : rest
      }),
    }))
  }

  function assignChip(i: number, who: Person | undefined) {
    setBoard((b) => ({
      ...b,
      chips: b.chips.map((c, idx) => {
        if (idx !== i) return c
        const { who: _w, ...rest } = c
        return who ? { ...rest, who } : rest
      }),
    }))
  }

  function dropChip(group: string) {
    if (dragChip === null) return
    setBoard((b) => ({ ...b, chips: b.chips.map((c, idx) => (idx === dragChip ? { ...c, group } : c)) }))
    setDragChip(null)
    setDragOverGroup(null)
  }

  // ── Derivados ──────────────────────────────────────────────────────────────
  function lanesWithGroups() {
    return board.lanes.map((lane) => ({
      lane,
      groups: board.groups
        .filter((g) => (g.status ?? board.lanes[0]) === lane)
        .map((g, idx) => ({ g, idx }))
        // entrega más cercana primero; el resto en su orden
        .sort((a, b) => (a.g.deadline && b.g.deadline ? a.g.deadline.localeCompare(b.g.deadline) : a.g.deadline ? -1 : b.g.deadline ? 1 : a.idx - b.idx))
        .map(({ g }) => g),
    }))
  }

  function notesOf(name: string): IndexedNote[] {
    return board.chips
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.group === name)
      // pendientes antes que las que esperan feedback; dentro, recientes arriba y sin fecha al final
      .sort((a, b) => {
        const wa = a.c.state === 'esperando' ? 1 : 0
        const wb = b.c.state === 'esperando' ? 1 : 0
        if (wa !== wb) return wa - wb
        // con fecha (reunión/entrega) primero, la más cercana arriba
        if (a.c.due || b.c.due) {
          if (a.c.due && b.c.due) return (a.c.due + (a.c.time ?? '')).localeCompare(b.c.due + (b.c.time ?? ''))
          return a.c.due ? -1 : 1
        }
        return a.c.date && b.c.date ? b.c.date.localeCompare(a.c.date) || b.i - a.i : a.c.date ? -1 : b.c.date ? 1 : a.i - b.i
      })
  }

  function involvesMe(g: BoardGroup): boolean {
    const owner = ownerOf(g.owner)
    return includesMe(owner, me) || board.chips.some((c) => c.group === g.name && includesMe(effectiveWho(c.who, owner), me))
  }

  if (loading) {
    return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>
  }

  const sheetGroup = openProject ? board.groups.find((g) => g.name === openProject) : null

  function noteListFor(g: BoardGroup, compact = false) {
    return (
      <NoteList
        notes={notesOf(g.name)}
        owner={ownerOf(g.owner)}
        me={me}
        onlyMine={onlyMine}
        compact={compact}
        onAdd={(text, who, due, time) => addChip(g.name, text, who, due, time)}
        onSetWhen={setChipWhen}
        onEdit={editChip}
        onAdvance={advanceChip}
        onDone={doneChip}
        onAssign={assignChip}
        dragChip={dragChip}
        onDragStart={setDragChip}
        onDragEnd={() => { setDragChip(null); setDragOverGroup(null) }}
      />
    )
  }

  function newProjectControl(lane: string, variant: 'row' | 'card') {
    if (addingInLane === lane) {
      return (
        <div className={variant === 'row' ? 'px-3 py-2.5' : ''}>
          <input
            autoFocus
            className="w-full px-3 py-2 border border-input rounded-md text-sm text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06]"
            placeholder="Nombre del proyecto o cliente"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onBlur={() => { if (!newProjectName.trim()) setAddingInLane(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createProject(lane)
              if (e.key === 'Escape') { setNewProjectName(''); setAddingInLane(null) }
            }}
          />
        </div>
      )
    }
    return (
      <button
        onClick={() => { setAddingInLane(lane); setNewProjectName('') }}
        className={`flex items-center gap-1.5 text-sm text-ink-40 hover:text-ink transition-colors ${
          variant === 'row' ? 'w-full px-3 py-2.5 hover:bg-surface' : 'px-1 py-1'
        }`}
      >
        <Plus size={14} strokeWidth={1.5} />
        Nuevo proyecto
      </button>
    )
  }

  function laneHeader(lane: string, li: number, count: number) {
    return (
      <div className="flex items-center gap-2 mb-2.5 group/lane">
        <input
          className={`text-[10px] font-medium tracking-[0.18em] uppercase bg-transparent outline-none min-w-0 w-40 rounded px-1 -mx-1 hover:bg-surface-hover focus:bg-surface-hover ${li === 0 ? 'text-ink' : 'text-ink-40'} focus:text-ink transition-colors`}
          value={lane}
          onChange={(e) => renameLane(lane, e.target.value)}
          title="Clic para renombrar"
          aria-label="Nombre del carril"
        />
        <span className="text-[10px] text-ink-40 tabular-nums">{count}</span>
        {count === 0 && board.lanes.length > 1 && (
          <button
            onClick={() => deleteLane(lane)}
            className="opacity-0 group-hover/lane:opacity-100 text-ink-40 hover:text-[#DC2626] transition-all"
            title="Eliminar carril vacío"
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-8 py-8">
      {/* Cabecera compacta: el estado de los proyectos tiene que verse sin bajar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight text-ink">Proyectos</h1>
          <Faces who="Eric y Andoni" size={24} />
          <span className="h-4 flex items-center">
            {saveStatus === 'saving' && <span className="w-2.5 h-2.5 inline-block border border-ink-40 border-t-transparent rounded-full animate-spin" />}
            {saveStatus === 'saved' && <span className="flex items-center gap-1 text-[10px] text-ink-40"><Check size={10} strokeWidth={2.5} />Guardado</span>}
            {saveStatus === 'error' && <span className="text-[10px] text-[#DC2626]">Error al guardar</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-line rounded-md overflow-hidden">
            {(['lista', 'tablero'] as const).map((v) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-accent text-on-accent' : 'text-ink-60 hover:bg-surface-hover'}`}
              >
                {v === 'lista' ? 'Lista' : 'Tablero'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1 text-xs font-medium rounded-md border transition-colors ${
              onlyMine ? 'bg-accent text-on-accent border-accent' : 'border-line text-ink-60 hover:border-input hover:text-ink'
            }`}
          >
            <Faces who={me} size={18} ring="transparent" />
            Solo lo mío
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_17rem] gap-10 items-start">
        <main className="min-w-0">
          {view === 'lista' ? (
            <div className="space-y-8">
              {lanesWithGroups().map(({ lane, groups }, li) => (
                <section key={lane + li}>
                  {laneHeader(lane, li, groups.length)}
                  <div className="border border-line rounded-md bg-paper divide-y divide-line">
                    {groups.map((g) => (
                      <div
                        key={g.name}
                        onDragOver={(e) => { if (dragChip !== null) { e.preventDefault(); setDragOverGroup(g.name) } }}
                        onDragLeave={() => setDragOverGroup((k) => (k === g.name ? null : k))}
                        onDrop={() => dropChip(g.name)}
                        className={`grid grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)] transition-[opacity,background-color] ${
                          onlyMine && !involvesMe(g) ? 'opacity-35' : ''
                        } ${dragOverGroup === g.name && dragChip !== null ? 'bg-surface' : ''}`}
                      >
                        <div className="p-3 md:border-r border-line">
                          <ProjectSummary g={g} onOpen={() => setOpenProject(g.name)} />
                        </div>
                        <div className="px-4 py-2.5 border-t md:border-t-0 border-line">
                          {noteListFor(g)}
                        </div>
                      </div>
                    ))}
                    {newProjectControl(lane, 'row')}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 items-start">
              {lanesWithGroups().map(({ lane, groups }, li) => (
                <section
                  key={lane + li}
                  onDragOver={(e) => { if (dragProject) e.preventDefault() }}
                  onDrop={() => { if (dragProject) { patchGroup(dragProject, { status: lane }); setDragProject(null) } }}
                  className="w-[19rem] shrink-0 rounded-md bg-surface border border-line p-3"
                >
                  {laneHeader(lane, li, groups.length)}
                  <div className="space-y-2.5">
                    {groups.map((g) => (
                      <div
                        key={g.name}
                        draggable
                        onDragStart={() => setDragProject(g.name)}
                        onDragEnd={() => setDragProject(null)}
                        onDragOver={(e) => { if (dragChip !== null) { e.preventDefault(); setDragOverGroup(g.name) } }}
                        onDragLeave={() => setDragOverGroup((k) => (k === g.name ? null : k))}
                        onDrop={(e) => { if (dragChip !== null) { e.stopPropagation(); dropChip(g.name) } }}
                        className={`border border-line rounded-md bg-paper p-3 transition-opacity ${
                          dragProject === g.name ? 'opacity-40' : onlyMine && !involvesMe(g) ? 'opacity-35' : ''
                        } ${dragOverGroup === g.name && dragChip !== null ? 'ring-2 ring-accent/20' : ''}`}
                      >
                        <ProjectSummary g={g} size="sm" onOpen={() => setOpenProject(g.name)} />
                        <div className="mt-2.5 pt-2 border-t border-line">{noteListFor(g, true)}</div>
                      </div>
                    ))}
                    {newProjectControl(lane, 'card')}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Nuevo carril */}
          <div className="mt-8 flex items-center gap-2">
            <input
              className="px-3 py-1.5 text-xs border border-dashed border-line rounded-md bg-transparent text-ink placeholder-ink-40 focus:outline-none focus:border-input transition-colors w-44"
              placeholder="Nuevo carril…"
              value={newLane}
              onChange={(e) => setNewLane(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLane()}
              aria-label="Nuevo carril"
            />
            <button onClick={addLane} disabled={!newLane.trim()} className="text-ink-40 hover:text-ink transition-colors disabled:opacity-40" title="Añadir carril">
              <Plus size={14} strokeWidth={1.5} />
            </button>
          </div>
        </main>

        <StudioSidebar
          board={board}
          timeProjects={timeProjects}
          timeEntries={timeEntries}
          quotes={quotes}
          lastSeen={lastSeen}
          me={me}
        />
      </div>

      {sheetGroup && (
        <ProjectSheet
          group={sheetGroup}
          lanes={board.lanes}
          noteCount={board.chips.filter((c) => c.group === sheetGroup.name).length}
          onChange={(patch) => patchGroup(sheetGroup.name, patch)}
          onRename={(n) => renameGroup(sheetGroup.name, n)}
          onClearDeadline={() => clearDeadline(sheetGroup.name)}
          onDelete={() => deleteGroup(sheetGroup.name)}
          onClose={() => setOpenProject(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="toast-in fixed bottom-6 left-1/2 z-[60] flex items-center gap-4 pl-4 pr-2 py-2 rounded-md bg-ink text-paper shadow-[0_8px_24px_rgba(0,0,0,0.18)] max-w-[90vw]"
          style={{ transform: 'translateX(-50%)' }}
        >
          <span className="text-sm truncate max-w-[50vw]">{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => { toast.undo?.(); setToast(null) }}
              className="px-2.5 py-1 text-sm font-medium rounded hover:bg-white/10 transition-colors"
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
