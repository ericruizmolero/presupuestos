/**
 * Servidor MCP (Streamable HTTP, sin estado) para el trackeo de horas.
 *
 * Se añade en claude.ai → Ajustes → Conectores con la URL:
 *   https://client.treseiscero.app/api/mcp?key=<MCP_SECRET>
 *
 * Env vars (Vercel): MCP_SECRET, FIREBASE_SERVICE_ACCOUNT (JSON de la
 * cuenta de servicio). Las escrituras usan Firebase Admin (bypassa rules).
 */
import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'

const DEFAULT_PERSON = 'Eric y Andoni'
const PUBLIC_BASE = 'https://client.treseiscero.app'

// ── Firebase Admin (singleton) ────────────────────────────────────────────────
function db(): Firestore {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada')
    initializeApp({ credential: cert(JSON.parse(raw)) })
  }
  return getFirestore()
}

// ── Dominio ───────────────────────────────────────────────────────────────────
interface Project {
  id: string
  name?: string
  clientName?: string
  slug?: string
  language?: string
  hourlyRate?: number
  companyId?: string
}

function todayISO(): string {
  // Fecha local de Madrid, no UTC del servidor
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return parts // en-CA → YYYY-MM-DD
}

async function getProjects(): Promise<Project[]> {
  const snap = await db().collection('timeProjects').get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project))
}

async function findProject(needle: string): Promise<Project | string> {
  const projects = await getProjects()
  const n = needle.toLowerCase()
  const matches = projects.filter((p) =>
    (p.name || '').toLowerCase().includes(n) ||
    (p.clientName || '').toLowerCase().includes(n) ||
    (p.slug || '').toLowerCase().includes(n)
  )
  if (matches.length === 1) return matches[0]
  const list = projects.map((p) => `- ${p.name} (slug: ${p.slug})`).join('\n')
  return matches.length === 0
    ? `Ningún proyecto coincide con "${needle}". Proyectos disponibles:\n${list}`
    : `"${needle}" es ambiguo. Proyectos disponibles:\n${list}`
}

async function projectTotals(projectId: string) {
  const snap = await db().collection('timeEntries').where('projectId', '==', projectId).get()
  const entries = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; date?: string; hours?: number; person?: string; description?: string }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const total = entries.reduce((s, e) => s + (e.hours || 0), 0)
  return { entries, total }
}

// ── Tools ─────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'listar_proyectos',
    description: 'Lista los proyectos de horas de treseiscero con horas acumuladas, tarifa, idioma y enlace público.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'ver_registro',
    description: 'Muestra el registro de horas de un proyecto (entradas, total e importe).',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Nombre, cliente o slug del proyecto (acepta substring, p. ej. "vidflare")' },
      },
      required: ['proyecto'],
      additionalProperties: false,
    },
  },
  {
    name: 'anadir_horas',
    description: 'Añade una o varias entradas de horas a un proyecto de treseiscero. Si no se indica fecha se usa hoy (Madrid); si no se indica persona se usa "Eric y Andoni". El concepto va en el idioma del proyecto.',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Nombre, cliente o slug del proyecto (acepta substring)' },
        entradas: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              fecha: { type: 'string', description: 'YYYY-MM-DD; omitir para hoy' },
              horas: { type: 'number', description: 'Horas, decimales permitidos (2.5)' },
              concepto: { type: 'string', description: 'Descripción corta del trabajo' },
              persona: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'], description: 'Omitir para "Eric y Andoni"' },
            },
            required: ['horas', 'concepto'],
            additionalProperties: false,
          },
        },
      },
      required: ['proyecto', 'entradas'],
      additionalProperties: false,
    },
  },
]

type ToolArgs = Record<string, unknown>

