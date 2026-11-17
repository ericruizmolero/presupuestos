// Copia completa de Firestore a JSON (solo lectura). Uso: node scripts/backup.mjs [carpeta]
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs'; import path from 'path'
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(new URL('./serviceAccount.json', import.meta.url)))) })
const db = getFirestore()
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
const out = path.join(process.argv[2] || path.join(process.env.HOME, 'Documents/Backups presupuestos'), stamp)
fs.mkdirSync(out, { recursive: true })
async function dump(ref) {
  const snap = await ref.get(); const docs = {}
  for (const d of snap.docs) {
    const subs = await d.ref.listCollections(); const entry = { data: d.data() }
    if (subs.length) { entry.sub = {}; for (const s of subs) entry.sub[s.id] = await dump(s) }
    docs[d.id] = entry
  }
  return docs
}
let total = 0
for (const c of await db.listCollections()) {
  const docs = await dump(c); total += Object.keys(docs).length
  fs.writeFileSync(path.join(out, `${c.id}.json`), JSON.stringify(docs, null, 1))
  console.log(`${c.id}: ${Object.keys(docs).length}`)
}
console.log(`\n${total} documentos en ${out}`)
process.exit(0)
