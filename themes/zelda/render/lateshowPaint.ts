/**
 * What THE LATE SHOW draws of its own (`world/lateshow.ts`): the door in the drive-in screen, the booth's lenses, the
 * stomp's marks, the Road's parked wagons and lane markings, COPILOT's warnings, and the Screen: its pencilled
 * outlines, the Weaver's arm and hands, everything it will hit (read off its `ai` through the same shapes its blows ask,
 * `engine/bossWeaver.ts`), the gold ring and chevron over a resting finger, its ripple and its scribble. The streak
 * of the dive is the hero's cyan, a warning is pink, a thing to strike is gold, each with a dark outline, so that
 * they read on any year's ground.
 */
import type { Enemy, GameState, World } from '../types'
import { TILE } from '../types'
import { COPILOT, copilotRoad } from '../engine/bossCopilot'
import { handsRight, WEAVER, weaverFinger, weaverFootprint, weaverLane, weaverPellet, weaverSlot, weaverStrips, weaverWaves } from '../engine/bossWeaver'
import { CHASE } from '../engine/chase'
import { ctx } from '../engine/combat'
import { mapInfo } from '../engine/map'
import type { Light } from './tiles'
import type { Item } from './wild'
import type { SideKit } from './side'
import { sprite } from './sheet'
import { pencilHand, toneSprite } from './eras'

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

/**
 * The booth's lenses: a projector's lens on its stand over each stair in the north wall that goes into a reel, in that
 * year's colours (`lens_<year>`, `spritesLateShow.ts`). It lies behind whoever stands on its tile.
 */
export function queueLenses(g: G, world: World, map: string, cx: number, cy: number, items: Item[]) {
  for (const w of mapInfo(world, map).warps) {
    if (!w.to.startsWith('reel')) continue
    const x = w.x + 0.5
    const foot = w.y + 1
    items.push({ x, ay: foot, y: w.y, draw: () => g.drawImage(sprite(`lens_${w.to.slice(4)}`), Math.round(x * T - cx) - 8, Math.round(foot * T - cy) - T) })
  }
}

// ---------------------------------------------------------------------------
// On the stage, under everything that moves
// ---------------------------------------------------------------------------

