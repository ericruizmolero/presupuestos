'use client'

import { useState, useRef, useEffect } from 'react'
import * as Icons from 'react-feather'
import { Search, X } from 'lucide-react'

// Curated set of icons useful for project phases
const PHASE_ICONS = [
  'Compass', 'Map', 'Layout', 'Layers', 'Grid', 'Sliders',
  'Pen', 'Edit2', 'Edit3', 'Feather', 'Type', 'AlignLeft',
  'Code', 'Code2', 'Terminal', 'Cpu', 'Server', 'Database',
  'Globe', 'Monitor', 'Smartphone', 'Tablet', 'Wifi',
  'Search', 'Eye', 'EyeOff', 'Zap', 'Star', 'Award',
  'CheckCircle', 'CheckSquare', 'Check', 'Flag',
  'Package', 'Box', 'Archive', 'Inbox', 'Send',
  'Users', 'User', 'UserCheck', 'MessageSquare', 'MessageCircle',
  'Clock', 'Calendar', 'Watch', 'Activity',
  'TrendingUp', 'BarChart2', 'PieChart', 'Target',
  'Settings', 'Tool', 'Wrench', 'Scissors',
  'Image', 'Video', 'Film', 'Camera', 'Aperture',
  'Music', 'Headphones', 'Volume2',
  'Lock', 'Shield', 'Key',
  'Heart', 'Smile', 'Coffee', 'Book', 'BookOpen',
  'Truck', 'Navigation', 'Anchor', 'Rocket',
  'Sun', 'Moon', 'Cloud', 'Wind', 'Leaf', 'Crop',
]

interface Props {
  value?: string
  onChange: (icon: string | undefined) => void
}

export function FeatherIcon({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  const Icon = (Icons as Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>>)[name]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={1.5} className={className} />
}

export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = search
    ? PHASE_ICONS.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    : PHASE_ICONS

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-9 h-9 flex items-center justify-center rounded-md border transition-colors ${
          value
            ? 'border-accent bg-accent text-on-accent'
            : 'border-input text-ink-40 hover:border-accent hover:text-ink'
        }`}
        title="Elegir icono"
      >
        {value ? <FeatherIcon name={value} size={15} /> : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 w-72 bg-paper border border-line rounded-md shadow-[0_4px_6px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-2 border-b border-line flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 bg-surface rounded px-3 py-1.5">
              <Search size={12} className="text-ink-40 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar icono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent focus:outline-none text-ink placeholder-ink-40"
              />
            </div>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false) }}
                className="p-1.5 text-ink-40 hover:text-[#DC2626] transition-colors"
                title="Quitar icono"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-8 gap-0 p-2 max-h-56 overflow-y-auto">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => { onChange(name); setOpen(false); setSearch('') }}
                title={name}
                className={`p-2 rounded flex items-center justify-center transition-colors ${
                  value === name
                    ? 'bg-accent text-on-accent'
                    : 'text-ink-60 hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <FeatherIcon name={name} size={15} />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-8 text-center text-xs text-ink-40 py-4">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
