'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getAudit, type Audit } from '@/lib/firestore/audits'
import { AuditView } from '@/components/audit/AuditView'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { applySystemFont, injectFont } from '@/lib/fonts'
import { applyPalette, applyThemeColors, applyInkOpacities } from '@/lib/theme'
import type { Company } from '@/types/quote'

/** Fuentes de sistema que no tiene el cliente instalado: se cargan de Fontshare (gratuitas) */
const FONTSHARE: Record<string, string> = { satoshi: 'satoshi@400,500,700' }
function loadWebFont(name: string) {
  const spec = FONTSHARE[name.toLowerCase()]
  if (!spec || document.getElementById('audit-webfont')) return
  const link = document.createElement('link')
  link.id = 'audit-webfont'
  link.rel = 'stylesheet'
  link.href = `https://api.fontshare.com/v2/css?f[]=${spec}&display=swap`
  document.head.appendChild(link)
}

/** Tipografía y colores de la ficha del estudio, como en los presupuestos públicos (las reglas permiten leerla por id) */
async function applyCompanyTheme(companyId: string) {
  try {
    const snap = await getDoc(doc(db, 'companies', companyId))
    if (!snap.exists()) return
    const c = snap.data() as Company
    if (c.themeColors) applyThemeColors(c.themeColors)
    else if (c.paletteId) applyPalette(c.paletteId)
    if (c.inkOpacitySecondary != null || c.inkOpacityTertiary != null) applyInkOpacities(c.inkOpacitySecondary ?? 60, c.inkOpacityTertiary ?? 40)
    if (c.defaultFontName) {
      const f = c.fonts?.find((x) => x.name === c.defaultFontName)
      if (f) injectFont(f)
      else {
        loadWebFont(c.defaultFontName)
        applySystemFont(c.defaultFontName)
      }
    }
  } catch {
    // sin ficha: se ve con la tipografía por defecto
  }
}

export function AuditClient() {
  const { slug } = useParams<{ slug: string }>()
  const [audit, setAudit] = useState<Audit | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    if (!slug) return
    getAudit(slug)
      .then(async (a) => {
        if (!a) { setState('notfound'); return }
        await applyCompanyTheme(a.companyId)
        setAudit(a)
        document.title = a.clientCompany ? (a.language === 'en' ? `Website audit for ${a.clientCompany} | Savvia` : `Auditoría web de ${a.clientCompany} | Savvia`) : 'Savvia'
        setState('ready')
      })
      .catch(() => setState('notfound'))
  }, [slug])

  if (state === 'loading') return <main className="min-h-screen bg-paper flex items-center justify-center text-sm text-ink-40">…</main>
  if (state === 'notfound' || !audit) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center px-6">
        <p className="text-sm text-ink-40">Esta auditoría no existe o ya no está disponible.</p>
      </main>
    )
  }
  return <main className="min-h-screen bg-paper"><AuditView audit={audit} /></main>
}
