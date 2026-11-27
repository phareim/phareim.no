/**
 * The painter of Act Three (docs/worlds/act-three.md), read by the side painter (`side.ts`): the Fogstage's colours
 * behind the scenery and its backdrops, and THE LENS's picture (`engine/lens.ts`) — what is false and what is hidden,
 * and the ring round a still hero's feet. Read-only on the game state.
 *
 * A false thing is drawn exactly as the real one, by the real one's own code; under the glass it fades to a pale cyan
 * outline of what it pretended to be, never pink, never gold. A hidden thing is drawn by the glass alone, and once
 * shown stays faint for the visit.
 *
 * STAND-INS, drawn here in code: the backdrops (joists and fog; painted flats; ropes and rigging).
 */
import type { GameState, MapDef, Rect } from '../types'
import { HERO_R, TILE } from '../types'
import { LENS, glassThings, isFalse, lieGone, type GlassThing } from '../engine/lens'
import { has, mapInfo, type MapInfo } from '../engine/map'
import { hash2 } from './tiles'
import { makeCanvas } from './sheet'
import { chest, doorway, platform, type Ink, type SideKit } from './side'

type G = CanvasRenderingContext2D
type Canvas = HTMLCanvasElement
const T = TILE
const r = (g: G, c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h) }

// ---------------------------------------------------------------------------
// The scenery's colours and what hangs behind it
// ---------------------------------------------------------------------------

/** Under the stage: the Fogstage's slate, fog-lilac edges and sea-dark air; no pink and no gold in any of it. */
const STAGE_INK: Ink = { sky: '#0a141c', sky2: '#0f1e28', far: '#17323a', face: '#4a4262', shade: '#2c2640', mortar: '#3b3452', top: '#8f86ac', lip: '#dcd6ee', wood: '#6e5a62', woodL: '#c4b0b4' }
const ofAct = (def: Pick<MapDef, 'keyring'>) => def.keyring === 'actthree'
export const actInk = (def: Pick<MapDef, 'keyring'>): Ink | null => (ofAct(def) ? STAGE_INK : null)

type Scene = (g: G, x: number, y: number, w: number, h: number, dx: number, z: Rect, time: number) => void

/** Scene one: the stage's joists and posts, and fog lying along the bottom of them. */
const joists: Scene = (g, x, y, w, h, dx, z, time) => {
  for (let i = -2; i < w / 56 + 2; i++) {
    const px = x + dx + i * 56 + 10
    r(g, '#122a30', px, y, 6, h)
    r(g, '#183840', px, y, 1, h)
  }
  for (let row = 40; row < h; row += 64) {
    r(g, '#142e36', x, y + row, w, 5)
    r(g, '#1c4048', x, y + row, w, 1)
    for (let i = -2; i < w / 56 + 2; i++) {
      const px = x + dx + i * 56 + 16
      for (let k = 0; k < 20; k++) r(g, '#122a30', px + k * 2, y + row + 5 + k, 3, 1)
    }
  }
  fog(g, x, y, w, h, z, time)
}
/** Scene two: painted flats on their braces, a hill and an arch on each. */
const flats: Scene = (g, x, y, w, h, dx, z, time) => {
  for (let floor = h + 20; floor > 0; floor -= 118) {
    for (let i = -2; i < w / 62 + 2; i++) {
      const tall = 66 + Math.floor(hash2(i, floor, 61) * 34)
      const px = x + dx + i * 62 + Math.floor(hash2(i, floor, 62) * 8)
      const py = y + floor - tall
      r(g, '#142c34', px, py, 46, tall)
      r(g, '#1d4048', px, py, 46, 1)
      r(g, '#1d4048', px, py, 1, tall)
      if (hash2(i, floor, 63) > 0.5) {
        for (let k = 0; k < 18; k++) r(g, '#183a38', px + 3 + k, py + tall - 8 - k, 40 - k * 2, 1)
      } else {
        r(g, '#0c1a22', px + 13, py + 24, 20, tall - 24)
        r(g, '#0c1a22', px + 17, py + 18, 12, 6)
      }
    }
  }
  fog(g, x, y, w, h, z, time)
}
/** Scene three: ropes from the grid, a batten here and there, a counterweight. */
const rigging: Scene = (g, x, y, w, h, dx, z, time) => {
  for (let i = -3; i < w / 22 + 3; i++) {
    const px = x + dx + i * 22 + Math.floor(hash2(i, z.y, 71) * 10)
    r(g, '#1a343a', px, y, 1, h)
    if (hash2(i, z.y, 72) > 0.7) r(g, '#17323a', px - 3, y + Math.floor(hash2(i, z.y, 73) * (h - 20)), 7, 14)
  }
  for (let row = 28; row < h; row += 72) { r(g, '#142e36', x, y + row, w, 3); r(g, '#1c4048', x, y + row, w, 1) }
  fog(g, x, y, w, h, z, time)
}
/** Slow banks of fog, thickest low down. */
function fog(g: G, x: number, y: number, w: number, h: number, z: Rect, time: number) {
  const was = g.globalAlpha
  for (let i = 0; i < 4; i++) {
    g.globalAlpha = was * (0.05 + i * 0.02)
    const top = y + h - 64 + i * 15
    const drift = Math.round(time * (3 + i) + hash2(i, z.x, 81) * 60)
    for (let k = -1; k < w / 48 + 1; k++) {
      const px = x + k * 48 + (drift % 48)
      r(g, '#8fb4bc', px, top, 34, 5)
      r(g, '#8fb4bc', px + 6, top - 2, 20, 2)
    }
  }
  g.globalAlpha = was
}
const SCENES: Record<string, Scene> = { actunder: joists, actdoors: joists, actbard: flats, actflats: flats, actwings: flats, actloft: rigging }

