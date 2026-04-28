'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { FontPicker } from '@/components/settings/FontPicker'
import { ThemePicker } from '@/components/settings/ThemePicker'
import { upsertCompany, getUserCompanyId, setUserCompanyId } from '@/lib/firestore/companies'
import { applySystemFont, injectFont } from '@/lib/fonts'
import { applyThemeColors, applyInkOpacities, paletteToColors, type ThemeColors } from '@/lib/theme'
import { nanoid } from 'nanoid'
import { Check } from 'lucide-react'

const DEFAULT_COLORS: ThemeColors = {
  accent:   '#1A1A1A',
  onAccent: '#ffffff',
  paper:    '#ffffff',
  surface:  '#FAFAFA',
  ink:      '#1A1A1A',
  line:     '#E5E5E5',
}

const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  accent:   'Acento',
  onAccent: 'Sobre acento',
  paper:    'Fondo',
  surface:  'Superficie',
  ink:      'Texto',
  line:     'Líneas',
}

const COLOR_DESCRIPTIONS: Record<keyof ThemeColors, string> = {
  accent:   'Botones, nav activo, bordes destacados',
  onAccent: 'Texto e iconos sobre el color acento',
  paper:    'Fondo general de la aplicación',
  surface:  'Sidebar, cards, filas de tabla',
  ink:      'Texto principal del documento',
  line:     'Bordes, separadores, divisores',
}

export default function TematicaPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <TematicaContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function ColorToken({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="relative cursor-pointer shrink-0">
        <div
          className="w-10 h-10 rounded-md border border-line transition-transform hover:scale-105"
          style={{ background: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink leading-none mb-0.5">{label}</p>
        <p className="text-xs text-ink-40">{description}</p>
      </div>
      <span className="ml-auto text-xs font-mono text-ink-40 shrink-0">{value.toUpperCase()}</span>
    </div>
  )
}

function OpacitySlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 shrink-0 rounded-md border border-line flex items-center justify-center" style={{ background: `color-mix(in srgb, var(--color-ink) ${value}%, transparent)` }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink leading-none mb-0.5">{label}</p>
        <p className="text-xs text-ink-40">{description}</p>
        <input
          type="range"
          min={10}
          max={90}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-2 w-full"
        />
      </div>
      <span className="ml-auto text-xs font-mono text-ink-40 shrink-0">{value}%</span>
    </div>
  )
}

function TematicaContent() {
  const { user, company, refreshCompany } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [paletteId, setPaletteId] = useState('noir')
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS)
  const [fontName, setFontName] = useState('')
  const [inkSecondary, setInkSecondary] = useState(60)
  const [inkTertiary, setInkTertiary] = useState(40)

  useEffect(() => {
    if (company) {
      setPaletteId(company.paletteId || 'noir')
      setColors(company.themeColors ?? paletteToColors(company.paletteId || 'noir'))
      setFontName(company.defaultFontName || '')
      setInkSecondary(company.inkOpacitySecondary ?? 60)
      setInkTertiary(company.inkOpacityTertiary ?? 40)
    }
  }, [company])

  async function getOrCreateCompanyId(): Promise<string> {
    if (!user) throw new Error('No user')
    let cid = await getUserCompanyId(user.uid)
    if (!cid) {
      cid = `company_${nanoid(10)}`
      await setUserCompanyId(user.uid, cid)
    }
    return cid
  }

  async function handleSave() {
    setSaving(true)
    try {
      const cid = await getOrCreateCompanyId()
      await upsertCompany(cid, { paletteId, themeColors: colors, defaultFontName: fontName, inkOpacitySecondary: inkSecondary, inkOpacityTertiary: inkTertiary })
      await refreshCompany()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  function handlePaletteChange(id: string) {
    const next = paletteToColors(id)
    setPaletteId(id)
    setColors(next)
    applyThemeColors(next)
  }

  function handleColorChange(key: keyof ThemeColors, value: string) {
    const next = { ...colors, [key]: value }
    setColors(next)
    applyThemeColors(next)
  }

  function handleFontChange(family: string) {
    setFontName(family)
    if (company) {
      const uploaded = company.fonts?.find((f) => f.name === family)
      if (uploaded) injectFont(uploaded)
      else applySystemFont(family)
    } else {
      applySystemFont(family)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Temática</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-md hover:-translate-y-px transition-all disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-accent text-on-accent hover:bg-accent-hover"
        >
          {saved ? <><Check size={14} /> Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <div className="space-y-12">

        {/* Paletas */}
        <section>
          <p className="text-sm font-medium text-ink mb-2">Paletas</p>
          <p className="text-sm text-ink-60 mb-6">Punto de partida. Selecciona una para cargar sus 6 valores.</p>
          <ThemePicker value={paletteId} onChange={handlePaletteChange} />
        </section>

        <hr className="border-t border-line" />

        {/* Custom tokens */}
        <section>
          <p className="text-sm font-medium text-ink mb-2">Personalizar</p>
          <p className="text-sm text-ink-60 mb-6">Ajusta cada token de color a tu gusto. Los cambios se aplican en tiempo real.</p>
          <div className="space-y-5">
            {(Object.keys(COLOR_LABELS) as (keyof ThemeColors)[]).map((key) => (
              <ColorToken
                key={key}
                label={COLOR_LABELS[key]}
                description={COLOR_DESCRIPTIONS[key]}
                value={colors[key]}
                onChange={(v) => handleColorChange(key, v)}
              />
            ))}
          </div>

          <div className="mt-8 space-y-5">
            <OpacitySlider
              label="Texto secundario"
              description="Labels, metadatos, texto de apoyo"
              value={inkSecondary}
              onChange={(v) => { setInkSecondary(v); applyInkOpacities(v, inkTertiary) }}
            />
            <OpacitySlider
              label="Texto terciario"
              description="Hints, placeholders, valores hex"
              value={inkTertiary}
              onChange={(v) => { setInkTertiary(v); applyInkOpacities(inkSecondary, v) }}
            />
          </div>
        </section>

        <hr className="border-t border-line" />

        {/* Tipografía */}
        <section>
          <p className="text-sm font-medium text-ink mb-2">Tipografía</p>
          <p className="text-sm text-ink-60 mb-6">Se aplica a toda la aplicación y a los PDFs exportados.</p>
          <FontPicker value={fontName} onChange={handleFontChange} />
        </section>

      </div>
    </div>
  )
}
