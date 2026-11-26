/**
 * The Wildwood's pieces of the renderer: set dressing (MapDef.props — tents,
 * the campfire, the radio mast, the van, Luna's fort, the wall of Christmas
 * lights that spells a word, the Gate, the lift), Luna following the hero,
 * the grappling hook's chain, the Other Side's mood (a red-violet cast and
 * drifting ash) and the Wildwood's fireflies. Read-only on the game state.
 */
import type { Dir, GameState, Prop, World } from '../types'
import { TILE } from '../types'
import { condMet, mapInfo } from '../engine/index'
import { drawText } from '../../base/pixel/font'
import { frameCount, sprite, spriteT } from './sheet'
import { TONES } from './tones'
import { hash2, type Light } from './tiles'

type G = CanvasRenderingContext2D
const T = TILE

/**
 * One thing in the depth sort. `y` is the row the classic view sorts by; `x`
 * and `y` (+ `foot`, the part of a tile from there down to where it touches
 * the ground; `ay` when the anchor is not the sort row) say where it stands,
 * so a view with another projection can move the whole drawing there.
 */
export interface Item { y: number; draw: () => void; x: number; foot?: number; ay?: number; /** Hangs on a wall facing south (a board): a turned view leans it along the wall. */ wall?: boolean; /** Is part of its tile's picture, or lies on it (a sign's neon frame, goods on a counter): a turned view keeps it on that picture and in front of it. */ tile?: boolean; /** Is larger than a person (a cabinet, a tent, a boss): a view that gives each thing a cell of its own gives it a large one. */ big?: boolean; /** Its drawing is the front of a box (a cabinet, a booth): the front's width and height in the drawing and how deep the body stands behind it, classic px. A turned view may stand the front along the wall it faces and close the body behind it. */ box?: { w: number; h: number; d: number; /** The pixel of the front whose colour the body takes, from the front's top-left (none: its left edge, halfway up). */ px?: readonly [number, number] }; /** Things drawn by hand that a turned view may stand in its place (part 23, `iso/things.ts`): each an id and where it stands from the item's (x, ay + foot), in tiles. The classic view ignores them. */ things?: readonly ThingPart[]; /** What the classic painter still draws as a card while those things stand (a DJ behind the table); none: nothing. */ bare?: () => void; /** How far back along the line of sight that card stands, in tiles (the DJ behind the table): the same place on the screen. */ bareBack?: number; /** The shadow those things throw (from the item's point, in tiles: how tall, half wide, half deep). */ shade?: ThingShade; /** A machine's live screens (part 25): regions of the classic drawing (px from the item's point) that a turned view stands in the glass of its first drawn thing (`MACHINE_SCREENS`), the painter's own picture every frame. */ screens?: readonly ThingScreen[] }

/** One drawn thing standing for an item (part 23). */
export interface ThingPart { id: string; dx?: number; dy?: number }
/** The blob shadow of an item's drawn things. */
export interface ThingShade { dx: number; dy: number; tall: number; wide: number; deep?: number }
/** A region of an item's classic drawing, in classic px from the item's point (x, ay): a machine's live screen (part 25). */
export interface ThingScreen { u: number; v: number; w: number; h: number }

function put(g: G, name: string, x: number, y: number, flip = false) {
  const c = sprite(name, flip)
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height))
}

const SPOTS = ['#ff2fa0', '#2ff3ff', '#ffd23f', '#b6ff4a']

