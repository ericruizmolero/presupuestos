'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import type { BudgetItem, BudgetTable as BudgetTableType } from '@/types/quote'
import { nanoid } from 'nanoid'

interface Props {
  value: BudgetTableType
  onChange: (v: BudgetTableType) => void
  currency?: string
  showTax?: boolean
}

function calcTotals(items: BudgetItem[], taxRate: number) {
  const subtotal = items.reduce((s, i) => s + (i.price || 0), 0)
  const total = subtotal * (1 + taxRate / 100)
  return { subtotal, total }
}

export function BudgetTable({ value, onChange, currency = 'EUR', showTax = true }: Props) {
  const INPUT = 'w-full px-3 py-2 text-sm border-0 focus:outline-none bg-transparent'

  function addItem() {
    const newItem: BudgetItem = { id: nanoid(), concept: '', time: '', price: 0, notes: '' }
    const items = [...value.items, newItem]
    const { subtotal, total } = calcTotals(items, value.taxRate)
    onChange({ ...value, items, subtotal, total })
  }

  function updateItem(id: string, field: keyof BudgetItem, v: string | number) {
    const items = value.items.map((item) => (item.id === id ? { ...item, [field]: v } : item))
    const { subtotal, total } = calcTotals(items, value.taxRate)
    onChange({ ...value, items, subtotal, total })
  }

  function removeItem(id: string) {
    const items = value.items.filter((item) => item.id !== id)
    const { subtotal, total } = calcTotals(items, value.taxRate)
    onChange({ ...value, items, subtotal, total })
  }

  function updateTaxRate(rate: number) {
    const { subtotal, total } = calcTotals(value.items, rate)
    onChange({ ...value, taxRate: rate, subtotal, total })
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n)

  return (
    <div className="border border-line rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-accent">
            <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase text-ink-40 w-8" />
            <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase text-ink-60">Concepto</th>
            <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase text-ink-60 w-28">Tiempo</th>
            <th className="text-right px-4 py-3 text-xs font-medium tracking-widest uppercase text-ink-60 w-32">Precio</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {value.items.map((item, idx) => (
            <tr key={item.id} className={`border-b border-line ${idx % 2 === 0 ? 'bg-paper' : 'bg-surface'}`}>
              <td className="px-2 py-2 text-center text-ink-40">
                <GripVertical size={14} />
              </td>
              <td className="px-2 py-1">
                <input
                  className={INPUT + ' text-ink'}
                  placeholder="Concepto o descripción"
                  value={item.concept}
                  onChange={(e) => updateItem(item.id, 'concept', e.target.value)}
                />
              </td>
              <td className="px-2 py-1">
                <input
                  className={INPUT + ' text-ink-60'}
                  placeholder="ej: 40h"
                  value={item.time}
                  onChange={(e) => updateItem(item.id, 'time', e.target.value)}
                />
              </td>
              <td className="px-2 py-1 text-right">
                <input
                  className={INPUT + ' text-right text-ink'}
                  type="number"
                  min={0}
                  value={item.price || ''}
                  onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                />
              </td>
              <td className="px-2 py-2 text-center">
                <button onClick={() => removeItem(item.id)} className="text-ink-40 hover:text-[#DC2626] transition-colors">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-4 py-3 border-t border-line flex items-center justify-between">
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 text-sm text-ink-60 hover:text-ink transition-colors"
        >
          <Plus size={14} strokeWidth={2} /> Añadir línea
        </button>

        <div className="space-y-1 text-sm text-right min-w-[200px]">
          <div className="flex justify-between gap-8 text-ink-60">
            <span>Subtotal</span>
            <span>{fmt(value.subtotal)}</span>
          </div>
          {showTax && (
            <div className="flex justify-between gap-8 items-center text-ink-60">
              <span>IVA (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={value.taxRate}
                onChange={(e) => updateTaxRate(parseFloat(e.target.value) || 0)}
                className="w-16 text-right px-2 py-0.5 border border-line rounded text-sm focus:outline-none focus:border-accent"
              />
            </div>
          )}
          <div className="flex justify-between gap-8 font-medium text-ink pt-1 border-t border-line">
            <span>Total</span>
            <span>{fmt(value.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
