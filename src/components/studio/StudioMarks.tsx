'use client'

import { FACES, logoFor, initials } from '@/lib/studioAssets'
import { ImageIcon } from 'lucide-react'

type Who = 'Eric' | 'Andoni' | 'Eric y Andoni'

function asWho(value?: string): Who {
  return value === 'Eric' || value === 'Andoni' ? value : 'Eric y Andoni'
}

/** Cara redonda; para "Eric y Andoni" las dos superpuestas */
export function Faces({ who, size = 22, ring = 'var(--color-paper)' }: { who?: string; size?: number; ring?: string }) {
  const w = asWho(who)
  const people: Array<'Eric' | 'Andoni'> = w === 'Eric y Andoni' ? ['Eric', 'Andoni'] : [w]
  return (
    <span className="inline-flex items-center shrink-0" aria-label={w === 'Eric y Andoni' ? 'Eric y Andoni' : w}>
      {people.map((p, i) => (
        <img
          key={p}
          src={FACES[p]}
          alt={p}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{
            width: size,
            height: size,
            marginLeft: i > 0 ? -Math.round(size * 0.32) : 0,
            boxShadow: `0 0 0 1.5px ${ring}`,
          }}
        />
      ))}
    </span>
  )
}

/**
 * Pastilla del proyecto + nombre. Por defecto, inicial sobre el color del
 * proyecto; si el proyecto activa showLogo y hay logo, la pastilla lleva el logo.
 */
export function ProjectMark({
  name, color, showLogo = false, size = 22, compact = false, onBadgeClick, onToggleLogo,
}: {
  name: string
  color: string
  showLogo?: boolean
  size?: number
  compact?: boolean
  onBadgeClick?: () => void
  onToggleLogo?: () => void
}) {
  const logo = logoFor(name)
  const useLogo = showLogo && !!logo
  const badge = useLogo ? (
    <span
      className="shrink-0 inline-flex items-center justify-center rounded-md bg-white border border-line px-1.5"
      style={{ height: size }}
    >
      <img src={logo!} alt="" className="object-contain" style={{ height: Math.round(size * 0.5), maxWidth: size * 3.5 }} />
    </span>
  ) : (
    <span
      className="shrink-0 inline-flex items-center justify-center rounded-md font-semibold text-ink-60 border border-black/[0.06]"
      style={{ width: size, height: size, background: color, fontSize: Math.max(9, Math.round(size * 0.45)) }}
    >
      {initials(name)}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {onBadgeClick ? (
        <button
          type="button"
          onClick={onBadgeClick}
          title={useLogo ? name : 'Cambiar color'}
          className="shrink-0 transition-transform hover:scale-105"
        >
          {badge}
        </button>
      ) : badge}
      <span className={`${compact ? 'text-sm text-ink-60' : 'text-sm font-medium text-ink'} truncate`}>{name}</span>
      {logo && onToggleLogo && (
        <button
          type="button"
          onClick={onToggleLogo}
          title={useLogo ? 'Quitar logo' : 'Usar logo del cliente'}
          className={`shrink-0 transition-opacity ${useLogo ? 'text-ink-60' : 'text-ink-40'} opacity-0 group-hover/header:opacity-100 hover:text-ink`}
        >
          <ImageIcon size={12} strokeWidth={1.5} />
        </button>
      )}
    </span>
  )
}
