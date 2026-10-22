'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { isAllowedEmail } from '@/lib/access'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const allowed = isAllowedEmail(user?.email)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    // Cualquier cuenta que no sea del estudio se desconecta al momento
    if (!allowed) signOut().finally(() => router.replace('/login?denied=1'))
  }, [user, loading, allowed, router])

  if (loading || (user && !allowed)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
