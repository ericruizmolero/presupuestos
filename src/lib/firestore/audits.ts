import { collection, doc, getDoc, getDocs, deleteDoc, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { Audit } from '../auditModel'
export * from '../auditModel'

/**
 * Auditorías: el id del documento ES el slug (la página pública lo lee con get; las reglas no permiten listar).
 * Las escribe Claude por el conector MCP; aquí solo se leen y se borran.
 */
export async function getAudits(companyId: string): Promise<Audit[]> {
  const snap = await getDocs(query(collection(db, 'audits'), where('companyId', '==', companyId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Audit))
}

export async function getAudit(id: string): Promise<Audit | null> {
  const snap = await getDoc(doc(db, 'audits', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Audit) : null
}

export function subscribeAudit(id: string, onChange: (a: Audit | null) => void): () => void {
  return onSnapshot(doc(db, 'audits', id), (snap) => onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as Audit) : null))
}

export async function deleteAudit(id: string) {
  await deleteDoc(doc(db, 'audits', id))
}
