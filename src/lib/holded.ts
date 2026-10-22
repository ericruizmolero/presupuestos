/**
 * Cliente mínimo de la API v2 de Holded (solo servidor: usa HOLDED_API_KEY, un token "pat_…").
 * Docs: https://www.holded.com/es/desarrolladores — Bearer, paginación por cursor
 * ({ items, cursor, has_more }), importes como cadenas ("121.00"), fechas YYYY-MM-DD.
 */

const BASE = 'https://api.holded.com/api/v2'

export interface V2Doc {
  id?: string
  document_number?: string
  contact_id?: string
  contact_name?: string
  date?: string
  due_date?: string
  subtotal?: string | number
  tax?: string | number
  total?: string | number
  payments_pending?: string | number
  status?: string
  draft?: boolean
  [k: string]: unknown
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

/** La clave sin espacios, saltos de línea ni comillas que se cuelan al pegarla */
function holdedKey(): string {
  const key = (process.env.HOLDED_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim()
  if (!key) throw new Error('HOLDED_API_KEY no configurada')
  return key
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${holdedKey()}`, Accept: 'application/json' }
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'))
  return Number.isFinite(n) ? n : 0
}

async function apiError(res: Response, what: string): Promise<Error> {
  const body = (await res.text().catch(() => '')).slice(0, 200)
  return new Error(`Holded ${what}: HTTP ${res.status}${body ? ` — ${body}` : ''}`)
}

/** Recorre todas las páginas de un listado */
export async function listAll(path: 'invoices' | 'credit-notes', params: Record<string, string>, fresh = false): Promise<V2Doc[]> {
  const all: V2Doc[] = []
  let cursor: string | undefined
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ limit: '100', ...params, ...(cursor ? { cursor } : {}) })
    const res = await fetch(`${BASE}/${path}?${qs}`, fresh ? { headers: authHeaders(), cache: 'no-store' } : { headers: authHeaders(), next: { revalidate: 600 } })
    if (!res.ok) throw await apiError(res, path)
    const data = (await res.json()) as { items?: V2Doc[]; cursor?: string; has_more?: boolean }
    all.push(...(data.items ?? []))
    if (!data.has_more || !data.cursor) break
    cursor = data.cursor
  }
  return all
}

const range = (year: number) => ({
  start_date: `${year}-01-01T00:00:00+01:00`,
  end_date: `${year}-12-31T23:59:59+01:00`,
})

export async function billingSummary(year: number): Promise<BillingSummary> {
  const [invoices, credits] = await Promise.all([
    listAll('invoices', { ...range(year), approval_status: 'approved' }),
    listAll('credit-notes', { ...range(year), approval_status: 'approved' }).catch((err) => {
      console.warn('[holded] Rectificativas no disponibles:', err instanceof Error ? err.message : err)
      return [] as V2Doc[]
    }),
  ])

  const byMonth = Array(12).fill(0) as number[]
  const clients = new Map<string, number>()
  let base = 0, total = 0, pending = 0, nInv = 0, nCred = 0
  let last: BillingSummary['lastInvoice']

  for (const d of invoices) {
    if (d.draft || !d.date || !d.date.startsWith(String(year)) || d.status === 'cancelled') continue
    const b = num(d.subtotal)
    nInv++
    base += b
    total += num(d.total)
    pending += num(d.payments_pending)
    byMonth[Number(d.date.slice(5, 7)) - 1] += b
    const name = d.contact_name || 'Sin cliente'
    clients.set(name, (clients.get(name) || 0) + b)
    if (!last || d.date > last.date) last = { number: d.document_number, client: d.contact_name, date: d.date.slice(0, 10), base: b }
  }
  for (const d of credits) {
    if (d.draft || !d.date || !d.date.startsWith(String(year)) || d.status === 'cancelled') continue
    // Las rectificativas pueden venir en negativo o en positivo: siempre restan
    const b = -Math.abs(num(d.subtotal))
    nCred++
    base += b
    total -= Math.abs(num(d.total))
    byMonth[Number(d.date.slice(5, 7)) - 1] += b
    const name = d.contact_name || 'Sin cliente'
    clients.set(name, (clients.get(name) || 0) + b)
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    year,
    base: round(base),
    total: round(total),
    pending: round(pending),
    invoices: nInv,
    creditNotes: nCred,
    byMonth: byMonth.map(round),
    byClient: [...clients.entries()].map(([name, b]) => ({ name, base: round(b) })).sort((a, b) => b.base - a.base),
    lastInvoice: last,
  }
}

function lastTwoYears(): Record<string, string> {
  const now = new Date()
  const from = new Date(now.getTime() - 2 * 365 * 86400000)
  return { start_date: from.toISOString(), end_date: now.toISOString(), approval_status: 'approved', sort: '-date' }
}

/** Últimas facturas de un cliente con su detalle completo (solo lectura). */
export async function recentInvoices(clientNeedle: string, limit = 3): Promise<Record<string, unknown>[]> {
  const docs = await listAll('invoices', lastTwoYears())
  const n = clientNeedle.toLowerCase()
  const matches = docs
    .filter((d) => !d.draft && (d.contact_name || '').toLowerCase().includes(n))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit)
  return Promise.all(matches.map(async (d) => {
    const res = await fetch(`${BASE}/invoices/${d.id}`, { headers: authHeaders(), cache: 'no-store' })
    return res.ok ? ((await res.json()) as Record<string, unknown>) : (d as Record<string, unknown>)
  }))
}

/** Contactos con facturas en los últimos 2 años (para emparejar clientes) */
export async function invoicedContacts(): Promise<Array<{ name: string; count: number; last: string }>> {
  const docs = await listAll('invoices', lastTwoYears())
  const map = new Map<string, { count: number; last: string }>()
  for (const d of docs) {
    if (d.draft) continue
    const name = d.contact_name || 'Sin cliente'
    const cur = map.get(name) || { count: 0, last: '' }
    cur.count++
    if (String(d.date) > cur.last) cur.last = String(d.date).slice(0, 10)
    map.set(name, cur)
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.last.localeCompare(a.last))
}

export async function getInvoice(id: string): Promise<V2Doc> {
  const res = await fetch(`${BASE}/invoices/${id}`, { headers: authHeaders(), cache: 'no-store' })
  if (!res.ok) throw await apiError(res, `invoice ${id}`)
  return (await res.json()) as V2Doc
}

/**
 * Crea una factura de venta. La API v2 la crea como BORRADOR (aprobar es otro endpoint
 * que esta app no usa): sin número hasta que se apruebe en Holded.
 */
export async function createInvoiceDraft(body: Record<string, unknown>): Promise<V2Doc> {
  const res = await fetch(`${BASE}/invoices`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw await apiError(res, 'crear factura')
  return (await res.json()) as V2Doc
}
