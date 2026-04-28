'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  className?: string
}

const DAYS  = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function toLocalDate(val: string) {
  return val ? new Date(val + 'T00:00:00') : null
}

function firstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export function DatePicker({ value, onChange, className = '' }: Props) {
  const [open, setOpen]       = useState(false)
  const [pos,  setPos]        = useState<{ top: number; left: number } | null>(null)
  const [view, setView]       = useState<Date>(() => toLocalDate(value) ?? new Date())
  const containerRef          = useRef<HTMLDivElement>(null)
  const triggerRef            = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) setView(toLocalDate(value) ?? new Date())
  }, [value])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function openPicker() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen(true)
  }

  function selectDay(day: number) {
    const y = view.getFullYear()
    const m = String(view.getMonth() + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
    setOpen(false)
  }

  function formatDisplay(val: string) {
    if (!val) return ''
    const [y, m, d] = val.split('-')
    return `${d}/${m}/${y}`
  }

  const year        = view.getFullYear()
  const month       = view.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset      = firstWeekday(year, month)
  const cells       = Array<number | null>(offset).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  )

  const selected    = toLocalDate(value)
  const todayStr    = new Date().toISOString().slice(0, 10)

  return (
    <div ref={containerRef} className="relative">
      <div
        ref={triggerRef}
        onClick={openPicker}
        className={`relative cursor-pointer select-none ${className}`}
      >
        <span className={value ? 'text-ink' : 'text-ink-40'}>
          {value ? formatDisplay(value) : 'DD/MM/AAAA'}
        </span>
        <Calendar
          size={15}
          strokeWidth={1.5}
          className="absolute right-[15px] top-1/2 -translate-y-1/2 text-ink-40 pointer-events-none"
        />
      </div>

      {open && pos && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 50 }}
          className="w-72 bg-paper border border-line rounded-lg shadow-sm p-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setView(new Date(year, month - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface transition-colors text-ink-40 hover:text-ink"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <span className="text-sm font-medium text-ink">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setView(new Date(year, month + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface transition-colors text-ink-40 hover:text-ink"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="h-8 flex items-center justify-center text-xs text-ink-40 font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = selected && dateStr === value
              const isToday    = dateStr === todayStr
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`h-8 w-full flex items-center justify-center text-sm rounded-md transition-colors relative
                    ${isSelected
                      ? 'bg-accent text-on-accent'
                      : 'text-ink hover:bg-surface'
                    }`}
                >
                  {day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
