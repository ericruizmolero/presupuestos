import type { QuoteFormData, Company } from '@/types/quote'

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
      taxId: company?.taxId ?? '',
      description: company?.description ?? '',
    },

    client: {
      name: '',
      company: '',
      email: '',
      address: '',
      taxId: '',
      description: '',
    },

    project: {
      mainObjective: '',
      collaborationModel: '',
      scope: '',
      phases: [],
    },

    timeline: [],

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

    conformity: {
      emitterData: '',
      clientData: '',
      signatureStatus: 'unsigned',
      signedAt: null,
    },
  }
}
