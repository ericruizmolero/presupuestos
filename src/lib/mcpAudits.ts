/** Auditorías web para clientes desde el conector MCP: listarlas, leerlas y crearlas o editarlas. */
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { auditSlug, findingGroups, type Audit, type AuditFinding, type AuditPlan, type AuditReference } from './auditModel'

const BASE = 'https://client.savvia.studio'
const STUDIO_COMPANY_ID = 'company_AT73jo2HOr'
type Args = Record<string, unknown>
type Obj = Record<string, unknown>

export const AUDIT_TOOLS = [
  {
    name: 'ver_auditorias',
    annotations: { readOnlyHint: true },
    description: 'Lista las auditorías web entregadas a clientes (/auditoria/<slug>), con su enlace.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'ver_auditoria',
    annotations: { readOnlyHint: true },
    description: 'Lee una auditoría entera con los ids de cada punto, referencia y opción, para editarla después. Identifícala por empresa ("5050 Growth") o por su slug.',
    inputSchema: { type: 'object', properties: { auditoria: { type: 'string' } }, required: ['auditoria'], additionalProperties: false },
  },
  {
    name: 'guardar_auditoria',
    annotations: { destructiveHint: false },
    description:
      'Crea o actualiza la auditoría web de un cliente (por empresa). Es el documento editorial que le entregamos tras auditar su web: 1) "puntos": lo que cambiaríamos, agrupado por zona de la web (Hero, Testimonios, Casos de éxito…), cada uno con titular, explicación, captura opcional y referencias relacionadas; 2) "referencias": webs en las que nos inspiraríamos (pastillas que abren la ficha con lo que destacamos) y las que evitaríamos; 3) "opciones": qué sacamos según las horas contratadas. ' +
      'Los arrays que pases SUSTITUYEN a los anteriores (lee antes con ver_auditoria y reenvía la lista completa); los campos que no pases se quedan igual. ' +
      'Las ideas suelen salir de las notas de la reunión de Eric y Andoni y del tablero de Criterio. Escribe para el cliente, tuteando, en nosotros, corto y concreto; sin "·" ni "—", sin nombres de quién dijo qué. No inventes cifras ni clientes.',
    inputSchema: {
      type: 'object',
      properties: {
        empresa: { type: 'string', description: 'Empresa del cliente ("5050 Growth"); identifica la auditoría' },
        persona: { type: 'string', description: 'Nombre de pila para el saludo' },
        titulo: { type: 'string' },
        web: { type: 'string', description: 'URL de la web auditada' },
        intro: { type: 'string' },
        esencial: { type: 'array', items: { type: 'string' }, description: 'Lo esencial en 3 a 5 líneas, arriba del todo' },
        puntos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              zona: { type: 'string', description: 'Parte de la web: "General", "Hero", "Testimonios"…' },
              titulo: { type: 'string' },
              texto: { type: 'string' },
              imagen: { type: 'string', description: 'URL de una captura' },
              mantener: { type: 'boolean', description: 'true si es algo que funciona y conservaríamos' },
              referencias: { type: 'array', items: { type: 'string' }, description: 'ids o nombres de referencias en las que nos inspiraríamos (las de evitar solo van en su sección, nunca aquí)' },
            },
            required: ['zona', 'titulo', 'texto'],
            additionalProperties: false,
          },
        },
        referencias: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              nombre: { type: 'string' },
              url: { type: 'string' },
              imagen: { type: 'string' },
              notas: { type: 'array', items: { type: 'string' }, description: 'Lo que destacamos de ella, en frases cortas' },
              evitar: { type: 'boolean', description: 'true si es un ejemplo de lo que NO haríamos' },
            },
            required: ['nombre', 'notas'],
            additionalProperties: false,
          },
        },
        referencias_intro: { type: 'string', description: 'Matiz bajo la sección de referencias (p. ej. qué tomar y qué no de ellas)' },
        opciones_intro: { type: 'string' },
        opciones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              horas: { type: 'number' },
              titulo: { type: 'string' },
              resumen: { type: 'string' },
              incluye: { type: 'array', items: { type: 'string' } },
              precio: { type: 'number', description: 'Sin IVA; si no se pasa, no se muestra' },
              recomendada: { type: 'boolean' },
            },
            required: ['horas', 'titulo', 'incluye'],
            additionalProperties: false,
          },
        },
        cierre: { type: 'string' },
        idioma: { type: 'string', enum: ['es', 'en'] },
      },
      required: ['empresa'],
      additionalProperties: false,
    },
  },
]

