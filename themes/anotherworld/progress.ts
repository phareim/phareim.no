/**
 * The crossing's progress: this browser's copy in localStorage, the rule
 * for merging it with the copy on the player's profile (newest write wins,
 * as in Neon Shrine), and a summary the Hangar can show without loading the
 * engine. Pure apart from the storage helpers, which swallow every error.
 */
import type { ChapterId, ShoreSave } from './types'

export const SAVE_KEY = 'phareim.shore'
export const CLEARED_KEY = 'phareim.shoreClearedAt'
export const BEST_KEY = 'phareim.shoreBest'

const ROMAN: Record<ChapterId, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }
const TITLES: Record<ChapterId, string> = { 1: 'THE POOL', 2: 'THE BEAST', 3: 'THE CAGE', 4: 'THE HALL', 5: 'THE LAMP' }

export const CHAPTER_COUNT = 5

export interface ShoreSummary {
  chapter: ChapterId
  roman: string
  title: string
  elapsed: number
}

/** Loose read of a save as the API hands it back; null if it is not one. */
export function summarizeShoreRaw(raw: unknown): ShoreSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const ch = r.chapter
  if (ch !== 1 && ch !== 2 && ch !== 3 && ch !== 4 && ch !== 5) return null
  const elapsed = typeof r.elapsed === 'number' && Number.isFinite(r.elapsed) ? r.elapsed : 0
  return { chapter: ch, roman: ROMAN[ch], title: TITLES[ch], elapsed }
}

export function chapterLabel(ch: ChapterId): string {
  return `${ROMAN[ch]} · ${TITLES[ch]}`
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// ---- merging with the profile ----

export interface RemoteSave {
  data: unknown | null
  savedAt: number
  best: number | null
  clears: number
}

export type SyncAction =
  | { kind: 'pull'; save: ShoreSave | null }
  | { kind: 'push'; save: ShoreSave | null; savedAt: number }
  | { kind: 'none' }

/**
 * Newest write wins. `localAt` is this browser's last write (the save's
 * stamp, or the moment it was cleared by a finish or a new crossing).
 */
export function reconcile(local: ShoreSave | null, localAt: number, remote: RemoteSave | null, remoteData: ShoreSave | null): SyncAction {
  if (!remote) return local || localAt > 0 ? { kind: 'push', save: local, savedAt: localAt } : { kind: 'none' }
  if (remote.savedAt > localAt) {
    if (remote.data !== null && !remoteData) return local ? { kind: 'push', save: local, savedAt: localAt } : { kind: 'none' }
    return { kind: 'pull', save: remoteData }
  }
  if (localAt > remote.savedAt) return { kind: 'push', save: local, savedAt: localAt }
  return { kind: 'none' }
}

// ---- this browser ----

function read(key: string): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* private mode */ }
}

export function readLocalRaw(): unknown {
  const raw = read(SAVE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function writeLocalSave(save: ShoreSave): void {
  write(SAVE_KEY, JSON.stringify(save))
}

/** Removes the save and remembers when, so an older profile copy cannot bring it back. */
export function clearLocalSave(at: number): void {
  write(SAVE_KEY, null)
  write(CLEARED_KEY, String(at))
}

export function localSavedAt(save: ShoreSave | null): number {
  if (save?.savedAt) return save.savedAt
  const at = parseInt(read(CLEARED_KEY) || '', 10)
  return Number.isFinite(at) && at > 0 ? at : 0
}

export function readLocalBest(): number | null {
  const v = parseFloat(read(BEST_KEY) || '')
  return Number.isFinite(v) && v > 0 ? v : null
}

export function writeLocalBest(seconds: number): void {
  write(BEST_KEY, String(seconds))
}
