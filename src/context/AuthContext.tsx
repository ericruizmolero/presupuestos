'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type User } from 'firebase/auth'
import { onAuthChange } from '@/lib/auth'
import { getCompany, getUserCompanyId } from '@/lib/firestore/companies'
import { injectFont, applySystemFont } from '@/lib/fonts'
import { applyPalette, applyThemeColors, applyInkOpacities } from '@/lib/theme'
import type { Company } from '@/types/quote'

interface AuthContextValue {
  user: User | null
  company: Company | null
  loading: boolean
  refreshCompany: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  company: null,
  loading: true,
  refreshCompany: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadCompany(uid: string) {
    try {
      const companyId = await getUserCompanyId(uid)
      if (!companyId) return
      const c = await getCompany(companyId)
      setCompany(c)
      if (c) {
        if (c.themeColors) applyThemeColors(c.themeColors)
        else if (c.paletteId) applyPalette(c.paletteId)
        if (c.inkOpacitySecondary != null || c.inkOpacityTertiary != null) {
          applyInkOpacities(c.inkOpacitySecondary ?? 60, c.inkOpacityTertiary ?? 40)
        }
        if (c.defaultFontName) {
          const uploadedFont = c.fonts.find((f) => f.name === c.defaultFontName)
          if (uploadedFont) injectFont(uploadedFont)
          else applySystemFont(c.defaultFontName)
        }
      }
    } catch (err) {
      // Firestore may be temporarily unreachable (offline, slow network).
      // Don't crash — the app continues with company = null.
      console.warn('[AuthContext] loadCompany failed:', err)
    }
  }

  async function refreshCompany() {
    if (user) await loadCompany(user.uid)
  }

  useEffect(() => {
    return onAuthChange(async (u) => {
      setUser(u)
      if (u) {
        await loadCompany(u.uid)
      } else {
        setCompany(null)
      }
      setLoading(false)  // always unblock, even if loadCompany failed
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, company, loading, refreshCompany }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
