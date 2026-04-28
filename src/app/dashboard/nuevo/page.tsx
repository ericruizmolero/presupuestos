'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { QuoteEditor } from '@/components/quote/QuoteEditor'
import { createQuote } from '@/lib/firestore/quotes'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { createDefaultQuote } from '@/lib/defaultQuote'
import type { QuoteFormData } from '@/types/quote'

export default function NewQuotePage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <NewQuoteContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function NewQuoteContent() {
  const { user, company } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const defaultData = createDefaultQuote(company)

  async function handleSave(data: QuoteFormData) {
    if (!user) return
    setSaving(true)
    try {
      const cid = await getUserCompanyId(user.uid)
      if (!cid) throw new Error('No company configured')
      const id = await createQuote(data, user.uid, cid)
      router.push(`/dashboard/${id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="border-b border-line px-8 py-5">
        <h1 className="text-lg font-medium text-ink">Nuevo presupuesto</h1>
      </div>
      <QuoteEditor initialData={defaultData} onSave={handleSave} saving={saving} />
    </div>
  )
}
