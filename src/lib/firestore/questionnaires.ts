import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { stripUndefinedDeep } from './quotes'

/**
 * Cuestionarios que compartimos con el cliente por enlace (/cuestionario/<slug>), como los presupuestos.
 * El id del documento ES el slug: la página pública lo lee con get (las reglas no permiten listar).
 * El cliente solo puede escribir en `answers`, `status`, `submittedAt` y `answeredAt` (ver firestore.rules).
 */
import { questionnaireSlug, type Questionnaire } from '../questionnaireModel'
export * from '../questionnaireModel'

export async function getQuestionnaires(companyId: string): Promise<Questionnaire[]> {
  const snap = await getDocs(query(collection(db, 'questionnaires'), where('companyId', '==', companyId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Questionnaire))
}

export async function getQuestionnaireBySlug(slug: string): Promise<Questionnaire | null> {
  return getQuestionnaire(slug)
}

export async function getQuestionnaire(id: string): Promise<Questionnaire | null> {
  const snap = await getDoc(doc(db, 'questionnaires', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Questionnaire) : null
}

export function subscribeQuestionnaire(id: string, onChange: (q: Questionnaire | null, local: boolean) => void): () => void {
  return onSnapshot(doc(db, 'questionnaires', id), (snap) => {
    onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as Questionnaire) : null, snap.metadata.hasPendingWrites)
  })
}

export async function createQuestionnaire(data: Omit<Questionnaire, 'id' | 'slug' | 'status'>): Promise<string> {
  const slug = questionnaireSlug(data.clientCompany || data.title)
  await setDoc(doc(db, 'questionnaires', slug), {
    ...(stripUndefinedDeep(data) as Record<string, unknown>),
    slug,
    status: 'pendiente',
    answers: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return slug
}

/** Cambios del estudio (título, intro, preguntas…) */
export async function updateQuestionnaire(id: string, patch: Partial<Omit<Questionnaire, 'id'>>) {
  await updateDoc(doc(db, 'questionnaires', id), { ...(stripUndefinedDeep(patch) as Record<string, unknown>), updatedAt: serverTimestamp() })
}

export async function deleteQuestionnaire(id: string) {
  await deleteDoc(doc(db, 'questionnaires', id))
}

/** Lo que escribe el cliente desde el enlace público (las reglas solo le dejan tocar estos campos) */
export async function saveAnswers(id: string, answers: Record<string, string>, submit = false) {
  const now = new Date().toISOString()
  await updateDoc(doc(db, 'questionnaires', id), {
    answers,
    answeredAt: now,
    ...(submit ? { status: 'respondido', submittedAt: now } : {}),
  })
}
