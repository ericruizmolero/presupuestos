'use client'

import type { Font } from '@/types/quote'

let activeFontName: string | null = null

export function applySystemFont(fontFamily: string) {
  if (activeFontName === fontFamily) return
  const existing = document.getElementById('custom-font-face')
  if (existing) existing.remove()
  document.documentElement.style.setProperty('--font-body', `'${fontFamily}', Inter, sans-serif`)
  activeFontName = fontFamily
}

export function injectFont(font: Font) {
  if (activeFontName === font.name) return

  const existing = document.getElementById('custom-font-face')
  if (existing) existing.remove()

  const style = document.createElement('style')
  style.id = 'custom-font-face'
  style.textContent = `
    @font-face {
      font-family: '${font.name}';
      src: url('${font.url}') format('${font.format === 'ttf' ? 'truetype' : font.format === 'otf' ? 'opentype' : 'woff2'}');
      font-weight: 100 900;
      font-display: swap;
    }
  `
  document.head.appendChild(style)

  document.documentElement.style.setProperty('--font-body', `'${font.name}', Inter, sans-serif`)
  activeFontName = font.name
}

export function resetFont() {
  const existing = document.getElementById('custom-font-face')
  if (existing) existing.remove()
  document.documentElement.style.removeProperty('--font-body')
  activeFontName = null
}

export interface LocalFont {
  family: string
  fullName: string
  postscriptName: string
  style: string
}

export async function queryLocalFonts(): Promise<LocalFont[]> {
  if (!('queryLocalFonts' in window)) return []
  try {
    // @ts-expect-error Local Font Access API
    const fonts: LocalFont[] = await window.queryLocalFonts()
    // Deduplicate by family, keep one entry per family
    const seen = new Set<string>()
    return fonts.filter((f) => {
      if (seen.has(f.family)) return false
      seen.add(f.family)
      return true
    }).sort((a, b) => a.family.localeCompare(b.family))
  } catch {
    return []
  }
}
