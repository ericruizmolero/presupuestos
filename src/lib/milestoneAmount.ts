import type { Quote, BillingMilestone } from '@/types/quote'

/**
 * Importe que se muestra en un hito de facturación.
 * Por horas: la tarifa ("horas trabajadas × 70,00 €/h"), porque un % de una horquilla no dice nada.
 * Precio cerrado: el % del subtotal. Sin importe con sentido (0 %), no se muestra.
 */
export function milestoneAmount(quote: Quote, m: BillingMilestone, locale: string): string | null {
  const bt = quote.budgetTable
  const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: quote.currency || 'EUR' }).format(n)
  if (bt?.mode === 'hourly' && bt.hourlyRate) {
    return `${quote.language === 'en' ? 'hours worked' : 'horas trabajadas'} × ${fmt(bt.hourlyRate)}/h`
  }
  const subtotal = bt?.subtotal || 0
  if (subtotal > 0 && m.percentage > 0) return fmt((subtotal * m.percentage) / 100)
  return null
}
