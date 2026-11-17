import { NextRequest, NextResponse } from 'next/server'
import { quoteBySlug } from '@/lib/adminDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Presupuesto público por slug. El código de acceso nunca sale del servidor:
 * si el presupuesto lo tiene y no llega el correcto (cabecera x-access-code), solo se devuelve lo que pinta la pantalla de acceso.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const q = await quoteBySlug(slug)
    if (!q) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const { accessPassword, ...rest } = q as Record<string, unknown> & { accessPassword?: string }
    if (accessPassword && req.headers.get('x-access-code') !== accessPassword) {
      const emitter = (q.emitter ?? {}) as Record<string, unknown>
      const client = (q.client ?? {}) as Record<string, unknown>
      return NextResponse.json({
        locked: true,
        wrongCode: req.headers.has('x-access-code'),
        quote: {
          id: q.id, slug: q.slug, language: q.language, companyId: q.companyId, fontName: q.fontName,
          emitter: { logoUrl: emitter.logoUrl, companyName: emitter.companyName },
          client: { company: client.company, name: client.name },
        },
      }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ locked: false, quote: rest }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[api/public/quote]', e)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
