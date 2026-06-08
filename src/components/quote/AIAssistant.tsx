'use client'

import { useState } from 'react'
import { X, Copy, Check, ArrowRight, ArrowLeft, Loader, ExternalLink } from 'lucide-react'
import type { QuoteFormData } from '@/types/quote'

function uid() { return Math.random().toString(36).slice(2, 10) }
function withIds<T extends { id?: string }>(items: T[]): (T & { id: string })[] {
  return items.map((item) => ({ ...item, id: item.id || uid() }))
}

// ── Types ──────────────────────────────────────────────────────────────────────
export type AISection =
  | 'client' | 'project' | 'phases' | 'timeline'
  | 'budget' | 'budgetAdditional' | 'acceptance'
  | 'billing' | 'conformity' | 'all'

interface Question {
  key: string
  label: string
  placeholder?: string
  helper?: string
  type: 'text' | 'textarea' | 'url'
  optional?: boolean
  defaultValue?: string
}

interface SectionConfig {
  title: string
  description: string
  questions: Question[]
  buildPrompt: (answers: Record<string, string>, form: QuoteFormData) => string
  apply: (parsed: Record<string, unknown>, prev: QuoteFormData) => QuoteFormData
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const SCHEMA_HINT = `IMPORTANTE: Los campos de texto enriquecido deben contener HTML válido usando únicamente estas etiquetas: <p>, <ul>, <li>, <strong>, <em>. Responde ÚNICAMENTE con el JSON, sin explicaciones, sin bloques de código markdown.`

const PHASE_ICONS_HINT = `Para el campo "icon" de cada fase, elige el icono más representativo de esta lista (PascalCase exacto):
Search, Compass, Map, Eye, Target, Clipboard, Calendar, List, Layers, Layout, PenTool, Figma, Sliders, Grid, Code, Terminal, Cpu, GitBranch, Package, Server, Database, CheckCircle, Shield, Activity, Upload, Globe, Send, MessageSquare, Edit, FileText, BookOpen, Users, Tool, RefreshCw, BarChart, TrendingUp, Zap, Star, Award, Flag`

function linkedinLine(url: string) {
  return url
    ? `\n- LinkedIn de la empresa cliente: ${url}\n  → Visita esta URL, extrae información relevante (sector, descripción, tamaño, actividad reciente) y úsala para enriquecer el contenido.`
    : ''
}

// ── Section configs ────────────────────────────────────────────────────────────
const CONFIGS: Record<AISection, SectionConfig> = {

  client: {
    title: 'Empresa receptora / Cliente',
    description: 'Genera la ficha del cliente con descripción profesional.',
    questions: [
      { key: 'linkedin', label: 'LinkedIn de la empresa cliente', type: 'url', placeholder: 'https://linkedin.com/company/...', optional: true },
      { key: 'sector', label: 'Sector / industria', type: 'text', placeholder: 'Ej: e-commerce de moda, fintech, hostelería…' },
      { key: 'about', label: '¿A qué se dedica el cliente?', type: 'textarea', placeholder: 'Breve descripción de su actividad, productos o servicios…' },
    ],
    buildPrompt: (a, f) => `Eres un experto en redacción de presupuestos profesionales para agencias y freelances.

CONTEXTO:
- Empresa cliente: ${f.client.company || a.sector}${linkedinLine(a.linkedin)}
- Sector: ${a.sector}
- Actividad: ${a.about}

TAREA: Genera el contenido para la sección "Empresa receptora / Cliente" de un presupuesto profesional en castellano. La descripción debe ser concisa, profesional y contextualizar el cliente para el lector del presupuesto.

Responde ÚNICAMENTE con este JSON:
{
  "client": {
    "description": "<p>Descripción profesional de la empresa cliente en 2-3 párrafos.</p>"
  }
}

${SCHEMA_HINT}`,
    apply: (parsed, prev) => ({
      ...prev,
      client: { ...prev.client, ...(parsed.client as object) },
    }),
  },

  project: {
    title: 'Proyecto',
    description: 'Genera objetivo, modelo de colaboración y alcance.',
    questions: [
      { key: 'linkedin', label: 'LinkedIn de la empresa cliente', type: 'url', placeholder: 'https://linkedin.com/company/...', optional: true },
      { key: 'brief', label: '¿En qué consiste el proyecto?', type: 'textarea', placeholder: 'Describe el proyecto, qué se va a crear o resolver…' },
      { key: 'problem', label: '¿Qué problema resuelve?', type: 'textarea', placeholder: 'Necesidad del cliente o dolor que este proyecto soluciona…' },
      { key: 'model', label: 'Modelo de colaboración', type: 'text', placeholder: 'Ej: proyecto cerrado, retainer mensual, horas pactadas…', optional: true },
      { key: 'outOfScope', label: '¿Qué queda fuera del alcance?', type: 'text', placeholder: 'Ej: mantenimiento posterior, campañas de pago…', optional: true },
    ],
    buildPrompt: (a, f) => `Eres un experto en redacción de presupuestos profesionales.

CONTEXTO:
- Cliente: ${f.client.company || 'no especificado'}${linkedinLine(a.linkedin)}
- Proyecto: ${a.brief}
- Problema que resuelve: ${a.problem}
- Modelo de colaboración: ${a.model || 'no especificado'}
- Fuera de alcance: ${a.outOfScope || 'no especificado'}

TAREA: Genera el contenido para la sección "Proyecto" en castellano. Escribe de forma profesional, clara y orientada al cliente.

Responde ÚNICAMENTE con este JSON:
{
  "project": {
    "mainObjective": "<p>Objetivo principal del proyecto en 1-2 párrafos.</p>",
    "collaborationModel": "<p>Modelo de colaboración propuesto.</p>",
    "scope": "<p>Alcance del proyecto:</p><ul><li>Qué incluye</li><li>Qué no incluye</li></ul>"
  }
}

${SCHEMA_HINT}`,
    apply: (parsed, prev) => ({
      ...prev,
      project: {
        ...prev.project,
        ...(parsed.project as object),
        phases: prev.project.phases,
      },
    }),
  },

  phases: {
    title: 'Fases del proyecto',
    description: 'Genera las fases de trabajo con nombre y descripción.',
    questions: [
      { key: 'type', label: 'Tipo de proyecto', type: 'text', placeholder: 'Ej: desarrollo web, branding, app móvil, campaña…' },
      { key: 'brief', label: 'Descripción del proyecto', type: 'textarea', placeholder: 'Qué se va a construir o ejecutar…' },
      { key: 'numPhases', label: 'Número de fases aproximado', type: 'text', placeholder: 'Ej: 4-5' },
    ],
    buildPrompt: (a, f) => `Eres un experto en gestión de proyectos y redacción de presupuestos.

CONTEXTO:
- Cliente: ${f.client.company || 'no especificado'}
- Tipo de proyecto: ${a.type}
- Descripción: ${a.brief}
- Número de fases: ${a.numPhases}

TAREA: Genera las fases del proyecto en castellano. Cada fase debe tener un nombre claro, una descripción detallada de las tareas incluidas y un icono representativo.

${PHASE_ICONS_HINT}

Responde ÚNICAMENTE con este JSON:
{
  "phases": [
    { "name": "Nombre de la fase", "description": "<p>Descripción detallada de las tareas de esta fase.</p><ul><li>Tarea 1</li><li>Tarea 2</li></ul>", "order": 0, "icon": "Search" },
    { "name": "Nombre de la fase 2", "description": "<p>...</p>", "order": 1, "icon": "Code" }
  ]
}

${SCHEMA_HINT}`,
    apply: (parsed, prev) => ({
      ...prev,
      project: {
        ...prev.project,
        phases: (parsed.phases as QuoteFormData['project']['phases']) ?? prev.project.phases,
      },
    }),
  },

  timeline: {
    title: 'Tareas y tiempos',
    description: 'Genera el timeline con fechas de inicio y fin por fase.',
    questions: [
      { key: 'startDate', label: 'Fecha de inicio prevista', type: 'text', placeholder: 'Ej: 2026-06-01 o "principios de junio"' },
      { key: 'duration', label: 'Duración total estimada', type: 'text', placeholder: 'Ej: 3 meses, 6 semanas…' },
    ],
    buildPrompt: (a, f) => {
      const phases = f.project.phases
        .filter(p => p.name)
        .map(p => `{ "name": "${p.name}"${p.icon ? `, "icon": "${p.icon}"` : ''} }`)
        .join(', ') || 'no definidas aún'
      return `Eres un experto en planificación de proyectos.

CONTEXTO:
- Fases del proyecto: [${phases}]
- Fecha de inicio: ${a.startDate}
- Duración total: ${a.duration}

TAREA: Genera el timeline del proyecto en castellano. Distribuye las fases de forma lógica en el tiempo con fechas reales en formato YYYY-MM-DD. Usa EXACTAMENTE los nombres de fase del contexto. Copia también el "icon" de cada fase si está disponible.

Responde ÚNICAMENTE con este JSON:
{
  "timeline": [
    { "phase": "Nombre exacto de la fase", "icon": "IconName", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
  ]
}

${SCHEMA_HINT}`
    },
    apply: (parsed, prev) => ({
      ...prev,
      timeline: (parsed.timeline as QuoteFormData['timeline']) ?? prev.timeline,
    }),
  },

  budget: {
    title: 'Tabla de presupuesto',
    description: 'Genera los conceptos, tiempos y precios del presupuesto.',
    questions: [
      { key: 'service', label: 'Tipo de servicio', type: 'text', placeholder: 'Ej: diseño web, desarrollo, consultoría…' },
      { key: 'rate', label: 'Tarifa por hora (€)', type: 'text', placeholder: 'Ej: 80' },
      { key: 'deliverables', label: 'Entregables principales', type: 'textarea', placeholder: 'Lista de lo que se entrega al cliente…' },
      { key: 'taxRate', label: 'IVA (%)', type: 'text', placeholder: '21', optional: true },
    ],
    buildPrompt: (a, f) => {
      const phases = f.project.phases.map(p => p.name).filter(Boolean).join(', ') || 'no definidas'
      return `Eres un experto en presupuestación de proyectos digitales y creativos.

CONTEXTO:
- Tipo de servicio: ${a.service}
- Tarifa por hora: ${a.rate}€/h
- Fases del proyecto: ${phases}
- Entregables: ${a.deliverables}
- Moneda: ${f.currency}

TAREA: Genera los conceptos de la tabla de presupuesto en castellano. Cada ítem debe tener un concepto claro, estimación de tiempo y precio calculado con la tarifa indicada.

Responde ÚNICAMENTE con este JSON:
{
  "budgetTable": {
    "items": [
      { "concept": "Nombre del concepto", "time": "XXh", "price": 0, "notes": "nota opcional" }
    ],
    "taxRate": ${a.taxRate || 21}
  }
}

${SCHEMA_HINT}`
    },
    apply: (parsed, prev) => {
      const bt = parsed.budgetTable as Partial<QuoteFormData['budgetTable']>
      if (!bt) return prev
      const items = withIds(bt.items ?? prev.budgetTable.items)
      const subtotal = items.reduce((s, i) => s + (i.price || 0), 0)
      const taxRate = bt.taxRate ?? prev.budgetTable.taxRate
      const total = subtotal * (1 + taxRate / 100)
      return { ...prev, budgetTable: { items, subtotal, taxRate, total } }
    },
  },

  budgetAdditional: {
    title: 'Tabla adicional',
    description: 'Genera conceptos para la tabla de servicios adicionales.',
    questions: [
      { key: 'label', label: 'Título de la tabla', type: 'text', placeholder: 'Ej: Servicios adicionales, Opcionales…' },
      { key: 'description', label: '¿Qué incluye esta tabla?', type: 'textarea', placeholder: 'Ej: mantenimiento mensual, formación, hosting…' },
      { key: 'rate', label: 'Tarifa por hora (€)', type: 'text', placeholder: 'Ej: 80', optional: true },
    ],
    buildPrompt: (a) => `Eres un experto en presupuestación.

CONTEXTO:
- Título de la tabla: ${a.label}
- Contenido: ${a.description}
- Tarifa: ${a.rate || 'no especificada'}€/h

TAREA: Genera los conceptos de la tabla adicional en castellano.

Responde ÚNICAMENTE con este JSON:
{
  "budgetTableAdditional": {
    "label": "${a.label}",
    "items": [
      { "concept": "Concepto", "time": "XXh", "price": 0, "notes": "" }
    ]
  }
}

${SCHEMA_HINT}`,
    apply: (parsed, prev) => {
      const bt = parsed.budgetTableAdditional as Partial<QuoteFormData['budgetTableAdditional']>
      if (!bt) return prev
      const items = withIds(bt.items ?? prev.budgetTableAdditional.items)
      const subtotal = items.reduce((s, i) => s + (i.price || 0), 0)
      return {
        ...prev,
        budgetTableAdditional: {
          ...prev.budgetTableAdditional,
          enabled: true,
          label: bt.label ?? prev.budgetTableAdditional.label,
          items,
          subtotal,
          total: subtotal,
        },
      }
    },
  },

  acceptance: {
    title: 'Condiciones de aceptación',
    description: 'Genera las 6 cláusulas legales y de aceptación.',
    questions: [
      { key: 'payment', label: 'Forma de pago', type: 'text', placeholder: 'Ej: 50% inicio + 50% entrega, 3 cuotas…' },
      { key: 'service', label: 'Tipo de servicio / sector', type: 'text', placeholder: 'Ej: desarrollo web, diseño gráfico…' },
      { key: 'special', label: 'Condiciones especiales', type: 'textarea', placeholder: 'Penalizaciones, plazos de revisión, licencias…', optional: true },
    ],
    buildPrompt: (a, f) => `Eres un experto en redacción de contratos y presupuestos para agencias creativas y de tecnología.

CONTEXTO:
- Cliente: ${f.client.company || 'no especificado'}
- Servicio: ${a.service}
- Forma de pago acordada: ${a.payment}
- Condiciones especiales: ${a.special || 'ninguna'}

TAREA: Genera las condiciones de aceptación del presupuesto en castellano. Deben ser profesionales, claras y proteger a ambas partes.

Responde ÚNICAMENTE con este JSON:
{
  "acceptanceConditions": {
    "paymentTerms": "<p>Descripción detallada de la forma de pago.</p>",
    "acceptanceCriteria": "<p>Criterios para considerar el trabajo entregado y aceptado.</p>",
    "clientResponsibilities": "<ul><li>Responsabilidad del cliente 1</li><li>Responsabilidad 2</li></ul>",
    "penaltyClause": "<p>Cláusula de penalización por retrasos o incumplimientos.</p>",
    "annexes": "",
    "dataProtection": "<p>Cláusula de tratamiento de datos personales conforme al RGPD.</p>"
  }
}

${SCHEMA_HINT}`,
    apply: (parsed, prev) => ({
      ...prev,
      acceptanceConditions: {
        ...prev.acceptanceConditions,
        ...(parsed.acceptanceConditions as object),
      },
    }),
  },

  billing: {
    title: 'Condiciones de facturación',
    description: 'Genera las condiciones de facturación y pagos.',
    questions: [
      { key: 'model', label: 'Modelo de facturación', type: 'text', placeholder: 'Ej: por hitos, mensual, al finalizar…' },
      { key: 'details', label: 'Detalles adicionales', type: 'textarea', placeholder: 'Plazos de pago, penalizaciones por demora…', optional: true },
    ],
    buildPrompt: (a, f) => `Eres un experto en facturación para agencias y freelances.

CONTEXTO:
- Cliente: ${f.client.company || 'no especificado'}
- Modelo de facturación: ${a.model}
- Detalles: ${a.details || 'ninguno'}
- Moneda: ${f.currency}

TAREA: Genera las condiciones de facturación en castellano, de forma clara y profesional.

Responde ÚNICAMENTE con este JSON:
{
  "billingConditions": "<p>Condiciones de facturación detalladas.</p>"
}

${SCHEMA_HINT}`,
    apply: (parsed, prev) => ({
      ...prev,
      billingConditions: (parsed.billingConditions as string) ?? prev.billingConditions,
    }),
  },

  conformity: {
    title: 'Conformidad y firmas',
    description: 'Genera los bloques de datos para las firmas.',
    questions: [
      { key: 'emitterPerson', label: 'Nombre y cargo del firmante emisor', type: 'text', placeholder: 'Ej: Ana García, Directora de Proyectos' },
      { key: 'clientPerson', label: 'Nombre y cargo del firmante cliente', type: 'text', placeholder: 'Ej: Juan López, CEO' },
    ],
    buildPrompt: (a, f) => `Genera los bloques de conformidad para un presupuesto profesional en castellano.

CONTEXTO:
- Empresa emisora: ${f.emitter.companyName || 'no especificada'}
- Firmante emisor: ${a.emitterPerson}
- Empresa cliente: ${f.client.company || 'no especificada'}
- Firmante cliente: ${a.clientPerson}

Responde ÚNICAMENTE con este JSON:
{
  "conformity": {
    "emitterData": "<p><strong>${a.emitterPerson}</strong><br>${f.emitter.companyName || ''}</p>",
    "clientData": "<p><strong>${a.clientPerson}</strong><br>${f.client.company || ''}</p>"
  }
}

${SCHEMA_HINT}`,
    apply: (parsed, prev) => ({
      ...prev,
      conformity: {
        ...prev.conformity,
        ...(parsed.conformity as object),
      },
    }),
  },

  all: {
    title: 'Presupuesto completo',
    description: 'Genera todas las secciones del presupuesto de una vez.',
    questions: [
      {
        key: 'linkedin',
        label: 'LinkedIn de la empresa cliente',
        type: 'url',
        placeholder: 'https://linkedin.com/company/...',
        helper: 'La IA visitará este perfil para obtener descripción, sector y actividad del cliente.',
      },
      {
        key: 'projectBrief',
        label: 'Describe el proyecto',
        type: 'textarea',
        placeholder: 'Ej: Diseño y desarrollo web para e-commerce de moda. 3 meses, inicio junio. Entregables: diseño UI, front-end React, integración pasarela de pago.',
        helper: 'Cuanto más detalle des, mejor resultado. La IA inferirá fases, timeline y presupuesto a partir de aquí.',
      },
      {
        key: 'rate',
        label: 'Tarifa hora o presupuesto total',
        type: 'text',
        placeholder: 'Ej: 90€/h — o — Presupuesto cerrado 12.000€',
        optional: true,
        helper: 'Usado para calcular los precios de la tabla de presupuesto.',
      },
      {
        key: 'payment',
        label: 'Forma de pago',
        type: 'text',
        placeholder: 'Ej: 40% inicio, 30% mitad, 30% entrega',
        optional: true,
        defaultValue: '50% inicio y 50% final',
      },
    ],
    buildPrompt: (a, f) => {
      const emitterBlock = [
        f.emitter.companyName,
        f.emitter.taxId,
        f.emitter.address,
        f.emitter.email,
      ].filter(Boolean).join('<br>')

      return `Eres un experto en redacción de presupuestos profesionales para agencias y freelances.

CONTEXTO:${f.emitter.companyName ? `\n- Empresa emisora: ${f.emitter.companyName}${f.emitter.taxId ? ` (${f.emitter.taxId})` : ''}${f.emitter.address ? `, ${f.emitter.address}` : ''}` : ''}${f.client.company ? `\n- Empresa cliente: ${f.client.company}` : ''}${a.linkedin ? `\n- LinkedIn del cliente: ${a.linkedin}\n  → Visita esta URL. Extrae sector, descripción, tamaño y actividad principal. Úsalo para la descripción del cliente y el objetivo del proyecto.` : ''}
- Brief del proyecto:
${a.projectBrief}${a.rate ? `\n- Tarifa / presupuesto: ${a.rate}` : ''}${a.payment ? `\n- Forma de pago: ${a.payment}` : ''}
- Moneda: ${f.currency}
- IVA: ${f.budgetTable.taxRate || 21}%
- Fecha de hoy: ${new Date().toISOString().split('T')[0]}

INSTRUCCIONES:
- Del brief extrae: tipo de servicio, 4-5 fases lógicas, duración y fechas reales por fase.
- Los conceptos de "budgetTable.items" deben derivarse directamente de las fases que generas en "phases": usa el nombre de cada fase como concepto principal, y si una fase tiene subtareas relevantes, puedes desglosarla en 2 ítems. El concepto debe reflejar el trabajo real descrito en la descripción de la fase.
- Para el campo "time": si la tarifa es por hora (ej: "90€/h"), usa horas (ej: "32h"). Si el presupuesto es un total fijo o cerrado, usa semanas (ej: "2 semanas", "1 semana") — NO intentes calcular horas a partir del total.
- Distribuye el importe entre los conceptos de forma proporcional al peso de cada fase en el proyecto.
- Si no se mencionan fechas de inicio, usa una fecha razonable ~2 semanas desde hoy.
- Las condiciones de aceptación y facturación deben ser profesionales, específicas al tipo de servicio, y reflejar la forma de pago indicada.
- Para "conformity.emitterData" usa EXACTAMENTE los datos de la empresa emisora del contexto, formateados como HTML. No los inventes.
- Para "conformity.clientData" usa el nombre de la empresa cliente si está disponible, o deja un espacio para firma genérico.
- Para "client.company" y "client.name": extráelos del LinkedIn o del brief. Si no hay datos claros, usa cadena vacía "".
- Para "client.address": usa la dirección/sede si aparece en el LinkedIn. Si no, deja "".
- Para el timeline: agrupa las fases en 2-3 temáticas lógicas usando el campo "group" (ej: "Estrategia y diseño", "Desarrollo", "Lanzamiento"). Cada entrada debe tener su "group" asignado.

TAREA: Genera el presupuesto completo en castellano.

${PHASE_ICONS_HINT}

Responde ÚNICAMENTE con este JSON:
{
  "client": {
    "company": "Nombre de la empresa cliente",
    "name": "Nombre del contacto principal (si se conoce)",
    "address": "Dirección o ciudad (si aparece en LinkedIn)",
    "description": "<p>Descripción profesional de la empresa cliente (2-3 párrafos).</p>"
  },
  "project": {
    "mainObjective": "<p>Objetivo principal del proyecto.</p>",
    "collaborationModel": "<p>Modelo de colaboración.</p>",
    "scope": "<p>Alcance del proyecto:</p><ul><li>Qué incluye</li><li>Qué no incluye</li></ul>"
  },
  "phases": [
    { "name": "Nombre de la fase", "description": "<p>Descripción detallada.</p><ul><li>Tarea 1</li></ul>", "order": 0, "icon": "Search" }
  ],
  "timeline": [
    { "phase": "Nombre exacto igual que en phases", "group": "Nombre del grupo temático", "icon": "IconName", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
  ],
  "budgetTable": {
    "items": [
      { "concept": "Concepto", "time": "XXh", "price": 0, "notes": "nota opcional" }
    ],
    "taxRate": ${f.budgetTable.taxRate || 21}
  },
  "acceptanceConditions": {
    "paymentTerms": "<p>Detalle de la forma de pago con porcentajes e hitos.</p>",
    "acceptanceCriteria": "<p>Criterios para considerar el trabajo entregado y aceptado.</p>",
    "clientResponsibilities": "<ul><li>Responsabilidad 1</li><li>Responsabilidad 2</li></ul>",
    "penaltyClause": "<p>Cláusula de penalización por retrasos o cambios de alcance.</p>",
    "annexes": "",
    "dataProtection": "<p>Cláusula de tratamiento de datos personales conforme al RGPD.</p>"
  },
  "billingConditions": "<p>Condiciones de facturación: plazos, método de pago, penalización por demora.</p>",
  "conformity": {
    "emitterData": "<p>${emitterBlock || 'Empresa emisora'}</p>",
    "clientData": "<p>${f.client.company || 'Empresa cliente'}</p>"
  }
}

${SCHEMA_HINT}`
    },
    apply: (parsed, prev) => {
      let next = { ...prev }

      if (parsed.client) {
        // Only overwrite non-empty string fields so existing user data (email, taxId) is preserved
        const clientPatch = Object.fromEntries(
          Object.entries(parsed.client as Record<string, unknown>).filter(([, v]) => v !== '' && v != null)
        )
        next = { ...next, client: { ...next.client, ...clientPatch } }
      }

      if (parsed.project) {
        next = {
          ...next,
          project: {
            ...next.project,
            ...(parsed.project as object),
            phases: next.project.phases,
          },
        }
      }

      if (parsed.phases) {
        next = { ...next, project: { ...next.project, phases: parsed.phases as QuoteFormData['project']['phases'] } }
      }

      if (parsed.timeline) {
        next = { ...next, timeline: parsed.timeline as QuoteFormData['timeline'] }
      }

      if (parsed.budgetTable) {
        const bt = parsed.budgetTable as Partial<QuoteFormData['budgetTable']>
        const items = withIds(bt.items ?? next.budgetTable.items)
        const subtotal = items.reduce((s, i) => s + (i.price || 0), 0)
        const taxRate = bt.taxRate ?? next.budgetTable.taxRate
        next = { ...next, budgetTable: { items, subtotal, taxRate, total: subtotal * (1 + taxRate / 100) } }
      }

      if (parsed.acceptanceConditions) {
        next = { ...next, acceptanceConditions: { ...next.acceptanceConditions, ...(parsed.acceptanceConditions as object) } }
      }

      if (parsed.billingConditions) {
        next = { ...next, billingConditions: parsed.billingConditions as string }
      }

      if (parsed.conformity) {
        next = { ...next, conformity: { ...next.conformity, ...(parsed.conformity as object) } }
      }

      return next
    },
  },
}

const AI_OPTIONS = [
  { id: 'claude', label: 'Claude', url: 'https://claude.ai' },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com' },
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chat.openai.com' },
]

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  section: AISection
  form: QuoteFormData
  onApply: (updater: (prev: QuoteFormData) => QuoteFormData) => void
  onClose: () => void
}

