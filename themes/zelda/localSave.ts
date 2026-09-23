/**
 * This browser's copy of the Neon Shrine save (localStorage). The profile
 * copy is kept in step by `useGameSave` + `progress.ts reconcile`; every
 * write here is stamped so the two can be compared.
 */
import { parseSave } from './engine/index'
import { SAVE_KEY, BEST_KEY, CLEARED_KEY, type SaveData } from './types'

export function readLocalSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? parseSave(JSON.parse(raw)) : null
  } catch { return null }
}

export function writeLocalSave(save: SaveData): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* private mode */ }
}

/** Removes the save and remembers when, so an older profile copy cannot bring it back. */
export function clearLocalSave(at: number): void {
  try {
    localStorage.removeItem(SAVE_KEY)
    localStorage.setItem(CLEARED_KEY, String(at))
  } catch { /* ignore */ }
}

/** When this browser last wrote: the save's stamp, else the last clear, else 0. */
export function localSavedAt(save: SaveData | null): number {
  if (save?.savedAt) return save.savedAt
  try {
    const at = parseInt(localStorage.getItem(CLEARED_KEY) || '', 10)
    return Number.isFinite(at) && at > 0 ? at : 0
  } catch { return 0 }
}

export function readLocalBest(): number | null {
  try {
    const v = parseFloat(localStorage.getItem(BEST_KEY) || '')
    return Number.isFinite(v) && v > 0 ? v : null
  } catch { return null }
}

export function writeLocalBest(seconds: number): void {
  try { localStorage.setItem(BEST_KEY, String(seconds)) } catch { /* ignore */ }
}
