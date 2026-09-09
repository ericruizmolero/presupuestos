import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { stripUndefinedDeep } from './quotes'
import type { TimeProject, TimeEntry, TimeProjectFormData, TimeEntryFormData } from '@/types/time'
import { nanoid } from 'nanoid'

// ── Projects ──────────────────────────────────────────────────────────────────

function toSlugBase(name: string): string {
  return (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

async function generateUniqueProjectSlug(name: string): Promise<string> {
  const base = toSlugBase(name) || nanoid(8)
  let candidate = base
  let counter = 2
  while (true) {
    const snap = await getDocs(query(collection(db, 'timeProjects'), where('slug', '==', candidate)))
    if (snap.empty) return candidate
    candidate = `${base}-${counter++}`
  }
}

export async function getTimeProjects(companyId: string): Promise<TimeProject[]> {
  const snap = await getDocs(query(collection(db, 'timeProjects'), where('companyId', '==', companyId)))
  const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeProject))
  return projects.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export async function getTimeProjectById(id: string): Promise<TimeProject | null> {
  const snap = await getDoc(doc(db, 'timeProjects', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as TimeProject
}

export async function getTimeProjectBySlug(slug: string): Promise<TimeProject | null> {
  const snap = await getDocs(query(collection(db, 'timeProjects'), where('slug', '==', slug)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as TimeProject
}

export async function createTimeProject(
  data: Omit<TimeProjectFormData, 'slug'>,
  userId: string,
  companyId: string
): Promise<TimeProject> {
  const slug = await generateUniqueProjectSlug(data.name || data.clientName)
  const payload = {
    ...(stripUndefinedDeep(data) as Record<string, unknown>),
    slug,
    createdBy: userId,
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'timeProjects'), payload)
  return { id: ref.id, ...data, slug, createdBy: userId, companyId }
}

export async function updateTimeProject(id: string, data: Partial<TimeProjectFormData>) {
  await updateDoc(doc(db, 'timeProjects', id), {
    ...(stripUndefinedDeep(data) as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTimeProject(id: string) {
  // Delete the project's entries first so no orphans remain
  const snap = await getDocs(query(collection(db, 'timeEntries'), where('projectId', '==', id)))
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'timeProjects', id))
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function getTimeEntries(projectId: string): Promise<TimeEntry[]> {
  const snap = await getDocs(query(collection(db, 'timeEntries'), where('projectId', '==', projectId)))
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry))
  // Newest first; entries on the same day keep insertion order
  return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

export async function getTimeEntriesByCompany(companyId: string): Promise<TimeEntry[]> {
  const snap = await getDocs(query(collection(db, 'timeEntries'), where('companyId', '==', companyId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry))
}

export async function addTimeEntry(
  data: TimeEntryFormData,
  userId: string,
  companyId: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'timeEntries'), {
    ...(stripUndefinedDeep(data) as Record<string, unknown>),
    createdBy: userId,
    companyId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTimeEntry(id: string, data: Partial<TimeEntryFormData>) {
  await updateDoc(doc(db, 'timeEntries', id), stripUndefinedDeep(data) as Record<string, unknown>)
}

export async function deleteTimeEntry(id: string) {
  await deleteDoc(doc(db, 'timeEntries', id))
}
