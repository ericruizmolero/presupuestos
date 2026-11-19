/** Empieza (o repite) la conexión de un espacio de Webflow: devuelve la URL de autorización */
import { NextRequest, NextResponse } from 'next/server'
import { verifyStudioUser } from '@/lib/serverAuth'
import { adminDb } from '@/lib/adminDb'
import { slugName, startConnect } from '@/lib/webflow'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const email = await verifyStudioUser(req)
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { name?: string; connectionId?: string }
  try {
    let name = slugName(body.name || '')
    if (body.connectionId) {
      const d = (await adminDb().collection('webflowConnections').doc(body.connectionId).get()).data()
      if (!d) return NextResponse.json({ error: 'Esa conexión no existe' }, { status: 404 })
      name = d.name
    } else {
      if (!name) return NextResponse.json({ error: 'Ponle un nombre corto' }, { status: 400 })
      const all = await adminDb().collection('webflowConnections').get()
      if (all.docs.some((x) => slugName(x.data().name) === name)) return NextResponse.json({ error: `Ya hay una conexión llamada ${name}` }, { status: 409 })
    }
    const url = await startConnect(email, name, body.connectionId)
    return NextResponse.json({ url })
  } catch (e) {
    console.error('[webflow] connect:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
