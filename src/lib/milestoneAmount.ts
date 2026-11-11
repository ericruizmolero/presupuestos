import type { Quote, BillingMilestone } from '@/types/quote'

/**
 * Importe que se muestra en un hito de facturación. Igual que siempre (% del subtotal), salvo un caso:
 * un hito al 0 % en un presupuesto por horas, que antes salía como "0,00 €" y ahora muestra la tarifa.
 */
export function milestoneAmount(quote: Quote, m: BillingMilestone, locale: string): string | null {
  const bt = quote.budgetTable
  const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: quote.currency || 'EUR' }).format(n)
  const subtotal = bt?.subtotal || 0
  if (subtotal <= 0) return null
  if (!m.percentage && bt?.mode === 'hourly' && bt.hourlyRate) {
    return `${quote.language === 'en' ? 'hours worked' : 'horas trabajadas'} × ${fmt(bt.hourlyRate)}/h`
  }
  return fmt((subtotal * m.percentage) / 100)
}
