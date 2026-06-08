import type { Metadata } from 'next'
import { QuotePageClient } from './QuotePageClient'

// ── Server-side Firestore fetch (REST API, no Admin SDK needed) ───────────────

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

interface FirestoreField {
  stringValue?: string
  mapValue?: { fields: Record<string, FirestoreField> }
}

async function fetchQuoteBySlug(slug: string): Promise<Record<string, FirestoreField> | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'quotes' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'slug' },
              op: 'EQUAL',
              value: { stringValue: slug },
            },
          },
          limit: 1,
        },
      }),
      next: { revalidate: 3600 }, // cache 1 hour
    })
    const data = await res.json()
    const doc = data?.[0]?.document
    return doc?.fields ?? null
  } catch {
    return null
  }
}

function str(field?: FirestoreField): string {
  return field?.stringValue ?? ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id: slug } = await params
  const fields = await fetchQuoteBySlug(slug)

  if (!fields) {
    return { title: 'Proposal', description: 'View this proposal.' }
  }

  const clientName  = str(fields.client?.mapValue?.fields?.company) ||
                      str(fields.client?.mapValue?.fields?.name)
  const emitterName = str(fields.emitter?.mapValue?.fields?.companyName)
  const lang        = str(fields.language) || 'es'
  const logoUrl     = str(fields.emitter?.mapValue?.fields?.logoUrl)
  const rawObjective = str(fields.project?.mapValue?.fields?.mainObjective)
  const description  = rawObjective
    ? stripHtml(rawObjective).slice(0, 160)
    : (lang === 'en' ? `Proposal from ${emitterName}` : `Presupuesto de ${emitterName}`)

  const title = clientName && emitterName
    ? (lang === 'en'
        ? `${clientName} — Proposal by ${emitterName}`
        : `${clientName} — Presupuesto de ${emitterName}`)
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