export function lateshowUnder(k: SideKit, s: GameState) {
  if (s.map.id === 'chase1986') road(k, s)
  if (s.map.id === 'weaver') screen(k, s)
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

/** A pink block with its dark rim. */
function warn(g: G, x: number, y: number, w: number, h: number) {
  r(g, OUT, x - 1, y - 1, w + 2, h + 2)
  r(g, PINK, x, y, w, h)
}

/**
 * COPILOT's lane, from the screen's left edge to its right, exactly as high as what will hurt: a wash, a
 * hard rim, chevrons running the way it will come, a great `!` at its start, and its headlights peeking in.
 */
function lane(k: SideKit, s: GameState, e: Enemy) {
  const { g, cx, cy, time, reduced, lights } = k
  const left = s.map.chase?.left ?? s.zone.x
  const road = copilotRoad(e) * T - cy
  const high = Math.round(COPILOT.hit * T)
  const x = Math.round(left * T) - cx
  // The whole screen across: it drives that far.
  const w = CHASE.screen * T - 2
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
  if (s.map.id === 'weaver') weaverFlying(k, s)
  for (const e of s.map.enemies) {
    if (e.kind !== 'copilot') continue
    const x = Math.round(e.x * T) - cx
    const road = copilotRoad(e) * T - cy
    if (!e.dead && e.ai.mode === 'rev') {
      // About to go: its lamps flash pink, out past its sides where its own red does not swallow them.
      const lit = reduced || Math.floor(e.ai.t * 8) % 2 === 0
      for (const at of [-35, 28]) {
        warn(g, x + at, road - 15, 8, 7)
        if (lit) r(g, '#ffffff', x + at + 2, road - 13, 4, 3)
      }
      if (lit) for (const at of [-42, 39]) { warn(g, x + at, road - 13, 3, 1); warn(g, x + at, road - 9, 3, 1) }
      lights.push({ x: e.x - 2, y: e.y, r: 1.8, color: PINK, a: 0.9 }, { x: e.x + 2, y: e.y, r: 1.8, color: PINK, a: 0.9 })
    }
    // Spinning out: round and round, smaller, and gone.
    const t = e.deathT ?? 1
    if (!e.dead || t >= COPILOT.spin) continue
    const q = t / COPILOT.spin
    const turn = reduced ? 1 : Math.cos(t * 22)
    const c = sprite('copilot_side_rust', turn < 0)
    const w = Math.max(2, Math.round(c.width * Math.abs(turn) * (1 - q * 0.5)))
    const h = Math.round(c.height * (1 - q * 0.5))
    g.globalAlpha = 1 - q * q
    g.drawImage(c, Math.round(x - w / 2), road - h - Math.round(q * 10), w, h)
    g.globalAlpha = 1
  }
}

// ---------------------------------------------------------------------------
// The Screen: what the Weaver draws
// ---------------------------------------------------------------------------

const GOLD = '#ffd23f'
/** A hand put right is a step, not a danger: its picture in the pencil's greys. */
const RIGHT = ['#0b0616', '#454d59', '#68707b', '#a9b0b9', '#e8eaec'] as const

/** A box in px: a pink wash (`wash`, 0 to 1) in a hard pink rim with a dark one outside it. */
function pinkBox(g: G, x: number, y: number, w: number, h: number, wash: number) {
  g.globalAlpha = wash
  r(g, PINK, x, y, w, h)
  g.globalAlpha = 1
  for (const [c, o, t] of [[OUT, -2, 1], [PINK, -1, 2], [OUT, 1, 1]] as const) {
    r(g, c, x + o, y + o, w - 2 * o, t)
    r(g, c, x + o, y + h - o - t, w - 2 * o, t)
    r(g, c, x + o, y + o, t, h - 2 * o)
    r(g, c, x + w - o - t, y + o, t, h - 2 * o)
  }
}

/** Every px within `half` of the line from a to b, row by row: the lane as the pellet will fill it. */
function capsule(g: G, c: string, x0: number, y0: number, x1: number, y1: number, half: number, inner = -1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy || 1
  const left = Math.floor(Math.min(x0, x1) - half)
  const right = Math.ceil(Math.max(x0, x1) + half) + 1
  // (Each row is searched only round where the line crosses it, as far to each side as the width leans.)
  const lean = Math.abs(dy) > 1 ? half * (1 + Math.sqrt(len2) / Math.abs(dy)) : right - left
  for (let y = Math.floor(Math.min(y0, y1) - half); y <= Math.ceil(Math.max(y0, y1) + half); y++) {
    const mid = Math.abs(dy) > 1 ? x0 + dx * Math.max(0, Math.min(1, (y + 0.5 - y0) / dy)) : (x0 + x1) / 2
    let from = -1
    const to = Math.min(right, Math.ceil(mid + lean) + 1)
    for (let x = Math.max(left, Math.floor(mid - lean)); x <= to; x++) {
      const u = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / len2))
      const d = Math.hypot(x + 0.5 - x0 - dx * u, y + 0.5 - y0 - dy * u)
      const on = d <= half && d > inner
      if (on && from < 0) from = x
      if (!on && from >= 0) { r(g, c, from, y, x - from, 1); from = -1 }
    }
  }
}

/** A ring of hard px, `w` thick, its middle at (x, y). */
function ring(g: G, c: string, x: number, y: number, rad: number, w: number) {
  capsule(g, c, x, y, x, y, rad + w / 2, rad - w / 2)
}

/** How far under the struck circle's middle the finger's gold ring is painted, classic px. */
const SIT = 6

/** The gold chevron, two tiles wide, its point at (x, y). */
function chevron(g: G, x: number, y: number) {
  for (const [c, grow] of [[OUT, 2], [GOLD, 0]] as const) {
    for (let i = 0; i < 16; i++) {
      const top = y - 5 - Math.floor(((15 - i) * 3) / 5)
      for (const side of [-1, 1]) {
        const at = x + (side < 0 ? -16 + i : 15 - i)
        r(g, c, at - grow / 2, top - grow, 1 + grow, 6 + grow * 2)
      }
    }
  }
}

