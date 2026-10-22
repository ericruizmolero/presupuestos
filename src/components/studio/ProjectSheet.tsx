'use client'

import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { BOARD_COLORS, madridToday, type BoardGroup } from '@/lib/firestore/planning'
import { logoFor } from '@/lib/studioAssets'
import { Faces, ProjectMark } from './StudioMarks'
import { HEALTH, countdown, fmtDay, nextWeekday, ownerOf, shiftDays, type Person } from './boardUtils'

const LABEL = 'text-[10px] font-medium tracking-[0.16em] uppercase text-ink-40 mb-2 block'
const INPUT = 'w-full px-3 py-2 border border-input rounded-md text-sm text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'
const SEG = 'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors'
const SEG_ON = 'bg-accent text-on-accent border-accent'
const SEG_OFF = 'border-line text-ink-60 hover:border-input hover:text-ink'

const OWNERS: Array<{ id: Person; label: string }> = [
  { id: 'Eric', label: 'Eric' },
  { id: 'Andoni', label: 'Andoni' },
  { id: 'Eric y Andoni', label: 'Los dos' },
]

interface Props {
  group: BoardGroup
  lanes: string[]
  noteCount: number
  onChange: (patch: Partial<BoardGroup>) => void
  /** Devuelve false si el nombre ya existe */
  onRename: (newName: string) => boolean
  onClearDeadline: () => void
  onDelete: () => void
  onClose: () => void
}

