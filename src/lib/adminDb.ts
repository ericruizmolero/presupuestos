/** Firestore con permisos de servidor (firebase-admin) para las páginas públicas: así las reglas pueden cerrar las colecciones. */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'

export function adminDb(): Firestore {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada')
    initializeApp({ credential: cert(JSON.parse(raw)) })
  }
  return getFirestore()
}

/** Timestamps a ISO (como devolvía la API REST), para mandarlo como JSON */
export function plain(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(plain)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) out[k] = plain(x)
    return out
  }
  return v
}

export async function quoteBySlug(slug: string): Promise<Record<string, unknown> | null> {
  const snap = await adminDb().collection('quotes').where('slug', '==', slug).limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(plain(d.data()) as Record<string, unknown>) }
}
