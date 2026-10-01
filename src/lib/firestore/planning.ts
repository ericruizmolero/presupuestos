import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { stripUndefinedDeep } from './quotes'
import type { TimelineEntry } from '@/types/quote'

/** Planning interno de la empresa: una lista de tareas/fases con fechas,
 *  guardada como un único documento (igual que el timeline de un presupuesto). */
export async function getPlanning(companyId: string): Promise<TimelineEntry[]> {
  const snap = await getDoc(doc(db, 'planning', companyId))
  if (!snap.exists()) return []
  return (snap.data().entries as TimelineEntry[]) ?? []
}

export async function savePlanning(companyId: string, entries: TimelineEntry[]) {
  await setDoc(doc(db, 'planning', companyId), {
    entries: stripUndefinedDeep(entries),
    updatedAt: serverTimestamp(),
  })
}
