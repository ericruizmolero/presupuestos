export type QuoteLang = 'es' | 'en'

export interface QuoteLabels {
  // Cover / header
  quoteWord: string          // "Presupuesto" / "Proposal"

  // TOC & section headers
  project: string
  phases: string
  timeline: string
  budget: string             // section heading
  billing: string
  conformity: string

  // Project subsections
  aboutClient: (name: string) => string
  mainObjective: string
  collaborationModel: string
  scope: string
  projectPhases: string

  // Budget table
  concept: string
  price: string
  vatNotIncluded: string

  // Acceptance conditions section heading + sub-labels
  acceptanceAndBilling: string
  paymentTerms: string
  acceptanceCriteria: string
  clientResponsibilities: string
  penaltyClause: string
  annexes: string
  dataProtection: string

  // Conformity
  conformityIntro: string
  client: string
  serviceProvider: string
  signatureDate: string

  // Conformity field labels
  company: string
  taxId: string
  address: string
  city: string
  representedBy: string
  role: string

  // Gantt week labels
  weekLabel: (start: number, end: number) => string
  weekShort: (start: number, end: number) => string
}

const es: QuoteLabels = {
  quoteWord: 'Presupuesto',

  project: 'Proyecto',
  phases: 'Fases',
  timeline: 'Timeline',
  budget: 'Presupuesto',
  billing: 'Facturación',
  conformity: 'Conformidad',

  aboutClient: (name) => `Sobre ${name || 'el cliente'}`,
  mainObjective: 'Objetivo principal',
  collaborationModel: 'Modelo de colaboración',
  scope: 'Alcance',
  projectPhases: 'Fases del proyecto',

  concept: 'Concepto',
  price: 'Precio',
  vatNotIncluded: '(IVA no incluido)',

  acceptanceAndBilling: 'Aceptación y facturación',
  paymentTerms: 'Forma de pago',
  acceptanceCriteria: 'Criterios de aceptación',
  clientResponsibilities: 'Responsabilidades del cliente',
  penaltyClause: 'Cláusula de penalización',
  annexes: 'Archivos / Información anexa',
  dataProtection: 'Aceptación del tratamiento de datos personales',

  conformityIntro: 'La firma del presente documento se interpreta como la conformidad y la aceptación de todas las condiciones expuestas en él y el cumplimiento de las mismas.',
  client: 'Cliente',
  serviceProvider: 'Proveedor',
  signatureDate: 'Firma y fecha',

  company: 'Empresa',
  taxId: 'CIF',
  address: 'Dirección',
  city: 'Ciudad',
  representedBy: 'Representada por',
  role: 'Cargo',

  weekLabel: (s, e) => `Semana ${s}-${e}`,
  weekShort: (s, e) => `Sem. ${s}-${e}`,
}

const en: QuoteLabels = {
  quoteWord: 'Proposal',

  project: 'Project',
  phases: 'Phases',
  timeline: 'Timeline',
  budget: 'Pricing',
  billing: 'Billing',
  conformity: 'Agreement',

  aboutClient: (name) => `About ${name || 'the client'}`,
  mainObjective: 'Main objective',
  collaborationModel: 'Collaboration model',
  scope: 'Scope of work',
  projectPhases: 'Project phases',

  concept: 'Description',
  price: 'Price',
  vatNotIncluded: '(excl. tax)',

  acceptanceAndBilling: 'Terms & billing',
  paymentTerms: 'Payment terms',
  acceptanceCriteria: 'Acceptance criteria',
  clientResponsibilities: 'Client responsibilities',
  penaltyClause: 'Penalty clause',
  annexes: 'Annexes / Attached information',
  dataProtection: 'Data processing agreement',

  conformityIntro: 'By signing this document, both parties acknowledge and agree to all the terms and conditions set forth herein.',
  client: 'Client',
  serviceProvider: 'Service provider',
  signatureDate: 'Signature & date',

  company: 'Company',
  taxId: 'Tax ID',
  address: 'Address',
  city: 'City',
  representedBy: 'Represented by',
  role: 'Position',

  weekLabel: (s, e) => `Week ${s}-${e}`,
  weekShort: (s, e) => `Wk. ${s}-${e}`,
}

const translations: Record<QuoteLang, QuoteLabels> = { es, en }

/** Get the label set for a quote's language. Defaults to Spanish. */
export function t(lang: QuoteLang | undefined | null): QuoteLabels {
  return translations[lang ?? 'es'] ?? es
}
