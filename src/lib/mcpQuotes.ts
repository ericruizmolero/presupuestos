/**
 * Presupuestos desde el conector MCP de Claude: listar, leer, crear y editar.
 *
 * Claude escribe con claves en castellano y texto plano (o HTML sencillo); aquí se
 * traduce al modelo de la app (src/types/quote.ts) con los mismos cálculos que el
 * editor (subtotal, IVA, total). Todo lo que crea Claude nace como BORRADOR.
 * Cada escritura deja `claudeEditAt`: el editor abierto lo detecta y ofrece recargar.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore'

type Args = Record<string, unknown>
type Obj = Record<string, unknown>

const PUBLIC_BASE = 'https://client.savvia.studio'
const STUDIO_COMPANY_ID = 'company_AT73jo2HOr'

const ICONS = 'Search, Compass, Map, Eye, Target, Clipboard, Calendar, List, Layers, Layout, PenTool, Figma, Sliders, Grid, Code, Terminal, Cpu, GitBranch, Package, Server, Database, CheckCircle, Shield, Activity, Upload, Globe, Send, MessageSquare, Edit, FileText, BookOpen, Users, Tool, RefreshCw, BarChart, TrendingUp, Zap, Star, Award, Flag'

// ── Texto ⇄ HTML ──────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
}

/** Texto plano (párrafos, líneas con "- " como lista, **negrita**) → HTML del editor. Si ya es HTML, tal cual. */
export function toHtml(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  if (/^<(p|ul|ol|h[1-6]|div|blockquote)[\s>]/i.test(s)) return s
  const out: string[] = []
  for (const block of s.split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim())
    let para: string[] = []
    let list: string[] = []
    const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = [] } }
    const flushList = () => { if (list.length) { out.push(`<ul>${list.map((l) => `<li><p>${inline(l)}</p></li>`).join('')}</ul>`); list = [] } }
    for (const l of lines) {
      const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/)
      if (m) { flushPara(); list.push(m[1]) } else { flushList(); para.push(l.trim()) }
    }
    flushPara(); flushList()
  }
  return out.join('')
}

/** HTML → texto legible para que Claude lo lea */
export function toText(html: unknown): string {
  const s = String(html ?? '')
  if (!s) return ''
  return s
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim())
const num = (v: unknown) => {
  if (v === undefined || v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}
const mid = () => Math.random().toString(36).slice(2, 10)
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])

function fmtMoney(n: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n || 0)
}

function slugBase(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
}

// ── Esquema de entrada (compartido por crear y editar) ────────────────────────
const RICH = 'Texto plano: párrafos separados por línea en blanco, "- " para listas, **negrita**. También vale HTML sencillo (<p>, <ul>, <li>, <strong>, <em>).'

