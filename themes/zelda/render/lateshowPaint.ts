/**
 * What THE LATE SHOW draws of its own (`world/lateshow.ts`): the door in the drive-in screen, and the stomp's marks.
 * The streak of the dive is the hero's cyan with a dark outline, so it reads on any year's ground.
 */
import { TILE } from '../types'
import type { Light } from './tiles'
import type { Item } from './wild'

type G = CanvasRenderingContext2D

const r = (g: G, c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h) }
const OUT = '#0b0616'
const CYAN = '#2ff3ff'

/** The dive (the hero's feet at (x, feet) px): the blade pointed down under them, and the air torn behind. */
export function diveStreak(g: G, x: number, feet: number, time: number, reduced: boolean) {
  // The blade: a dark rim, cyan, a white core, to its point.
  r(g, OUT, x - 3, feet - 4, 7, 11)
  r(g, OUT, x - 2, feet + 7, 5, 2)
  r(g, OUT, x - 1, feet + 9, 3, 2)
  r(g, CYAN, x - 2, feet - 3, 5, 9)
  r(g, CYAN, x - 1, feet + 6, 3, 2)
  r(g, CYAN, x, feet + 8, 1, 2)
  r(g, '#ffffff', x, feet - 3, 1, 10)
  const shift = reduced ? 0 : Math.floor(time * 30) % 3
  for (const [dx, from, len] of [[-8, 22, 12], [7, 26, 15], [-2, 34, 9]] as const) {
    const y = feet - from - len + shift * 2
    r(g, OUT, x + dx - 1, y - 1, 3, len + 2)
    r(g, CYAN, x + dx, y, 1, len)
  }
}

/** The door's tile in RERUN ESTATES (`world/rerun.ts`, the mark `g`): the middle of the drive-in screen. */
const DOOR = { x: 76, y: 10 }

/**
 * The door in the middle of the screen: nobody's picture has one, and from the isometric view the screen's own
 * stands over the whole tile, so it is drawn here, queued with what stands. `turned`: that view, where the door hangs
 * on the screen's face and leans with it; else it stands on its tile. Its light is a projector's white: not the gold
 * of something to strike.
 */
export function queueScreenDoor(g: G, cx: number, cy: number, turned: boolean, items: Item[], lights: Light[]) {
  const ax = turned ? DOOR.x + 0.9 : DOOR.x + 0.5
  const ay = turned ? DOOR.y + 0.9 : DOOR.y + 1
  items.push({
    x: ax,
    // (From above it lies behind whoever stands at it.)
    y: turned ? ay : DOOR.y,
    draw: () => {
      const x = Math.round(ax * TILE - cx)
      const y = Math.round(ay * TILE - cy)
      // One column at a time, so that it can lean along the screen: up a px every two to the right.
      for (let i = -8; i <= 8; i++) {
        const foot = turned ? y - 3 - Math.floor((i + 8) / 2) : y
        const frame = Math.abs(i) > 6
        r(g, OUT, x + i, foot - 25, 1, 25)
        if (Math.abs(i) === 8) continue
        r(g, frame ? '#b98a5a' : '#12081e', x + i, foot - 23, 1, frame ? 23 : 22)
        if (!frame) r(g, '#b98a5a', x + i, foot - 24, 1, 2)
        // Ajar: the light inside down one side, and across the sill.
        if (i >= 2 && i <= 5) r(g, i === 2 ? '#cfc6ff' : '#fff4d6', x + i, foot - 21, 1, 20)
        else if (!frame) r(g, '#6a5a78', x + i, foot - 2, 1, 1)
      }
    },
  })
  lights.push({ x: DOOR.x + 0.5, y: DOOR.y + 0.5, r: 2.2, color: '#fff4d6', a: 0.6 })
}