/** The Screen under everything that moves: the slots, the ledges' hands, the arm and its hand, and every warning. */
function screen(k: SideKit, s: GameState) {
  const { g, cx, cy, time, reduced, lights, world } = k
  const info = mapInfo(world, s.map.id)
  const e = s.map.enemies.find(o => o.kind === 'weaver' && !o.dead)
  const pencil = '#7b838f'
  const mode = e?.ai.mode
  const now = e ? handsRight(e) : -1
  for (let n = 0; n < info.def.stamps!.length; n++) {
    const slot = weaverSlot(info, n)
    const x = slot.x * T - cx
    const y = slot.y * T - cy
    // A hand put right is the ledge (its level top is where one stands).
    if (s.flags[info.def.stamps![n]!.flag]) { g.drawImage(toneSprite(sprite('weaver_hand_right'), RIGHT), x - 2, y); continue }
    // Pencilled faint from the first: where a hand will lie.
    for (let i = 1; i < 47; i += 5) { r(g, pencil, x + i, y - 31, 3, 1); r(g, pencil, x + i, y - 1, 3, 1) }
    for (let j = 1; j < 31; j += 5) { r(g, pencil, x + 1, y - 32 + j, 1, 3); r(g, pencil, x + 46, y - 32 + j, 1, 3) }
    if (!(e && n === now && (mode === 'slam' || mode === 'rest'))) pencilHand(g, pencil, x + 15, y - 24)
  }
  if (!e) return
  const { ai } = e
  if (now < 3) {
    const slot = weaverSlot(info, now)
    const x = slot.x * T - cx
    const y = slot.y * T - cy
    const box = weaverFootprint(info, now)
    const bx = box.x * T - cx
    const by = box.y * T - cy
    const up = 1 * T - cy
    // The footprint, from the first of the tell until the hand is down.
    if (mode === 'draw' || mode === 'slam') {
      g.globalAlpha = 0.2
      r(g, PINK, x + 16, up, 16, by - up)
      g.globalAlpha = 1
      pinkBox(g, bx, by, box.w * T, box.h * T, 0.3)
    }
    // In the last second of a rest the outline fills: it is about to lift.
    if (mode === 'rest' && ai.t < 1) {
      const flick = reduced || Math.floor(ai.t * 8) % 2 === 0
      pinkBox(g, bx, by, box.w * T, box.h * T, flick ? 0.65 : 0.45)
    }
    // The arm and the hand. `foot`: the hand's lower edge.
    const hover = y - 36
    let foot: number | null = null
    let name = 'weaver_hand_reach'
    let tall = 32
    if (mode === 'draw') foot = Math.round(up + 40 + (hover - up - 40) * Math.min(1, (1 - ai.t / WEAVER.draw) * 1.3))
    else if (mode === 'slam') { name = 'weaver_hand_grab'; const q = 1 - Math.max(0, ai.t) / WEAVER.slam; foot = Math.round(hover + (y - hover) * q * q) }
    else if (mode === 'rest') { name = 'weaver_hand_rest'; tall = 24; foot = y }
    else if (mode === 'lift') { name = 'weaver_hand_rest'; tall = 24; foot = Math.round(y - (y - up) * (1 - Math.max(0, ai.t) / WEAVER.lift)) }
    if (foot !== null) {
      // (Faded once the hand is down: it is only what the hand hangs from, and the finger is what to look at.)
      g.globalAlpha = mode === 'rest' || mode === 'lift' ? 0.4 : 1
      arm(g, x + 16, up, foot - tall + 6)
      g.globalAlpha = 1
      // (The resting hand is drawn turned about, so that its gold finger is at the near end.)
      g.drawImage(sprite(name, name === 'weaver_hand_rest'), x + (name === 'weaver_hand_rest' ? 3 : 0), foot - tall)
    }
  }
  // The arm drawn up from the hand just put right.
  if (mode === 'gap' && now > 0 && ai.t > WEAVER.gap - 0.5) {
    const done = weaverSlot(info, now - 1)
    const up = 1 * T - cy
    g.globalAlpha = 0.4
    arm(g, done.x * T - cx + 16, up, Math.round(up + (done.y * T - cy - up) * ((ai.t - (WEAVER.gap - 0.5)) / 0.5)))
    g.globalAlpha = 1
  }
  // The ripple's way.
  const c = ctx(world, s, [])
  for (const b of weaverStrips(c, e)) {
    pinkBox(g, Math.round(b.x * T) - cx, b.y * T - cy, Math.round(b.w * T), b.h * T, 0.3)
    const mid = weaverSlot(info, now).x + 1.5
    const way = b.x + b.w / 2 < mid ? -1 : 1
    const run = reduced ? 0 : Math.floor(time * 40) % 20
    for (let i = run; i < b.w * T - 8; i += 20) {
      const at = Math.round(mid * T) - cx + way * i
      for (let j = 0; j < 4; j++) { r(g, PINK, at + way * j, b.y * T - cy + 4 + j, 2, 1); r(g, PINK, at + way * j, b.y * T - cy + 11 - j, 2, 1) }
    }
  }
  // The scribble's lane: as wide as what its pellet takes.
  const lane = weaverLane(e)
  if (lane) {
    const half = (lane.w / 2) * T
    const [x0, y0, x1, y1] = [lane.x0 * T - cx, lane.y0 * T - cy, lane.x1 * T - cx, lane.y1 * T - cy]
    g.globalAlpha = ai.sk === 'aim' ? 0.3 : 0.18
    capsule(g, PINK, x0, y0, x1, y1, half)
    g.globalAlpha = 1
    capsule(g, OUT, x0, y0, x1, y1, half + 2, half + 1)
    capsule(g, PINK, x0, y0, x1, y1, half + 1, half - 1)
    // A pencil's wavering stroke down its middle, as far as it has been drawn.
    const k2 = ai.sk === 'aim' ? 1 - (ai.st as number) / WEAVER.scribble.warn : 1
    const len = Math.hypot(x1 - x0, y1 - y0) || 1
    for (let i = 0; i < len * k2; i += 2) {
      const wob = Math.sin(i * 0.55) * 3
      r(g, PINK, Math.round(x0 + ((x1 - x0) * i) / len - ((y1 - y0) / len) * wob), Math.round(y0 + ((y1 - y0) * i) / len + ((x1 - x0) / len) * wob), 2, 2)
    }
  }
  // The bite: outlined while it is told, filled as it snaps.
  if (mode === 'bite' || mode === 'snap') {
    const q = WEAVER.rect
    const snap = mode === 'snap'
    pinkBox(g, q.x * T - cx, Math.round(q.y * T) - cy, q.w * T, Math.round(q.h * T), snap ? 0.75 : 0.18)
    const teeth = snap ? 10 : 5
    for (let i = 2; i < q.w * T - 6; i += 12) {
      for (let j = 0; j < teeth; j++) {
        r(g, snap ? '#ffffff' : PINK, q.x * T - cx + i + j / 2, Math.round(q.y * T) - cy + 2 + j, Math.max(1, 8 - j), 1)
        r(g, snap ? '#ffffff' : PINK, q.x * T - cx + i + j / 2, Math.round((q.y + q.h) * T) - cy - 3 - j, Math.max(1, 8 - j), 1)
      }
    }
  }
  // The finger: a gold ring that pulses, and the chevron bobbing over it.
  const f = weaverFinger(info, e)
  if (f) {
    const x = Math.round(f.x * T) - cx
    // (Painted `SIT` px under the middle of what a stomp strikes, so that it sits on the hand's gold fingertip and
    // does not float: the struck circle, `WEAVER.finger` round, holds the painted middle well inside it.)
    const y = Math.round(f.y * T) - cy + SIT
    const pulse = reduced ? 0 : Math.round(Math.sin(time * 7) * 1.5)
    const rad = Math.round(WEAVER.finger * T) - 2 + pulse
    ring(g, OUT, x, y, rad, 5)
    ring(g, GOLD, x, y, rad, 2)
    chevron(g, x, y - Math.round(WEAVER.finger * T) - 4 - (reduced ? 0 : Math.round(Math.abs(Math.sin(time * 4)) * 4)))
    lights.push({ x: f.x, y: f.y + SIT / T, r: 2.4, color: GOLD, a: 0.9 })
  }
}

