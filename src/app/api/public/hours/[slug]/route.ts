import { NextResponse } from 'next/server'
import { adminDb, plain } from '@/lib/adminDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Registro de horas público (/h/<slug>): el proyecto y sus entradas, sin abrir las colecciones al público */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const db = adminDb()
    const ps = await db.collection('timeProjects').where('slug', '==', slug).limit(1).get()
    if (ps.empty) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const pd = ps.docs[0]
    const es = await db.collection('timeEntries').where('projectId', '==', pd.id).get()
    const entries = es.docs
      .map((d) => ({ id: d.id, ...(plain(d.data()) as Record<string, unknown>) }) as { id: string; date?: string })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    return NextResponse.json(
      { project: { id: pd.id, ...(plain(pd.data()) as Record<string, unknown>) }, entries },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[api/public/hours]', e)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
