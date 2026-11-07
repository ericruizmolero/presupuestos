'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'


// ── Firestore REST fetch (bypasses SDK auth requirement for public pages) ──────

type FSValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FSValue> } }
  | { arrayValue: { values?: FSValue[] } }

function fromFS(v: FSValue): unknown {
  if (!v) return null
  if ('stringValue'    in v) return v.stringValue
  if ('booleanValue'   in v) return v.booleanValue
  if ('integerValue'   in v) return Number(v.integerValue)
  if ('doubleValue'    in v) return v.doubleValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue'      in v) return null
  if ('mapValue'       in v) {
    const out: Record<string, unknown> = {}
    for (const [k, fv] of Object.entries(v.mapValue.fields ?? {})) out[k] = fromFS(fv)
    return out
  }
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromFS)
  return null
}

const FS_BASE = () =>
  `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`
const FS_KEY = () => process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function fetchQuoteBySlug(slug: string) {
  const url = `${FS_BASE()}:runQuery?key=${FS_KEY()}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'quotes' }],
        where: { fieldFilter: { field: { fieldPath: 'slug' }, op: 'EQUAL', value: { stringValue: slug } } },
        limit: 1,
      },
    }),
  })
  const data: Array<{ document?: { name: string; fields: Record<string, FSValue> } }> = await res.json()
  const doc = data?.[0]?.document
  if (!doc) return null
  const id = doc.name.split('/').pop()!
  const fields: Record<string, unknown> = {}
  for (const [k, fv] of Object.entries(doc.fields)) fields[k] = fromFS(fv)
  return { id, ...fields } as import('@/types/quote').Quote
}

async function fetchCompanyById(companyId: string) {
  const url = `${FS_BASE()}/companies/${companyId}?key=${FS_KEY()}`
  const res = await fetch(url)
  if (!res.ok) return null
  const doc: { fields: Record<string, FSValue> } = await res.json()
  if (!doc.fields) return null
  const fields: Record<string, unknown> = {}
  for (const [k, fv] of Object.entries(doc.fields)) fields[k] = fromFS(fv)
  return fields as unknown as import('@/types/quote').Company
}
import { applySystemFont, injectFont } from '@/lib/fonts'
import { applyPalette, applyThemeColors, applyInkOpacities } from '@/lib/theme'
import type { Quote } from '@/types/quote'
import { Printer } from 'lucide-react'
import { QuotePreview } from '@/components/quote/QuotePreview'

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ quote, onUnlock }: { quote: Quote; onUnlock: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value === quote.accessPassword) {
      sessionStorage.setItem(`quote-access-${quote.slug}`, '1')
      onUnlock()
    } else {
      setError(true)
      setShake(true)
      setValue('')
      setTimeout(() => setShake(false), 500)
    }
  }

  const isEn = quote.language === 'en'

  return (
    <div className="min-h-screen bg-paper flex flex-col">

      {/* Top bar — same as the quote page */}
      <header className="h-14 border-b border-line flex items-center px-6 sm:px-8 shrink-0">
        {quote.emitter.logoUrl
          ? <img src={quote.emitter.logoUrl} alt={quote.emitter.companyName} className="object-contain" style={{ maxHeight: '1.25rem', maxWidth: '6rem' }} />
          : <span className="text-sm font-medium text-ink">{quote.emitter.companyName}</span>
        }
      </header>

      {/* Centered form */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xs">

          {/* Client name as heading */}
          {(quote.client.company || quote.client.name) && (
            <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-3">
              {isEn ? 'Proposal for' : 'Presupuesto para'}
            </p>
          )}
          <h1 className="text-2xl font-medium tracking-tight text-ink mb-8 leading-snug">
            {quote.client.company || quote.client.name || (isEn ? 'Proposal' : 'Presupuesto')}
          </h1>

          <div className="border-t border-line mb-6" />

          <p className="text-xs text-ink-40 mb-4 leading-relaxed">
            {isEn
              ? 'This document is private. Enter the access code to continue.'
              : 'Este documento es privado. Introduce el código de acceso para continuar.'}
          </p>

          <form onSubmit={handleSubmit} className={shake ? 'animate-shake' : ''}>
            <input
              ref={inputRef}
              type="password"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(false) }}
              placeholder={isEn ? 'Access code' : 'Código de acceso'}
              className={`w-full border rounded-md px-4 py-2.5 text-sm text-ink bg-paper outline-none transition-all
                ${error
                  ? 'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(220,38,38,0.08)]'
                  : 'border-input focus:border-ink focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]'
                }`}
            />
            <div className="h-4 flex items-center mt-1 mb-1">
              {error && (
                <p className="text-xs text-red-500">
                  {isEn ? 'Incorrect code. Try again.' : 'Código incorrecto. Inténtalo de nuevo.'}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-accent text-on-accent text-sm py-2.5 rounded-md hover:bg-accent-hover transition-all hover:-translate-y-px"
            >
              {isEn ? 'Access proposal' : 'Acceder'}
            </button>
          </form>

        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function QuotePageClient() {
  const { id } = useParams<{ id: string }>()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchQuoteBySlug(id)
      .then(async (q) => {
        if (!q) { console.warn('[QuotePage] no document found for slug:', id); setNotFound(true); return }
        setQuote(q)
        // Check if already unlocked this session (or no password set)
        if (!q.accessPassword || sessionStorage.getItem(`quote-access-${q.slug}`) === '1') {
          setUnlocked(true)
        }
        const client = q.client?.company || q.client?.name || ''
        const emitter = q.emitter?.companyName || ''
        const date = q.date ? new Date(q.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
        const parts = [client, emitter, date].filter(Boolean)
        document.title = parts.length ? `${parts.join(' · ')} — Presu` : 'Presupuesto — Presu'
        // Load company via REST API so it works for unauthenticated visitors too
        try {
          if (q.companyId) {
            const company = await fetchCompanyById(q.companyId)
            if (company) {
              if (company.themeColors) applyThemeColors(company.themeColors)
              else if (company.paletteId) applyPalette(company.paletteId)
              if (company.inkOpacitySecondary != null || company.inkOpacityTertiary != null) {
                applyInkOpacities(company.inkOpacitySecondary ?? 60, company.inkOpacityTertiary ?? 40)
              }
              if (company.defaultFontName) {
                const uploadedFont = company.fonts.find((f) => f.name === company.defaultFontName)
                if (uploadedFont) injectFont(uploadedFont)
                else applySystemFont(company.defaultFontName)
              }
            }
          } else if (q.fontName) {
            applySystemFont(q.fontName)
          }
        } catch {
          // Company fetch failed (e.g. unauthenticated) — quote still renders with default theme
        }
      })
      .catch((err) => { console.error('[QuotePage] fetch error:', err); setNotFound(true) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-4 h-4 border border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-base font-medium text-ink mb-2">Presupuesto no encontrado</p>
          <p className="text-sm text-ink-60">El enlace puede ser incorrecto o haber expirado.</p>
        </div>
      </div>
    )
  }

  // Show password gate if quote is protected and not yet unlocked
  if (!unlocked) {
    return <PasswordGate quote={quote} onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 bg-paper border-b border-line h-14 flex items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-3">
          {quote.emitter.logoUrl
            ? <img src={quote.emitter.logoUrl} alt={quote.emitter.companyName} className="object-contain" style={{ maxHeight: '1.25rem', maxWidth: '6rem' }} />
            : <span className="text-sm font-medium text-ink">{quote.emitter.companyName}</span>
          }
        </div>
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-2 text-sm text-ink-60 hover:text-ink transition-colors"
        >
          <Printer size={14} strokeWidth={1.5} />
          {quote.language === 'en' ? 'Export PDF' : 'Exportar PDF'}
        </button>
      </header>

      {/* Body */}
      <div className="flex w-full min-w-0">
        <QuotePreview quote={quote} pageBreaksBefore={quote.pageBreaksBefore ?? []} />
      </div>
    </div>
  )
}
