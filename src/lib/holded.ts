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
  return !!process.env.HOLDED_API_KEY
}

async function listDocs(type: 'invoice' | 'creditnote', start: number, end: number): Promise<HoldedDoc[]> {
  const key = process.env.HOLDED_API_KEY
  if (!key) throw new Error('HOLDED_API_KEY no configurada')
  const all: HoldedDoc[] = []
  const seen = new Set<string>()
  // Paginación defensiva: si la API ignora "page", la segunda página repite ids y paramos
  for (let page = 1; page <= 20; page++) {
    const url = `${BASE}/documents/${type}?starttmp=${start}&endtmp=${end}&page=${page}`
    const res = await fetch(url, { headers: { key, accept: 'application/json' }, next: { revalidate: 600 } })
    if (!res.ok) throw new Error(`Holded ${type}: HTTP ${res.status}`)
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
  const [invoices, credits] = await Promise.all([listDocs('invoice', start, end), listDocs('creditnote', start, end)])

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