/** A mirror ball on a string, and four coloured spots that circle the floor below it. */
function drawDiscoBall(g: G, p: Prop, x: number, y: number, tm: number, lights: Light[]) {
  const cx = Math.round(x)
  const by = Math.round(y)
  g.fillStyle = '#8f86b8'
  g.fillRect(cx, by - 24, 1, 15)
  const widths = [4, 6, 8, 8, 8, 8, 6, 4]
  const shift = Math.floor(tm * 4)
  widths.forEach((w, i) => {
    for (let k = 0; k < w; k++) {
      g.fillStyle = (k + i + shift) % 3 === 0 ? '#fff4ff' : (k + i) % 2 ? '#8f86b8' : '#cfc6ff'
      g.fillRect(cx - w / 2 + k, by - 9 + i, 1, 1)
    }
  })
  g.fillStyle = '#0b0616'
  g.fillRect(cx - 1, by - 10, 2, 1)
  if (Math.floor(tm * 6) % 2 === 0) { g.fillStyle = '#fff4ff'; g.fillRect(cx + 5, by - 7, 1, 1); g.fillRect(cx - 6, by - 4, 1, 1) }
  SPOTS.forEach((c, i) => {
    const a = tm * 0.7 + (i * Math.PI) / 2
    lights.push({ x: p.x + Math.cos(a) * (p.w ?? 3), y: p.y + (p.h ?? 2) + Math.sin(a) * 1.6, r: 2.3, color: c, a: 0.6 })
  })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const BULBS = ['#ff3b5c', '#ffd23f', '#b6ff4a', '#2ff3ff', '#ff2fa0']

/**
 * Queue the map's props for the depth sort (or draw the flat ones now, into
 * `flat`: the ground a view projects, which is `g` itself in the classic one).
 * Anchors are in tiles: a prop stands with its bottom centre at (x, y).
 */
export function queueProps(
  g: G, world: World, s: GameState, cx: number, cy: number, vw: number, vh: number,
  time: number, reduced: boolean, items: Item[], lights: Light[], flat: G = g,
): void {
  const def = mapInfo(world, s.map.id).def
  const props = def.props
  if (!props) return
  const tm = reduced ? 0 : time
  for (const p of props) {
    if (p.when && !condMet(s, world, p.when, -1)) continue
    const x = p.x * T - cx
    const y = p.y * T - cy
    if (x < -80 || x > vw + 80 || y < -80 || y > vh + 120) continue
    switch (p.kind) {
      case 'tent': items.push({ x: p.x, y: p.y, things: [{ id: 'tent', dy: -0.62 }], shade: { dx: 0, dy: -0.62, tall: 0.9, wide: 0.75, deep: 0.6 }, draw: () => put(g, 'prop_tent', x, y + 2) }); break
      case 'bike': items.push({ x: p.x, y: p.y, things: [{ id: 'bike', dy: -0.2 }], shade: { dx: 0, dy: -0.2, tall: 0.5, wide: 0.35, deep: 0.1 }, draw: () => put(g, 'prop_bike', x, y) }); break
      case 'van': items.push({ x: p.x, y: p.y, things: [{ id: 'van', dy: -0.6 }], shade: { dx: 0, dy: -0.6, tall: 1.1, wide: 1.25, deep: 0.55 }, draw: () => put(g, 'prop_van', x, y) }); break
      case 'fort':
        items.push({ x: p.x, y: p.y, things: [{ id: 'fort', dy: -0.6 }], shade: { dx: 0, dy: -0.6, tall: 1, wide: 0.75, deep: 0.55 }, draw: () => put(g, 'prop_fort', x, y) })
        lights.push({ x: p.x, y: p.y - 1, r: 2.4, color: '#ffd23f', a: 0.45 + 0.1 * Math.sin(tm * 2) })
        break
      case 'campfire': {
        const f = Math.floor(tm * 8) % frameCount('prop_campfire', 3)
        items.push({ x: p.x, y: p.y, things: [{ id: `campfire_${f}`, dy: -0.4 }], draw: () => put(g, `prop_campfire_${f}`, x, y) })
        // A wide orange pool, and the heart of it a warmer amber (a gold one turns the grass round it lime).
        lights.push({ x: p.x, y: p.y - 0.4, r: 5.5, color: '#ff8a3d', a: 0.85 + 0.15 * Math.sin(tm * 13), fire: true }, { x: p.x, y: p.y - 0.5, r: 2.4, color: '#ffb13f', a: 0.6 + 0.1 * Math.sin(tm * 9 + 1) })
        break
      }
      case 'mast': {
        const on = Math.floor(tm * 1.5) % 2 === 0
        items.push({ x: p.x, y: p.y, things: [{ id: on ? 'mast_on' : 'mast', dy: -0.5 }], shade: { dx: 0, dy: -0.5, tall: 2.6, wide: 0.45, deep: 0.45 }, draw: () => put(g, on ? 'prop_mast_on' : 'prop_mast', x, y) })
        if (on) lights.push({ x: p.x, y: p.y - 3.4, r: 1.6, color: '#ff3b5c', a: 1 })
        break
      }
      case 'tank': {
        const f = Math.floor(tm * 3 + p.x) % frameCount('prop_tank', 2)
        items.push({ x: p.x, y: p.y, things: [{ id: `tank_${f}`, dy: -0.4 }], shade: { dx: 0, dy: -0.4, tall: 1.3, wide: 0.38 }, draw: () => put(g, `prop_tank_${f}`, x, y) })
        lights.push({ x: p.x, y: p.y - 0.8, r: 2, color: '#3fd8b0', a: 0.6 })
        break
      }
      case 'glow':
        lights.push({ x: p.x, y: p.y, r: p.w ?? 3, color: TONES[p.tone ?? 'pink'], a: 0.5 + 0.1 * Math.sin(tm * 2 + p.x) })
        break
      case 'discoball': items.push({ x: p.x, y: p.y, draw: () => drawDiscoBall(g, p, x, y, tm, lights) }); break
      case 'lights': drawLightsWall(flat, p, x, y, tm, lights); break
      case 'rift': drawRift(flat, p, x, y, tm, lights); break
      case 'lift': {
        flat.fillStyle = '#0b0616'
        flat.fillRect(Math.round(x - 8), Math.round(y - 8), 16, 16)
        flat.fillStyle = '#2ff3ff'
        for (let i = 0; i < 3; i++) flat.fillRect(Math.round(x - 6), Math.round(y - 6 + i * 5 - (Math.floor(tm * 6) % 5)), 12, 1)
        lights.push({ x: p.x, y: p.y, r: 2.2, color: '#2ff3ff', a: 0.8 })
        break
      }
    }
  }
}

/**
 * The wall of Christmas lights: the alphabet painted on the wall, a bulb over
 * each letter on a sagging wire, and the letters of `text` lighting up one
 * at a time, over and over.
 */
function drawLightsWall(g: G, p: Prop, x0: number, y0: number, tm: number, lights: Light[]) {
  const word = p.text ?? ''
  const left = p.x * T
  const per = ((p.w ?? 13) * T) / 26
  // One letter every 0.8 s, then a pause as long as two letters.
  const cycle = word.length + 2
  const step = Math.floor(tm / 0.8) % cycle
  const lit = step < word.length ? word[step]! : ''
  const glowOn = (tm % 0.8) < 0.6
  const baseX = x0 - (p.x * T - left)
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i)
    const lx = Math.round(baseX + i * per + (per - 5) / 2)
    const sag = Math.round(Math.sin((i / 25) * Math.PI) * 2 + Math.sin(i * 1.7) * 0.6)
    const by = Math.round(y0 + 2 + sag)
    // Wire
    g.fillStyle = '#12081e'
    g.fillRect(Math.round(baseX + i * per), by - 1, Math.ceil(per), 1)
    const on = ch === lit && glowOn
    const col = BULBS[i % BULBS.length]!
    g.fillStyle = on ? '#ffffff' : col
    g.globalAlpha = on ? 1 : 0.55
    g.fillRect(lx + 1, by, 3, 3)
    g.globalAlpha = 1
    drawText(g, ch, lx, Math.round(y0 + 6), on ? '#ffffff' : '#8a7cb8', '#0b0616')
    const wx = (lx + 2) / T + (p.x - x0 / T)
    const wy = (by + 1) / T + (p.y - y0 / T)
    lights.push(on ? { x: wx, y: wy + 0.2, r: 3.2, color: col, a: 1 } : { x: wx, y: wy, r: 0.8, color: col, a: 0.4 })
  }
}

