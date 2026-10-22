'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Archive, Check } from 'lucide-react'
import { madridToday, type BoardChip, type BoardGroup } from '@/lib/firestore/planning'
import { Faces, ProjectMark } from './StudioMarks'
import { countdown, effectiveWho, fmtDay, type Person } from './boardUtils'
import { TaskBodyEditor } from './TaskBodyEditor'

type NoteState = 'pendiente' | 'esperando' | 'hecha'

const STATES: Array<{ id: NoteState; label: string; dot: string }> = [
  { id: 'pendiente', label: 'Pendiente', dot: 'border border-input' },
  { id: 'esperando', label: 'Esperando feedback', dot: 'bg-[#D97706]' },
  { id: 'hecha', label: 'Hecha', dot: 'bg-[#16A34A]' },
]

const PEOPLE: Array<{ who: Person | undefined; label: string }> = [
  { who: undefined, label: 'Del proyecto' },
  { who: 'Eric', label: 'Eric' },
  { who: 'Andoni', label: 'Andoni' },
  { who: 'Eric y Andoni', label: 'Los dos' },
]

const ROW = 'grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-3 py-1.5'
const KEY = 'text-sm text-ink-40 pt-1'
const CHIP = 'px-2.5 py-1 text-xs rounded-md border transition-colors'
const ON = 'border-accent bg-surface text-ink font-medium'
const OFF = 'border-line text-ink-60 hover:border-input hover:text-ink'

interface Props {
  chip: BoardChip
  groups: BoardGroup[]
  owner: Person
  me: string
  companyId: string | null
  onPatch: (patch: Partial<BoardChip>, remove?: Array<keyof BoardChip>) => void
  onState: (state: NoteState) => void
  onArchive: () => void
  onClose: () => void
}