export function actBackdrop(def: MapDef): ((k: SideKit, z: Rect) => void) | null {
  if (!ofAct(def)) return null
  const scene = SCENES[def.id] ?? flats
  return (k, z) => {
    const { g, cx, cy, vw, time, reduced } = k
    const x = z.x * T - cx
    const y = z.y * T - cy
    const w = z.w * T
    const h = z.h * T
    g.save()
    g.beginPath()
    g.rect(x, y, w, h)
    g.clip()
    r(g, STAGE_INK.sky, x, y, w, h)
    r(g, STAGE_INK.sky2, x, y + Math.round(h * 0.55), w, h)
    // (Half the camera's way sideways, as every side map's near layer.)
    scene(g, x, y, w, h, Math.round((cx - (z.x * T + (w - vw) / 2)) / 2), z, reduced ? 0 : time)
    g.restore()
  }
}

// ---------------------------------------------------------------------------
// The glass
// ---------------------------------------------------------------------------

/** What the glass draws a false thing as: pale cyan, never the pink of a warning or the gold of an opening. */
export const GLASS = '#b4f6ff'

const edges = new WeakMap<Canvas, Canvas>()
/** The outline of a picture, 2 px inside its own edge, in the glass's cyan. */
export function outlineOf(src: Canvas): Canvas {
  let out = edges.get(src)
  if (out) return out
  const { width: w, height: h } = src
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3]! > 127
  out = makeCanvas(w, h)
  const g = out.getContext('2d')!
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue
    if ([1, 2].some(d => !solid(x - d, y) || !solid(x + d, y) || !solid(x, y - d) || !solid(x, y + d))) r(g, GLASS, x, y)
  }
  edges.set(src, out)
  return out
}

/** A platform's or a doorway's picture, on a sheet of its own: (dx, dy) from the first tile's corner. */
interface Cut { canvas: Canvas; dy: number; w: number }
const cuts = new WeakMap<MapInfo, Map<number, Cut | null>>()
/** The cut for a false or hidden ledge (a whole run, on its first tile; null on the others) or a false door. */
function cutOf(info: MapInfo, ink: Ink, t: GlassThing): Cut | null {
  let all = cuts.get(info)
  if (!all) cuts.set(info, all = new Map())
  const had = all.get(t.i)
  if (had !== undefined) return had
  const list = glassThings(info)
  const like = (x: number) => list.some(o => o.is === t.is && o.y === t.y && o.x === x)
  let cut: Cut | null = null
  if (t.is === 'door') {
    const canvas = makeCanvas(T, T + 2)
    doorway(canvas.getContext('2d')!, ink, 0, 2)
    cut = { canvas, dy: -2, w: 1 }
  } else if (!like(t.x - 1)) {
    let n = 1
    while (like(t.x + n)) n++
    const canvas = makeCanvas(n * T, T)
    const g = canvas.getContext('2d')!
    for (let k = 0; k < n; k++) platform(g, ink, k * T, 0, k === 0, k === n - 1)
    cut = { canvas, dy: 0, w: n }
  }
  all.set(t.i, cut)
  return cut
}

/** A picture at `a`, and the context's own alpha as it was. */
function faded(g: G, a: number, draw: () => void) {
  if (a <= 0.004) return
  const was = g.globalAlpha
  g.globalAlpha = was * Math.min(1, a)
  draw()
  g.globalAlpha = was
}

/** Whether the glass draws this tile (a hidden ledge, a hidden chest not yet opened): the ordinary painter does not. */
export function glassHides(s: GameState, info: MapInfo, i: number): boolean {
  return glassThings(info).some(t => t.i === i && (t.is === 'veil' || (t.is === 'cache' && !has(s, `chest:${t.id}`))))
}

/** The tiles the still layer leaves out: the hidden ledges. */
export const veiledTiles = (info: MapInfo): ReadonlySet<number> => new Set(glassThings(info).filter(t => t.is === 'veil').map(t => t.i))