const CONTENT_PROPS = {
  cliente: {
    type: 'object',
    description: 'Datos del cliente. En editar, solo se cambian los campos que pases.',
    properties: {
      empresa: { type: 'string' }, nombre: { type: 'string', description: 'Persona de contacto' }, cargo: { type: 'string' },
      email: { type: 'string' }, ciudad: { type: 'string' }, direccion: { type: 'string' }, cif: { type: 'string' },
      descripcion: { type: 'string', description: `Quién es el cliente. ${RICH}` },
    },
    additionalProperties: false,
  },
  idioma: { type: 'string', enum: ['es', 'en'], description: 'Idioma del documento (por defecto es)' },
  moneda: { type: 'string', enum: ['EUR', 'USD', 'MXN'] },
  fecha: { type: 'string', description: 'YYYY-MM-DD (por defecto hoy)' },
  valido_hasta: { type: 'string', description: 'YYYY-MM-DD (por defecto +30 días)' },
  objetivo: { type: 'string', description: `Objetivo principal del proyecto. ${RICH}` },
  modelo_colaboracion: { type: 'string', description: `Cómo trabajamos juntos. ${RICH}` },
  alcance: { type: 'string', description: `Qué incluye y qué no. ${RICH}` },
  fases: {
    type: 'array',
    description: 'Fases del proyecto (sustituye la lista entera).',
    items: { type: 'object', properties: { nombre: { type: 'string' }, descripcion: { type: 'string', description: RICH }, icono: { type: 'string', description: `Uno de: ${ICONS}` } }, required: ['nombre'], additionalProperties: false },
  },
  calendario: {
    type: 'array',
    description: 'Timeline (sustituye la lista entera). Usa el mismo nombre de fase que en "fases".',
    items: { type: 'object', properties: { fase: { type: 'string' }, grupo: { type: 'string', description: 'Agrupación temática ("Diseño", "Desarrollo"…)' }, inicio: { type: 'string', description: 'YYYY-MM-DD' }, fin: { type: 'string', description: 'YYYY-MM-DD' }, icono: { type: 'string' } }, required: ['fase', 'inicio', 'fin'], additionalProperties: false },
  },
  tabla_precios: {
    type: 'object',
    description: 'Tabla de precios del presupuesto. modo "fijo" = precio cerrado por partida; modo "horas" = estimación por horas (horas_min/horas_max) × tarifa_hora. Si pasas partidas, sustituyen a las anteriores.',
    properties: {
      modo: { type: 'string', enum: ['fijo', 'horas'] },
      tarifa_hora: { type: 'number' },
      iva: { type: 'number', description: 'Porcentaje (21 por defecto; 0 para clientes fuera de España)' },
      partidas: {
        type: 'array',
        items: { type: 'object', properties: { concepto: { type: 'string' }, tiempo: { type: 'string', description: '"2 semanas", "32h"…' }, precio: { type: 'number', description: 'Importe sin IVA (modo fijo)' }, notas: { type: 'string' }, horas_min: { type: 'number' }, horas_max: { type: 'number' } }, required: ['concepto'], additionalProperties: false },
      },
      etiqueta_total: { type: 'string', description: 'Por defecto "Total (IVA no incluido)"' },
      total_manual: { type: 'string', description: 'Texto que sustituye al total calculado (ej. "2.700–4.500 € est."); cadena vacía lo quita' },
    },
    additionalProperties: false,
  },
  adicionales: {
    type: 'object',
    description: 'Tabla de servicios adicionales/opcionales. activo=false la oculta.',
    properties: {
      activo: { type: 'boolean' },
      etiqueta: { type: 'string' },
      partidas: { type: 'array', items: { type: 'object', properties: { concepto: { type: 'string' }, tiempo: { type: 'string' }, precio: { type: 'number' }, notas: { type: 'string' } }, required: ['concepto'], additionalProperties: false } },
    },
    additionalProperties: false,
  },
  hitos: {
    type: 'array',
    description: 'Hitos de facturación (sustituye la lista). Por defecto 50% inicio / 50% final.',
    items: { type: 'object', properties: { etiqueta: { type: 'string' }, porcentaje: { type: 'number' }, descripcion: { type: 'string' } }, required: ['etiqueta', 'porcentaje'], additionalProperties: false },
  },
  condiciones: {
    type: 'object',
    description: `Condiciones de aceptación. Si no se pasan al crear, se usan las de la empresa. ${RICH}`,
    properties: {
      forma_pago: { type: 'string' }, criterios_aceptacion: { type: 'string' }, responsabilidades_cliente: { type: 'string' },
      penalizacion: { type: 'string' }, anexos: { type: 'string' }, proteccion_datos: { type: 'string' },
    },
    additionalProperties: false,
  },
  facturacion: { type: 'string', description: `Condiciones de facturación. ${RICH}` },
  firma: { type: 'object', description: 'Bloques de conformidad (firma)', properties: { emisor: { type: 'string' }, cliente: { type: 'string' } }, additionalProperties: false },
  notas_internas: { type: 'string', description: 'Resumen de la reunión / contexto (solo lo ve el estudio, no sale en el documento)' },
}

