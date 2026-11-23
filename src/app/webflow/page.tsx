'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AlertTriangle, Copy, ExternalLink, Pause, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'

const LABEL = 'text-[10px] font-medium tracking-[0.16em] uppercase text-ink-40'
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
  refreshedAt?: number
  toolCount?: number
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

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '')
const who = (email?: string) => (email ? (email.startsWith('andoni') ? 'Andoni' : 'Eric') : '')

/** "hace 3 h", "hace 2 días"… */
function ago(v?: string | number): string {
  if (!v) return ''
  const ms = Date.now() - (typeof v === 'number' ? v : new Date(v).getTime())
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return day(new Date(Date.now() - ms).toISOString())
}

// ── Estado ───────────────────────────────────────────────────────────────────
type Health = 'activa' | 'revisar' | 'caducada' | 'pausada'
const STALE_MS = 36 * 3600_000 // el cron renueva a diario: más de 36 h sin renovar es raro

function healthOf(c: Connection): Health {
  if (c.status === 'caducada') return 'caducada'
  if (!c.active) return 'pausada'
  const last = c.refreshedAt ?? (c.connectedAt ? new Date(c.connectedAt).getTime() : 0)
  if (last && Date.now() - last > STALE_MS) return 'revisar'
  return 'activa'
}

const HEALTH: Record<Health, { label: string; color: string; hint: string }> = {
  activa: { label: 'Activa', color: '#16A34A', hint: 'Claude puede usarla. El token se renueva solo.' },
  revisar: { label: 'Revisar', color: '#D97706', hint: 'Lleva más de un día sin renovarse. Debería hacerlo sola; si sigue así, reconéctala.' },
  caducada: { label: 'Caducada', color: '#B91C1C', hint: 'Webflow ya no acepta su autorización. Hay que reconectarla.' },
  pausada: { label: 'Pausada', color: '#8A8580', hint: 'Desactivada para Claude. Sigue conectada.' },
}

function StatusBadge({ h }: { h: Health }) {
  const { label, color, hint } = HEALTH[h]
  return (
    <span
      title={hint}
      className="inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{ color, background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}29` }}
    >
      {h === 'activa' ? (
        // señal: punto con halo que respira
        <span className="relative flex w-3.5 h-3.5 items-center justify-center">
          <span className="absolute inset-0 rounded-full animate-ping opacity-30 [animation-duration:2.4s]" style={{ background: color }} />
          <span className="absolute inset-[3px] rounded-full opacity-25" style={{ background: color }} />
          <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        </span>
      ) : h === 'pausada' ? (
        <Pause size={11} strokeWidth={2.25} className="mx-[1.5px]" />
      ) : (
        <AlertTriangle size={11} strokeWidth={2.25} className="mx-[1.5px]" />
      )}
      {label}
    </span>
  )
}

export default function WebflowPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <Webflow />
      </DashboardLayout>
    </AuthGuard>
  )
}

type Filter = 'todas' | 'atencion' | 'pausadas'

