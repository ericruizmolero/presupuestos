/**
 * Cron de Vercel (diario): mantiene vivas las conexiones de Webflow renovando sus tokens.
 * Vercel manda Authorization: Bearer CRON_SECRET si esa variable existe. Sin ella, la ruta solo
 * renueva lo que lleva más de 12 h sin renovarse (inofensivo). Forzar todo requiere la clave del conector.
 */
import { NextRequest, NextResponse } from 'next/server'
import { keepAlive } from '@/lib/webflow'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const cron = process.env.CRON_SECRET
  if (cron && bearer !== cron && req.headers.get('x-api-key') !== process.env.MCP_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const mcp = process.env.MCP_SECRET
  const force = req.nextUrl.searchParams.get('force') === '1' && !!mcp && req.headers.get('x-api-key') === mcp
  const results = await keepAlive(force)
  const failed = results.filter((r) => !r.ok).map((r) => r.name)
  if (failed.length) console.error('[webflow] Conexiones caducadas:', failed.join(', '))
  return NextResponse.json({ checked: results.length, failed })
}
