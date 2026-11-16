/** Seguimiento de un prospecto enviado: cuándo se envió y qué acciones se han hecho después (las apunta el MCP o la ficha). Sin Firebase: lo usan la web y el MCP. */

export interface ProspectTouch {
  date: string   // YYYY-MM-DD
  what: string   // "Reenvío", "LinkedIn", "Otro socio"…
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

export interface FollowUp {
  sent: string            // fecha del envío
  sinceSent: number       // días desde el envío
  last: string            // última acción (envío o seguimiento)
  touches: ProspectTouch[] // acciones posteriores, por fecha
}

/** null si no está enviado o no hay fecha */
export function followUpOf(
  p: { stage: string; sentDate?: string; stageDate?: string; date?: string; touches?: ProspectTouch[] },
  today: string,
): FollowUp | null {
  if (p.stage !== 'enviado') return null
  const sent = p.sentDate || p.stageDate || p.date
  if (!sent) return null
  const touches = [...(p.touches ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  return { sent, sinceSent: daysBetween(sent, today), last: touches.length ? touches[touches.length - 1].date : sent, touches }
}
