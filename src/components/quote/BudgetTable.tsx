'use client'

import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
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

export function BudgetTable({ value, onChange, currency = 'EUR' }: Props) {
  const INPUT = 'w-full px-3 py-2 text-sm border-0 focus:outline-none bg-transparent'
  const mode = value.mode ?? 'fixed'
  const isHourly = mode === 'hourly'

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n)

  function setMode(m: 'fixed' | 'hourly') {
    onChange({ ...value, mode: m, manualTotal: undefined })
  }

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

  return (
    <div className="border border-line rounded-md overflow-hidden">

      {/* Mode toggle */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-surface">
        <span className="text-xs text-ink-40 font-medium uppercase tracking-widest">Modo</span>
        <div className="flex items-center gap-1 bg-paper border border-line rounded-md p-0.5">
          {(['fixed', 'hourly'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`text-xs px-3 py-1 rounded transition-all ${
                mode === m
                  ? 'bg-accent text-on-accent font-medium'
                  : 'text-ink-60 hover:text-ink'
              }`}
            >
              {m === 'fixed' ? 'Precio fijo' : 'Por horas'}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase text-ink-60">Concepto</th>
            {isHourly ? (
              <th className="px-4 py-3 text-xs font-medium tracking-widest uppercase text-ink-60 w-44 text-center">
                Horas (mín — máx)
              </th>
            ) : (
              <>
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase text-ink-60 w-36">Tiempo</th>
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase text-ink-60 w-32">Precio</th>
              </>
            )}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {value.items.map((item, idx) => (
            <tr key={item.id} className={`border-b border-line ${idx % 2 === 0 ? 'bg-paper' : 'bg-surface'}`}>
              <td className="px-2 py-1 align-top">
                <input
                  className={INPUT + ' text-ink'}
                  placeholder="Concepto o descripción"
                  value={item.concept}
                  onChange={(e) => updateItem(item.id, 'concept', e.target.value)}
                />
                <textarea
                  className="w-full px-3 pb-1 text-xs border-0 focus:outline-none bg-transparent text-ink-60 placeholder-ink-40 resize-none leading-relaxed"
                  placeholder="Añadir descripción..."
                  rows={1}
                  value={item.notes || ''}
                  ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                  onChange={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                    updateItem(item.id, 'notes', e.target.value)
                  }}
                />
              </td>
              {isHourly ? (
                /* Min / Max hours inputs */
                <td className="px-4 py-1 align-top">
                  <div className="flex items-center gap-1.5 pt-2">
                    <input
                      className="w-14 py-1 px-2 text-sm border border-line rounded focus:border-ink focus:outline-none bg-paper text-ink text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      type="number" min={0} placeholder="0"
                      value={item.minHours ?? ''}
                      onChange={(e) => updateItem(item.id, 'minHours', parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-ink-40 text-xs">—</span>
                    <input
                      className="w-14 py-1 px-2 text-sm border border-line rounded focus:border-ink focus:outline-none bg-paper text-ink text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      type="number" min={0} placeholder="0"
                      value={item.maxHours ?? ''}
                      onChange={(e) => updateItem(item.id, 'maxHours', parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-ink-40 text-xs">h</span>
                  </div>
                </td>
              ) : (
                <>
                  <td className="px-2 py-1 align-top">
                    <input
                      className={INPUT + ' text-ink-60'}
                      placeholder="ej: 40h"
                      value={item.time}
                      onChange={(e) => updateItem(item.id, 'time', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-1 align-top">
                    <input
                      className="w-full py-2 text-sm border-0 focus:outline-none bg-transparent text-left text-ink [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      type="number" min={0}
                      value={item.price || ''}
                      onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </>
              )}
              <td className="px-2 py-2 text-center align-top">
                <div className="pt-1.5">
                  <button onClick={() => removeItem(item.id)} className="text-ink-40 hover:text-[#DC2626] transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-4 py-2">
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 text-sm text-ink-60 hover:text-ink transition-colors"
        >
          <Plus size={14} strokeWidth={2} /> Añadir línea
        </button>
      </div>

      {/* Footer */}
      {isHourly ? (
        /* Hourly mode footer: rate input + auto-calculated range */
        <div className="border-t border-line px-4 py-3 flex items-center justify-between gap-4">
          {/* Rate input */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-60 shrink-0">Tarifa</span>
            <input
              className="w-16 py-1 px-2 text-sm border border-line rounded focus:border-ink focus:outline-none bg-paper text-ink text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              type="number" min={0} placeholder="90"
              value={value.hourlyRate ?? ''}
              onChange={(e) => onChange({ ...value, hourlyRate: parseFloat(e.target.value) || undefined })}
            />
            <span className="text-sm text-ink-60">€/h</span>
          </div>
          {/* Auto-calculated total range */}
          {(() => {
            const rate = value.hourlyRate ?? 0
            const minH = value.items.reduce((s, i) => s + (i.minHours ?? 0), 0)
            const maxH = value.items.reduce((s, i) => s + (i.maxHours ?? 0), 0)
            if (!minH && !maxH) return null
            const hoursLabel = minH === maxH ? `${minH}h` : `${minH}–${maxH}h`
            const totalLabel = rate
              ? (minH === maxH
                  ? fmt(minH * rate)
                  : `${fmt(minH * rate)} – ${fmt(maxH * rate)}`)
              : hoursLabel
            return (
              <div className="text-right">
                <p className="text-xs text-ink-40">{hoursLabel}</p>
                <p className="text-sm font-medium text-ink">{totalLabel}</p>
              </div>
            )
          })()}
        </div>
      ) : (
        /* Fixed price footer */
        <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-4">
          <input
            className="px-3 py-2 text-sm border-0 focus:outline-none bg-transparent text-ink min-w-0"
            value={value.totalLabel ?? 'Total (IVA no incluido)'}
            placeholder="Total (IVA no incluido)"
            onChange={(e) => onChange({ ...value, totalLabel: e.target.value })}
          />
          <input
            className="text-sm font-medium text-ink text-right bg-transparent border-0 focus:outline-none w-40 shrink-0"
            value={value.manualTotal ?? ''}
            placeholder={fmt(value.subtotal)}
            onChange={(e) => onChange({ ...value, manualTotal: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  )
}