export const AUDIT_TOOL_NAMES = new Set(AUDIT_TOOLS.map((t) => t.name))

const rid = () => Math.random().toString(36).slice(2, 8)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

async function all(db: Firestore): Promise<Audit[]> {
  const s = await db.collection('audits').where('companyId', '==', STUDIO_COMPANY_ID).get()
  return s.docs.map((d) => ({ id: d.id, ...d.data() } as Audit))
}

function find(list: Audit[], q: string): Audit[] {
  const k = q.toLowerCase().trim()
  const exact = list.filter((a) => a.id === k || (a.clientCompany || '').toLowerCase() === k)
  return exact.length ? exact : list.filter((a) => (a.clientCompany || '').toLowerCase().includes(k) || a.id.includes(k))
}

function render(a: Audit): string {
  const out = [`# ${a.title}`, `Empresa: ${a.clientCompany || ''}${a.clientName ? ` (${a.clientName})` : ''}`, `Enlace: ${BASE}/auditoria/${a.slug}`, `Panel: ${BASE}/dashboard/auditorias/${a.id}`]
  if (a.siteUrl) out.push(`Web: ${a.siteUrl}`)
  if (a.intro) out.push('', a.intro)
  if (a.summary?.length) out.push('', '## Lo esencial', ...a.summary.map((s) => `- ${s}`))
  if (a.findings?.length) {
    out.push('', '## Puntos')
    for (const g of findingGroups(a.findings)) {
      out.push(`### ${g.section}`)
      for (const f of g.items) out.push(`- [${f.id}] ${f.keep ? '(mantener) ' : ''}${f.title}: ${f.body}${f.image ? ' [captura]' : ''}${f.refs?.length ? ` (refs: ${f.refs.join(', ')})` : ''}`)
    }
  }
  if (a.references?.length) {
    out.push('', '## Referencias')
    if (a.referencesIntro) out.push(a.referencesIntro)
    for (const r of a.references) out.push(`- [${r.id}] ${r.avoid ? '(evitar) ' : ''}${r.name}${r.url ? ` ${r.url}` : ''}${r.image ? ' [imagen]' : ''}: ${r.notes.join(' / ')}`)
  }
  if (a.plans?.length) {
    out.push('', '## Opciones')
    if (a.plansIntro) out.push(a.plansIntro)
    for (const p of a.plans) out.push(`- [${p.id}] ${p.hours} h, ${p.title}${p.price ? `, ${p.price} €` : ''}${p.recommended ? ' (recomendada)' : ''}: ${p.items.join('; ')}`)
  }
  if (a.closing) out.push('', a.closing)
  return out.join('\n')
}

