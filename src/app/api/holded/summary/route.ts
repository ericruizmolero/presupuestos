/**
 * Resumen de facturación anual desde Holded, solo para usuarios autenticados
 * de la app (ID token de Firebase verificado vía REST, como /api/mcp-url).
 */
import { NextRequest, NextResponse } from 'next/server'
import { billingSummary, holdedConfigured } from '@/lib/holded'

export const runtime = 'nodejs'

async function verify(req: NextRequest): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const idToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!apiKey || !idToken) return false
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    })
    const data = await res.json()
    return res.ok && !!data?.users?.length
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  if (!(await verify(req))) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!holdedConfigured()) return NextResponse.json({ error: 'Holded no configurado' }, { status: 503 })
  const year = Number(req.nextUrl.searchParams.get('year')) || new Date().getFullYear()
  try {
    return NextResponse.json(await billingSummary(year))
  } catch (err) {
    console.error('[holded] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error de Holded' }, { status: 502 })
  }
}
