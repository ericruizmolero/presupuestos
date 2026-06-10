/** Editor + AI popup translations — separate from quoteI18n which handles the rendered view */

export type Lang = 'es' | 'en'

const es = {
  // Top bar
  aiStart: 'Empieza el presupuesto con IA',
  aiContinue: 'Completa el presupuesto con IA',
  collapseAll: 'Plegar todo',
  expandAll: 'Desplegar todo',

  // Section headers
  sectionMeta: 'Datos del presupuesto',
  sectionEmitter: 'Empresa emisora',
  sectionClient: 'Empresa receptora / Cliente',
  sectionProject: 'Proyecto',
  sectionPhases: 'Fases',
  sectionTimeline: 'Tareas y tiempos',
  sectionBudget: 'Tabla de presupuesto',
  sectionBudgetAdditional: 'Tabla adicional',
  sectionAcceptance: 'Condiciones de aceptación',
  sectionBilling: 'Condiciones de facturación y pagos',
  sectionConformity: 'Conformidad y firmas',

  // Meta
  quoteNumber: 'Número de presupuesto',
  currency: 'Moneda',
  language: 'Idioma del presupuesto',
  accessPassword: 'Contraseña de acceso',
  accessPasswordHelp: 'El cliente la necesitará para ver el presupuesto.',
  accessPasswordPlaceholder: 'Dejar vacío = sin protección',
  date: 'Fecha',
  validUntil: 'Válido hasta',

  // Shared field labels
  name: 'Nombre',
  email: 'Email',
  taxId: 'CIF / NIF',
  address: 'Dirección',
  city: 'Ciudad',
  representedBy: 'Representada por',
  role: 'Cargo',
  company: 'Empresa',

  // Emitter
  companyDescription: 'Descripción de la empresa',
  phEmitterName: 'Tu empresa S.L.',
  phEmitterEmail: 'hola@tuempresa.com',
  phEmitterTaxId: 'B12345678',
  phAddress: 'Calle, número, CP',
  phCity: 'Ciudad',
  phRepresentative: 'Nombre Apellido',
  phRole: 'Ej: Fundador, CEO…',
  phEmitterDescription: 'Descripción de tu empresa...',

  // Client
  contactName: 'Nombre de contacto',
  clientDescription: 'Descripción de la empresa receptora',
  phClientCompany: 'Empresa del cliente',
  phClientName: 'Nombre Apellido',
  phClientEmail: 'cliente@empresa.com',
  phClientTaxId: 'A12345678',
  phClientRole: 'Ej: CEO, Director…',
  phClientDescription: 'Contexto del cliente...',

  // Project
  mainObjective: 'Objetivo principal',
  collaborationModel: 'Modelo de colaboración',
  optional: 'opcional',
  scope: 'Alcance del proyecto',
  phMainObjective: '¿Qué se quiere conseguir con este proyecto?',
  phCollaborationModel: 'Ej: proyecto cerrado, horas pactadas, retainer mensual...',
  phScope: '¿Qué incluye y qué no incluye este presupuesto?',

  // Phases
  phase: 'Fase',
  phaseName: 'Nombre de la fase',
  phaseDescription: 'Descripción de la fase...',
  addPhase: 'Añadir fase',

  // Timeline
  ganttPreview: 'Vista previa interactiva — arrastra para ajustar fechas',

  // Budget additional
  includeBudgetAdditional: 'Incluir tabla adicional',
  budgetAdditionalTitle: 'Título de la tabla adicional',
  phBudgetAdditionalTitle: 'Ej: Servicios adicionales',

  // Acceptance conditions keys → label
  acceptanceFields: [
    ['paymentTerms',           'Forma de pago'],
    ['acceptanceCriteria',     'Criterios de aceptación'],
    ['clientResponsibilities', 'Responsabilidades del cliente'],
    ['penaltyClause',          'Cláusula de penalización'],
    ['annexes',                'Archivos o información anexa'],
    ['dataProtection',         'Aceptación de tratamiento de datos personales'],
  ] as [string, string][],

  // Billing
  paymentLabel: 'Pago',
  paymentName: 'Nombre',
  paymentPercentage: '% de pago',
  paymentConditions: 'Condiciones de pago',
  paymentNamePlaceholder: 'Pago inicial…',
  paymentConditionsPlaceholder: 'La forma de pago será a la recepción de la factura…',
  amount: 'Importe:',
  vatNotIncluded: '(IVA no incluido)',
  addMilestone: 'Añadir hito',

  // Conformity
  conformityText: 'La firma del presente documento se interpreta como la conformidad y la aceptación de todas las condiciones expuestas en él y el cumplimiento de las mismas.',
  conformityClient: 'Cliente',
  conformitySupplier: 'Proveedor',
  conformitySignature: 'Firma',
  conformityHelpText: 'Configura "Representada por" y "Cargo" del proveedor en',
  conformityHelpLink: 'Configuración',

  // Conformity column rows: [label, emitter-placeholder, client-placeholder]
  conformityRows: [
    ['Empresa',          'Nombre S.L.',          'Empresa del cliente'],
    ['CIF',              'B12345678',             'A12345678'],
    ['Dirección',        'Calle, número, CP',     'Calle, número, CP'],
    ['Ciudad',           'Ciudad',                'Ciudad'],
    ['Representada por', 'Nombre Apellido',       'Nombre Apellido'],
    ['Cargo',            'Ej: Fundador, CEO…',    'Ej: CEO, Director…'],
  ] as [string, string, string][],

  // Toast
  saving: 'Guardando…',
  saved: 'Guardado',
  errorSaving: 'Error al guardar',

  // AI popup UI
  aiPopupStep2: 'Copia este prompt y pégalo en la IA que prefieras.',
  aiPopupStep3: 'Pega aquí la respuesta JSON de la IA y aplica los cambios.',
  aiCopyBtn: 'Copiar',
  aiCopiedBtn: 'Copiado',
  aiOpenIn: 'Abrir en:',
  aiCancel: 'Cancelar',
  aiBack: 'Atrás',
  aiGeneratePrompt: 'Generar prompt',
  aiHaveResponse: 'Ya tengo la respuesta',
  aiApply: 'Aplicar cambios',
  aiApplied: 'Aplicado',
  aiParseError: 'No se pudo leer la respuesta. Asegúrate de pegar solo el JSON.',

  // AI sections: title + description
  aiSections: {
    client:           { title: 'Empresa receptora / Cliente',  description: 'Genera la ficha del cliente con descripción profesional.' },
    project:          { title: 'Proyecto',                     description: 'Genera objetivo, modelo de colaboración y alcance.' },
    phases:           { title: 'Fases del proyecto',           description: 'Genera las fases de trabajo con nombre y descripción.' },
    timeline:         { title: 'Tareas y tiempos',             description: 'Genera el timeline con fechas de inicio y fin por fase.' },
    budget:           { title: 'Tabla de presupuesto',         description: 'Genera los conceptos, tiempos y precios del presupuesto.' },
    budgetAdditional: { title: 'Tabla adicional',              description: 'Genera conceptos para la tabla de servicios adicionales.' },
    acceptance:       { title: 'Condiciones de aceptación',    description: 'Genera las 6 cláusulas legales y de aceptación.' },
    billing:          { title: 'Condiciones de facturación',   description: 'Genera las condiciones de facturación y pagos.' },
    conformity:       { title: 'Conformidad y firmas',         description: 'Genera los bloques de datos para las firmas.' },
    all:              { title: 'Empieza el presupuesto con IA', description: 'Genera todas las secciones del presupuesto de una vez.' },
  },

  // AI questions
  aiQ: {
    linkedin:            { label: 'LinkedIn de la empresa cliente',        placeholder: 'https://linkedin.com/company/...',   helper: 'La IA visitará este perfil para obtener descripción, sector y actividad del cliente.' },
    sector:              { label: 'Sector / industria',                    placeholder: 'Ej: e-commerce de moda, fintech, hostelería…' },
    about:               { label: '¿A qué se dedica el cliente?',          placeholder: 'Breve descripción de su actividad, productos o servicios…' },
    brief:               { label: '¿En qué consiste el proyecto?',         placeholder: 'Describe el proyecto, qué se va a crear o resolver…' },
    problem:             { label: '¿Qué problema resuelve?',               placeholder: 'Necesidad del cliente o dolor que este proyecto soluciona…' },
    model:               { label: 'Modelo de colaboración',                placeholder: 'Ej: proyecto cerrado, retainer mensual, horas pactadas…' },
    outOfScope:          { label: '¿Qué queda fuera del alcance?',         placeholder: 'Ej: mantenimiento posterior, campañas de pago…' },
    type:                { label: 'Tipo de proyecto',                      placeholder: 'Ej: desarrollo web, branding, app móvil, campaña…' },
    numPhases:           { label: 'Número de fases aproximado',            placeholder: 'Ej: 4-5' },
    startDate:           { label: 'Fecha de inicio prevista',              placeholder: 'Ej: 2026-06-01 o "principios de junio"' },
    duration:            { label: 'Duración total estimada',               placeholder: 'Ej: 3 meses, 6 semanas…' },
    service:             { label: 'Tipo de servicio',                      placeholder: 'Ej: diseño web, desarrollo, consultoría…' },
    rate:                { label: 'Tarifa por hora (€)',                    placeholder: 'Ej: 80' },
    deliverables:        { label: 'Entregables principales',               placeholder: 'Lista de lo que se entrega al cliente…' },
    taxRate:             { label: 'IVA (%)',                               placeholder: '21' },
    additionalLabel:     { label: 'Título de la tabla',                    placeholder: 'Ej: Servicios adicionales, Opcionales…' },
    additionalDesc:      { label: '¿Qué incluye esta tabla?',              placeholder: 'Ej: mantenimiento mensual, formación, hosting…' },
    additionalRate:      { label: 'Tarifa por hora (€)',                   placeholder: 'Ej: 80' },
    payment:             { label: 'Forma de pago',                         placeholder: 'Ej: 50% inicio + 50% entrega, 3 cuotas…' },
    acceptanceService:   { label: 'Tipo de servicio / sector',             placeholder: 'Ej: desarrollo web, diseño gráfico…' },
    special:             { label: 'Condiciones especiales',                placeholder: 'Penalizaciones, plazos de revisión, licencias…' },
    billingModel:        { label: 'Modelo de facturación',                 placeholder: 'Ej: por hitos, mensual, al finalizar…' },
    billingDetails:      { label: 'Detalles adicionales',                  placeholder: 'Plazos de pago, penalizaciones por demora…' },
    emitterPerson:       { label: 'Nombre y cargo del firmante emisor',    placeholder: 'Ej: Ana García, Directora de Proyectos' },
    clientPerson:        { label: 'Nombre y cargo del firmante cliente',   placeholder: 'Ej: Juan López, CEO' },
    projectBrief:        { label: 'Describe el proyecto',                  placeholder: 'Ej: Diseño y desarrollo web para e-commerce de moda. 3 meses, inicio junio. Entregables: diseño UI, front-end React, integración pasarela de pago.', helper: 'Cuanto más detalle des, mejor resultado. La IA inferirá fases, timeline y presupuesto a partir de aquí.' },
    allRate:             { label: 'Tarifa hora o presupuesto total',       placeholder: 'Ej: 90€/h — o — Presupuesto cerrado 12.000€', helper: 'Usado para calcular los precios de la tabla de presupuesto.' },
    allPayment:          { label: 'Forma de pago',                         placeholder: 'Ej: 40% inicio, 30% mitad, 30% entrega', defaultValue: '50% inicio y 50% final' },
  },
}

