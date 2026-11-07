'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { FontPicker } from '@/components/settings/FontPicker'
import { upsertCompany, getUserCompanyId, setUserCompanyId } from '@/lib/firestore/companies'
import { applySystemFont, injectFont } from '@/lib/fonts'
import { applyThemeColors, applyInkOpacities, paletteToColors, type ThemeColors } from '@/lib/theme'
import { nanoid } from 'nanoid'
import { Check, Loader2, RotateCcw } from 'lucide-react'
import { ColorPicker } from '@/components/ui/ColorPicker'

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

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
      <ColorPicker value={value} onChange={onChange} />
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS)
  const [fontName, setFontName] = useState('')
  const [inkSecondary, setInkSecondary] = useState(73)
  const [inkTertiary, setInkTertiary] = useState(67)

  const [statusVisible, setStatusVisible] = useState(false)
  const isFirstRender = useRef(true)
  const pendingLoad = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestData = useRef({ colors, fontName, inkSecondary, inkTertiary })

  useEffect(() => {
    const t = setTimeout(() => setStatusVisible(true), 5000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (company) {
      pendingLoad.current = true
      setColors(company.themeColors ?? paletteToColors(company.paletteId || 'noir'))
      setFontName(company.defaultFontName || '')
      setInkSecondary(company.inkOpacitySecondary ?? 60)
      setInkTertiary(company.inkOpacityTertiary ?? 40)
    }
  }, [company])

  // Keep latestData in sync
  useEffect(() => {
    latestData.current = { colors, fontName, inkSecondary, inkTertiary }
  }, [colors, fontName, inkSecondary, inkTertiary])

  // Auto-save
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (pendingLoad.current) { pendingLoad.current = false; return }

    setSaveStatus('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (clearTimer.current) clearTimeout(clearTimer.current)

    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        if (!user) throw new Error('No user')
        let cid = await getUserCompanyId(user.uid)
        if (!cid) {
          cid = `company_${nanoid(10)}`
          await setUserCompanyId(user.uid, cid)
        }
        const { colors: c, fontName: fn, inkSecondary: is, inkTertiary: it } = latestData.current
        await upsertCompany(cid, { themeColors: c, defaultFontName: fn, inkOpacitySecondary: is, inkOpacityTertiary: it })
        await refreshCompany()
        setSaveStatus('saved')
        clearTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 1200)
  }, [colors, fontName, inkSecondary, inkTertiary]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <span className={`flex items-center gap-1.5 text-xs text-ink-40 h-8 transition-opacity duration-300 ${statusVisible ? 'opacity-100' : 'opacity-0'}`}>
          {saveStatus === 'saving' || saveStatus === 'pending' ? (
            <><Loader2 size={12} className="animate-spin" /> Guardando…</>
          ) : saveStatus === 'saved' ? (
            <><Check size={12} /> Guardado</>
          ) : saveStatus === 'error' ? (
            <span className="text-red-500">Error al guardar</span>
          ) : null}
        </span>
      </div>

      <div className="space-y-12">

        {/* Custom tokens */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-sm font-medium text-ink">Personalizar</p>
            <button
              onClick={() => {
                setColors(DEFAULT_COLORS)
                applyThemeColors(DEFAULT_COLORS)
                setInkSecondary(73)
                setInkTertiary(67)
                applyInkOpacities(73, 67)
              }}
              className="flex items-center gap-1.5 text-xs text-ink-40 hover:text-ink transition-colors"
            >
              <RotateCcw size={11} strokeWidth={1.5} />
              Restablecer
            </button>
          </div>
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
