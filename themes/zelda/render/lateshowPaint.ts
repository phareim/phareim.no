/**
 * What THE LATE SHOW draws of its own (`world/lateshow.ts`): the door in the drive-in screen, the stomp's marks, the
 * Road's parked wagons and lane markings, COPILOT's warnings, and the Screen's pencilled outlines. The streak of the
 * dive is the hero's cyan, a warning is pink, each with a dark outline, so that they read on any year's ground.
 */
import type { Enemy, GameState } from '../types'
import { TILE } from '../types'
import { COPILOT, copilotRoad } from '../engine/bossCopilot'
import type { Light } from './tiles'
import type { Item } from './wild'
import type { SideKit } from './side'
import { sprite } from './sheet'
import { pencilHand } from './eras'

type G = CanvasRenderingContext2D

const r = (g: G, c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h) }
const OUT = '#0b0616'
const CYAN = '#2ff3ff'
const PINK = '#ff2fa0'
const T = TILE

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

// ---------------------------------------------------------------------------
// On the stage, under everything that moves
// ---------------------------------------------------------------------------

export function lateshowUnder(k: SideKit, s: GameState) {
  if (s.map.id === 'chase1986') road(k, s)
  if (s.map.id === 'weaver') outlines(k)
  for (const e of s.map.enemies) if (e.kind === 'copilot' && !e.dead && (e.ai.mode === 'honk' || e.ai.mode === 'pass')) lane(k, s, e)
}

/** The Road: the line down its middle, and a parked wagon over each run of three blocks that stands on it. */
function road(k: SideKit, s: GameState) {
  const { g, cx, cy, vw } = k
  const m = s.map
  const row = 21
  for (let x = Math.floor(cx / (2 * T)) * 2 * T; x < cx + vw; x += 2 * T) {
    const tx = Math.floor(x / T)
    if (m.tiles[row * m.w + tx] === '#' && m.tiles[row * m.w + tx + 1] === '#') r(g, '#e4dabc', x + 6 - cx, row * T + 9 - cy, 18, 2)
  }
  for (let tx = 1; tx < m.w - 3; tx++) {
    const up = (n: number) => m.tiles[(row - 1) * m.w + tx + n] === '#'
    if (!up(0) || !up(1) || !up(2) || up(-1) || up(3)) continue
    wagon(g, tx * T - cx, (row - 1) * T - cy)
  }
}

/** A station wagon parked, from its side, 48 × 16: its roof is the step one stands on. */
function wagon(g: G, x: number, y: number) {
  // (The sky shows round its nose and tail, which the tile layer drew as stone.)
  r(g, '#1a2236', x, y, 48, 16)
  const body = '#6f7046'
  r(g, OUT, x + 4, y, 36, 8)
  r(g, OUT, x, y + 6, 48, 8)
  // The roof, lit: where one stands. Then its windows and their pillars.
  r(g, '#e4dabc', x + 5, y, 34, 1)
  r(g, body, x + 5, y + 1, 34, 2)
  r(g, '#9db0cc', x + 6, y + 3, 32, 4)
  for (const at of [16, 27]) r(g, body, x + at, y + 3, 2, 4)
  r(g, '#c9d6ea', x + 8, y + 3, 4, 1)
  r(g, body, x + 1, y + 7, 46, 6)
  r(g, '#c9c09c', x + 1, y + 9, 46, 1)
  r(g, '#4d4e30', x + 3, y + 11, 42, 2)
  r(g, '#e4dabc', x + 45, y + 8, 2, 2)
  r(g, '#9a9ea8', x, y + 12, 3, 2)
  r(g, '#9a9ea8', x + 45, y + 12, 3, 2)
  // Wheels.
  for (const at of [7, 31]) { r(g, OUT, x + at, y + 10, 10, 6); r(g, OUT, x + at + 1, y + 9, 8, 7); r(g, '#9a9ea8', x + at + 3, y + 11, 4, 3); r(g, OUT, x + at + 4, y + 12, 2, 1) }
}

/** The three places on the Screen where something will land, pencilled faint: a hand in a ruled box over each step. */
function outlines(k: SideKit) {
  const { g, cx, cy } = k
  const pencil = '#7b838f'
  for (let n = 0; n < 3; n++) {
    const x = (2 + 3 * n) * T - cx
    const y = (20 - n - 2) * T - cy
    for (let i = 1; i < 47; i += 5) { r(g, pencil, x + i, y + 1, 3, 1); r(g, pencil, x + i, y + 31, 3, 1) }
    for (let j = 1; j < 31; j += 5) { r(g, pencil, x + 1, y + j, 1, 3); r(g, pencil, x + 46, y + j, 1, 3) }
    pencilHand(g, pencil, x + 15, y + 8)
  }
}

