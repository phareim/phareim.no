/**
 * The global radio catalog — every music station on phareim.no in one list.
 *
 * Galaga and OutRun each ship three original sequenced loops in their own
 * `audio.ts`. The station names here mirror those TRACKS (asserted equal by
 * `tests/radio-catalog.test.mjs`); the engine imports the note data itself.
 * This module stays dependency-free and pure (no window, no AudioContext)
 * so the station math is unit-testable in plain node.
 */
export type RadioOrigin = 'galaga' | 'outrun'

export interface RadioStation {
  /** Human name, shown in the widget and the game HUDs. */
  name: string
  /** Which game's sequencer data this station plays. */
  origin: RadioOrigin
  /** Index into that game's TRACKS. */
  track: number
}

/**
 * Station names, in dial order (Galaga 0–2, then OutRun 3–5). Mirrors the
 * TRACKS names in the game audio modules — deliberately literals, not
 * imports, so this module stays dependency-free and unit-testable in plain
 * node: `tests/radio-catalog.test.mjs` asserts equality with both TRACKS,
 * so a retune fails loudly instead of drifting silently.
 */
const GALAGA_NAMES = ['STARDUST RUN', 'VOID CHOIR', 'BULLET BALLET'] as const
const OUTRUN_NAMES = ['MIDNIGHT SHOWER', 'PASSING NEON', 'SPLASH GRID'] as const

function stationsFor(origin: RadioOrigin, names: readonly string[]): RadioStation[] {
  return names.map((name, track) => ({ name, origin, track }))
}

/** All six stations: Galaga 0–2, then OutRun 3–5. */
export const STATIONS: readonly RadioStation[] = [
  ...stationsFor('galaga', GALAGA_NAMES),
  ...stationsFor('outrun', OUTRUN_NAMES),
]

export const STATION_NAMES: readonly string[] = STATIONS.map(s => s.name)

/** Global index where the OutRun block starts (its local 0–2 live here). */
export const OUTRUN_OFFSET = GALAGA_NAMES.length

export const STORAGE_KEY = 'phareim.radioStation'
export const MUTE_KEY = 'phareim.radioMuted'

/** Global station number for one game's local track index. */
export function globalIndex(origin: RadioOrigin, localTrack: number): number {
  const base = origin === 'outrun' ? OUTRUN_OFFSET : 0
  const names = origin === 'outrun' ? OUTRUN_NAMES : GALAGA_NAMES
  if (!Number.isInteger(localTrack) || localTrack < 0 || localTrack >= names.length) return base
  return base + localTrack
}

/** Wrap-around step used by M / tap / the widget buttons. */
export function nextStation(i: number): number {
  return (clampStation(i) + 1) % STATIONS.length
}

export function prevStation(i: number): number {
  return (clampStation(i) + STATIONS.length - 1) % STATIONS.length
}

/** Any junk (NaN, old names-as-numbers, out of range) becomes station 0. */
export function clampStation(i: unknown): number {
  return Number.isInteger(i) && (i as number) >= 0 && (i as number) < STATIONS.length
    ? (i as number)
    : 0
}

export interface MigratedStation {
  station: number
  muted: boolean
}

/**
 * Pick up where the per-game radios left off. Reads through a callback so
 * the logic stays testable; the composable passes `localStorage.getItem`.
 *
 * Order: the new unified key wins, then the Galaga station name, then the
 * OutRun index (its -1 OFF becomes muted), then the default.
 */
export function migrateStation(read: (key: string) => string | null): MigratedStation {
  const unified = read(STORAGE_KEY)
  if (unified !== null) {
    const n = parseInt(unified, 10)
    if (Number.isInteger(n) && n >= 0 && n < STATIONS.length) return { station: n, muted: read(MUTE_KEY) === '1' }
  }
  const galaga = read('galagaRadio')
  if (galaga !== null) {
    const at = STATION_NAMES.indexOf(galaga)
    if (at >= 0) return { station: at, muted: false }
  }
  const outrun = read('outrunRadio')
  if (outrun !== null) {
    const r = parseInt(outrun, 10)
    if (r === -1) return { station: 0, muted: true }
    if (Number.isInteger(r) && r >= 0 && r < OUTRUN_NAMES.length) {
      return { station: OUTRUN_OFFSET + r, muted: false }
    }
  }
  return { station: 0, muted: false }
}
