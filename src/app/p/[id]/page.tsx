'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { getQuoteBySlug } from '@/lib/firestore/quotes'
import { getCompany } from '@/lib/firestore/companies'
import { applySystemFont, injectFont } from '@/lib/fonts'
import { applyPalette, applyThemeColors, applyInkOpacities } from '@/lib/theme'
import type { Quote } from '@/types/quote'
import { Printer } from 'lucide-react'
import { QuotePreview } from '@/components/quote/QuotePreview'

export default function PublicQuotePage() {
  const { id } = useParams<{ id: string }>()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    getQuoteBySlug(id)
      .then(async (q) => {
        if (!q) { setNotFound(true); return }
        setQuote(q)
        const client = q.client?.company || q.client?.name || ''
        const emitter = q.emitter?.companyName || ''
        const date = q.date ? new Date(q.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
        const parts = [client, emitter, date].filter(Boolean)
        document.title = parts.length ? `${parts.join(' · ')} — Presu` : 'Presupuesto — Presu'
        if (q.companyId) {
          const company = await getCompany(q.companyId)
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
      })
      .catch(() => setNotFound(true))
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

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 bg-paper border-b border-line h-14 flex items-center justify-between px-8">
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
          Exportar PDF
        </button>
      </header>

      {/* Body */}
      <div className="flex">
        <QuotePreview quote={quote} pageBreaksBefore={quote.pageBreaksBefore ?? []} />
      </div>
    </div>
  )
}
