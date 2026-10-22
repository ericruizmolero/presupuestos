/** Utilidades compartidas del tablón del estudio (fechas, responsables, formatos). */

export type Person = 'Eric' | 'Andoni' | 'Eric y Andoni'

export const NOVEDADES_DIAS_MAX = 30 // tope aunque lleves más sin entrar
export const NEWS_LIMIT = 12

export const HEALTH: Array<{ id: 'verde' | 'ambar' | 'rojo'; color: string; label: string }> = [
  { id: 'verde', color: '#16A34A', label: 'En orden' },
  { id: 'ambar', color: '#D97706', label: 'Atención' },
  { id: 'rojo', color: '#DC2626', label: 'En riesgo' },
]

export const QUOTE_STATUS: Record<string, string> = {
  borrador: 'borrador', enviado: 'enviado', aceptado: 'aceptado', rechazado: 'rechazado',
}

export function ownerOf(owner?: string): Person {
  return owner === 'Eric' || owner === 'Andoni' ? owner : 'Eric y Andoni'
}

export function ownerLabel(owner?: string): string {
  const o = ownerOf(owner)
  return o === 'Eric y Andoni' ? 'Los dos' : o
}

/** Responsable efectivo de una nota: su excepción o el owner del proyecto */
export function effectiveWho(who: string | undefined, owner: string | undefined): string {
  return who ?? ownerOf(owner)
}

export function includesMe(effective: string, me: string): boolean {
  return effective === me || effective === 'Eric y Andoni'
}

/** El estudio son dos: con el hint de la cuenta basta */
export function myName(displayName?: string | null, email?: string | null): 'Eric' | 'Andoni' {
  const hint = `${displayName || ''} ${email || ''}`.toLowerCase()
  return hint.includes('andoni') ? 'Andoni' : 'Eric'
}

/** "@andoni revisar formulario" → { text: 'revisar formulario', who: 'Andoni' } */
export function parseMention(raw: string): { text: string; who?: Person } {
  const m = raw.match(/(^|\s)@(eric|andoni|ambos|los\s?dos|juntos)\b/i)
  if (!m) return { text: raw.trim() }
  const tag = m[2].toLowerCase()
  const who: Person = tag === 'eric' ? 'Eric' : tag === 'andoni' ? 'Andoni' : 'Eric y Andoni'
  const text = (raw.slice(0, m.index) + raw.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, ' ').trim()
  return { text, who }
}

export function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysUntil(date: string, today: string): number {
  return Math.round((new Date(date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
}

/** Próximo día de la semana (0 = domingo … 5 = viernes), estrictamente después de hoy */
export function nextWeekday(today: string, weekday: number): string {
  const d = new Date(today + 'T00:00:00')
  const diff = ((weekday - d.getDay() + 7) % 7) || 7
  return shiftDays(today, diff)
}

/** "mié 28 oct" */
export function fmtDay(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "22 oct" */
export function fmtShort(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy'
  if (daysUntil(date, today) === -1) return 'Ayer'
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Cuenta atrás de una entrega con su tono (texto) y su pastilla (fondo + texto) */
export function countdown(date: string, today: string): { text: string; tone: string; pill: string } {
  const d = daysUntil(date, today)
  const red = { tone: 'text-[#B91C1C]', pill: 'bg-[#FEE2E2] text-[#B91C1C]' }
  const amber = { tone: 'text-[#B45309]', pill: 'bg-[#FEF3C7] text-[#92400E]' }
  const calm = { tone: 'text-ink-60', pill: 'bg-surface text-ink-60 border border-line' }
  if (d < 0) return { text: `vencido ${-d}d`, ...red }
  if (d === 0) return { text: 'hoy', ...red }
  if (d === 1) return { text: 'mañana', ...red }
  if (d <= 7) return { text: `en ${d} días`, ...amber }
  return { text: `en ${d} días`, ...calm }
}

export function nrm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Mismo proyecto aunque el nombre difiera ("Playground" ↔ "Playground IEP") */
export function sameProject(a: string, b: string): boolean {
  const x = nrm(a)
  const y = nrm(b)
  return !!x && !!y && (x.includes(y) || y.includes(x))
}

export function fmtH(h: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(h)
}

/** Fecha de Firestore (Timestamp, {seconds}, string ISO o Date) → YYYY-MM-DD en Madrid */
export function toISODate(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 10)
  let d: Date | null = null
  const o = v as { toDate?: () => Date; seconds?: number }
  if (typeof o.toDate === 'function') d = o.toDate()
  else if (typeof o.seconds === 'number') d = new Date(o.seconds * 1000)
  else if (v instanceof Date) d = v
  if (!d || isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/**
 * Detecta una fecha en el texto de una nota: "23/10", "23/10/26", "23/10 10:00",
 * "mañana 10:00", "hoy a las 16h". Sin año, el más cercano que no esté muy en el pasado.
 */
export function parseWhen(text: string, today: string): { due?: string; time?: string } {
  const t = text.toLowerCase()
  const timeM = t.match(/\b(\d{1,2})[:.h](\d{2})\b|\b(\d{1,2})\s?h\b/)
  const time = timeM
    ? `${String(Number(timeM[1] ?? timeM[3])).padStart(2, '0')}:${timeM[2] ?? '00'}`
    : undefined
  const validTime = time && Number(time.slice(0, 2)) < 24 ? time : undefined

  const dm = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (dm) {
    const d = Number(dm[1]), m = Number(dm[2])
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      let y = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : Number(today.slice(0, 4))
      let iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (!dm[3] && daysUntil(iso, today) < -60) { y++; iso = `${y}-${iso.slice(5)}` }
      return { due: iso, time: validTime }
    }
  }
  if (/\bpasado mañana\b/.test(t)) return { due: shiftDays(today, 2), time: validTime }
  if (/\bmañana\b/.test(t) && validTime) return { due: shiftDays(today, 1), time: validTime }
  if (/\bhoy\b/.test(t) && validTime) return { due: today, time: validTime }
  return {}
}

/** "vie 23 oct · 10:00" */
export function fmtWhen(due: string, time?: string): string {
  const d = new Date(due + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  return time ? `${d} · ${time}` : d
}