/** The arm: its picture tiled down from the ceiling (`from`) to `to`, px. */
function arm(g: G, x: number, from: number, to: number) {
  const c = sprite('weaver_arm')
  for (let y = to; y > from; y -= c.height) {
    const h = Math.min(c.height, y - from)
    g.drawImage(c, 0, c.height - h, c.width, h, x, y - h, c.width, h)
  }
}

/** What flies and runs: the ripple's waves and the pellet. */
function weaverFlying(k: SideKit, s: GameState) {
  const { g, cx, cy, time, reduced, lights } = k
  const e = s.map.enemies.find(o => o.kind === 'weaver' && !o.dead)
  if (!e) return
  for (const w of weaverWaves(e)) {
    const x = Math.round(w.x * T) - cx
    const floor = WEAVER.floor * T - cy
    // A breaking crest, a tile tall: steep in front, trailing behind.
    for (let i = -8; i < 8; i++) {
      const ahead = i * w.way
      const h = ahead >= 0 ? 15 - Math.floor((ahead * ahead) / 6) : 15 + Math.floor(ahead * 1.4)
      if (h < 2) continue
      r(g, OUT, x + i - 1, floor - h - 1, 3, h + 1)
    }
    for (let i = -8; i < 8; i++) {
      const ahead = i * w.way
      const h = ahead >= 0 ? 15 - Math.floor((ahead * ahead) / 6) : 15 + Math.floor(ahead * 1.4)
      if (h < 2) continue
      r(g, PINK, x + i, floor - h, 1, h)
      r(g, '#ffffff', x + i, floor - h, 1, 2)
    }
    lights.push({ x: w.x, y: WEAVER.floor - 0.5, r: 1.6, color: PINK, a: 0.7 })
  }
  const p = weaverPellet(e)
  if (!p) return
  const x = Math.round(p.x * T) - cx
  const y = Math.round(p.y * T) - cy
  const rad = Math.round(WEAVER.scribble.r * T)
  capsule(g, OUT, x, y, x, y, rad + 1.5)
  capsule(g, PINK, x, y, x, y, rad)
  // A knot of pencil in it, turning.
  const turn = reduced ? 0 : time * 18
  for (let i = 0; i < 14; i++) {
    const a = turn + i * 1.9
    const d = 1 + ((i * 5) % 6)
    r(g, i % 3 ? OUT : '#ffffff', Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 2, 1)
  }
  lights.push({ x: p.x, y: p.y, r: 1.8, color: PINK, a: 0.9 })
}
