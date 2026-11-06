import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { stripUndefinedDeep } from './quotes'

/** Prospección en frío: webs que rediseñamos a ciegas para tocarles la puerta. El orden del array es el orden manual. */
export type ProspectStage = 'detectado' | 'rediseno' | 'enviado' | 'conversacion' | 'ganado' | 'descartado'

export const STAGES: Array<{ id: ProspectStage; label: string; hint: string }> = [
  { id: 'detectado', label: 'Detectado', hint: 'Candidato a rediseño' },
  { id: 'rediseno', label: 'Rediseñando', hint: 'Haciendo la home' },
  { id: 'enviado', label: 'Enviado', hint: 'Les hemos tocado la puerta' },
  { id: 'conversacion', label: 'En conversación', hint: 'Han respondido' },
  { id: 'ganado', label: 'Ganado', hint: 'Cliente' },
  { id: 'descartado', label: 'Descartado', hint: 'No sigue' },
]

export type ProspectPriority = 'alta' | 'media' | 'baja'

export const PRIORITIES: Array<{ id: ProspectPriority; label: string; cls: string }> = [
  { id: 'alta', label: 'Alta', cls: 'bg-[#FEE2E2] text-[#B91C1C]' },
  { id: 'media', label: 'Media', cls: 'bg-[#FEF3C7] text-[#92400E]' },
  { id: 'baja', label: 'Baja', cls: 'bg-surface text-ink-60 border border-line' },
]

export interface Prospect {
  id: string
  name: string
  url?: string
  contact?: string      // persona y cargo
  reasons: string[]     // por qué es buen objetivo
  links?: string[]      // noticias, perfiles…
  stage: ProspectStage
  priority?: ProspectPriority // por defecto media
  response?: string     // qué respondieron (aparte del porqué)
  notes?: string
  date: string          // YYYY-MM-DD de alta
  by?: string
  stageDate?: string
}

export async function getProspects(companyId: string): Promise<Prospect[]> {
  const snap = await getDoc(doc(db, 'prospects', companyId))
  return snap.exists() ? ((snap.data().items as Prospect[]) ?? []) : []
}

export async function saveProspects(companyId: string, items: Prospect[]) {
  await setDoc(doc(db, 'prospects', companyId), {
    items: stripUndefinedDeep(items),
    updatedAt: serverTimestamp(),
  })
}

/** Escucha la prospección en directo; local = el cambio viene de este navegador aún sin confirmar */
export function subscribeProspects(companyId: string, onChange: (items: Prospect[], local: boolean) => void): () => void {
  return onSnapshot(doc(db, 'prospects', companyId), (snap) => {
    onChange(snap.exists() ? ((snap.data().items as Prospect[]) ?? []) : [], snap.metadata.hasPendingWrites)
  })
}
