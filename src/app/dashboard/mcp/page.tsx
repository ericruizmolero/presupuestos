'use client'

import { useState } from 'react'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Check, Copy } from 'lucide-react'

const LABEL = 'text-[10px] font-medium tracking-[0.18em] uppercase text-ink-40'

/** Qué puede hacer Claude con el conector, agrupado por sección de la app */
const TOOLS: Array<{ area: string; items: string[]; example: string }> = [
  {
    area: 'Presupuestos',
    items: ['Crear uno nuevo a partir de la reunión (siempre en borrador)', 'Leer y editar los existentes', 'Usar otro como plantilla', 'El editor abierto avisa para cargar los cambios'],
    example: '“Reunión con Acme: quieren rediseño de la home, 6 semanas, 9.000 €. Prepárame el presupuesto”',
  },
  {
    area: 'Cuestionarios',
    items: ['Crear uno para un cliente (plantilla de auditoría web)', 'Ver qué ha respondido', 'Usar las respuestas para la auditoría o el presupuesto'],
    example: '“¿Qué ha respondido Nacho en el cuestionario?”',
  },
  {
    area: 'Horas',
    items: ['Listar proyectos y ver registros', 'Apuntar, editar y borrar horas', 'Crear bolsas de horas', 'Resumen de la semana'],
    example: '“Apúntame 2 h de hoy en Vidflare”',
  },
  {
    area: 'Proyectos',
    items: ['Ver el tablero y las novedades', 'Añadir, editar, asignar y quitar notas', 'Crear y mover proyectos, estado y responsable'],
    example: '“¿En qué estamos con Kymatio?”',
  },
  {
    area: 'Prospección',
    items: ['Ver la lista por etapas', 'Añadir candidatos al Prospect agent', 'Mover de etapa y apuntar respuestas'],
    example: '“Busca 5 startups vascas con ronda reciente”',
  },
  {
    area: 'Facturación',
    items: ['Resumen de Holded', 'Ver facturas', 'Preparar el cierre de mes', 'Crear borradores (nunca emite)'],
    example: '“Prepara las facturas de noviembre”',
  },
]

export default function McpPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <McpContent />
      </DashboardLayout>
    </AuthGuard>
  )
}

function McpContent() {
  const [copied, setCopied] = useState<'url' | 'header' | 'error' | null>(null)

  async function copy(what: 'url' | 'header') {
    try {
      const { auth } = await import('@/lib/firebase')
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('sin sesión')
      const res = await fetch('/api/mcp-url', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      await navigator.clipboard.writeText(what === 'url' ? data.url : data.header)
      setCopied(what)
    } catch (err) {
      console.error('[conector] Error obteniendo la conexión:', err)
      setCopied('error')
    } finally {
      setTimeout(() => setCopied(null), 2500)
    }
  }

  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors'
  const label = (what: 'url' | 'header', text: string) =>
    copied === what ? <><Check size={14} strokeWidth={2} />Copiado</> : copied === 'error' ? 'Error, reintenta' : <><Copy size={14} strokeWidth={1.75} />{text}</>

  return (
    <div className="px-6 lg:px-8 py-8 max-w-3xl">
      <h1 className="text-2xl font-medium tracking-tight text-ink mb-2">MCP</h1>
      <p className="text-sm text-ink-60 mb-10 max-w-2xl leading-relaxed">
        Conecta Claude con la app para trabajar hablando, desde el móvil o el ordenador, sin abrirla:
        horas, tablero de proyectos, prospección y facturación.
      </p>

      <section className="border border-line rounded-md bg-paper p-5 mb-10">
        <span className={`${LABEL} block mb-4`}>Conectar en claude.ai</span>
        <ol className="space-y-4 text-sm text-ink-60 leading-relaxed">
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)]">
            <span className="text-ink-40 tabular-nums">1</span>
            <span>En <span className="text-ink">claude.ai → Ajustes → Conectores</span>, quita el conector antiguo si lo tienes y pulsa <span className="text-ink">Añadir conector personalizado</span>. Nombre: <span className="text-ink">Savvia</span>.</span>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)]">
            <span className="text-ink-40 tabular-nums">2</span>
            <span>
              <span className="block mb-2">Pega la URL del servidor:</span>
              <button onClick={() => copy('url')} className={`${btn} border border-line text-ink hover:bg-surface-hover`}>{label('url', 'Copiar URL')}</button>
            </span>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)]">
            <span className="text-ink-40 tabular-nums">3</span>
            <span>
              <span className="block mb-2">Autenticación: <span className="text-ink">Sin inicio de sesión</span>. En <span className="text-ink">Encabezados de solicitud → Añadir encabezado</span>, nombre <code className="px-1 py-px rounded bg-surface border border-line text-[13px] text-ink">x-api-key</code> y como valor la clave:</span>
              <button onClick={() => copy('header')} className={`${btn} bg-accent text-on-accent hover:bg-accent-hover`}>{label('header', 'Copiar clave')}</button>
              <span className="block mt-1.5 text-xs text-ink-40">La clave es la llave de vuestros datos: pégala solo ahí. claude.ai la guarda cifrada y no la vuelve a mostrar.</span>
            </span>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)]">
            <span className="text-ink-40 tabular-nums">4</span>
            <span>Guarda y, en un chat nuevo, activa el conector en el menú de herramientas. Si añadimos funciones nuevas, quítalo y vuelve a añadirlo para que Claude las vea.</span>
          </li>
        </ol>
      </section>

      <span className={`${LABEL} block mb-4`}>Qué puede hacer Claude</span>
      <div className="grid sm:grid-cols-2 gap-4">
        {TOOLS.map((t) => (
          <div key={t.area} className="border border-line rounded-md bg-paper p-4">
            <h2 className="text-sm font-medium text-ink mb-2">{t.area}</h2>
            <ul className="space-y-1 text-sm text-ink-60">
              {t.items.map((i) => (
                <li key={i} className="grid grid-cols-[0.75rem_minmax(0,1fr)]"><span className="text-ink-40">·</span><span>{i}</span></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-40 italic">{t.example}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-ink-40 leading-relaxed max-w-2xl">
        Si no dices lo contrario, apunta con la fecha de hoy y a nombre de “Eric y Andoni”. Las facturas solo se crean como borrador en Holded y tras tu OK.
      </p>
    </div>
  )
}
