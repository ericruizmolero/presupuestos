'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doc, setDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Faces } from '@/components/studio/StudioMarks'
import { myName } from '@/components/studio/boardUtils'
import { useTeamPhotos } from '@/lib/teamPhotos'
import { uploadAvatar } from '@/lib/storage'
import { signOut } from '@/lib/auth'
import { Check, LogOut } from 'lucide-react'

const LABEL = 'text-[10px] font-medium tracking-[0.16em] uppercase text-ink-40 mb-2 block'
const INPUT = 'w-full px-3 py-2 border border-input rounded-md text-sm text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'

export default function CuentaPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <Cuenta />
      </DashboardLayout>
    </AuthGuard>
  )
}

function Cuenta() {
  const { user } = useAuth()
  const router = useRouter()
  const me = myName(user?.displayName, user?.email)
  const photos = useTeamPhotos()
  const [name, setName] = useState(user?.displayName || '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { setName(user?.displayName || '') }, [user?.displayName])

  async function save(data: { displayName?: string; photoURL?: string | null }) {
    if (!user) return
    setStatus('saving')
    try {
      await setDoc(doc(db, 'users', user.uid), data, { merge: true })
      if (auth.currentUser) await updateProfile(auth.currentUser, data)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (e) {
      console.error('[cuenta]', e)
      setStatus('error')
    }
  }

  async function pickPhoto(f?: File) {
    if (!f || !user) return
    setStatus('saving')
    try {
      const url = await uploadAvatar(user.uid, f)
      await save({ photoURL: url })
    } catch (e) {
      console.error('[cuenta] foto', e)
      setStatus('error')
    }
  }

  const google = user?.providerData.some((p) => p.providerId === 'google.com')

  return (
    <div className="px-8 py-12 max-w-xl">
      <div className="flex items-center gap-3 mb-10">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Tu cuenta</h1>
        <span className="h-4 flex items-center">
          {status === 'saving' && <span className="w-2.5 h-2.5 inline-block border border-ink-40 border-t-transparent rounded-full animate-spin" />}
          {status === 'saved' && <span className="flex items-center gap-1 text-[10px] text-ink-40"><Check size={10} strokeWidth={2.5} />Guardado</span>}
          {status === 'error' && <span className="text-[10px] text-[#DC2626]">No se ha podido guardar</span>}
        </span>
      </div>

      <section className="mb-8">
        <span className={LABEL}>Foto</span>
        <div className="flex items-center gap-4">
          <Faces who={me} size={64} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => file.current?.click()}
              className="px-3.5 py-2 text-sm border border-line rounded-md text-ink hover:border-input transition-colors"
            >
              Cambiar foto
            </button>
            {photos[me] && (
              <button onClick={() => save({ photoURL: null })} className="px-3 py-2 text-sm text-ink-40 hover:text-ink">
                Volver a la de siempre
              </button>
            )}
          </div>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <p className="mt-2 text-xs text-ink-40">Se ve en el tablero, en las dudas de Prospección y en el menú.</p>
      </section>

      <section className="mb-8">
        <label>
          <span className={LABEL}>Nombre</span>
          <input
            className={INPUT}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { const n = name.trim(); if (n && n !== user?.displayName) save({ displayName: n }) }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
      </section>

      <section className="mb-10">
        <span className={LABEL}>Email</span>
        <p className="text-sm text-ink">{user?.email}</p>
        <p className="mt-1 text-xs text-ink-40">{google ? 'Entras con Google.' : 'Entras con email y contraseña.'}</p>
      </section>

      <button
        onClick={async () => { await signOut(); router.replace('/login') }}
        className="flex items-center gap-2 px-3.5 py-2 text-sm border border-line rounded-md text-ink-60 hover:text-ink hover:border-input transition-colors"
      >
        <LogOut size={14} strokeWidth={1.5} />
        Cerrar sesión
      </button>
    </div>
  )
}
