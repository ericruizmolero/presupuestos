'use client'

import { CalendarClock } from 'lucide-react'
import { madridToday, type BoardGroup } from '@/lib/firestore/planning'
import { Faces, ProjectMark } from './StudioMarks'
import { HEALTH, countdown, fmtDay, ownerOf, ownerLabel, shiftDays } from './boardUtils'

/** Cabecera de un proyecto en modo lectura: lo que hay que saber de un vistazo. Clic → editar. */
export function ProjectSummary({ g, onOpen, size = 'md' }: { g: BoardGroup; onOpen: () => void; size?: 'md' | 'sm' }) {
  const today = madridToday()
  const health = HEALTH.find((h) => h.id === g.health)
  const stale = g.statusDate && g.statusDate < shiftDays(today, -14)
  const cd = g.deadline ? countdown(g.deadline, today) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      title="Editar proyecto"
      className="group/summary block w-full text-left rounded-md -m-1.5 p-1.5 cursor-pointer hover:bg-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-center justify-between gap-2">
        <ProjectMark name={g.name} color={g.color} showLogo={g.showLogo} size={size === 'sm' ? 20 : 22} />
        <span title={`Lo lleva: ${ownerLabel(g.owner)}`}>
          <Faces who={ownerOf(g.owner)} size={size === 'sm' ? 20 : 22} />
        </span>
      </div>

      {/* Cómo va */}
      <div className="mt-2 flex items-start gap-2 text-xs leading-snug">
        <span
          className="mt-[3px] w-2 h-2 rounded-full shrink-0 border"
          style={{ background: health?.color ?? 'transparent', borderColor: health ? 'transparent' : 'color-mix(in srgb, var(--color-line) 50%, var(--color-ink))' }}
          title={health?.label ?? 'Sin marcar'}
        />
        {g.statusNote ? (
          <span className={stale ? 'text-ink-40' : 'text-ink-60'} title={g.statusDate ? `Actualizado el ${fmtDay(g.statusDate)}` : undefined}>
            {g.statusNote}
          </span>
        ) : (
          <span className="text-ink-40">{health ? health.label : 'Sin estado'}</span>
        )}
      </div>

      {/* Próxima entrega */}
      {g.deadline && cd && (
        <div className="mt-1.5 flex items-center gap-2 text-xs min-w-0">
          <CalendarClock size={12} strokeWidth={1.5} className={`shrink-0 ${cd.tone}`} />
          <span className="min-w-0 truncate">
            <span className="text-ink">{g.deadlineLabel || 'Entrega'}</span>
            <span className="text-ink-40"> · {fmtDay(g.deadline)}</span>
          </span>
          <span className={`ml-auto shrink-0 whitespace-nowrap px-1.5 py-px rounded text-[11px] font-medium ${cd.pill}`}>{cd.text}</span>
        </div>
      )}
    </div>
  )
}
