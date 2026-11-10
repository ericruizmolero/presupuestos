import type { Metadata } from 'next'
import { QuestionnaireClient } from './QuestionnaireClient'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

interface Field { stringValue?: string; arrayValue?: { values?: unknown[] } }

/** Lectura pública del cuestionario (get por id = slug; las reglas lo permiten) para la vista previa al compartir */
async function fetchQuestionnaire(slug: string): Promise<Record<string, Field> | null> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/questionnaires/${encodeURIComponent(slug)}?key=${API_KEY}`,
      { next: { revalidate: 300 } },
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.fields ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const f = await fetchQuestionnaire(slug)
  if (!f) return { title: 'Savvia', robots: { index: false, follow: false } }

  const company = f.clientCompany?.stringValue || ''
  const en = f.language?.stringValue === 'en'
  const n = f.questions?.arrayValue?.values?.length || 0
  const title = company ? `${company}, Savvia` : 'Savvia'
  const description = en
    ? `${f.title?.stringValue || 'Questionnaire'}: ${n} questions, about 10 minutes.`
    : `${f.title?.stringValue || 'Cuestionario'}: ${n} preguntas, unos 10 minutos.`

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'Savvia' },
    twitter: { card: 'summary', title, description },
  }
}

export default function Page() {
  return <QuestionnaireClient />
}
