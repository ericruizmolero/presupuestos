'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { madridToday } from '@/lib/firestore/planning'
import {
  getProspects, saveProspects, STAGES, PRIORITIES, type Prospect, type ProspectStage, type ProspectPriority,
} from '@/lib/firestore/prospects'
import { myName, fmtShort, fmtDay } from '@/components/studio/boardUtils'
import { Check, Plus, X, ExternalLink, Trash2, GripVertical } from 'lucide-react'

const LABEL = 'text-[10px] font-medium tracking-[0.16em] uppercase text-ink-40 mb-2 block'
const INPUT = 'w-full px-3 py-2 border border-input rounded-md text-sm text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'

function hostOf(url?: string): string {
  if (!url) return ''
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return url }
}

function hrefOf(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`
}

export default function ProspeccionPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <ProspeccionContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function ProspeccionContent() {
  const { user } = useAuth()
  const me = myName(user?.displayName, user?.email)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [openId, setOpenId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const first = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    getUserCompanyId(user.uid).then(async (cid) => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      setItems(await getProspects(cid))
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (loading || !companyId) return
    if (first.current) { first.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSaved('saving')
      try {
        await saveProspects(companyId, items)
        setSaved('saved')
        setTimeout(() => setSaved('idle'), 1800)
      } catch (err) {
        console.error('[prospección] Error al guardar:', err)
        setSaved('error')
      }
    }, 900)
    return () => { if (timer.current) clearTimeout(timer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  function patch(id: string, p: Partial<Prospect>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
  }

  /** Suelta una fila sobre otra (o al final de una etapa): adopta su etapa y queda justo antes */
  function dropOn(targetId: string | null, stage: ProspectStage) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    setItems((xs) => {
      const moving = xs.find((x) => x.id === dragId)
      if (!moving) return xs
      const rest = xs.filter((x) => x.id !== dragId)
      const moved = { ...moving, stage, ...(moving.stage !== stage ? { stageDate: madridToday() } : {}) }
      if (targetId) {
        const at = rest.findIndex((x) => x.id === targetId)
        rest.splice(at < 0 ? rest.length : at, 0, moved)
      } else {
        // al final de esa etapa
        let last = -1
        rest.forEach((x, i) => { if (x.stage === stage) last = i })
        rest.splice(last + 1, 0, moved)
      }
      return rest
    })
    setDragId(null)
    setOverId(null)
  }

  function cyclePriority(p: Prospect) {
    const order: ProspectPriority[] = ['alta', 'media', 'baja']
    const cur = p.priority ?? 'media'
    patch(p.id, { priority: order[(order.indexOf(cur) + 1) % order.length] })
  }

  function add() {
    const name = newName.trim()
    if (!name) return
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setItems((xs) => [{ id, name, reasons: [], stage: 'detectado', priority: 'media', date: madridToday(), by: me }, ...xs])
    setNewName('')
    setOpenId(id)
  }

  if (loading) return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>

  const active = STAGES.filter((s) => s.id !== 'ganado' && s.id !== 'descartado')
  const closed = STAGES.filter((s) => s.id === 'ganado' || s.id === 'descartado')
  const open = openId ? items.find((x) => x.id === openId) : null

  function row(p: Prospect) {
    const pr = PRIORITIES.find((x) => x.id === (p.priority ?? 'media'))!
    return (
      <div
        key={p.id}
        draggable
        onDragStart={() => setDragId(p.id)}
        onDragEnd={() => { setDragId(null); setOverId(null) }}
        onDragOver={(e) => { e.preventDefault(); setOverId(p.id) }}
        onDrop={(e) => { e.stopPropagation(); dropOn(p.id, p.stage) }}
        className={`group/row grid grid-cols-[1rem_minmax(0,1fr)] md:grid-cols-[1rem_15rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-3 py-3 transition-colors ${
          dragId === p.id ? 'opacity-40' : ''
        } ${overId === p.id && dragId && dragId !== p.id ? 'shadow-[inset_0_2px_0_var(--color-accent)]' : ''} hover:bg-surface`}
      >
        <span className="mt-0.5 text-ink-40 opacity-0 group-hover/row:opacity-100 cursor-grab" title="Arrastra para ordenar o cambiar de etapa">
          <GripVertical size={14} strokeWidth={1.5} />
        </span>
        <button onClick={() => setOpenId(p.id)} className="min-w-0 flex items-center gap-2.5 text-left">
          {p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`https://www.google.com/s2/favicons?domain=${hostOf(p.url)}&sz=64`} alt="" className="w-5 h-5 rounded shrink-0" />
          ) : (
            <span className="w-5 h-5 rounded bg-surface border border-line shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink truncate">{p.name}</span>
            <span className="block text-xs text-ink-40 truncate">{p.contact || hostOf(p.url) || 'Sin web'}</span>
          </span>
        </button>
        <button onClick={() => setOpenId(p.id)} className="col-start-2 md:col-start-auto min-w-0 text-left text-sm text-ink-60 leading-snug">
          {p.reasons.length ? (
            <ul className="space-y-1">
              {p.reasons.map((r, i) => (
                <li key={i} className="grid grid-cols-[0.75rem_minmax(0,1fr)]">
                  <span className="text-ink-40">·</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : <span className="text-ink-40">Sin motivos todavía</span>}
        </button>
        <span className="col-start-2 md:col-start-auto flex items-center gap-2 justify-end">
          <button
            onClick={() => cyclePriority(p)}
            title="Prioridad — clic para cambiar"
            className={`px-1.5 py-px rounded text-[11px] font-medium ${pr.cls}`}
          >
            {pr.label}
          </button>
          <select
            value={p.stage}
            onChange={(e) => patch(p.id, { stage: e.target.value as ProspectStage, stageDate: madridToday() })}
            className="text-xs text-ink-60 bg-transparent border border-line rounded px-1.5 py-0.5 hover:border-input focus:outline-none focus:border-accent"
            aria-label="Etapa"
          >
            {STAGES.map((s2) => <option key={s2.id} value={s2.id}>{s2.label}</option>)}
          </select>
        </span>
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight text-ink">Prospección</h1>
          <span className="h-4 flex items-center">
            {saved === 'saving' && <span className="w-2.5 h-2.5 inline-block border border-ink-40 border-t-transparent rounded-full animate-spin" />}
            {saved === 'saved' && <span className="flex items-center gap-1 text-[10px] text-ink-40"><Check size={10} strokeWidth={2.5} />Guardado</span>}
            {saved === 'error' && <span className="text-[10px] text-[#DC2626]">Error al guardar</span>}
          </span>
        </div>
      </div>
      <p className="text-sm text-ink-40 mb-8 max-w-2xl">
        Empresas a las que rediseñar la home a ciegas para tocarles la puerta: por qué pueden picar y por cuál empezamos. Arrastra para ordenar.
      </p>

      <div className="flex items-center gap-2 mb-8 max-w-md">
        <input
          className={INPUT}
          placeholder="Nueva empresa (Helmcode, Deneb Medical…)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} disabled={!newName.trim()} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover disabled:opacity-40">
          <Plus size={14} strokeWidth={2} />Añadir
        </button>
      </div>

      <div className="space-y-8">
        {active.map((st) => {
          const list = items.filter((x) => x.stage === st.id)
          return (
            <section key={st.id}>
              <div className="flex items-baseline gap-2 mb-2.5">
                <h2 className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink">{st.label}</h2>
                <span className="text-[10px] text-ink-40 tabular-nums">{list.length}</span>
                <span className="text-xs text-ink-40">· {st.hint}</span>
              </div>
              <div
                onDragOver={(e) => { if (dragId) e.preventDefault() }}
                onDrop={() => dropOn(null, st.id)}
                className={list.length ? 'border border-line rounded-md bg-paper divide-y divide-line' : `rounded-md border border-dashed px-3 py-3 text-xs text-ink-40 ${dragId ? 'border-input' : 'border-line'}`}
              >
                {list.length ? list.map(row) : (dragId ? 'Suelta aquí' : 'Nada aquí.')}
              </div>
            </section>
          )
        })}

        {items.some((x) => x.stage === 'ganado' || x.stage === 'descartado') && (
          <section>
            <button onClick={() => setShowClosed((v) => !v)} className="text-xs text-ink-40 hover:text-ink">
              {showClosed ? 'Ocultar' : 'Ver'} cerrados ({items.filter((x) => x.stage === 'ganado' || x.stage === 'descartado').length})
            </button>
            {showClosed && closed.map((st) => {
              const list = items.filter((x) => x.stage === st.id)
              if (!list.length) return null
              return (
                <div key={st.id} className="mt-4">
                  <h2 className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40 mb-2.5">{st.label}</h2>
                  <div onDragOver={(e) => { if (dragId) e.preventDefault() }} onDrop={() => dropOn(null, st.id)} className="border border-line rounded-md bg-paper divide-y divide-line opacity-70">{list.map(row)}</div>
                </div>
              )
            })}
          </section>
        )}
      </div>

      {open && (
        <ProspectSheet
          key={open.id}
          p={open}
          onPatch={(x) => patch(open.id, x)}
          onDelete={() => { setItems((xs) => xs.filter((y) => y.id !== open.id)); setOpenId(null) }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function ProspectSheet({ p, onPatch, onDelete, onClose }: {
  p: Prospect
  onPatch: (x: Partial<Prospect>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(p.name)
  const [url, setUrl] = useState(p.url || '')
  const [contact, setContact] = useState(p.contact || '')
  const [reasons, setReasons] = useState(p.reasons.join('\n'))
  const [links, setLinks] = useState((p.links || []).join('\n'))
  const [notes, setNotes] = useState(p.notes || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const lines = (s: string) => s.split('\n').map((l) => l.replace(/^[·•\-\s]+/, '').trim()).filter(Boolean)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-label={`Editar ${p.name}`} className="sheet-in fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-paper border-l border-line shadow-[0_8px_40px_rgba(0,0,0,0.12)] flex flex-col">
        <div className="flex items-center gap-3 px-6 h-14 border-b border-line shrink-0">
          <input
            className="flex-1 min-w-0 text-base font-medium text-ink bg-transparent outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && onPatch({ name: name.trim() })}
            aria-label="Nombre"
          />
          {p.url && (
            <a href={hrefOf(p.url)} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover" title="Abrir web">
              <ExternalLink size={15} strokeWidth={1.5} />
            </a>
          )}
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover" aria-label="Cerrar"><X size={16} strokeWidth={1.5} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <section>
            <span className={LABEL}>Etapa</span>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPatch({ stage: s.id as ProspectStage, stageDate: madridToday() })}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${p.stage === s.id ? 'border-accent bg-surface text-ink font-medium' : 'border-line text-ink-60 hover:border-input hover:text-ink'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <span className={LABEL}>Prioridad</span>
            <div className="flex gap-1.5">
              {PRIORITIES.map((x) => (
                <button
                  key={x.id}
                  onClick={() => onPatch({ priority: x.id })}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${(p.priority ?? 'media') === x.id ? 'border-accent bg-surface text-ink font-medium' : 'border-line text-ink-60 hover:border-input hover:text-ink'}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              <span className={LABEL}>Web</span>
              <input className={INPUT} value={url} placeholder="empresa.com" onChange={(e) => setUrl(e.target.value)} onBlur={() => onPatch({ url: url.trim() || undefined })} />
            </label>
            <label>
              <span className={LABEL}>Contacto</span>
              <input className={INPUT} value={contact} placeholder="Nombre · cargo" onChange={(e) => setContact(e.target.value)} onBlur={() => onPatch({ contact: contact.trim() || undefined })} />
            </label>
          </section>

          <section>
            <span className={LABEL}>Por qué puede picar</span>
            <textarea
              className={`${INPUT} min-h-[8rem] leading-relaxed`}
              value={reasons}
              placeholder={'Un motivo por línea:\nAcaban de levantar 14,7 M€\nLa web es muy floja\nConocemos a alguien dentro'}
              onChange={(e) => setReasons(e.target.value)}
              onBlur={() => onPatch({ reasons: lines(reasons) })}
            />
          </section>

          <section>
            <span className={LABEL}>Enlaces</span>
            <textarea
              className={`${INPUT} min-h-[5rem]`}
              value={links}
              placeholder="Noticias, perfiles de X o LinkedIn… uno por línea"
              onChange={(e) => setLinks(e.target.value)}
              onBlur={() => onPatch({ links: lines(links) })}
            />
            {(p.links || []).length > 0 && (
              <ul className="mt-2 space-y-1">
                {(p.links || []).map((l) => (
                  <li key={l}><a href={hrefOf(l)} target="_blank" rel="noreferrer" className="text-xs text-ink-60 underline underline-offset-2 hover:text-ink break-all">{hostOf(l)}{l.length > 40 ? ' · ' + l.slice(l.indexOf(hostOf(l)) + hostOf(l).length, 70) : ''}</a></li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <span className={LABEL}>Notas</span>
            <textarea className={`${INPUT} min-h-[6rem] leading-relaxed`} value={notes} placeholder="Ángulo del rediseño, ideas, cómo entrar…" onChange={(e) => setNotes(e.target.value)} onBlur={() => onPatch({ notes: notes.trim() || undefined })} />
          </section>

          <p className="text-xs text-ink-40">Añadido el {fmtDay(p.date)}{p.by ? ` por ${p.by}` : ''}</p>
        </div>

        <div className="px-6 py-3.5 border-t border-line shrink-0 flex items-center justify-between">
          <span className="text-xs text-ink-40">Los cambios se guardan solos</span>
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <button onClick={onDelete} className="px-3 py-1.5 text-xs font-medium bg-[#DC2626] text-white rounded-md">Eliminar</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-ink-60">Cancelar</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-ink-40 hover:text-[#B91C1C]"><Trash2 size={13} strokeWidth={1.5} />Eliminar</button>
          )}
        </div>
      </aside>
    </>
  )
}
