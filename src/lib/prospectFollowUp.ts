/** Seguimiento de un prospecto enviado: cuándo toca volver a escribir y por dónde. Sin Firebase: lo usan la web y el MCP. */

export interface ProspectTouch {
  date: string   // YYYY-MM-DD
  what: string   // "Reenvío", "LinkedIn", "Otro socio"…
}

/** Cadencia: días naturales desde el último toque (si cae en finde, pasa al lunes) */
export const FOLLOW_UP_STEPS: Array<{ after: number; label: string; what: string }> = [
  { after: 4, label: 'Reenviar el email', what: 'Reenvío' },
  { after: 5, label: 'Escribirle por LinkedIn', what: 'LinkedIn' },
  { after: 7, label: 'Probar con otro socio', what: 'Otro socio' },
  { after: 10, label: 'Último toque o descartar', what: 'Último toque' },
]

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function skipWeekend(iso: string) {
  const day = new Date(iso + 'T00:00:00').getDay()
  return day === 6 ? addDays(iso, 2) : day === 0 ? addDays(iso, 1) : iso
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

export interface FollowUp {
  sent: string            // fecha del primer envío
  sinceSent: number       // días desde el envío
  last: string            // último toque (envío o seguimiento)
  step?: { label: string; what: string }
  dueDate?: string        // cuándo toca el siguiente paso
  due: boolean            // ya toca (hoy o atrasado)
  overdue: number         // días de retraso
}

/** null si no está enviado, ya respondió o no hay fecha */
export function followUpOf(
  p: { stage: string; sentDate?: string; stageDate?: string; date?: string; response?: string; touches?: ProspectTouch[] },
  today: string,
): FollowUp | null {
  if (p.stage !== 'enviado' || p.response) return null
  const sent = p.sentDate || p.stageDate || p.date
  if (!sent) return null
  const touches = [...(p.touches ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const last = touches.length ? touches[touches.length - 1].date : sent
  const step = FOLLOW_UP_STEPS[Math.min(touches.length, FOLLOW_UP_STEPS.length - 1)]
  const finished = touches.length >= FOLLOW_UP_STEPS.length
  const dueDate = finished ? undefined : skipWeekend(addDays(last, step.after))
  const overdue = dueDate ? daysBetween(dueDate, today) : 0
  return {
    sent,
    sinceSent: daysBetween(sent, today),
    last,
    step: finished ? undefined : { label: step.label, what: step.what },
    dueDate,
    due: !!dueDate && overdue >= 0,
    overdue: Math.max(0, overdue),
  }
}
