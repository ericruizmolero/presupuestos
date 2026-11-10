/** Cuestionarios para clientes desde el conector MCP: crear, listar y leer respuestas. */
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { webAuditTemplate, fieldsOf, questionnaireSlug, type Question, type Questionnaire } from './questionnaireModel'

const BASE = 'https://client.savvia.studio'
const STUDIO_COMPANY_ID = 'company_AT73jo2HOr'
type Args = Record<string, unknown>

export const QUESTIONNAIRE_TOOLS = [
  {
    name: 'ver_cuestionarios',
    annotations: { readOnlyHint: true },
    description: 'Lista los cuestionarios compartidos con clientes (p. ej. preguntas previas a una auditoría web), con su estado (pendiente/respondido), cuántas preguntas han respondido y el enlace.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'ver_cuestionario',
    annotations: { readOnlyHint: true },
    description: 'Lee un cuestionario con las RESPUESTAS del cliente. Identifícalo por empresa ("5050 Growth") o por su id/slug. Úsala para preparar la auditoría o el presupuesto a partir de lo que respondieron.',
    inputSchema: { type: 'object', properties: { cuestionario: { type: 'string' } }, required: ['cuestionario'], additionalProperties: false },
  },
  {
    name: 'crear_cuestionario',
    annotations: { destructiveHint: false },
    description: 'Crea un cuestionario para enviar a un cliente por enlace. Sin "preguntas" usa la plantilla de auditoría web (referencias que gustan/no gustan, qué entender en 5 segundos, acciones principales, público, secciones imprescindibles). Devuelve el enlace para el cliente y el del panel.',
    inputSchema: {
      type: 'object',
      properties: {
        empresa: { type: 'string' },
        persona: { type: 'string', description: 'Nombre de pila para el saludo' },
        titulo: { type: 'string' },
        intro: { type: 'string' },
        idioma: { type: 'string', enum: ['es', 'en'] },
        preguntas: {
          type: 'array',
          items: { type: 'object', properties: { titulo: { type: 'string' }, ayuda: { type: 'string' }, cajas: { type: 'array', items: { type: 'string' }, description: 'Si la pregunta necesita varias respuestas separadas, sus etiquetas' } }, required: ['titulo'], additionalProperties: false },
        },
      },
      required: ['empresa'],
      additionalProperties: false,
    },
  },
]

export const QUESTIONNAIRE_TOOL_NAMES = new Set(QUESTIONNAIRE_TOOLS.map((t) => t.name))

async function all(db: Firestore): Promise<Questionnaire[]> {
  const s = await db.collection('questionnaires').where('companyId', '==', STUDIO_COMPANY_ID).get()
  return s.docs.map((d) => ({ id: d.id, ...d.data() } as Questionnaire))
}

function progress(q: Questionnaire) {
  const done = q.questions.filter((qq) => fieldsOf(qq).some((f) => (q.answers?.[f.id] || '').trim())).length
  return `${done}/${q.questions.length}`
}

/** Para "novedades": cuestionarios con respuestas desde cutoff (YYYY-MM-DD), lo más reciente primero */
export async function questionnaireNews(db: Firestore, cutoffISO: string): Promise<string[]> {
  const qs = (await all(db)).filter((q) => (q.answeredAt || '').slice(0, 10) >= cutoffISO)
  qs.sort((a, b) => String(b.answeredAt).localeCompare(String(a.answeredAt)))
  return qs.map((q) => `${String(q.answeredAt).slice(0, 10)} · ${q.clientCompany || q.title}${q.clientName ? ` (${q.clientName})` : ''}: ${q.status === 'respondido' ? 'ha terminado el cuestionario' : 'está respondiendo'} (${progress(q)}). Léelo con ver_cuestionario "${q.slug}".`)
}

