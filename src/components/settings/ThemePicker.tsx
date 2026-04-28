'use client'

import { PALETTES } from '@/lib/theme'
import { Check } from 'lucide-react'

interface Props {
  value: string
  onChange: (paletteId: string) => void
}

export function ThemePicker({ value, onChange }: Props) {
  const selected = value || 'noir'

  return (
    <div className="flex flex-wrap gap-3">
      {PALETTES.map((palette) => {
        const active = selected === palette.id
        return (
          <button
            key={palette.id}
            type="button"
            onClick={() => onChange(palette.id)}
            className={`group flex flex-col items-center gap-2 p-0 rounded-lg border-2 transition-all ${
              active ? 'border-accent' : 'border-transparent'
            }`}
            title={palette.name}
          >
            {/* Swatch */}
            <div
              className="w-14 h-14 rounded-md overflow-hidden relative border border-line"
              style={{ background: palette.bg }}
            >
              {/* Accent strip */}
              <div
                className="absolute bottom-0 left-0 right-0 h-3"
                style={{ background: palette.accent }}
              />
              {/* Check on selected */}
              {active && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ color: palette.accent }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: palette.bg, border: `1.5px solid ${palette.accent}` }}
                  >
                    <Check size={10} strokeWidth={2.5} />
                  </div>
                </div>
              )}
            </div>
            <span className="text-xs text-ink-60">{palette.name}</span>
          </button>
        )
      })}
    </div>
  )
}