export const QUOTE_TOOLS = [
  {
    name: 'ver_presupuestos',
    annotations: { readOnlyHint: true },
    description: 'Lista los presupuestos del estudio (Savvia): número, cliente, estado, total y enlaces (editor y vista del cliente). Úsala para encontrar uno antes de leerlo o editarlo.',
    inputSchema: { type: 'object', properties: { estado: { type: 'string', enum: ['borrador', 'enviado', 'aceptado', 'rechazado'] } }, additionalProperties: false },
  },
  {
    name: 'ver_presupuesto',
    annotations: { readOnlyHint: true },
    description: 'Lee un presupuesto completo (cliente, proyecto, fases, calendario, partidas, condiciones, hitos) como texto. Identifícalo por número ("2026-009"), slug ("kymatio") o nombre del cliente.',
    inputSchema: { type: 'object', properties: { presupuesto: { type: 'string' } }, required: ['presupuesto'], additionalProperties: false },
  },
  {
    name: 'crear_presupuesto',
    annotations: { destructiveHint: false },
    description: 'Crea un presupuesto NUEVO en estado borrador a partir de lo hablado con el cliente (reunión, notas, alcance, precio). Rellena todo lo que puedas: cliente, objetivo, alcance, fases, calendario con fechas reales, partidas con precios y hitos. basado_en copia otro presupuesto como plantilla (estructura, condiciones, firma) y aplica encima lo que pases. Numeración, enlace y datos del emisor (Savvia Studio CB) se ponen solos. Devuelve el enlace del editor para revisarlo en la app.',
    inputSchema: {
      type: 'object',
      properties: { basado_en: { type: 'string', description: 'Número, slug o cliente de un presupuesto existente para usar de plantilla' }, ...CONTENT_PROPS },
      required: ['cliente'],
      additionalProperties: false,
    },
  },
  {
    name: 'editar_presupuesto',
    annotations: { destructiveHint: true },
    description: 'Edita un presupuesto existente: solo cambia los campos que pases (las listas como fases, calendario, partidas o hitos se sustituyen enteras, así que lee antes con ver_presupuesto y manda la lista completa). Si el presupuesto NO es borrador (ya enviado o aceptado), pide confirmación a Eric y pasa confirmado=true. Para hacer una versión nueva de uno enviado, mejor crear_presupuesto con basado_en.',
    inputSchema: {
      type: 'object',
      properties: {
        presupuesto: { type: 'string', description: 'Número, slug o cliente' },
        estado: { type: 'string', enum: ['borrador', 'enviado', 'aceptado', 'rechazado'] },
        confirmado: { type: 'boolean', description: 'true solo tras el OK de Eric si el presupuesto no es borrador' },
        ...CONTENT_PROPS,
      },
      required: ['presupuesto'],
      additionalProperties: false,
    },
  },
]

export const QUOTE_TOOL_NAMES = new Set(QUOTE_TOOLS.map((t) => t.name))

// ── Lectura ───────────────────────────────────────────────────────────────────
type Q = Obj & { id: string }

async function studioQuotes(db: Firestore): Promise<Q[]> {
  const s = await db.collection('quotes').where('companyId', '==', STUDIO_COMPANY_ID).get()
  return s.docs.map((d) => ({ id: d.id, ...d.data() } as Q))
}

function clientLabel(q: Obj): string {
  const c = (q.client as Obj) || {}
  return String(c.company || c.name || '(sin cliente)')
}

function totalLabel(q: Obj): string {
  const bt = (q.budgetTable as Obj) || {}
  const cur = String(q.currency || 'EUR')
  if (bt.manualTotal) return String(bt.manualTotal)
  if (bt.mode === 'hourly') {
    const items = arr(bt.items)
    const minH = items.reduce((s, i) => s + (num(i.minHours) ?? 0), 0)
    const maxH = items.reduce((s, i) => s + (num(i.maxHours) ?? 0), 0)
    const rate = num(bt.hourlyRate) ?? 0
    if (!minH && !maxH) return '—'
    const h = minH === maxH ? `${minH} h` : `${minH}–${maxH} h`
    return rate ? `${h} × ${fmtMoney(rate, cur)}/h = ${minH === maxH ? fmtMoney(minH * rate, cur) : `${fmtMoney(minH * rate, cur)}–${fmtMoney(maxH * rate, cur)}`}` : h
  }
  return `${fmtMoney(num(bt.subtotal) ?? 0, cur)} + IVA ${num(bt.taxRate) ?? 21}%`
}

