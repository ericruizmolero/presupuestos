import type { QuoteFormData, Company, BillingMilestone } from '@/types/quote'

function mid() { return Math.random().toString(36).slice(2, 10) }

const DEFAULT_MILESTONES: BillingMilestone[] = [
  {
    id: mid(),
    label: 'Hito inicial 50%',
    percentage: 50,
    description: 'La forma de pago será a la recepción de la factura que será emitida cuando comience el proyecto.',
  },
  {
    id: mid(),
    label: 'Hito final 50%',
    percentage: 50,
    description: 'La forma de pago será a la recepción de la factura que será emitida cuando el trabajo esté completado.',
  },
]

export function createDefaultQuote(company?: Partial<Company> | null): QuoteFormData {
  const today = new Date().toISOString().split('T')[0]
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  return {
    slug: '',
    status: 'borrador',
    quoteNumber: '',
    date: today,
    validUntil,
    currency: 'EUR',
    fontName: company?.defaultFontName ?? '',

    emitter: {
      companyName: company?.name ?? '',
      logoUrl: company?.logoUrl ?? '',
      email: company?.email ?? '',
      address: company?.address ?? '',
      city: company?.city ?? '',
      taxId: company?.taxId ?? '',
      description: company?.description ?? '',
      representativeName: company?.representativeName ?? '',
      representativeRole: company?.representativeRole ?? '',
    },

    client: {
      name: '',
      company: '',
      email: '',
      address: '',
      city: '',
      taxId: '',
      description: '',
      role: '',
    },

    project: {
      mainObjective: '',
      collaborationModel: '',
      scope: '',
      phases: [],
    },

    timeline: [
      {
        phase: 'Kick-off',
        group: '',
        icon: 'video',
        startDate: today,
        endDate: today,
      },
    ],

    budgetTable: {
      items: [],
      subtotal: 0,
      taxRate: 21,
      total: 0,
    },

    budgetTableAdditional: {
      enabled: false,
      label: 'Servicios adicionales',
      items: [],
      subtotal: 0,
      total: 0,
    },

    acceptanceConditions: {
      paymentTerms: company?.defaultConditions?.paymentTerms ?? '',
      acceptanceCriteria: company?.defaultConditions?.acceptanceCriteria ?? '',
      clientResponsibilities: company?.defaultConditions?.clientResponsibilities ?? '',
      penaltyClause: company?.defaultConditions?.penaltyClause ?? '',
      annexes: '',
      dataProtection: company?.defaultConditions?.dataProtection ?? '',
    },

    billingConditions: '',
    billingMilestones: DEFAULT_MILESTONES.map(m => ({ ...m, id: mid() })),

    pageBreaksBefore: [],

    conformity: {
      emitterData: '',
      clientData: '',
      signatureStatus: 'unsigned',
      signedAt: null,
    },
  }
}
