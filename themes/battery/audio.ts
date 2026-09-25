/**
 * Night of the Dead Battery — audio. Stub until the real score lands.
 */
import type { GameEvent } from './types'

export interface BatteryAudio {
  /** Create/resume the AudioContext; call from a user gesture. */
  unlock(): void
  setMuted(muted: boolean): void
  /** Hold the site radio silent while the game page is open. */
  holdRadio(): void
  /** Engine events: music changes, sfx, speech blips, lightning, solves. */
  event(e: GameEvent): void
  /** The title screen's music on/off. */
  title(on: boolean): void
  suspend(on: boolean): void
  dispose(): void
}

export function createBatteryAudio(): BatteryAudio {
  return {
    unlock() {},
    setMuted() {},
    holdRadio() {},
    event() {},
    title() {},
    suspend() {},
    dispose() {},
  }
}