export async function handleAuditTool(db: Firestore, name: string, a: Args): Promise<{ text: string; isError?: boolean }> {
  const list = await all(db)

  if (name === 'ver_auditorias') {
    if (!list.length) return { text: 'Aún no hay auditorías.' }
    return { text: list.map((x) => `- ${x.clientCompany || x.title}: ${x.findings?.length || 0} puntos, ${x.references?.length || 0} referencias, ${x.plans?.length || 0} opciones. ${BASE}/auditoria/${x.slug}`).join('\n') }
  }

  if (name === 'ver_auditoria') {
    const m = find(list, String(a.auditoria || ''))
    if (!m.length) return { text: `No encuentro la auditoría "${a.auditoria}".`, isError: true }
    if (m.length > 1) return { text: `Casa con varias: ${m.map((x) => x.clientCompany).join(', ')}`, isError: true }
    return { text: render(m[0]) }
  }

  if (name === 'guardar_auditoria') {
    const empresa = str(a.empresa)
    if (!empresa) return { text: 'Falta "empresa".', isError: true }
    const existing = list.find((x) => (x.clientCompany || '').toLowerCase() === empresa.toLowerCase())
    const patch: Obj = {}
    if (str(a.persona) !== undefined) patch.clientName = str(a.persona)
    if (str(a.titulo) !== undefined) patch.title = str(a.titulo)
    if (str(a.web) !== undefined) patch.siteUrl = str(a.web)
    if (typeof a.intro === 'string') patch.intro = a.intro
    if (typeof a.opciones_intro === 'string') patch.plansIntro = a.opciones_intro
    if (typeof a.referencias_intro === 'string') patch.referencesIntro = a.referencias_intro
    if (typeof a.cierre === 'string') patch.closing = a.cierre
    if (a.idioma === 'es' || a.idioma === 'en') patch.language = a.idioma
    if (Array.isArray(a.esencial)) patch.summary = (a.esencial as unknown[]).map(String).filter(Boolean)

    let references: AuditReference[] = existing?.references || []
    if (Array.isArray(a.referencias)) {
      references = (a.referencias as Obj[]).map((r) => ({
        id: str(r.id) || rid(),
        name: String(r.nombre || ''),
        ...(str(r.url) ? { url: str(r.url) } : {}),
        ...(str(r.imagen) ? { image: str(r.imagen) } : {}),
        notes: Array.isArray(r.notas) ? (r.notas as unknown[]).map(String).filter(Boolean) : [],
        ...(r.evitar === true ? { avoid: true } : {}),
      }))
      patch.references = references
    }
    const refId = (k: string) => {
      const l = k.toLowerCase().trim()
      return references.find((r) => !r.avoid && (r.id === k || r.name.toLowerCase() === l))?.id
    }
    const unknownRefs: string[] = []
    if (Array.isArray(a.puntos)) {
      patch.findings = (a.puntos as Obj[]).map((f): AuditFinding => {
        const refs = Array.isArray(f.referencias) ? (f.referencias as unknown[]).map(String).map((k) => { const id = refId(k); if (!id) unknownRefs.push(k); return id }).filter((x): x is string => !!x) : []
        return {
          id: str(f.id) || rid(),
          section: String(f.zona || 'General'),
          title: String(f.titulo || ''),
          body: String(f.texto || ''),
          ...(str(f.imagen) ? { image: str(f.imagen) } : {}),
          ...(f.mantener === true ? { keep: true } : {}),
          ...(refs.length ? { refs } : {}),
        }
      })
    }
    if (Array.isArray(a.opciones)) {
      patch.plans = (a.opciones as Obj[]).map((p): AuditPlan => ({
        id: str(p.id) || rid(),
        hours: Number(p.horas) || 0,
        title: String(p.titulo || ''),
        ...(str(p.resumen) ? { summary: str(p.resumen) } : {}),
        items: Array.isArray(p.incluye) ? (p.incluye as unknown[]).map(String).filter(Boolean) : [],
        ...(typeof p.precio === 'number' && p.precio > 0 ? { price: p.precio } : {}),
        ...(p.recomendada === true ? { recommended: true } : {}),
      }))
    }

    let id = existing?.id
    if (existing) {
      await db.doc(`audits/${existing.id}`).update({ ...JSON.parse(JSON.stringify(patch)), updatedAt: FieldValue.serverTimestamp() })
    } else {
      let n = 1
      id = auditSlug(empresa)
      while ((await db.doc(`audits/${id}`).get()).exists) id = auditSlug(empresa, ++n)
      await db.doc(`audits/${id}`).set({
        title: `Qué cambiaríamos en la web de ${empresa}`,
        findings: [], references: [], plans: [], language: 'es',
        ...JSON.parse(JSON.stringify(patch)),
        slug: id, companyId: STUDIO_COMPANY_ID, clientCompany: empresa,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      })
    }
    const warn = unknownRefs.length ? `\n⚠ Referencias que no se han enlazado (no existen o son de las que evitaríamos, que solo van en su sección): ${unknownRefs.join(', ')}` : ''
    return { text: `✓ Auditoría de ${empresa} ${existing ? 'actualizada' : 'creada'}.\nEnlace para el cliente: ${BASE}/auditoria/${id}\nPanel: ${BASE}/dashboard/auditorias/${id}${warn}` }
  }

  return { text: `Herramienta desconocida: ${name}`, isError: true }
}
