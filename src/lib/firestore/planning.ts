import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { stripUndefinedDeep } from './quotes'

/** Tablero interno tipo post-its: grupos (proyectos) con color y chips de texto,
 *  organizados en carriles con nombre libre ("Ahora", "Mañana", "En espera"…). */
export const DEFAULT_LANES = ['Ahora', 'Luego', 'En espera']

export interface BoardGroup {
  name: string
  color: string // hex
  status?: string // nombre del carril; default: el primero
}

export interface BoardChip {
  group: string
  text: string
}

export interface Board {
  lanes: string[]
  groups: BoardGroup[]
  chips: BoardChip[]
}

export const BOARD_COLORS = [
  '#FDE68A', // amarillo post-it
  '#BFDBFE', // azul
  '#BBF7D0', // verde
  '#FECACA', // rojo suave
  '#E9D5FF', // lila
  '#FED7AA', // naranja
  '#99F6E4', // turquesa
  '#F5D0FE', // rosa
]

interface LegacyEntry { group?: string; phase?: string }

/** Carriles antiguos (ids fijos) → nombres */
const LEGACY_STATUS: Record<string, string> = {
  ahora: 'Ahora',
  luego: 'Luego',
  espera: 'En espera',
}

export async function getBoard(companyId: string): Promise<Board> {
  const snap = await getDoc(doc(db, 'planning', companyId))
  if (!snap.exists()) return { lanes: [...DEFAULT_LANES], groups: [], chips: [] }
  const data = snap.data()

  if (data.groups || data.chips) {
    const lanes: string[] = data.lanes?.length ? data.lanes : [...DEFAULT_LANES]
    const groups = ((data.groups ?? []) as BoardGroup[]).map((g) => {
      const status = LEGACY_STATUS[g.status ?? ''] ?? g.status
      // Estados huérfanos (carril borrado/renombrado fuera) → primer carril
      return { ...g, status: status && lanes.includes(status) ? status : lanes[0] }
    })
    return { lanes, groups, chips: data.chips ?? [] }
  }

  // Migración desde el formato antiguo (entries de timeline)
  const entries = (data.entries as LegacyEntry[]) ?? []
  const names = [...new Set(entries.map((e) => e.group || '').filter(Boolean))]
  return {
    lanes: [...DEFAULT_LANES],
    groups: names.map((name, i) => ({ name, color: BOARD_COLORS[i % BOARD_COLORS.length], status: DEFAULT_LANES[0] })),
    chips: entries
      .filter((e) => (e.phase || '').trim())
      .map((e) => ({ group: e.group || '', text: (e.phase || '').trim() })),
  }
}

export async function saveBoard(companyId: string, board: Board) {
  await setDoc(doc(db, 'planning', companyId), {
    ...(stripUndefinedDeep(board) as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  })
}