/** A faint cyan light along an outline, so that the side view's dusk does not turn it blue. */
function glint(k: SideKit, t: GlassThing, wide: number, a: number) {
  for (let n = 0; n < wide; n++) k.lights.push({ x: t.x + n + 0.5, y: t.y + (t.is === 'ledge' ? 0.2 : 0.5), r: 0.9, color: '#2ff3ff', a: 0.45 * a })
}

/** What is false and what is hidden, over the tiles and under everybody. */
export function glassThingsPaint(k: SideKit, s: GameState, ink: Ink) {
  const { g, cx, cy, world } = k
  const info = mapInfo(world, s.map.id)
  const list = glassThings(info)
  if (!list.length) return
  const q = s.lens?.k ?? 0
  for (const t of list) {
    const px = t.x * T - cx
    const py = t.y * T - cy
    const lie = isFalse(t)
    // A false thing is as solid-looking as the glass is down; a hidden one as it is up, or faint once it has been shown.
    const mine = t.cell === s.zoneIndex ? q : 0
    const a = lie ? 1 - mine : Math.max(mine, s.map.lensSeen?.includes(t.i) ? LENS.pencil : 0)
    if (t.is === 'chest' || t.is === 'cache') {
      if (t.is === 'chest' && lieGone(s, t.i)) continue
      if (t.is === 'cache' && has(s, `chest:${t.id}`)) continue
      faded(g, a, () => chest(k, px, py, t.x, t.y, false, false, a))
      if (lie) faded(g, mine, () => { const o = outlineOf(chest.picture(false, false)); g.drawImage(o, Math.round(px + 8 - o.width / 2), py + T - o.height); glint(k, t, 1, mine) })
      continue
    }
    const cut = cutOf(info, ink, t)
    if (!cut) continue
    faded(g, a, () => g.drawImage(cut.canvas, px, py + cut.dy))
    if (lie) faded(g, mine, () => { g.drawImage(outlineOf(cut.canvas), px, py + cut.dy); glint(k, t, cut.w, mine) })
  }
  // A false chest opened: it was paint and air.
  for (const gone of s.map.lensGone ?? []) {
    if (gone.t >= LENS.puff) continue
    const f = gone.t / LENS.puff
    const x = (gone.i % s.map.w) * T - cx + 8
    const y = Math.floor(gone.i / s.map.w) * T - cy + 9
    faded(g, 1 - f * f, () => {
      for (let n = 0; n < 9; n++) {
        const way = (n / 9) * Math.PI * 2
        const d = 2 + f * (8 + hash2(n, gone.i, 91) * 5)
        const big = Math.max(1, Math.round(5 * (1 - f) + hash2(n, gone.i, 92) * 2))
        r(g, n % 3 ? '#ffffff' : '#d8e4ec', Math.round(x + Math.cos(way) * d - big / 2), Math.round(y + Math.sin(way) * d * 0.7 - f * 5 - big / 2), big, big)
      }
    })
  }
}

/**
 * The ring: the only sign the glass is coming. Round the still hero's feet from `LENS.ring`, 1.4 tiles across, it
 * grows and fills until the glass is up, and goes as the picture changes. Only where the screen holds something.
 */
export function glassRing(k: SideKit, s: GameState) {
  const l = s.lens
  if (!l || !l.here || l.still < LENS.ring) return
  const gone = l.up ? l.k : 0
  if (gone >= 1) return
  const { g, cx, cy, reduced } = k
  const p = Math.min(1, (l.still - LENS.ring) / (LENS.up - LENS.ring))
  const x = Math.round(s.hero.x * T) - cx
  const y = Math.round((s.hero.y + HERO_R) * T) - cy
  // (Half a tile across at once, the whole 1.4 by the end.)
  const rx = Math.round(T * 0.7 * (reduced ? 1 : 0.45 + 0.55 * p))
  const ry = Math.max(3, Math.round(rx * 0.55))
  const span = (row: number, a: number, b: number) => (Math.abs(row) > b ? -1 : Math.round(a * Math.sqrt(1 - (row / (b + 0.4)) ** 2)))
  // The pale fill rises from the middle outward.
  faded(g, (0.16 + 0.26 * p) * (1 - gone), () => {
    const fx = Math.max(1, Math.round(rx * p))
    const fy = Math.max(1, Math.round(ry * p))
    for (let row = -fy; row <= fy; row++) { const w = span(row, fx, fy); if (w >= 0) r(g, GLASS, x - w, y + row, w * 2 + 1, 1) }
  })
  faded(g, (0.55 + 0.45 * p) * (1 - gone), () => {
    for (let row = -ry; row <= ry; row++) {
      const w = span(row, rx, ry)
      const inner = span(row, rx - 2, ry - 2)
      if (inner < 0) r(g, GLASS, x - w, y + row, w * 2 + 1, 1)
      else { r(g, GLASS, x - w, y + row, w - inner, 1); r(g, GLASS, x + inner + 1, y + row, w - inner, 1) }
    }
  })
}
