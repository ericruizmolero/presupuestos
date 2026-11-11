'use client'

import { useEffect, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { madridToday } from '@/lib/firestore/planning'
import {
  subscribeProspects, saveProspects, STAGES, PRIORITIES, REGIONS, type Prospect, type ProspectStage, type ProspectPriority,
} from '@/lib/firestore/prospects'
import { myName, fmtShort, fmtDay } from '@/components/studio/boardUtils'
import {
  subscribeEmailTemplates, saveEmailTemplates, fillTemplate, prospectVars, firstName, PLACEHOLDERS, DEFAULT_TEMPLATES, type EmailTemplate,
} from '@/lib/firestore/emailTemplates'
import { Check, Plus, X, ExternalLink, Trash2, GripVertical, Sparkles, ChevronRight, Copy, Mail } from 'lucide-react'

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
  const [showAgent, setShowAgent] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // true cuando el estado cambia por una edición hecha aquí (y hay que guardarla)
  const dirty = useRef(false)

  useEffect(() => {
    if (!user) return
    let unsub: (() => void) | undefined
    getUserCompanyId(user.uid).then((cid) => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      const unsubT = subscribeEmailTemplates(cid, setTemplates)
      const unsubP = subscribeProspects(cid, (remote, local) => {
        // Cambios de Andoni o del conector de Claude: se aplican salvo que haya una edición local sin guardar
        if (!local && !dirty.current) setItems(remote)
        setLoading(false)
      })
      unsub = () => { unsubT(); unsubP() }
    })
    return () => unsub?.()
  }, [user])

  useEffect(() => {
    if (loading || !companyId || !dirty.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSaved('saving')
      try {
        await saveProspects(companyId, items)
        dirty.current = false
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
    dirty.current = true
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
  }

  /** Suelta una fila sobre otra (o al final de una etapa): adopta su etapa y queda justo antes */
  function dropOn(targetId: string | null, stage: ProspectStage) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    dirty.current = true
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
    dirty.current = true
    setItems((xs) => [{ id, name, reasons: [], stage: 'detectado', priority: 'media', date: madridToday(), by: me }, ...xs])
    setNewName('')
    setOpenId(id)
  }

  if (loading) return <div className="px-8 py-12 text-sm text-ink-40">Cargando…</div>

  const active = STAGES.filter((s) => s.id !== 'agente' && s.id !== 'ganado' && s.id !== 'descartado')
  const agentList = items.filter((x) => x.stage === 'agente')
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
        <div className="min-w-0 flex items-start gap-2.5">
          <button onClick={() => setOpenId(p.id)} className="shrink-0 mt-px" tabIndex={-1} aria-hidden="true">
            {p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://www.google.com/s2/favicons?domain=${hostOf(p.url)}&sz=64`} alt="" className="w-5 h-5 rounded" />
            ) : (
              <span className="block w-5 h-5 rounded bg-surface border border-line" />
            )}
          </button>
          <span className="min-w-0">
            <button onClick={() => setOpenId(p.id)} className="flex items-center gap-1.5 text-sm font-medium text-ink min-w-0 max-w-full text-left">
              <span className="truncate">{p.name}</span>
              {p.region && <span className="shrink-0 px-1 py-px rounded border border-line text-[10px] font-normal text-ink-40">{p.region === 'us' ? 'EE. UU.' : 'ES'}</span>}
            </button>
            {p.url && (
              <a
                href={hrefOf(p.url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 max-w-full text-xs text-ink-60 underline decoration-line underline-offset-2 hover:text-ink hover:decoration-ink-40"
                title={`Abrir ${hostOf(p.url)}`}
              >
                <span className="truncate">{hostOf(p.url)}</span>
                <ExternalLink size={10} strokeWidth={1.75} className="shrink-0" />
              </a>
            )}
            {(p.contact || !p.url) && (
              <button onClick={() => setOpenId(p.id)} className="block max-w-full mt-0.5 text-left text-xs text-ink-40 leading-snug">{p.contact || 'Sin web'}</button>
            )}
          </span>
        </div>
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
          ) : null}
          {p.angle && (
            <span className={`${p.reasons.length ? 'mt-2 ' : ''}block text-[13px] text-ink`}>
              <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-ink-40 mr-1.5">Ángulo</span>
              {p.angle}
            </span>
          )}
          {p.response && (
            <span className={`${p.reasons.length ? 'mt-2 ' : ''}block rounded-md bg-surface border border-line px-2.5 py-1.5 text-[13px] text-ink`}>
              <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-ink-40 mr-1.5">Respuesta</span>
              {p.response}
            </span>
          )}
        </button>
        <span className="col-start-2 md:col-start-auto flex items-center gap-2 justify-end">
          {p.stage === 'agente' && (
            <>
              <button
                onClick={() => patch(p.id, { stage: 'detectado', stageDate: madridToday() })}
                title="Elegir: pasa a Elegidos"
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-accent text-on-accent hover:bg-accent-hover"
              >
                <Check size={12} strokeWidth={2.5} />Elegir
              </button>
              <button
                onClick={() => patch(p.id, { stage: 'descartado', stageDate: madridToday() })}
                title="Descartar (queda en descartados y el agente no lo vuelve a proponer)"
                className="p-1 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover"
                aria-label="Descartar"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </>
          )}
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
        {agentList.length > 0 && (
          <section className="rounded-lg border border-line bg-surface p-3">
            <button
              onClick={() => setShowAgent((v) => !v)}
              aria-expanded={showAgent}
              className={`w-full flex items-baseline gap-2 px-1 text-left ${showAgent ? 'mb-2.5' : ''}`}
            >
              <ChevronRight size={12} strokeWidth={2} className={`self-center text-ink-40 transition-transform ${showAgent ? 'rotate-90' : ''}`} />
              <Sparkles size={12} strokeWidth={1.75} className="self-center text-ink-60" />
              <h2 className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink">Prospect agent</h2>
              <span className="text-[10px] text-ink-40 tabular-nums">{agentList.length}</span>
              <span className="text-xs text-ink-40">· Propuestos por Claude. Elige los que te convenzan; pasan a Elegidos. ✕ los descarta.</span>
            </button>
            {showAgent && <div
              onDragOver={(e) => { if (dragId) e.preventDefault() }}
              onDrop={() => dropOn(null, 'agente')}
              className="border border-line rounded-md bg-paper divide-y divide-line"
            >
              {agentList.map(row)}
            </div>}
          </section>
        )}

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
              {(() => {
                const won = items.filter((x) => x.stage === 'ganado').length
                const lost = items.filter((x) => x.stage === 'descartado').length
                const what = won && lost ? 'ganados y descartados' : won ? 'ganados' : 'descartados'
                return `${showClosed ? 'Ocultar' : 'Ver'} ${what} (${won + lost})`
              })()}
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

      {companyId && <TemplatesSection companyId={companyId} templates={templates} />}
      {companyId && <ContactsSection companyId={companyId} />}

      {open && (
        <ProspectSheet
          key={open.id}
          p={open}
          templates={templates}
          onPatch={(x) => patch(open.id, x)}
          onDelete={() => { dirty.current = true; setItems((xs) => xs.filter((y) => y.id !== open.id)); setOpenId(null) }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function ProspectSheet({ p, templates, onPatch, onDelete, onClose }: {
  p: Prospect
  templates: EmailTemplate[]
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
  const [angle, setAngle] = useState(p.angle || '')
  const [response, setResponse] = useState(p.response || '')
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

          <section>
            <span className={LABEL}>Mercado</span>
            <div className="flex gap-1.5">
              {REGIONS.map((x) => (
                <button
                  key={x.id}
                  onClick={() => onPatch({ region: p.region === x.id ? undefined : x.id })}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${p.region === x.id ? 'border-accent bg-surface text-ink font-medium' : 'border-line text-ink-60 hover:border-input hover:text-ink'}`}
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

          <EmailComposer p={p} templates={templates} onPatch={onPatch} />

          <section>
            <span className={LABEL}>Por qué los elegimos</span>
            <textarea
              className={`${INPUT} min-h-[8rem] leading-relaxed`}
              value={reasons}
              placeholder={'Un motivo por línea:\nAcaban de levantar 14,7 M€\nLa web es muy floja\nConocemos a alguien dentro'}
              onChange={(e) => setReasons(e.target.value)}
              onBlur={() => onPatch({ reasons: lines(reasons) })}
            />
          </section>

          <section>
            <span className={LABEL}>Ángulo del rediseño</span>
            <textarea
              className={`${INPUT} min-h-[4.5rem] leading-relaxed`}
              value={angle}
              placeholder="Qué contaría la home nueva: «la vía por capas que se encienden», «el robot que obedece a una frase»…"
              onChange={(e) => setAngle(e.target.value)}
              onBlur={() => onPatch({ angle: angle.trim() || undefined })}
            />
          </section>

          <section>
            <span className={LABEL}>Qué respondieron</span>
            <textarea
              className={`${INPUT} min-h-[4.5rem] leading-relaxed`}
              value={response}
              placeholder="Cuando contesten: «están contentos con su proveedor», «les encanta, hablamos el martes»…"
              onChange={(e) => setResponse(e.target.value)}
              onBlur={() => onPatch({ response: response.trim() || undefined })}
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
            <textarea className={`${INPUT} min-h-[6rem] leading-relaxed`} value={notes} placeholder="Ideas, cómo entrar, vínculos…" onChange={(e) => setNotes(e.target.value)} onBlur={() => onPatch({ notes: notes.trim() || undefined })} />
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

/** El email a este prospecto: datos que rellenan la plantilla y el texto listo para copiar */
function EmailComposer({ p, templates, onPatch }: { p: Prospect; templates: EmailTemplate[]; onPatch: (x: Partial<Prospect>) => void }) {
  const { user } = useAuth()
  const sender = myName(user?.displayName, user?.email) === 'Andoni'
    ? { name: 'Andoni Martínez', email: 'andoni@savvia.studio' }
    : { name: 'Eric Ruiz Molero', email: 'ericruizmolero@savvia.studio' }
  const [email, setEmail] = useState(p.email || '')
  const [link, setLink] = useState(p.proposalUrl || '')
  const [hook, setHook] = useState(p.hook || '')
  const pick = templates.find((t) => t.region === p.region) || templates[0]
  const [tplId, setTplId] = useState(pick?.id || '')
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null)
  const tpl = templates.find((t) => t.id === tplId) || pick
  const filled = tpl ? fillTemplate(tpl, prospectVars({ ...p, hook, proposalUrl: link || undefined })) : null

  async function copy(what: 'subject' | 'body', text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <section className="rounded-lg border border-line p-4 space-y-3">
      <span className={`${LABEL} flex items-center gap-1.5`}><Mail size={11} strokeWidth={1.75} />Email</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={INPUT} value={email} placeholder="Email del contacto" onChange={(e) => setEmail(e.target.value)} onBlur={() => onPatch({ email: email.trim() || undefined })} />
        <input className={INPUT} value={link} placeholder="Enlace de la propuesta" onChange={(e) => setLink(e.target.value)} onBlur={() => onPatch({ proposalUrl: link.trim() || undefined })} />
      </div>
      <textarea
        className={`${INPUT} min-h-[3.5rem] leading-relaxed`}
        value={hook}
        placeholder="Gancho: «Zorionak por el proyecto y todo lo que estáis construyendo con IZAR.» o «Alfonso Rubio me ha recomendado hablar contigo.»"
        onChange={(e) => setHook(e.target.value)}
        onBlur={() => onPatch({ hook: hook.trim() || undefined })}
      />
      {templates.length > 1 && (
        <select className={INPUT} value={tpl?.id} onChange={(e) => setTplId(e.target.value)} aria-label="Plantilla">
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      {filled ? (
        <>
          <div className="rounded-xl border border-line bg-paper overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.08)]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div className="flex gap-1.5 px-3.5 py-2.5 bg-surface border-b border-line" aria-hidden="true">
              {[0, 1, 2].map((i) => <span key={i} className="w-2.5 h-2.5 rounded-full bg-line" />)}
            </div>
            <dl className="grid grid-cols-[4rem_minmax(0,1fr)] gap-y-1.5 px-5 py-4 border-b border-line text-[13px]">
              <dt className="text-ink-60">De</dt>
              <dd className="text-ink truncate">{sender.name} &lt;{sender.email}&gt;</dd>
              <dt className="text-ink-60">Para</dt>
              <dd className="text-ink truncate">{(() => {
                const who = firstName(p.contact) ? p.contact?.split(/[,·(]/)[0].trim() : ''
                const to = email || p.email
                if (!who && !to) return <span className="text-ink-40">Sin destinatario</span>
                return who && to ? `${who} <${to}>` : who || to
              })()}</dd>
              <dt className="text-ink-60">Asunto</dt>
              <dd className="text-ink font-bold">{filled.subject}</dd>
            </dl>
            <div className="px-5 py-5 text-[13px] leading-relaxed text-ink">
              <p className="whitespace-pre-wrap">{filled.body}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/firma-trazos.png" alt="" className="mt-4 h-11 w-auto" />
              <p className="mt-1">{sender.name}</p>
              <a href="https://savvia.studio" target="_blank" rel="noreferrer" className="underline underline-offset-2">savvia.studio</a>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink-40">{filled.missing.length ? `Falta: ${filled.missing.join(', ')}` : 'La firma la pone Gmail; copia solo asunto y texto.'}</span>
            <span className="flex gap-2">
              <button onClick={() => copy('subject', filled.subject)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-line rounded-md text-ink-60 hover:text-ink hover:border-input">
                {copied === 'subject' ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.75} />}Asunto
              </button>
              <button onClick={() => copy('body', filled.body)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover">
                {copied === 'body' ? <><Check size={12} strokeWidth={2} />Copiado</> : <><Copy size={12} strokeWidth={1.75} />Copiar texto</>}
              </button>
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs text-ink-40">No hay plantillas. Crea una abajo, en Plantillas de email.</p>
      )}
    </section>
  )
}

/** Plantillas de email editables; se guardan solas y las usa también el conector de Claude */
function TemplatesSection({ companyId, templates }: { companyId: string; templates: EmailTemplate[] }) {
  const [show, setShow] = useState(false)
  const [draft, setDraft] = useState<EmailTemplate[]>(templates)
  const [saved, setSaved] = useState(false)
  const editing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { if (!editing.current) setDraft(templates) }, [templates])

  function change(next: EmailTemplate[]) {
    editing.current = true
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await saveEmailTemplates(companyId, next)
      editing.current = false
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 800)
  }
  const set = (id: string, x: Partial<EmailTemplate>) => change(draft.map((t) => (t.id === id ? { ...t, ...x } : t)))

  return (
    <section className="mt-12 pt-6 border-t border-line">
      <button onClick={() => setShow((v) => !v)} aria-expanded={show} className="flex items-baseline gap-2 text-left">
        <ChevronRight size={12} strokeWidth={2} className={`self-center text-ink-40 transition-transform ${show ? 'rotate-90' : ''}`} />
        <h2 className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink">Plantillas de email</h2>
        <span className="text-[10px] text-ink-40 tabular-nums">{draft.length}</span>
        <span className="text-xs text-ink-40">{saved ? 'Guardado' : 'El email tipo para tocar la puerta. Claude las usa desde el conector.'}</span>
      </button>
      {show && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-ink-40">
            Huecos: {PLACEHOLDERS.map((x) => <span key={x.key} title={x.hint} className="mr-2 font-mono text-ink-60">{`{${x.key}}`}</span>)}
            Si un hueco está solo en su línea y el prospecto no lo tiene, la línea desaparece.
          </p>
          {draft.map((t) => (
            <div key={t.id} className="border border-line rounded-md bg-paper p-4 space-y-2">
              <div className="flex items-center gap-2">
                <input className={`${INPUT} font-medium`} value={t.name} onChange={(e) => set(t.id, { name: e.target.value })} aria-label="Nombre de la plantilla" />
                <select className="text-xs text-ink-60 bg-transparent border border-line rounded px-1.5 py-2" value={t.region || ''} onChange={(e) => set(t.id, { region: (e.target.value || undefined) as EmailTemplate['region'] })} aria-label="Mercado">
                  <option value="">Cualquier mercado</option>
                  <option value="es">España</option>
                  <option value="us">EE. UU.</option>
                </select>
                <button onClick={() => change(draft.filter((x) => x.id !== t.id))} className="p-2 rounded-md text-ink-40 hover:text-[#B91C1C]" title="Borrar plantilla"><Trash2 size={13} strokeWidth={1.5} /></button>
              </div>
              <input className={INPUT} value={t.subject} onChange={(e) => set(t.id, { subject: e.target.value })} placeholder="Asunto" aria-label="Asunto" />
              <textarea className={`${INPUT} min-h-[16rem] leading-relaxed`} value={t.body} onChange={(e) => set(t.id, { body: e.target.value })} aria-label="Cuerpo" />
            </div>
          ))}
          <button
            onClick={() => change([...draft, { id: Math.random().toString(36).slice(2, 8), name: 'Nueva plantilla', subject: '', body: '' }])}
            className="flex items-center gap-1.5 text-sm text-ink-60 hover:text-ink"
          >
            <Plus size={14} strokeWidth={1.75} />Añadir plantilla
          </button>
        </div>
      )}
    </section>
  )
}

interface Contact { name: string; email: string; source?: string; since?: string; lastSeen?: string; quotes?: string[] }

/** Gente con la que ya hemos tenido contacto (p. ej. quienes probaron la app en beta): solo consulta */
function ContactsSection({ companyId }: { companyId: string }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'contacts', companyId))
      .then((snap) => setContacts(snap.exists() ? ((snap.data().items as Contact[]) ?? []) : []))
      .catch(() => setContacts([]))
  }, [companyId])

  if (!contacts?.length) return null
  return (
    <section className="mt-12 pt-6 border-t border-line">
      <button onClick={() => setShow((v) => !v)} aria-expanded={show} className="flex items-baseline gap-2 text-left">
        <ChevronRight size={12} strokeWidth={2} className={`self-center text-ink-40 transition-transform ${show ? 'rotate-90' : ''}`} />
        <h2 className="text-[10px] font-medium tracking-[0.18em] uppercase text-ink">Contactos</h2>
        <span className="text-[10px] text-ink-40 tabular-nums">{contacts.length}</span>
        <span className="text-xs text-ink-40">· Gente que ya nos conoce (probaron la app de presupuestos)</span>
      </button>
      {show && (
        <div className="mt-3 border border-line rounded-md bg-paper divide-y divide-line">
          {contacts.map((c) => (
            <div key={c.email} className="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
              <span className="font-medium text-ink truncate">{c.name || '—'}</span>
              <a href={`mailto:${c.email}`} className="text-ink-60 underline decoration-line underline-offset-2 hover:text-ink truncate">{c.email}</a>
              <span className="text-xs text-ink-40 md:text-right">
                {c.quotes?.length ? `${c.quotes.length} presupuesto${c.quotes.length === 1 ? '' : 's'} · ` : ''}
                {c.since ? `desde ${fmtDay(c.since)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
