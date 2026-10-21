'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { getBoard, saveBoard, getBoardLastSeen, setBoardLastSeen, madridToday, BOARD_COLORS, DEFAULT_LANES, type Board } from '@/lib/firestore/planning'
import { Check, Plus, X, Trash2 } from 'lucide-react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function ownerLabel(owner?: string): string {
  if (owner === 'Eric' || owner === 'Andoni') return owner
  return 'Los dos'
}

function whoTag(who: string): string {
  return who === 'Eric y Andoni' ? 'E+A' : who.charAt(0)
}

/** Responsable efectivo de una nota: su excepción o el owner del proyecto */
function effectiveWho(who: string | undefined, owner: string | undefined): string {
  return who ?? owner ?? 'Eric y Andoni'
}

function includesMe(effective: string, me: string): boolean {
  return effective === me || effective === 'Eric y Andoni'
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

  // Edición/alta rápida de notas: proyecto con input abierto y chip en edición (índice global)
  const [addingGroup, setAddingGroup] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editingChip, setEditingChip] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [dragChip, setDragChip] = useState<number | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [dragProject, setDragProject] = useState<string | null>(null)
  const [view, setView] = useState<'lista' | 'tablero'>('lista')

  // Preferencia de vista por navegador
  useEffect(() => {
    const saved = window.localStorage.getItem('proyectos-view')
    if (saved === 'tablero' || saved === 'lista') setView(saved)
  }, [])
  function switchView(v: 'lista' | 'tablero') {
    setView(v)
    window.localStorage.setItem('proyectos-view', v)
  }

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

  /** Rota el responsable del proyecto: Los dos → Eric → Andoni → Los dos */
  function cycleOwner(name: string) {
    setBoard((b) => ({
      ...b,
      groups: b.groups.map((g) => {
        if (g.name !== name) return g
        const current = g.owner === 'Eric' || g.owner === 'Andoni' ? g.owner : 'Eric y Andoni'
        const order = ['Eric y Andoni', 'Eric', 'Andoni']
        const next = order[(order.indexOf(current) + 1) % order.length]
        return { ...g, owner: next }
      }),
    }))
  }

  /** Rota la excepción de una nota: hereda → Eric → Andoni → Eric y Andoni → hereda */
  function cycleChipWho(globalIdx: number) {
    setBoard((b) => ({
      ...b,
      chips: b.chips.map((c, i) => {
        if (i !== globalIdx) return c
        const order = [undefined, 'Eric', 'Andoni', 'Eric y Andoni']
        const next = order[(order.indexOf(c.who) + 1) % order.length]
        const { who: _omit, ...rest } = c
        return next ? { ...rest, who: next } : rest
      }),
    }))
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
  function addChip(group: string) {
    const text = draft.trim()
    if (!text) { setAddingGroup(null); return }
    const by = myName(user?.displayName, user?.email)
    // sin who: hereda el responsable del proyecto
    setBoard((b) => ({ ...b, chips: [...b.chips, { group, text, date: madridToday(), by }] }))
    setDraft('')
    // el input sigue abierto para encadenar varias notas
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

  function dropChip(group: string) {
    if (dragChip === null) return
    setBoard((b) => ({
      ...b,
      chips: b.chips.map((c, i) => (i === dragChip ? { ...c, group } : c)),
    }))
    setDragChip(null)
    setDragOverGroup(null)
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
        El tablón del estudio: qué hay nuevo y quién lleva qué. Cada proyecto tiene responsable; las notas lo heredan salvo excepción. Doble clic edita; arrastra una nota a otro proyecto para moverla.
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
                const gOwner = board.groups.find((g) => g.name === c.group)?.owner
                const eff = effectiveWho(c.who, gOwner)
                const mine = includesMe(eff, me)
                return (
                  <div key={i} className={`flex items-baseline gap-2 text-sm ${mine ? '' : 'opacity-55'}`}>
                    <span className="text-xs text-ink-40 w-24 shrink-0">{dayLabel(c.date!, today)}</span>
                    <span className="w-2 h-2 rounded-full shrink-0 self-center" style={{ background: colorOf(c.group) }} />
                    <span className="text-ink-60 shrink-0 font-medium">{c.group}</span>
                    <span className="text-ink min-w-0">{c.text}</span>
                    <span className={`text-xs shrink-0 ml-auto whitespace-nowrap ${eff === me ? 'text-ink font-medium' : 'text-ink-40'}`}>
                      {eff === 'Eric y Andoni' ? 'los dos' : eff === me ? 'para ti' : `para ${eff}`}
                      {c.by && c.by !== eff ? ` · de ${c.by}` : ''}
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

      {/* Vista + filtro */}
      {board.groups.length > 0 && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <div className="flex items-center border border-line rounded-md overflow-hidden">
            {(['lista', 'tablero'] as const).map((v) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                  view === v ? 'bg-accent text-on-accent' : 'text-ink-40 hover:bg-surface-hover hover:text-ink-60'
                }`}
              >
                {v === 'lista' ? 'Lista' : 'Tablero'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              onlyMine ? 'bg-accent text-on-accent border-accent' : 'border-line text-ink-60 hover:border-input hover:text-ink'
            }`}
          >
            Solo lo mío
          </button>
        </div>
      )}

      {board.groups.length === 0 ? (
        <p className="text-sm text-ink-40 text-center py-6 border border-line rounded-md">
          Crea un proyecto y empieza a soltar notas
        </p>
      ) : view === 'lista' ? (
        <div className="space-y-10">
          {board.lanes.map((lane, li) => {
            const me = myName(user?.displayName, user?.email)
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
                  {laneGroups.map((g) => {
                    const gOwner = g.owner === 'Eric' || g.owner === 'Andoni' ? g.owner : 'Eric y Andoni'
                    const groupChips = board.chips
                      .map((c, i) => ({ c, i }))
                      .filter(({ c }) => c.group === g.name)
                    const groupHasMine = includesMe(gOwner, me) ||
                      groupChips.some(({ c }) => includesMe(effectiveWho(c.who, gOwner), me))
                    const dimGroup = onlyMine && !groupHasMine
                    return (
                      <div
                        key={g.name}
                        className={`grid grid-cols-1 lg:grid-cols-[16rem_1fr] bg-paper transition-opacity ${dimGroup ? 'opacity-35' : ''}`}
                      >
                        {/* Izquierda: identidad del proyecto */}
                        <div className="px-4 py-3 flex items-start gap-2 group/header lg:border-r lg:border-line">
                          <button
                            onClick={() => cycleColor(g.name)}
                            title="Cambiar color"
                            className="w-3 h-3 mt-1 shrink-0 rounded-full border border-black/10 hover:scale-110 transition-transform"
                            style={{ background: g.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-ink truncate">{g.name}</p>
                              <button
                                onClick={() => cycleOwner(g.name)}
                                title="Responsable del proyecto — clic para cambiar"
                                className={`shrink-0 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded transition-colors ${
                                  gOwner === 'Eric y Andoni'
                                    ? 'bg-surface text-ink-60 border border-line'
                                    : 'bg-accent text-on-accent'
                                }`}
                              >
                                {ownerLabel(g.owner)}
                              </button>
                            </div>
                            <select
                              value={g.status ?? board.lanes[0]}
                              onChange={(e) => setGroupStatus(g.name, e.target.value)}
                              className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-40 bg-transparent outline-none cursor-pointer hover:text-ink-60"
                              title="Mover de carril"
                            >
                              {board.lanes.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
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

                        {/* Derecha: notas del proyecto */}
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOverGroup(g.name) }}
                          onDragLeave={() => setDragOverGroup((k) => (k === g.name ? null : k))}
                          onDrop={() => dropChip(g.name)}
                          className={`px-4 py-3 border-t border-line lg:border-t-0 transition-colors ${
                            dragOverGroup === g.name && dragChip !== null ? 'bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-paper))]' : ''
                          }`}
                        >
                          <ul className="space-y-1">
                            {groupChips.map(({ c, i }) => {
                              const eff = effectiveWho(c.who, gOwner)
                              const isException = !!c.who && c.who !== gOwner
                              const dimNote = onlyMine && !includesMe(eff, me)
                              return editingChip === i ? (
                                <li key={i}>
                                  <input
                                    autoFocus
                                    className="w-full px-2 py-1 text-sm border border-input rounded-md text-ink focus:outline-none focus:border-accent"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onBlur={saveEditChip}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditChip()
                                      if (e.key === 'Escape') setEditingChip(null)
                                    }}
                                  />
                                </li>
                              ) : (
                                <li
                                  key={i}
                                  draggable
                                  onDragStart={(e) => { e.stopPropagation(); setDragChip(i) }}
                                  onDragEnd={() => { setDragChip(null); setDragOverGroup(null) }}
                                  className={`group/chip flex items-start gap-2 text-sm cursor-grab select-none rounded px-1 -mx-1 transition-opacity hover:bg-surface ${
                                    dragChip === i ? 'opacity-40' : dimNote ? 'opacity-35' : ''
                                  }`}
                                >
                                  <span
                                    onDoubleClick={() => startEditChip(i, c.text)}
                                    title="Doble clic para editar · arrastra para cambiar de proyecto"
                                    className="text-ink min-w-0 flex-1 leading-relaxed"
                                  >
                                    {c.text}
                                  </span>
                                  <button
                                    onClick={() => cycleChipWho(i)}
                                    title={isException ? `${c.who} — clic para cambiar` : `Hereda del proyecto (${ownerLabel(g.owner)}) — clic para hacer excepción`}
                                    className={`shrink-0 mt-0.5 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide rounded transition-all ${
                                      isException
                                        ? 'bg-black/10 text-ink'
                                        : 'opacity-0 group-hover/chip:opacity-100 bg-black/[0.04] text-ink-40'
                                    }`}
                                  >
                                    {isException ? whoTag(c.who!) : '·'}
                                  </button>
                                  <button
                                    onClick={() => removeChip(i)}
                                    className="shrink-0 mt-1 opacity-0 group-hover/chip:opacity-100 text-ink-40 hover:text-[#DC2626] transition-all"
                                    title="Quitar (hecho)"
                                  >
                                    <X size={12} strokeWidth={2} />
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                          {addingGroup === g.name ? (
                            <input
                              autoFocus
                              className="mt-1.5 px-2 py-1 text-sm border border-dashed border-input rounded-md bg-transparent text-ink placeholder-ink-40 focus:outline-none focus:border-accent w-full max-w-sm"
                              placeholder="Nota…"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onBlur={() => { addChip(g.name); setAddingGroup(null) }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') addChip(g.name)
                                if (e.key === 'Escape') { setDraft(''); setAddingGroup(null) }
                              }}
                            />
                          ) : (
                            <button
                              onClick={() => { setAddingGroup(g.name); setDraft('') }}
                              className="mt-1.5 w-6 h-6 flex items-center justify-center rounded-md border border-dashed border-line text-ink-40 hover:text-ink hover:border-input transition-colors"
                              title="Añadir nota"
                            >
                              <Plus size={12} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
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
