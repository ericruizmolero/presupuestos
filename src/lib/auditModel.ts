/** Auditorías web que entregamos al cliente por enlace (/auditoria/<slug>). Sin Firebase: se usa en cliente y en el MCP. */

/** Algo que cambiaríamos de su web, agrupado por la zona de la página (Hero, Testimonios…) */
export interface AuditFinding {
  id: string
  section: string        // zona de la web: "Hero", "Testimonios"…
  title: string          // la idea en una línea
  body: string           // el porqué y qué haríamos
  image?: string         // captura de su web
  keep?: boolean         // true = algo que funciona y conservaríamos
  refs?: string[]        // ids de referencias relacionadas
}

/** Una web o imagen en la que nos inspiraríamos (o que evitaríamos) */
export interface AuditReference {
  id: string
  name: string
  url?: string
  image?: string
  notes: string[]        // lo que hemos destacado de ella
  tags?: string[]
  avoid?: boolean        // true = lo que NO haríamos
}

/** Lo que sacamos según las horas que contrate */
export interface AuditPlan {
  id: string
  hours: number
  title: string
  summary?: string
  items: string[]
  price?: number         // sin IVA; si no hay, no se muestra
  recommended?: boolean
}

export interface Audit {
  id: string
  slug: string
  companyId: string
  title: string
  clientName?: string
  clientCompany?: string
  siteUrl?: string
  intro?: string
  summary?: string[]     // lo esencial en pocas líneas, arriba del todo
  findings: AuditFinding[]
  references: AuditReference[]
  plans: AuditPlan[]
  plansIntro?: string
  closing?: string
  language?: 'es' | 'en'
  createdAt?: unknown
  updatedAt?: unknown
}

export function auditSlug(name: string, n = 1) {
  const base = (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'auditoria'
  return n > 1 ? `${base}-${n}` : base
}

/** Zonas en el orden en que aparecen los hallazgos */
export function findingGroups(findings: AuditFinding[]): Array<{ section: string; items: AuditFinding[] }> {
  const out: Array<{ section: string; items: AuditFinding[] }> = []
  for (const f of findings) {
    const g = out.find((x) => x.section === f.section)
    if (g) g.items.push(f)
    else out.push({ section: f.section, items: [f] })
  }
  return out
}

export function hostOf(url?: string) {
  if (!url) return ''
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
