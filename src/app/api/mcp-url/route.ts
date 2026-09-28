/**
 * Devuelve la URL completa del conector MCP (con MCP_SECRET) a usuarios
 * autenticados de la app. El cliente manda su ID token de Firebase y se
 * verifica con Admin antes de soltar el secreto.
 */
import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

export const runtime = 'nodejs'

function ensureAdmin() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada')
    initializeApp({ credential: cert(JSON.parse(raw)) })
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.MCP_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Conector no configurado' }, { status: 503 })
  }
  const idToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!idToken) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  try {
    ensureAdmin()
    await getAuth().verifyIdToken(idToken)
  } catch {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
  }
  return NextResponse.json({
    url: `https://client.treseiscero.app/api/mcp?key=${secret}`,
  })
}
