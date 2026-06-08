import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Quote, QuoteFormData, QuoteStatus } from '@/types/quote'
import { nanoid } from 'nanoid'

/** Returns the next sequential quote number for a company: "2026-001", "2026-002", … */
export async function getNextQuoteNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear()
  const snap = await getDocs(
    query(collection(db, 'quotes'), where('companyId', '==', companyId))
  )
  // Extract any trailing integer from existing quoteNumbers to find the max
  const nums = snap.docs
    .map(d => d.data().quoteNumber as string | undefined)
    .filter(Boolean)
    .map(n => { const m = (n as string).match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0 })
    .filter(n => n > 0)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${year}-${String(next).padStart(3, '0')}`
}

function toSlugBase(clientName: string): string {
  return (clientName || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/** Returns a unique slug: "ai-for-equity", "ai-for-equity-2", etc.
 *  excludeId: skip this document ID when checking for collisions (used on regenerate). */
async function generateUniqueSlug(clientName: string, excludeId?: string): Promise<string> {
  const base = toSlugBase(clientName) || nanoid(8)
  let candidate = base
  let counter = 2
  while (true) {
    const snap = await getDocs(query(collection(db, 'quotes'), where('slug', '==', candidate)))
    if (snap.empty) return candidate
    // Only collision if it's a DIFFERENT document — ignore the current one
    const blockedByOther = snap.docs.some(d => d.id !== excludeId)
    if (!blockedByOther) return candidate
    candidate = `${base}-${counter++}`
  }
}

export async function getQuotes(companyId: string): Promise<Quote[]> {
  const q = query(
    collection(db, 'quotes'),
    where('companyId', '==', companyId)
  )
  const snap = await getDocs(q)
  const quotes = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quote))
  return quotes.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return tb - ta
  })
}

export async function getQuoteById(id: string): Promise<Quote | null> {
  const snap = await getDoc(doc(db, 'quotes', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Quote
}

export async function getQuoteBySlug(slug: string): Promise<Quote | null> {
  const q = query(collection(db, 'quotes'), where('slug', '==', slug))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Quote
}

export async function createQuote(
  formData: QuoteFormData,
  userId: string,
  companyId: string
): Promise<string> {
  const slug = await generateUniqueSlug(formData.client.company || formData.client.name)
  const ref = await addDoc(collection(db, 'quotes'), {
    ...formData,
    slug,
    createdBy: userId,
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateQuote(id: string, data: Partial<QuoteFormData>) {
  await updateDoc(doc(db, 'quotes', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

/** Regenerate a clean slug from the client name and save it. Returns the new slug. */
export async function regenerateQuoteSlug(id: string, clientName: string): Promise<string> {
  const slug = await generateUniqueSlug(clientName, id) // exclude self from collision check
  await updateDoc(doc(db, 'quotes', id), { slug, updatedAt: serverTimestamp() })
  return slug
}

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  await updateDoc(doc(db, 'quotes', id), { status, updatedAt: serverTimestamp() })
}

export async function deleteQuote(id: string) {
  await deleteDoc(doc(db, 'quotes', id))
}

export async function duplicateQuote(id: string, userId: string, companyId: string): Promise<string> {
  const original = await getQuoteById(id)
  if (!original) throw new Error('Quote not found')
  const { id: _id, createdAt: _ca, updatedAt: _ua, slug: _slug, ...data } = original
  const newNumber = `${original.quoteNumber}-copia`
  const newSlug = await generateUniqueSlug(original.client.company || original.client.name)
  const ref = await addDoc(collection(db, 'quotes'), {
    ...data,
    quoteNumber: newNumber,
    slug: newSlug,
    status: 'borrador',
    createdBy: userId,
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}
