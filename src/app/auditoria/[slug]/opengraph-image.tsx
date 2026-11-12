import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'
export const alt = 'Auditoría web de Savvia'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

type V = { stringValue?: string; mapValue?: { fields?: Record<string, V> }; arrayValue?: { values?: V[] } }

/** Imagen al compartir el enlace: marca Savvia, empresa y la captura de su web */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let f: Record<string, V> = {}
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/audits/${encodeURIComponent(slug)}?key=${API_KEY}`, { next: { revalidate: 300 } })
    if (res.ok) f = (await res.json())?.fields ?? {}
  } catch {}

  const company = f.clientCompany?.stringValue || ''
  const title = f.title?.stringValue || 'Auditoría web'
  const en = f.language?.stringValue === 'en'
  const site = (f.siteUrl?.stringValue || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  // Primera captura que satori sabe pintar (jpg/png), normalmente el hero de su web
  const shot = (f.findings?.arrayValue?.values || [])
    .map((v) => v.mapValue?.fields?.image?.stringValue || '')
    .find((u) => /\.(jpe?g|png)\?/i.test(u))

  const logo = `data:image/svg+xml;base64,${(await readFile(join(process.cwd(), 'public/brand/savvia-logo-cacao.svg'))).toString('base64')}`

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F5F5F7', color: '#302018', fontFamily: 'sans-serif' }}>
        <div style={{ width: shot ? 560 : 1200, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 0 64px 72px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" height={34} width={114} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 20, letterSpacing: 4, textTransform: 'uppercase', color: '#8A7F7A' }}>{en ? 'Website audit' : 'Auditoría web'}</div>
            <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2, lineHeight: 1.02, marginTop: 18 }}>{company || 'Savvia'}</div>
            <div style={{ fontSize: 30, lineHeight: 1.3, marginTop: 22, color: '#5C524D', paddingRight: 40 }}>{title}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#8A7F7A' }}>{site || 'savvia.studio'}</div>
        </div>
        {shot && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingRight: 0 }}>
            <div style={{ display: 'flex', width: 700, height: 470, borderRadius: 18, overflow: 'hidden', border: '1px solid #E2DEDC', boxShadow: '0 30px 60px rgba(48,32,24,0.14)', background: '#fff' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot} alt="" width={700} height={403} style={{ objectFit: 'cover', objectPosition: 'top', width: 700, height: 470 }} />
            </div>
          </div>
        )}
      </div>
    ),
    size,
  )
}