const links = (q: Obj & { id: string }) => `editor: ${PUBLIC_BASE}/dashboard/${q.id} · cliente: ${PUBLIC_BASE}/client/${q.slug}`

async function findQuote(db: Firestore, needle: string): Promise<Q | string> {
  const n = needle.trim().toLowerCase()
  const all = await studioQuotes(db)
  const exact = all.filter((q) => q.id === needle || String(q.slug).toLowerCase() === n || String(q.quoteNumber).toLowerCase() === n)
  if (exact.length === 1) return exact[0]
  const fuzzy = all.filter((q) => clientLabel(q).toLowerCase().includes(n) || String(q.slug || '').includes(slugBase(needle)))
  if (fuzzy.length === 1) return fuzzy[0]
  if (!fuzzy.length) return `No encuentro ningún presupuesto que case con "${needle}". Usa ver_presupuestos.`
  return `"${needle}" casa con varios; indica el número o el slug:\n` + fuzzy.map((q) => `- ${q.quoteNumber} · ${clientLabel(q)} · ${q.status} · slug ${q.slug}`).join('\n')
}

function renderQuote(q: Q): string {
  const c = (q.client as Obj) || {}
  const p = (q.project as Obj) || {}
  const bt = (q.budgetTable as Obj) || {}
  const add = (q.budgetTableAdditional as Obj) || {}
  const ac = (q.acceptanceConditions as Obj) || {}
  const cur = String(q.currency || 'EUR')
  const out: string[] = []
  out.push(`# ${q.quoteNumber} · ${clientLabel(q)} · ${q.status}`)
  out.push(links(q))
  out.push(`idioma ${q.language || 'es'} · moneda ${cur} · fecha ${q.date || '—'} · válido hasta ${q.validUntil || '—'}${q.accessPassword ? ' · con código de acceso' : ''}`)
  if (q.internalNotes) out.push(`\n## Notas internas\n${q.internalNotes}`)
  out.push(`\n## Cliente\nempresa: ${c.company || ''} · contacto: ${c.name || ''}${c.role ? ` (${c.role})` : ''} · email: ${c.email || ''} · ciudad: ${c.city || ''} · CIF: ${c.taxId || ''} · dirección: ${c.address || ''}`)
  if (c.description) out.push(toText(c.description))
  if (p.mainObjective) out.push(`\n## Objetivo\n${toText(p.mainObjective)}`)
  if (p.collaborationModel) out.push(`\n## Modelo de colaboración\n${toText(p.collaborationModel)}`)
  if (p.scope) out.push(`\n## Alcance\n${toText(p.scope)}`)
  const phases = arr(p.phases)
  if (phases.length) {
    out.push('\n## Fases')
    phases.forEach((f, i) => out.push(`${i + 1}. ${f.name}${f.icon ? ` [${f.icon}]` : ''}\n${toText(f.description)}`))
  }
  const tl = arr(q.timeline)
  if (tl.length) {
    out.push('\n## Calendario')
    tl.forEach((t) => out.push(`- ${t.phase}${t.group ? ` (${t.group})` : ''}: ${t.startDate} → ${t.endDate}`))
  }
  out.push(`\n## Presupuesto (${bt.mode === 'hourly' ? `por horas${bt.hourlyRate ? `, ${fmtMoney(num(bt.hourlyRate) ?? 0, cur)}/h` : ''}` : 'precio fijo'}, IVA ${num(bt.taxRate) ?? 21}%)`)
  arr(bt.items).forEach((i) => {
    const amount = bt.mode === 'hourly' ? `${i.minHours ?? '?'}–${i.maxHours ?? '?'} h` : fmtMoney(num(i.price) ?? 0, cur)
    out.push(`- ${i.concept} · ${i.time || ''} · ${amount}${i.notes ? ` · ${i.notes}` : ''}`)
  })
  out.push(`Total: ${totalLabel(q)}${bt.totalLabel ? ` (${bt.totalLabel})` : ''}`)
  if (add.enabled) {
    out.push(`\n## ${add.label || 'Servicios adicionales'}`)
    arr(add.items).forEach((i) => out.push(`- ${i.concept} · ${i.time || ''} · ${fmtMoney(num(i.price) ?? 0, cur)}${i.notes ? ` · ${i.notes}` : ''}`))
  }
  const ms = arr(q.billingMilestones)
  if (ms.length) {
    out.push('\n## Hitos de facturación')
    ms.forEach((m) => out.push(`- ${m.label}: ${m.percentage}% — ${m.description || ''}`))
  }
  if (q.billingConditions) out.push(`\n## Facturación\n${toText(q.billingConditions)}`)
  const condNames: Array<[string, string]> = [['paymentTerms', 'Forma de pago'], ['acceptanceCriteria', 'Criterios de aceptación'], ['clientResponsibilities', 'Responsabilidades del cliente'], ['penaltyClause', 'Penalización'], ['annexes', 'Anexos'], ['dataProtection', 'Protección de datos']]
  const conds = condNames.filter(([k]) => ac[k])
  if (conds.length) {
    out.push('\n## Condiciones')
    conds.forEach(([k, label]) => out.push(`### ${label}\n${toText(ac[k])}`))
  }
  return out.join('\n')
}

