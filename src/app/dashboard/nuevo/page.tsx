'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { createQuote } from '@/lib/firestore/quotes'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { createDefaultQuote } from '@/lib/defaultQuote'

export default function NewQuotePage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <NewQuoteContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function Bone({ className }: { className: string }) {
  return <div className={`skeleton rounded ${className}`} />
}

function NewQuoteContent() {
  const { user, company } = useAuth()
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || !user) return
    ran.current = true

    async function create() {
      try {
        const [cid] = await Promise.all([
          getUserCompanyId(user!.uid),
          new Promise((r) => setTimeout(r, 2000)),
        ])
        if (!cid) { router.replace('/dashboard'); return }
        const defaultData = createDefaultQuote(company ?? undefined)
        const id = await createQuote(defaultData, user!.uid, cid)
        router.replace(`/dashboard/${id}`)
      } catch {
        router.replace('/dashboard')
      }
    }

    create()
  }, [user, company, router])

  return (
    <div>

      {/* Header skeleton */}
      <div className="border-b border-line px-8 h-16 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Bone className="h-4 w-40" />
          <Bone className="h-3 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <Bone className="h-9 w-32 rounded-md" />
          <Bone className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Editor skeleton */}
      <div className="max-w-3xl mx-auto px-8 py-12">

        {/* Toggle all */}
        <div className="flex justify-end mb-2">
          <Bone className="h-3 w-20" />
        </div>

        {[
          { labelW: 'w-44', lines: ['w-full', 'w-3/4', 'w-5/6', 'w-2/3'] },
          { labelW: 'w-36', lines: [] },
          { labelW: 'w-52', lines: ['w-full', 'w-4/5', 'w-full', 'w-3/5'] },
          { labelW: 'w-28', lines: [] },
          { labelW: 'w-20', lines: ['w-full', 'w-2/3', 'w-5/6', 'w-3/4', 'w-full', 'w-1/2'] },
          { labelW: 'w-40', lines: [] },
          { labelW: 'w-48', lines: [] },
        ].map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between py-6">
              <Bone className={`h-3 ${s.labelW}`} />
              <Bone className="h-3 w-3" />
            </div>
            {s.lines.length > 0 && (
              <div className="pb-8 space-y-3">
                {s.lines.map((w, j) => (
                  <Bone key={j} className={`h-3 ${w}`} />
                ))}
              </div>
            )}
            <div className="border-t border-line" />
          </div>
        ))}
      </div>
    </div>
  )
}
