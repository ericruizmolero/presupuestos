export type QuoteStatus = 'borrador' | 'enviado' | 'aceptado' | 'rechazado'
export type Currency = 'EUR' | 'USD' | 'MXN'
export type SignatureStatus = 'unsigned' | 'pending' | 'signed'

export interface Font {
  name: string
  url: string
  format: 'ttf' | 'otf' | 'woff2'
}

export interface DefaultConditions {
  paymentTerms: string
  acceptanceCriteria: string
  clientResponsibilities: string
  penaltyClause: string
  dataProtection: string
}

export interface Company {
  id: string
  name: string
  logoUrl: string
  email: string
  address: string
  city: string
  taxId: string
  description: string
  representativeName: string
  representativeRole: string
  defaultConditions: DefaultConditions
  fonts: Font[]
  defaultFontName: string
  paletteId: string
  themeColors?: {
    accent:   string
    onAccent: string
    paper:    string
    surface:  string
    ink:      string
    line:     string
  }
  inkOpacitySecondary?: number
  inkOpacityTertiary?: number
}

export interface EmitterInfo {
  companyName: string
  logoUrl: string
  email: string
  address: string
  city: string
  taxId: string
  description: string
  representativeName: string
  representativeRole: string
}

export interface ClientInfo {
  name: string
  company: string
  email: string
  address: string
  city: string
  taxId: string
  description: string
  role: string
}

export interface ProjectPhase {
  name: string
  description: string
  order: number
  icon?: string
}

export interface ProjectInfo {
  mainObjective: string
  collaborationModel: string
  scope: string
  phases: ProjectPhase[]
}

export interface TimelineEntry {
  phase: string
  group?: string
  startDate: string
  endDate: string
  icon?: string
}

export interface BudgetItem {
  id: string
  concept: string
  time: string
  price: number
  notes: string
}

export interface BudgetTable {
  items: BudgetItem[]
  subtotal: number
  taxRate: number
  total: number
  totalLabel?: string
  manualTotal?: string   // overrides calculated total when set (e.g. "2,700–4,500 est.")
  mode?: 'fixed' | 'hourly'   // 'fixed' = precio fijo (default), 'hourly' = T&M por horas
  hourlyRate?: number          // tarifa €/h — solo en modo 'hourly'
}

export interface BudgetTableAdditional {
  enabled: boolean
  label: string
  items: BudgetItem[]
  subtotal: number
  total: number
}

export interface BillingMilestone {
  id: string
  label: string       // "Hito inicial"
  percentage: number  // 50
  description: string // texto libre de condiciones
}

export interface AcceptanceConditions {
  paymentTerms: string
  acceptanceCriteria: string
  clientResponsibilities: string
  penaltyClause: string
  annexes: string
  dataProtection: string
}

export interface Conformity {
  emitterData: string
  clientData: string
  signatureStatus: SignatureStatus
  signedAt: string | null
}

export interface Quote {
  id: string
  slug: string
  createdBy: string
  companyId: string
  status: QuoteStatus
  createdAt: string
  updatedAt: string
  isDemo?: boolean

  quoteNumber: string
  date: string
  validUntil: string
  currency: Currency
  language?: 'es' | 'en'
  fontName: string

  emitter: EmitterInfo
  client: ClientInfo
  project: ProjectInfo
  timeline: TimelineEntry[]
  budgetTable: BudgetTable
  budgetTableAdditional: BudgetTableAdditional
  acceptanceConditions: AcceptanceConditions
  billingConditions: string
  billingMilestones: BillingMilestone[]
  conformity: Conformity
  accessPassword?: string
  pageBreaksBefore?: string[]
  sectionOrder?: string[]
  sectionSpacing?: Record<string, { top: number; bottom: number }>
  sectionHtmlOverrides?: Record<string, string>
  sectionsMerged?: string[]
}

export type QuoteFormData = Omit<Quote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'companyId'>
