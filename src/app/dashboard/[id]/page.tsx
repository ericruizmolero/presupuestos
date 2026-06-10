'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { QuoteEditor } from '@/components/quote/QuoteEditor'
import { getQuoteById, updateQuote, regenerateQuoteSlug, checkSlugAvailable, setQuoteSlug } from '@/lib/firestore/quotes'
import type { Quote, QuoteFormData } from '@/types/quote'
import { ExternalLink, Printer, Check, Loader, X } from 'lucide-react'

export default function EditQuotePage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <EditQuoteContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

// Full normalization — used on save
function toSlug(s: string) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// Light normalization while typing — keeps trailing dash so user can type "foo-bar"
function toSlugTyping(s: string) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-/, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'saving' | 'saved'

function EditQuoteContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = searchParams.get('new') === '1'
  const { company } = useAuth()
  const [quoteRaw, setQuoteRaw] = useState<Quote | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  // Slug editing state
  const [slugInput, setSlugInput] = useState('')
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [slugEditing, setSlugEditing] = useState(false)
  const slugCustomized = useRef(false)   // true once user manually edits slug
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevClientName = useRef('')

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

    if (company) {
      if (!q.emitter.logoUrl && company.logoUrl)                       q.emitter.logoUrl = company.logoUrl
      if (!q.emitter.city && company.city)                             q.emitter.city = company.city
      if (!q.emitter.representativeName && company.representativeName) q.emitter.representativeName = company.representativeName
      if (!q.emitter.representativeRole && company.representativeRole) q.emitter.representativeRole = company.representativeRole
    }

    setQuote(q)
    setSlugInput(q.slug || '')
    prevClientName.current = q.client.company || q.client.name || ''
    setLoading(false)
  }, [quoteRaw, company])

  // Debounced slug availability check
  const scheduleCheck = useCallback((value: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current)
    if (!value) { setSlugStatus('idle'); return }
    setSlugStatus('checking')
    checkTimer.current = setTimeout(async () => {
      const available = await checkSlugAvailable(value, id)
      setSlugStatus(available ? 'available' : 'taken')
    }, 450)
  }, [id])

  function handleSlugChange(value: string) {
    const clean = toSlugTyping(value)
    setSlugInput(clean)
    slugCustomized.current = true
    scheduleCheck(clean)
  }

  async function saveSlug() {
    const finalSlug = toSlug(slugInput)
    setSlugInput(finalSlug)
    setSlugEditing(false)
    if (!finalSlug || finalSlug === quote?.slug) { setSlugStatus('idle'); return }
    if (slugStatus === 'taken') return
    setSlugStatus('saving')
    await setQuoteSlug(id, finalSlug)
    setQuote(q => q ? { ...q, slug: finalSlug } : q)
    setSlugStatus('saved')
    setTimeout(() => setSlugStatus('idle'), 1500)
  }

  function handleSlugKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveSlug()
    if (e.key === 'Escape') {
      setSlugInput(quote?.slug || '')
      setSlugStatus('idle')
      setSlugEditing(false)
    }
  }

  async function handleSave(data: QuoteFormData) {
    await updateQuote(id, data)
    setQuote((q) => q ? { ...q, ...data } : q)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)

    // Auto-update slug when client name changes (only if user hasn't customized it)
    if (!slugCustomized.current) {
      const newClientName = data.client.company || data.client.name || ''
      if (newClientName && newClientName !== prevClientName.current) {
        prevClientName.current = newClientName
        const newSlug = await regenerateQuoteSlug(id, newClientName)
        setSlugInput(newSlug)
        setQuote(q => q ? { ...q, slug: newSlug } : q)
      }
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

  const slugSame = slugInput === (quote.slug || '')

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

          {/* Editable URL — pill */}
          <div className="flex items-center h-9 border border-line rounded-md hover:border-input focus-within:border-ink-40 transition-colors text-xs overflow-hidden">
            {/* Prefix — clickable, leads to public page */}
            <Link
              href={`/client/${quote.slug}`}
              target="_blank"
              className="pl-3 pr-0 transition-colors shrink-0 h-full flex items-center"
              style={{ color: 'color-mix(in srgb, var(--color-ink) 30%, transparent)' }}
            >
              {typeof window !== 'undefined' ? window.location.origin : ''}/client/
            </Link>

            {/* Editable slug — mirror span drives width, input centered on top */}
            <span className="relative self-stretch flex items-center">
              <span aria-hidden className="whitespace-pre text-xs invisible select-none leading-none">{slugInput || 'x'}</span>
              <input
                className="absolute left-0 right-0 top-1/2 bg-transparent outline-none text-ink text-xs leading-none w-full" style={{ transform: 'translateY(calc(-50% - 0.5px))' }}
                value={slugInput}
                onFocus={() => setSlugEditing(true)}
                onChange={(e) => handleSlugChange(e.target.value)}
                onBlur={() => { if (slugEditing) saveSlug() }}
                onKeyDown={handleSlugKeyDown}
                spellCheck={false}
              />
            </span>

            {/* Status icon */}
            <span className="pl-1 pr-1.5 flex items-center shrink-0">
              {slugStatus === 'checking' && <Loader size={10} strokeWidth={1.5} className="animate-spin text-ink-40" />}
              {slugStatus === 'available' && !slugSame && <Check size={10} strokeWidth={2.5} className="text-green-500" />}
              {slugStatus === 'taken' && <X size={10} strokeWidth={2.5} className="text-red-500" />}
              {slugStatus === 'saved' && <Check size={10} strokeWidth={2.5} className="text-green-500" />}
            </span>

            {/* Divider + external link */}
            <Link
              href={`/client/${quote.slug}`}
              target="_blank"
              className="h-full px-3 flex items-center border-l border-line text-ink-40 hover:text-ink hover:bg-surface transition-colors shrink-0"
            >
              <ExternalLink size={12} strokeWidth={1.5} />
            </Link>
          </div>
          <Link
            href={`/dashboard/${id}/export`}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-all hover:-translate-y-px bg-accent text-on-accent hover:bg-accent-hover"
          >
            <Printer size={14} strokeWidth={1.5} />
            Previsualizar PDF
          </Link>
        </div>
      </div>

      <QuoteEditor initialData={formData as QuoteFormData} onSave={handleSave} autoOpenAI={isNew} />
    </div>
  )
}
