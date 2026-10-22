'use client'

import { FACES, logoFor, initials } from '@/lib/studioAssets'

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

/** Logo del cliente; si no hay, monograma con el color del proyecto */
export function ProjectMark({
  name, color, height = 18, mono = 22, onMonogramClick,
}: {
  name: string
  color: string
  height?: number
  mono?: number
  onMonogramClick?: () => void
}) {
  const logo = logoFor(name)
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        title={name}
        className="object-contain object-left shrink-0"
        style={{ height, maxWidth: height * 6 }}
      />
    )
  }
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={onMonogramClick}
        title={onMonogramClick ? 'Cambiar color' : name}
        className="shrink-0 inline-flex items-center justify-center rounded-md text-[10px] font-semibold text-ink-60 border border-black/[0.06] transition-transform hover:scale-105"
        style={{ width: mono, height: mono, background: color }}
      >
        {initials(name)}
      </button>
      <span className="text-sm font-medium text-ink truncate">{name}</span>
    </span>
  )
}

export function hasLogo(name: string): boolean {
  return logoFor(name) !== null
}