/** The Gate: a tear in the wall, flesh-red at the edges, static inside, breathing. */
function drawRift(g: G, p: Prop, x0: number, y0: number, tm: number, lights: Light[]) {
  const w = (p.w ?? 6) * T
  const h = (p.h ?? 2.5) * T
  const cx = x0 + w / 2
  const cy = y0 + h / 2
  const breathe = 1 + Math.sin(tm * 1.7) * 0.06
  for (let yy = -h / 2; yy < h / 2; yy++) {
    const f = 1 - (2 * yy / h) ** 2
    if (f <= 0) continue
    const half = Math.sqrt(f) * (w / 2) * breathe
    const y = Math.round(cy + yy)
    g.fillStyle = '#3a0820'
    g.fillRect(Math.round(cx - half - 2), y, Math.round(half * 2 + 4), 1)
    g.fillStyle = '#8a1440'
    g.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1)
    const inner = half * 0.72
    for (let xx = -inner; xx < inner; xx += 2) {
      const n = hash2(Math.round(xx + cx), y, Math.floor(tm * 12))
      g.fillStyle = n < 0.33 ? '#cfc6ff' : n < 0.66 ? '#5a5285' : '#0b0616'
      g.fillRect(Math.round(cx + xx), y, 2, 1)
    }
  }
  lights.push({ x: p.x + (p.w ?? 6) / 2, y: p.y + (p.h ?? 2.5) / 2, r: 6, color: '#ff3b5c', a: 0.8 + 0.2 * Math.sin(tm * 1.7) })
}

// ---------------------------------------------------------------------------
// Luna
// ---------------------------------------------------------------------------

/**
 * The way a figure facing `d` in the world shows to a camera turned `yaw` from north (`Kit.setFacing`): the nearest
 * of the four. 0 leaves it as it is.
 */
export function facingDir(d: Dir, yaw: number): Dir {
  if (!yaw) return d
  const a = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[d] - yaw
  const q = ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4
  return (['right', 'down', 'left', 'up'] as const)[q]!
}
let lunaFacing = 0
/** The camera's turn for Luna's four ways (`Kit.setFacing`). */
export function setLunaFacing(yaw: number): void { lunaFacing = yaw }

