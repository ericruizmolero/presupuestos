import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Company } from '@/types/quote'

export async function getCompany(companyId: string): Promise<Company | null> {
  const snap = await getDoc(doc(db, 'companies', companyId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Company
}

export async function upsertCompany(companyId: string, data: Partial<Omit<Company, 'id'>>) {
  const ref = doc(db, 'companies', companyId)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
  } else {
    await setDoc(ref, {
      name: '',
      logoUrl: '',
      email: '',
      address: '',
      taxId: '',
      description: '',
      defaultConditions: {
        paymentTerms: '',
        acceptanceCriteria: '',
        clientResponsibilities: '',
        penaltyClause: '',
        dataProtection: '',
      },
      fonts: [],
      defaultFontName: '',
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}

export async function getUserCompanyId(userId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', userId))
  if (!snap.exists()) return null
  return snap.data().companyId ?? null
}

export async function setUserCompanyId(userId: string, companyId: string) {
  await updateDoc(doc(db, 'users', userId), { companyId })
}
