'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { QuoteEditor } from '@/components/quote/QuoteEditor'
import { getQuoteById, updateQuote } from '@/lib/firestore/quotes'
import type { Quote, QuoteFormData } from '@/types/quote'
import { ExternalLink, Printer, Check } from 'lucide-react'

export default function EditQuotePage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <EditQuoteContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function EditQuoteContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { company } = useAuth()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getQuoteById(id).then((q) => {
      if (!q) { router.replace('/dashboard'); return }
      if (!q.emitter.logoUrl && company?.logoUrl) {
        q.emitter.logoUrl = company.logoUrl
      }
      setQuote(q)
      setLoading(false)
    })
  }, [id, router, company])

  async function handleSave(data: QuoteFormData) {
    setSaving(true)
    try {
      await updateQuote(id, data)
      setQuote((q) => q ? { ...q, ...data } : q)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !quote) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const { id: _id, createdAt: _ca, updatedAt: _ua, createdBy: _cb, companyId: _ci, ...formData } = quote

  return (
    <div>
      <div className="border-b border-line px-8 h-16 flex items-center justify-between">
        <div>
          <h1 className="text-base font-medium text-ink">
            {quote.client?.company || quote.client?.name || 'Sin cliente'}
          </h1>
          <p className="text-xs text-ink-40 mt-0.5">{quote.quoteNumber || 'Sin número'}</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-ink-60">
              <Check size={12} /> Guardado
            </span>
          )}
          <Link
            href={`/p/${quote.slug}`}
            target="_blank"
            className="flex items-center gap-2 border border-line text-sm text-ink-60 px-4 py-2 rounded-md hover:border-input hover:text-ink transition-colors"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
            Ver presupuesto
          </Link>
          <Link
            href={`/dashboard/${id}/export`}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-all hover:-translate-y-px bg-accent text-on-accent hover:bg-accent-hover"
          >
            <Printer size={14} strokeWidth={1.5} />
            Exportar PDF
          </Link>
        </div>
      </div>

      <QuoteEditor initialData={formData as QuoteFormData} onSave={handleSave} />
    </div>
  )
}
