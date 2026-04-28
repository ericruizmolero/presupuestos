'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { createQuote } from '@/lib/firestore/quotes'
import { getUserCompanyId, upsertCompany, setUserCompanyId } from '@/lib/firestore/companies'
import { nanoid } from 'nanoid'
import type { QuoteFormData } from '@/types/quote'

const QUOTE_DATA: QuoteFormData = {
  slug: '',
  status: 'borrador',
  quoteNumber: 'P-2026-001',
  date: '2026-03-11',
  validUntil: '2026-05-11',
  currency: 'EUR',
  fontName: '',

  emitter: {
    companyName: 'treseiscero CB',
    logoUrl: '',
    email: 'ericruizmolero@treseiscero.app',
    address: 'Jaitzubia Auzoa 197, 20280, Hondarribia, Guipúzcoa',
    taxId: 'E75239277',
    description: `<p>Somos una <strong>pixel boutique</strong>.</p><p>Nos especializamos en:</p><ul><li>Diseño web.</li><li>Desarrollo Webflow.</li></ul><p><strong>Equipo:</strong></p><ul><li>Andoni Martínez Talavera, Fundador, Diseñador UX/UI</li><li>Eric Ruiz Molero, Fundador, Desarrollador Webflow</li></ul><p><strong>Contacto:</strong></p><ul><li>Web: www.treseiscero.app</li><li>Email: ericruizmolero@treseiscero.app</li></ul>`,
  },

  client: {
    name: '',
    company: 'Hostal Empúries',
    email: '',
    address: '',
    taxId: '',
    description: `<p>Hostal Empúries es un hotel familiar ubicado en la Costa Brava, junto a las ruinas de Empúries, que combina historia, naturaleza y hospitalidad auténtica. Con una oferta que abarca alojamiento, restauración, spa, experiencias culturales y espacios para eventos y empresas, la marca comunica tranquilidad, compromiso medioambiental y arraigo al territorio.</p>`,
  },

  project: {
    mainObjective: `<p>Rediseñar y desarrollar la página web de Hostal Empúries con una estética editorial, orientada al storytelling visual y la conversión directa, implementada en Webflow con soporte multilingüe y plena integración con el motor de reservas externo.</p>`,
    collaborationModel: `<p>Este presupuesto cubre el diseño y desarrollo Webflow a cargo de treseiscero. La definición de la arquitectura de información, árbol de navegación, estructura de contenidos y estrategia SEO será responsabilidad de Bonsái Team, que los entregará como input al inicio de cada fase.</p>`,
    scope: `<ul><li>15 páginas corporativas</li><li>Sistema de blog con 2–3 plantillas de entrada (categorías según se defina con Bonsái Team)</li><li>Migración de 70 entradas de blog existentes al nuevo CMS</li><li>3 idiomas (mediante Webflow Localization)</li></ul>`,
    phases: [
      {
        name: 'Fase 1 – Conceptualización y sistema de diseño',
        description: `<p>Definición de la línea visual editorial del proyecto: tipografía, paleta, iconografía, sistema de espaciado y componentes base. El objetivo es transmitir hospitalidad auténtica, naturaleza y calidad sin caer en lo genérico. Las webs de referencia (The Newt in Somerset, Little Palm Island) sirven como norte estético.</p>`,
        order: 0,
      },
      {
        name: 'Fase 2 – Diseño de Home y páginas clave',
        description: `<p>Diseño completo de la homepage en Desktop y Mobile, con scroll storytelling, integración de vídeo hero y microinteracciones documentadas. Se incluyen también las páginas de mayor peso estratégico (Habitaciones, Restaurante, Spa, Para Empresas).</p>`,
        order: 1,
      },
      {
        name: 'Fase 3 – Páginas secundarias y plantillas de blog',
        description: `<p>Diseño de las páginas restantes sobre el sistema de componentes validado. Diseño de 2–3 plantillas de entrada de blog según la categorización acordada con Bonsái Team.</p>`,
        order: 2,
      },
      {
        name: 'Fase de Desarrollo Webflow',
        description: `<ul><li>Implementación del diseño en Webflow con metodología Client-First</li><li>CMS avanzado: habitaciones, restaurante, blog, experiencias, espacios para empresas</li><li>Desarrollo responsive completo: desktop, tablet y mobile</li><li>Animaciones y microinteracciones con GSAP, Lottie y scroll-triggered animations</li><li>Sistema de componentes modulares con propiedades y variantes</li><li>Webflow Localization en 3 idiomas (ES / CA / EN)</li><li>Integración del motor de reservas externo</li><li>WhatsApp flotante y widget de clima</li><li>Migración de 70 entradas de blog al nuevo CMS</li><li>Configuración de Analytics (GA4) y seguimiento de clics</li><li>Optimización de SEO on-page en coordinación con Bonsái Team</li><li>Configuración de redireccionamientos desde URLs antiguas</li></ul><p><strong>¿Por qué Webflow?</strong> A diferencia del WordPress actual, Webflow permite al equipo de Hostal Empúries editar cualquier texto, imagen, enlace o entrada del blog directamente desde el CMS o el Editor visual, sin depender de un desarrollador para el día a día.</p>`,
        order: 3,
      },
      {
        name: 'Fase de entrega y formación',
        description: `<ul><li>QA exhaustivo en todas las resoluciones y navegadores</li><li>Testing de formularios, motor de reservas y flujos de conversión</li><li>Grabación de vídeos explicativos para el uso del Editor y CMS de Webflow</li><li>Sesión formativa para el equipo de Hostal Empúries</li><li>Documentación de mejores prácticas para mantenimiento y publicación de contenido</li><li>Entrega final y revisión conjunta</li></ul>`,
        order: 4,
      },
    ],
  },

  timeline: [
    { phase: 'Fase 1 – Conceptualización', startDate: '2026-03-16', endDate: '2026-03-27' },
    { phase: 'Fase 2 – Home y páginas clave', startDate: '2026-03-30', endDate: '2026-04-17' },
    { phase: 'Fase 3 – Páginas secundarias', startDate: '2026-04-20', endDate: '2026-05-01' },
    { phase: 'Desarrollo Webflow', startDate: '2026-05-04', endDate: '2026-05-29' },
    { phase: 'Entrega y formación', startDate: '2026-06-01', endDate: '2026-06-07' },
  ],

  budgetTable: {
    items: [
      { id: '1', concept: '1. Diseño UX/UI', time: '5–6 semanas', price: 7000, notes: 'Conceptualización, sistema de diseño, Home, 15 páginas corporativas y 2–3 plantillas de blog en Desktop y Mobile' },
      { id: '2', concept: '2. Desarrollo Webflow', time: '4 semanas', price: 7000, notes: 'Client-First, CMS avanzado, 3 idiomas, responsive, animaciones, integraciones, migración blog (70 entradas), Analytics' },
      { id: '3', concept: '3. Entrega y formación', time: '1 semana', price: 1000, notes: 'QA final, optimización, documentación, vídeos y handoff' },
    ],
    subtotal: 15000,
    taxRate: 0,
    total: 15000,
  },

  budgetTableAdditional: {
    enabled: true,
    label: 'Precio por página adicional',
    items: [
      { id: '4', concept: 'Página adicional — Diseño', time: '', price: 500, notes: '' },
      { id: '5', concept: 'Página adicional — Desarrollo', time: '', price: 350, notes: '' },
      { id: '6', concept: 'Página adicional — Diseño + Desarrollo', time: '', price: 800, notes: '' },
    ],
    subtotal: 1650,
    total: 1650,
  },

  acceptanceConditions: {
    paymentTerms: `<p>El presente contrato tiene una validez de 60 días desde su entrega.</p><p>Todos los pagos en treseiscero pueden realizarse a través de transferencia bancaria.</p>`,
    acceptanceCriteria: `<p>Todo documento entregado al cliente deberá ser firmado por él mismo por vía electrónica o bien por la vía tradicional. La firma se interpreta como la conformidad y aceptación de todas las condiciones especificadas en la documentación entregada y el cumplimiento de las mismas.</p>`,
    clientResponsibilities: `<p>Proporcionar toda la información y acceso a la misma que fuera necesaria para el proyecto, por mutuo acuerdo.</p>`,
    penaltyClause: `<p>En caso de no cumplimiento de las fechas de pago de las facturas, treseiscero se reserva el derecho de reclamo de la parte proporcional del interés generado por la demora a razón del IPC actual + 5%.</p>`,
    annexes: `<p>Reunión inicial</p>`,
    dataProtection: `<p>Ambas partes aseguran cumplir con las obligaciones de protección de datos, incluyendo el derecho a la información, consentimiento, deber de secreto y medidas de seguridad exigidas por la normativa comunitaria y nacional.</p>`,
  },

  billingConditions: `<p><strong>Hito inicial 50%: 7.500€</strong> (IVA no incluido)</p><p>La forma de pago será a la recepción de la factura que será emitida cuando comience el proyecto.</p><p><strong>Hito final 50%: 7.500€</strong> (IVA no incluido)</p><p>La forma de pago será a la recepción de la factura que será emitida cuando el trabajo esté completado.</p>`,

  conformity: {
    emitterData: `<p><strong>Empresa:</strong> treseiscero CB<br/><strong>CIF:</strong> E75239277<br/><strong>Dirección:</strong> Jaitzubia Auzoa 197, 20280, Hondarribia, Guipúzcoa<br/><strong>Representada por:</strong> Eric Ruiz Molero<br/><strong>Cargo:</strong> Fundador</p>`,
    clientData: `<p><strong>Empresa:</strong> Hostal Empúries<br/><strong>CIF:</strong><br/><strong>Dirección:</strong><br/><strong>Representada por:</strong><br/><strong>Cargo:</strong></p>`,
    signatureStatus: 'unsigned',
    signedAt: null,
  },
}