const INPUT_CLS = 'w-full px-3 py-2.5 border border-input rounded-md text-sm text-ink placeholder-ink-40 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-black/[0.06] transition-colors bg-paper'

export function AIAssistant({ section, form, onApply, onClose }: Props) {
  const config = CONFIGS[section]
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.questions.filter(q => q.defaultValue).map(q => [q.key, q.defaultValue!]))
  )
  const [copied, setCopied] = useState(false)
  const [response, setResponse] = useState('')
  const [parseError, setParseError] = useState('')
  const [applied, setApplied] = useState(false)

  const prompt = step >= 2 ? config.buildPrompt(answers, form) : ''

  function handleCopy() {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleApply() {
    setParseError('')
    try {
      const cleaned = response.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      const parsed = JSON.parse(cleaned)
      onApply((prev) => config.apply(parsed, prev))
      setApplied(true)
      setTimeout(onClose, 800)
    } catch {
      setParseError('No se pudo leer la respuesta. Asegúrate de pegar solo el JSON.')
    }
  }

  const canProceed = config.questions
    .filter((q) => !q.optional)
    .every((q) => answers[q.key]?.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/10" />
      <div
        className="relative bg-paper border border-line rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.12)] w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <Loader size={14} strokeWidth={1.5} className="text-ink-40" />
            <span className="text-sm font-medium text-ink">{config.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all ${s === step ? 'w-4 bg-ink' : s < step ? 'w-2 bg-ink-40' : 'w-2 bg-line'}`}
                />
              ))}
            </div>
            <button onClick={onClose} className="p-1 text-ink-40 hover:text-ink transition-colors">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 1: Questions */}
          {step === 1 && (
            <>
              <p className="text-xs text-ink-40">{config.description}</p>
              {config.questions.map((q) => (
                <div key={q.key}>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    {q.label}
                    {q.optional && <span className="ml-1.5 text-ink-40 font-normal text-xs">(opcional)</span>}
                  </label>
                  {q.helper && (
                    <p className="text-xs text-ink-40 mb-2 leading-relaxed">{q.helper}</p>
                  )}
                  {q.type === 'textarea' ? (
                    <textarea
                      className={INPUT_CLS + ' resize-none'}
                      rows={q.helper ? 5 : 3}
                      placeholder={q.placeholder}
                      value={answers[q.key] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className={INPUT_CLS}
                      type={q.type}
                      placeholder={q.placeholder}
                      value={answers[q.key] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          {/* Step 2: Prompt + AI links */}
          {step === 2 && (
            <>
              <p className="text-xs text-ink-40">Copia este prompt y pégalo en la IA que prefieras.</p>
              <div className="relative">
                <pre className="text-xs text-ink-60 bg-surface border border-line rounded-md p-4 whitespace-pre-wrap break-words leading-relaxed max-h-56 overflow-y-auto">
                  {prompt}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-paper border border-line rounded-md text-ink-60 hover:text-ink transition-colors"
                >
                  {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={1.5} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xs text-ink-40 shrink-0">Abrir en:</p>
                <div className="flex items-center gap-3">
                  {AI_OPTIONS.map(({ id, label, url }) => (
                    <a
                      key={id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-ink-60 hover:text-ink transition-colors"
                    >
                      {label}
                      <ExternalLink size={10} strokeWidth={1.5} />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 3: Paste response */}
          {step === 3 && (
            <>
              <p className="text-xs text-ink-40">Pega aquí la respuesta JSON de la IA y aplica los cambios.</p>
              <textarea
                className={INPUT_CLS + ' resize-none font-mono text-xs'}
                rows={10}
                placeholder={'{\n  "client": { ... }\n}'}
                value={response}
                onChange={(e) => { setResponse(e.target.value); setParseError('') }}
              />
              {parseError && (
                <p className="text-xs text-[#DC2626]">{parseError}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-line shrink-0">
          <button
            onClick={() => step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-ink-60 hover:text-ink border border-line rounded-md transition-colors"
          >
            {step > 1 && <ArrowLeft size={13} strokeWidth={1.5} />}
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              disabled={step === 1 && !canProceed}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === 1 ? 'Generar prompt' : 'Ya tengo la respuesta'}
              <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={handleApply}
              disabled={!response.trim() || applied}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {applied ? <><Check size={13} strokeWidth={2} /> Aplicado</> : 'Aplicar cambios'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
