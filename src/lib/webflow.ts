/**
 * Centro de cuentas Webflow: Savvia guarda una autorización OAuth por cada espacio o cuenta de Webflow
 * y reenvía las llamadas MCP al servidor oficial (mcp.webflow.com) con el token que toque.
 * Los tokens van cifrados (AES-256-GCM, clave WEBFLOW_TOKEN_KEY) y nunca salen del servidor.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { adminDb } from './adminDb'

export const WF = {
  base: 'https://mcp.webflow.com',
  mcp: 'https://mcp.webflow.com/mcp',
  authorize: 'https://mcp.webflow.com/oauth/authorize',
  token: 'https://mcp.webflow.com/oauth/token',
  register: 'https://mcp.webflow.com/oauth/register',
}
export const APP_BASE = 'https://client.savvia.studio'
export const REDIRECT_URI = `${APP_BASE}/api/webflow/callback`
const CONNECTIONS = 'webflowConnections'
const PENDING = 'webflowPending'
const CLIENT_DOC = 'webflowOAuth/client'
const TOOLS_TTL = 60 * 60 * 1000
const PROTOCOL = '2025-06-18'

// ── Cifrado ──────────────────────────────────────────────────────────────────
function key(): Buffer {
  const raw = process.env.WEBFLOW_TOKEN_KEY
  if (!raw) throw new Error('WEBFLOW_TOKEN_KEY no configurada')
  const k = Buffer.from(raw, 'base64')
  if (k.length !== 32) throw new Error('WEBFLOW_TOKEN_KEY debe ser 32 bytes en base64')
  return k
}
export function seal(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.')
}
export function open(sealed: string): string {
  const [iv, tag, ct] = sealed.split('.').map((s) => Buffer.from(s, 'base64'))
  const d = createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// ── Modelo ───────────────────────────────────────────────────────────────────
export interface Connection {
  id: string
  name: string
  workspace?: string
  sites?: string[]
  status: 'ok' | 'caducada'
  active: boolean
  connectedBy?: string
  connectedAt?: string
  lastUsedAt?: string
}
interface Stored extends Omit<Connection, 'id'> {
  tokens?: string // sellado: { access, refresh, expiresAt }
  tokenVersion?: number
  toolsCache?: { at: number; json: string }
}
interface Tokens { access: string; refresh?: string; expiresAt?: number }

export function slugName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export function publicView(id: string, d: Stored): Connection {
  return {
    id, name: d.name, workspace: d.workspace, sites: d.sites, status: d.status || 'ok', active: d.active !== false,
    connectedBy: d.connectedBy, connectedAt: d.connectedAt, lastUsedAt: d.lastUsedAt,
  }
}

export async function listConnections(db: Firestore = adminDb()): Promise<Connection[]> {
  const s = await db.collection(CONNECTIONS).get()
  return s.docs.map((d) => publicView(d.id, d.data() as Stored)).sort((a, b) => a.name.localeCompare(b.name))
}

// ── OAuth ────────────────────────────────────────────────────────────────────
/** Registro dinámico de Savvia como cliente OAuth en Webflow (una sola vez) */
async function oauthClient(db: Firestore): Promise<{ clientId: string; clientSecret?: string }> {
  const ref = db.doc(CLIENT_DOC)
  const snap = await ref.get()
  const d = snap.data() as { clientId?: string; clientSecret?: string; redirectUri?: string } | undefined
  if (d?.clientId && d.redirectUri === REDIRECT_URI) return { clientId: d.clientId, clientSecret: d.clientSecret ? open(d.clientSecret) : undefined }
  const res = await fetch(WF.register, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Savvia',
      client_uri: APP_BASE,
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  })
  if (!res.ok) throw new Error(`Webflow no aceptó el registro del cliente OAuth (${res.status})`)
  const j = (await res.json()) as { client_id: string; client_secret?: string }
  await ref.set({ clientId: j.client_id, clientSecret: j.client_secret ? seal(j.client_secret) : null, redirectUri: REDIRECT_URI, at: new Date().toISOString() })
  return { clientId: j.client_id, clientSecret: j.client_secret }
}

/** Prepara una conexión (nueva o reconexión) y devuelve la URL de autorización de Webflow */
export async function startConnect(by: string, name: string, connectionId?: string): Promise<string> {
  const db = adminDb()
  const { clientId } = await oauthClient(db)
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(24))
  await db.collection(PENDING).doc(state).set({ verifier: seal(verifier), name, by, connectionId: connectionId || null, createdAt: Date.now() })
  const u = new URL(WF.authorize)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', REDIRECT_URI)
  u.searchParams.set('code_challenge', challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('state', state)
  u.searchParams.set('resource', WF.mcp)
  return u.toString()
}

