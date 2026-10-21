'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getBoard, saveBoard, getBoardLastSeen, setBoardLastSeen, madridToday, BOARD_COLORS, DEFAULT_LANES, type Board } from '@/lib/firestore/planning'
import { Check, Plus, X, Trash2 } from 'lucide-react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Columnas de la matriz; las notas sin asignar se muestran en "Juntos" */
const COLUMNS = [
  { id: 'Eric', label: 'Eric' },
  { id: 'Andoni', label: 'Andoni' },
  { id: 'Eric y Andoni', label: 'Juntos' },
] as const

function columnOf(who?: string): string {
  if (who === 'Eric' || who === 'Andoni') return who
  return 'Eric y Andoni'
}

/** El estudio son dos: con el hint de la cuenta basta */
function myName(displayName?: string | null, email?: string | null): string {
  const hint = `${displayName || ''} ${email || ''}`.toLowerCase()
  return hint.includes('andoni') ? 'Andoni' : 'Eric'
}

const NOVEDADES_DIAS_MAX = 30 // tope aunque lleves más sin entrar

const HEALTH: Array<{ id: 'verde' | 'ambar' | 'rojo'; color: string; label: string }> = [
  { id: 'verde', color: '#16A34A', label: 'En orden' },
  { id: 'ambar', color: '#D97706', label: 'Atención' },
  { id: 'rojo', color: '#DC2626', label: 'En riesgo' },
]

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy'
  const d = new Date(date + 'T00:00:00')
  const t = new Date(today + 'T00:00:00')
  if (t.getTime() - d.getTime() === 86400000) return 'Ayer'
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
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
  const [board, setBoard] = useState<Board>({ lanes: [...DEFAULT_LANES], groups: [], chips: [] })
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [newGroup, setNewGroup] = useState('')
  const [newLane, setNewLane] = useState('')
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null)

  // Edición/alta rápida de notas: celda activa "group|who" y chip en edición (índice global)
  const [addingCell, setAddingCell] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editingChip, setEditingChip] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [dragChip, setDragChip] = useState<number | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)

  const isFirstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [lastSeen, setLastSeen] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      const [b, seen] = await Promise.all([getBoard(cid), getBoardLastSeen(user.uid)])
      setBoard(b)
      setLastSeen(seen)
      setLoading(false)
      // marcar la visita (el feed de esta sesión usa el valor anterior)
      setBoardLastSeen(user.uid, madridToday())
    })
  }, [user])

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

  // ── Proyectos y carriles ────────────────────────────────────────────────────
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
    setBoard((b) => ({ ...b, groups: b.groups.map((g) => (g.name === name ? { ...g, status } : g)) }))
  }

  /** Rota la salud del proyecto: nada → verde → ámbar → rojo → nada */
  function cycleHealth(name: string) {
    setBoard((b) => ({
      ...b,
      groups: b.groups.map((g) => {
        if (g.name !== name) return g
        const idx = HEALTH.findIndex((h) => h.id === g.health)
        const next = idx + 1 >= HEALTH.length ? undefined : HEALTH[idx + 1].id
        return { ...g, health: next, statusDate: madridToday() }
      }),
    }))
  }

  const [editingStatus, setEditingStatus] = useState<string | null>(null)
  const [statusDraft, setStatusDraft] = useState('')

  function saveStatusNote(name: string) {
    const note = statusDraft.trim()
    setBoard((b) => ({
      ...b,
      groups: b.groups.map((g) =>
        g.name === name ? { ...g, statusNote: note || undefined, statusDate: madridToday() } : g
      ),
    }))
    setEditingStatus(null)
  }

  function deleteGroup(name: string) {
    setBoard((b) => ({
      ...b,
      groups: b.groups.filter((g) => g.name !== name),
      chips: b.chips.filter((c) => c.group !== name),
    }))
    setConfirmDeleteGroup(null)
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

  // ── Notas ───────────────────────────────────────────────────────────────────
  function addChip(group: string, who: string) {
    const text = draft.trim()
    if (!text) { setAddingCell(null); return }
    const by = myName(user?.displayName, user?.email)
    setBoard((b) => ({ ...b, chips: [...b.chips, { group, text, who, date: madridToday(), by }] }))
    setDraft('')
    // la celda sigue abierta para encadenar varias notas
  }

  function removeChip(globalIdx: number) {
    setBoard((b) => ({ ...b, chips: b.chips.filter((_, i) => i !== globalIdx) }))
  }

  function startEditChip(globalIdx: number, text: string) {
    setEditingChip(globalIdx)
    setEditText(text)
  }

  function saveEditChip() {
    if (editingChip === null) return
    const text = editText.trim()
    setBoard((b) => ({
      ...b,
      chips: text
        ? b.chips.map((c, i) => (i === editingChip ? { ...c, text } : c))
        : b.chips.filter((_, i) => i !== editingChip),
    }))
    setEditingChip(null)
  }

  function dropChip(group: string, who: string) {
    if (dragChip === null) return
    setBoard((b) => ({
      ...b,
      chips: b.chips.map((c, i) => (i === dragChip ? { ...c, group, who } : c)),
    }))
    setDragChip(null)
    setDragOverCell(null)
  }

  if (loading) {
    return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>
  }

  return (
    <div className="px-8 py-12 max-w-6xl">
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
        El tablón del estudio: qué hay nuevo y quién está con qué. Doble clic edita una nota; arrástrala a otra columna o proyecto para reasignarla.
      </p>

      {/* Novedades desde tu última visita */}
      {(() => {
        const today = madridToday()
        const me = myName(user?.displayName, user?.email)
        const floor = shiftDays(today, -NOVEDADES_DIAS_MAX)
        const cutoffISO = lastSeen && lastSeen > floor ? lastSeen : floor
        const recent = board.chips
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.date && c.date >= cutoffISO)
          .sort((a, b) => (b.c.date! > a.c.date! ? 1 : b.c.date! < a.c.date! ? -1 : b.i - a.i))
        if (recent.length === 0) return null
        const colorOf = (gname: string) => board.groups.find((g) => g.name === gname)?.color ?? '#eee'
        const header = lastSeen && lastSeen > floor
          ? `Desde tu última visita (${dayLabel(lastSeen, today).toLowerCase()})`
          : 'Novedades'
        return (
          <div className="border border-line rounded-md p-4 bg-surface mb-10">
            <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-3">{header}</p>
            <div className="space-y-1.5">
              {recent.map(({ c, i }) => {
                const mine = c.who === me || c.who === 'Eric y Andoni' || !c.who
                return (
                  <div key={i} className={`flex items-baseline gap-2 text-sm ${mine ? '' : 'opacity-55'}`}>
                    <span className="text-xs text-ink-40 w-24 shrink-0">{dayLabel(c.date!, today)}</span>
                    <span className="w-2 h-2 rounded-full shrink-0 self-center" style={{ background: colorOf(c.group) }} />
                    <span className="text-ink-60 shrink-0 font-medium">{c.group}</span>
                    <span className="text-ink min-w-0">{c.text}</span>
                    <span className={`text-xs shrink-0 ml-auto whitespace-nowrap ${c.who === me ? 'text-ink font-medium' : 'text-ink-40'}`}>
                      {c.who ? (c.who === 'Eric y Andoni' ? 'los dos' : c.who === me ? 'para ti' : `para ${c.who}`) : 'sin asignar'}
                      {c.by && c.by !== c.who ? ` · de ${c.by}` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

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

      {/* Cabecera de columnas */}
      <div className="hidden lg:grid grid-cols-[13rem_1fr_1fr_1fr] gap-3 mb-3 px-1">
        <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40">Proyecto</span>
        {COLUMNS.map((c) => (
          <span key={c.id} className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40">{c.label}</span>
        ))}
      </div>

      {board.groups.length === 0 ? (
        <p className="text-sm text-ink-40 text-center py-6 border border-line rounded-md">
          Crea un proyecto y empieza a repartir notas
        </p>
      ) : (
        <div className="space-y-10">
          {board.lanes.map((lane, li) => {
            const laneGroups = board.groups.filter((g) => (g.status ?? board.lanes[0]) === lane)
            return (
              <section key={li}>
                <div className="flex items-center gap-2 mb-3 group/lane">
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
                {laneGroups.length === 0 && <p className="text-xs text-ink-40">Sin proyectos</p>}

                <div className="divide-y divide-line border border-line rounded-md overflow-hidden">
                  {laneGroups.map((g) => (
                    <div key={g.name} className="grid grid-cols-1 lg:grid-cols-[13rem_1fr_1fr_1fr] gap-0 lg:gap-3 bg-paper">
                      {/* Celda proyecto */}
                      <div className="px-4 py-3 flex items-start gap-2 group/header lg:border-r lg:border-line">
                        <button
                          onClick={() => cycleColor(g.name)}
                          title="Cambiar color"
                          className="w-3 h-3 mt-1 shrink-0 rounded-full border border-black/10 hover:scale-110 transition-transform"
                          style={{ background: g.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{g.name}</p>
                          <select
                            value={g.status ?? board.lanes[0]}
                            onChange={(e) => setGroupStatus(g.name, e.target.value)}
                            className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-40 bg-transparent outline-none cursor-pointer hover:text-ink-60"
                            title="Mover de carril"
                          >
                            {board.lanes.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                          {/* Salud + estado */}
                          <div className="mt-1.5 flex items-start gap-1.5">
                            <button
                              onClick={() => cycleHealth(g.name)}
                              title={g.health ? HEALTH.find((h) => h.id === g.health)?.label : 'Salud del proyecto — clic para marcar'}
                              className="w-2.5 h-2.5 mt-0.5 shrink-0 rounded-full border transition-transform hover:scale-110"
                              style={{
                                background: HEALTH.find((h) => h.id === g.health)?.color ?? 'transparent',
                                borderColor: g.health ? 'transparent' : 'var(--color-line)',
                              }}
                            />
                            {editingStatus === g.name ? (
                              <input
                                autoFocus
                                className="flex-1 text-xs border border-input rounded px-1.5 py-0.5 text-ink focus:outline-none focus:border-accent"
                                value={statusDraft}
                                onChange={(e) => setStatusDraft(e.target.value)}
                                onBlur={() => saveStatusNote(g.name)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveStatusNote(g.name)
                                  if (e.key === 'Escape') setEditingStatus(null)
                                }}
                              />
                            ) : (
                              <button
                                onClick={() => { setEditingStatus(g.name); setStatusDraft(g.statusNote || '') }}
                                title={g.statusDate ? `Actualizado ${g.statusDate} — clic para editar` : 'Añadir línea de estado'}
                                className={`text-left text-xs leading-snug transition-colors ${
                                  g.statusNote
                                    ? (g.statusDate && g.statusDate < shiftDays(madridToday(), -14) ? 'text-ink-40' : 'text-ink-60') + ' hover:text-ink'
                                    : 'text-ink-40 opacity-0 group-hover/header:opacity-100 hover:text-ink-60'
                                }`}
                              >
                                {g.statusNote || 'estado…'}
                              </button>
                            )}
                          </div>
                        </div>
                        {confirmDeleteGroup === g.name ? (
                          <span className="flex flex-col items-end gap-1 shrink-0">
                            <button
                              onClick={() => deleteGroup(g.name)}
                              className="px-2 py-0.5 text-[10px] font-medium bg-[#DC2626] text-white rounded hover:bg-[#B91C1C] transition-colors"
                            >
                              Eliminar
                            </button>
                            <button onClick={() => setConfirmDeleteGroup(null)} className="text-[10px] text-ink-60 hover:text-ink">
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteGroup(g.name)}
                            className="opacity-0 group-hover/header:opacity-100 text-ink-40 hover:text-[#DC2626] transition-all shrink-0"
                            title="Eliminar proyecto"
                          >
                            <Trash2 size={12} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>

                      {/* Celdas por persona */}
                      {COLUMNS.map((col) => {
                        const cellKey = `${g.name}|${col.id}`
                        const cellChips = board.chips
                          .map((c, i) => ({ c, i }))
                          .filter(({ c }) => c.group === g.name && columnOf(c.who) === col.id)
                        const isOver = dragOverCell === cellKey && dragChip !== null
                        return (
                          <div
                            key={col.id}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCell(cellKey) }}
                            onDragLeave={() => setDragOverCell((k) => (k === cellKey ? null : k))}
                            onDrop={() => dropChip(g.name, col.id)}
                            className={`px-3 py-3 min-h-[3.25rem] flex flex-wrap items-start content-start gap-1.5 transition-colors border-t border-line lg:border-t-0 ${
                              isOver ? 'bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-paper))]' : ''
                            }`}
                          >
                            {/* Etiqueta de columna en móvil */}
                            <span className="lg:hidden w-full text-[9px] font-medium tracking-[0.18em] uppercase text-ink-40">{col.label}</span>
                            {cellChips.map(({ c, i }) =>
                              editingChip === i ? (
                                <input
                                  key={i}
                                  autoFocus
                                  className="px-2 py-1 text-sm border border-input rounded-md text-ink focus:outline-none focus:border-accent w-full"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onBlur={saveEditChip}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditChip()
                                    if (e.key === 'Escape') setEditingChip(null)
                                  }}
                                />
                              ) : (
                                <span
                                  key={i}
                                  draggable
                                  onDragStart={() => setDragChip(i)}
                                  onDragEnd={() => { setDragChip(null); setDragOverCell(null) }}
                                  onDoubleClick={() => startEditChip(i, c.text)}
                                  title="Doble clic para editar · arrastra para mover"
                                  className={`group/chip inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md text-sm text-ink border border-black/[0.06] cursor-grab select-none ${
                                    dragChip === i ? 'opacity-40' : ''
                                  }`}
                                  style={{ background: g.color }}
                                >
                                  {c.text}
                                  <button
                                    onClick={() => removeChip(i)}
                                    className="opacity-40 group-hover/chip:opacity-100 hover:!opacity-100 transition-opacity"
                                    title="Quitar"
                                  >
                                    <X size={11} strokeWidth={2} />
                                  </button>
                                </span>
                              )
                            )}
                            {addingCell === cellKey ? (
                              <input
                                autoFocus
                                className="px-2 py-1 text-sm border border-dashed border-input rounded-md bg-transparent text-ink placeholder-ink-40 focus:outline-none focus:border-accent min-w-[8rem] flex-1"
                                placeholder="Nota…"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => { addChip(g.name, col.id); setAddingCell(null) }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addChip(g.name, col.id)
                                  if (e.key === 'Escape') { setDraft(''); setAddingCell(null) }
                                }}
                              />
                            ) : (
                              <button
                                onClick={() => { setAddingCell(cellKey); setDraft('') }}
                                className="w-6 h-6 flex items-center justify-center rounded-md border border-dashed border-line text-ink-40 hover:text-ink hover:border-input transition-colors"
                                title={`Añadir nota (${col.label})`}
                              >
                                <Plus size={12} strokeWidth={1.5} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
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
