'use client'

import { useState } from 'react'
import { Plus, Check, UserRound } from 'lucide-react'
import type { BoardChip } from '@/lib/firestore/planning'
import { Faces } from './StudioMarks'
import { effectiveWho, fmtDay, fmtShort, includesMe, parseMention, type Person } from './boardUtils'

export interface IndexedNote { c: BoardChip; i: number }

interface Props {
  notes: IndexedNote[]
  /** Responsable del proyecto (lo que heredan las notas) */
  owner: Person
  me: string
  onlyMine: boolean
  compact?: boolean
  onAdd: (text: string, who?: Person) => void
  onEdit: (i: number, text: string) => void
  onDone: (i: number) => void
  onAssign: (i: number, who: Person | undefined) => void
  dragChip: number | null
  onDragStart: (i: number) => void
  onDragEnd: () => void
}

const ASSIGN_OPTIONS: Array<{ who: Person | undefined; label: string }> = [
  { who: undefined, label: 'Del proyecto' },
  { who: 'Eric', label: 'Eric' },
  { who: 'Andoni', label: 'Andoni' },
  { who: 'Eric y Andoni', label: 'Los dos' },
]

/** Lista de notas de un proyecto: clic para editar, círculo para marcar hecha, menú para asignar. */
export function NoteList({
  notes, owner, me, onlyMine, compact = false,
  onAdd, onEdit, onDone, onAssign, dragChip, onDragStart, onDragEnd,
}: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [draft, setDraft] = useState('')
  const [assignMenu, setAssignMenu] = useState<number | null>(null)

  function commitEdit() {
    if (editing === null) return
    const t = editText.trim()
    if (t) onEdit(editing, t)
    else onDone(editing)
    setEditing(null)
  }

  function submitDraft() {
    const { text, who } = parseMention(draft)
    if (!text) return
    onAdd(text, who)
    setDraft('')
  }

  return (
    <div>
      {notes.length > 0 && (
        <ul className={compact ? 'space-y-0.5' : 'space-y-0.5'}>
          {notes.map(({ c, i }) => {
            const eff = effectiveWho(c.who, owner)
            const isException = !!c.who && c.who !== owner
            const dim = onlyMine && !includesMe(eff, me)
            if (editing === i) {
              return (
                <li key={i} className="py-0.5">
                  <input
                    autoFocus
                    className="w-full px-2 py-1 text-sm border border-input rounded-md text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06]"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                </li>
              )
            }
            return (
              <li
                key={i}
                draggable
                onDragStart={(e) => { e.stopPropagation(); onDragStart(i) }}
                onDragEnd={onDragEnd}
                className={`group/note relative flex items-start gap-2 rounded-md px-1.5 -mx-1.5 py-1 transition-opacity hover:bg-surface ${
                  dragChip === i ? 'opacity-40' : dim ? 'opacity-35' : ''
                }`}
              >
                {/* Marcar como hecha */}
                <button
                  onClick={() => onDone(i)}
                  title="Marcar como hecha"
                  aria-label="Marcar como hecha"
                  className="mt-[3px] shrink-0 w-3.5 h-3.5 rounded-full border border-input text-transparent hover:text-ink-60 hover:border-ink-40 flex items-center justify-center transition-colors"
                >
                  <Check size={9} strokeWidth={3} />
                </button>
                <span
                  onClick={() => { setEditing(i); setEditText(c.text) }}
                  title="Clic para editar"
                  className="min-w-0 flex-1 text-sm text-ink leading-snug cursor-text"
                >
                  {c.text}
                </span>
                {c.date && !compact && (
                  <span
                    className="shrink-0 mt-px text-[11px] text-ink-40 tabular-nums whitespace-nowrap"
                    title={`Apuntada el ${fmtDay(c.date)}${c.by ? ` por ${c.by}` : ''}`}
                  >
                    {fmtShort(c.date)}{c.by ? ` · ${c.by}` : ''}
                  </span>
                )}
                {/* Asignación: cara si es excepción, icono al pasar si hereda */}
                <button
                  onClick={() => setAssignMenu(assignMenu === i ? null : i)}
                  title={isException ? `Para ${c.who} — cambiar` : 'Asignar a alguien'}
                  aria-label="Asignar"
                  className={`shrink-0 rounded-full transition-opacity ${isException ? '' : 'opacity-0 group-hover/note:opacity-100 text-ink-40 hover:text-ink'}`}
                >
                  {isException ? <Faces who={c.who} size={16} ring="var(--color-paper)" /> : <UserRound size={14} strokeWidth={1.5} />}
                </button>
                {assignMenu === i && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setAssignMenu(null)} aria-hidden="true" />
                    <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-paper border border-line rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] py-1">
                      {ASSIGN_OPTIONS.map((o) => {
                        const active = o.who === undefined ? !c.who : c.who === o.who
                        return (
                          <button
                            key={o.label}
                            onClick={() => { onAssign(i, o.who); setAssignMenu(null) }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-surface-hover ${active ? 'text-ink font-medium' : 'text-ink-60'}`}
                          >
                            <Faces who={o.who ?? owner} size={16} />
                            {o.who === undefined ? `${o.label} (${owner === 'Eric y Andoni' ? 'los dos' : owner})` : o.label}
                            {active && <Check size={12} strokeWidth={2} className="ml-auto" />}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Añadir: siempre visible; Enter añade y deja el foco para encadenar */}
      <label className="mt-1 flex items-center gap-2 rounded-md px-1.5 -mx-1.5 py-1 text-ink-40 focus-within:text-ink hover:bg-surface transition-colors cursor-text">
        <Plus size={13} strokeWidth={1.5} className="shrink-0" />
        <input
          className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder-ink-40 outline-none"
          placeholder={compact ? 'Añadir nota…' : 'Añadir nota…  (@andoni o @eric para asignar)'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitDraft()
            if (e.key === 'Escape') { setDraft(''); (e.target as HTMLInputElement).blur() }
          }}
        />
      </label>
    </div>
  )
}
