'use client'

import React, { useState, useRef, useReducer, useEffect } from 'react'
import type { TimelineEntry, ProjectPhase } from '@/types/quote'
import { FeatherIcon, IconPicker } from '@/components/ui/IconPicker'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { Trash2, Plus, Search, Check } from 'lucide-react'

function PhaseInput({
  value,
  phases,
  inputClass,
  onChange,
}: {
  value: string
  phases: ProjectPhase[]
  inputClass: string
  onChange: (name: string, icon?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = search
    ? phases.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : phases

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(p: ProjectPhase) {
    onChange(p.name, p.icon)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative w-full">
      <input
        className={inputClass}
        placeholder="Tarea o fase…"
        autoComplete="off"
        value={value}
        onFocus={() => phases.length > 0 && setOpen(true)}
        onChange={(ev) => {
          onChange(ev.target.value)
          if (phases.length > 0) setOpen(true)
        }}
      />
      {open && phases.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-paper border border-line rounded-md shadow-[0_4px_6px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-2 border-b border-line">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-md">
              <Search size={13} className="text-ink-40 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar fase..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-ink placeholder-ink-40 focus:outline-none"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-64">
            {filtered.length === 0 ? (
              <p className="text-sm text-ink-40 text-center py-4">Sin resultados</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(p) }}
                  className="w-full flex items-center justify-between gap-2.5 px-4 py-2.5 hover:bg-surface transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {p.icon
                      ? <FeatherIcon name={p.icon} size={13} className="text-ink-40 shrink-0" />
                      : <span className="w-[13px] shrink-0" />
                    }
                    <span className="text-sm text-ink truncate">{p.name}</span>
                  </span>
                  {value === p.name && <Check size={12} className="text-ink shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}

function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const LABEL_W      = 32   // px — group label column width
const LABEL_GAP    = 8    // px — gap between label card and bars area
const ROW_H        = 40   // px — height of each entry row
const LABEL_MIN_H  = 72   // px — min group height so label text has room
const LINE_INNER   = 'color-mix(in srgb, var(--color-line) 40%, transparent)'  // internal grid lines
const LINE_GROUP   = 'var(--color-line)'                                         // group separators (solid, visible)

// Subtle per-group card tints derived from theme tokens
const GROUP_TINTS = [
  'color-mix(in srgb, var(--color-accent)  7%, var(--color-paper))',
  'color-mix(in srgb, var(--color-accent) 11%, var(--color-surface))',
  'color-mix(in srgb, var(--color-accent) 15%, var(--color-paper))',
  'color-mix(in srgb, var(--color-accent)  9%, var(--color-surface))',
  'color-mix(in srgb, var(--color-accent) 13%, var(--color-paper))',
]

export function GanttTimeline({ entries }: { entries: TimelineEntry[] }) {
  const valid = entries.filter((e) => e.startDate && e.endDate)
  if (valid.length === 0) return null

  const minDate = valid.reduce((m, e) => {
    const d = parseDate(e.startDate); return d < m ? d : m
  }, parseDate(valid[0].startDate))

  const maxDate = valid.reduce((m, e) => {
    const d = parseDate(e.endDate); return d > m ? d : m
  }, parseDate(valid[0].endDate))

  const span       = daysBetween(minDate, maxDate) || 14
  const numCols    = Math.max(1, Math.ceil((span + 1) / 14))
  const totalDays  = numCols * 14  // same denominator used in InteractiveGantt
  const gridCols   = `repeat(${numCols}, minmax(0, 1fr))`

  const weeks = Array.from({ length: numCols }, (_, i) => `Semana ${i * 2 + 1}-${i * 2 + 2}`)

  // Day-precise bar positioning (matches InteractiveGantt)
  function barLeft(dateStr: string): string {
    const days = Math.max(0, daysBetween(minDate, parseDate(dateStr)))
    return `${(days / totalDays) * 100}%`
  }
  function barWidth(startStr: string, endStr: string): string {
    const days = Math.max(1, daysBetween(parseDate(startStr), parseDate(endStr)))
    return `${(days / totalDays) * 100}%`
  }

  // Group preserving insertion order
  const groupOrder: string[] = []
  const grouped: Record<string, TimelineEntry[]> = {}
  for (const e of valid) {
    const g = e.group?.trim() || ''
    if (!grouped[g]) { grouped[g] = []; groupOrder.push(g) }
    grouped[g].push(e)
  }

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: LABEL_W + numCols * 90 }}>

        {/* ── Week header ── */}
        <div className="flex" style={{ paddingLeft: LABEL_W + LABEL_GAP }}>
          <div className="flex-1 grid" style={{ gridTemplateColumns: gridCols }}>
            {weeks.map((w, i) => (
              <div
                key={i}
                className="text-center pb-2 border-r border-dashed last:border-r-0"
                style={{ fontSize: 10, color: 'color-mix(in srgb, var(--color-ink) 30%, transparent)', borderColor: LINE_INNER }}
              >
                {w}
              </div>
            ))}
          </div>
        </div>

        {/* ── Groups ── */}
        {groupOrder.map((group, gi) => (
          <div
            key={gi}
            className="flex items-stretch"
            style={{ gap: LABEL_GAP, paddingTop: 4, paddingBottom: 4 }}
          >
            {/* Vertical label — card */}
            <div
              className="shrink-0 flex items-center justify-center rounded-md overflow-hidden"
              style={{
                width: LABEL_W,
                minHeight: LABEL_MIN_H,
                background: 'color-mix(in srgb, var(--color-ink) 2%, var(--color-paper))',
                border: '1px solid color-mix(in srgb, var(--color-line) 60%, transparent)',
              }}
            >
              <span
                className="font-medium text-ink-40 tracking-widest uppercase select-none overflow-hidden"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: 7,
                  letterSpacing: '0.12em',
                  maxHeight: LABEL_MIN_H - 12,
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {group}
              </span>
            </div>

            {/* Entry rows + full-height column lines */}
            <div className="flex-1 relative" style={{ minHeight: LABEL_MIN_H }}>

              {/* Vertical column separators */}
              <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: gridCols }}>
                {weeks.map((_, ci) => (
                  <div
                    key={ci}
                    className="border-r border-dashed last:border-r-0 h-full"
                    style={{ borderColor: LINE_INNER }}
                  />
                ))}
              </div>

              {/* Rows */}
              {grouped[group].map((entry, i) => {
                const left  = barLeft(entry.startDate)
                const width = barWidth(entry.startDate, entry.endDate)
                return (
                  <div
                    key={i}
                    className="relative border-t border-dashed first:border-t-0"
                    style={{ height: ROW_H, borderColor: LINE_INNER }}
                  >
                    {/* Phase card — day-precise absolute positioning */}
                    <div
                      className="absolute flex items-center gap-1.5 px-2 rounded border border-line text-ink overflow-hidden"
                      style={{
                        left,
                        width,
                        top: 4,
                        bottom: 4,
                        background: 'var(--color-paper)',
                        fontSize: 11,
                        zIndex: 10,
                        minWidth: 2,
                      }}
                    >
                      {entry.icon && (
                        <span className="shrink-0 text-ink-40">
                          <FeatherIcon name={entry.icon} size={11} />
                        </span>
                      )}
                      <span className="truncate">{entry.phase}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

      </div>
    </div>
  )
}

export function InteractiveGantt({ entries, onChange }: {
  entries: TimelineEntry[]
  onChange: (entries: TimelineEntry[]) => void
}) {
  const [, forceUpdate] = useReducer((c: number) => c + 1, 0)

  const dragState = useRef<{
    active: boolean
    type: 'move' | 'resize-left' | 'resize-right'
    entryIdx: number
    startMouseX: number
    origStart: string
    origEnd: string
    deltaDays: number  // day-level precision
  }>({ active: false, type: 'move', entryIdx: -1, startMouseX: 0, origStart: '', origEnd: '', deltaDays: 0 })

  // Frozen layout also stores totalDays so we can compute pixels-per-day
  const frozenLayout = useRef<{ numCols: number; totalDays: number; minDate: Date } | null>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const entriesRef = useRef(entries)
  const onChangeRef = useRef(onChange)

  useEffect(() => { entriesRef.current = entries }, [entries])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const ds = dragState.current
      if (!ds.active || !gridContainerRef.current || !frozenLayout.current) return
      const totalPx = gridContainerRef.current.getBoundingClientRect().width
      if (totalPx === 0) return
      // pixels per day = totalPx / totalDays
      const dayW = totalPx / frozenLayout.current.totalDays
      ds.deltaDays = Math.round((e.clientX - ds.startMouseX) / dayW)
      forceUpdate()
    }
    function onMouseUp() {
      const ds = dragState.current
      if (!ds.active) return
      const d = ds.deltaDays
      const updated = entriesRef.current.map((e, i) => {
        if (i !== ds.entryIdx) return e
        if (ds.type === 'move') {
          return { ...e, startDate: addDays(ds.origStart, d), endDate: addDays(ds.origEnd, d) }
        }
        if (ds.type === 'resize-right') {
          const ne = addDays(ds.origEnd, d)
          const minE = addDays(ds.origStart, 1)  // minimum 1-day span
          return { ...e, endDate: ne < minE ? minE : ne }
        }
        if (ds.type === 'resize-left') {
          const ns = addDays(ds.origStart, d)
          const maxS = addDays(ds.origEnd, -1)  // minimum 1-day span
          return { ...e, startDate: ns > maxS ? maxS : ns }
        }
        return e
      })
      ds.active = false
      ds.deltaDays = 0
      onChangeRef.current(updated)
      forceUpdate()
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const valid = entries.filter(e => e.startDate && e.endDate)
  if (valid.length === 0) {
    return (
      <p className="text-xs text-ink-40 py-3 text-center">
        Añade fechas a las tareas para ver la vista previa interactiva.
      </p>
    )
  }

  const ds = dragState.current

  // Layout — frozen during drag to prevent grid jumping
  let layoutMinDate: Date, layoutNumCols: number, layoutTotalDays: number
  if (ds.active && frozenLayout.current) {
    layoutMinDate  = frozenLayout.current.minDate
    layoutNumCols  = frozenLayout.current.numCols
    layoutTotalDays = frozenLayout.current.totalDays
  } else {
    layoutMinDate = valid.reduce((m, e) => { const d = parseDate(e.startDate); return d < m ? d : m }, parseDate(valid[0].startDate))
    const layoutMaxDate = valid.reduce((m, e) => { const d = parseDate(e.endDate); return d > m ? d : m }, parseDate(valid[0].endDate))
    const span = daysBetween(layoutMinDate, layoutMaxDate) || 14
    layoutNumCols   = Math.max(1, Math.ceil((span + 1) / 14))
    layoutTotalDays = layoutNumCols * 14
  }

  const gridCols = `repeat(${layoutNumCols}, minmax(0, 1fr))`
  const weeks = Array.from({ length: layoutNumCols }, (_, i) => `Sem. ${i * 2 + 1}-${i * 2 + 2}`)

  // Bar position as % of the total day span (day-level precision)
  function barLeft(dateStr: string): string {
    const days = Math.max(0, daysBetween(layoutMinDate, parseDate(dateStr)))
    return `${(days / layoutTotalDays) * 100}%`
  }
  function barWidth(startStr: string, endStr: string): string {
    const days = Math.max(1, daysBetween(parseDate(startStr), parseDate(endStr)))
    return `${(days / layoutTotalDays) * 100}%`
  }

  function effective(entry: TimelineEntry, idx: number): { s: string; e: string } {
    if (!ds.active || ds.entryIdx !== idx) return { s: entry.startDate, e: entry.endDate }
    const d = ds.deltaDays
    if (ds.type === 'move') {
      return { s: addDays(ds.origStart, d), e: addDays(ds.origEnd, d) }
    }
    if (ds.type === 'resize-right') {
      const ne = addDays(ds.origEnd, d)
      const minE = addDays(ds.origStart, 1)
      return { s: ds.origStart, e: ne < minE ? minE : ne }
    }
    if (ds.type === 'resize-left') {
      const ns = addDays(ds.origStart, d)
      const maxS = addDays(ds.origEnd, -1)
      return { s: ns > maxS ? maxS : ns, e: ds.origEnd }
    }
    return { s: entry.startDate, e: entry.endDate }
  }

  function startDrag(ev: React.MouseEvent, idx: number, type: 'move' | 'resize-left' | 'resize-right', entry: TimelineEntry) {
    ev.preventDefault()
    ev.stopPropagation()
    const vMin = valid.reduce((m, e) => { const d = parseDate(e.startDate); return d < m ? d : m }, parseDate(valid[0].startDate))
    const vMax = valid.reduce((m, e) => { const d = parseDate(e.endDate); return d > m ? d : m }, parseDate(valid[0].endDate))
    const span = daysBetween(vMin, vMax) || 14
    const nCols = Math.max(1, Math.ceil((span + 1) / 14))
    frozenLayout.current = { numCols: nCols, totalDays: nCols * 14, minDate: vMin }
    dragState.current = { active: true, type, entryIdx: idx, startMouseX: ev.clientX, origStart: entry.startDate, origEnd: entry.endDate, deltaDays: 0 }
    forceUpdate()
  }

  // Group preserving insertion order
  const groupOrder: string[] = []
  const grouped: Record<string, Array<{ entry: TimelineEntry; globalIdx: number }>> = {}
  entries.forEach((e, i) => {
    if (!e.startDate || !e.endDate) return
    const g = e.group?.trim() || ''
    if (!grouped[g]) { grouped[g] = []; groupOrder.push(g) }
    grouped[g].push({ entry: e, globalIdx: i })
  })

  return (
    <div
      className="w-full overflow-x-auto"
      style={{ userSelect: ds.active ? 'none' : undefined }}
    >
      <div style={{ minWidth: LABEL_W + layoutNumCols * 90 }}>

        {/* Week header */}
        <div className="flex" style={{ paddingLeft: LABEL_W + LABEL_GAP }}>
          <div ref={gridContainerRef} className="flex-1 grid" style={{ gridTemplateColumns: gridCols }}>
            {weeks.map((w, i) => (
              <div
                key={i}
                className="text-center pb-2 border-r border-dashed last:border-r-0"
                style={{ fontSize: 10, color: 'color-mix(in srgb, var(--color-ink) 30%, transparent)', borderColor: LINE_INNER }}
              >
                {w}
              </div>
            ))}
          </div>
        </div>

        {/* Groups */}
        {groupOrder.map((group, gi) => (
          <div
            key={gi}
            className="flex items-stretch"
            style={{ gap: LABEL_GAP, paddingTop: 4, paddingBottom: 4 }}
          >
            {/* Vertical label — card */}
            <div
              className="shrink-0 flex items-center justify-center rounded-md overflow-hidden"
              style={{
                width: LABEL_W,
                minHeight: LABEL_MIN_H,
                background: 'color-mix(in srgb, var(--color-ink) 2%, var(--color-paper))',
                border: '1px solid color-mix(in srgb, var(--color-line) 60%, transparent)',
              }}
            >
              <span
                className="font-medium text-ink-40 tracking-widest uppercase select-none overflow-hidden"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: 7,
                  letterSpacing: '0.12em',
                  maxHeight: LABEL_MIN_H - 12,
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {group}
              </span>
            </div>

            {/* Entry rows */}
            <div className="flex-1 relative" style={{ minHeight: LABEL_MIN_H }}>
              {/* Full-height column separators (visual background only) */}
              <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: gridCols }}>
                {weeks.map((_, ci) => (
                  <div key={ci} className="border-r border-dashed last:border-r-0 h-full" style={{ borderColor: LINE_INNER }} />
                ))}
              </div>

              {grouped[group].map(({ entry, globalIdx }, ri) => {
                const { s, e: end } = effective(entry, globalIdx)
                const isDragging = ds.active && ds.entryIdx === globalIdx
                const dragType = ds.type
                const left  = barLeft(s)
                const width = barWidth(s, end)

                return (
                  <div
                    key={ri}
                    className="relative border-t border-dashed first:border-t-0"
                    style={{ height: ROW_H, borderColor: LINE_INNER }}
                  >
                    {/* Bar — absolutely positioned by day percentage */}
                    <div
                      style={{
                        position: 'absolute',
                        left,
                        width,
                        top: 4,
                        bottom: 4,
                        cursor: isDragging ? (dragType === 'move' ? 'grabbing' : 'ew-resize') : 'grab',
                        background: 'var(--color-paper)',
                        fontSize: 11,
                        opacity: isDragging ? 0.6 : 1,
                        transition: isDragging ? 'none' : 'opacity 0.1s',
                        zIndex: 10,
                        minWidth: 2,
                      }}
                      className="relative flex items-center gap-1.5 px-2 rounded border border-line text-ink overflow-hidden"
                      onMouseDown={(ev) => startDrag(ev, globalIdx, 'move', entry)}
                    >
                      {/* Left resize handle */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 z-20"
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={(ev) => { ev.stopPropagation(); startDrag(ev, globalIdx, 'resize-left', entry) }}
                      />
                      {entry.icon && (
                        <span className="shrink-0 text-ink-40">
                          <FeatherIcon name={entry.icon} size={11} />
                        </span>
                      )}
                      <span className="truncate">{entry.phase}</span>
                      {/* Right resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 z-20"
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={(ev) => { ev.stopPropagation(); startDrag(ev, globalIdx, 'resize-right', entry) }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

      </div>
    </div>
  )
}

export function EditableGantt({ entries, phases = [], onChange }: {
  entries: TimelineEntry[]
  phases?: ProjectPhase[]
  onChange: (entries: TimelineEntry[]) => void
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  function handleDrop(toIdx: number) {
    if (dragFrom === null || dragFrom === toIdx) return
    const next = [...entries]
    const [moved] = next.splice(dragFrom, 1)
    next.splice(toIdx, 0, moved)
    onChange(next)
    setDragFrom(null)
    setDragOver(null)
  }

  // Collect group order preserving insertion order (keyed by raw value, including empty)
  const groupOrder: string[] = []
  for (const e of entries) {
    const g = e.group ?? ''
    if (!groupOrder.includes(g)) groupOrder.push(g)
  }

  function addGroup() {
    onChange([...entries, { phase: '', group: '', startDate: '', endDate: '', icon: undefined }])
  }

  function renameGroup(oldName: string, newName: string) {
    onChange(entries.map((e) => (e.group ?? '') === oldName ? { ...e, group: newName } : e))
  }

  function deleteGroup(group: string) {
    onChange(entries.filter((e) => (e.group ?? '') !== group))
  }

  function addPhase(group: string) {
    onChange([...entries, { phase: '', group, startDate: '', endDate: '', icon: undefined }])
  }

  function updateEntry(globalIdx: number, field: keyof TimelineEntry, value: string | undefined) {
    onChange(entries.map((e, i) => (i === globalIdx ? { ...e, [field]: value } : e)))
  }

  function removeEntry(globalIdx: number) {
    onChange(entries.filter((_, i) => i !== globalIdx))
  }

  const INPUT = 'px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors w-full'

  return (
    <div className="space-y-6">
      {groupOrder.map((group, gi) => {
        const groupEntries = entries
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => (e.group ?? '') === group)

        return (
          <div key={gi} className="border border-line rounded-md overflow-visible">
            {/* Group header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-line">
              <input
                className="flex-1 text-sm font-medium text-ink bg-transparent outline-none placeholder-ink-40"
                value={group}
                placeholder="Nombre de la temática"
                autoComplete="off"
                onChange={(e) => renameGroup(group, e.target.value)}
              />
              <button
                type="button"
                onClick={() => deleteGroup(group)}
                className="text-ink-40 hover:text-[#DC2626] transition-colors shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* Phases */}
            <div className="divide-y divide-line">
              {groupEntries.map(({ e, i }) => {
                const isDragging = dragFrom === i
                const isOver    = dragOver === i
                return (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(ev) => { ev.preventDefault(); setDragOver(i) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
                  className="grid items-center gap-3 px-4 py-3 transition-colors"
                  style={{
                    gridTemplateColumns: '16px 36px 1fr 140px 140px 32px',
                    opacity: isDragging ? 0.4 : 1,
                    background: isOver ? 'color-mix(in srgb, var(--color-accent) 5%, var(--color-paper))' : undefined,
                  }}
                >
                  {/* Drag handle */}
                  <span className="cursor-grab text-ink-40 flex items-center" style={{ touchAction: 'none' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <circle cx="4" cy="3" r="1"/><circle cx="8" cy="3" r="1"/>
                      <circle cx="4" cy="6" r="1"/><circle cx="8" cy="6" r="1"/>
                      <circle cx="4" cy="9" r="1"/><circle cx="8" cy="9" r="1"/>
                    </svg>
                  </span>
                  <IconPicker
                    value={e.icon}
                    onChange={(icon) => updateEntry(i, 'icon', icon)}
                  />
                  <PhaseInput
                    value={e.phase}
                    phases={phases}
                    inputClass={INPUT}
                    onChange={(name, icon) => {
                      const ph = phases.find((p) => p.name === name)
                      onChange(entries.map((en, idx) => idx === i ? { ...en, phase: name, icon: icon ?? ph?.icon ?? en.icon } : en))
                    }}
                  />
                  <DatePicker className={INPUT} value={e.startDate} onChange={(v) => updateEntry(i, 'startDate', v)} />
                  <DatePicker className={INPUT} value={e.endDate}   onChange={(v) => updateEntry(i, 'endDate', v)} />
                  <button type="button" onClick={() => removeEntry(i)} className="text-ink-40 hover:text-[#DC2626] transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
                )
              })}
            </div>

            {/* Add phase */}
            <div className="px-4 py-2 border-t border-line">
              <button
                type="button"
                onClick={() => addPhase(group)}
                className="flex items-center gap-2 text-xs text-ink-40 hover:text-ink transition-colors"
              >
                <Plus size={13} strokeWidth={2} />
                Añadir fase
              </button>
            </div>
          </div>
        )
      })}

      {/* Add group */}
      <button
        type="button"
        onClick={addGroup}
        className="flex items-center gap-2 text-sm text-ink-60 hover:text-ink transition-colors"
      >
        <Plus size={14} strokeWidth={2} />
        Nueva temática
      </button>
    </div>
  )
}
