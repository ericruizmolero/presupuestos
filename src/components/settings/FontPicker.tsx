'use client'

import { useState, useEffect, useRef } from 'react'
import { queryLocalFonts, applySystemFont, type LocalFont } from '@/lib/fonts'
import { Search, Check, Type, ChevronDown } from 'lucide-react'

interface Props {
  value: string
  onChange: (fontFamily: string) => void
}

export function FontPicker({ value, onChange }: Props) {
  const [fonts, setFonts] = useState<LocalFont[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [preview, setPreview] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadFonts() {
    if (fonts.length > 0) { setOpen(true); return }
    if (!('queryLocalFonts' in window)) {
      setUnsupported(true)
      return
    }
    setLoading(true)
    const result = await queryLocalFonts()
    setLoading(false)
    if (result.length === 0) {
      setUnsupported(true)
      return
    }
    setFonts(result)
    setOpen(true)
  }

  function handleSelect(family: string) {
    onChange(family)
    setPreview(family)
    applySystemFont(family)
    setOpen(false)
    setSearch('')
  }

  const filtered = search
    ? fonts.filter((f) => f.family.toLowerCase().includes(search.toLowerCase()))
    : fonts

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={loadFonts}
        className="w-full flex items-center justify-between px-4 py-3 border border-input rounded-md text-base text-ink bg-paper hover:border-accent transition-colors focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06]"
      >
        <span className="flex items-center gap-3">
          <Type size={14} className="text-ink-40" strokeWidth={1.5} />
          {value ? (
            <span style={{ fontFamily: value }}>{value}</span>
          ) : (
            <span className="text-ink-40">Seleccionar fuente del sistema...</span>
          )}
        </span>
        <ChevronDown size={14} className="text-ink-40" />
      </button>

      {unsupported && (
        <p className="mt-2 text-xs text-ink-40">
          Tu navegador no soporta acceso a fuentes locales. Usa Chrome o Edge.
        </p>
      )}

      {loading && (
        <p className="mt-2 text-xs text-ink-40">Cargando fuentes del sistema...</p>
      )}

      {open && fonts.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-paper border border-line rounded-md shadow-[0_4px_6px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-2 border-b border-line">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-md">
              <Search size={13} className="text-ink-40 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar fuente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-ink placeholder-ink-40 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-64">
            {filtered.length === 0 ? (
              <p className="text-sm text-ink-40 text-center py-6">Sin resultados</p>
            ) : (
              filtered.map((font) => (
                <button
                  key={font.postscriptName}
                  type="button"
                  onMouseEnter={() => setPreview(font.family)}
                  onMouseLeave={() => setPreview(value)}
                  onClick={() => handleSelect(font.family)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface transition-colors text-left"
                >
                  <span
                    className="text-base text-ink"
                    style={{ fontFamily: font.family }}
                  >
                    {font.family}
                  </span>
                  {value === font.family && (
                    <Check size={13} className="text-ink shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Preview strip */}
      {(preview || value) && (
        <p
          className="mt-3 text-sm text-ink-60 transition-all"
          style={{ fontFamily: preview || value }}
        >
          El veloz murciélago hindú comía feliz cardillo y kiwi. 1234567890
        </p>
      )}
    </div>
  )
}
