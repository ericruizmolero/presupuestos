import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import { applySystemFont, injectFont } from './fonts'
import { applyPalette, applyThemeColors, applyInkOpacities } from './theme'
import type { Company } from '@/types/quote'

/** Tipografía y colores de la ficha del estudio en las páginas públicas (las reglas permiten leer la ficha por id) */
export async function applyCompanyTheme(companyId: string) {
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
      else applySystemFont(c.defaultFontName)
    }
  } catch {
    // sin ficha: tipografía por defecto
  }
}
