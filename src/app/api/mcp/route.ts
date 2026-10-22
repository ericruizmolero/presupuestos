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
import { billingSummary, holdedConfigured, recentInvoices, invoicedContacts } from '@/lib/holded'
import { PROFILES, proposeAll, createDraft, formatProposal, type TimeData } from '@/lib/invoicing'
import { parseWhen } from '@/components/studio/boardUtils'
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

function toSlugBase(name: string): string {
  return (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = toSlugBase(name) || `proyecto-${Date.now()}`
  let candidate = base
  let counter = 2
  while (true) {
    const snap = await db().collection('timeProjects').where('slug', '==', candidate).get()
    if (snap.empty) return candidate
    candidate = `${base}-${counter++}`
  }
}

/** Busca en los presupuestos del cliente: idioma del más reciente y tarifa
 *  del más reciente en modo por horas — la misma lógica que la web. */
async function clientMetaFromQuotes(clientNeedle: string) {
  const snap = await db().collection('quotes').get()
  const n = clientNeedle.toLowerCase()
  interface QuoteDoc {
    client?: { company?: string; name?: string }
    language?: string
    companyId?: string
    budgetTable?: { mode?: string; hourlyRate?: number }
    createdAt?: { toMillis?: () => number }
  }
  const quotes = snap.docs
    .map((d) => d.data() as QuoteDoc)
    .filter((q) => {
      const name = (q.client?.company || q.client?.name || '').toLowerCase()
      return name && name.includes(n)
    })
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
  const language = quotes[0]?.language === 'en' ? 'en' : quotes.length > 0 ? 'es' : undefined
  const hourly = quotes.find((q) => q.budgetTable?.mode === 'hourly' && q.budgetTable?.hourlyRate)
  return {
    language,
    hourlyRate: hourly?.budgetTable?.hourlyRate,
    companyId: quotes[0]?.companyId,
    matchedQuotes: quotes.length,
  }
}

// ── Tablero de proyectos (post-its) ───────────────────────────────────────────
const BOARD_COLORS = ['#FDE68A', '#BFDBFE', '#BBF7D0', '#FECACA', '#E9D5FF', '#FED7AA', '#99F6E4', '#F5D0FE']
const DEFAULT_LANES = ['Ahora', 'Luego', 'En espera']
const LEGACY_STATUS: Record<string, string> = { ahora: 'Ahora', luego: 'Luego', espera: 'En espera' }

interface BoardGroup { name: string; color: string; status?: string; owner?: string; health?: string; statusNote?: string; statusDate?: string; deadline?: string; deadlineLabel?: string }
const HEALTH_ICON: Record<string, string> = { verde: '🟢', ambar: '🟡', rojo: '🔴' }
interface BoardChip { group: string; text: string; who?: string; date?: string; by?: string; state?: string; stateDate?: string; due?: string; time?: string }
const BOARD_PEOPLE = ['Eric', 'Andoni', 'Eric y Andoni']
interface Board { lanes: string[]; groups: BoardGroup[]; chips: BoardChip[] }

async function boardCompanyId(): Promise<string | null> {
  const snap = await db().collection('timeProjects').limit(1).get()
  return (snap.docs[0]?.data()?.companyId as string) || null
}

/** Lee el tablero aplicando la misma migración de formato que la web */
async function readBoard(companyId: string): Promise<Board> {
  const snap = await db().collection('planning').doc(companyId).get()
  if (!snap.exists) return { lanes: [...DEFAULT_LANES], groups: [], chips: [] }
  const data = snap.data() as Record<string, unknown>
  if (data.groups || data.chips) {
    const lanes = (data.lanes as string[])?.length ? (data.lanes as string[]) : [...DEFAULT_LANES]
    const groups = ((data.groups ?? []) as BoardGroup[]).map((g) => {
      const status = LEGACY_STATUS[g.status ?? ''] ?? g.status
      return { ...g, status: status && lanes.includes(status) ? status : lanes[0] }
    })
    return { lanes, groups, chips: (data.chips ?? []) as BoardChip[] }
  }
  const entries = (data.entries as Array<{ group?: string; phase?: string }>) ?? []
  const names = [...new Set(entries.map((e) => e.group || '').filter(Boolean))]
  return {
    lanes: [...DEFAULT_LANES],
    groups: names.map((name, i) => ({ name, color: BOARD_COLORS[i % BOARD_COLORS.length], status: DEFAULT_LANES[0] })),
    chips: entries.filter((e) => (e.phase || '').trim()).map((e) => ({ group: e.group || '', text: (e.phase || '').trim() })),
  }
}

async function writeBoard(companyId: string, board: Board) {
  // JSON round-trip: elimina cualquier undefined (Firestore los rechaza)
  const clean = JSON.parse(JSON.stringify({ lanes: board.lanes, groups: board.groups, chips: board.chips }))
  await db().collection('planning').doc(companyId).set({
    ...clean,
    updatedAt: FieldValue.serverTimestamp(),
  })
}

function findBoardGroup(board: Board, needle: string): BoardGroup | string {
  const n = needle.toLowerCase()
  const matches = board.groups.filter((g) => g.name.toLowerCase().includes(n))
  if (matches.length === 1) return matches[0]
  const list = board.groups.map((g) => `- ${g.name}`).join('\n') || '(tablero vacío)'
  return matches.length === 0
    ? `Ningún proyecto del tablero coincide con "${needle}". Proyectos:\n${list}`
    : `"${needle}" es ambiguo en el tablero. Proyectos:\n${list}`
}

function renderBoard(board: Board): string {
  const lines: string[] = []
  for (const lane of board.lanes) {
    const groups = board.groups.filter((g) => (g.status ?? board.lanes[0]) === lane)
    lines.push(`## ${lane}${groups.length === 0 ? ' (vacío)' : ''}`)
    for (const g of groups) {
      const chips = board.chips.filter((c) => c.group === g.name)
      const owner = g.owner === 'Eric' || g.owner === 'Andoni' ? g.owner : 'Los dos'
      const health = g.health ? ` ${HEALTH_ICON[g.health] ?? ''}` : ''
      const status = g.statusNote ? ` — ${g.statusNote} (${g.statusDate ?? 's/f'})` : ''
      const dl = g.deadline ? ` ⏰ ${g.deadlineLabel || 'Entrega'} ${g.deadline}` : ''
      lines.push(`- ${g.name} [${owner}]${health}${dl}${status}${chips.length ? ':' : ' (sin notas)'}`)
      // etiqueta por nota solo si difiere del responsable del proyecto
      for (const c of chips) {
        const exception = c.who && c.who !== (g.owner ?? 'Eric y Andoni')
        const meta = [c.date, c.by ? `de ${c.by}` : ''].filter(Boolean).join(' ')
        const st = c.state === 'esperando' ? ` [esperando feedback${c.stateDate ? ' desde ' + c.stateDate : ''}]` : c.state === 'hecha' ? ' [hecha]' : ''
        const when = c.due ? ` 📅 ${c.due}${c.time ? ' ' + c.time : ''}` : ''
        lines.push(`    · ${c.text}${exception ? ` — ${c.who}` : ''}${when}${st}${meta ? ` (${meta})` : ''}`)
      }
    }
  }
  return lines.join('\n')
}

// ── Tools ─────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'listar_proyectos',
    annotations: { readOnlyHint: true },
    description: 'Lista los proyectos de horas de treseiscero con horas acumuladas, tarifa, idioma y enlace público.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'ver_registro',
    annotations: { readOnlyHint: true },
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
    name: 'ver_tablero',
    annotations: { readOnlyHint: true },
    description: 'Muestra el tablero de proyectos (sección Proyectos de la app): carriles de prioridad con los proyectos activos y las notas de lo que se está haciendo en cada uno. Úsalo para responder "¿en qué estamos?".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'anadir_nota',
    annotations: { destructiveHint: false },
    description: 'Añade una o varias notas (tareas) a un proyecto del tablero en una sola llamada. Usa "notas" para varias a la vez (preferido al volcar listas o reuniones) o "texto" para una. Si el proyecto no existe en el tablero, se crea en el primer carril. Al volcar una reunión, una nota por acción concreta, nunca un resumen; cada una con su "quien" si difiere del responsable.',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Nombre del proyecto del tablero (acepta substring)' },
        texto: { type: 'string', description: 'Texto de una sola nota, corto' },
        quien: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'], description: 'Para la nota de "texto": solo si difiere del responsable del proyecto' },
        fecha: { type: 'string', description: 'Para la nota de "texto": YYYY-MM-DD si es reunión/entrega' },
        hora: { type: 'string', description: 'Para la nota de "texto": HH:MM' },
        notas: {
          type: 'array',
          description: 'Varias notas de golpe',
          items: {
            type: 'object',
            properties: {
              texto: { type: 'string' },
              quien: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'], description: 'Solo si difiere del responsable del proyecto' },
              fecha: { type: 'string', description: 'YYYY-MM-DD si es una reunión o entrega con fecha' },
              hora: { type: 'string', description: 'HH:MM opcional' },
              estado: { type: 'string', enum: ['pendiente', 'esperando', 'hecha'], description: 'esperando = esperando feedback; hecha = terminada (se queda tachada hasta archivarla)' },
            },
            required: ['texto'],
            additionalProperties: false,
          },
        },
        de: { type: 'string', enum: ['Eric', 'Andoni'], description: 'Quién las apunta (p. ej. quien estuvo en la reunión)' },
      },
      required: ['proyecto'],
      additionalProperties: false,
    },
  },
  {
    name: 'crear_proyecto_tablero',
    annotations: { destructiveHint: false },
    description: 'Crea un proyecto en el tablón del estudio con todo de una vez: carril, responsable, salud, estado, próxima entrega y sus tareas iniciales. Si ya existe, actualiza lo indicado y añade las notas. Para cosas de horas/facturación usa crear_proyecto (otra herramienta).',
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre del proyecto o cliente' },
        carril: { type: 'string', description: 'Carril de prioridad (acepta substring: "ahora", "luego", "espera"); por defecto el primero' },
        responsable: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'] },
        salud: { type: 'string', enum: ['verde', 'ambar', 'rojo'] },
        estado: { type: 'string', description: 'Estado en una línea' },
        deadline: { type: 'string', description: 'Próxima entrega YYYY-MM-DD' },
        deadline_que: { type: 'string', description: 'Qué se entrega ese día' },
        notas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              texto: { type: 'string' },
              quien: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'] },
            },
            required: ['texto'],
            additionalProperties: false,
          },
        },
        de: { type: 'string', enum: ['Eric', 'Andoni'], description: 'Quién lo crea' },
      },
      required: ['nombre'],
      additionalProperties: false,
    },
  },
  {
    name: 'editar_nota',
    annotations: { destructiveHint: false, idempotentHint: true },
    description: 'Cambia una nota del tablero: texto, persona, estado (pendiente / esperando feedback) o fecha de reunión/entrega. La nota se busca por coincidencia parcial de su texto dentro del proyecto. Una nota "hecha pero esperando feedback" se marca con estado=esperando; quitar_nota la cierra del todo.',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Proyecto del tablero (acepta substring)' },
        texto: { type: 'string', description: 'Texto actual (o parte) de la nota' },
        nuevo_texto: { type: 'string', description: 'Texto nuevo' },
        quien: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'], description: 'Nueva persona' },
        estado: { type: 'string', enum: ['pendiente', 'esperando', 'hecha'], description: 'esperando = esperando feedback; hecha = terminada (tachada); para quitarla del tablón usa quitar_nota' },
        fecha: { type: 'string', description: 'YYYY-MM-DD de la reunión/entrega; cadena vacía para quitarla' },
        hora: { type: 'string', description: 'HH:MM' },
      },
      required: ['proyecto', 'texto'],
      additionalProperties: false,
    },
  },
  {
    name: 'facturacion',
    annotations: { readOnlyHint: true },
    description: 'Facturación del estudio desde Holded: base imponible facturada en el año (facturas menos rectificativas), total con IVA, desglose por mes y por cliente, y última factura. Responde a "¿cuánto llevamos facturado?", "¿cómo va el año?".',
    inputSchema: {
      type: 'object',
      properties: { anio: { type: 'number', description: 'Año (por defecto el actual)' } },
      additionalProperties: false,
    },
  },
  {
    name: 'ver_facturas',
    annotations: { readOnlyHint: true },
    description: 'Solo lectura: detalle completo de las últimas facturas emitidas en Holded a un cliente (líneas, impuestos, retención, serie, forma de pago, notas, idioma…), para ver cómo se le factura. Sin "cliente", lista los clientes facturados en los últimos 2 años.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nombre (o parte) del contacto en Holded' },
        cuantas: { type: 'number', description: 'Cuántas facturas recientes (por defecto 3, máx. 6)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'preparar_facturas',
    annotations: { readOnlyHint: true },
    description: 'Solo lectura: propone las facturas de fin de mes a partir de las horas registradas (Farco, Greet.video/MJOO, Playground, Kymatio), calcadas de la última factura de cada cliente en Holded: horas, precio (Playground en USD con cambio BCE), IVA, total, y avisa si ya existe factura ese mes. Enséñale esto a Eric ANTES de crear nada.',
    inputSchema: {
      type: 'object',
      properties: { mes: { type: 'string', description: 'YYYY-MM (por defecto el mes actual)' } },
      additionalProperties: false,
    },
  },
  {
    name: 'crear_borrador_factura',
    annotations: { destructiveHint: false, idempotentHint: true },
    description: 'Crea en Holded UNA factura como BORRADOR (sin número, sin enviar) para un cliente y mes, calcada de su última factura. Exige confirmado=true y solo debe llamarse después de enseñar la propuesta de preparar_facturas y recibir el OK explícito de Eric para ese cliente. No crea si ya hay factura ese mes.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', enum: PROFILES.map((p) => p.key), description: 'farco, vidflare, playground o kymatio' },
        mes: { type: 'string', description: 'YYYY-MM' },
        confirmado: { type: 'boolean', description: 'true solo tras el OK explícito de Eric a esta factura' },
      },
      required: ['cliente', 'mes', 'confirmado'],
      additionalProperties: false,
    },
  },
  {
    name: 'resumen_semana',
    description: 'El digest del estudio: horas de los últimos 7 días por proyecto (comparadas con la semana anterior), novedades del tablón y proyectos sin actividad en 14+ días. Responde a "ponme al día", "¿cómo va la semana?", "resumen del lunes". Solo muestra lo que ha cambiado.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'estado_proyecto',
    annotations: { destructiveHint: false, idempotentHint: true },
    description: 'Actualiza la metadata de un proyecto del tablón: salud (verde/ambar/rojo), línea de estado ("esperando feedback del cliente"), responsable, y deadline de la próxima entrega con qué se entrega. Indica solo lo que cambia.',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Proyecto del tablero (acepta substring)' },
        salud: { type: 'string', enum: ['verde', 'ambar', 'rojo'], description: 'Semáforo de salud' },
        nota: { type: 'string', description: 'Línea de estado, corta' },
        responsable: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'], description: 'Quién lleva el proyecto' },
        deadline: { type: 'string', description: 'Fecha de la próxima entrega YYYY-MM-DD ("el miércoles" → conviértelo); cadena vacía para quitarla' },
        deadline_que: { type: 'string', description: 'Qué se entrega ese día ("Lanzamiento", "Entrega fase 1")' },
      },
      required: ['proyecto'],
      additionalProperties: false,
    },
  },
  {
    name: 'novedades',
    annotations: { readOnlyHint: true },
    description: 'Qué hay nuevo en el tablón del estudio: notas recientes por fecha, con proyecto y a quién le toca. Responde a "¿qué ha pasado?", "¿qué tengo que hacer yo?", "ponme al día".',
    inputSchema: {
      type: 'object',
      properties: {
        dias: { type: 'number', description: 'Ventana en días (default 7)' },
        quien: { type: 'string', enum: ['Eric', 'Andoni'], description: 'Filtrar a lo que le toca a esta persona (incluye lo de los dos y lo sin asignar)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'asignar_nota',
    annotations: { destructiveHint: false, idempotentHint: true },
    description: 'Asigna (o reasigna) una nota del tablero a Eric, Andoni o ambos. El texto se busca por coincidencia parcial dentro del proyecto.',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Proyecto del tablero (acepta substring)' },
        texto: { type: 'string', description: 'Texto (o parte) de la nota' },
        quien: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'], description: 'Nuevo responsable' },
      },
      required: ['proyecto', 'texto', 'quien'],
      additionalProperties: false,
    },
  },
  {
    name: 'quitar_nota',
    annotations: { destructiveHint: true },
    description: 'Archiva una nota: la quita del tablero. Para marcarla terminada sin quitarla usa editar_nota con estado=hecha. El texto se busca por coincidencia parcial dentro del proyecto.',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Proyecto del tablero (acepta substring)' },
        texto: { type: 'string', description: 'Texto (o parte) de la nota a quitar' },
      },
      required: ['proyecto', 'texto'],
      additionalProperties: false,
    },
  },
  {
    name: 'mover_proyecto',
    annotations: { destructiveHint: false, idempotentHint: true },
    description: 'Mueve un proyecto del tablero a otro carril de prioridad (p. ej. de "Luego" a "Ahora").',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Proyecto del tablero (acepta substring)' },
        carril: { type: 'string', description: 'Carril destino (acepta substring, p. ej. "espera")' },
      },
      required: ['proyecto', 'carril'],
      additionalProperties: false,
    },
  },
  {
    name: 'editar_entrada',
    annotations: { destructiveHint: false, idempotentHint: true },
    description: 'Edita una entrada de horas existente. El id de la entrada sale de ver_registro. Solo se cambian los campos indicados.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id de la entrada (de ver_registro)' },
        fecha: { type: 'string', description: 'Nueva fecha YYYY-MM-DD' },
        horas: { type: 'number', description: 'Nuevas horas' },
        concepto: { type: 'string', description: 'Nuevo concepto' },
        persona: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'], description: 'Nueva persona' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'borrar_entrada',
    annotations: { destructiveHint: true },
    description: 'Borra una entrada de horas (irreversible). El id sale de ver_registro.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id de la entrada (de ver_registro)' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'crear_proyecto',
    annotations: { destructiveHint: false },
    description: 'Crea un proyecto de bolsa de horas para un cliente. Si el cliente tiene presupuestos en la app, hereda automáticamente el idioma del más reciente y la tarifa del más reciente en modo por horas; "tarifa" e "idioma" solo hacen falta para forzarlos o si el cliente es nuevo. Devuelve el enlace público del proyecto.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nombre del cliente (será también el nombre del proyecto)' },
        tarifa: { type: 'number', description: '€/h; omitir para heredar del presupuesto del cliente' },
        idioma: { type: 'string', enum: ['es', 'en'], description: 'Idioma de la vista pública; omitir para heredar' },
      },
      required: ['cliente'],
      additionalProperties: false,
    },
  },
  {
    name: 'anadir_horas',
    annotations: { destructiveHint: false, idempotentHint: true },
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
    const rows = entries.map((e) => `[${e.id}] ${e.date}  ${e.hours} h  ${e.person}  ${e.description || ''}`).join('\n')
    const amount = found.hourlyRate ? ` · ${(total * found.hourlyRate).toFixed(2)} € (a ${found.hourlyRate} €/h)` : ''
    return { text: `${found.name} — Total ${total} h${amount}\n${rows || '(sin entradas)'}\nVista cliente: ${PUBLIC_BASE}/h/${found.slug}` }
  }

  if (name === 'ver_facturas') {
    if (!holdedConfigured()) return { text: 'Holded no está conectado (falta HOLDED_API_KEY).', isError: true }
    const cliente = String(args.cliente || '').trim()
    if (!cliente) {
      const contacts = await invoicedContacts()
      return { text: contacts.map((c) => `${c.name} — ${c.count} facturas, última ${c.last}`).join('\n') || 'Sin facturas en 2 años.' }
    }
    const n = Math.min(Math.max(Number(args.cuantas) || 3, 1), 6)
    const docs = await recentInvoices(cliente, n)
    if (docs.length === 0) return { text: `No hay facturas recientes para "${cliente}".` }
    return { text: JSON.stringify(docs, null, 1) }
  }

  if (name === 'preparar_facturas' || name === 'crear_borrador_factura') {
    if (!holdedConfigured()) return { text: 'Holded no está conectado (falta HOLDED_API_KEY).', isError: true }
    const ym = typeof args.mes === 'string' && /^\d{4}-\d{2}$/.test(args.mes) ? args.mes : todayISO().slice(0, 7)
    const [tps, tes] = await Promise.all([db().collection('timeProjects').get(), db().collection('timeEntries').get()])
    const time: TimeData = {
      projects: tps.docs.map((d) => ({ id: d.id, ...(d.data() as { name?: string; hourlyRate?: number }) })),
      entries: tes.docs.map((d) => d.data() as { projectId: string; date?: string; hours?: number }),
    }
    if (name === 'preparar_facturas') {
      const props = await proposeAll(ym, time)
      return { text: `Propuesta de facturas ${ym} (se crearían como BORRADOR en Holded)\n\n${props.map(formatProposal).join('\n\n')}` }
    }
    if (args.confirmado !== true) {
      return { text: 'No creado: falta confirmado=true. Enseña antes la propuesta (preparar_facturas) y espera el OK explícito.', isError: true }
    }
    const { proposal, created } = await createDraft(String(args.cliente), ym, time)
    if (!created) {
      return { text: `No creado.\n${formatProposal(proposal)}`, isError: true }
    }
    return { text: `✓ Borrador creado en Holded (sin número, pendiente de aprobar por vosotros)\n${formatProposal(proposal)}\nId: ${created.id}` }
  }

  if (name === 'facturacion') {
    if (!holdedConfigured()) return { text: 'Holded no está conectado (falta HOLDED_API_KEY en Vercel).', isError: true }
    const year = typeof args.anio === 'number' ? args.anio : Number(todayISO().slice(0, 4))
    const s = await billingSummary(year)
    const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const monthLines = s.byMonth.map((v, i) => (v ? `  ${meses[i]}: ${eur(v)}` : '')).filter(Boolean).join('\n')
    const clientLines = s.byClient.slice(0, 10).map((c) => `  ${c.name}: ${eur(c.base)}`).join('\n')
    return {
      text: [
        `Facturación ${year} (Holded)`,
        `Base imponible: ${eur(s.base)} · Total con IVA: ${eur(s.total)}`,
        `${s.invoices} facturas${s.creditNotes ? ` · ${s.creditNotes} rectificativas` : ''}`,
        s.lastInvoice ? `Última: ${s.lastInvoice.number ?? ''} ${s.lastInvoice.client ?? ''} ${s.lastInvoice.date} (${eur(s.lastInvoice.base)})`.replace(/\s+/g, ' ') : '',
        monthLines ? `\nPor mes (base)\n${monthLines}` : '',
        clientLines ? `\nPor cliente (base)\n${clientLines}` : '',
      ].filter(Boolean).join('\n'),
    }
  }

  if (name === 'resumen_semana') {
    const cid = await boardCompanyId()
    if (!cid) return { text: 'No se pudo resolver la empresa.', isError: true }
    const today = todayISO()
    const shift = (d: number) => {
      const x = new Date(today + 'T00:00:00')
      x.setDate(x.getDate() + d)
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    }
    const weekStart = shift(-6)        // últimos 7 días, hoy incluido
    const prevStart = shift(-13)       // los 7 anteriores
    const staleCut = shift(-14)

    const [projects, entriesSnap, board] = await Promise.all([
      getProjects(),
      db().collection('timeEntries').where('companyId', '==', cid).get(),
      readBoard(cid),
    ])
    const entries = entriesSnap.docs.map((d) => d.data() as { projectId: string; date?: string; hours?: number })

    // Horas por proyecto: esta semana vs la anterior
    const hoursLines: string[] = []
    let weekTotal = 0
    let prevTotal = 0
    for (const p of projects) {
      let w = 0, pw = 0
      for (const e of entries) {
        if (e.projectId !== p.id || !e.date) continue
        if (e.date >= weekStart) w += e.hours || 0
        else if (e.date >= prevStart) pw += e.hours || 0
      }
      weekTotal += w
      prevTotal += pw
      if (w === 0 && pw === 0) continue
      const delta = w - pw
      const arrow = delta > 0 ? `▲ ${+delta.toFixed(2)}` : delta < 0 ? `▼ ${+(-delta).toFixed(2)}` : '='
      hoursLines.push(`- ${p.name}: ${+w.toFixed(2)} h (${arrow} vs semana anterior)`)
    }

    // Novedades del tablón en la semana
    const ownerOf = (gname: string) => board.groups.find((g) => g.name === gname)?.owner ?? 'Eric y Andoni'
    const news = board.chips
      .filter((c) => c.date && c.date >= weekStart)
      .sort((a, b) => (b.date! > a.date! ? 1 : -1))
      .map((c) => {
        const eff = c.who ?? ownerOf(c.group)
        return `- ${c.date} [${c.group}] ${c.text} — ${eff === 'Eric y Andoni' ? 'los dos' : `para ${eff}`}`
      })

    // Proyectos del tablón sin actividad (notas, estado ni horas) en 14 días
    const lastActivity = (gname: string) => {
      const g = board.groups.find((x) => x.name === gname)
      let last = g?.statusDate ?? ''
      for (const c of board.chips) if (c.group === gname && c.date && c.date > last) last = c.date
      const n = gname.toLowerCase()
      const tp = projects.find((p) => {
        const pn = (p.name || '').toLowerCase()
        return pn.includes(n) || n.includes(pn)
      })
      if (tp) for (const e of entries) if (e.projectId === tp.id && e.date && e.date > last) last = e.date
      return last
    }
    const stale = board.groups
      .map((g) => ({ name: g.name, last: lastActivity(g.name) }))
      .filter((x) => !x.last || x.last < staleCut)
      .map((x) => `- ${x.name}${x.last ? ` (última actividad ${x.last})` : ' (sin actividad registrada)'}`)

    const daysTo = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
    const whenTxt = (d: number) => (d < 0 ? `vencido hace ${-d} días` : d === 0 ? 'HOY' : d === 1 ? 'mañana' : `en ${d} días`)
    const upcoming = [
      ...board.groups
        .filter((g) => g.deadline && daysTo(g.deadline) <= 30)
        .map((g) => ({ k: g.deadline!, t: `- ${g.name}: ${g.deadlineLabel || 'Entrega'} el ${g.deadline} (${whenTxt(daysTo(g.deadline!))})` })),
      ...board.chips
        .filter((c) => c.due && !c.state && daysTo(c.due) >= -1 && daysTo(c.due) <= 14)
        .map((c) => ({ k: c.due! + (c.time ?? ''), t: `- ${c.group}: ${c.text} — ${c.due}${c.time ? ' ' + c.time : ''} (${whenTxt(daysTo(c.due!))})` })),
    ].sort((a, b) => a.k.localeCompare(b.k)).map((x) => x.t)

    if (hoursLines.length === 0 && news.length === 0 && stale.length === 0 && upcoming.length === 0) {
      return { text: 'Semana tranquila: sin horas, sin novedades y ningún proyecto parado.' }
    }
    const sections: string[] = [`Resumen ${weekStart} → ${today}`]
    if (upcoming.length) sections.push(`\nPróximas fechas\n${upcoming.join('\n')}`)
    const waitingList = board.chips.filter((c) => c.state === 'esperando').map((c) => `- ${c.group}: ${c.text}${c.stateDate ? ` (desde ${c.stateDate})` : ''}`)
    if (waitingList.length) sections.push(`\nEsperando feedback\n${waitingList.join('\n')}`)
    if (hoursLines.length) {
      sections.push(`\nHoras: ${+weekTotal.toFixed(2)} h esta semana (${+prevTotal.toFixed(2)} h la anterior)\n${hoursLines.join('\n')}`)
    }
    if (news.length) sections.push(`\nNovedades del tablón\n${news.join('\n')}`)
    if (stale.length) sections.push(`\nSin movimiento en 14+ días\n${stale.join('\n')}`)
    return { text: sections.join('\n') }
  }

  if (name === 'ver_tablero' || name === 'novedades' || name === 'anadir_nota' || name === 'asignar_nota' || name === 'quitar_nota' || name === 'mover_proyecto' || name === 'estado_proyecto' || name === 'crear_proyecto_tablero' || name === 'editar_nota') {
    const cid = await boardCompanyId()
    if (!cid) return { text: 'No se pudo resolver la empresa (no hay proyectos de horas).', isError: true }
    const board = await readBoard(cid)

    if (name === 'ver_tablero') {
      if (board.groups.length === 0) return { text: 'El tablero está vacío.' }
      return { text: renderBoard(board) }
    }

    if (name === 'novedades') {
      const dias = typeof args.dias === 'number' && args.dias > 0 ? args.dias : 7
      const quien = args.quien === 'Eric' || args.quien === 'Andoni' ? args.quien : null
      const cutoff = new Date(todayISO() + 'T00:00:00')
      cutoff.setDate(cutoff.getDate() - dias)
      const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
      const ownerOf = (gname: string) => board.groups.find((g) => g.name === gname)?.owner ?? 'Eric y Andoni'
      const recent = board.chips
        .filter((c) => c.date && c.date >= cutoffISO)
        .filter((c) => {
          if (!quien) return true
          const eff = c.who ?? ownerOf(c.group)
          return eff === quien || eff === 'Eric y Andoni'
        })
        .sort((a, b) => (b.date! > a.date! ? 1 : -1))
      if (recent.length === 0) {
        return { text: `Sin novedades en los últimos ${dias} días${quien ? ` para ${quien}` : ''}.` }
      }
      const lines = recent.map((c) => {
        const eff = c.who ?? ownerOf(c.group)
        return `${c.date} · [${c.group}] ${c.text} — ${eff === 'Eric y Andoni' ? 'los dos' : `para ${eff}`}${c.by && c.by !== eff ? ` (de ${c.by})` : ''}`
      })
      return { text: lines.join('\n') }
    }

    if (name === 'anadir_nota') {
      const items: Array<{ texto: string; quien?: string; fecha?: string; hora?: string; estado?: string }> = Array.isArray(args.notas)
        ? (args.notas as Array<{ texto?: string; quien?: string; fecha?: string; hora?: string; estado?: string }>).map((n) => ({ texto: String(n.texto || '').trim(), quien: n.quien, fecha: n.fecha, hora: n.hora, estado: n.estado }))
        : [{ texto: String(args.texto || '').trim(), quien: args.quien as string | undefined, fecha: args.fecha as string | undefined, hora: args.hora as string | undefined, estado: undefined as string | undefined }]
      const valid = items.filter((n) => n.texto)
      if (valid.length === 0) return { text: 'Falta "texto" o "notas".', isError: true }
      const needle = String(args.proyecto || '').trim()
      let group = board.groups.find((g) => g.name.toLowerCase().includes(needle.toLowerCase()))
      let created = false
      if (!group) {
        group = { name: needle, color: BOARD_COLORS[board.groups.length % BOARD_COLORS.length], status: board.lanes[0] }
        board.groups.push(group)
        created = true
      }
      const by = args.de === 'Eric' || args.de === 'Andoni' ? String(args.de) : undefined
      const g = group
      const existing = new Set(board.chips.filter((c) => c.group === g.name).map((c) => c.text.trim().toLowerCase()))
      const added: string[] = []
      const skipped: string[] = []
      for (const n of valid) {
        // idempotente: no duplica una nota idéntica ya existente en el proyecto
        if (existing.has(n.texto.toLowerCase())) { skipped.push(n.texto); continue }
        existing.add(n.texto.toLowerCase())
        const who = BOARD_PEOPLE.includes(String(n.quien)) ? String(n.quien) : undefined
        const parsed = parseWhen(n.texto, todayISO())
        const due = n.fecha && /^\d{4}-\d{2}-\d{2}$/.test(n.fecha) ? n.fecha : parsed.due
        const time = n.hora && /^\d{1,2}:\d{2}$/.test(n.hora) ? n.hora.padStart(5, '0') : parsed.time
        const waiting = n.estado === 'esperando' || n.estado === 'hecha'
        board.chips.push({
          group: g.name, text: n.texto, date: todayISO(),
          ...(who ? { who } : {}), ...(by ? { by } : {}),
          ...(due ? { due } : {}), ...(due && time ? { time } : {}),
          ...(waiting ? { state: n.estado, stateDate: todayISO() } : {}),
        })
        added.push(`  · ${n.texto}${who ? ` — ${who}` : ''}${due ? ` 📅 ${due}${time ? ' ' + time : ''}` : ''}${waiting ? ' [esperando feedback]' : ''}`)
      }
      if (added.length) await writeBoard(cid, board)
      const head = `✓ ${added.length} nota${added.length === 1 ? '' : 's'} en "${g.name}"${created ? ' (proyecto nuevo en ' + board.lanes[0] + ')' : ''}`
      return { text: `${head}${added.length ? '\n' + added.join('\n') : ''}${skipped.length ? `\nYa existían: ${skipped.join(' · ')}` : ''}` }
    }

    if (name === 'crear_proyecto_tablero') {
      const nombre = String(args.nombre || '').trim()
      if (!nombre) return { text: 'Falta "nombre".', isError: true }
      let g = board.groups.find((x) => x.name.toLowerCase() === nombre.toLowerCase())
      const created = !g
      let lane = board.lanes[0]
      if (args.carril) {
        const ln = board.lanes.filter((l) => l.toLowerCase().includes(String(args.carril).toLowerCase()))
        if (ln.length !== 1) return { text: `Carril "${args.carril}" ${ln.length ? 'ambiguo' : 'no existe'}. Carriles: ${board.lanes.join(', ')}`, isError: true }
        lane = ln[0]
      }
      if (args.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(String(args.deadline))) {
        return { text: `Deadline inválido (YYYY-MM-DD): ${args.deadline}`, isError: true }
      }
      if (!g) {
        g = { name: nombre, color: BOARD_COLORS[board.groups.length % BOARD_COLORS.length], status: lane }
        board.groups.push(g)
      }
      const patch: Partial<BoardGroup> = {}
      if (args.carril || created) patch.status = lane
      if (BOARD_PEOPLE.includes(String(args.responsable))) patch.owner = String(args.responsable)
      if (args.salud === 'verde' || args.salud === 'ambar' || args.salud === 'rojo') { patch.health = String(args.salud); patch.statusDate = todayISO() }
      if (args.estado !== undefined) { patch.statusNote = String(args.estado).trim() || undefined; patch.statusDate = todayISO() }
      if (args.deadline) patch.deadline = String(args.deadline)
      if (args.deadline_que !== undefined) patch.deadlineLabel = String(args.deadline_que).trim() || undefined
      const gname = g.name
      board.groups = board.groups.map((x) => (x.name === gname ? { ...x, ...patch } : x))
      const by = args.de === 'Eric' || args.de === 'Andoni' ? String(args.de) : undefined
      const existing = new Set(board.chips.filter((c) => c.group === gname).map((c) => c.text.trim().toLowerCase()))
      let n = 0
      for (const raw of (Array.isArray(args.notas) ? args.notas as Array<{ texto?: string; quien?: string }> : [])) {
        const t = String(raw.texto || '').trim()
        if (!t || existing.has(t.toLowerCase())) continue
        existing.add(t.toLowerCase())
        const who = BOARD_PEOPLE.includes(String(raw.quien)) ? String(raw.quien) : undefined
        board.chips.push({ group: gname, text: t, date: todayISO(), ...(who ? { who } : {}), ...(by ? { by } : {}) })
        n++
      }
      await writeBoard(cid, board)
      const final = board.groups.find((x) => x.name === gname)!
      const parts = [
        `carril ${final.status ?? board.lanes[0]}`,
        `responsable ${final.owner === 'Eric' || final.owner === 'Andoni' ? final.owner : 'los dos'}`,
        final.deadline ? `entrega ${final.deadlineLabel || ''} ${final.deadline}`.replace('  ', ' ') : '',
        n ? `${n} nota${n === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join(' · ')
      return { text: `✓ ${created ? 'Creado' : 'Actualizado'} "${gname}": ${parts}` }
    }

    const found = findBoardGroup(board, String(args.proyecto || ''))
    if (typeof found === 'string') return { text: found, isError: true }

    if (name === 'editar_nota') {
      const needle = String(args.texto || '').trim().toLowerCase()
      const matches = board.chips.filter((c) => c.group === found.name && c.text.toLowerCase().includes(needle))
      if (matches.length !== 1) {
        const list = board.chips.filter((c) => c.group === found.name).map((c) => `- ${c.text}`).join('\n') || '(sin notas)'
        return { text: `${matches.length ? 'Varias' : 'Ninguna'} nota${matches.length ? 's coinciden' : ' coincide'} con "${args.texto}" en "${found.name}":\n${list}`, isError: true }
      }
      const nuevo = args.nuevo_texto !== undefined ? String(args.nuevo_texto).trim() : undefined
      const quien = BOARD_PEOPLE.includes(String(args.quien)) ? String(args.quien) : undefined
      const estado = args.estado === 'pendiente' || args.estado === 'esperando' || args.estado === 'hecha' ? String(args.estado) : undefined
      const fecha = args.fecha !== undefined ? String(args.fecha).trim() : undefined
      const hora = args.hora !== undefined ? String(args.hora).trim() : undefined
      if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { text: `Fecha inválida (YYYY-MM-DD): ${fecha}`, isError: true }
      if (!nuevo && !quien && !estado && fecha === undefined && hora === undefined) {
        return { text: 'Indica qué cambiar: nuevo_texto, quien, estado, fecha u hora.', isError: true }
      }
      board.chips = board.chips.map((c) => {
        if (c !== matches[0]) return c
        let next: BoardChip = { ...c, ...(nuevo ? { text: nuevo } : {}), ...(quien ? { who: quien } : {}) }
        if (estado === 'esperando' || estado === 'hecha') next = { ...next, state: estado, stateDate: todayISO() }
        if (estado === 'pendiente') { const { state: _s, stateDate: _d, ...rest } = next; next = rest }
        if (fecha === '') { const { due: _d, time: _t, ...rest } = next; next = rest }
        else if (fecha) next = { ...next, due: fecha }
        if (hora !== undefined && next.due) next = hora ? { ...next, time: hora.padStart(5, '0') } : (({ time: _t, ...rest }) => rest)(next)
        return next
      })
      await writeBoard(cid, board)
      const after = board.chips.find((c) => c.group === found.name && c.text === (nuevo ?? matches[0].text))
      const extra = [
        quien ? quien : '',
        after?.state === 'esperando' ? 'esperando feedback' : after?.state === 'hecha' ? 'hecha' : estado === 'pendiente' ? 'pendiente' : '',
        after?.due ? `📅 ${after.due}${after.time ? ' ' + after.time : ''}` : fecha === '' ? 'sin fecha' : '',
      ].filter(Boolean).join(' · ')
      return { text: `✓ Nota actualizada en "${found.name}": ${nuevo ?? matches[0].text}${extra ? ` — ${extra}` : ''}` }
    }

    if (name === 'quitar_nota' || name === 'asignar_nota') {
      const needle = String(args.texto || '').trim().toLowerCase()
      const matches = board.chips.filter((c) => c.group === found.name && c.text.toLowerCase().includes(needle))
      if (matches.length === 0) {
        const list = board.chips.filter((c) => c.group === found.name).map((c) => `- ${c.text}`).join('\n') || '(sin notas)'
        return { text: `Ninguna nota de "${found.name}" contiene "${args.texto}". Notas:\n${list}`, isError: true }
      }
      if (matches.length > 1) {
        return { text: `"${args.texto}" coincide con varias notas de "${found.name}":\n${matches.map((c) => `- ${c.text}`).join('\n')}\nSé más específico.`, isError: true }
      }
      if (name === 'asignar_nota') {
        const who = String(args.quien)
        if (!BOARD_PEOPLE.includes(who)) return { text: `"quien" debe ser: ${BOARD_PEOPLE.join(', ')}`, isError: true }
        board.chips = board.chips.map((c) => (c === matches[0] ? { ...c, who } : c))
        await writeBoard(cid, board)
        return { text: `✓ "${matches[0].text}" asignada a ${who}` }
      }
      board.chips = board.chips.filter((c) => c !== matches[0])
      await writeBoard(cid, board)
      return { text: `✓ Quitada de "${found.name}": ${matches[0].text}` }
    }

    if (name === 'estado_proyecto') {
      const salud = args.salud === 'verde' || args.salud === 'ambar' || args.salud === 'rojo' ? String(args.salud) : undefined
      const nota = args.nota !== undefined ? String(args.nota).trim() : undefined
      const responsable = BOARD_PEOPLE.includes(String(args.responsable)) ? String(args.responsable) : undefined
      const deadline = args.deadline !== undefined ? String(args.deadline).trim() : undefined
      const deadlineQue = args.deadline_que !== undefined ? String(args.deadline_que).trim() : undefined
      if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
        return { text: `Deadline inválido (usa YYYY-MM-DD): ${deadline}`, isError: true }
      }
      if (!salud && nota === undefined && !responsable && deadline === undefined && deadlineQue === undefined) {
        return { text: 'Indica qué cambiar: salud, nota, responsable o deadline.', isError: true }
      }
      board.groups = board.groups.map((g) =>
        g.name === found.name
          ? {
              ...g,
              ...(salud ? { health: salud } : {}),
              ...(nota !== undefined ? { statusNote: nota || undefined } : {}),
              ...(responsable ? { owner: responsable } : {}),
              ...(deadline !== undefined ? { deadline: deadline || undefined } : {}),
              ...(deadline === '' ? { deadlineLabel: undefined } : deadlineQue !== undefined ? { deadlineLabel: deadlineQue || undefined } : {}),
              ...(salud || nota !== undefined ? { statusDate: todayISO() } : {}),
            }
          : g
      )
      await writeBoard(cid, board)
      const parts = [
        salud ? HEALTH_ICON[salud] : '',
        nota !== undefined ? nota || '(nota borrada)' : '',
        responsable ? `responsable: ${responsable}` : '',
        deadline === '' ? 'deadline quitado' : deadline ? `deadline: ${deadlineQue || 'entrega'} el ${deadline}` : '',
      ].filter(Boolean).join(' · ')
      return { text: `✓ Estado de "${found.name}": ${parts}` }
    }

    // mover_proyecto
    const laneNeedle = String(args.carril || '').trim().toLowerCase()
    const lanes = board.lanes.filter((l) => l.toLowerCase().includes(laneNeedle))
    if (lanes.length !== 1) {
      return { text: `Carril "${args.carril}" ${lanes.length === 0 ? 'no existe' : 'es ambiguo'}. Carriles: ${board.lanes.join(', ')}`, isError: true }
    }
    board.groups = board.groups.map((g) => (g.name === found.name ? { ...g, status: lanes[0] } : g))
    await writeBoard(cid, board)
    return { text: `✓ "${found.name}" movido a ${lanes[0]}` }
  }

  if (name === 'editar_entrada' || name === 'borrar_entrada') {
    const id = String(args.id || '').trim()
    if (!id) return { text: 'Falta "id" (sale de ver_registro).', isError: true }
    const ref = db().collection('timeEntries').doc(id)
    const snap = await ref.get()
    if (!snap.exists) return { text: `No existe ninguna entrada con id ${id}.`, isError: true }
    const current = snap.data() as { date?: string; hours?: number; person?: string; description?: string }

    if (name === 'borrar_entrada') {
      await ref.delete()
      return { text: `✓ Borrada: ${current.date}  ${current.hours} h  ${current.person}  ${current.description || ''}` }
    }

    const patch: Record<string, unknown> = {}
    if (args.fecha !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(args.fecha))) {
        return { text: `Fecha inválida (usa YYYY-MM-DD): ${args.fecha}`, isError: true }
      }
      patch.date = args.fecha
    }
    if (args.horas !== undefined) {
      const h = Number(args.horas)
      if (!h || h <= 0) return { text: `Horas inválidas: ${args.horas}`, isError: true }
      patch.hours = h
    }
    if (args.concepto !== undefined) patch.description = String(args.concepto).trim()
    if (args.persona !== undefined) patch.person = String(args.persona).trim()
    if (Object.keys(patch).length === 0) {
      return { text: 'Indica al menos un campo a cambiar (fecha, horas, concepto o persona).', isError: true }
    }
    await ref.update(patch)
    const updated = { ...current, ...patch } as typeof current & { date?: string }
    return { text: `✓ Actualizada: ${updated.date}  ${updated.hours} h  ${updated.person}  ${updated.description || ''}` }
  }

  if (name === 'crear_proyecto') {
    const cliente = String(args.cliente || '').trim()
    if (!cliente) return { text: 'Falta "cliente".', isError: true }

    // Evitar duplicados: si ya existe un proyecto para ese cliente, devolverlo
    const existing = await getProjects()
    const dupe = existing.find((p) =>
      (p.name || '').toLowerCase() === cliente.toLowerCase() ||
      (p.clientName || '').toLowerCase() === cliente.toLowerCase()
    )
    if (dupe) {
      return {
        text: `Ya existe un proyecto para "${dupe.name}" (${PUBLIC_BASE}/h/${dupe.slug}). Usa anadir_horas sobre él, o pide crearlo con otro nombre.`,
        isError: true,
      }
    }

    const meta = await clientMetaFromQuotes(cliente)
    const hourlyRate = typeof args.tarifa === 'number' && args.tarifa > 0 ? args.tarifa : meta.hourlyRate
    const language = args.idioma === 'en' || args.idioma === 'es' ? args.idioma : (meta.language ?? 'es')

    // companyId: del presupuesto del cliente, o de cualquier proyecto/presupuesto existente
    let companyId = meta.companyId || existing[0]?.companyId
    if (!companyId) {
      const anyQuote = await db().collection('quotes').limit(1).get()
      companyId = (anyQuote.docs[0]?.data()?.companyId as string) || ''
    }

    // Snapshot de empresa para la vista pública
    let companyName = ''
    let logoUrl = ''
    if (companyId) {
      const comp = await db().collection('companies').doc(companyId).get()
      if (comp.exists) {
        companyName = (comp.data()?.name as string) || ''
        logoUrl = (comp.data()?.logoUrl as string) || ''
      }
    }

    const slug = await generateUniqueSlug(cliente)
    await db().collection('timeProjects').add({
      name: cliente,
      clientName: cliente,
      slug,
      language,
      ...(hourlyRate ? { hourlyRate } : {}),
      companyName,
      logoUrl,
      companyId,
      createdBy: 'claude-mcp',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    const heritage = meta.matchedQuotes > 0
      ? ` (heredado de ${meta.matchedQuotes} presupuesto(s) del cliente)`
      : ' (cliente sin presupuestos: revisa tarifa e idioma)'
    return {
      text: `✓ Proyecto "${cliente}" creado — idioma ${language}${hourlyRate ? `, ${hourlyRate} €/h` : ', sin tarifa'}${heritage}\nVista cliente: ${PUBLIC_BASE}/h/${slug}`,
    }
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
    const skipped: string[] = []
    let sum = 0

    // Idempotencia: una entrada idéntica (fecha + horas + concepto) ya registrada
    // en el proyecto no se duplica — protege contra reintentos del agente.
    const existingSnap = await database.collection('timeEntries').where('projectId', '==', found.id).get()
    const seen = new Set(
      existingSnap.docs.map((d) => {
        const x = d.data() as { date?: string; hours?: number; description?: string }
        return `${x.date}|${x.hours}|${(x.description || '').trim().toLowerCase()}`
      })
    )

    for (const e of entradas) {
      const hours = Number(e.horas)
      if (!hours || hours <= 0) return { text: `Horas inválidas: ${e.horas}`, isError: true }
      if (e.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)) {
        return { text: `Fecha inválida (usa YYYY-MM-DD): ${e.fecha}`, isError: true }
      }
      const key = `${e.fecha || todayISO()}|${hours}|${(e.concepto || '').trim().toLowerCase()}`
      if (seen.has(key)) {
        skipped.push(`= ${e.fecha || todayISO()}  ${hours} h  ${(e.concepto || '').trim()}`)
        continue
      }
      seen.add(key)
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
    if (added.length > 0) await batch.commit()
    const skippedNote = skipped.length
      ? `\nYa existían (no se duplican):\n${skipped.join('\n')}`
      : ''
    if (added.length === 0) {
      return { text: `Nada nuevo que añadir a "${found.name}".${skippedNote}` }
    }
    return {
      text: `${added.join('\n')}\nAñadidas ${added.length} entrada(s) (${sum} h) a "${found.name}" → ${PUBLIC_BASE}/h/${found.slug}${skippedNote}`,
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