// ── Escritura ─────────────────────────────────────────────────────────────────
function items(list: unknown, mode: 'fixed' | 'hourly', rate?: number): Obj[] {
  return arr(list).map((i) => {
    const minH = num(i.horas_min)
    const maxH = num(i.horas_max)
    let price = num(i.precio)
    if (price === undefined && mode === 'hourly' && rate && (minH || maxH)) price = Math.round(((minH ?? maxH ?? 0) + (maxH ?? minH ?? 0)) / 2 * rate)
    const it: Obj = { id: mid(), concept: str(i.concepto) || '', time: str(i.tiempo) || (minH || maxH ? (minH === maxH || !maxH ? `${minH ?? maxH}h` : `${minH}–${maxH}h`) : ''), price: price ?? 0, notes: str(i.notas) || '' }
    if (minH !== undefined) it.minHours = minH
    if (maxH !== undefined) it.maxHours = maxH
    return it
  })
}

/** Aplica los campos de Claude sobre un presupuesto (objeto del modelo de la app). Devuelve qué se cambió. */
function applyContent(q: Obj, a: Args): string[] {
  const changed: string[] = []
  if (isObj(a.cliente)) {
    const c = { ...((q.client as Obj) || {}) }
    const map: Record<string, string> = { empresa: 'company', nombre: 'name', cargo: 'role', email: 'email', ciudad: 'city', direccion: 'address', cif: 'taxId' }
    for (const [k, f] of Object.entries(map)) if (a.cliente[k] !== undefined) c[f] = str(a.cliente[k]) ?? ''
    if (a.cliente.descripcion !== undefined) c.description = toHtml(a.cliente.descripcion)
    q.client = c
    changed.push('cliente')
  }
  if (a.idioma === 'es' || a.idioma === 'en') { q.language = a.idioma; changed.push('idioma') }
  if (a.moneda) { q.currency = String(a.moneda); changed.push('moneda') }
  if (a.fecha) { q.date = str(a.fecha); changed.push('fecha') }
  if (a.valido_hasta) { q.validUntil = str(a.valido_hasta); changed.push('validez') }
  const p = { ...((q.project as Obj) || {}) }
  let projectChanged = false
  if (a.objetivo !== undefined) { p.mainObjective = toHtml(a.objetivo); projectChanged = true; changed.push('objetivo') }
  if (a.modelo_colaboracion !== undefined) { p.collaborationModel = toHtml(a.modelo_colaboracion); projectChanged = true; changed.push('modelo de colaboración') }
  if (a.alcance !== undefined) { p.scope = toHtml(a.alcance); projectChanged = true; changed.push('alcance') }
  if (Array.isArray(a.fases)) {
    p.phases = arr(a.fases).map((f, i) => ({ name: str(f.nombre) || `Fase ${i + 1}`, description: toHtml(f.descripcion), order: i, ...(f.icono ? { icon: str(f.icono) } : {}) }))
    projectChanged = true
    changed.push(`${(p.phases as Obj[]).length} fases`)
  }
  if (projectChanged) q.project = p
  if (Array.isArray(a.calendario)) {
    q.timeline = arr(a.calendario).map((t) => ({ phase: str(t.fase) || '', group: str(t.grupo) || '', startDate: str(t.inicio) || '', endDate: str(t.fin) || str(t.inicio) || '', ...(t.icono ? { icon: str(t.icono) } : {}) }))
    changed.push('calendario')
  }
  if (isObj(a.tabla_precios)) {
    const pr = a.tabla_precios
    const bt = { ...((q.budgetTable as Obj) || { items: [], taxRate: 21 }) }
    if (pr.modo === 'fijo' || pr.modo === 'horas') bt.mode = pr.modo === 'horas' ? 'hourly' : 'fixed'
    const mode = bt.mode === 'hourly' ? 'hourly' : 'fixed'
    if (num(pr.tarifa_hora) !== undefined) bt.hourlyRate = num(pr.tarifa_hora)
    if (num(pr.iva) !== undefined) bt.taxRate = num(pr.iva)
    if (Array.isArray(pr.partidas)) bt.items = items(pr.partidas, mode, num(bt.hourlyRate))
    if (pr.etiqueta_total !== undefined) bt.totalLabel = str(pr.etiqueta_total)
    if (pr.total_manual !== undefined) { if (str(pr.total_manual)) bt.manualTotal = str(pr.total_manual); else delete bt.manualTotal }
    const subtotal = arr(bt.items).reduce((s, i) => s + (num(i.price) ?? 0), 0)
    const tax = num(bt.taxRate) ?? 21
    bt.taxRate = tax
    bt.subtotal = subtotal
    bt.total = subtotal * (1 + tax / 100)
    q.budgetTable = bt
    changed.push('presupuesto')
  }
  if (isObj(a.adicionales)) {
    const ad = { ...((q.budgetTableAdditional as Obj) || { enabled: false, label: 'Servicios adicionales', items: [] }) }
    if (typeof a.adicionales.activo === 'boolean') ad.enabled = a.adicionales.activo
    if (a.adicionales.etiqueta !== undefined) ad.label = str(a.adicionales.etiqueta)
    if (Array.isArray(a.adicionales.partidas)) { ad.items = items(a.adicionales.partidas, 'fixed'); if (a.adicionales.activo === undefined) ad.enabled = true }
    const subtotal = arr(ad.items).reduce((s, i) => s + (num(i.price) ?? 0), 0)
    const tax = num((q.budgetTable as Obj)?.taxRate) ?? 21
    ad.subtotal = subtotal
    ad.total = subtotal * (1 + tax / 100)
    q.budgetTableAdditional = ad
    changed.push('adicionales')
  }
  if (Array.isArray(a.hitos)) {
    q.billingMilestones = arr(a.hitos).map((m) => ({ id: mid(), label: str(m.etiqueta) || '', percentage: num(m.porcentaje) ?? 0, description: str(m.descripcion) || '' }))
    changed.push('hitos')
  }
  if (isObj(a.condiciones)) {
    const ac = { ...((q.acceptanceConditions as Obj) || {}) }
    const map: Record<string, string> = { forma_pago: 'paymentTerms', criterios_aceptacion: 'acceptanceCriteria', responsabilidades_cliente: 'clientResponsibilities', penalizacion: 'penaltyClause', anexos: 'annexes', proteccion_datos: 'dataProtection' }
    for (const [k, f] of Object.entries(map)) if (a.condiciones[k] !== undefined) ac[f] = toHtml(a.condiciones[k])
    q.acceptanceConditions = ac
    changed.push('condiciones')
  }
  if (a.facturacion !== undefined) { q.billingConditions = toHtml(a.facturacion); changed.push('facturación') }
  if (isObj(a.firma)) {
    const cf = { ...((q.conformity as Obj) || { signatureStatus: 'unsigned', signedAt: null }) }
    if (a.firma.emisor !== undefined) cf.emitterData = toHtml(a.firma.emisor)
    if (a.firma.cliente !== undefined) cf.clientData = toHtml(a.firma.cliente)
    q.conformity = cf
    changed.push('firma')
  }
  if (a.notas_internas !== undefined) { q.internalNotes = str(a.notas_internas); changed.push('notas internas') }
  return changed
}