/** Panel lateral con toda la edición de un proyecto. Los cambios se aplican al momento. */
export function ProjectSheet({ group: g, lanes, noteCount, onChange, onRename, onClearDeadline, onDelete, onClose }: Props) {
  const today = madridToday()
  const [name, setName] = useState(g.name)
  const [nameError, setNameError] = useState('')
  const [status, setStatus] = useState(g.statusNote || '')
  const [dlLabel, setDlLabel] = useState(g.deadlineLabel || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Si cambia el proyecto abierto, reiniciar borradores
  useEffect(() => {
    setName(g.name); setNameError(''); setStatus(g.statusNote || ''); setDlLabel(g.deadlineLabel || ''); setConfirmDelete(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.name])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function commitName() {
    const n = name.trim()
    if (!n || n === g.name) { setName(g.name); setNameError(''); return }
    if (!onRename(n)) { setNameError('Ya hay un proyecto con ese nombre'); return }
    setNameError('')
  }

  function commitStatus() {
    const s = status.trim()
    if (s === (g.statusNote || '')) return
    onChange({ statusNote: s || undefined, statusDate: today })
  }

  function setDeadline(date: string) {
    onChange({ deadline: date, ...(dlLabel.trim() ? { deadlineLabel: dlLabel.trim() } : {}) })
  }

  const owner = ownerOf(g.owner)
  const logo = logoFor(g.name)
  const quickDates = [
    { label: 'Mañana', date: shiftDays(today, 1) },
    { label: 'Viernes', date: nextWeekday(today, 5) },
    { label: '+1 semana', date: shiftDays(today, 7) },
    { label: '+2 semanas', date: shiftDays(today, 14) },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={`Editar ${g.name}`}
        className="sheet-in fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-paper border-l border-line shadow-[0_8px_40px_rgba(0,0,0,0.12)] flex flex-col"
      >
        {/* Cabecera */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-line shrink-0">
          <ProjectMark name={g.name} color={g.color} showLogo={g.showLogo} size={26} compact={false} hideName />
          <input
            className="flex-1 min-w-0 text-base font-medium text-ink bg-transparent outline-none border-b border-transparent focus:border-input py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            aria-label="Nombre del proyecto"
          />
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover" aria-label="Cerrar">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        {nameError && <p className="px-5 pt-2 text-xs text-[#B91C1C]">{nameError}</p>}

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {/* Responsable */}
          <section>
            <span className={LABEL}>Quién lo lleva</span>
            <div className="grid grid-cols-3 gap-2">
              {OWNERS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onChange({ owner: o.id })}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-md border transition-colors ${
                    owner === o.id ? 'border-accent bg-surface' : 'border-line hover:border-input'
                  }`}
                >
                  <Faces who={o.id} size={28} />
                  <span className={`text-xs ${owner === o.id ? 'text-ink font-medium' : 'text-ink-60'}`}>{o.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-40 mt-2">Sus notas son para esta persona salvo que asignes alguna a otra.</p>
          </section>

          {/* Carril */}
          <section>
            <span className={LABEL}>Prioridad</span>
            <div className="flex flex-wrap gap-2">
              {lanes.map((l) => (
                <button key={l} onClick={() => onChange({ status: l })} className={`${SEG} ${(g.status ?? lanes[0]) === l ? SEG_ON : SEG_OFF}`}>
                  {l}
                </button>
              ))}
            </div>
          </section>

          {/* Cómo va */}
          <section>
            <span className={LABEL}>Cómo va</span>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {HEALTH.map((h) => (
                <button
                  key={h.id}
                  onClick={() => onChange({ health: g.health === h.id ? undefined : h.id, statusDate: today })}
                  className={`${SEG} flex items-center gap-1.5 ${g.health === h.id ? 'border-accent text-ink bg-surface' : SEG_OFF}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: h.color }} />
                  {h.label}
                </button>
              ))}
            </div>
            <input
              className={INPUT}
              placeholder="Estado en una línea: «esperando feedback del cliente»"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              onBlur={commitStatus}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
            {g.statusDate && <p className="text-xs text-ink-40 mt-1.5">Actualizado el {fmtDay(g.statusDate)}</p>}
          </section>

          {/* Próxima entrega */}
          <section>
            <span className={LABEL}>Próxima entrega</span>
            <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
              <input
                className={INPUT}
                placeholder="Qué se entrega: «Lanzamiento»"
                value={dlLabel}
                onChange={(e) => setDlLabel(e.target.value)}
                onBlur={() => { if (g.deadline) onChange({ deadlineLabel: dlLabel.trim() || undefined }) }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
              <input
                type="date"
                className={`${INPUT} w-auto`}
                value={g.deadline || ''}
                onChange={(e) => (e.target.value ? setDeadline(e.target.value) : onClearDeadline())}
                aria-label="Fecha de entrega"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {quickDates.map((q) => (
                <button key={q.label} onClick={() => setDeadline(q.date)} className="px-2 py-1 text-xs rounded border border-line text-ink-60 hover:border-input hover:text-ink transition-colors">
                  {q.label}
                </button>
              ))}
              {g.deadline && (
                <button onClick={() => { onClearDeadline(); setDlLabel('') }} className="px-2 py-1 text-xs text-ink-40 hover:text-[#B91C1C] transition-colors">
                  Quitar entrega
                </button>
              )}
            </div>
            {g.deadline && (
              <p className="text-xs mt-2">
                <span className="text-ink-60">{fmtDay(g.deadline)} · </span>
                <span className={countdown(g.deadline, today).tone}>{countdown(g.deadline, today).text}</span>
              </p>
            )}
          </section>

          {/* Apariencia */}
          <section>
            <span className={LABEL}>Apariencia</span>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onChange({ color: c, showLogo: false })}
                  className={`w-7 h-7 rounded-md border transition-transform hover:scale-105 ${g.color === c && !g.showLogo ? 'ring-2 ring-offset-2 ring-accent border-transparent' : 'border-black/[0.06]'}`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            {logo && (
              <button
                onClick={() => onChange({ showLogo: !g.showLogo })}
                className={`mt-3 flex items-center gap-3 w-full px-3 py-2 rounded-md border transition-colors ${g.showLogo ? 'border-accent bg-surface' : 'border-line hover:border-input'}`}
              >
                <span className="h-6 px-2 inline-flex items-center rounded bg-white border border-line">
                  <img src={logo} alt="" className="h-3 max-w-[6rem] object-contain" />
                </span>
                <span className="text-sm text-ink-60 flex-1 text-left">{g.showLogo ? 'Usando el logo del cliente' : 'Usar el logo del cliente'}</span>
              </button>
            )}
          </section>
        </div>

        {/* Pie: eliminar */}
        <div className="px-5 py-4 border-t border-line shrink-0 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-40">Los cambios se guardan solos</span>
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <button onClick={onDelete} className="px-3 py-1.5 text-xs font-medium bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors">
                Eliminar{noteCount > 0 ? ` con ${noteCount} nota${noteCount > 1 ? 's' : ''}` : ''}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-ink-60 hover:text-ink">Cancelar</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-ink-40 hover:text-[#B91C1C] transition-colors">
              <Trash2 size={13} strokeWidth={1.5} />
              Eliminar proyecto
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