async function tokenRequest(db: Firestore, params: Record<string, string>): Promise<Tokens> {
  const { clientId, clientSecret } = await oauthClient(db)
  const body = new URLSearchParams({ ...params, client_id: clientId, resource: WF.mcp })
  if (clientSecret) body.set('client_secret', clientSecret)
  const res = await fetch(WF.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body })
  if (!res.ok) {
    // sin cuerpo en el log: podría llevar datos sensibles
    throw Object.assign(new Error(`token ${res.status}`), { status: res.status })
  }
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number }
  return { access: j.access_token, refresh: j.refresh_token, expiresAt: j.expires_in ? Date.now() + j.expires_in * 1000 : undefined }
}

/** Vuelta de Webflow: canjea el código y guarda la conexión. Devuelve el nombre */
export async function finishConnect(state: string, code: string): Promise<string> {
  const db = adminDb()
  const pref = db.collection(PENDING).doc(state)
  const p = (await pref.get()).data() as { verifier: string; name: string; by: string; connectionId: string | null; createdAt: number } | undefined
  if (!p) throw new Error('Este enlace de conexión ya se usó o no existe. Vuelve a empezar desde Savvia.')
  await pref.delete()
  if (Date.now() - p.createdAt > 15 * 60 * 1000) throw new Error('El enlace de conexión ha caducado. Vuelve a empezar desde Savvia.')
  const t = await tokenRequest(db, { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: open(p.verifier) })
  const ref = p.connectionId ? db.collection(CONNECTIONS).doc(p.connectionId) : db.collection(CONNECTIONS).doc()
  const now = new Date().toISOString()
  await ref.set({
    name: p.name, status: 'ok', active: true, connectedBy: p.by, connectedAt: now,
    tokens: seal(JSON.stringify(t)), tokenVersion: FieldValue.increment(1), toolsCache: FieldValue.delete(),
  }, { merge: true })
  // Qué espacio es: se apunta si se puede, sin bloquear la conexión
  try { await describeWorkspace(db, ref.id) } catch (e) { console.error('[webflow] No se pudo leer el espacio:', e instanceof Error ? e.message : e) }
  return p.name
}

export async function removeConnection(id: string): Promise<void> {
  const db = adminDb()
  const ref = db.collection(CONNECTIONS).doc(id)
  const d = (await ref.get()).data() as Stored | undefined
  if (d?.tokens) {
    // revocación de buena fe; si Webflow no la acepta, el token muere al caducar
    try {
      const t = JSON.parse(open(d.tokens)) as Tokens
      const { clientId } = await oauthClient(db)
      await fetch(`${WF.base}/oauth/revoke`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: t.refresh || t.access, client_id: clientId }),
      })
    } catch {}
  }
  await ref.delete()
}

// ── Tokens vigentes ──────────────────────────────────────────────────────────
class Expired extends Error {}

async function currentTokens(db: Firestore, id: string, force = false): Promise<Tokens> {
  const ref = db.collection(CONNECTIONS).doc(id)
  const d = (await ref.get()).data() as Stored | undefined
  if (!d?.tokens) throw new Expired()
  const t = JSON.parse(open(d.tokens)) as Tokens
  const stale = force || (t.expiresAt !== undefined && t.expiresAt < Date.now() + 60_000)
  if (!stale) return t
  if (!t.refresh) throw new Expired()
  let fresh: Tokens
  try {
    fresh = await tokenRequest(db, { grant_type: 'refresh_token', refresh_token: t.refresh })
  } catch {
    // ¿lo ha refrescado otra llamada a la vez? entonces usamos el suyo
    const again = (await ref.get()).data() as Stored | undefined
    if (again?.tokenVersion !== d.tokenVersion && again?.tokens) return JSON.parse(open(again.tokens)) as Tokens
    await ref.update({ status: 'caducada' })
    throw new Expired()
  }
  if (!fresh.refresh) fresh.refresh = t.refresh
  await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() as Stored | undefined
    if (cur?.tokenVersion !== d.tokenVersion) return // otro ya guardó uno nuevo; el nuestro también vale
    tx.update(ref, { tokens: seal(JSON.stringify(fresh)), tokenVersion: FieldValue.increment(1), status: 'ok' })
  })
  return fresh
}

// ── Cliente MCP hacia Webflow ────────────────────────────────────────────────
class Unauthorized extends Error {}

