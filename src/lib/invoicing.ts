/**
 * Facturas de fin de mes a partir de las horas registradas.
 *
 * Cada cliente se factura calcando su ÚLTIMA factura real en Holded (contacto, concepto,
 * impuestos, cuenta contable, forma de pago, diseño); solo cambian horas, mes, fecha y,
 * en divisa, el tipo de cambio. Se crean siempre como BORRADOR y nunca dos del mismo mes.
 */
import { listAll, getInvoice, createInvoiceDraft, updateInvoice, type V2Doc } from './holded'

export interface TimeData {
  projects: Array<{ id: string; name?: string; hourlyRate?: number }>
  entries: Array<{ projectId: string; date?: string; hours?: number }>
}

interface Profile {
  key: string
  label: string
  projectMatch: string          // nombre del proyecto de horas (substring)
  contactMatch: string          // contacto en Holded (substring, mayúsculas indiferentes)
  language: 'es' | 'en'
  currency: 'EUR' | 'USD'
  /** Detalle de la línea para el mes; null = reutilizar el de la plantilla tal cual */
  lineDesc: ((m: MonthInfo) => string) | null
  /** Concepto propio cuando la plantilla no es por horas (Kymatio venía de precio cerrado) */
  lineName?: string
  /** Vencimiento: fin del mes siguiente (Playground) */
  dueNextMonthEnd?: boolean
}

interface MonthInfo { ym: string; es: string; en: string; lastDay: string }

export const PROFILES: Profile[] = [
  {
    key: 'farco', label: 'Farco', projectMatch: 'farco', contactMatch: 'farrell',
    language: 'es', currency: 'EUR', lineDesc: (m) => `Final ${m.es}`,
  },
  {
    key: 'vidflare', label: 'Greet.video (Hanno y Philipp)', projectMatch: 'vidflare', contactMatch: 'mjoo',
    language: 'en', currency: 'EUR', lineDesc: (m) => `Hours ${m.en}`,
  },
  {
    key: 'playground', label: 'Playground', projectMatch: 'playground', contactMatch: 'playground',
    language: 'en', currency: 'USD', lineDesc: null, dueNextMonthEnd: true,
  },
  {
    key: 'kymatio', label: 'Kymatio', projectMatch: 'kymatio', contactMatch: 'human affinity',
    language: 'es', currency: 'EUR', lineDesc: (m) => `Horas ${m.es}`,
    lineName: 'Bolsa de horas de diseño y desarrollo Webflow',
  },
]

const ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function monthInfo(ym: string): MonthInfo {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { ym, es: ES[m - 1], en: EN[m - 1], lastDay: `${ym}-${String(last).padStart(2, '0')}` }
}

function nextMonthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return monthInfo(`${ny}-${String(nm).padStart(2, '0')}`).lastDay
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'))
  return Number.isFinite(n) ? n : 0
}
const r2 = (n: number) => Math.round(n * 100) / 100

/** Tipo de cambio de referencia del BCE (EUR→divisa) en una fecha (o el día hábil anterior) */
async function ecbRate(date: string, to: string): Promise<{ rate: number; date: string }> {
  const urls = [
    `https://api.frankfurter.dev/v1/${date}?base=EUR&symbols=${to}`,
    `https://api.frankfurter.app/${date}?from=EUR&to=${to}`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const data = (await res.json()) as { rates?: Record<string, number>; date?: string }
      const rate = data.rates?.[to]
      if (rate) return { rate, date: data.date || date }
    } catch { /* probar la siguiente fuente */ }
  }
  throw new Error(`No se pudo obtener el cambio EUR→${to} del ${date}`)
}

/** Impuesto % a partir de los ids de Holded */
function taxPct(taxes: unknown): number {
  const ids = Array.isArray(taxes) ? taxes.map(String) : []
  const m = ids.map((t) => t.match(/iva_(\d+)/)).find(Boolean)
  return m ? Number(m[1]) : 0
}

