'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getUserCompanyId } from '@/lib/firestore/companies'
import { createQuote } from '@/lib/firestore/quotes'
import type { QuoteFormData } from '@/types/quote'

const EMITTER = {
  companyName: 'treseiscero',
  email: 'hola@treseiscero.app',
  address: 'Barcelona, España',
  taxId: 'B12345678',
  description: '<p>Estudio de diseño y desarrollo digital especializado en identidad de marca, experiencias digitales y estrategia creativa.</p>',
  logoUrl: '',
}

const DEMO_QUOTES: QuoteFormData[] = [
  // 1. Branding & Identidad — Restaurante
  {
    slug: '',
    quoteNumber: 'P-2026-002',
    status: 'enviado',
    date: '2026-02-10',
    validUntil: '2026-03-10',
    currency: 'EUR',
    fontName: 'Inter',
    emitter: EMITTER,
    client: {
      name: 'Marta Soler',
      company: 'Casa Brava Restaurante',
      email: 'marta@casabrava.es',
      address: 'Carrer de Provença 88, Barcelona',
      taxId: 'B98765432',
      description: '<p>Restaurante de cocina catalana contemporánea con dos locales en Barcelona y uno en Girona.</p>',
    },
    project: {
      mainObjective: '<p>Rediseñar la identidad visual completa de Casa Brava para reflejar su evolución hacia una cocina más contemporánea, manteniendo la esencia tradicional.</p>',
      collaborationModel: '',
      scope: '<p>Incluye: logotipo, paleta de color, tipografía, papelería, menús, señalética y guía de marca. No incluye: implementación en físico ni producción de materiales.</p>',
      phases: [
        { name: 'Investigación y briefing', description: '<p>Entrevistas con el equipo, análisis de competencia y definición de personalidad de marca.</p>', order: 0, icon: 'search' },
        { name: 'Conceptualización', description: '<p>Desarrollo de 3 propuestas de dirección creativa para revisión.</p>', order: 1, icon: 'lightbulb' },
        { name: 'Diseño y refinamiento', description: '<p>Desarrollo del concepto elegido en todas sus aplicaciones.</p>', order: 2, icon: 'pen-tool' },
        { name: 'Entrega de activos', description: '<p>Exportación de todos los archivos en formatos requeridos y guía de uso.</p>', order: 3, icon: 'package' },
      ],
    },
    timeline: [
      { phase: 'Investigación y briefing', startDate: '2026-02-17', endDate: '2026-02-28' },
      { phase: 'Conceptualización', startDate: '2026-03-01', endDate: '2026-03-14' },
      { phase: 'Diseño y refinamiento', startDate: '2026-03-15', endDate: '2026-04-04' },
      { phase: 'Entrega de activos', startDate: '2026-04-05', endDate: '2026-04-11' },
    ],
    budgetTable: {
      items: [
        { id: '1', concept: 'Investigación y estrategia de marca', time: '16h', price: 1600, notes: '' },
        { id: '2', concept: 'Diseño de identidad visual (logo + sistema)', time: '40h', price: 4800, notes: '' },
        { id: '3', concept: 'Aplicaciones de marca (menú, papelería, señalética)', time: '24h', price: 2400, notes: '' },
        { id: '4', concept: 'Manual de marca', time: '12h', price: 1200, notes: '' },
      ],
      subtotal: 10000,
      taxRate: 0,
      total: 10000,
    },
    budgetTableAdditional: {
      enabled: false,
      label: '',
      items: [],
      subtotal: 0,
      total: 0,
    },
    acceptanceConditions: {
      paymentTerms: '<p>50% al inicio del proyecto, 50% a la entrega final.</p>',
      acceptanceCriteria: '<p>Se considera entregado cuando el cliente aprueba por escrito los archivos finales.</p>',
      clientResponsibilities: '<p>El cliente deberá proporcionar fotos, textos y referencias en los primeros 3 días hábiles.</p>',
      penaltyClause: '<p>Retrasos del cliente superiores a 7 días hábiles podrán repercutir en el calendario acordado.</p>',
      annexes: '',
      dataProtection: '<p>Los datos facilitados serán tratados conforme al RGPD.</p>',
    },
    billingConditions: '<p>Facturas emitidas en euros. Pago por transferencia bancaria en un plazo máximo de 15 días desde la emisión.</p>',
    conformity: {
      emitterData: '<p>Eric Ruiz — treseiscero</p>',
      clientData: '<p>Marta Soler — Casa Brava Restaurante</p>',
      signatureStatus: 'unsigned',
      signedAt: null,
    },
    pageBreaksBefore: [],
    sectionOrder: [],
  },

  // 2. Desarrollo App Móvil — Fintech
  {
    slug: '',
    quoteNumber: 'P-2026-003',
    status: 'aceptado',
    date: '2026-01-15',
    validUntil: '2026-02-15',
    currency: 'EUR',
    fontName: 'Inter',
    emitter: EMITTER,
    client: {
      name: 'Alejandro Vega',
      company: 'Cobro Fácil SL',
      email: 'alex@cobrofacil.io',
      address: 'Paseo de la Castellana 200, Madrid',
      taxId: 'B11223344',
      description: '<p>Startup fintech especializada en soluciones de cobro para autónomos y pequeñas empresas.</p>',
    },
    project: {
      mainObjective: '<p>Diseño UX/UI completo de la app móvil Cobro Fácil para iOS y Android, desde el onboarding hasta el panel de gestión de cobros.</p>',
      collaborationModel: '<p>Proyecto cerrado con entregas por fases. El equipo de desarrollo de Cobro Fácil implementará los diseños de forma paralela.</p>',
      scope: '<p>Incluye: flujos de usuario, wireframes, prototipo interactivo, diseño final en Figma y design tokens. No incluye: desarrollo de código ni backend.</p>',
      phases: [
        { name: 'UX Research', description: '<p>Entrevistas con usuarios actuales, análisis de apps competidoras y mapa de flujos.</p>', order: 0 },
        { name: 'Arquitectura y wireframes', description: '<p>Estructura de la app, flujos principales y wireframes de baja fidelidad.</p>', order: 1 },
        { name: 'Diseño visual', description: '<p>Sistema de diseño, componentes y pantallas en alta fidelidad.</p>', order: 2 },
        { name: 'Prototipo y handoff', description: '<p>Prototipo interactivo en Figma y documentación para desarrollo.</p>', order: 3 },
      ],
    },
    timeline: [
      { phase: 'UX Research', startDate: '2026-01-20', endDate: '2026-02-06' },
      { phase: 'Arquitectura y wireframes', startDate: '2026-02-07', endDate: '2026-02-27' },
      { phase: 'Diseño visual', startDate: '2026-03-01', endDate: '2026-04-03' },
      { phase: 'Prototipo y handoff', startDate: '2026-04-04', endDate: '2026-04-17' },
    ],
    budgetTable: {
      items: [
        { id: '1', concept: 'UX Research y definición de flujos', time: '32h', price: 3200, notes: '' },
        { id: '2', concept: 'Wireframes y arquitectura de la app', time: '28h', price: 2800, notes: '' },
        { id: '3', concept: 'Sistema de diseño y componentes', time: '36h', price: 4320, notes: '' },
        { id: '4', concept: 'Pantallas en alta fidelidad (45 pantallas)', time: '60h', price: 7200, notes: '' },
        { id: '5', concept: 'Prototipo interactivo y handoff', time: '16h', price: 1600, notes: '' },
      ],
      subtotal: 19120,
      taxRate: 0,
      total: 19120,
    },
    budgetTableAdditional: {
      enabled: false,
      label: '',
      items: [],
      subtotal: 0,
      total: 0,
    },
    acceptanceConditions: {
      paymentTerms: '<p>Facturación por fases: 30% inicio, 30% entrega wireframes, 40% entrega final.</p>',
      acceptanceCriteria: '<p>Cada fase se considera aprobada cuando el cliente confirma por escrito su conformidad con las entregas.</p>',
      clientResponsibilities: '<p>El cliente proporcionará acceso a usuarios para entrevistas y feedback en cada fase de revisión.</p>',
      penaltyClause: '<p>Retrasos en la aprobación de entregas superiores a 5 días hábiles podrán ampliar el plazo de entrega en la misma proporción.</p>',
      annexes: '',
      dataProtection: '<p>Los datos de los usuarios entrevistados serán anonimizados y tratados conforme al RGPD.</p>',
    },
    billingConditions: '<p>Facturación por fases: 30% inicio, 30% entrega wireframes, 40% entrega final. Pago por transferencia en un plazo de 15 días desde la emisión de cada factura.</p>',
    conformity: {
      emitterData: '<p>Eric Ruiz — treseiscero</p>',
      clientData: '<p>Alejandro Vega — Cobro Fácil SL</p>',
      signatureStatus: 'signed',
      signedAt: '2026-01-18',
    },
    pageBreaksBefore: [],
    sectionOrder: [],
  },

  // 3. E-commerce — Moda
  {
    slug: '',
    quoteNumber: 'P-2026-004',
    status: 'borrador',
    date: '2026-03-01',
    validUntil: '2026-04-01',
    currency: 'EUR',
    fontName: 'Inter',
    emitter: EMITTER,
    client: {
      name: 'Lucía Fernández',
      company: 'Vestida Studio',
      email: 'lucia@vestida.es',
      address: 'Calle Fuencarral 45, Madrid',
      taxId: 'B55667788',
      description: '<p>Marca de moda femenina sostenible con colecciones de edición limitada.</p>',
    },
    project: {
      mainObjective: '<p>Diseño y desarrollo de tienda online en Shopify con identidad visual actualizada y experiencia de compra premium.</p>',
      collaborationModel: '',
      scope: '<p>Incluye: diseño custom de theme Shopify, integración de pasarela de pago, catálogo de productos, blog y página de marca. No incluye: fotografía de producto ni redacción de textos.</p>',
      phases: [
        { name: 'Estrategia y diseño', description: '<p>Definición de la experiencia de compra y diseño de todas las páginas clave.</p>', order: 0 },
        { name: 'Desarrollo Shopify', description: '<p>Implementación del theme custom y configuración de la tienda.</p>', order: 1 },
        { name: 'Contenido y QA', description: '<p>Carga de productos, textos y pruebas de usuario.</p>', order: 2 },
        { name: 'Lanzamiento', description: '<p>Go-live, configuración de dominio y formación al equipo.</p>', order: 3 },
      ],
    },
    timeline: [
      { phase: 'Estrategia y diseño', startDate: '2026-03-10', endDate: '2026-03-27' },
      { phase: 'Desarrollo Shopify', startDate: '2026-03-28', endDate: '2026-04-24' },
      { phase: 'Contenido y QA', startDate: '2026-04-25', endDate: '2026-05-08' },
      { phase: 'Lanzamiento', startDate: '2026-05-09', endDate: '2026-05-15' },
    ],
    budgetTable: {
      items: [
        { id: '1', concept: 'Diseño UX/UI de la tienda (8 páginas)', time: '40h', price: 4800, notes: '' },
        { id: '2', concept: 'Desarrollo theme Shopify custom', time: '56h', price: 6720, notes: '' },
        { id: '3', concept: 'Configuración e integraciones', time: '16h', price: 1600, notes: '' },
        { id: '4', concept: 'QA y optimización', time: '12h', price: 1200, notes: '' },
        { id: '5', concept: 'Formación y documentación', time: '8h', price: 800, notes: '' },
      ],
      subtotal: 15120,
      taxRate: 0,
      total: 15120,
    },
    budgetTableAdditional: {
      enabled: false,
      label: '',
      items: [],
      subtotal: 0,
      total: 0,
    },
    acceptanceConditions: {
      paymentTerms: '<p>40% al inicio, 30% al aprobar los diseños, 30% a la entrega final.</p>',
      acceptanceCriteria: '<p>El proyecto se considera finalizado con la publicación de la tienda en el dominio de producción y la aprobación escrita del cliente.</p>',
      clientResponsibilities: '<p>El cliente proporcionará catálogo de productos, textos, imágenes y acceso a las cuentas de Shopify y pasarela de pago antes del inicio.</p>',
      penaltyClause: '<p>Los retrasos en la entrega de contenidos por parte del cliente podrán afectar a las fechas de lanzamiento acordadas.</p>',
      annexes: '',
      dataProtection: '<p>Los datos de clientes de la tienda serán responsabilidad del cliente como titular del tratamiento conforme al RGPD.</p>',
    },
    billingConditions: '<p>Facturación en tres hitos: 40% inicio, 30% aprobación de diseños, 30% lanzamiento. Transferencia bancaria en 15 días desde la emisión.</p>',
    conformity: {
      emitterData: '<p>Eric Ruiz — treseiscero</p>',
      clientData: '<p>Lucía Fernández — Vestida Studio</p>',
      signatureStatus: 'unsigned',
      signedAt: null,
    },
    pageBreaksBefore: [],
    sectionOrder: [],
  },

  // 4. Identidad Digital — Arquitectura
  {
    slug: '',
    quoteNumber: 'P-2026-005',
    status: 'rechazado',
    date: '2026-01-05',
    validUntil: '2026-02-05',
    currency: 'EUR',
    fontName: 'Inter',
    emitter: EMITTER,
    client: {
      name: 'Carlos Mendoza',
      company: 'Espacio Norte Arquitectura',
      email: 'carlos@espacionorte.com',
      address: 'Av. Diagonal 490, Barcelona',
      taxId: 'B44556677',
      description: '<p>Estudio de arquitectura e interiorismo especializado en espacios corporativos y retail.</p>',
    },
    project: {
      mainObjective: '<p>Diseño de la identidad digital de Espacio Norte: web corporativa, presentaciones de proyecto y materiales de comunicación.</p>',
      collaborationModel: '',
      scope: '<p>Incluye: diseño y desarrollo web, plantillas de presentación, dossieres de proyecto y firma de email. No incluye: fotografía de obra ni redacción de contenidos.</p>',
      phases: [
        { name: 'Estrategia de marca digital', description: '<p>Definición del posicionamiento, tono de comunicación y arquitectura de la web.</p>', order: 0 },
        { name: 'Diseño web y materiales', description: '<p>Diseño de la web corporativa y plantillas de comunicación.</p>', order: 1 },
        { name: 'Desarrollo web', description: '<p>Implementación en Webflow con CMS para proyectos y blog.</p>', order: 2 },
        { name: 'Entrega y formación', description: '<p>QA, documentación y formación al equipo interno.</p>', order: 3 },
      ],
    },
    timeline: [
      { phase: 'Estrategia de marca digital', startDate: '2026-01-12', endDate: '2026-01-23' },
      { phase: 'Diseño web y materiales', startDate: '2026-01-26', endDate: '2026-02-20' },
      { phase: 'Desarrollo web', startDate: '2026-02-23', endDate: '2026-03-20' },
      { phase: 'Entrega y formación', startDate: '2026-03-23', endDate: '2026-03-27' },
    ],
    budgetTable: {
      items: [
        { id: '1', concept: 'Estrategia y arquitectura de información', time: '20h', price: 2000, notes: '' },
        { id: '2', concept: 'Diseño UX/UI web corporativa', time: '48h', price: 5760, notes: '' },
        { id: '3', concept: 'Desarrollo Webflow con CMS de proyectos', time: '40h', price: 4000, notes: '' },
        { id: '4', concept: 'Plantillas de presentación y dossieres', time: '16h', price: 1600, notes: '' },
        { id: '5', concept: 'QA, formación y entrega', time: '8h', price: 800, notes: '' },
      ],
      subtotal: 14160,
      taxRate: 0,
      total: 14160,
    },
    budgetTableAdditional: {
      enabled: false,
      label: '',
      items: [],
      subtotal: 0,
      total: 0,
    },
    acceptanceConditions: {
      paymentTerms: '<p>50% al inicio del proyecto, 25% al aprobar los diseños, 25% a la entrega final.</p>',
      acceptanceCriteria: '<p>El proyecto se da por finalizado cuando el cliente aprueba por escrito el acceso al panel de Webflow y los materiales entregados.</p>',
      clientResponsibilities: '<p>El cliente aportará fotos de proyectos, textos de descripción y acceso a cuentas en los primeros 5 días hábiles.</p>',
      penaltyClause: '<p>Los retrasos atribuibles al cliente de más de 10 días hábiles podrán generar una revisión del calendario y un cargo adicional por horas de coordinación.</p>',
      annexes: '',
      dataProtection: '<p>Los datos tratados en el marco del proyecto se gestionarán conforme al Reglamento General de Protección de Datos.</p>',
    },
    billingConditions: '<p>Tres hitos de facturación: 50% inicio, 25% diseños aprobados, 25% lanzamiento. Pago por transferencia en 15 días.</p>',
    conformity: {
      emitterData: '<p>Eric Ruiz — treseiscero</p>',
      clientData: '<p>Carlos Mendoza — Espacio Norte Arquitectura</p>',
      signatureStatus: 'unsigned',
      signedAt: null,
    },
    pageBreaksBefore: [],
    sectionOrder: [],
  },

  // 5. Marketing Digital — Salud
  {
    slug: '',
    quoteNumber: 'P-2026-006',
    status: 'enviado',
    date: '2026-03-15',
    validUntil: '2026-04-15',
    currency: 'EUR',
    fontName: 'Inter',
    emitter: EMITTER,
    client: {
      name: 'Dra. Paula Roca',
      company: 'Clínica Sonría',
      email: 'paula@clinicasonria.es',
      address: 'Rambla de Catalunya 77, Barcelona',
      taxId: 'B22334455',
      description: '<p>Clínica dental con tres consultas en Barcelona y lista de espera de tres meses.</p>',
    },
    project: {
      mainObjective: '<p>Rediseño web y estrategia de contenidos digitales para mejorar la captación de nuevos pacientes y reforzar la autoridad médica de la clínica.</p>',
      collaborationModel: '',
      scope: '<p>Incluye: nueva web en Webflow, blog con estrategia de contenidos, optimización SEO y guía de redes sociales. No incluye: gestión de redes sociales ni campañas de pago.</p>',
      phases: [
        { name: 'Auditoría y estrategia', description: '<p>Análisis de la presencia digital actual, palabras clave y definición de la estrategia de contenidos.</p>', order: 0 },
        { name: 'Diseño y desarrollo web', description: '<p>Nueva web centrada en la experiencia del paciente, con reserva de cita y sección de especialidades.</p>', order: 1 },
        { name: 'Estrategia de contenidos', description: '<p>Calendario editorial, 10 artículos SEO de base y guía de redes sociales.</p>', order: 2 },
        { name: 'Lanzamiento y seguimiento', description: '<p>Go-live, configuración de Analytics y revisión de resultados al mes del lanzamiento.</p>', order: 3 },
      ],
    },
    timeline: [
      { phase: 'Auditoría y estrategia', startDate: '2026-03-22', endDate: '2026-04-03' },
      { phase: 'Diseño y desarrollo web', startDate: '2026-04-06', endDate: '2026-05-01' },
      { phase: 'Estrategia de contenidos', startDate: '2026-04-20', endDate: '2026-05-15' },
      { phase: 'Lanzamiento y seguimiento', startDate: '2026-05-18', endDate: '2026-05-29' },
    ],
    budgetTable: {
      items: [
        { id: '1', concept: 'Auditoría digital y estrategia SEO', time: '16h', price: 1600, notes: '' },
        { id: '2', concept: 'Diseño y desarrollo web en Webflow', time: '52h', price: 5200, notes: '' },
        { id: '3', concept: '10 artículos SEO + calendario editorial', time: '20h', price: 2000, notes: '' },
        { id: '4', concept: 'Guía de redes sociales', time: '6h', price: 600, notes: '' },
        { id: '5', concept: 'Lanzamiento, Analytics y seguimiento', time: '4h', price: 400, notes: '' },
      ],
      subtotal: 9800,
      taxRate: 0,
      total: 9800,
    },
    budgetTableAdditional: {
      enabled: false,
      label: '',
      items: [],
      subtotal: 0,
      total: 0,
    },
    acceptanceConditions: {
      paymentTerms: '<p>50% al inicio, 50% al lanzamiento de la web.</p>',
      acceptanceCriteria: '<p>El proyecto se considera finalizado con la publicación de la web y la entrega de los materiales de contenidos acordados.</p>',
      clientResponsibilities: '<p>La clínica facilitará fotografías del equipo, textos de especialidades y acceso al dominio y hosting antes del inicio.</p>',
      penaltyClause: '<p>Los retrasos en la provisión de materiales por parte del cliente podrán retrasar las fechas de entrega sin coste adicional para treseiscero.</p>',
      annexes: '',
      dataProtection: '<p>El tratamiento de datos de pacientes es responsabilidad exclusiva de la clínica como responsable del fichero. treseiscero actuará como encargado del tratamiento solo para los datos estrictamente necesarios en el desarrollo del proyecto.</p>',
    },
    billingConditions: '<p>50% al inicio del proyecto y 50% al lanzamiento. Pago por transferencia bancaria en 15 días desde la emisión de cada factura.</p>',
    conformity: {
      emitterData: '<p>Eric Ruiz — treseiscero</p>',
      clientData: '<p>Dra. Paula Roca — Clínica Sonría</p>',
      signatureStatus: 'unsigned',
      signedAt: null,
    },
    pageBreaksBefore: [],
    sectionOrder: [],
  },

  // 6. Plataforma Web — Inmobiliaria
  {
    slug: '',
    quoteNumber: 'P-2026-007',
    status: 'borrador',
    date: '2026-04-01',
    validUntil: '2026-05-01',
    currency: 'EUR',
    fontName: 'Inter',
    emitter: EMITTER,
    client: {
      name: 'Roberto Torres',
      company: 'Torres Group Inmobiliaria',
      email: 'rtorres@torresgroup.es',
      address: 'Gran Vía 68, Madrid',
      taxId: 'B77889900',
      description: '<p>Grupo inmobiliario con más de 200 propiedades en cartera y oficinas en Madrid, Valencia y Málaga.</p>',
    },
    project: {
      mainObjective: '<p>Diseño y desarrollo de plataforma web con buscador de propiedades, área privada para clientes y CRM básico integrado.</p>',
      collaborationModel: '',
      scope: '<p>Incluye: diseño UX/UI completo, desarrollo frontend en Next.js, buscador de propiedades con filtros avanzados, área privada de cliente y panel de gestión para el equipo comercial. No incluye: app móvil nativa ni integración con ERPs de terceros.</p>',
      phases: [
        { name: 'Discovery y arquitectura', description: '<p>Análisis de necesidades, definición de flujos de usuario y arquitectura de la plataforma.</p>', order: 0 },
        { name: 'Diseño UX/UI', description: '<p>Diseño de todas las vistas: buscador, fichas de propiedad, área privada y panel de gestión.</p>', order: 1 },
        { name: 'Desarrollo frontend', description: '<p>Implementación en Next.js con integración de API de propiedades y sistema de autenticación.</p>', order: 2 },
        { name: 'Panel de gestión y CRM', description: '<p>Desarrollo del panel interno para el equipo comercial con gestión de leads y propiedades.</p>', order: 3 },
        { name: 'QA, lanzamiento y formación', description: '<p>Pruebas exhaustivas, migración de datos, go-live y formación al equipo.</p>', order: 4 },
      ],
    },
    timeline: [
      { phase: 'Discovery y arquitectura', startDate: '2026-04-07', endDate: '2026-04-17' },
      { phase: 'Diseño UX/UI', startDate: '2026-04-20', endDate: '2026-05-22' },
      { phase: 'Desarrollo frontend', startDate: '2026-05-25', endDate: '2026-07-03' },
      { phase: 'Panel de gestión y CRM', startDate: '2026-06-15', endDate: '2026-07-17' },
      { phase: 'QA, lanzamiento y formación', startDate: '2026-07-20', endDate: '2026-07-31' },
    ],
    budgetTable: {
      items: [
        { id: '1', concept: 'Discovery, arquitectura y definición técnica', time: '24h', price: 2880, notes: '' },
        { id: '2', concept: 'Diseño UX/UI de la plataforma (30 vistas)', time: '80h', price: 9600, notes: '' },
        { id: '3', concept: 'Desarrollo frontend en Next.js', time: '64h', price: 7680, notes: '' },
        { id: '4', concept: 'Panel de gestión y CRM básico', time: '24h', price: 2880, notes: '' },
        { id: '5', concept: 'QA, optimización y lanzamiento', time: '16h', price: 1920, notes: '' },
      ],
      subtotal: 24960,
      taxRate: 0,
      total: 24960,
    },
    budgetTableAdditional: {
      enabled: false,
      label: '',
      items: [],
      subtotal: 0,
      total: 0,
    },
    acceptanceConditions: {
      paymentTerms: '<p>30% al inicio, 30% al aprobar los diseños, 30% al aprobar el desarrollo, 10% al lanzamiento.</p>',
      acceptanceCriteria: '<p>Cada fase se cierra con la aprobación escrita del cliente. El proyecto se considera finalizado con el lanzamiento en producción y la sesión de formación completada.</p>',
      clientResponsibilities: '<p>Torres Group proporcionará acceso a la API de propiedades, base de datos de clientes (anonimizada para desarrollo) y un interlocutor técnico disponible durante todo el proyecto.</p>',
      penaltyClause: '<p>Bloqueos superiores a 10 días hábiles por falta de material o decisiones pendientes del cliente podrán generar un ajuste en el calendario y un cargo adicional por coordinación.</p>',
      annexes: '',
      dataProtection: '<p>Los datos de clientes del área privada serán responsabilidad de Torres Group. treseiscero implementará las medidas técnicas necesarias conforme al RGPD y firmará el correspondiente contrato de encargo de tratamiento.</p>',
    },
    billingConditions: '<p>Cuatro hitos de facturación: 30% inicio, 30% diseños aprobados, 30% desarrollo completado, 10% lanzamiento. Pago por transferencia en 15 días desde la emisión de cada factura.</p>',
    conformity: {
      emitterData: '<p>Eric Ruiz — treseiscero</p>',
      clientData: '<p>Roberto Torres — Torres Group Inmobiliaria</p>',
      signatureStatus: 'unsigned',
      signedAt: null,
    },
    pageBreaksBefore: [],
    sectionOrder: [],
  },
]

export default function SeedPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (ran.current) return
    ran.current = true

    async function seed() {
      try {
        const companyId = await getUserCompanyId(user!.uid)
        if (!companyId) {
          router.replace('/dashboard')
          return
        }
        for (const quote of DEMO_QUOTES) {
          await createQuote(quote, user!.uid, companyId)
        }
        router.replace('/dashboard')
      } catch (e) {
        console.error('Seed error:', e)
        router.replace('/dashboard')
      }
    }

    seed()
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border border-ink border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-ink-60">Creando presupuestos de demo...</p>
      </div>
    </div>
  )
}
