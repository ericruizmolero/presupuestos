#!/usr/bin/env node
/**
 * CLI de trackeo de horas — escribe en el Firestore de la app de presupuestos.
 *
 * Requiere una clave de servicio de Firebase en scripts/serviceAccount.json
 * (Firebase Console → Ajustes del proyecto → Cuentas de servicio → Generar
 * nueva clave privada) o la variable GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Uso:
 *   node scripts/horas.mjs --list
 *   node scripts/horas.mjs --project vidflare --hours 2,5 --concept "Gráficos nuevos" [--date 2026-09-28] [--person "Eric"]
 *   node scripts/horas.mjs --project vidflare --entries-json '[{"date":"2026-09-28","hours":2.5,"concept":"Gráficos"},{"hours":1,"concept":"QA"}]'
 *   node scripts/horas.mjs --project vidflare --show
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PERSON = 'Eric y Andoni'

// ── Credenciales ──────────────────────────────────────────────────────────────
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(__dirname, 'serviceAccount.json')
if (!existsSync(keyPath)) {
  console.error(`✗ No hay clave de servicio en ${keyPath}\n  Descárgala en Firebase Console → Ajustes del proyecto → Cuentas de servicio → Generar nueva clave privada, y guárdala como scripts/serviceAccount.json`)
  process.exit(1)
}
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
const db = getFirestore()

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function flag(name) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
function has(name) { return args.includes(`--${name}`) }

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseHours(v) {
  const h = parseFloat(String(v).replace(',', '.'))
  if (!h || h <= 0) throw new Error(`Horas inválidas: "${v}"`)
  return h
}

// ── Proyectos ─────────────────────────────────────────────────────────────────
async function getProjects() {
  const snap = await db.collection('timeProjects').get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function findProject(needle) {
  const projects = await getProjects()
  const n = needle.toLowerCase()
  const matches = projects.filter((p) =>
    (p.name || '').toLowerCase().includes(n) ||
    (p.clientName || '').toLowerCase().includes(n) ||
    (p.slug || '').toLowerCase().includes(n)
  )
  if (matches.length === 0) {
    console.error(`✗ Ningún proyecto coincide con "${needle}". Proyectos disponibles:`)
    projects.forEach((p) => console.error(`  - ${p.name} (slug: ${p.slug})`))
    process.exit(1)
  }
  if (matches.length > 1) {
    console.error(`✗ "${needle}" es ambiguo, coincide con:`)
    matches.forEach((p) => console.error(`  - ${p.name} (slug: ${p.slug})`))
    process.exit(1)
  }
  return matches[0]
}

// ── Tablero de proyectos (post-its) ───────────────────────────────────────────
const BOARD_COLORS = ['#FDE68A', '#BFDBFE', '#BBF7D0', '#FECACA', '#E9D5FF', '#FED7AA', '#99F6E4', '#F5D0FE']
const DEFAULT_LANES = ['Ahora', 'Luego', 'En espera']

async function boardCompanyId() {
  const snap = await db.collection('timeProjects').limit(1).get()
  return snap.docs[0]?.data()?.companyId || null
}

const LEGACY_STATUS = { ahora: 'Ahora', luego: 'Luego', espera: 'En espera' }

async function readBoard(cid) {
  const snap = await db.collection('planning').doc(cid).get()
  if (!snap.exists) return { lanes: [...DEFAULT_LANES], groups: [], chips: [] }
  const data = snap.data()
  const lanes = data.lanes?.length ? data.lanes : [...DEFAULT_LANES]
  const groups = (data.groups ?? []).map((g) => {
    const status = LEGACY_STATUS[g.status ?? ''] ?? g.status
    return { ...g, status: status && lanes.includes(status) ? status : lanes[0] }
  })
  return { lanes, groups, chips: data.chips ?? [] }
}

async function writeBoard(cid, board) {
  const { FieldValue } = await import('firebase-admin/firestore')
  await db.collection('planning').doc(cid).set({ ...board, updatedAt: FieldValue.serverTimestamp() })
}

if (has('tablero') || has('nota') || has('quitar-nota') || has('mover')) {
  const cid = await boardCompanyId()
  if (!cid) { console.error('✗ No se pudo resolver la empresa'); process.exit(1) }
  const board = await readBoard(cid)

  if (has('tablero')) {
    for (const lane of board.lanes) {
      const groups = board.groups.filter((g) => (g.status ?? board.lanes[0]) === lane)
      console.log(`## ${lane}${groups.length === 0 ? ' (vacío)' : ''}`)
      for (const g of groups) {
        const chips = board.chips.filter((c) => c.group === g.name)
        console.log(`- ${g.name}${chips.length ? ':' : ' (sin notas)'}`)
        chips.forEach((c) => console.log(`    · ${c.text}`))
      }
    }
    process.exit(0)
  }

  const needle = (flag('nota') ?? flag('quitar-nota') ?? flag('mover') ?? '').toLowerCase()
  // Para estos tres, el valor del flag es el proyecto; el texto/carril va en --texto / --carril
  let group = board.groups.find((g) => g.name.toLowerCase().includes(needle))

  if (has('nota')) {
    const texto = (flag('texto') || '').trim()
    if (!texto) { console.error('✗ Falta --texto'); process.exit(1) }
    if (!group) {
      group = { name: flag('nota'), color: BOARD_COLORS[board.groups.length % BOARD_COLORS.length], status: board.lanes[0] }
      board.groups.push(group)
    }
    board.chips.push({ group: group.name, text: texto })
    await writeBoard(cid, board)
    console.log(`✓ Nota en "${group.name}": ${texto}`)
    process.exit(0)
  }

  if (!group) { console.error(`✗ Proyecto no encontrado en el tablero: ${needle}`); process.exit(1) }

  if (has('quitar-nota')) {
    const t = (flag('texto') || '').trim().toLowerCase()
    const matches = board.chips.filter((c) => c.group === group.name && c.text.toLowerCase().includes(t))
    if (matches.length !== 1) {
      console.error(matches.length === 0 ? '✗ Ninguna nota coincide' : '✗ Varias notas coinciden, sé más específico')
      process.exit(1)
    }
    board.chips = board.chips.filter((c) => c !== matches[0])
    await writeBoard(cid, board)
    console.log(`✓ Quitada de "${group.name}": ${matches[0].text}`)
    process.exit(0)
  }

  // --mover
  const laneNeedle = (flag('carril') || '').trim().toLowerCase()
  const lanes = board.lanes.filter((l) => l.toLowerCase().includes(laneNeedle))
  if (lanes.length !== 1) { console.error(`✗ Carril inválido. Carriles: ${board.lanes.join(', ')}`); process.exit(1) }
  board.groups = board.groups.map((g) => (g.name === group.name ? { ...g, status: lanes[0] } : g))
  await writeBoard(cid, board)
  console.log(`✓ "${group.name}" movido a ${lanes[0]}`)
  process.exit(0)
}

// ── Comandos ──────────────────────────────────────────────────────────────────
if (has('list')) {
  const projects = await getProjects()
  if (projects.length === 0) { console.log('No hay proyectos de horas.'); process.exit(0) }
  for (const p of projects) {
    const entries = await db.collection('timeEntries').where('projectId', '==', p.id).get()
    const total = entries.docs.reduce((s, d) => s + (d.data().hours || 0), 0)
    const rate = p.hourlyRate ? ` · ${p.hourlyRate} €/h` : ''
    console.log(`${p.name} — ${total} h${rate} · ${p.language || 'es'} · slug: ${p.slug}`)
  }
  process.exit(0)
}

const projectNeedle = flag('project')
if (!projectNeedle) {
  console.error('✗ Falta --project <nombre|slug> (o usa --list)')
  process.exit(1)
}
const project = await findProject(projectNeedle)

if (has('show')) {
  const snap = await db.collection('timeEntries').where('projectId', '==', project.id).get()
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  console.log(`${project.name} (${project.slug})`)
  let total = 0
  for (const e of entries) {
    total += e.hours || 0
    console.log(`  ${e.date}  ${String(e.hours).padStart(5)} h  ${e.person}  ${e.description || ''}`)
  }
  console.log(`  Total: ${total} h${project.hourlyRate ? ` · ${(total * project.hourlyRate).toFixed(2)} €` : ''}`)
  process.exit(0)
}

// ── Añadir entradas ───────────────────────────────────────────────────────────
let entries = []
const entriesJson = flag('entries-json')
if (entriesJson) {
  entries = JSON.parse(entriesJson)
  if (!Array.isArray(entries)) throw new Error('--entries-json debe ser un array')
} else {
  if (!flag('hours') || !flag('concept')) {
    console.error('✗ Faltan --hours y/o --concept (o usa --entries-json)')
    process.exit(1)
  }
  entries = [{ date: flag('date'), hours: flag('hours'), concept: flag('concept'), person: flag('person') }]
}

const batch = db.batch()
const clean = []
for (const e of entries) {
  const entry = {
    projectId: project.id,
    companyId: project.companyId,
    createdBy: 'claude-code-cli',
    date: e.date || todayISO(),
    hours: parseHours(e.hours),
    description: (e.concept || e.description || '').trim(),
    person: (e.person || '').trim() || DEFAULT_PERSON,
    createdAt: FieldValue.serverTimestamp(),
  }
  batch.set(db.collection('timeEntries').doc(), entry)
  clean.push(entry)
}
await batch.commit()

let total = 0
for (const e of clean) {
  total += e.hours
  console.log(`✓ ${e.date}  ${e.hours} h  ${e.person}  ${e.description}`)
}
console.log(`Añadidas ${clean.length} entrada(s) (${total} h) a "${project.name}" → https://client.treseiscero.app/h/${project.slug}`)