function dirKey(d: Dir): { key: string; flip: boolean } {
  d = facingDir(d, lunaFacing)
  if (d === 'left') return { key: 'side', flip: true }
  if (d === 'right') return { key: 'side', flip: false }
  return { key: d, flip: false }
}

export function queueLuna(g: G, s: GameState, cx: number, cy: number, items: Item[], lights: Light[]) {
  const L = s.luna
  if (!L || s.hero.x < -10) return
  items.push({
    x: L.x,
    foot: 6 / T,
    y: L.y - 0.01,
    draw: () => {
      const x = L.x * T - cx
      const feet = L.y * T - cy + 6
      g.fillStyle = 'rgba(8,4,20,0.42)'
      g.fillRect(Math.round(x - 4), Math.round(feet - 1), 8, 2)
      if (L.psi > 0) { put(g, 'luna_psi', x, feet); return }
      const { key, flip } = dirKey(L.dir)
      const walking = L.walkT > 0
      const f = walking ? [1, 0, 2, 0][Math.floor(L.walkT * 7) % 4]! : 0
      put(g, `luna_${key}_${f}`, x, feet, flip)
    },
  })
  if (L.psi > 0) lights.push({ x: L.x, y: L.y - 0.6, r: 2.2, color: '#ff8ae0', a: 0.9 })
}

// ---------------------------------------------------------------------------
// The hook's chain
// ---------------------------------------------------------------------------

export function drawHookChain(g: G, s: GameState, cx: number, cy: number, lights: Light[]) {
  const k = s.hook
  if (!k) return
  const h = s.hero
  const hx = h.x * T - cx + k.dx * 4
  const hy = h.y * T - cy - 4 + k.dy * 4
  const tx = k.x * T - cx
  const ty = k.y * T - cy - 4
  const len = Math.hypot(tx - hx, ty - hy)
  const n = Math.floor(len / 4)
  const link = sprite('hook_link')
  for (let i = 1; i < n; i++) {
    const t = i / n
    g.drawImage(link, Math.round(hx + (tx - hx) * t - 1), Math.round(hy + (ty - hy) * t - 1))
  }
  const vert = k.dy !== 0
  const head = spriteT(vert ? 'hook_head_v' : 'hook_head_h', !vert && k.dx < 0, vert && k.dy > 0)
  g.drawImage(head, Math.round(tx - head.width / 2), Math.round(ty - head.height / 2))
  lights.push({ x: k.x, y: k.y, r: 1.2, color: '#cfc6ff', a: 0.7 })
}

// ---------------------------------------------------------------------------
// Moods
// ---------------------------------------------------------------------------

/** The Other Side leaking in: a red-violet cast and ash drifting up. Drawn after the light. */
export function drawStaticMood(g: G, vw: number, vh: number, cx: number, cy: number, time: number, reduced: boolean) {
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = '#d88ab8'
  g.fillRect(0, 0, vw, vh)
  g.globalCompositeOperation = 'source-over'
  if (reduced) return
  g.fillStyle = 'rgba(207,198,255,0.55)'
  for (let i = 0; i < 40; i++) {
    const sx = hash2(i, 1, 9) * 400
    const sy = hash2(i, 2, 9) * 400
    const x = ((sx - cx * 0.4 + Math.sin(time * 0.6 + i) * 8) % vw + vw) % vw
    const y = ((sy - cy * 0.4 - time * (6 + (i % 5) * 2)) % vh + vh) % vh
    g.fillRect(Math.round(x), Math.round(y), i % 3 ? 1 : 2, 1)
  }
}

/**
 * Fireflies over the Wildwood at night: small lights that wander. A realm brings its own (`looks.ts`
 * `MOOD.flies`): their colour, the light they give and how many at the dusk's strength.
 */
export function fireflies(cx: number, cy: number, vw: number, vh: number, time: number, lights: Light[], g: G, amount = 1, color = '#e8ff8a', light = '#b6ff4a', count = 18) {
  const n = Math.round(count * amount)
  for (let i = 0; i < n; i++) {
    const bx = (hash2(i, 3, 17) * (vw + 64)) + cx - 32
    const by = (hash2(i, 4, 17) * (vh + 64)) + cy - 32
    const x = bx + Math.sin(time * 0.7 + i * 1.3) * 14
    const y = by + Math.cos(time * 0.5 + i * 2.1) * 10
    const a = 0.5 + 0.5 * Math.sin(time * 2.3 + i * 4.1)
    if (a < 0.15) continue
    g.globalAlpha = a
    g.fillStyle = color
    g.fillRect(Math.round(x - cx), Math.round(y - cy), 1, 1)
    g.globalAlpha = 1
    lights.push({ x: x / T, y: y / T, r: 0.6, color: light, a: a * 0.7 })
  }
}
