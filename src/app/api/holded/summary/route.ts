/** Resumen de facturación anual desde Holded. Solo para Eric y Andoni. */
import { NextRequest, NextResponse } from 'next/server'
import { billingSummary, holdedConfigured } from '@/lib/holded'
import { verifyStudioUser } from '@/lib/serverAuth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!(await verifyStudioUser(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!holdedConfigured()) return NextResponse.json({ error: 'Holded no configurado' }, { status: 503 })
  const year = Number(req.nextUrl.searchParams.get('year')) || new Date().getFullYear()
  try {
    return NextResponse.json(await billingSummary(year))
  } catch (err) {
    console.error('[holded] Error:', err)
    return NextResponse.json({ error: 'Error de Holded' }, { status: 502 })
  }
}
