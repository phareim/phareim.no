/**
 * The touch deck's A pad: its picture and its name for each answer of `engine/action.ts` `aWould`, and how fast the
 * button follows. Pure.
 */
import type { AWould } from './engine/action'

export const A_PAD: Record<AWould, { icon: string; label: string }> = {
  blade: { icon: 'item_sword', label: 'Sword' },
  talk: { icon: 'pad_talk', label: 'Talk' },
  read: { icon: 'pad_read', label: 'Read' },
  lift: { icon: 'pad_lift', label: 'Lift' },
  throw: { icon: 'pad_throw', label: 'Throw' },
  open: { icon: 'pad_open', label: 'Open' },
  door: { icon: 'pad_door', label: 'Go in' },
  key: { icon: 'pad_key', label: 'Unlock' },
  pull: { icon: 'pad_pull', label: 'Pull' },
  buy: { icon: 'item_bits', label: 'Buy' },
}

/** How long an answer must hold before the button follows it (ms). */
export const A_PAD_HOLD = 150

/**
 * What the button shows, frame by frame. An answer is taken up once it has held for `A_PAD_HOLD` (walking past a row
 * of pots does not flicker it); what is no longer true leaves at once, for the sword.
 */
export function createAPad() {
  let shown: AWould = 'blade'
  let next: AWould = 'blade'
  let since = 0
  return {
    step(would: AWould, nowMs: number): AWould {
      if (would !== next) { next = would; since = nowMs }
      if (would !== shown) shown = would !== 'blade' && nowMs - since >= A_PAD_HOLD ? would : 'blade'
      return shown
    },
    reset() { shown = next = 'blade' },
  }
}
