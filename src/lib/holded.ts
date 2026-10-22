/**
 * Cliente mínimo de la API de Holded (solo servidor: usa HOLDED_API_KEY).
 * Docs: https://developers.holded.com/reference/list-documents-1
 */

const BASE = 'https://api.holded.com/api/invoicing/v1'

interface HoldedDoc {
  id?: string
  docNumber?: string
  contactName?: string
  date?: number          // unix (s)
  subtotal?: number      // base imponible
  tax?: number
  total?: number         // con impuestos
  paymentsPending?: number
  draft?: boolean | number | null
  status?: number
}

export interface BillingSummary {
  year: number
  base: number           // base imponible facturada (facturas − rectificativas)
  total: number          // con impuestos
  pending: number        // pendiente de cobro (facturas)
  invoices: number
  creditNotes: number
  byMonth: number[]      // base por mes (12)
  byClient: Array<{ name: string; base: number }>
  lastInvoice?: { number?: string; client?: string; date: string; base: number }
}

export function holdedConfigured(): boolean {
  return !!process.env.HOLDED_API_KEY?.trim()
}

/** La clave tal cual, sin espacios, saltos de línea ni comillas que se cuelan al pegarla */
function holdedKey(): string {
  const key = (process.env.HOLDED_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim()
  if (!key) throw new Error('HOLDED_API_KEY no configurada')
  return key
}

async function listDocs(type: 'invoice' | 'creditnote', start: number, end: number): Promise<HoldedDoc[]> {
  const key = holdedKey()
  const all: HoldedDoc[] = []
  const seen = new Set<string>()
  // Paginación defensiva: si la API ignora "page", la segunda página repite ids y paramos
  for (let page = 1; page <= 20; page++) {
    const url = `${BASE}/documents/${type}?starttmp=${start}&endtmp=${end}${page > 1 ? `&page=${page}` : ''}`
    const res = await fetch(url, { headers: { key, accept: 'application/json' }, next: { revalidate: 600 } })
    if (!res.ok) {
      if (page > 1) break // la API no pagina así: nos quedamos con lo que hay
      const body = (await res.text().catch(() => '')).slice(0, 200)
      // Solo la forma de la clave (nunca su valor) para diagnosticar "Invalid key"
      const shape = `clave de ${key.length} caracteres, ${/^[0-9a-f]+$/i.test(key) ? 'hexadecimal' : 'no hexadecimal'}`
      throw new Error(`Holded ${type}: HTTP ${res.status}${body ? ` — ${body}` : ''} (${shape})`)
    }
    const docs = (await res.json()) as HoldedDoc[]
    if (!Array.isArray(docs) || docs.length === 0) break
    const fresh = docs.filter((d) => d.id && !seen.has(d.id))
    if (fresh.length === 0) break
    fresh.forEach((d) => { seen.add(d.id!); all.push(d) })
  }
  return all
}

function isDraft(d: HoldedDoc): boolean {
  return d.draft === true || d.draft === 1
}

function base(d: HoldedDoc): number {
  if (typeof d.subtotal === 'number') return d.subtotal
  return (d.total || 0) - (d.tax || 0)
}

function madridDate(unix: number): Date {
  // Fecha local de Madrid para asignar mes sin desfases de zona
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(unix * 1000))
  return new Date(iso + 'T00:00:00')
}

export async function billingSummary(year: number): Promise<BillingSummary> {
  const start = Math.floor(Date.UTC(year, 0, 1, -1) / 1000)      // 1 ene 00:00 Madrid (aprox. UTC+1)
  const end = Math.floor(Date.UTC(year + 1, 0, 1, -1) / 1000) - 1
  const [invoices, credits] = await Promise.all([
    listDocs('invoice', start, end),
    listDocs('creditnote', start, end).catch((err) => {
      console.warn('[holded] Rectificativas no disponibles:', err instanceof Error ? err.message : err)
      return [] as HoldedDoc[]
    }),
  ])

  const byMonth = Array(12).fill(0) as number[]
  const clients = new Map<string, number>()
  let baseSum = 0, total = 0, pending = 0, nInv = 0, nCred = 0
  let last: BillingSummary['lastInvoice']

  for (const d of invoices) {
    if (isDraft(d) || !d.date) continue
    const b = base(d)
    const dt = madridDate(d.date)
    if (dt.getFullYear() !== year) continue
    nInv++
    baseSum += b
    total += d.total || 0
    pending += d.paymentsPending || 0
    byMonth[dt.getMonth()] += b
    const name = d.contactName || 'Sin cliente'
    clients.set(name, (clients.get(name) || 0) + b)
    if (!last || d.date * 1000 > new Date(last.date).getTime()) {
      last = { number: d.docNumber, client: d.contactName, date: dt.toISOString().slice(0, 10), base: b }
    }
  }
  for (const d of credits) {
    if (isDraft(d) || !d.date) continue
    const dt = madridDate(d.date)
    if (dt.getFullYear() !== year) continue
    // Las rectificativas pueden venir en negativo o en positivo: siempre restan
    const b = -Math.abs(base(d))
    nCred++
    baseSum += b
    total -= Math.abs(d.total || 0)
    byMonth[dt.getMonth()] += b
    const name = d.contactName || 'Sin cliente'
    clients.set(name, (clients.get(name) || 0) + b)
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    year,
    base: round(baseSum),
    total: round(total),
    pending: round(pending),
    invoices: nInv,
    creditNotes: nCred,
    byMonth: byMonth.map(round),
    byClient: [...clients.entries()].map(([name, b]) => ({ name, base: round(b) })).sort((a, b) => b.base - a.base),
    lastInvoice: last,
  }
}

/** Últimas facturas de un cliente con su detalle completo (solo lectura). */
export async function recentInvoices(clientNeedle: string, limit = 3): Promise<Record<string, unknown>[]> {
  const key = holdedKey()
  const now = Math.floor(Date.now() / 1000)
  const docs = await listDocs('invoice', now - 2 * 365 * 86400, now)
  const n = clientNeedle.toLowerCase()
  const matches = docs
    .filter((d) => !isDraft(d) && (d.contactName || '').toLowerCase().includes(n))
    .sort((a, b) => (b.date || 0) - (a.date || 0))
    .slice(0, limit)
  const details = await Promise.all(matches.map(async (d) => {
    const res = await fetch(`${BASE}/documents/invoice/${d.id}`, { headers: { key, accept: 'application/json' }, cache: 'no-store' })
    return res.ok ? ((await res.json()) as Record<string, unknown>) : (d as Record<string, unknown>)
  }))
  return details
}

/** Nombres de contacto con facturas en los últimos 2 años (para emparejar clientes) */
export async function invoicedContacts(): Promise<Array<{ name: string; count: number; last: string }>> {
  const now = Math.floor(Date.now() / 1000)
  const docs = await listDocs('invoice', now - 2 * 365 * 86400, now)
  const map = new Map<string, { count: number; last: number }>()
  for (const d of docs) {
    if (isDraft(d)) continue
    const name = d.contactName || 'Sin cliente'
    const cur = map.get(name) || { count: 0, last: 0 }
    cur.count++
    cur.last = Math.max(cur.last, d.date || 0)
    map.set(name, cur)
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, count: v.count, last: new Date(v.last * 1000).toISOString().slice(0, 10) }))
    .sort((a, b) => b.last.localeCompare(a.last))
}
