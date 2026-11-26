/** The icon of the B item out (the HUD's box, the touch B pad); '' with nothing out. */
import type { GameState } from '../types'
import { isArt } from '../engine/index'

export function itemIconName(s: GameState): string {
  const u = s.inv.selected
  if (!u) return ''
  if (isArt(u)) return `item_${u}`
  return u === 'disc' ? 'item_disc' : u === 'hook' ? 'item_hook' : 'item_bombbag'
}