async function callTool(name: string, args: ToolArgs): Promise<{ text: string; isError?: boolean }> {
  if (name === 'listar_proyectos') {
    const projects = await getProjects()
    if (projects.length === 0) return { text: 'No hay proyectos de horas.' }
    const lines = await Promise.all(projects.map(async (p) => {
      const { total } = await projectTotals(p.id)
      const rate = p.hourlyRate ? ` · ${p.hourlyRate} €/h · ${(total * p.hourlyRate).toFixed(2)} €` : ''
      return `${p.name} — ${total} h${rate} · idioma ${p.language || 'es'} · ${PUBLIC_BASE}/h/${p.slug}`
    }))
    return { text: lines.join('\n') }
  }

  if (name === 'ver_registro') {
    const found = await findProject(String(args.proyecto || ''))
    if (typeof found === 'string') return { text: found, isError: true }
    const { entries, total } = await projectTotals(found.id)
    const rows = entries.map((e) => `${e.date}  ${e.hours} h  ${e.person}  ${e.description || ''}`).join('\n')
    const amount = found.hourlyRate ? ` · ${(total * found.hourlyRate).toFixed(2)} € (a ${found.hourlyRate} €/h)` : ''
    return { text: `${found.name} — Total ${total} h${amount}\n${rows || '(sin entradas)'}\nVista cliente: ${PUBLIC_BASE}/h/${found.slug}` }
  }

  if (name === 'anadir_horas') {
    const found = await findProject(String(args.proyecto || ''))
    if (typeof found === 'string') return { text: found, isError: true }
    const entradas = args.entradas as Array<{ fecha?: string; horas: number; concepto: string; persona?: string }>
    if (!Array.isArray(entradas) || entradas.length === 0) {
      return { text: 'Falta el array "entradas".', isError: true }
    }
    const database = db()
    const batch = database.batch()
    const added: string[] = []
    let sum = 0
    for (const e of entradas) {
      const hours = Number(e.horas)
      if (!hours || hours <= 0) return { text: `Horas inválidas: ${e.horas}`, isError: true }
      if (e.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)) {
        return { text: `Fecha inválida (usa YYYY-MM-DD): ${e.fecha}`, isError: true }
      }
      const entry = {
        projectId: found.id,
        companyId: found.companyId || '',
        createdBy: 'claude-mcp',
        date: e.fecha || todayISO(),
        hours,
        description: (e.concepto || '').trim(),
        person: (e.persona || '').trim() || DEFAULT_PERSON,
        createdAt: FieldValue.serverTimestamp(),
      }
      batch.set(database.collection('timeEntries').doc(), entry)
      sum += hours
      added.push(`✓ ${entry.date}  ${entry.hours} h  ${entry.person}  ${entry.description}`)
    }
    await batch.commit()
    return {
      text: `${added.join('\n')}\nAñadidas ${added.length} entrada(s) (${sum} h) a "${found.name}" → ${PUBLIC_BASE}/h/${found.slug}`,
    }
  }

  return { text: `Herramienta desconocida: ${name}`, isError: true }
}

// ── JSON-RPC / MCP ────────────────────────────────────────────────────────────
interface RpcRequest { jsonrpc: string; id?: number | string | null; method: string; params?: Record<string, unknown> }

function authorized(req: NextRequest): boolean {
  const secret = process.env.MCP_SECRET
  if (!secret) return false
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const key = req.nextUrl.searchParams.get('key') || ''
  return bearer === secret || key === secret
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let rpc: RpcRequest
  try {
    rpc = await req.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 }
    )
  }

  // Notificaciones (sin id) → 202 sin cuerpo
  if (rpc.id === undefined || rpc.id === null) {
    return new Response(null, { status: 202 })
  }

  const reply = (result: unknown) => NextResponse.json({ jsonrpc: '2.0', id: rpc.id, result })
  const fail = (code: number, message: string) =>
    NextResponse.json({ jsonrpc: '2.0', id: rpc.id, error: { code, message } })

  try {
    switch (rpc.method) {
      case 'initialize':
        return reply({
          protocolVersion: (rpc.params?.protocolVersion as string) || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'treseiscero-horas', version: '1.0.0' },
        })
      case 'ping':
        return reply({})
      case 'tools/list':
        return reply({ tools: TOOLS })
      case 'tools/call': {
        const name = String(rpc.params?.name || '')
        const args = (rpc.params?.arguments as ToolArgs) || {}
        const { text, isError } = await callTool(name, args)
        return reply({ content: [{ type: 'text', text }], isError: isError === true })
      }
      default:
        return fail(-32601, `Método no soportado: ${rpc.method}`)
    }
  } catch (err) {
    console.error('[mcp] Error:', err)
    return fail(-32603, err instanceof Error ? err.message : 'Internal error')
  }
}

// Sin stream SSE: el transporte Streamable HTTP permite responder 405 al GET
export async function GET() {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}

export async function DELETE() {
  // Fin de sesión del cliente MCP; servidor sin estado → aceptar y listo
  return new Response(null, { status: 200 })
}