async function post(token: string, body: unknown, session?: string): Promise<{ res: Response; json?: { result?: unknown; error?: { message?: string } } }> {
  const res = await fetch(WF.mcp, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL,
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) throw new Unauthorized()
  if (res.status === 202 || res.status === 204) return { res }
  const ct = res.headers.get('content-type') || ''
  const raw = await res.text()
  if (!res.ok) throw new Error(`Webflow respondió ${res.status}`)
  const id = (body as { id?: unknown }).id
  if (ct.includes('text/event-stream')) {
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data:')) continue
      try {
        const m = JSON.parse(line.slice(5).trim())
        if (m && m.id === id) return { res, json: m }
      } catch {}
    }
    throw new Error('Webflow no devolvió respuesta')
  }
  return { res, json: raw ? JSON.parse(raw) : undefined }
}

async function rpcOnce(token: string, method: string, params: unknown): Promise<unknown> {
  const init = await post(token, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'savvia', version: '1.0.0' } },
  })
  const session = init.res.headers.get('mcp-session-id') || undefined
  await post(token, { jsonrpc: '2.0', method: 'notifications/initialized' }, session)
  const r = await post(token, { jsonrpc: '2.0', id: 2, method, params }, session)
  if (r.json?.error) throw new Error(r.json.error.message || 'Error de Webflow')
  return r.json?.result
}

/** Llamada MCP con el token de la conexión; refresca solo si hace falta */
async function rpc(db: Firestore, id: string, method: string, params: unknown): Promise<unknown> {
  let t = await currentTokens(db, id)
  try {
    return await rpcOnce(t.access, method, params)
  } catch (e) {
    if (!(e instanceof Unauthorized)) throw e
    t = await currentTokens(db, id, true)
    try {
      return await rpcOnce(t.access, method, params)
    } catch (e2) {
      if (e2 instanceof Unauthorized) {
        await db.collection(CONNECTIONS).doc(id).update({ status: 'caducada' })
        throw new Expired()
      }
      throw e2
    }
  }
}

type WfTool = { name: string; description?: string; inputSchema?: unknown; annotations?: unknown }

async function toolsOf(db: Firestore, id: string, d: Stored): Promise<WfTool[]> {
  if (d.toolsCache && Date.now() - d.toolsCache.at < TOOLS_TTL) return JSON.parse(d.toolsCache.json)
  const r = (await rpc(db, id, 'tools/list', {})) as { tools?: WfTool[] }
  const tools = r?.tools || []
  await db.collection(CONNECTIONS).doc(id).update({ toolsCache: { at: Date.now(), json: JSON.stringify(tools) } })
  return tools
}

/** Tras conectar: apunta los sitios que ve el token, para reconocer el espacio */
async function describeWorkspace(db: Firestore, id: string): Promise<void> {
  const r = (await rpc(db, id, 'tools/call', { name: 'data_sites_tool', arguments: { actions: [{ list_sites: {} }] } })) as { content?: Array<{ type: string; text?: string }> }
  const text = (r?.content || []).map((c) => c.text || '').join('\n')
  const names = new Set<string>()
  let workspace: string | undefined
  try {
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) return v.forEach(walk)
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>
        if (typeof o.displayName === 'string' && (o.shortName || o.previewUrl)) names.add(o.displayName)
        if (!workspace && typeof o.workspaceName === 'string') workspace = o.workspaceName
        Object.values(o).forEach(walk)
      }
    }
    walk(JSON.parse(text))
  } catch {}
  const patch: Record<string, unknown> = {}
  if (names.size) patch.sites = [...names].slice(0, 20)
  if (workspace) patch.workspace = workspace
  if (Object.keys(patch).length) await db.collection(CONNECTIONS).doc(id).update(patch)
}

