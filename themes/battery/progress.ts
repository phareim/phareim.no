/**
 * Saves: this browser's copy in localStorage, mirrored to the player's
 * profile slot (`/api/save`, game id `battery`) like Neon Shrine and
 * Another Shore. The newest write wins. A summary the Hangar can show
 * without loading the engine. Storage helpers swallow every error.
 */
import type { GameState } from './types'

export const SAVE_KEY = 'phareim.battery'
export const BEST_KEY = 'phareim.batteryBest'
export const GAME_ID = 'battery'

/** The puzzles that count towards "n/N" (a `solve` id each). */
export const SOLVE_COUNT = 22

export interface BatterySave {
  v: 1
  state: GameState
  savedAt: number
}

export function readLocal(): BatterySave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as BatterySave
    return s && s.v === 1 && s.state && typeof s.savedAt === 'number' ? s : null
  } catch { return null }
}

export function writeLocal(state: GameState, savedAt = Date.now()): BatterySave {
  const save: BatterySave = { v: 1, state: JSON.parse(JSON.stringify(state)), savedAt }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* private mode */ }
  return save
}

export function clearLocal() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* nothing */ }
}

export function readBest(): number | null {
  try {
    const v = Number(localStorage.getItem(BEST_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch { return null }
}

export function writeBest(sec: number) {
  try {
    const b = readBest()
    if (!b || sec < b) localStorage.setItem(BEST_KEY, String(Math.round(sec)))
  } catch { /* nothing */ }
}

export function solvedCount(state: GameState): number {
  return Object.keys(state.flags).filter(k => k.startsWith('solved.')).length
}

/** For the Hangar: puzzles solved and play time, from a raw profile save. */
export function summarizeBatteryRaw(raw: unknown): { solved: number; elapsed: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<BatterySave>
  const st = r.state as Partial<GameState> | undefined
  if (!st || typeof st !== 'object' || !st.flags || typeof st.flags !== 'object') return null
  const solved = Object.keys(st.flags).filter(k => k.startsWith('solved.')).length
  const elapsed = typeof st.time === 'number' && Number.isFinite(st.time) ? st.time : 0
  return { solved, elapsed }
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