/** A pink block with its dark rim. */
function warn(g: G, x: number, y: number, w: number, h: number) {
  r(g, OUT, x - 1, y - 1, w + 2, h + 2)
  r(g, PINK, x, y, w, h)
}

/**
 * COPILOT's lane, from the screen's left edge to where it will stop, exactly as high as what will hurt: a wash, a
 * hard rim, chevrons running the way it will come, a great `!` at its start, and its headlights peeking in.
 */
function lane(k: SideKit, s: GameState, e: Enemy) {
  const { g, cx, cy, time, reduced, lights } = k
  const left = s.map.chase?.left ?? s.zone.x
  const road = copilotRoad(e) * T - cy
  const high = Math.round(COPILOT.hit * T)
  const x = Math.round(left * T) - cx
  const w = COPILOT.to * T
  const y = road - high
  g.globalAlpha = 0.34
  r(g, PINK, x, y, w, high)
  g.globalAlpha = 1
  r(g, OUT, x, y - 2, w + 2, 1)
  r(g, PINK, x, y - 1, w + 1, 2)
  r(g, OUT, x, y + 1, w, 1)
  r(g, PINK, x + w - 1, y, 2, high)
  r(g, OUT, x + w + 1, y - 2, 1, high + 2)
  const run = reduced ? 0 : Math.floor(time * 40) % 24
  for (let i = run; i < w - 8; i += 24) {
    for (let j = 0; j < 5; j++) { r(g, PINK, x + i + j, y + 3 + j, 2, 1); r(g, PINK, x + i + j, y + 12 - j, 2, 1) }
  }
  // The great mark over its start.
  const blink = reduced || Math.floor(time * 10) % 2 === 0
  warn(g, x + 12, y - 30, 6, 16)
  warn(g, x + 12, y - 10, 6, 5)
  if (blink) { r(g, '#ffffff', x + 14, y - 28, 2, 11); r(g, '#ffffff', x + 14, y - 8, 2, 2) }
  if (e.ai.mode !== 'honk') return
  // Headlights past the edge, nosing in as the horn runs out.
  const nose = reduced ? 5 : Math.round(7 * Math.min(1, 1.4 * (1 - e.ai.t / COPILOT.honk)))
  for (const at of [y - 1, y + 8]) {
    r(g, OUT, x, at - 1, nose + 2, 7)
    r(g, '#fff4ff', x, at, nose, 5)
    g.globalAlpha = 0.16
    for (let i = 0; i < 40; i += 2) r(g, '#fff4ff', x + nose + i, at - Math.floor(i / 8), 2, 5 + Math.floor(i / 4))
    g.globalAlpha = 1
  }
  lights.push({ x: left + 0.5, y: copilotRoad(e) - 0.6, r: 3, color: '#fff4ff', a: 0.9 })
}

// ---------------------------------------------------------------------------
// Over everything
// ---------------------------------------------------------------------------

export function lateshowOver(k: SideKit, s: GameState) {
  const { g, cx, cy, time, reduced, lights } = k
  for (const e of s.map.enemies) {
    if (e.kind !== 'copilot') continue
    const x = Math.round(e.x * T) - cx
    const road = copilotRoad(e) * T - cy
    if (!e.dead && e.ai.mode === 'rev') {
      // About to go: its lamps flash pink, out past its sides where its own red does not swallow them.
      const lit = reduced || Math.floor(e.ai.t * 8) % 2 === 0
      for (const at of [-25, 18]) {
        warn(g, x + at, road - 15, 8, 7)
        if (lit) r(g, '#ffffff', x + at + 2, road - 13, 4, 3)
      }
      if (lit) for (const at of [-32, 29]) { warn(g, x + at, road - 13, 3, 1); warn(g, x + at, road - 9, 3, 1) }
      lights.push({ x: e.x - 1.2, y: e.y, r: 1.8, color: PINK, a: 0.9 }, { x: e.x + 1.2, y: e.y, r: 1.8, color: PINK, a: 0.9 })
    }
    // Spinning out: round and round, smaller, and gone.
    const t = e.deathT ?? 1
    if (!e.dead || t >= COPILOT.spin) continue
    const q = t / COPILOT.spin
    const turn = reduced ? 1 : Math.cos(t * 22)
    const c = sprite('copilot_rust', turn < 0)
    const w = Math.max(2, Math.round(c.width * 3 * Math.abs(turn) * (1 - q * 0.5)))
    const h = Math.round(c.height * 3 * (1 - q * 0.5))
    g.globalAlpha = 1 - q * q
    g.drawImage(c, Math.round(x - w / 2), road - h - Math.round(q * 10), w, h)
    g.globalAlpha = 1
  }
}