// ── Herramientas del conector de Savvia ──────────────────────────────────────
export const WEBFLOW_TOOLS = [
  {
    name: 'webflow_cuentas',
    annotations: { readOnlyHint: true },
    description:
      'Lista las cuentas y espacios de Webflow conectados en Savvia (isotrol, surepayroll, treseiscero, clientes…), con su estado. ' +
      'Úsala antes de trabajar con Webflow para saber qué "cuenta" pasar a webflow_herramientas y webflow. Si no está claro qué cuenta quiere el usuario, pregúntale; no elijas tú.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'webflow_herramientas',
    annotations: { readOnlyHint: true },
    description:
      'Herramientas del MCP oficial de Webflow disponibles para una cuenta. Sin "herramienta" devuelve los nombres con una línea cada uno; con "herramienta" devuelve su esquema completo de argumentos. ' +
      'Pide el esquema antes de llamar a una herramienta que no conozcas. Indica SIEMPRE la cuenta; si no está claro cuál, pregunta.',
    inputSchema: {
      type: 'object',
      properties: {
        cuenta: { type: 'string', description: 'Nombre de la conexión (ver webflow_cuentas)' },
        herramienta: { type: 'string', description: 'Nombre de una herramienta para ver su esquema completo' },
      },
      required: ['cuenta'],
      additionalProperties: false,
    },
  },
  {
    name: 'webflow',
    annotations: { destructiveHint: true },
    description:
      'Ejecuta una herramienta del MCP oficial de Webflow en la cuenta indicada y devuelve su respuesta tal cual. ' +
      'Indica SIEMPRE la cuenta (nunca la supongas: si el usuario no la ha dicho y hay varias posibles, pregúntale). Los argumentos siguen el esquema de webflow_herramientas. ' +
      'Las herramientas de Designer necesitan la Bridge App abierta en el Designer de ese sitio.',
    inputSchema: {
      type: 'object',
      properties: {
        cuenta: { type: 'string', description: 'Nombre de la conexión (ver webflow_cuentas)' },
        herramienta: { type: 'string', description: 'Nombre de la herramienta de Webflow' },
        argumentos: { type: 'object', description: 'Argumentos según su esquema', additionalProperties: true },
      },
      required: ['cuenta', 'herramienta'],
      additionalProperties: false,
    },
  },
]
export const WEBFLOW_TOOL_NAMES = new Set(WEBFLOW_TOOLS.map((t) => t.name))

type Result = { text: string; isError?: boolean; content?: unknown[] }

async function findConnection(db: Firestore, cuenta: unknown): Promise<{ id: string; d: Stored } | Result> {
  const q = slugName(String(cuenta || ''))
  const all = await db.collection(CONNECTIONS).get()
  const names = all.docs.map((x) => (x.data() as Stored).name)
  if (!q) return { text: `Falta la cuenta. Conectadas: ${names.join(', ') || 'ninguna'}. Pregunta al usuario cuál quiere.`, isError: true }
  const doc = all.docs.find((x) => x.id === cuenta || slugName((x.data() as Stored).name) === q)
  if (!doc) return { text: `No hay ninguna cuenta "${cuenta}". Conectadas: ${names.join(', ') || 'ninguna'}. Se conectan en ${APP_BASE}/webflow`, isError: true }
  const d = doc.data() as Stored
  if (d.active === false) return { text: `La cuenta ${d.name} está desactivada para Claude. Se activa en ${APP_BASE}/webflow`, isError: true }
  return { id: doc.id, d }
}

const expired = (name: string): Result => ({ text: `La conexión ${name} ha caducado, reconéctala en ${APP_BASE}/webflow`, isError: true })

export async function handleWebflowTool(db: Firestore, name: string, a: Record<string, unknown>): Promise<Result> {
  if (name === 'webflow_cuentas') {
    const list = await listConnections(db)
    if (!list.length) return { text: `No hay cuentas de Webflow conectadas. Se conectan en ${APP_BASE}/webflow` }
    return {
      text: list.map((c) => {
        const where = [c.workspace, c.sites?.length ? `sitios: ${c.sites.join(', ')}` : ''].filter(Boolean).join('; ')
        const st = !c.active ? 'desactivada' : c.status === 'caducada' ? 'caducada, hay que reconectar' : 'ok'
        return `- ${c.name} (${st})${where ? `: ${where}` : ''}`
      }).join('\n'),
    }
  }

  const found = await findConnection(db, a.cuenta)
  if ('text' in found) return found
  const { id, d } = found
  try {
    if (name === 'webflow_herramientas') {
      const tools = await toolsOf(db, id, d)
      if (a.herramienta) {
        const t = tools.find((x) => x.name === a.herramienta)
        if (!t) return { text: `No existe la herramienta "${a.herramienta}" en ${d.name}.`, isError: true }
        return { text: JSON.stringify(t, null, 2) }
      }
      return { text: tools.map((t) => `- ${t.name}: ${(t.description || '').split(/(?<=\.)\s|\n/)[0].slice(0, 160)}`).join('\n') }
    }
    if (name === 'webflow') {
      const r = (await rpc(db, id, 'tools/call', { name: String(a.herramienta || ''), arguments: (a.argumentos as object) || {} })) as { content?: unknown[]; isError?: boolean }
      await db.collection(CONNECTIONS).doc(id).update({ lastUsedAt: new Date().toISOString() })
      return { text: '', content: r?.content || [], isError: r?.isError === true }
    }
  } catch (e) {
    if (e instanceof Expired) return expired(d.name)
    console.error('[webflow] Error en', name, e instanceof Error ? e.message : '')
    return { text: `Error con Webflow (${d.name}): ${e instanceof Error ? e.message : 'desconocido'}`, isError: true }
  }
  return { text: `Herramienta desconocida: ${name}`, isError: true }
}
