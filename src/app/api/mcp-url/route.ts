/**
 * Devuelve la URL completa del conector MCP (con MCP_SECRET) a usuarios
 * autenticados de la app. El cliente manda su ID token de Firebase y se
 * valida contra la API REST de Firebase (accounts:lookup) antes de soltar
 * el secreto. (No usamos firebase-admin/auth: su cadena jwks-rsa/jose no
 * carga en el runtime de Vercel.)
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.MCP_SECRET
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!secret || !apiKey) {
    return NextResponse.json({ error: 'Conector no configurado' }, { status: 503 })
  }
  const idToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!idToken) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      }
    )
    const data = await res.json()
    if (!res.ok || !data?.users?.length) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar la sesión' }, { status: 401 })
  }
  return NextResponse.json({
    url: `https://client.treseiscero.app/api/mcp?key=${secret}`,
  })
}
