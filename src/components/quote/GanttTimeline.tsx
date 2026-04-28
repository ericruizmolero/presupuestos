'use client'

import type { TimelineEntry, ProjectPhase } from '@/types/quote'
import { FeatherIcon, IconPicker } from '@/components/ui/IconPicker'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { Trash2, Plus } from 'lucide-react'

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}

const LABEL_W  = 48  // px — group label column width
const ROW_H    = 36  // px — height of each entry row
const DASH_COLOR = 'color-mix(in srgb, var(--color-line) 70%, transparent)'

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

  const totalDays = daysBetween(minDate, maxDate) || 14
  const numCols   = Math.max(1, Math.ceil((totalDays + 1) / 14))
  const gridCols  = `repeat(${numCols}, minmax(0, 1fr))`

  const weeks = Array.from({ length: numCols }, (_, i) => `Semana ${i * 2 + 1}-${i * 2 + 2}`)

  // col index (1-based, CSS grid)
  function startCol(dateStr: string) {
    return Math.floor(daysBetween(minDate, parseDate(dateStr)) / 14) + 1
  }
  function endCol(dateStr: string) {
    return Math.min(numCols + 1, Math.floor(daysBetween(minDate, parseDate(dateStr)) / 14) + 2)
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
        <div className="flex" style={{ paddingLeft: LABEL_W }}>
          <div className="flex-1 grid" style={{ gridTemplateColumns: gridCols }}>
            {weeks.map((w, i) => (
              <div
                key={i}
                className="text-center pb-2 border-r border-dashed last:border-r-0"
                style={{ fontSize: 10, color: 'color-mix(in srgb, var(--color-ink) 35%, transparent)', borderColor: 'color-mix(in srgb, var(--color-line) 60%, transparent)' }}
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
            className="flex border-t border-dashed"
            style={{ borderColor: DASH_COLOR, ...(gi === groupOrder.length - 1 ? { borderBottom: `1px dashed ${DASH_COLOR}` } : {}) }}
          >
            {/* Vertical label */}
            <div
              className="shrink-0 bg-surface flex items-center justify-center border-r border-dashed overflow-hidden"
              style={{ width: LABEL_W, borderColor: DASH_COLOR }}
            >
              <span
                className="font-medium text-ink-40 tracking-widest uppercase select-none"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 9, maxHeight: '100%' }}
              >
                {group}
              </span>
            </div>

            {/* Entry rows */}
            <div className="flex-1">
              {grouped[group].map((entry, i) => {
                const sc = startCol(entry.startDate)
                const ec = endCol(entry.endDate)
                return (
                  <div
                    key={i}
                    className="relative border-t border-dashed first:border-t-0"
                    style={{ height: ROW_H, borderColor: DASH_COLOR }}
                  >
                    {/* Vertical column separators — edge to edge */}
                    <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: gridCols }}>
                      {weeks.map((_, ci) => (
                        <div
                          key={ci}
                          className="border-r border-dashed last:border-r-0 h-full"
                          style={{ borderColor: DASH_COLOR }}
                        />
                      ))}
                    </div>

                    {/* Phase card */}
                    <div className="absolute inset-0 grid z-10 px-1 py-1" style={{ gridTemplateColumns: gridCols }}>
                      <div
                        className="flex items-center gap-1.5 px-2 rounded border border-line text-ink overflow-hidden"
                        style={{ gridColumn: `${sc} / ${ec}`, background: 'var(--color-paper)', fontSize: 11 }}
                      >
                        {entry.icon && (
                          <span className="shrink-0 text-ink-40">
                            <FeatherIcon name={entry.icon} size={11} />
                          </span>
                        )}
                        <span className="truncate">{entry.phase}</span>
                      </div>
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
          <div key={gi} className="border border-line rounded-md overflow-hidden">
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
                const selectedPhase = phases.find((p) => p.name === e.phase)
                return (
                <div key={i} className="grid items-center gap-3 px-4 py-3" style={{ gridTemplateColumns: '24px 1fr 140px 140px 32px' }}>
                  {/* Phase icon — auto from selected phase */}
                  <span className="shrink-0 text-ink-40">
                    {selectedPhase?.icon
                      ? <FeatherIcon name={selectedPhase.icon} size={14} />
                      : <span className="w-4 h-4 block rounded-sm bg-line" />
                    }
                  </span>
                  <Select
                    className={INPUT}
                    value={e.phase}
                    onChange={(ev) => {
                      const name = ev.target.value
                      const ph = phases.find((p) => p.name === name)
                      onChange(entries.map((en, idx) => idx === i ? { ...en, phase: name, icon: ph?.icon } : en))
                    }}
                  >
                    <option value="">Selecciona una fase…</option>
                    {phases.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </Select>
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
