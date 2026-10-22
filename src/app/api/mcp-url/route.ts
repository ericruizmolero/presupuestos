/** Devuelve la URL del conector MCP (con su clave) solo a Eric y Andoni. */
import { NextRequest, NextResponse } from 'next/server'
import { verifyStudioUser } from '@/lib/serverAuth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.MCP_SECRET
  if (!secret) return NextResponse.json({ error: 'Conector no configurado' }, { status: 503 })
  if (!(await verifyStudioUser(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ url: `https://client.treseiscero.app/api/mcp?key=${secret}` })
}
