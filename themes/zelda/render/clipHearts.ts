/**
 * HEARTS TURNED TO CLIPS on the HUD (`engine/clips.ts`, THE PAPERCLIP MAXIMIZER's fight): the last hearts of the row
 * are drawn as clips, grey-silver beside the red ones (`hud_heart_clip`: the drawn heart of `spritesMaximizer.ts` in
 * the classic skin, a plain silver heart in the finer one, `hud16.ts`), and a clip on its way flies from the hero to
 * the heart it becomes, over everything.
 */
import type { GameState, Vec } from '../types'
import { clipFlights } from '../engine/bossMaximizer'
import { sprite } from './sheet'
import type { HudSkin } from './hud'

type G = CanvasRenderingContext2D

/** How many hearts, from the end of the row, are drawn as clips: one whose clip is still in the air is a heart yet. */
export const clipsShown = (s: GameState) => (s.clips ? Math.max(0, s.clips - clipFlights(s).length) : 0)

/** The clips in the air. `from`: the hero on this HUD's grid; `left`, `top`: where the hearts' corner was moved to. */
export function drawClipFlights(g: G, s: GameState, from: Vec, skin: HudSkin, left: number, top: number) {
  const hearts = Math.ceil(s.hero.maxHp / 2)
  const step = skin.heartStep ?? 9
  for (const f of clipFlights(s)) {
    const slot = hearts - f.n
    if (slot < 0) continue
    const to = { x: left + 8 + (slot % 10) * step, y: top + 8 + Math.floor(slot / 10) * step }
    // Slow off the hero, fast into the row, on a bowed way; it shrinks to the heart it becomes.
    const p = f.p * f.p * (3 - 2 * f.p)
    const x = from.x + (to.x - from.x) * p + Math.sin(p * Math.PI) * 18
    const y = from.y + (to.y - from.y) * p
    const size = Math.round(16 - 7 * p)
    // A pale trail where it just was, so the eye catches it on any floor.
    g.fillStyle = '#fff4ff'
    for (let k = 1; k <= 3; k++) {
      const q = Math.max(0, p - k * 0.07)
      g.globalAlpha = 0.6 - k * 0.15
      g.fillRect(Math.round(from.x + (to.x - from.x) * q + Math.sin(q * Math.PI) * 18) - 1, Math.round(from.y + (to.y - from.y) * q) - 1, 2, 2)
    }
    g.globalAlpha = 1
    g.drawImage(sprite('clip_0'), Math.round(x - size / 2), Math.round(y - size / 2), size, size)
  }
}
