import type { Metadata } from 'next'
import { QuotePageClient } from './QuotePageClient'

import { quoteBySlug } from '@/lib/adminDb'

export const runtime = 'nodejs'

type Q = { client?: { company?: string; name?: string }; emitter?: { companyName?: string; logoUrl?: string }; language?: string; project?: { mainObjective?: string }; accessPassword?: string }

async function fetchQuote(slug: string): Promise<Q | null> {
  try { return (await quoteBySlug(slug)) as Q | null } catch { return null }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id: slug } = await params
  const q = await fetchQuote(slug)

  if (!q) {
    return { title: 'Proposal', description: 'View this proposal.' }
  }

  const clientName  = q.client?.company || q.client?.name || ''
  const emitterName = q.emitter?.companyName || ''
  const lang        = q.language || 'es'
  const logoUrl     = q.emitter?.logoUrl || ''
  // con código de acceso, el resumen del proyecto no sale en la vista previa del enlace
  const rawObjective = q.accessPassword ? '' : (q.project?.mainObjective || '')
  const description  = rawObjective
    ? stripHtml(rawObjective).slice(0, 160)
    : (lang === 'en' ? `Proposal from ${emitterName}` : `Presupuesto de ${emitterName}`)

  const title = clientName && emitterName
    ? (lang === 'en'
        ? `${clientName}, proposal by Savvia`
        : `${clientName}, presupuesto de Savvia`)
    : (emitterName || 'Proposal')

  const images = logoUrl ? [{ url: logoUrl }] : []

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: images.map(i => i.url),
    },
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClientQuotePage() {
  return <QuotePageClient />
}
