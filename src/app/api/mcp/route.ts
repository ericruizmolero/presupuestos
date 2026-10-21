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

interface BoardGroup { name: string; color: string; status?: string }
interface BoardChip { group: string; text: string; who?: string }
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
  await db().collection('planning').doc(companyId).set({
    lanes: board.lanes,
    groups: board.groups,
    chips: board.chips,
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
      lines.push(`- ${g.name}${chips.length ? ':' : ' (sin notas)'}`)
      for (const c of chips) lines.push(`    · ${c.text}${c.who ? ` — ${c.who}` : ''}`)
    }
  }
  return lines.join('\n')
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
    name: 'ver_tablero',
    description: 'Muestra el tablero de proyectos (sección Proyectos de la app): carriles de prioridad con los proyectos activos y las notas de lo que se está haciendo en cada uno. Úsalo para responder "¿en qué estamos?".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'anadir_nota',
    description: 'Añade una nota (post-it) a un proyecto del tablero. Si el proyecto no existe en el tablero, se crea en el primer carril.',
    inputSchema: {
      type: 'object',
      properties: {
        proyecto: { type: 'string', description: 'Nombre del proyecto del tablero (acepta substring)' },
        texto: { type: 'string', description: 'Texto de la nota, corto' },
        quien: { type: 'string', enum: ['Eric', 'Andoni', 'Eric y Andoni'], description: 'Quién lo lleva; omitir si no se sabe' },
      },
      required: ['proyecto', 'texto'],
      additionalProperties: false,
    },
  },
  {
    name: 'asignar_nota',
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
    description: 'Quita una nota del tablero (p. ej. al terminarla). El texto se busca por coincidencia parcial dentro del proyecto.',
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

  if (name === 'ver_tablero' || name === 'anadir_nota' || name === 'asignar_nota' || name === 'quitar_nota' || name === 'mover_proyecto') {
    const cid = await boardCompanyId()
    if (!cid) return { text: 'No se pudo resolver la empresa (no hay proyectos de horas).', isError: true }
    const board = await readBoard(cid)

    if (name === 'ver_tablero') {
      if (board.groups.length === 0) return { text: 'El tablero está vacío.' }
      return { text: renderBoard(board) }
    }

    if (name === 'anadir_nota') {
      const texto = String(args.texto || '').trim()
      if (!texto) return { text: 'Falta "texto".', isError: true }
      const needle = String(args.proyecto || '').trim()
      let group = board.groups.find((g) => g.name.toLowerCase().includes(needle.toLowerCase()))
      let created = false
      if (!group) {
        group = { name: needle, color: BOARD_COLORS[board.groups.length % BOARD_COLORS.length], status: board.lanes[0] }
        board.groups.push(group)
        created = true
      }
      const who = BOARD_PEOPLE.includes(String(args.quien)) ? String(args.quien) : undefined
      board.chips.push({ group: group.name, text: texto, ...(who ? { who } : {}) })
      await writeBoard(cid, board)
      return { text: `✓ Nota en "${group.name}"${created ? ' (proyecto nuevo en ' + board.lanes[0] + ')' : ''}: ${texto}${who ? ` — ${who}` : ''}` }
    }

    const found = findBoardGroup(board, String(args.proyecto || ''))
    if (typeof found === 'string') return { text: found, isError: true }

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