function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

async function nextQuoteNumber(db: Firestore): Promise<string> {
  const all = await studioQuotes(db)
  const nums = all.map((q) => String(q.quoteNumber || '').match(/(\d+)\s*$/)).map((m) => (m ? parseInt(m[1], 10) : 0)).filter((n) => n > 0 && n < 1000)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `${new Date().getFullYear()}-${String(next).padStart(3, '0')}`
}

async function uniqueSlug(db: Firestore, name: string): Promise<string> {
  const base = slugBase(name) || mid()
  let candidate = base
  let i = 2
  while (!(await db.collection('quotes').where('slug', '==', candidate).limit(1).get()).empty) candidate = `${base}-${i++}`
  return candidate
}

async function emitterFromCompany(db: Firestore): Promise<{ company: Obj; emitter: Obj }> {
  const company = ((await db.doc(`companies/${STUDIO_COMPANY_ID}`).get()).data() || {}) as Obj
  return {
    company,
    emitter: {
      companyName: company.name || '', logoUrl: company.logoUrl || '', email: company.email || '', address: company.address || '',
      city: company.city || '', taxId: company.taxId || '', description: company.description || '',
      representativeName: company.representativeName || '', representativeRole: company.representativeRole || '',
    },
  }
}

async function studioUserId(db: Firestore): Promise<string> {
  const s = await db.collection('users').where('companyId', '==', STUDIO_COMPANY_ID).limit(1).get()
  return s.docs[0]?.id || 'claude'
}