function Webflow() {
  const [list, setList] = useState<Connection[] | null>(null)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('todas')

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
      setMsg({ text: 'Enlace copiado. Ábrelo en una ventana privada, entra con la cuenta de Webflow que toque y autoriza. Caduca en 15 minutos.' })
    }
    if (!body.connectionId) setName('')
  }

  const stats = useMemo(() => {
    const l = list || []
    const hs = l.map(healthOf)
    const last = Math.max(0, ...l.map((c) => c.refreshedAt || 0))
    return {
      total: l.length,
      activas: hs.filter((h) => h === 'activa').length,
      atencion: hs.filter((h) => h === 'caducada' || h === 'revisar').length,
      pausadas: hs.filter((h) => h === 'pausada').length,
      last,
    }
  }, [list])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (list || []).filter((c) => {
      const h = healthOf(c)
      if (filter === 'atencion' && h !== 'caducada' && h !== 'revisar') return false
      if (filter === 'pausadas' && h !== 'pausada') return false
      if (!needle) return true
      return [c.name, c.workspace, ...(c.sites || [])].some((s) => s?.toLowerCase().includes(needle))
    })
  }, [list, q, filter])

  const showAdd = adding || (list !== null && !list.length)

  return (
    <div className="px-8 py-12 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-ink mb-2">Webflow MCP</h1>
          <p className="text-sm text-ink-60 max-w-xl">
            Cuentas y espacios de Webflow conectados a la vez. Claude los usa desde el conector de Savvia indicando la cuenta, sin desconectar ni volver a autorizar.
          </p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-md bg-accent text-on-accent hover:bg-accent-hover"
          >
            <Plus size={14} strokeWidth={2} />Conectar espacio
          </button>
        )}
      </div>

      {showAdd && (
        <section className="mb-8 rounded-lg border border-line p-5">
          <div className="flex items-center justify-between mb-3">
            <span className={LABEL}>Conectar espacio</span>
            {list !== null && list.length > 0 && (
              <button onClick={() => setAdding(false)} aria-label="Cerrar" className="p-1 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover">
                <X size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
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
        </section>
      )}

      {msg && <p className={`mb-6 text-xs ${msg.error ? 'text-[#B91C1C]' : 'text-ink'}`}>{msg.text}</p>}

      {list === null ? (
        <p className="text-sm text-ink-40">Cargando…</p>
      ) : list.length > 0 && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg border border-line bg-line overflow-hidden mb-6">
            <Stat label="Cuentas" value={stats.total} />
            <Stat label="Activas" value={stats.activas} color="#16A34A" />
            <Stat label="Necesitan atención" value={stats.atencion} color={stats.atencion ? '#B91C1C' : undefined} />
            <Stat label="Última renovación" value={stats.last ? ago(stats.last) : 'Aún no'} small />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="relative">
              <Search size={13} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cuenta o sitio"
                className="h-8 w-56 pl-8 pr-3 rounded-md border border-line bg-paper text-[13px] text-ink placeholder-ink-40 focus:outline-none focus:border-input"
              />
            </div>
            <div className="inline-flex h-8 rounded-md border border-line bg-paper p-0.5 text-xs">
              {([['todas', `Todas ${stats.total}`], ['atencion', `Atención ${stats.atencion}`], ['pausadas', `Pausadas ${stats.pausadas}`]] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-2.5 rounded-[5px] transition-colors ${filter === k ? 'bg-surface text-ink font-medium' : 'text-ink-60 hover:text-ink'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-lg border border-line overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_7rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem_6.5rem] gap-4 px-4 py-2.5 border-b border-line bg-surface">
              {['Cuenta', 'Estado', 'Token', 'Último uso', 'Conectada', 'Claude', ''].map((h, i) => (
                <span key={i} className={`${LABEL} ${i === 5 ? 'text-center' : ''}`}>{h}</span>
              ))}
            </div>
            {shown.length ? (
              <ul className="divide-y divide-line">
                {shown.map((c) => (
                  <Row key={c.id} c={c} reload={load} onError={(t) => setMsg({ text: t, error: true })} reconnect={(m) => connect(m, { connectionId: c.id })} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-ink-40">Ninguna cuenta coincide.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-40">
            Los tokens se renuevan solos al usarse y una vez al día. Pasa el ratón por el estado para ver qué significa.
          </p>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color, small }: { label: string; value: string | number; color?: string; small?: boolean }) {
  return (
    <div className="bg-paper px-4 py-3.5">
      <span className={`${LABEL} block mb-1.5`}>{label}</span>
      <span className={`${small ? 'text-base' : 'text-2xl'} font-medium tracking-tight tabular-nums text-ink`} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  )
}

function Row({ c, reload, onError, reconnect }: { c: Connection; reload: () => void; onError: (t: string) => void; reconnect: (m: 'open' | 'copy') => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(c.name)
  const cancelled = useRef(false)
  const h = healthOf(c)

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

  const sites = c.sites || []
  const siteText = sites.length > 2 ? `${sites.slice(0, 2).join(', ')} y ${sites.length - 2} más` : sites.join(', ')
  const needsFix = h === 'caducada' || h === 'revisar'

  return (
    <li className="group grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2.2fr)_7rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem_6.5rem] gap-x-4 gap-y-2 items-center px-4 py-3 hover:bg-surface/60 transition-colors">
      {/* Cuenta */}
      <div className="min-w-0">
        {editing ? (
          <input
            autoFocus
            className="w-full text-sm font-medium text-ink border-b border-input focus:outline-none bg-transparent"
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
          <button
            onClick={() => { setVal(c.name); setEditing(true) }}
            className={`block max-w-full truncate text-left text-sm font-medium hover:underline underline-offset-4 decoration-line ${c.active ? 'text-ink' : 'text-ink-60'}`}
            title="Renombrar"
          >
            {c.name}
          </button>
        )}
        <p className="text-xs text-ink-60 truncate" title={sites.join(', ')}>
          {siteText || <span className="text-ink-40">Sin sitios leídos</span>}
          {c.toolCount ? <span className="text-ink-40">{`, ${c.toolCount} herramientas`}</span> : null}
        </p>
      </div>

      {/* Estado */}
      <div className="justify-self-end md:justify-self-start">
        <StatusBadge h={h} />
      </div>

      {/* Token */}
      <Cell label="Token">
        {h === 'caducada' ? (
          <span className="text-[#B91C1C]">No se pudo renovar</span>
        ) : c.refreshedAt ? (
          <span title={new Date(c.refreshedAt).toLocaleString('es-ES')}>Renovado {ago(c.refreshedAt)}</span>
        ) : (
          <span className="text-ink-40">Sin renovar aún</span>
        )}
      </Cell>

      {/* Último uso */}
      <Cell label="Último uso">
        {c.lastUsedAt ? <span title={new Date(c.lastUsedAt).toLocaleString('es-ES')}>{ago(c.lastUsedAt)}</span> : <span className="text-ink-40">Sin usar</span>}
      </Cell>

      {/* Conectada */}
      <Cell label="Conectada">
        {c.connectedAt ? `${day(c.connectedAt)}${c.connectedBy ? `, ${who(c.connectedBy)}` : ''}` : ''}
      </Cell>

      {/* Claude */}
      <div className="flex md:justify-center items-center gap-2">
        <span className="md:hidden text-xs text-ink-60">Claude</span>
        <button
          role="switch"
          aria-checked={c.active}
          aria-label={c.active ? 'Pausar para Claude' : 'Activar para Claude'}
          title={c.active ? 'Claude puede usarla. Pulsa para pausar.' : 'Pausada para Claude. Pulsa para activar.'}
          onClick={() => patch({ active: !c.active })}
          className={`relative w-8 h-[18px] rounded-full transition-colors ${c.active ? 'bg-accent' : 'bg-line'}`}
        >
          <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-paper shadow transition-all ${c.active ? 'left-[16px]' : 'left-[2px]'}`} />
        </button>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-0.5">
        {needsFix ? (
          <button
            onClick={() => reconnect('open')}
            className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium bg-accent text-on-accent hover:bg-accent-hover"
          >
            <RefreshCw size={11} strokeWidth={2} />Reconectar
          </button>
        ) : (
          <button onClick={() => reconnect('open')} title="Reconectar" aria-label="Reconectar" className="p-1.5 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <RefreshCw size={14} strokeWidth={1.75} />
          </button>
        )}
        <button onClick={() => reconnect('copy')} title="Copiar enlace para reconectar en una ventana privada" aria-label="Copiar enlace de reconexión" className="p-1.5 rounded-md text-ink-40 hover:text-ink hover:bg-surface-hover md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
          <ExternalLink size={14} strokeWidth={1.75} />
        </button>
        <button onClick={remove} title="Eliminar" aria-label="Eliminar" className="p-1.5 rounded-md text-ink-40 hover:text-[#B91C1C] hover:bg-surface-hover md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </li>
  )
}

/** Celda con su etiqueta visible solo en móvil (en escritorio la pone la cabecera) */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="col-span-2 md:col-span-1 flex md:block items-baseline gap-2 text-xs text-ink-60 min-w-0 truncate">
      <span className="md:hidden text-ink-40 w-20 shrink-0">{label}</span>
      {children}
    </div>
  )
}
