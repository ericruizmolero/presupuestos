/** Caras del estudio y logos de clientes servidos desde /public. */

export const FACES: Record<'Eric' | 'Andoni', string> = {
  Eric: '/team/eric.webp',
  Andoni: '/team/andoni.webp',
}

export const STUDIO_PHOTO = '/team/juntos.webp'

const LOGO_FILES = [
  'bluence.svg', 'codely.png', 'cubbo.svg', 'farco-studio.png', 'impact-bridge.png',
  'invopop.svg', 'isotrol.svg', 'junipero.svg', 'kalma.png', 'kymatio.svg', 'lyra.svg',
  'minimum.png', 'monad.png', 'mondragon.svg', 'naterra.png', 'neety.svg',
  'profounders.svg', 'remerge.svg', 'routal.png', 'surepayroll.svg', 'thx.png',
  'transcend-network.png', 'valuat.png', 'wisable.png', 'zrive.png',
]

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const LOGOS = LOGO_FILES.map((file) => {
  const base = file.replace(/\.(svg|png)$/, '')
  // "farco-studio" casa con "Farco", "transcend-network" con "Transcend"
  return { file, full: norm(base), core: norm(base.split('-')[0]) }
})

/** Logo del cliente por nombre de proyecto, o null si no hay. */
export function logoFor(projectName: string): string | null {
  const n = norm(projectName)
  if (n.length < 3) return null
  const hit = LOGOS.find((l) => n.includes(l.full) || l.full.includes(n) || (l.core.length >= 4 && n.includes(l.core)))
  return hit ? `/logos/${hit.file}` : null
}

/** Iniciales para el monograma de proyectos sin logo */
export function initials(projectName: string): string {
  const words = projectName.replace(/[^\p{L}\p{N}\s.]/gu, ' ').split(/[\s.]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return projectName.slice(0, 1).toUpperCase()
}