function blankQuote(company: Obj, emitter: Obj): Obj {
  const today = new Date().toISOString().slice(0, 10)
  const dc = (company.defaultConditions as Obj) || {}
  return {
    status: 'borrador', date: today, validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    currency: 'EUR', language: 'es', fontName: company.defaultFontName || '',
    emitter,
    client: { name: '', company: '', email: '', address: '', city: '', taxId: '', description: '', role: '' },
    project: { mainObjective: '', collaborationModel: '', scope: '', phases: [] },
    timeline: [],
    budgetTable: { items: [], subtotal: 0, taxRate: 21, total: 0 },
    budgetTableAdditional: { enabled: false, label: 'Servicios adicionales', items: [], subtotal: 0, total: 0 },
    acceptanceConditions: {
      paymentTerms: dc.paymentTerms || '', acceptanceCriteria: dc.acceptanceCriteria || '', clientResponsibilities: dc.clientResponsibilities || '',
      penaltyClause: dc.penaltyClause || '', annexes: '', dataProtection: dc.dataProtection || '',
    },
    billingConditions: '',
    billingMilestones: [
      { id: mid(), label: 'Hito inicial 50%', percentage: 50, description: 'La forma de pago será a la recepción de la factura que será emitida cuando comience el proyecto.' },
      { id: mid(), label: 'Hito final 50%', percentage: 50, description: 'La forma de pago será a la recepción de la factura que será emitida cuando el trabajo esté completado.' },
    ],
    pageBreaksBefore: [],
    conformity: { emitterData: '', clientData: '', signatureStatus: 'unsigned', signedAt: null },
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function handleQuoteTool(db: Firestore, name: string, a: Args): Promise<{ text: string; isError?: boolean }> {
  if (name === 'ver_presupuestos') {
    let all = await studioQuotes(db)
    if (a.estado) all = all.filter((q) => q.status === a.estado)
    if (!all.length) return { text: 'No hay presupuestos.' }
    all.sort((x, y) => String(y.quoteNumber).localeCompare(String(x.quoteNumber)))
    return { text: all.map((q) => `- ${q.quoteNumber} · ${clientLabel(q)} · ${q.status} · ${totalLabel(q)}\n  slug ${q.slug} · ${links(q)}`).join('\n') }
  }

  if (name === 'ver_presupuesto') {
    const q = await findQuote(db, String(a.presupuesto || ''))
    if (typeof q === 'string') return { text: q, isError: true }
    return { text: renderQuote(q) }
  }

  if (name === 'crear_presupuesto') {
    if (!isObj(a.cliente) || !(str(a.cliente.empresa) || str(a.cliente.nombre))) return { text: 'Falta cliente.empresa o cliente.nombre.', isError: true }
    const { company, emitter } = await emitterFromCompany(db)
    let q: Obj
    let base = ''
    if (a.basado_en) {
      const src = await findQuote(db, String(a.basado_en))
      if (typeof src === 'string') return { text: `basado_en: ${src}`, isError: true }
      const { id: _id, slug: _s, createdAt: _c, updatedAt: _u, quoteNumber: _n, accessPassword: _p, claudeEditAt: _ce, internalNotes: _in, ...rest } = src
      void _id; void _s; void _c; void _u; void _n; void _p; void _ce; void _in
      q = clean(rest)
      q.status = 'borrador'
      q.emitter = emitter
      q.conformity = { ...((q.conformity as Obj) || {}), signatureStatus: 'unsigned', signedAt: null }
      q.date = new Date().toISOString().slice(0, 10)
      q.validUntil = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      base = ` (plantilla: ${src.quoteNumber} · ${clientLabel(src)})`
    } else {
      q = blankQuote(company, emitter)
    }
    const changed = applyContent(q, a)
    q.quoteNumber = await nextQuoteNumber(db)
    q.slug = await uniqueSlug(db, clientLabel(q))
    q.companyId = STUDIO_COMPANY_ID
    q.createdBy = await studioUserId(db)
    const ref = await db.collection('quotes').add({ ...clean(q), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), claudeEditAt: new Date().toISOString() })
    const created = { ...q, id: ref.id } as Q
    return { text: `✓ Presupuesto ${q.quoteNumber} creado en borrador para ${clientLabel(q)}${base}. Total: ${totalLabel(created)}.\nRellenado: ${changed.join(', ') || 'solo cliente'}.\nRevísalo en la app → ${PUBLIC_BASE}/dashboard/${ref.id}\n(Vista del cliente: ${PUBLIC_BASE}/client/${q.slug}; sin código de acceso hasta que lo pongas en el editor.)` }
  }

  if (name === 'editar_presupuesto') {
    const found = await findQuote(db, String(a.presupuesto || ''))
    if (typeof found === 'string') return { text: found, isError: true }
    if (found.status !== 'borrador' && a.confirmado !== true) {
      return { text: `${found.quoteNumber} (${clientLabel(found)}) está en estado "${found.status}": el cliente puede tenerlo ya. Pide confirmación a Eric y repite con confirmado=true, o crea una versión nueva con crear_presupuesto y basado_en="${found.quoteNumber}".`, isError: true }
    }
    const { id, ...rest } = found
    const q = clean(rest) as Obj
    const changed = applyContent(q, a)
    if (a.estado && ['borrador', 'enviado', 'aceptado', 'rechazado'].includes(String(a.estado))) { q.status = String(a.estado); changed.push(`estado → ${a.estado}`) }
    if (!changed.length) return { text: 'No has pasado ningún campo que cambiar.', isError: true }
    const patch: Obj = {}
    for (const k of ['client', 'language', 'currency', 'date', 'validUntil', 'project', 'timeline', 'budgetTable', 'budgetTableAdditional', 'billingMilestones', 'acceptanceConditions', 'billingConditions', 'conformity', 'internalNotes', 'status']) {
      if (JSON.stringify(q[k]) !== JSON.stringify((found as Obj)[k]) && q[k] !== undefined) patch[k] = q[k]
    }
    await db.doc(`quotes/${id}`).update({ ...clean(patch), updatedAt: FieldValue.serverTimestamp(), claudeEditAt: new Date().toISOString() })
    return { text: `✓ ${found.quoteNumber} (${clientLabel(q)}) actualizado: ${changed.join(', ')}. Total: ${totalLabel({ ...q, id } as Q)}.\nRevísalo en la app → ${PUBLIC_BASE}/dashboard/${id}` }
  }

  return { text: `Herramienta desconocida: ${name}`, isError: true }
}
