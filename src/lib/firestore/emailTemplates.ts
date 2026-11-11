import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { DEFAULT_TEMPLATES, type EmailTemplate } from '../emailTemplateModel'

export * from '../emailTemplateModel'

/** Plantillas en directo (las cambia también el conector MCP). Sin documento todavía: las de serie. */
export function subscribeEmailTemplates(companyId: string, onChange: (items: EmailTemplate[]) => void): () => void {
  return onSnapshot(doc(db, 'emailTemplates', companyId), (snap) => {
    onChange(snap.exists() ? ((snap.data().items as EmailTemplate[]) ?? []) : DEFAULT_TEMPLATES)
  })
}

export async function saveEmailTemplates(companyId: string, items: EmailTemplate[]) {
  await setDoc(doc(db, 'emailTemplates', companyId), { items: JSON.parse(JSON.stringify(items)), updatedAt: serverTimestamp() })
}
