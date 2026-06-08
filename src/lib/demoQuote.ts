import type { QuoteFormData } from '@/types/quote'
import { nanoid } from 'nanoid'

/**
 * Returns a fully-populated demo quote.
 * Timeline dates are calculated relative to `anchorDate` (ISO string, defaults to today).
 */
export function createDemoQuote(anchorDate?: string): QuoteFormData {
  const anchor = anchorDate ? new Date(anchorDate) : new Date()

  function offset(days: number): string {
    const d = new Date(anchor)
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  const quoteDate  = offset(-5)
  const validUntil = offset(25)

  return {
    slug: `demo-mercado-urbano-${nanoid(6)}`,
    isDemo: true,
    status: 'enviado',
    quoteNumber: 'PRE-2026-001',
    date: quoteDate,
    validUntil,
    currency: 'EUR',
    fontName: '',

    // ── Emisor ───────────────────────────────────────────────────────────────
    emitter: {
      companyName:        'Estudio Forma',
      logoUrl:            '',
      email:              'hola@estudioforma.es',
      address:            'Calle de Fuencarral 42, 1ª planta\n28004 Madrid',
      city:               'Madrid',
      taxId:              'B-12345678',
      representativeName: 'Laura Gómez Reyes',
      representativeRole: 'Directora creativa',
      description:
        '<p>Estudio de diseño estratégico especializado en identidad de marca, sistemas visuales y experiencia digital. Trabajamos con empresas que quieren construir marcas con criterio y coherencia.</p><p>Con más de ocho años de experiencia en el sector, hemos desarrollado proyectos para startups, pymes y marcas consolidadas de toda España y Latinoamérica.</p>',
    },

    // ── Cliente ──────────────────────────────────────────────────────────────
    client: {
      name:        'Alejandro Torres',
      company:     'Mercado Urbano SL',
      email:       'alejandro@mercadourbano.es',
      address:     'Paseo de Gràcia 45, 4º 2ª\n08007 Barcelona',
      city:        'Barcelona',
      taxId:       'B-87654321',
      role:        'CEO & Cofundador',
      description:
        '<p>Mercado Urbano es una plataforma de comercio local que conecta productores artesanales y pequeños comerciantes con consumidores de proximidad. Con presencia en cuatro ciudades, busca consolidar su imagen de marca y lanzar su nueva web transaccional.</p>',
    },

    // ── Proyecto ─────────────────────────────────────────────────────────────
    project: {
      mainObjective:
        '<p>Desarrollar un sistema de identidad visual completo para Mercado Urbano que refleje sus valores de proximidad, autenticidad y sostenibilidad, acompañado de un sitio web transaccional optimizado para la conversión y la experiencia de usuario.</p><p>El resultado final debe ser un sistema coherente, escalable y fácilmente aplicable por el equipo interno de la empresa.</p>',

      collaborationModel:
        '<p>El proyecto se desarrollará en <strong>sprints quincenales</strong> con revisiones sincrónicas por videollamada. El cliente designará un interlocutor principal con capacidad de decisión para agilizar los ciclos de feedback.</p><p>Toda la documentación y los entregables se compartirán a través de un espacio de trabajo en Notion. Los archivos de diseño estarán disponibles en Figma con acceso de visualización para el equipo de Mercado Urbano durante toda la duración del proyecto.</p>',

      scope:
        '<p>El alcance de este presupuesto comprende las siguientes líneas de trabajo:</p><ul><li>Auditoría y análisis de la identidad visual actual</li><li>Estrategia de marca: posicionamiento, valores y personalidad</li><li>Diseño del logotipo y sistema de marca (versiones, colores, tipografía)</li><li>Manual de identidad corporativa (PDF interactivo)</li><li>Diseño UX/UI del sitio web (hasta 8 plantillas de página)</li><li>Desarrollo frontend en Next.js + integración con CMS headless</li><li>Integración de pasarela de pago y módulo de pedidos</li><li>Sesión de formación para el equipo interno (2h)</li></ul><p>Quedan fuera del alcance: fotografía de producto, gestión de redes sociales, campañas de publicidad y mantenimiento posterior al lanzamiento.</p>',

      phases: [
        {
          name: 'Descubrimiento',
          description:
            '<p>Sesiones de trabajo con el equipo de Mercado Urbano para entender el negocio, el público objetivo y la competencia. Entregables: brief de marca, moodboard de referencias y definición del tono de comunicación.</p>',
          order: 0,
          icon: 'Search',
        },
        {
          name: 'Estrategia de marca',
          description:
            '<p>Definición del posicionamiento estratégico, los valores de marca y la arquitectura visual. Incluye dos rondas de revisión y presentación ejecutiva al equipo directivo.</p>',
          order: 1,
          icon: 'Compass',
        },
        {
          name: 'Identidad visual',
          description:
            '<p>Diseño del logotipo, paleta cromática, sistema tipográfico, iconografía y elementos gráficos de apoyo. Se presentarán dos propuestas creativas con sus respectivos argumentarios.</p>',
          order: 2,
          icon: 'PenTool',
        },
        {
          name: 'Diseño web',
          description:
            '<p>Arquitectura de información, wireframes de baja fidelidad y diseño UI de alta fidelidad en Figma. Incluye diseño responsivo (desktop, tablet y móvil) y prototipo interactivo navegable.</p>',
          order: 3,
          icon: 'Layout',
        },
        {
          name: 'Desarrollo',
          description:
            '<p>Implementación técnica del sitio web, integración con CMS, pasarela de pago y optimización de rendimiento (Core Web Vitals). Deploy en Vercel con configuración de dominio personalizado.</p>',
          order: 4,
          icon: 'Code',
        },
        {
          name: 'Lanzamiento',
          description:
            '<p>Revisión final, corrección de bugs, sesión de formación con el equipo interno y entrega de todos los archivos fuente. Soporte post-lanzamiento durante 15 días.</p>',
          order: 5,
          icon: 'Zap',
        },
      ],
    },

    // ── Timeline ──────────────────────────────────────────────────────────────
    timeline: [
      { phase: 'Descubrimiento',     group: 'Estrategia',  icon: 'Search',  startDate: offset(0),  endDate: offset(13)  },
      { phase: 'Estrategia de marca',group: 'Estrategia',  icon: 'Compass', startDate: offset(14), endDate: offset(27)  },
      { phase: 'Identidad visual',   group: 'Diseño',      icon: 'PenTool', startDate: offset(28), endDate: offset(55)  },
      { phase: 'Diseño web',         group: 'Diseño',      icon: 'Layout',  startDate: offset(42), endDate: offset(69)  },
      { phase: 'Desarrollo',         group: 'Tecnología',  icon: 'Code',    startDate: offset(70), endDate: offset(97)  },
      { phase: 'Lanzamiento',        group: 'Tecnología',  icon: 'Zap',     startDate: offset(98), endDate: offset(111) },
    ],

    // ── Tabla de presupuesto ──────────────────────────────────────────────────
    budgetTable: {
      items: [
        {
          id: nanoid(8),
          concept: 'Estrategia y descubrimiento de marca',
          time: '2 semanas',
          price: 2400,
          notes: 'Incluye 2 sesiones de trabajo, análisis competitivo y entregables de estrategia',
        },
        {
          id: nanoid(8),
          concept: 'Diseño de identidad visual completa',
          time: '4 semanas',
          price: 7200,
          notes: 'Logotipo, paleta, tipografía, iconografía y manual de marca (PDF interactivo)',
        },
        {
          id: nanoid(8),
          concept: 'UX/UI — Diseño web (8 plantillas)',
          time: '3 semanas',
          price: 5760,
          notes: 'Arquitectura de información, wireframes, diseño UI responsivo y prototipo Figma',
        },
        {
          id: nanoid(8),
          concept: 'Desarrollo frontend (Next.js + CMS)',
          time: '6 semanas',
          price: 9600,
          notes: 'Implementación técnica, integración CMS headless, pasarela de pago y deploy',
        },
        {
          id: nanoid(8),
          concept: 'Formación y entrega de archivos',
          time: '1 semana',
          price: 720,
          notes: 'Sesión de onboarding de 2h + documentación técnica + todos los archivos fuente',
        },
      ],
      subtotal: 25680,
      taxRate: 21,
      total: 31072.80,
    },

    // ── Tabla adicional ───────────────────────────────────────────────────────
    budgetTableAdditional: {
      enabled: true,
      label: 'Costes de terceros estimados',
      items: [
        {
          id: nanoid(8),
          concept: 'Licencia tipografía comercial',
          time: '—',
          price: 480,
          notes: 'Licencia web + desktop para la familia tipográfica principal seleccionada',
        },
        {
          id: nanoid(8),
          concept: 'Hosting y dominio (primer año)',
          time: '—',
          price: 240,
          notes: 'Vercel Pro + dominio .es registrado a nombre del cliente',
        },
        {
          id: nanoid(8),
          concept: 'Pasarela de pago (Stripe)',
          time: '—',
          price: 0,
          notes: 'Sin coste de integración; comisiones según tarifa Stripe (1,5% + 0,25 € por transacción)',
        },
      ],
      subtotal: 720,
      total: 720,
    },

    // ── Condiciones de aceptación ─────────────────────────────────────────────
    acceptanceConditions: {
      paymentTerms:
        '<p>El pago se estructura en tres hitos vinculados al avance del proyecto, tal y como se detalla en la sección de condiciones de facturación.</p><p>Todos los pagos se realizarán por transferencia bancaria en un plazo máximo de <strong>7 días naturales</strong> desde la emisión de la factura correspondiente. El retraso en los pagos podrá suspender el avance del proyecto hasta la regularización.</p>',

      acceptanceCriteria:
        '<p>Cada entregable se considerará aceptado cuando el cliente confirme su aprobación por escrito (email o mensaje en Notion). En ausencia de respuesta en un plazo de <strong>5 días laborables</strong> desde la entrega, el entregable se tendrá por aceptado tácitamente y el proyecto avanzará a la siguiente fase.</p><p>Se incluyen hasta <strong>dos rondas de revisión</strong> por entregable. Las revisiones adicionales se facturarán a razón de 120 €/h.</p>',

      clientResponsibilities:
        '<ul><li>Designar un interlocutor con capacidad de decisión antes del inicio del proyecto</li><li>Facilitar accesos, contraseñas y materiales existentes en los primeros 3 días laborables</li><li>Revisar y aprobar (o comentar) los entregables en el plazo indicado en cada fase</li><li>Garantizar la disponibilidad del interlocutor para las reuniones de sprint (máx. 2h quincenales)</li><li>Proporcionar el contenido textual definitivo antes del inicio de la fase de desarrollo</li></ul>',

      penaltyClause:
        '<p>Si el proyecto se paraliza por causas imputables al cliente durante más de <strong>30 días naturales</strong>, Estudio Forma se reserva el derecho a facturar el trabajo realizado hasta esa fecha y a renegociar las condiciones de reanudación.</p><p>En caso de cancelación por parte del cliente una vez iniciado el proyecto, se facturará el 100% del trabajo ejecutado hasta ese momento, más una penalización del <strong>15%</strong> sobre el importe pendiente en concepto de lucro cesante.</p>',

      annexes:
        '<p>Se adjunta a este presupuesto:</p><ul><li><strong>Anexo A</strong> — Brief de proyecto y alcance detallado (Notion)</li><li><strong>Anexo B</strong> — Ejemplos de referencias visuales y moodboard inicial</li><li><strong>Anexo C</strong> — Propuesta técnica de arquitectura web</li></ul>',

      dataProtection:
        '<p>En cumplimiento del RGPD y la Ley Orgánica 3/2018 (LOPDGDD), los datos personales facilitados serán tratados por Estudio Forma con la finalidad exclusiva de gestionar la prestación de servicios contratados. Los datos no serán cedidos a terceros salvo obligación legal.</p><p>El cliente puede ejercer sus derechos de acceso, rectificación y supresión escribiendo a <strong>privacidad@estudioforma.es</strong>.</p>',
    },

    // ── Hitos de facturación ──────────────────────────────────────────────────
    billingConditions: '',
    billingMilestones: [
      {
        id: nanoid(8),
        label: 'Pago inicial 40%',
        percentage: 40,
        description: 'A la firma del presupuesto. Necesario para reservar la fecha de inicio y comenzar la fase de descubrimiento.',
      },
      {
        id: nanoid(8),
        label: 'Entrega de identidad 30%',
        percentage: 30,
        description: 'A la aprobación de la identidad visual completa (logotipo, manual de marca y sistema tipográfico).',
      },
      {
        id: nanoid(8),
        label: 'Lanzamiento web 30%',
        percentage: 30,
        description: 'Al lanzamiento del sitio web en producción y entrega de todos los archivos fuente al cliente.',
      },
    ],

    // ── Conformidad ───────────────────────────────────────────────────────────
    conformity: {
      emitterData:  '',
      clientData:   '',
      signatureStatus: 'unsigned',
      signedAt: null,
    },

    pageBreaksBefore: [],
  }
}