export interface DraftProposal {
  key: string
  label: string
  month: string
  hours: number
  priceEUR: number
  price: number
  currency: string
  rate?: { rate: number; date: string; source?: string }
  base: number
  taxPct: number
  total: number
  contactName: string
  templateNumber?: string
  lineName: string
  lineDesc: string
  date: string
  dueDate?: string
  language: string
  existing?: string[]          // facturas ya presentes ese mes (bloquean la creación)
  body: Record<string, unknown>
  skipped?: string             // motivo por el que no se propone
}

export async function proposeDraft(profile: Profile, ym: string, time: TimeData): Promise<DraftProposal> {
  const m = monthInfo(ym)
  const base: DraftProposal = {
    key: profile.key, label: profile.label, month: ym, hours: 0, priceEUR: 0, price: 0, currency: profile.currency,
    base: 0, taxPct: 0, total: 0, contactName: '', lineName: '', lineDesc: '', date: m.lastDay, language: profile.language, body: {},
  }

  // Horas del mes del proyecto de horas
  const project = time.projects.find((p) => (p.name || '').toLowerCase().includes(profile.projectMatch))
  if (!project) return { ...base, skipped: 'No hay proyecto de horas con ese nombre' }
  const hours = r2(time.entries
    .filter((e) => e.projectId === project.id && e.date?.startsWith(ym))
    .reduce((s, e) => s + (e.hours || 0), 0))
  if (hours <= 0) return { ...base, skipped: 'Sin horas registradas este mes' }
  const priceEUR = project.hourlyRate || 0
  if (!priceEUR) return { ...base, hours, skipped: 'El proyecto de horas no tiene tarifa' }

  // Plantilla: última factura aprobada del contacto en los últimos 2 años
  const now = new Date()
  const all = await listAll('invoices', {
    start_date: new Date(now.getTime() - 2 * 365 * 86400000).toISOString(),
    end_date: now.toISOString(), approval_status: 'approved', sort: '-date',
  }, true)
  const mine = all
    .filter((d) => (d.contact_name || '').toLowerCase().includes(profile.contactMatch))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  if (!mine.length) return { ...base, hours, priceEUR, skipped: 'No hay facturas previas de este contacto en Holded' }
  const tpl = await getInvoice(String(mine[0].id))
  const tplLine = ((tpl.lines as Array<Record<string, unknown>>) || [])[0] || {}

  // ¿Ya hay factura (borrador o aprobada) de este contacto en ese mes?
  const monthDocs = await listAll('invoices', {
    contact_id: String(tpl.contact_id),
    start_date: `${ym}-01T00:00:00+01:00`,
    end_date: `${m.lastDay}T23:59:59+02:00`,
  }, true)
  const existing = monthDocs.filter((d) => d.status !== 'cancelled')
    .map((d) => `${d.document_number || 'borrador'} (${String(d.date).slice(0, 10)}, ${d.draft ? 'borrador' : 'aprobada'})`)

  // Precio y divisa
  let price = priceEUR
  let rate: DraftProposal['rate']
  if (profile.currency !== 'EUR') {
    rate = await ecbRate(m.lastDay, profile.currency)
    price = r2(priceEUR * rate.rate)
  }
  const pct = taxPct(tplLine.taxes)
  const lineBase = r2(hours * price)
  const lineName = profile.lineName ?? String(tplLine.name || tpl.description || '')
  const lineDesc = profile.lineDesc ? profile.lineDesc(m) : String(tplLine.description || '')
  const dueDate = profile.dueNextMonthEnd ? nextMonthEnd(ym) : undefined

  const item: Record<string, unknown> = {
    name: lineName,
    description: lineDesc,
    units: hours,
    price,
    discount: 0,
    taxes: Array.isArray(tplLine.taxes) ? tplLine.taxes : [],
    retention: num(tplLine.retention),
    ...(tplLine.account ? { account: tplLine.account } : {}),
  }
  const body: Record<string, unknown> = {
    contact_id: tpl.contact_id,
    description: profile.lineName ?? tpl.description,
    date: m.lastDay,
    ...(dueDate ? { due_date: dueDate } : {}),
    language: profile.language,
    currency: profile.currency,
    items: [item],
    ...(tpl.payment_method_id ? { payment_method_id: tpl.payment_method_id } : {}),
    ...(tpl.design_id ? { design_id: tpl.design_id } : {}),
  }

  return {
    ...base,
    hours, priceEUR, price, rate,
    base: lineBase, taxPct: pct, total: r2(lineBase * (1 + pct / 100)),
    contactName: String(tpl.contact_name || ''),
    templateNumber: tpl.document_number as string | undefined,
    lineName, lineDesc, dueDate, existing, body,
  }
}