const en: typeof es = {
  // Top bar
  aiStart: 'Start the quote with AI',
  aiContinue: 'Complete the quote with AI',
  collapseAll: 'Collapse all',
  expandAll: 'Expand all',

  // Section headers
  sectionMeta: 'Quote details',
  sectionEmitter: 'Issuing company',
  sectionClient: 'Client / Receiving company',
  sectionProject: 'Project',
  sectionPhases: 'Phases',
  sectionTimeline: 'Tasks & timeline',
  sectionBudget: 'Budget table',
  sectionBudgetAdditional: 'Additional table',
  sectionAcceptance: 'Acceptance conditions',
  sectionBilling: 'Billing & payment conditions',
  sectionConformity: 'Conformity & signatures',

  // Meta
  quoteNumber: 'Quote number',
  currency: 'Currency',
  language: 'Quote language',
  accessPassword: 'Access password',
  accessPasswordHelp: 'The client will need it to view the quote.',
  accessPasswordPlaceholder: 'Leave empty = no protection',
  date: 'Date',
  validUntil: 'Valid until',

  // Shared field labels
  name: 'Name',
  email: 'Email',
  taxId: 'Tax ID',
  address: 'Address',
  city: 'City',
  representedBy: 'Represented by',
  role: 'Role',
  company: 'Company',

  // Emitter
  companyDescription: 'Company description',
  phEmitterName: 'Your Company Ltd.',
  phEmitterEmail: 'hello@yourcompany.com',
  phEmitterTaxId: 'B12345678',
  phAddress: 'Street, number, ZIP',
  phCity: 'City',
  phRepresentative: 'First Last',
  phRole: 'E.g.: Founder, CEO…',
  phEmitterDescription: 'Your company description...',

  // Client
  contactName: 'Contact name',
  clientDescription: 'Client company description',
  phClientCompany: 'Client company',
  phClientName: 'First Last',
  phClientEmail: 'client@company.com',
  phClientTaxId: 'A12345678',
  phClientRole: 'E.g.: CEO, Director…',
  phClientDescription: 'Client context...',

  // Project
  mainObjective: 'Main objective',
  collaborationModel: 'Collaboration model',
  optional: 'optional',
  scope: 'Project scope',
  phMainObjective: 'What is this project trying to achieve?',
  phCollaborationModel: 'E.g.: fixed-price project, agreed hours, monthly retainer...',
  phScope: 'What does and does not this quote include?',

  // Phases
  phase: 'Phase',
  phaseName: 'Phase name',
  phaseDescription: 'Phase description...',
  addPhase: 'Add phase',

  // Timeline
  ganttPreview: 'Interactive preview — drag to adjust dates',

  // Budget additional
  includeBudgetAdditional: 'Include additional table',
  budgetAdditionalTitle: 'Additional table title',
  phBudgetAdditionalTitle: 'E.g.: Additional services',

  // Acceptance conditions keys → label
  acceptanceFields: [
    ['paymentTerms',           'Payment terms'],
    ['acceptanceCriteria',     'Acceptance criteria'],
    ['clientResponsibilities', 'Client responsibilities'],
    ['penaltyClause',          'Penalty clause'],
    ['annexes',                'Annexes & additional files'],
    ['dataProtection',         'Data protection acceptance'],
  ],

  // Billing
  paymentLabel: 'Payment',
  paymentName: 'Name',
  paymentPercentage: 'Payment %',
  paymentConditions: 'Payment conditions',
  paymentNamePlaceholder: 'Initial payment…',
  paymentConditionsPlaceholder: 'Payment will be made upon receipt of the invoice…',
  amount: 'Amount:',
  vatNotIncluded: '(VAT not included)',
  addMilestone: 'Add milestone',

  // Conformity
  conformityText: 'Signing this document implies agreement and acceptance of all the conditions set out herein and commitment to comply with them.',
  conformityClient: 'Client',
  conformitySupplier: 'Provider',
  conformitySignature: 'Signature',
  conformityHelpText: 'Configure "Represented by" and "Role" for the provider in',
  conformityHelpLink: 'Settings',

  // Conformity column rows: [label, emitter-placeholder, client-placeholder]
  conformityRows: [
    ['Company',        'Company Ltd.',       'Client company'],
    ['Tax ID',         'B12345678',          'A12345678'],
    ['Address',        'Street, number, ZIP','Street, number, ZIP'],
    ['City',           'City',               'City'],
    ['Represented by', 'First Last',         'First Last'],
    ['Role',           'E.g.: Founder, CEO…','E.g.: CEO, Director…'],
  ],

  // Toast
  saving: 'Saving…',
  saved: 'Saved',
  errorSaving: 'Error saving',

  // AI popup UI
  aiPopupStep2: 'Copy this prompt and paste it into your preferred AI.',
  aiPopupStep3: "Paste the AI's JSON response here and apply the changes.",
  aiCopyBtn: 'Copy',
  aiCopiedBtn: 'Copied',
  aiOpenIn: 'Open in:',
  aiCancel: 'Cancel',
  aiBack: 'Back',
  aiGeneratePrompt: 'Generate prompt',
  aiHaveResponse: 'I have the response',
  aiApply: 'Apply changes',
  aiApplied: 'Applied',
  aiParseError: 'Could not parse the response. Make sure you paste only the JSON.',

  // AI sections
  aiSections: {
    client:           { title: 'Client / Receiving company',   description: 'Generate the client profile with a professional description.' },
    project:          { title: 'Project',                      description: 'Generate objective, collaboration model and scope.' },
    phases:           { title: 'Project phases',               description: 'Generate work phases with name and description.' },
    timeline:         { title: 'Tasks & timeline',             description: 'Generate the timeline with start and end dates per phase.' },
    budget:           { title: 'Budget table',                 description: 'Generate concepts, time estimates and prices.' },
    budgetAdditional: { title: 'Additional table',             description: 'Generate concepts for the additional services table.' },
    acceptance:       { title: 'Acceptance conditions',        description: 'Generate the 6 legal and acceptance clauses.' },
    billing:          { title: 'Billing conditions',           description: 'Generate billing and payment conditions.' },
    conformity:       { title: 'Conformity & signatures',      description: 'Generate the signature data blocks.' },
    all:              { title: 'Start quote with AI',          description: 'Generate all sections of the quote at once.' },
  },

  // AI questions
  aiQ: {
    linkedin:            { label: 'Client company LinkedIn',            placeholder: 'https://linkedin.com/company/...',   helper: "The AI will visit this profile to get the client's description, sector and activity." },
    sector:              { label: 'Industry / sector',                  placeholder: 'E.g.: fashion e-commerce, fintech, hospitality…' },
    about:               { label: 'What does the client do?',           placeholder: 'Brief description of their activity, products or services…' },
    brief:               { label: 'What does the project involve?',     placeholder: 'Describe the project, what will be created or solved…' },
    problem:             { label: 'What problem does it solve?',        placeholder: 'Client need or pain point this project addresses…' },
    model:               { label: 'Collaboration model',                placeholder: 'E.g.: fixed-price project, monthly retainer, agreed hours…' },
    outOfScope:          { label: 'What is out of scope?',              placeholder: 'E.g.: ongoing maintenance, paid campaigns…' },
    type:                { label: 'Project type',                       placeholder: 'E.g.: web development, branding, mobile app, campaign…' },
    numPhases:           { label: 'Approximate number of phases',       placeholder: 'E.g.: 4-5' },
    startDate:           { label: 'Expected start date',                placeholder: 'E.g.: 2026-06-01 or "early June"' },
    duration:            { label: 'Estimated total duration',           placeholder: 'E.g.: 3 months, 6 weeks…' },
    service:             { label: 'Service type',                       placeholder: 'E.g.: web design, development, consulting…' },
    rate:                { label: 'Hourly rate (€)',                    placeholder: 'E.g.: 80' },
    deliverables:        { label: 'Main deliverables',                  placeholder: 'List of what will be delivered to the client…' },
    taxRate:             { label: 'VAT (%)',                            placeholder: '21' },
    additionalLabel:     { label: 'Table title',                        placeholder: 'E.g.: Additional services, Optional add-ons…' },
    additionalDesc:      { label: 'What does this table include?',      placeholder: 'E.g.: monthly maintenance, training, hosting…' },
    additionalRate:      { label: 'Hourly rate (€)',                    placeholder: 'E.g.: 80' },
    payment:             { label: 'Payment method',                     placeholder: 'E.g.: 50% upfront + 50% on delivery, 3 instalments…' },
    acceptanceService:   { label: 'Service type / sector',             placeholder: 'E.g.: web development, graphic design…' },
    special:             { label: 'Special conditions',                 placeholder: 'Penalties, review deadlines, licences…' },
    billingModel:        { label: 'Billing model',                      placeholder: 'E.g.: by milestones, monthly, upon completion…' },
    billingDetails:      { label: 'Additional details',                 placeholder: 'Payment deadlines, late payment penalties…' },
    emitterPerson:       { label: 'Issuer signatory name & role',       placeholder: 'E.g.: Anna Smith, Project Director' },
    clientPerson:        { label: 'Client signatory name & role',       placeholder: 'E.g.: John Doe, CEO' },
    projectBrief:        { label: 'Describe the project',              placeholder: 'E.g.: UI/UX design and dev for a fashion e-commerce. 3 months, starting June. Deliverables: UI design, React front-end, payment gateway integration.', helper: 'The more detail you provide, the better the result. The AI will infer phases, timeline and budget from this.' },
    allRate:             { label: 'Hourly rate or total budget',        placeholder: 'E.g.: 90€/h — or — Fixed budget €12,000', helper: 'Used to calculate prices in the budget table.' },
    allPayment:          { label: 'Payment method',                     placeholder: 'E.g.: 40% upfront, 30% mid-project, 30% on delivery', defaultValue: '50% upfront and 50% on delivery' },
  },
}

export const EDITOR_I18N: Record<Lang, typeof es> = { es, en }
export type EditorT = typeof es