/** Una tarea abierta como página (tipo Notion): título, propiedades y texto libre. */
export function TaskSheet({ chip: c, groups, owner, me, companyId, onPatch, onState, onArchive, onClose }: Props) {
  const today = madridToday()
  const [title, setTitle] = useState(c.text)
  const [body, setBody] = useState(c.body || '')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  // el cuerpo vivo se lee desde una ref para guardar siempre lo último escrito al cerrar
  const bodyLatest = useRef(c.body || '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Autoajuste de altura del título
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  function commitTitle() {
    const t = title.replace(/\s+/g, ' ').trim()
    if (!t) { setTitle(c.text); return }
    if (t !== c.text) onPatch({ text: t })
  }

  function commitBody() {
    const b = bodyLatest.current
    if (b === (c.body || '')) return
    if (!b) onPatch({}, ['body', 'bodyBy', 'bodyDate'])
    else onPatch({ body: b, bodyBy: me, bodyDate: today })
  }

  const state: NoteState = c.state ?? 'pendiente'
  const eff = effectiveWho(c.who, owner)
  const group = groups.find((g) => g.name === c.group)
  const cd = c.due ? countdown(c.due, today) : null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => { commitTitle(); commitBody(); onClose() }} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={`Tarea: ${c.text}`}
        className="sheet-in fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-paper border-l border-line shadow-[0_8px_40px_rgba(0,0,0,0.12)] flex flex-col"
      >
        {/* Barra superior: proyecto + cerrar */}
        <div className="flex items-center justify-between gap-3 px-6 h-14 border-b border-line shrink-0">
          {group ? <ProjectMark name={group.name} color={group.color} showLogo={group.showLogo} size={20} compact /> : <span />}
          <button
            onClick={() => { commitTitle(); commitBody(); onClose() }}
            className="p-1.5 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover"
            aria-label="Cerrar"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8">
          {/* Título */}
          <textarea
            ref={titleRef}
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
            className={`w-full resize-none overflow-hidden bg-transparent outline-none text-2xl font-medium tracking-tight leading-snug ${
              state === 'hecha' ? 'text-ink-40 line-through decoration-ink-40' : 'text-ink'
            }`}
            aria-label="Título de la tarea"
          />

          {/* Propiedades */}
          <div className="mt-6 mb-8 space-y-0.5">
            <div className={ROW}>
              <span className={KEY}>Estado</span>
              <div className="flex flex-wrap gap-1.5">
                {STATES.map((st) => (
                  <button key={st.id} onClick={() => onState(st.id)} className={`${CHIP} flex items-center gap-1.5 ${state === st.id ? ON : OFF}`}>
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={ROW}>
              <span className={KEY}>Asignada a</span>
              <div className="flex flex-wrap gap-1.5">
                {PEOPLE.map((p) => {
                  const active = p.who === undefined ? !c.who : c.who === p.who
                  return (
                    <button
                      key={p.label}
                      onClick={() => (p.who ? onPatch({ who: p.who }) : onPatch({}, ['who']))}
                      className={`${CHIP} flex items-center gap-1.5 ${active ? ON : OFF}`}
                    >
                      <Faces who={p.who ?? owner} size={16} />
                      {p.who === undefined ? `Del proyecto (${owner === 'Eric y Andoni' ? 'los dos' : owner})` : p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={ROW}>
              <span className={KEY}>Fecha</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={c.due || ''}
                  onChange={(e) => (e.target.value ? onPatch({ due: e.target.value }) : onPatch({}, ['due', 'time']))}
                  className="text-sm border border-input rounded-md px-2 py-1 text-ink focus:outline-none focus:border-accent"
                  aria-label="Fecha"
                />
                <input
                  type="time"
                  value={c.time || ''}
                  disabled={!c.due}
                  onChange={(e) => (e.target.value ? onPatch({ time: e.target.value }) : onPatch({}, ['time']))}
                  className="text-sm border border-input rounded-md px-2 py-1 text-ink focus:outline-none focus:border-accent disabled:opacity-40"
                  aria-label="Hora"
                />
                {cd && state !== 'hecha' && (
                  <span className={`px-1.5 py-px rounded text-[11px] font-medium ${cd.pill}`}>{cd.text}</span>
                )}
              </div>
            </div>

            <div className={ROW}>
              <span className={KEY}>Proyecto</span>
              <select
                value={c.group}
                onChange={(e) => onPatch({ group: e.target.value })}
                className="justify-self-start text-sm border border-input rounded-md px-2 py-1 text-ink bg-paper focus:outline-none focus:border-accent"
                aria-label="Proyecto"
              >
                {groups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
              </select>
            </div>

            <div className={ROW}>
              <span className={KEY}>Creada</span>
              <span className="text-sm text-ink-60 pt-1">
                {c.date ? fmtDay(c.date) : '—'}{c.by ? ` · por ${c.by}` : ''}
                {eff === me && <span className="ml-2 text-ink font-medium">· es tuya</span>}
              </span>
            </div>
          </div>

          {/* Cuerpo enriquecido: títulos, listas, citas e imágenes */}
          <div className="border-t border-line pt-4">
            <TaskBodyEditor
              value={body}
              companyId={companyId}
              onChange={(html) => { bodyLatest.current = html; setBody(html) }}
              onBlur={commitBody}
            />
            {c.body && c.bodyBy && (
              <p className="mt-4 text-xs text-ink-40">Editado por {c.bodyBy}{c.bodyDate ? ` el ${fmtDay(c.bodyDate)}` : ''}</p>
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="px-6 py-3.5 border-t border-line shrink-0 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-ink-40"><Check size={12} strokeWidth={2} />Los cambios se guardan solos</span>
          <button
            onClick={() => { commitTitle(); commitBody(); onArchive() }}
            className="flex items-center gap-1.5 text-xs text-ink-40 hover:text-[#B91C1C] transition-colors"
          >
            <Archive size={13} strokeWidth={1.5} />
            Archivar tarea
          </button>
        </div>
      </aside>
    </>
  )
}
