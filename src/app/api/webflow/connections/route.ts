/** Lista de conexiones de Webflow, sin tokens */
import { NextRequest, NextResponse } from 'next/server'
import { verifyStudioUser } from '@/lib/serverAuth'
import { listConnections } from '@/lib/webflow'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!(await verifyStudioUser(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ connections: await listConnections() })
}
