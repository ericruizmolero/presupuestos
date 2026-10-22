/**
 * Verifica el ID token de Firebase de una petición (vía REST, sin firebase-admin/auth,
 * que no carga en Vercel) y que el usuario sea del estudio. Devuelve su email o null.
 */
import type { NextRequest } from 'next/server'
import { isAllowedEmail } from './access'

export async function verifyStudioUser(req: NextRequest): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const idToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!apiKey || !idToken) return null
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { users?: Array<{ email?: string }> }
    const email = data.users?.[0]?.email
    return isAllowedEmail(email) ? email! : null
  } catch {
    return null
  }
}
