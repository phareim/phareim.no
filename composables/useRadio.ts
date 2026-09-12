import {
  STATION_NAMES,
  STATIONS,
  OUTRUN_OFFSET,
  STORAGE_KEY,
  MUTE_KEY,
  globalIndex,
  nextStation as nextIndex,
  prevStation as prevIndex,
  clampStation,
  migrateStation,
  type RadioOrigin,
} from '~/themes/radio/catalog'
import { getRadioEngine } from '~/themes/radio/engine'

function readStorage(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // private mode — the station lives for this visit only
  }
}

/**
 * Site-wide radio state. The station, mute flag and track name live in
 * Nuxt `useState` (so every theme and the widget read the same values) and
 * the sound comes from the singleton in `themes/radio/engine.ts` (so it
 * survives theme switches).
 *
 * Nothing here creates audio by itself: playback starts from
 * `ensurePlaying()`, which must run inside a user gesture (Enter/tap, the
 * widget buttons, or the first pointerdown/keydown the widget observes).
 */
export const useRadio = () => {
  // Migrated once per page load: the unified key wins, otherwise the old
  // per-game `galagaRadio` / `outrunRadio` values carry over.
  const migrated = useState<MigratedStation>('radioMigrated', () => {
    if (!import.meta.client) return { station: 0, muted: false }
    return migrateStation(readStorage)
  })

  const station = useState<number>('radioStation', () => migrated.value.station)
  const muted = useState<boolean>('radioMuted', () => migrated.value.muted)
  const started = useState<boolean>('radioStarted', () => false)

  const trackName = computed(() => STATION_NAMES[station.value] ?? STATION_NAMES[0]!)
  const stationPos = computed(() => `${station.value + 1}/${STATIONS.length}`)
  const origin = computed<RadioOrigin>(() => STATIONS[station.value]?.origin ?? 'galaga')

  function persist(): void {
    writeStorage(STORAGE_KEY, String(station.value))
    writeStorage(MUTE_KEY, muted.value ? '1' : '0')
  }

  /** Idempotent: resumes the current station, or starts it if needed. */
  function ensurePlaying(): boolean {
    if (muted.value) return false
    const engine = getRadioEngine()
    if (!engine.start()) return false
    engine.playStation(station.value)
    started.value = true
    return true
  }

  function playStation(i: number): void {
    station.value = clampStation(i)
    persist()
    if (muted.value || !import.meta.client) return
    const engine = getRadioEngine()
    if (engine.started) engine.playStation(station.value)
  }

  function next(): void {
    playStation(nextIndex(station.value))
  }

  function prev(): void {
    playStation(prevIndex(station.value))
  }

  /** A game's select screen maps its local track onto the global dial. */
  function playOriginStation(game: RadioOrigin, localTrack: number): void {
    playStation(globalIndex(game, localTrack))
  }

  function toggleMute(): void {
    muted.value = !muted.value
    persist()
    if (!import.meta.client) return
    const engine = getRadioEngine()
    if (muted.value) {
      engine.suspend(true)
    } else if (engine.started) {
      engine.suspend(false)
    } else {
      ensurePlaying()
    }
  }

  /** Pause menus and hidden tabs freeze the music; unpause resumes it. */
  function suspend(on: boolean): void {
    if (!import.meta.client) return
    // Resuming never overrides an explicit mute.
    if (!on && muted.value) return
    const engine = getRadioEngine()
    if (engine.started) engine.suspend(on)
  }

  function setIntensity(tier: 0 | 1 | 2 | 3, boss: boolean): void {
    if (!import.meta.client) return
    getRadioEngine().setIntensity(tier, boss)
  }

  function setFull(): void {
    if (!import.meta.client) return
    getRadioEngine().setFull()
  }

  return {
    station,
    muted,
    started,
    trackName,
    stationPos,
    origin,
    outrunOffset: OUTRUN_OFFSET,
    ensurePlaying,
    playStation,
    playOriginStation,
    next,
    prev,
    toggleMute,
    suspend,
    setIntensity,
    setFull,
  }
}

interface MigratedStation {
  station: number
  muted: boolean
}
