'use client'

import { isAllowedEmail, STUDIO_COMPANY_ID } from './access'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

const googleProvider = new GoogleAuthProvider()

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await ensureUserDoc(credential.user, displayName)
  return credential
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider)
  // Solo las cuentas del estudio tienen documento de usuario; el resto se rechaza en el login
  if (isAllowedEmail(credential.user.email)) {
    await ensureUserDoc(credential.user, credential.user.displayName ?? '')
  }
  return credential
}

export async function signOut() {
  return firebaseSignOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

async function ensureUserDoc(user: User, displayName: string) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  const team = isAllowedEmail(user.email)
  if (!snap.exists()) {
    // Cuentas nuevas del equipo (p. ej. al pasar de @treseiscero.app a @savvia.studio) → empresa del estudio
    await setDoc(ref, {
      email: user.email,
      displayName,
      companyId: team ? STUDIO_COMPANY_ID : null,
      createdAt: serverTimestamp(),
    })
  } else if (team && !snap.data().companyId) {
    await setDoc(ref, { companyId: STUDIO_COMPANY_ID }, { merge: true })
  }
}
