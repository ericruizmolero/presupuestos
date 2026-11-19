'use client'

/** Fotos de perfil del equipo (users/{uid}.photoURL), compartidas por toda la app; si no hay, la de /public/team */
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { myName } from '@/components/studio/boardUtils'

type Photos = Partial<Record<'Eric' | 'Andoni', string>>
let photos: Photos = {}
let started = false
const listeners = new Set<(p: Photos) => void>()

function start() {
  if (started) return
  started = true
  onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const next: Photos = {}
      for (const d of snap.docs) {
        const u = d.data() as { displayName?: string; email?: string; photoURL?: string }
        if (u.photoURL) next[myName(u.displayName, u.email)] = u.photoURL
      }
      photos = next
      listeners.forEach((l) => l(photos))
    },
    () => { started = false }, // sin sesión no se puede leer: se queda con las fotos por defecto
  )
}

export function useTeamPhotos(): Photos {
  const [p, setP] = useState<Photos>(photos)
  useEffect(() => {
    start()
    listeners.add(setP)
    setP(photos)
    return () => { listeners.delete(setP) }
  }, [])
  return p
}