export async function handleQuestionnaireTool(db: Firestore, name: string, a: Args): Promise<{ text: string; isError?: boolean }> {
  if (name === 'ver_cuestionarios') {
    const qs = await all(db)
    if (!qs.length) return { text: 'No hay cuestionarios.' }
    return { text: qs.map((q) => `- ${q.title} · ${q.clientCompany || ''} · ${q.status} · ${progress(q)} respondidas\n  cliente: ${BASE}/cuestionario/${q.slug} · panel: ${BASE}/dashboard/cuestionarios/${q.id}`).join('\n') }
  }

  if (name === 'ver_cuestionario') {
    const n = String(a.cuestionario || '').toLowerCase().trim()
    const qs = (await all(db)).filter((q) => q.id === n || q.slug === n || (q.clientCompany || '').toLowerCase().includes(n) || q.title.toLowerCase().includes(n))
    if (!qs.length) return { text: `No encuentro ningún cuestionario que case con "${a.cuestionario}".`, isError: true }
    if (qs.length > 1) return { text: 'Casa con varios:\n' + qs.map((q) => `- ${q.title} (${q.slug})`).join('\n'), isError: true }
    const q = qs[0]
    const out = [`# ${q.title} · ${q.clientCompany || ''}${q.clientName ? ` (${q.clientName})` : ''}`, `estado: ${q.status}${q.submittedAt ? ` (enviado ${q.submittedAt.slice(0, 10)})` : ''} · ${progress(q)} respondidas · ${BASE}/cuestionario/${q.slug}`]
    q.questions.forEach((qq, i) => {
      out.push(`\n## ${i + 1}. ${qq.title}`)
      for (const f of fieldsOf(qq)) {
        const ans = (q.answers?.[f.id] || '').trim()
        out.push(`${f.label ? `${f.label}: ` : ''}${ans || '(sin respuesta)'}`)
      }
    })
    return { text: out.join('\n') }
  }

  if (name === 'crear_cuestionario') {
    const empresa = String(a.empresa || '').trim()
    if (!empresa) return { text: 'Falta "empresa".', isError: true }
    const rid = () => Math.random().toString(36).slice(2, 8)
    const questions: Question[] = Array.isArray(a.preguntas) && a.preguntas.length
      ? (a.preguntas as Args[]).map((p) => {
          const id = rid()
          const cajas = Array.isArray(p.cajas) ? (p.cajas as unknown[]).map(String).filter(Boolean) : []
          return { id, title: String(p.titulo || ''), help: p.ayuda ? String(p.ayuda) : '', ...(cajas.length > 1 ? { fields: cajas.map((label) => ({ id: `${id}_${rid()}`, label })) } : {}) }
        })
      : webAuditTemplate()
    let n = 1
    let slug = questionnaireSlug(empresa)
    while ((await db.doc(`questionnaires/${slug}`).get()).exists) slug = questionnaireSlug(empresa, ++n)
    const doc = {
      companyId: STUDIO_COMPANY_ID,
      slug,
      title: String(a.titulo || `Antes de la auditoría de ${empresa}`),
      clientCompany: empresa,
      ...(a.persona ? { clientName: String(a.persona) } : {}),
      intro: String(a.intro || 'Antes de la auditoría nos ayuda mucho entender cómo ves tu web. Son 5 preguntas y te llevará unos 10 minutos. No hace falta que sea perfecto: con un par de líneas por pregunta nos vale.'),
      language: a.idioma === 'en' ? 'en' : 'es',
      questions,
      answers: {},
      status: 'pendiente',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    await db.doc(`questionnaires/${slug}`).set(JSON.parse(JSON.stringify({ ...doc, createdAt: null, updatedAt: null })))
    await db.doc(`questionnaires/${slug}`).update({ createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    return { text: `✓ Cuestionario creado para ${empresa} (${questions.length} preguntas).\nEnlace para el cliente: ${BASE}/cuestionario/${slug}\nPanel: ${BASE}/dashboard/cuestionarios/${slug}` }
  }

  return { text: `Herramienta desconocida: ${name}`, isError: true }
}
