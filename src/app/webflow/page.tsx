'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Copy, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'

const LABEL = 'text-[10px] font-medium tracking-[0.16em] uppercase text-ink-40 mb-2 block'
const INPUT = 'w-full px-3 py-2 border border-input rounded-md text-sm text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors'

interface Connection {
  id: string
  name: string
  workspace?: string
  sites?: string[]
  status: 'ok' | 'caducada'
  active: boolean
  connectedBy?: string
  connectedAt?: string
  lastUsedAt?: string
}

async function api(path: string, init: RequestInit = {}) {
  const { auth } = await import('@/lib/firebase')
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sin sesión')
  const res = await fetch(path, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const who = (email?: string) => (email ? (email.startsWith('andoni') ? 'Andoni' : 'Eric') : '')

export default function WebflowPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <Webflow />
      </DashboardLayout>
    </AuthGuard>
  )
}

function Webflow() {
  const [list, setList] = useState<Connection[] | null>(null)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api('/api/webflow/connections')
      setList(d.connections)
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'No se ha podido cargar', error: true })
      setList([])
    }
  }, [])

  useEffect(() => {
    load()
    const onMsg = (e: MessageEvent) => { if (e.data === 'webflow-connected') load() }
    window.addEventListener('message', onMsg)
    window.addEventListener('focus', load)
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('focus', load) }
  }, [load])

  async function connectUrl(body: { name?: string; connectionId?: string }): Promise<string | null> {
    setBusy(true)
    setMsg(null)
    try {
      const d = await api('/api/webflow/connect', { method: 'POST', body: JSON.stringify(body) })
      return d.url as string
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Error', error: true })
      return null
    } finally {
      setBusy(false)
    }
  }

  async function connect(mode: 'open' | 'copy', body: { name?: string; connectionId?: string }) {
    // la ventana se abre antes del await para que el navegador no la bloquee
    const win = mode === 'open' ? window.open('about:blank', 'webflow-oauth', 'width=560,height=760') : null
    const url = await connectUrl(body)
    if (!url) { win?.close(); return }
    if (win) {
      win.location.href = url
    } else {
      await navigator.clipboard.writeText(url)
      setMsg({ text: 'Enlace copiado. Ábrelo en una ventana privada, entra con la cuenta del cliente y autoriza. Caduca en 15 minutos.' })
    }
    if (!body.connectionId) setName('')
  }

  return (
    <div className="px-8 py-12 max-w-3xl">
      <h1 className="text-2xl font-medium tracking-tight text-ink mb-2">Webflow</h1>
      <p className="text-sm text-ink-60 mb-10 max-w-xl">
        Cuentas y espacios de Webflow conectados a la vez. Claude los usa desde el conector de Savvia indicando la cuenta, sin desconectar ni volver a autorizar.
      </p>

      <section className="mb-10 rounded-lg border border-line p-5">
        <span className={LABEL}>Conectar espacio</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${INPUT} max-w-[16rem]`}
            placeholder="Nombre corto: isotrol, cliente-x"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && connect('open', { name })}
          />
          <button
            disabled={busy || !name.trim()}
            onClick={() => connect('open', { name })}
            className="px-3.5 py-2 text-sm rounded-md bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-40"
          >
            Conectar
          </button>
          <button
            disabled={busy || !name.trim()}
            onClick={() => connect('copy', { name })}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm border border-line rounded-md text-ink-60 hover:text-ink hover:border-input disabled:opacity-40"
          >
            <Copy size={13} strokeWidth={1.75} />Copiar enlace
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-40 leading-relaxed">
          En Webflow eliges el espacio y autorizas. Se autoriza la cuenta de Webflow que tengas abierta en ese navegador: para la cuenta de un cliente, usa Copiar enlace y ábrelo en una ventana privada.
        </p>
        {msg && <p className={`mt-3 text-xs ${msg.error ? 'text-[#B91C1C]' : 'text-ink'}`}>{msg.text}</p>}
      </section>

      <span className={LABEL}>Conexiones</span>
      {list === null ? (
        <p className="text-sm text-ink-40">Cargando…</p>
      ) : !list.length ? (
        <p className="text-sm text-ink-40">Aún no hay ninguna.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {list.map((c) => (
            <Row key={c.id} c={c} reload={load} onError={(t) => setMsg({ text: t, error: true })} reconnect={(m) => connect(m, { connectionId: c.id })} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({ c, reload, onError, reconnect }: { c: Connection; reload: () => void; onError: (t: string) => void; reconnect: (m: 'open' | 'copy') => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(c.name)
  const cancelled = useRef(false)

  async function patch(body: object) {
    try {
      await api(`/api/webflow/connections/${c.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error')
    }
    reload()
  }

  async function remove() {
    if (!confirm(`¿Eliminar la conexión ${c.name}? Claude dejará de poder usarla y habría que volver a autorizarla.`)) return
    try { await api(`/api/webflow/connections/${c.id}`, { method: 'DELETE' }) } catch (e) { onError(e instanceof Error ? e.message : 'Error') }
    reload()
  }

  const expired = c.status === 'caducada'
  const where = [c.workspace, c.sites?.length ? c.sites.join(', ') : ''].filter(Boolean).join(', ')

  return (
    <li className={`py-4 flex items-start gap-4 ${c.active ? '' : 'opacity-60'}`}>
      <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: expired ? '#B91C1C' : '#16A34A' }} title={expired ? 'Caducada' : 'Conectada'} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            className="text-sm font-medium text-ink border-b border-input focus:outline-none bg-transparent"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') { cancelled.current = true; (e.target as HTMLInputElement).blur() }
            }}
            onBlur={() => {
              setEditing(false)
              if (cancelled.current) { cancelled.current = false; setVal(c.name); return }
              if (val.trim() && val.trim() !== c.name) patch({ name: val })
            }}
          />
        ) : (
          <button onClick={() => { setVal(c.name); setEditing(true) }} className="text-sm font-medium text-ink hover:underline underline-offset-4 decoration-line" title="Renombrar">
            {c.name}
          </button>
        )}
        {where && <p className="text-xs text-ink-60 mt-0.5 truncate">{where}</p>}
        <p className="text-xs text-ink-40 mt-0.5">
          {expired ? 'Caducada, hay que reconectar. ' : ''}
          {c.connectedAt && `Conectada el ${day(c.connectedAt)}${c.connectedBy ? ` por ${who(c.connectedBy)}` : ''}`}
          {c.lastUsedAt && `, último uso el ${day(c.lastUsedAt)}`}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <label className="flex items-center gap-2 mr-2 text-xs text-ink-60 cursor-pointer select-none" title="Si está apagado, Claude no puede usar esta cuenta">
          <span>Claude</span>
          <button
            role="switch"
            aria-checked={c.active}
            onClick={() => patch({ active: !c.active })}
            className={`relative w-8 h-[18px] rounded-full transition-colors ${c.active ? 'bg-accent' : 'bg-line'}`}
          >
            <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-paper shadow transition-all ${c.active ? 'left-[16px]' : 'left-[2px]'}`} />
          </button>
        </label>
        <button onClick={() => reconnect('open')} title="Reconectar" aria-label="Reconectar" className={`p-1.5 rounded-md hover:bg-surface-hover ${expired ? 'text-ink' : 'text-ink-40 hover:text-ink'}`}>
          <RefreshCw size={14} strokeWidth={1.75} />
        </button>
        <button onClick={() => reconnect('copy')} title="Copiar enlace para reconectar en una ventana privada" aria-label="Copiar enlace de reconexión" className="p-1.5 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover">
          <ExternalLink size={14} strokeWidth={1.75} />
        </button>
        <button onClick={remove} title="Eliminar" aria-label="Eliminar" className="p-1.5 rounded-md text-ink-40 hover:text-[#B91C1C] hover:bg-surface-hover">
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </li>
  )
}

