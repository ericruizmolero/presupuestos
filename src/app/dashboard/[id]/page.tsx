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
  const [quoteRaw, setQuoteRaw] = useState<Quote | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Step 1: load quote from Firestore (once)
  useEffect(() => {
    getQuoteById(id).then((q) => {
      if (!q) { router.replace('/dashboard'); return }
      setQuoteRaw(q)
    })
  }, [id, router])

  // Step 2: once both quote and company are resolved, merge and render
  useEffect(() => {
    if (!quoteRaw) return
    const q: Quote = { ...quoteRaw, emitter: { ...quoteRaw.emitter }, client: { ...quoteRaw.client } }

    // Backward compat — ensure new fields exist
    q.emitter.city               = q.emitter.city ?? ''
    q.emitter.representativeName = q.emitter.representativeName ?? ''
    q.emitter.representativeRole = q.emitter.representativeRole ?? ''
    q.client.city                = q.client.city ?? ''
    q.client.role                = q.client.role ?? ''
    if (!q.billingMilestones?.length) {
      const mid = () => Math.random().toString(36).slice(2, 10)
      q.billingMilestones = [
        { id: mid(), label: 'Hito inicial 50%', percentage: 50, description: 'La forma de pago será a la recepción de la factura que será emitida cuando comience el proyecto.' },
        { id: mid(), label: 'Hito final 50%',   percentage: 50, description: 'La forma de pago será a la recepción de la factura que será emitida cuando el trabajo esté completado.' },
      ]
    }

    // Sync emitter fields from company settings if empty in the quote
    if (company) {
      if (!q.emitter.logoUrl && company.logoUrl)                       q.emitter.logoUrl = company.logoUrl
      if (!q.emitter.city && company.city)                             q.emitter.city = company.city
      if (!q.emitter.representativeName && company.representativeName) q.emitter.representativeName = company.representativeName
      if (!q.emitter.representativeRole && company.representativeRole) q.emitter.representativeRole = company.representativeRole
    }

    setQuote(q)
    setLoading(false)
  }, [quoteRaw, company])

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
            Previsualizar PDF
          </Link>
        </div>
      </div>

      <QuoteEditor initialData={formData as QuoteFormData} onSave={handleSave} />
    </div>
  )
}
