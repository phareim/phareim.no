import type { GameState, IsoLandmark } from '../types'
import { TILE } from '../types'
import { hash2 } from './tiles'
import { sprite } from './sheet'
import type { Item } from './wild'

/** A few deterministic animals close to the camera. Their animation touches only the picture. */
export function queueWildlife(g: CanvasRenderingContext2D, s: GameState, cx: number, cy: number, time: number, reduced: boolean, night: boolean, items: Item[], landmarks: readonly IsoLandmark[] = []) {
  const m = s.map
  const tm = reduced ? 0 : time
  const hx = Math.floor(s.hero.x)
  const hy = Math.floor(s.hero.y)
  const at = (x: number, y: number) => m.tiles[y * m.w + x]
  const add = (name: string, x: number, y: number, lift: number, frame: number, flip = false) => {
    items.push({
      x, y,
      draw: () => {
        const c = sprite(`wild_${name}_${frame}`, flip)
        g.drawImage(c, Math.round(x * TILE - cx - c.width / 2), Math.round(y * TILE - cy - c.height - lift))
      },
    })
  }
  if (night) for (const lamp of landmarks) {
    if (!lamp.art.startsWith('road_lantern_') || Math.abs(lamp.x - hx) > 8 || Math.abs(lamp.y - hy) > 8) continue
    const clock = tm + hash2(Math.floor(lamp.x), Math.floor(lamp.y), 631) * 13
    add('moth', lamp.x + Math.sin(clock * 2.9) * 0.26, lamp.y, 12 + Math.cos(clock * 3.4) * 3, reduced ? 0 : Math.floor(clock * 8) % 2)
  }
  for (let y = Math.max(1, hy - 8); y <= Math.min(m.h - 2, hy + 8); y++) {
    for (let x = Math.max(1, hx - 8); x <= Math.min(m.w - 2, hx + 8); x++) {
      const seed = hash2(x, y, 631)
      const t = at(x, y)
      const clock = tm + seed * 13
      const wing = reduced ? 0 : Math.floor(clock * 8) % 2
      if (t === '~') {
        if (seed < 0.965) continue
        const shore = at(x - 1, y) !== '~' || at(x + 1, y) !== '~' || at(x, y - 1) !== '~' || at(x, y + 1) !== '~'
        if (!shore) continue
        const phase = clock % 5.8
        if (!reduced && phase < 0.72) {
          const frame = Math.min(3, Math.floor(phase / 0.18))
          add('fish', x + 0.5 + phase * 0.4, y + 0.55, [2, 6, 3, 0][frame]!, frame)
        } else if (seed > 0.992) {
          add('frog', x + 0.54, y + 0.62, 0, reduced ? 0 : Math.floor(clock * 0.9) % 2)
        } else if (!night && seed > 0.984 && phase < 3.8) {
          add('gull', x + 0.5 + phase * 0.64, y + 0.44, 22 + Math.cos(clock * 3) * 2, wing, seed > 0.99)
        }
      } else if (t === 't' && night && seed > 0.42) {
        add('moth', x + 0.5 + Math.sin(clock * 2.9) * 0.32, y + 0.65, 15 + Math.cos(clock * 3.4) * 4, wing)
      } else if ((t === ':' || t === ';') && !night && seed > 0.975) {
        add('butterfly', x + 0.5 + Math.sin(clock * 2.2) * 0.35, y + 0.55, 4 + Math.cos(clock * 2.7) * 3, wing, seed > 0.987)
      } else if (t === 'T' && !night && seed > 0.992 && clock % 7 < 3.3) {
        const phase = clock % 7
        add('crow', x + 0.45 + phase * 0.57, y + 0.53, 21 + Math.sin(clock * 1.5) * 3, wing)
      }
    }
  }
}
