/** Plantillas de email de prospección desde el conector MCP: verlas, editarlas y preparar el email de un prospecto. */
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { DEFAULT_TEMPLATES, PLACEHOLDERS, fillTemplate, prospectVars, type EmailTemplate } from './emailTemplateModel'

type Args = Record<string, unknown>

export const EMAIL_TOOLS = [
  {
    name: 'ver_plantillas_email',
    annotations: { readOnlyHint: true },
    description: 'Las plantillas de email de prospección del estudio (el email tipo para enviar un rediseño a ciegas), con asunto, cuerpo y huecos ({nombre}, {empresa}, {enlace}, {gancho}). Se editan en la app, en Prospección.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'guardar_plantilla_email',
    annotations: { destructiveHint: false, idempotentHint: true },
    description: 'Crea o actualiza (por nombre) una plantilla de email de prospección. Huecos disponibles: {nombre}, {empresa}, {enlace}, {gancho}. Escribe con la voz de Eric (corto, cercano, sin fórmulas de agencia, sin "·" ni "—"). borrar=true la elimina.',
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre de la plantilla, p. ej. "Rediseño a ciegas"' },
        asunto: { type: 'string' },
        cuerpo: { type: 'string' },
        mercado: { type: 'string', enum: ['es', 'us'], description: 'Se usa por defecto con prospectos de ese mercado' },
        borrar: { type: 'boolean' },
      },
      required: ['nombre'],
      additionalProperties: false,
    },
  },
  {
    name: 'preparar_email',
    annotations: { destructiveHint: false },
    description: 'Prepara el email a un prospecto con su plantilla (la de su mercado o la indicada): devuelve para, asunto y cuerpo listos. Guarda en el prospecto el email, el enlace de la propuesta y el gancho que pases, para que también salgan en la app. Después, si Eric lo pide, crea un BORRADOR en Gmail (nunca enviar). Si falta un hueco, dilo en vez de inventarlo.',
    inputSchema: {
      type: 'object',
      properties: {
        prospecto: { type: 'string', description: 'Nombre de la empresa en Prospección' },
        plantilla: { type: 'string', description: 'Nombre de la plantilla; por defecto la de su mercado' },
        email: { type: 'string', description: 'A quién se escribe' },
        enlace: { type: 'string', description: 'Enlace a la propuesta (p. ej. https://deneb.savvia.studio/)' },
        gancho: { type: 'string', description: 'Frase personal: enhorabuena por la ronda, quién nos recomendó, conexión común…' },
      },
      required: ['prospecto'],
      additionalProperties: false,
    },
  },
]

export const EMAIL_TOOL_NAMES = new Set(EMAIL_TOOLS.map((t) => t.name))

async function readTemplates(db: Firestore, cid: string): Promise<EmailTemplate[]> {
  const snap = await db.doc(`emailTemplates/${cid}`).get()
  return snap.exists ? ((snap.data()!.items as EmailTemplate[]) ?? []) : DEFAULT_TEMPLATES
}

export async function handleEmailTool(db: Firestore, cid: string, name: string, a: Args): Promise<{ text: string; isError?: boolean }> {
  const templates = await readTemplates(db, cid)

  if (name === 'ver_plantillas_email') {
    if (!templates.length) return { text: 'No hay plantillas de email.' }
    return {
      text: [
        `Huecos: ${PLACEHOLDERS.map((p) => `{${p.key}} (${p.hint})`).join(', ')}`,
        ...templates.map((t) => `\n## ${t.name}${t.region ? ` [${t.region === 'us' ? 'EE. UU.' : 'España'}]` : ''}\nAsunto: ${t.subject}\n\n${t.body}`),
      ].join('\n'),
    }
  }

  if (name === 'guardar_plantilla_email') {
    const nombre = String(a.nombre || '').trim()
    if (!nombre) return { text: 'Falta "nombre".', isError: true }
    const items = [...templates]
    const i = items.findIndex((t) => t.name.toLowerCase() === nombre.toLowerCase())
    if (a.borrar === true) {
      if (i < 0) return { text: `No hay ninguna plantilla "${nombre}".`, isError: true }
      items.splice(i, 1)
    } else {
      const t: EmailTemplate = i >= 0 ? { ...items[i] } : { id: Math.random().toString(36).slice(2, 8), name: nombre, subject: '', body: '' }
      if (a.asunto !== undefined) t.subject = String(a.asunto)
      if (a.cuerpo !== undefined) t.body = String(a.cuerpo)
      if (a.mercado === 'es' || a.mercado === 'us') t.region = a.mercado
      if (i >= 0) items[i] = t
      else items.push(t)
    }
    await db.doc(`emailTemplates/${cid}`).set({ items: JSON.parse(JSON.stringify(items)), updatedAt: FieldValue.serverTimestamp() })
    return { text: a.borrar === true ? `✓ Plantilla "${nombre}" borrada.` : `✓ Plantilla "${nombre}" ${i >= 0 ? 'actualizada' : 'creada'}. Ya sale en la app, en Prospección.` }
  }

  if (name === 'preparar_email') {
    const ref = db.doc(`prospects/${cid}`)
    const snap = await ref.get()
    type P = { name: string; contact?: string; region?: string; email?: string; proposalUrl?: string; hook?: string; links?: string[] }
    const items: P[] = snap.exists ? ((snap.data()!.items as P[]) ?? []) : []
    const q = String(a.prospecto || '').toLowerCase().trim()
    const matches = items.filter((x) => x.name.toLowerCase() === q)
    const found = matches.length ? matches : items.filter((x) => x.name.toLowerCase().includes(q))
    if (!found.length) return { text: `No encuentro "${a.prospecto}" en Prospección. Añádelo antes con anadir_prospecto.`, isError: true }
    if (found.length > 1) return { text: `Casa con varios: ${found.map((x) => x.name).join(', ')}`, isError: true }
    const p = found[0]
    let changed = false
    if (typeof a.email === 'string' && a.email.trim()) { p.email = a.email.trim(); changed = true }
    if (typeof a.enlace === 'string' && a.enlace.trim()) { p.proposalUrl = a.enlace.trim(); changed = true }
    if (typeof a.gancho === 'string' && a.gancho.trim()) { p.hook = a.gancho.trim(); changed = true }
    if (changed) await ref.set({ items: JSON.parse(JSON.stringify(items)), updatedAt: FieldValue.serverTimestamp() })

    const want = String(a.plantilla || '').toLowerCase().trim()
    const t = (want && templates.find((x) => x.name.toLowerCase().includes(want))) || templates.find((x) => x.region === p.region) || templates[0]
    if (!t) return { text: 'No hay plantillas de email. Crea una con guardar_plantilla_email.', isError: true }
    const out = fillTemplate(t, prospectVars(p))
    return {
      text: [
        `Plantilla: ${t.name}`,
        `Para: ${p.email || '(sin email: pídelo o búscalo)'}`,
        `Asunto: ${out.subject}`,
        '',
        out.body,
        out.missing.length ? `\n⚠ Faltan huecos: ${out.missing.join(', ')}. No los inventes: pregunta a Eric.` : '',
        p.hook ? '' : '\n(Sin gancho personal: conviene una frase propia, como la enhorabuena por la ronda o quién os conecta.)',
      ].filter((x) => x !== '').join('\n'),
    }
  }

  return { text: `Herramienta desconocida: ${name}`, isError: true }
}
