/** Renombrar, activar o desactivar para Claude, y eliminar una conexión de Webflow */
import { NextRequest, NextResponse } from 'next/server'
import { verifyStudioUser } from '@/lib/serverAuth'
import { adminDb } from '@/lib/adminDb'
import { removeConnection, slugName } from '@/lib/webflow'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyStudioUser(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { name?: string; active?: boolean }
  const col = adminDb().collection('webflowConnections')
  const ref = col.doc(id)
  if (!(await ref.get()).exists) return NextResponse.json({ error: 'No existe' }, { status: 404 })
  const patch: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') patch.active = body.active
  if (body.name !== undefined) {
    const name = slugName(body.name)
    if (!name) return NextResponse.json({ error: 'Ponle un nombre' }, { status: 400 })
    const all = await col.get()
    if (all.docs.some((x) => x.id !== id && slugName(x.data().name) === name)) return NextResponse.json({ error: `Ya hay una conexión llamada ${name}` }, { status: 409 })
    patch.name = name
  }
  if (Object.keys(patch).length) await ref.update(patch)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyStudioUser(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  await removeConnection(id)
  return NextResponse.json({ ok: true })
}
