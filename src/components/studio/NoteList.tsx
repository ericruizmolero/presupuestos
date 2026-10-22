'use client'

import { useState } from 'react'
import { Plus, Check, CalendarClock, Archive } from 'lucide-react'
import { madridToday, type BoardChip } from '@/lib/firestore/planning'
import { Faces } from './StudioMarks'
import {
  countdown, effectiveWho, fmtDay, fmtShort, fmtWhen, includesMe, parseMention, parseWhen, type Person,
} from './boardUtils'

export interface IndexedNote { c: BoardChip; i: number }

export type NoteState = 'pendiente' | 'esperando' | 'hecha'

const STATES: Array<{ id: NoteState; label: string; dot: string }> = [
  { id: 'pendiente', label: 'Pendiente', dot: 'border border-input' },
  { id: 'esperando', label: 'Esperando feedback', dot: 'bg-[#D97706]' },
  { id: 'hecha', label: 'Hecha', dot: 'bg-[#16A34A]' },
]

interface Props {
  notes: IndexedNote[]
  /** Responsable del proyecto (lo que heredan las notas) */
  owner: Person
  me: string
  onlyMine: boolean
  compact?: boolean
  onAdd: (text: string, who?: Person, due?: string, time?: string) => void
  onEdit: (i: number, text: string) => void
  onSetState: (i: number, state: NoteState) => void
  /** Quita la nota del tablón (con deshacer) */
  onArchive: (i: number) => void
  onArchiveDone: () => void
  onAssign: (i: number, who: Person | undefined) => void
  onSetWhen: (i: number, due?: string, time?: string) => void
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

const whoName = (w: string) => (w === 'Eric y Andoni' ? 'Los dos' : w)

/** Notas de un proyecto: clic en el texto edita, el círculo avanza el estado, el nombre reasigna. */
export function NoteList({
  notes, owner, me, onlyMine, compact = false,
  onAdd, onEdit, onSetState, onArchive, onArchiveDone, onAssign, onSetWhen, dragChip, onDragStart, onDragEnd,
}: Props) {
  const today = madridToday()
  const [editing, setEditing] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [draft, setDraft] = useState('')
  const [assignMenu, setAssignMenu] = useState<number | null>(null)
  const [stateMenu, setStateMenu] = useState<number | null>(null)
  const [whenEditing, setWhenEditing] = useState<number | null>(null)
  const [whenDate, setWhenDate] = useState('')
  const [whenTime, setWhenTime] = useState('')

  function commitEdit() {
    if (editing === null) return
    const t = editText.trim()
    if (t) onEdit(editing, t)
    else onArchive(editing)
    setEditing(null)
  }

  function submitDraft() {
    const { text, who } = parseMention(draft)
    if (!text) return
    const { due, time } = parseWhen(text, today)
    onAdd(text, who, due, time)
    setDraft('')
  }

  function openWhen(i: number, c: BoardChip) {
    setWhenEditing(i)
    setWhenDate(c.due || '')
    setWhenTime(c.time || '')
  }

  function saveWhen() {
    if (whenEditing === null) return
    onSetWhen(whenEditing, whenDate || undefined, whenDate && whenTime ? whenTime : undefined)
    setWhenEditing(null)
  }

  return (
    <div>
      {notes.length > 0 && (
        <ul className="space-y-0.5">
          {notes.map(({ c, i }) => {
            const eff = effectiveWho(c.who, owner)
            const dim = onlyMine && !includesMe(eff, me)
            const waiting = c.state === 'esperando'
            const done = c.state === 'hecha'
            const cd = c.due ? countdown(c.due, today) : null

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
                {/* Círculo: marca hecha (se tacha, no desaparece); otro clic la devuelve a pendiente */}
                {done ? (
                  <button
                    onClick={() => onSetState(i, 'pendiente')}
                    title="Hecha — clic para devolverla a pendiente"
                    aria-label="Desmarcar"
                    className="mt-[3px] shrink-0 w-3.5 h-3.5 rounded-full bg-[#16A34A] text-white flex items-center justify-center transition-transform hover:scale-110"
                  >
                    <Check size={9} strokeWidth={3} />
                  </button>
                ) : waiting ? (
                  <button
                    onClick={() => onSetState(i, 'hecha')}
                    title="Esperando feedback — clic para marcarla hecha"
                    aria-label="Marcar hecha"
                    className="mt-[3px] shrink-0 w-3.5 h-3.5 rounded-full border border-[#D97706] overflow-hidden flex transition-transform hover:scale-110"
                  >
                    <span className="w-1/2 h-full bg-[#D97706]" />
                  </button>
                ) : (
                  <button
                    onClick={() => onSetState(i, 'hecha')}
                    title="Pendiente — clic para marcarla hecha"
                    aria-label="Marcar hecha"
                    className="mt-[3px] shrink-0 w-3.5 h-3.5 rounded-full border border-input text-transparent hover:text-ink-60 hover:border-ink-40 flex items-center justify-center transition-colors"
                  >
                    <Check size={9} strokeWidth={3} />
                  </button>
                )}

                <div className="min-w-0 flex-1">
                  <span
                    onClick={() => { setEditing(i); setEditText(c.text) }}
                    title={`Clic para editar${c.by ? ` · apuntada por ${c.by}` : ''}${c.date ? ` el ${fmtDay(c.date)}` : ''}`}
                    className={`text-sm leading-snug cursor-text ${done ? 'text-ink-40 line-through decoration-ink-40' : waiting ? 'text-ink-60' : 'text-ink'}`}
                  >
                    {c.text}
                  </span>

                  {/* Fecha de reunión/entrega de la nota */}
                  {whenEditing === i ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <input
                        type="date" autoFocus value={whenDate}
                        onChange={(e) => setWhenDate(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveWhen(); if (e.key === 'Escape') setWhenEditing(null) }}
                        className="text-xs border border-input rounded px-1.5 py-0.5 text-ink focus:outline-none focus:border-accent"
                      />
                      <input
                        type="time" value={whenTime}
                        onChange={(e) => setWhenTime(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveWhen(); if (e.key === 'Escape') setWhenEditing(null) }}
                        className="text-xs border border-input rounded px-1.5 py-0.5 text-ink focus:outline-none focus:border-accent"
                      />
                      <button onClick={saveWhen} className="text-xs px-1.5 py-0.5 rounded bg-accent text-on-accent">OK</button>
                      {c.due && (
                        <button onClick={() => { onSetWhen(i, undefined, undefined); setWhenEditing(null) }} className="text-xs text-ink-40 hover:text-[#B91C1C]">
                          Quitar fecha
                        </button>
                      )}
                    </div>
                  ) : c.due && cd ? (
                    <button
                      onClick={() => openWhen(i, c)}
                      title="Cambiar fecha"
                      className="mt-0.5 flex items-center gap-1.5 text-xs"
                    >
                      <CalendarClock size={11} strokeWidth={1.5} className={cd.tone} />
                      <span className="text-ink-60">{fmtWhen(c.due, c.time)}</span>
                      {!waiting && !done && (
                        <span className={`px-1.5 py-px rounded text-[10px] font-medium ${cd.pill}`}>{cd.text}</span>
                      )}
                    </button>
                  ) : null}
                </div>

                {/* Fecha rápida: aparece al pasar si la nota no tiene */}
                {!c.due && whenEditing !== i && (
                  <button
                    onClick={() => openWhen(i, c)}
                    title="Poner fecha (reunión o entrega)"
                    aria-label="Poner fecha"
                    className="shrink-0 mt-0.5 opacity-0 group-hover/note:opacity-100 text-ink-40 hover:text-ink transition-opacity"
                  >
                    <CalendarClock size={13} strokeWidth={1.5} />
                  </button>
                )}

                {/* Estado o fecha de alta + a quién le toca (clic para reasignar) */}
                <span className="shrink-0 mt-px flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                  <button
                    onClick={() => setStateMenu(stateMenu === i ? null : i)}
                    title={`Estado${c.stateDate && c.state ? ` desde el ${fmtDay(c.stateDate)}` : ''} — clic para cambiar`}
                    className={`rounded px-1 -mx-1 hover:bg-surface-hover transition-colors ${
                      waiting ? 'text-[#B45309]' : done ? 'text-[#15803D]' : 'text-ink-40 opacity-0 group-hover/note:opacity-100'
                    }`}
                  >
                    {waiting ? `esperando${c.stateDate && !compact ? ` · ${fmtShort(c.stateDate)}` : ''}` : done ? 'hecha' : 'estado'}
                  </button>
                  {!waiting && !done && c.date && !compact && (
                    <span className="text-ink-40 tabular-nums">{fmtShort(c.date)}</span>
                  )}
                  <button
                    onClick={() => setAssignMenu(assignMenu === i ? null : i)}
                    title="A quién le toca — clic para cambiar"
                    className={`rounded px-1 -mx-1 hover:bg-surface-hover transition-colors ${eff === me ? 'text-ink font-medium' : 'text-ink-60'}`}
                  >
                    {whoName(eff)}
                  </button>
                </span>

                {stateMenu === i && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setStateMenu(null)} aria-hidden="true" />
                    <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-paper border border-line rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] py-1">
                      {STATES.map((st) => {
                        const active = (c.state ?? 'pendiente') === st.id
                        return (
                          <button
                            key={st.id}
                            onClick={() => { onSetState(i, st.id); setStateMenu(null) }}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-surface-hover ${active ? 'text-ink font-medium' : 'text-ink-60'}`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                            {st.label}
                            {active && <Check size={12} strokeWidth={2} className="ml-auto" />}
                          </button>
                        )
                      })}
                      <div className="my-1 border-t border-line" />
                      <button
                        onClick={() => { onArchive(i); setStateMenu(null) }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left text-ink-60 hover:bg-surface-hover hover:text-[#B91C1C]"
                      >
                        <Archive size={12} strokeWidth={1.5} />
                        Archivar (quitar del tablón)
                      </button>
                    </div>
                  </>
                )}

                {assignMenu === i && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setAssignMenu(null)} aria-hidden="true" />
                    <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-paper border border-line rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] py-1">
                      {ASSIGN_OPTIONS.map((o) => {
                        const active = o.who === undefined ? !c.who : c.who === o.who
                        return (
                          <button
                            key={o.label}
                            onClick={() => { onAssign(i, o.who); setAssignMenu(null) }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-surface-hover ${active ? 'text-ink font-medium' : 'text-ink-60'}`}
                          >
                            <Faces who={o.who ?? owner} size={16} />
                            {o.who === undefined ? `${o.label} (${whoName(owner).toLowerCase()})` : o.label}
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

      {notes.some(({ c }) => c.state === 'hecha') && (
        <button
          onClick={onArchiveDone}
          className="mt-1 flex items-center gap-1.5 text-xs text-ink-40 hover:text-ink transition-colors px-1.5 -mx-1.5"
        >
          <Archive size={12} strokeWidth={1.5} />
          Archivar hechas ({notes.filter(({ c }) => c.state === 'hecha').length})
        </button>
      )}

      {/* Añadir: siempre visible; Enter añade y deja el foco para encadenar */}
      <label className="mt-1 flex items-center gap-2 rounded-md px-1.5 -mx-1.5 py-1 text-ink-40 focus-within:text-ink hover:bg-surface transition-colors cursor-text">
        <Plus size={13} strokeWidth={1.5} className="shrink-0" />
        <input
          className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder-ink-40 outline-none"
          placeholder={compact ? 'Añadir nota…' : 'Añadir nota…  (@andoni o @eric para asignar · 23/10 10:00 para fecha)'}
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
