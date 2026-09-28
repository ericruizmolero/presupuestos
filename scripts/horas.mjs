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
