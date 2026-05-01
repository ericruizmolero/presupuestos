'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getQuotes, deleteQuote, duplicateQuote, updateQuoteStatus } from '@/lib/firestore/quotes'
import { getUserCompanyId } from '@/lib/firestore/companies'
import type { Quote, QuoteStatus } from '@/types/quote'
import { ExternalLink, Copy, Trash2, MoreHorizontal, X, ArrowDown } from 'lucide-react'

const STATUS_LABELS: Record<QuoteStatus, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
}

const STATUS_COLORS: Record<QuoteStatus, string> = {
  borrador: 'text-ink-40 bg-surface',
  enviado:  'text-[#C2410C] bg-[#FFF7ED]',
  aceptado: 'text-[#15803D] bg-[#F0FDF4]',
  rechazado: 'text-[#DC2626] bg-[#FEF2F2]',
}

const STATUS_ORDER: Record<QuoteStatus, number> = {
  aceptado: 0,
  enviado: 1,
  borrador: 2,
  rechazado: 3,
}

type SortKey = 'client' | 'number' | 'date' | 'total' | 'status'
type SortDir = 'asc' | 'desc'

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function DashboardContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'date', dir: 'desc' })

  async function load() {
    if (!user) return
    try {
      const cid = await getUserCompanyId(user.uid)
      if (!cid) { setLoading(false); return }
      const data = await getQuotes(cid)
      setQuotes(data)
    } catch (e) {
      console.error('Error loading quotes:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  function handleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'date' ? 'desc' : 'asc' }
    )
  }

  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'client': {
          const na = (a.client?.company || a.client?.name || '').toLowerCase()
          const nb = (b.client?.company || b.client?.name || '').toLowerCase()
          cmp = na.localeCompare(nb, 'es')
          break
        }
        case 'number': {
          const na = parseInt(a.quoteNumber?.replace(/\D/g, '') || '0')
          const nb = parseInt(b.quoteNumber?.replace(/\D/g, '') || '0')
          cmp = na - nb
          break
        }
        case 'date': {
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          cmp = da - db
          break
        }
        case 'total': {
          cmp = (a.budgetTable?.total ?? 0) - (b.budgetTable?.total ?? 0)
          break
        }
        case 'status': {
          cmp = (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2)
          break
        }
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [quotes, sort])

  async function handleDelete(id: string) {
    await deleteQuote(id)
    setQuotes((q) => q.filter((x) => x.id !== id))
    setOpenMenu(null)
    setConfirmDeleteId(null)
    window.dispatchEvent(new Event('quotes-changed'))
  }

  async function handleDuplicate(id: string) {
    if (!user) return
    const cid = await getUserCompanyId(user.uid)
    if (!cid) return
    const newId = await duplicateQuote(id, user.uid, cid)
    setOpenMenu(null)
    router.push(`/dashboard/${newId}`)
  }

  async function handleStatusChange(id: string, status: QuoteStatus) {
    await updateQuoteStatus(id, status)
    setQuotes((q) => q.map((x) => (x.id === id ? { ...x, status } : x)))
    setOpenMenu(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-8">
        <p className="text-ink font-medium mb-2">Sin presupuestos aún</p>
        <p className="text-sm text-ink-60 mb-6">Crea tu primer presupuesto para comenzar.</p>
        <Link
          href="/dashboard/nuevo"
          className="text-sm font-medium px-5 py-2.5 rounded-md transition-all bg-accent text-on-accent hover:bg-accent-hover"
        >
          Crear presupuesto
        </Link>
      </div>
    )
  }

  function SortTh({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const active = sort.key === sortKey
    return (
      <th className="px-6 py-3 text-left">
        <button
          onClick={() => handleSort(sortKey)}
          className={`flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase transition-colors group ${active ? 'text-ink' : 'text-ink-40 hover:text-ink-60'}`}
        >
          {label}
          <ArrowDown
            size={11}
            strokeWidth={1.5}
            className={`transition-transform ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'} ${active && sort.dir === 'asc' ? 'rotate-180' : ''}`}
          />
        </button>
      </th>
    )
  }

  return (
    <>
    <div className="px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Presupuestos</h1>
        <p className="text-sm text-ink-60 mt-1">{quotes.length} presupuesto{quotes.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="border border-line rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface">
              <SortTh label="Cliente" sortKey="client" />
              <SortTh label="Nº" sortKey="number" />
              <SortTh label="Fecha" sortKey="date" />
              <SortTh label="Total" sortKey="total" />
              <SortTh label="Estado" sortKey="status" />
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedQuotes.map((q) => (
              <tr
                key={q.id}
                className="border-b border-line last:border-0 hover:bg-surface transition-colors group cursor-pointer"
                onClick={() => router.push(`/dashboard/${q.id}`)}
              >
                <td className="px-6 py-4">
                  <span className="font-medium text-ink">
                    {q.client?.company || q.client?.name || '—'}
                  </span>
                </td>
                <td className="px-6 py-4 text-ink-60">
                  {q.quoteNumber || '—'}
                </td>
                <td className="px-6 py-4 text-ink-60">
                  {q.date ? new Date(q.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="px-6 py-4 text-ink">
                  {q.budgetTable?.total != null
                    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: q.currency || 'EUR' }).format(q.budgetTable.total)
                    : '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${STATUS_COLORS[q.status]}`}>
                    {STATUS_LABELS[q.status]}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 justify-end relative">
                    <Link
                      href={`/p/${q.slug}`}
                      target="_blank"
                      className="p-1.5 text-ink-40 hover:text-ink transition-colors opacity-0 group-hover:opacity-100"
                      title="Ver página pública"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={14} strokeWidth={1.5} />
                    </Link>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (openMenu === q.id) { setOpenMenu(null); setMenuPos(null); return }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                          setOpenMenu(q.id)
                        }}
                        className="p-1.5 text-ink-40 hover:text-ink transition-colors"
                      >
                        <MoreHorizontal size={14} strokeWidth={1.5} />
                      </button>
                      {openMenu === q.id && menuPos && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenMenu(null); setMenuPos(null); setConfirmDeleteId(null) }} />
                          <div className="fixed z-[9999] bg-paper border border-line rounded-md shadow-[0_4px_6px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05)] min-w-[160px] py-1" style={{ top: menuPos.top, right: menuPos.right }}>
                            {confirmDeleteId === q.id ? (
                              <div className="px-4 py-4">
                                <p className="text-sm font-medium text-ink mb-1">¿Eliminamos?</p>
                                <p className="text-xs text-ink-40 mb-4">No hay vuelta atrás.</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                                    className="flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 text-xs text-ink-60 hover:text-ink border border-line rounded-md transition-colors"
                                  >
                                    <X size={11} strokeWidth={1.5} />
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(q.id) }}
                                    className="flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 text-xs font-medium bg-[#DC2626] text-white rounded-md hover:bg-[#B91C1C] transition-colors"
                                  >
                                    <Trash2 size={11} strokeWidth={1.5} />
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <Link href={`/dashboard/${q.id}`} className="flex items-center px-4 py-2 text-sm text-ink hover:bg-surface">
                                  Editar
                                </Link>
                                <button onClick={(e) => { e.stopPropagation(); handleDuplicate(q.id); setOpenMenu(null); setMenuPos(null) }} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-ink hover:bg-surface">
                                  <Copy size={13} /> Duplicar
                                </button>
                                <div className="border-t border-line my-1" />
                                <p className="px-4 py-1 text-xs text-ink-40">Cambiar estado</p>
                                {(Object.keys(STATUS_LABELS) as QuoteStatus[]).map((s) => (
                                  <button
                                    key={s}
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(q.id, s); setOpenMenu(null); setMenuPos(null) }}
                                    className={`flex items-center w-full px-4 py-1.5 text-sm hover:bg-surface ${q.status === s ? 'text-ink font-medium' : 'text-ink-60'}`}
                                  >
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                                <div className="border-t border-line my-1" />
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(q.id) }} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#DC2626] hover:bg-[#FEF2F2]">
                                  <Trash2 size={13} /> Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    </>
  )
}