export default function SeedPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState('Creando presupuesto...')

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }

    async function seed() {
      try {
        let cid = await getUserCompanyId(user!.uid)
        if (!cid) {
          cid = `company_${nanoid(10)}`
          await setUserCompanyId(user!.uid, cid)
          await upsertCompany(cid, {
            name: 'treseiscero CB',
            email: 'ericruizmolero@treseiscero.app',
            address: 'Jaitzubia Auzoa 197, 20280, Hondarribia, Guipúzcoa',
            taxId: 'E75239277',
            description: QUOTE_DATA.emitter.description,
            logoUrl: '',
            fonts: [],
            defaultFontName: '',
            defaultConditions: {
              paymentTerms: QUOTE_DATA.acceptanceConditions.paymentTerms,
              acceptanceCriteria: QUOTE_DATA.acceptanceConditions.acceptanceCriteria,
              clientResponsibilities: QUOTE_DATA.acceptanceConditions.clientResponsibilities,
              penaltyClause: QUOTE_DATA.acceptanceConditions.penaltyClause,
              dataProtection: QUOTE_DATA.acceptanceConditions.dataProtection,
            },
          })
        }
        setStatus('Guardando en Firestore...')
        const id = await createQuote(QUOTE_DATA, user!.uid, cid)
        setStatus('¡Listo! Redirigiendo...')
        router.replace(`/dashboard/${id}`)
      } catch (e) {
        setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    seed()
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border border-ink border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-ink-60">{status}</p>
      </div>
    </div>
  )
}
