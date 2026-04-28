export interface Palette {
  id: string
  name: string
  bg: string
  accent: string
  vars: Record<string, string>
}

export const PALETTES: Palette[] = [
  {
    id: 'noir',
    name: 'Noir',
    bg: '#ffffff',
    accent: '#1A1A1A',
    vars: {
      '--color-accent':    '#1A1A1A',
      '--color-on-accent': '#ffffff',
      '--color-paper':     '#ffffff',
      '--color-surface':   '#FAFAFA',
      '--color-ink':       '#1A1A1A',
      '--color-line':      '#E5E5E5',
    },
  },
  {
    id: 'encre',
    name: 'Encre',
    bg: '#F8F7F5',
    accent: '#1B3A5C',
    vars: {
      '--color-accent':    '#1B3A5C',
      '--color-on-accent': '#ffffff',
      '--color-paper':     '#F8F7F5',
      '--color-surface':   '#EFEDE9',
      '--color-ink':       '#1B3A5C',
      '--color-line':      '#DDD9D3',
    },
  },
  {
    id: 'pierre',
    name: 'Pierre',
    bg: '#FAFAF8',
    accent: '#3A3430',
    vars: {
      '--color-accent':    '#3A3430',
      '--color-on-accent': '#ffffff',
      '--color-paper':     '#FAFAF8',
      '--color-surface':   '#F2F0EC',
      '--color-ink':       '#3A3430',
      '--color-line':      '#E3DFDA',
    },
  },
  {
    id: 'mousse',
    name: 'Mousse',
    bg: '#F8FAF9',
    accent: '#2A4438',
    vars: {
      '--color-accent':    '#2A4438',
      '--color-on-accent': '#ffffff',
      '--color-paper':     '#F8FAF9',
      '--color-surface':   '#EDF4F0',
      '--color-ink':       '#2A4438',
      '--color-line':      '#D8E4DF',
    },
  },
  {
    id: 'bordeaux',
    name: 'Bordeaux',
    bg: '#FDF9F9',
    accent: '#5C1E2D',
    vars: {
      '--color-accent':    '#5C1E2D',
      '--color-on-accent': '#ffffff',
      '--color-paper':     '#FDF9F9',
      '--color-surface':   '#F5EEEF',
      '--color-ink':       '#5C1E2D',
      '--color-line':      '#E8D5D8',
    },
  },
]

export interface ThemeColors {
  accent:   string
  onAccent: string
  paper:    string
  surface:  string
  ink:      string
  line:     string
}

const TOKEN_MAP: Record<keyof ThemeColors, string> = {
  accent:   '--color-accent',
  onAccent: '--color-on-accent',
  paper:    '--color-paper',
  surface:  '--color-surface',
  ink:      '--color-ink',
  line:     '--color-line',
}

export function applyThemeColors(colors: ThemeColors) {
  const root = document.documentElement
  Object.entries(TOKEN_MAP).forEach(([key, cssVar]) => {
    root.style.setProperty(cssVar, colors[key as keyof ThemeColors])
  })
}

export function applyPalette(paletteId: string) {
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]
  const root = document.documentElement
  Object.entries(palette.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

export function paletteToColors(paletteId: string): ThemeColors {
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]
  return {
    accent:   palette.vars['--color-accent'],
    onAccent: palette.vars['--color-on-accent'],
    paper:    palette.vars['--color-paper'],
    surface:  palette.vars['--color-surface'],
    ink:      palette.vars['--color-ink'],
    line:     palette.vars['--color-line'],
  }
}

export function getPalette(paletteId: string): Palette {
  return PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]
}

export function applyInkOpacities(secondary: number, tertiary: number) {
  const root = document.documentElement
  root.style.setProperty('--ink-opacity-secondary', `${secondary}%`)
  root.style.setProperty('--ink-opacity-tertiary', `${tertiary}%`)
}
