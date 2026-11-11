/** Plantillas de email para prospección (sin Firebase: lo usan la app y el conector MCP). */

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  region?: 'es' | 'us'
}

export const PLACEHOLDERS: Array<{ key: string; hint: string }> = [
  { key: 'nombre', hint: 'Nombre de pila del contacto' },
  { key: 'empresa', hint: 'Nombre de la empresa' },
  { key: 'enlace', hint: 'Enlace a la propuesta' },
  { key: 'gancho', hint: 'Frase personal: enhorabuena por la ronda, quién nos recomendó…' },
]

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'rediseno-es',
    name: 'Rediseño a ciegas',
    region: 'es',
    subject: 'Propuesta web para {empresa} | Savvia',
    body: `Buenos días {nombre},

Soy Eric, llevo Savvia, un estudio de diseño web de Donosti.

{gancho}

Creíamos que la web podía contar mucho mejor lo que hacéis y nos hemos aventurado a trabajar sobre ella a ciegas. Hemos preparado esta propuesta borrador para vosotros: {enlace}

Si os gusta, podemos seguir hablando.

¡Muchas gracias!

Un abrazo,`,
  },
]

/** "Aritz Lazkoz, CEO y cofundador · info@…" → "Aritz" */
export function firstName(contact?: string): string {
  if (!contact) return ''
  const who = contact.split(/[,·(@]/)[0].trim()
  if (/^(responsable|director|head|ceo|cmo)\b/i.test(who)) return ''
  return who.split(/\s+/)[0] || ''
}

/** Enlace de la propuesta: el guardado o, si no, el primer enlace a una web nuestra */
export function proposalLink(p: { proposalUrl?: string; links?: string[] }): string {
  if (p.proposalUrl) return p.proposalUrl
  return (p.links || []).find((l) => /savvia\.studio|treseiscero\.app/.test(l)) || ''
}

export function prospectVars(p: { name: string; contact?: string; hook?: string; proposalUrl?: string; links?: string[] }): Record<string, string> {
  return { nombre: firstName(p.contact), empresa: p.name, enlace: proposalLink(p), gancho: p.hook || '' }
}

/** Rellena la plantilla. Un hueco vacío que ocupa una línea entera desaparece; uno vacío dentro de una frase se queda como {hueco} y sale en missing. */
export function fillTemplate(t: Pick<EmailTemplate, 'subject' | 'body'>, vars: Record<string, string>) {
  const missing = new Set<string>()
  const fill = (s: string) =>
    s
      .split('\n')
      .filter((line) => {
        const m = line.trim().match(/^\{(\w+)\}$/)
        return !(m && !(vars[m[1]] || '').trim())
      })
      .map((line) =>
        line.replace(/\{(\w+)\}/g, (all, k: string) => {
          const v = (vars[k] || '').trim()
          if (!v) { missing.add(k); return all }
          return v
        }),
      )
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  return { subject: fill(t.subject), body: fill(t.body), missing: [...missing] }
}