export async function proposeAll(ym: string, time: TimeData): Promise<DraftProposal[]> {
  const out: DraftProposal[] = []
  for (const p of PROFILES) {
    try {
      out.push(await proposeDraft(p, ym, time))
    } catch (err) {
      out.push({
        key: p.key, label: p.label, month: ym, hours: 0, priceEUR: 0, price: 0, currency: p.currency, base: 0, taxPct: 0,
        total: 0, contactName: '', lineName: '', lineDesc: '', date: '', language: p.language, body: {},
        skipped: `Error: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
  return out
}

export async function createDraft(key: string, ym: string, time: TimeData): Promise<{ proposal: DraftProposal; created?: V2Doc }> {
  const profile = PROFILES.find((p) => p.key === key)
  if (!profile) throw new Error(`Cliente desconocido: ${key}. Opciones: ${PROFILES.map((p) => p.key).join(', ')}`)
  const proposal = await proposeDraft(profile, ym, time)
  if (proposal.skipped) return { proposal }
  if (proposal.existing?.length) return { proposal }
  const created = await createInvoiceDraft(proposal.body)

  // En divisa, el tipo de cambio lo fija Holded al crear (como en las facturas a mano):
  // se lee del borrador y se recalcula el precio con él.
  if (profile.currency !== 'EUR' && created.id) {
    const draft = await getInvoice(String(created.id))
    const hr = num(draft.currency_change)
    const precise = hr > 0 && hr !== 1 && Math.round(hr * 100) / 100 !== hr
    const items = proposal.body.items as Array<Record<string, unknown>>
    if (precise) {
      const price = r2(proposal.priceEUR * hr)
      items[0] = { ...items[0], price }
      await updateInvoice(String(created.id), { ...proposal.body, items, currency_change: hr })
      proposal.price = price
      proposal.rate = { rate: hr, date: proposal.date, source: 'Holded' }
    } else if (hr > 0 && hr !== 1) {
      // Holded guarda el cambio redondeado: precio con el cambio preciso del BCE, cambio de Holded intacto
      proposal.rate = { ...(proposal.rate as { rate: number; date: string }), source: `BCE (Holded fijó ${hr})` }
    } else {
      // Holded no fijó cambio: poner el del BCE para que no quede 1:1
      await updateInvoice(String(created.id), { ...proposal.body, currency_change: proposal.rate?.rate })
      proposal.rate = { ...(proposal.rate as { rate: number; date: string }), source: 'BCE (Holded no fijó cambio)' }
    }
    proposal.base = r2(proposal.hours * proposal.price)
    proposal.total = r2(proposal.base * (1 + proposal.taxPct / 100))
  }
  return { proposal, created }
}

export function formatProposal(p: DraftProposal): string {
  const money = (n: number, c = p.currency) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: c }).format(n)
  if (p.skipped) return `${p.label} (${p.month}): no se propone — ${p.skipped}`
  return [
    `${p.label} → ${p.contactName}`,
    `  ${p.hours} h × ${money(p.price)}${p.rate ? ` (${p.priceEUR} € × ${p.rate.rate} ${p.rate.source ?? `BCE ${p.rate.date}, estimado: el cambio definitivo lo fija Holded al crear`})` : ''} = base ${money(p.base)} · IVA ${p.taxPct}% · total ${money(p.total)}`,
    `  Línea: "${p.lineName}" — ${p.lineDesc.length > 90 ? p.lineDesc.slice(0, 90) + '…' : p.lineDesc}`,
    `  Fecha ${p.date}${p.dueDate ? ` · vence ${p.dueDate}` : ''} · idioma ${p.language} · ${p.currency}${p.templateNumber ? ` · calcada de ${p.templateNumber}` : ''}`,
    p.existing?.length ? `  ⚠ YA EXISTE este mes: ${p.existing.join(', ')} — no se creará` : '',
  ].filter(Boolean).join('\n')
}
