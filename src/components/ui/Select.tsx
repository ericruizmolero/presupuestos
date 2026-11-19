'use client'

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

type Opt = { value: string; label: React.ReactNode; disabled?: boolean }

/** Saca las <option> de los children (también dentro de fragments y arrays) */
function readOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = []
  React.Children.forEach(children, (ch) => {
    if (!React.isValidElement(ch)) return
    const el = ch as React.ReactElement<{ value?: unknown; children?: React.ReactNode; disabled?: boolean }>
    if (el.type === 'option') {
      out.push({ value: String(el.props.value ?? ''), label: el.props.children, disabled: el.props.disabled })
    } else if (el.props.children) {
      out.push(...readOptions(el.props.children))
    }
  })
  return out
}

interface Props {
  value?: string | number | readonly string[]
  onChange?: (e: { target: { value: string } }) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  children: React.ReactNode
  /** Clases del botón (borde, padding, tamaño de letra…) */
  className?: string
  /** compact: para filas y tablas; el resto, como un campo de formulario */
  size?: 'compact' | 'field'
  disabled?: boolean
  'aria-label'?: string
  /** Pinta un icono o color delante de cada opción (y en el botón) */
  decorate?: (value: string) => React.ReactNode
}

/**
 * Desplegable propio (sustituye al <select> nativo). Misma API que un select:
 * <Select value onChange={(e) => e.target.value}><option …/></Select>
 */
export function Select({ value, onChange, onKeyDown, children, className = '', size = 'field', disabled, decorate, ...rest }: Props) {
  const options = readOptions(children)
  const current = options.find((o) => o.value === String(value ?? ''))
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; up: boolean } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()

  function place() {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const up = r.bottom + 260 > window.innerHeight && r.top > 260
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, minWidth: r.width, up })
  }

  function openMenu() {
    if (disabled) return
    place()
    setHi(Math.max(0, options.findIndex((o) => o.value === String(value ?? ''))))
    setOpen(true)
  }

  function pick(o: Opt) {
    if (o.disabled) return
    setOpen(false)
    btn.current?.focus()
    if (o.value !== String(value ?? '')) onChange?.({ target: { value: o.value } })
  }

  useLayoutEffect(() => {
    if (!open || !list.current) return
    const r = list.current.getBoundingClientRect()
    // que no se salga por la derecha
    if (r.right > window.innerWidth - 8) setPos((p) => (p ? { ...p, left: Math.max(8, window.innerWidth - 8 - r.width) } : p))
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      const t = e.target as Node
      if (list.current?.contains(t) || btn.current?.contains(t)) return
      setOpen(false)
    }
    const reflow = (e: Event) => { if (!list.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', reflow, true)
    window.addEventListener('resize', reflow)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', reflow, true)
      window.removeEventListener('resize', reflow)
    }
  }, [open])

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi, open])

  function key(e: React.KeyboardEvent) {
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(options.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[hi]) pick(options[hi]) }
    else if (e.key === 'Tab') setOpen(false)
  }

  const base = size === 'compact'
    ? 'inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-md border border-line bg-paper text-xs text-ink-60 hover:border-input hover:text-ink'
    : 'flex items-center justify-between gap-2 text-left'

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={rest['aria-label']}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={key}
        className={`${base} transition-colors focus:outline-none focus-visible:border-accent disabled:opacity-50 ${open ? 'border-input text-ink' : ''} ${className}`}
      >
        {current && decorate?.(current.value)}
        <span className="truncate">{current?.label ?? ''}</span>
        <ChevronDown
          size={size === 'compact' ? 12 : 15}
          strokeWidth={1.75}
          className={`shrink-0 text-ink-40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <ul
          ref={list}
          id={id}
          role="listbox"
          style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth, transform: pos.up ? 'translateY(-100%)' : undefined }}
          className="fixed z-[100] max-h-64 overflow-y-auto rounded-lg border border-line bg-paper p-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
        >
          {options.map((o, i) => {
            const sel = o.value === String(value ?? '')
            return (
              <li
                key={o.value + i}
                data-i={i}
                role="option"
                aria-selected={sel}
                aria-disabled={o.disabled}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={`flex items-center gap-2 pl-2.5 pr-2.5 py-1.5 rounded-md cursor-pointer whitespace-nowrap ${size === 'compact' ? 'text-xs' : 'text-sm'} ${
                  o.disabled ? 'opacity-40 cursor-default' : ''
                } ${i === hi ? 'bg-surface' : ''} ${sel ? 'text-ink font-medium' : 'text-ink-60'}`}
              >
                {decorate ? decorate(o.value) : <Check size={12} strokeWidth={2.25} className={`shrink-0 ${sel ? 'text-ink' : 'invisible'}`} />}
                {o.label}
                {decorate && sel && <Check size={12} strokeWidth={2.25} className="ml-auto pl-2 shrink-0 text-ink" />}
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </>
  )
}
