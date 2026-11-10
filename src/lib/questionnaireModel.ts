/** Tipos y plantillas de cuestionarios, sin Firebase (se usan en el cliente y en el servidor MCP). */
export interface QuestionField {
  id: string
  label?: string        // subtítulo de la caja ("Webs que nos gustan"); si la pregunta tiene una sola caja, vacío
  placeholder?: string
}

export interface Question {
  id: string
  title: string
  help?: string
  fields?: QuestionField[]  // varias cajas de respuesta; si no hay, una sola con id = question.id
}

export type QuestionnaireStatus = 'pendiente' | 'respondido'

export interface Questionnaire {
  id: string
  slug: string
  companyId: string
  title: string
  clientName?: string     // persona ("Nacho")
  clientCompany?: string  // empresa ("5050 Growth")
  intro?: string
  language?: 'es' | 'en'
  questions: Question[]
  answers?: Record<string, string>  // por id de caja
  status: QuestionnaireStatus
  submittedAt?: string    // ISO cuando pulsó "Enviar respuestas"
  answeredAt?: string     // ISO de la última respuesta guardada
  createdAt?: unknown
}

/** Cajas de respuesta de una pregunta (si no define fields, una con el id de la pregunta) */
export function fieldsOf(q: Question): QuestionField[] {
  return q.fields?.length ? q.fields : [{ id: q.id, placeholder: '' }]
}

export function rid(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n)
}

function slugBase(s: string) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

/** Slug legible ("5050-growth"); si ya existe, "5050-growth-2", "-3"… */
export function questionnaireSlug(name: string, n = 1) {
  const base = slugBase(name) || 'cuestionario'
  return n > 1 ? `${base}-${n}` : base
}

/** Plantilla: preguntas para auditar una web */
export function webAuditTemplate(): Question[] {
  return [
    {
      id: 'referencias',
      title: '¿Qué webs os gustan y cuáles no?',
      help: 'Pega enlaces y cuéntanos en una línea qué te gusta o qué no de cada una: cómo explican el producto, el tono, el diseño, la estructura…',
      fields: [
        { id: 'referencias_si', label: 'Webs que nos gustan', placeholder: 'https://… — nos gusta cómo…' },
        { id: 'referencias_no', label: 'Webs que no nos gustan', placeholder: 'https://… — no nos convence…' },
      ],
    },
    {
      id: 'cinco_segundos',
      title: '¿Qué tiene que entender alguien en los primeros 5 segundos?',
      help: 'Si un visitante solo viera la primera pantalla, ¿qué debería llevarse? Qué hacéis, para quién y por qué vosotros.',
    },
    {
      id: 'acciones',
      title: '¿Qué acciones principales tienen que hacer los usuarios?',
      help: 'Contactar, agendar una demo, descargar un recurso, suscribirse… Ordénalas de más a menos importante.',
    },
    {
      id: 'publico',
      title: '¿A quién va dirigida la web principalmente?',
      help: 'Perfil, cargo, tipo y tamaño de empresa, sector… Si hay varios públicos, dinos cuál es el prioritario.',
    },
    {
      id: 'secciones',
      title: '¿Qué secciones tienen que estar sí o sí?',
      help: 'Servicios, casos de éxito, precios, sobre nosotros, blog, recursos… Y si hay algo que hoy sobra, cuéntanoslo también.',
    },
  ]
}

