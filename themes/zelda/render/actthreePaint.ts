/**
 * The painter of Act Three (docs/worlds/act-three.md), read by the side painter (`side.ts`): the Fogstage's colours
 * behind the scenery and its backdrops, and THE LENS's picture (`engine/lens.ts`) — what is false and what is hidden,
 * and the ring round a still hero's feet. Read-only on the game state.
 *
 * A false thing is drawn exactly as the real one, by the real one's own code; under the glass it fades to a pale cyan
 * outline of what it pretended to be, never pink, never gold. A hidden thing is drawn by the glass alone, and once
 * shown stays faint for the visit.
 *
 * And the stage's own hazards: the pieces BARD hides in and BARD itself, its stencils, the sandbags, the
 * understudy's lane and the gondola's plate. THE HALLUCINATOR is here whole (`engine/bossHallucinator.ts`): its three
 * bodies, its lying white bar and the glass's cyan one, the claim's arrow, its stencils and crates (real and painted
 * by one piece of code, so that only the stencil and the glass tell them apart), the gold rail, the plate's cone and
 * ring, and the white puffs. Pink is a blow to come, and nothing false is ever pink or gold.
 *
 * STAND-INS, drawn here in code: the backdrops (joists and fog; painted flats; ropes and rigging; night and the
 * cable); BARD's three pieces (a door, a chest, a rope end); the sandbag and its rope; the plate, its cone and ring;
 * the gold rail; the white and cyan bars and the claim's arrow.
 */
import type { Enemy, GameState, MapDef, MapState, Rect } from '../types'
import { HERO_R, TILE, TOUGH } from '../types'
import { LENS, glassThings, isFalse, lieGone, type GlassThing } from '../engine/lens'
import { BARD, BARD_SET, bardBags, bardBoxes, bardOpen, bardOut, bardPiece, bardUnseen, type BardPiece } from '../engine/bossBard'
import { BAG, bagAt, bagsOf, column, type Box } from '../engine/sandbag'
import { HALLU, halluAims, halluBodies, halluBoxes, halluLain, halluOpen, halluPaint, halluPopped, halluShown } from '../engine/bossHallucinator'
import { PLATFORM } from '../world/tiles'
import { has, mapInfo, type MapInfo } from '../engine/map'
import { hash2 } from './tiles'
import { makeCanvas, silhouette, sprite } from './sheet'
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
/** Scene four: night over the fog, the great cable going up through it, and the fog thick at the bottom. */
const night: Scene = (g, x, y, w, h, dx, z, time) => {
  for (let i = 0; i < (w * h) / 900; i++) r(g, i % 5 ? '#2a4a56' : '#7fa0aa', x + Math.floor(hash2(i, z.x, 91) * w), y + Math.floor(hash2(i, z.x, 92) * h * 0.8), 1, 1)
  // The cable: from low on the left to high on the right, with a clip here and there.
  for (let k = 0; k <= h; k += 2) {
    const px = x + dx + Math.round(w * 0.3 + (1 - k / h) * w * 0.42)
    r(g, '#1c3a44', px, y + k, 5, 2)
    r(g, '#2c5560', px, y + k, 1, 2)
    if (k % 56 === 28) r(g, '#2c5560', px - 2, y + k, 9, 3)
  }
  fog(g, x, y, w, h, z, time)
  const was = g.globalAlpha
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = was * 0.1
    r(g, '#8fb4bc', x, y + h - 44 + i * 8, w, 44 - i * 8)
  }
  g.globalAlpha = was
  fog(g, x, y + 8, w, h, z, time * 1.7)
}
const SCENES: Record<string, Scene> = { actunder: joists, actdoors: joists, actbard: flats, actflats: flats, actwings: flats, actloft: rigging, actstudy: rigging, actcable: night, actgondola: night }

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
    puff(g, (gone.i % s.map.w) * T - cx + 8, Math.floor(gone.i / s.map.w) * T - cy + 9, gone.t / LENS.puff, gone.i, 1)
  }
}

/** A white puff round (x, y), `f` (0..1) through it: what was paint, or never there. Never pink. */
function puff(g: G, x: number, y: number, f: number, seed: number, size: number) {
  faded(g, 1 - f * f, () => {
    for (let n = 0; n < 9 * size; n++) {
      const way = (n / (9 * size)) * Math.PI * 2
      const d = (2 + f * (8 + hash2(n, seed, 91) * 5)) * size
      const big = Math.max(1, Math.round((5 * (1 - f) + hash2(n, seed, 92) * 2) * (size > 1 ? 1.5 : 1)))
      r(g, n % 3 ? '#ffffff' : '#d8e4ec', Math.round(x + Math.cos(way) * d - big / 2), Math.round(y + Math.sin(way) * d * 0.7 - f * 5 - big / 2), big, big)
    }
  })
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

// ---------------------------------------------------------------------------
// The stage's hazards
// ---------------------------------------------------------------------------

/** A blow to come: pink, with a one-pixel dark outline so that it reads on any ground. Its boxes are the hurt boxes. */
const PINK = '#ff2fa0'
const DARK = '#0b0616'

function danger(k: SideKit, boxes: readonly Box[], p: number) {
  const { g, cx, cy, time, reduced } = k
  const blink = !reduced && p > 0.65 && Math.floor(time * 14) % 2 === 0
  for (const b of boxes) {
    const x = Math.round(b.x0 * T) - cx
    const y = Math.round(b.y0 * T) - cy
    const w = Math.round(b.x1 * T) - cx - x
    const h = Math.round(b.y1 * T) - cy - y
    faded(g, 0.18 + 0.27 * Math.max(0, Math.min(1, p)), () => r(g, PINK, x, y, w, h))
    const edge = (c: string, i: number) => { r(g, c, x + i, y + i, w - i * 2, 1); r(g, c, x + i, y + h - 1 - i, w - i * 2, 1); r(g, c, x + i, y + i, 1, h - i * 2); r(g, c, x + w - 1 - i, y + i, 1, h - i * 2) }
    edge(DARK, -1)
    edge(blink ? '#ffc2e6' : PINK, 0)
  }
}

/** Chevrons along a band, the way the door will run. */
function chevrons(k: SideKit, b: Box, way: number) {
  const { g, cx, cy, time, reduced } = k
  const mid = Math.round(((b.y0 + b.y1) / 2) * T) - cy
  const run = reduced ? 0 : Math.floor(time * 40) % T
  const from = Math.round(b.x0 * T) - cx
  const to = Math.round(b.x1 * T) - cx
  for (let x = from + 6 + (way > 0 ? run : T - run); x < to - 6; x += T) {
    for (let i = -4; i <= 4; i++) r(g, PINK, x - way * Math.abs(i), mid + i, 2, 1)
  }
}

/**
 * BARD's pictures are small ones, drawn at three times their size: 33 × 27 px, its 2 tiles across. Their trim is gold
 * as drawn; gold means "open", so it is worn only dazed, and pale lilac while BARD sings.
 */
export const BARD_SCALE = 3
const bards = new Map<string, Canvas>()
function bardPicture(name: string, flip: boolean, white: boolean): Canvas {
  const key = `${name}|${flip}|${white}`
  let c = bards.get(key)
  if (c) return c
  const src = white ? silhouette(name, '#ffffff', flip) : sprite(name, flip)
  c = makeCanvas(src.width * BARD_SCALE, src.height * BARD_SCALE)
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(src, 0, 0, c.width, c.height)
  if (!white && name === 'bard_sing') {
    const img = g.getImageData(0, 0, c.width, c.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) if (d[i]! > 220 && d[i + 1]! > 170 && d[i + 2]! < 130) { d[i] = 0xdc; d[i + 1] = 0xd6; d[i + 2] = 0xee }
    g.putImageData(img, 0, 0)
  }
  bards.set(key, c)
  return c
}

/** BARD as it stands out of the set (`renderer.ts` `drawEnemy`); behind the set, or still the piece, nothing. */
export function drawBard(k: { g: G; lights: SideKit['lights'] }, e: Enemy, x: number, feet: number, name: string, flip: boolean, white: boolean) {
  if (!bardOut(e)) return
  const c = bardPicture(name, flip, white)
  k.g.drawImage(c, Math.round(x - c.width / 2), Math.round(feet - c.height))
  const open = bardOpen(e)
  k.lights.push({ x: e.x, y: e.y - 0.2, r: 2.4, color: open ? '#ffd23f' : '#c4fbff', a: open ? 0.65 : 0.5 })
}

/** The three pieces of the set, STAND-INS: muted wood and lilac, no gold and no pink. */
const pieces = new Map<BardPiece, Canvas>()
function pieceOf(p: BardPiece): Canvas {
  let c = pieces.get(p)
  if (c) return c
  const wood = '#6e5a62', woodL = '#c4b0b4', lilac = '#8f86ac', pale = '#dcd6ee', dim = '#4a4262'
  if (p === 'door') {
    c = makeCanvas(24, 34)
    const g = c.getContext('2d')!
    r(g, DARK, 0, 0, 24, 34)
    r(g, lilac, 1, 1, 22, 33)
    r(g, DARK, 3, 3, 18, 31)
    r(g, wood, 4, 4, 16, 30)
    for (const y of [7, 21]) { r(g, dim, 6, y, 12, 10); r(g, woodL, 6, y, 12, 1) }
    r(g, pale, 16, 18, 2, 3)
  } else if (p === 'chest') {
    c = makeCanvas(24, 17)
    const g = c.getContext('2d')!
    r(g, DARK, 1, 0, 22, 17)
    r(g, DARK, 0, 3, 24, 14)
    r(g, wood, 2, 1, 20, 15)
    r(g, woodL, 2, 1, 20, 1)
    r(g, DARK, 1, 7, 22, 1)
    for (const x of [4, 18]) r(g, lilac, x, 1, 2, 15)
    r(g, pale, 10, 6, 4, 5)
    r(g, DARK, 11, 8, 2, 2)
  } else {
    // From the ceiling to the ledge, with a loop and a frayed end lying on it.
    const h = (BARD.ledge - 1) * T
    c = makeCanvas(18, h)
    const g = c.getContext('2d')!
    for (let y = 0; y < h - 14; y += 2) { r(g, DARK, 6, y, 6, 2); r(g, (y / 2) % 3 ? woodL : wood, 7, y, 4, 2) }
    r(g, DARK, 3, h - 16, 12, 12)
    r(g, woodL, 4, h - 15, 10, 10)
    r(g, DARK, 7, h - 12, 4, 4)
    r(g, DARK, 1, h - 5, 16, 5)
    r(g, woodL, 2, h - 4, 14, 3)
    for (let x = 3; x < 16; x += 3) r(g, wood, x, h - 3, 1, 3)
  }
  pieces.set(p, c)
  return c
}

/** BARD's set: its pieces, standing; the one it is about to step out of shudders in a pink outline. */
function bardSet(k: SideKit, s: GameState) {
  const { g, cx, cy, time, reduced } = k
  const e = s.map.enemies.find(v => v.kind === 'bard')
  for (const p of Object.keys(BARD_SET) as BardPiece[]) {
    const mine = !!e && !e.dead && bardPiece(e) === p
    // Stepped out of: BARD is that piece now.
    if (mine && (e!.ai.mode === 'blow' || e!.ai.mode === 'open')) continue
    const c = pieceOf(p)
    const telling = mine && e!.ai.mode === 'tell'
    const shake = telling && !reduced ? (Math.floor(time * 22) % 2 ? 1 : -1) : 0
    const x = Math.round(BARD_SET[p].x * T - c.width / 2) - cx + shake
    const y = BARD_SET[p].floor * T - c.height - cy
    if (telling) {
      const rim = silhouetteOf(c, PINK)
      const dark = silhouetteOf(c, DARK)
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2]] as const) g.drawImage(dark, x + dx, y + dy)
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]] as const) g.drawImage(rim, x + dx, y + dy)
    }
    g.drawImage(c, x, y)
  }
  // Through the glass: its outline over the piece it is hiding in, the whole of its hiding.
  const q = s.lens?.k ?? 0
  if (e && !e.dead && e.ai.mode === 'hide' && q > 0) {
    const at = BARD_SET[bardPiece(e)]
    const o = outlineOf(bardPicture('bard_sing', false, false))
    faded(g, q, () => g.drawImage(o, Math.round(at.x * T - o.width / 2) - cx, at.floor * T - o.height - cy))
    k.lights.push({ x: at.x, y: at.floor - 0.9, r: 1.6, color: '#2ff3ff', a: 0.5 * q })
  }
}

const flats2 = new WeakMap<Canvas, Map<string, Canvas>>()
/** A picture's shape in one colour. */
function silhouetteOf(src: Canvas, color: string): Canvas {
  let all = flats2.get(src)
  if (!all) flats2.set(src, all = new Map())
  let c = all.get(color)
  if (c) return c
  c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-in'
  r(g, color, 0, 0, c.width, c.height)
  all.set(color, c)
  return c
}

/** BARD's blow: the stencil while it tells and lands, and its bags, falling and then lying. */
function bardBlow(k: SideKit, s: GameState) {
  const e = s.map.enemies.find(v => v.kind === 'bard')
  if (!e || e.dead) return
  const m = s.map
  const piece = bardPiece(e)
  const boxes = bardBoxes(m, e)
  const whole = piece === 'rope' ? BARD.ropeTell : BARD.tell
  danger(k, boxes, e.ai.mode === 'tell' ? 1 - e.ai.tell / whole : 1)
  if (piece === 'door') for (const b of boxes) chevrons(k, b, e.ai.way as number)
  if (piece !== 'rope' || bardUnseen(e)) return
  for (const x of bardBags(e)) {
    const wide = column(m, x - BARD.bagW / 2, x + BARD.bagW / 2, 1).sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))[0]
    if (!wide) continue
    const top = T + 14
    const down = wide.y1 * T
    const p = e.ai.mode === 'tell' ? 0 : e.ai.mode === 'blow' ? Math.max(0, Math.min(1, 1 - e.ai.t / BARD.drop)) : 1
    sack(k, x * T - k.cx, Math.round(top + (down - top) * p * p) - k.cy, p < 1 ? T - k.cy : null)
  }
}

/** A sandbag with its bottom middle at (x, y), STAND-IN; `rope`: the px its rope comes down from (null: none). */
function sack(k: SideKit, x: number, y: number, rope: number | null) {
  const { g } = k
  const px = Math.round(x)
  if (rope !== null) { r(g, DARK, px - 2, rope, 4, y - 14 - rope); r(g, '#c4b0b4', px - 1, rope, 2, y - 14 - rope) }
  const rows: Array<[number, number]> = [[3, 14], [5, 13], [7, 12], [11, 11], [13, 10], [14, 9], [14, 8], [15, 7], [15, 6], [15, 5], [15, 4], [14, 3], [13, 2], [11, 1]]
  for (const [half, up] of rows) r(g, DARK, px - half - 1, y - up, half * 2 + 2, 1)
  for (const [half, up] of rows) r(g, up > 11 ? '#c4b0b4' : up > 5 ? '#a08c92' : '#7a666e', px - half, y - up, half * 2, 1)
  r(g, DARK, px - 6, y - 12, 12, 1)
  r(g, '#dcd6ee', px - 9, y - 8, 4, 1)
}

/** The fly loft's bags: the rope from above, the bag where its clock has it, and its column while it tells and falls. */
function bags(k: SideKit, s: GameState, info: MapInfo) {
  const { cx, cy, time, reduced } = k
  const m = s.map
  for (const b of bagsOf(info)) {
    if (b.cell !== s.zoneIndex) continue
    const boxes = column(m, b.x, b.x + BAG.w, b.y)
    if (!boxes.length) continue
    const at = bagAt(b, m.bagT ?? 0)
    if (at.mode === 'tell' || at.mode === 'fall') danger(k, boxes, at.mode === 'tell' ? at.k : 1)
    const hung = b.y * T + 14
    const down = Math.min(...boxes.map(o => o.y1)) * T
    const p = at.mode === 'fall' ? at.k * at.k : at.mode === 'rest' ? 1 : at.mode === 'haul' ? 1 - at.k : 0
    const shake = at.mode === 'tell' && !reduced ? (Math.floor(time * 22) % 2 ? 1 : -1) : 0
    // The rope comes down from whatever is over it: a wall, or the catwalk above.
    let top = b.y
    while (top > 0 && !roofed(m, b.x + 1, top - 1)) top--
    // (A catwalk is a thin thing at the top of its tile: the rope starts under its planks.)
    const under = top > 0 && m.tiles[(top - 1) * m.w + b.x + 1] === PLATFORM ? T - 5 : 0
    sack(k, (b.x + BAG.w / 2) * T - cx + shake, Math.round(hung + (down - hung) * p) - cy, top * T - under - cy)
  }
}
const roofed = (m: MapState, tx: number, ty: number) => m.tiles[ty * m.w + tx] === '#' || m.tiles[ty * m.w + tx] === PLATFORM

/** The understudy's strike, stencilled: level, from where it stands to where the charge will end. */
function lanes(k: SideKit, s: GameState) {
  const h = s.hero
  for (const e of s.map.enemies) {
    if (!e.tough || e.dead || e.kind !== 'sentry' || e.cell !== s.zoneIndex || (e.ai.mode !== 'tell' && e.ai.mode !== 'charge')) continue
    // (Telling, the line follows the hero until it is fixed at the tell's end.)
    const way = Math.sign(h.x - e.x) || 1
    const end = e.ai.mode === 'tell' ? h.x + way * TOUGH.past : e.x + (e.ai.vx as number) * Math.max(0, e.ai.t)
    const reach = e.r + HERO_R - 0.05
    const box = { x0: Math.max(1, Math.min(e.x, end) - reach), x1: Math.min(s.map.w - 1, Math.max(e.x, end) + reach), y0: e.y - reach, y1: e.y + e.r }
    danger(k, [box], e.ai.mode === 'tell' ? 1 - e.ai.tell / TOUGH.tell : 1)
    chevrons(k, box, e.ai.mode === 'tell' ? way : Math.sign(e.ai.vx as number) || 1)
  }
}

/** The gondola's plate: where the glass will be switched on, in cyan, flush with the floor. */
const PLATE = { x0: 6.5, x1: 8.5, floor: 12 }
function plate(k: SideKit) {
  const { g, cx, cy, lights } = k
  const x = PLATE.x0 * T - cx
  const w = (PLATE.x1 - PLATE.x0) * T
  const y = PLATE.floor * T - cy
  r(g, DARK, x - 1, y - 4, w + 2, 6)
  r(g, '#1a6f80', x, y - 3, w, 4)
  r(g, '#2ff3ff', x + 1, y - 3, w - 2, 1)
  for (let i = 5; i < w - 3; i += 7) r(g, '#b4f6ff', x + i, y - 1, 2, 1)
  lights.push({ x: (PLATE.x0 + PLATE.x1) / 2, y: PLATE.floor - 0.1, r: 1.5, color: '#2ff3ff', a: 0.45 })
}

/** What Act Three lays on the stage, in front of the tiles and under everything that moves (`side.ts`). */
export function actStage(k: SideKit, s: GameState) {
  const info = mapInfo(k.world, s.map.id)
  if (!ofAct(info.def)) return
  if (s.map.id === 'actgondola') { plate(k); hallucinatorStage(k, s) }
  if (s.map.id === 'actbard') { bardSet(k, s); bardBlow(k, s) }
  bags(k, s, info)
  lanes(k, s)
}

// ---------------------------------------------------------------------------
// The Hallucinator
// ---------------------------------------------------------------------------

const GOLD = '#ffd23f'
/** From a body's middle (`HALLU.y`) down to the floor its picture stands on, tiles. */
const BODY_FEET = HALLU.floor - HALLU.y
/** A body's picture is this tall, px. */
const BODY_TALL = 48

/** How far the glass shows in the boss's room, 0..1: the hero's own look, or the plate's. */
function bossGlass(s: GameState, lead: Enemy): number {
  return Math.max((lead.ai.glass as number | undefined) ?? 0, s.zoneIndex === lead.cell ? s.lens?.k ?? 0 : 0)
}

/**
 * The frame a body shows. One rule for all three, off one clock, so that a lie looks like the truth; only the real
 * one, really hurt, shows it.
 */
function bodyFrame(bodies: Enemy[], e: Enemy, time: number): string {
  const lead = bodies[0]!
  if (e === lead && ((e.ai.hurt as number | undefined) ?? 0) > 0) return 'hallu_hurt'
  if (lead.ai.mode === 'bow' || lead.ai.mode === 'open') return 'hallu_bow'
  if (lead.ai.mode === 'claim' && bodies.indexOf(e) !== lead.ai.claimed) return 'hallu_point'
  return `hallu_${Math.floor(time / 0.4) % 2}`
}

/**
 * The three bodies (`renderer.ts` `drawEnemy`, which asks for each: all are drawn on the first's turn), west to east
 * by where they stand: drawn in the list's order, the real one would always be the one underneath as they cross.
 * `dx`, `dy`: px from a place on the map to the screen's; `shake`: the first one's shiver in a hitstop.
 */
export function drawHallucinator(k: BodyKit, s: GameState, e: Enemy, dx: number, dy: number, shake: number) {
  const bodies = halluBodies(s.map, e.cell)
  if (e !== bodies[0]) return
  for (const b of bodies.filter(b => !halluPopped(b)).sort((a, c) => a.x - c.x)) body(k, s, bodies, b, Math.round(b.x * T) + dx + (b === e ? shake : 0), dy)
}
type BodyKit = { g: G; lights: SideKit['lights']; time: number; reduced: boolean }

/** One of them at `x`. A false one fades under the glass to the outline of the very frame it is in. */
function body(k: BodyKit, s: GameState, bodies: Enemy[], e: Enemy, x: number, dy: number) {
  const lead = bodies[0]!
  const { g, time, reduced } = k
  const c = sprite(bodyFrame(bodies, e, time), e.dir === 'left')
  // (It floats and bobs; bowing, it stands.)
  const bowing = lead.ai.mode === 'bow' || lead.ai.mode === 'open'
  const bob = reduced || bowing ? 0 : Math.round(1 + Math.sin(time * 3))
  const px = Math.round(x - c.width / 2)
  const py = Math.round((e.y + BODY_FEET) * T) + dy - c.height - bob
  const lie = e !== lead
  const q = lie ? bossGlass(s, lead) : 0
  const hurt = !lie && ((e.ai.hurt as number | undefined) ?? 0) > 0
  if (hurt) {
    const gold = silhouetteOf(c, GOLD)
    for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]] as const) g.drawImage(gold, px + ox, py + oy)
  }
  faded(g, 1 - q, () => g.drawImage(c, px, py))
  // (It blinks gold as the hurt starts, where other foes blink white: gold says it was the real one.)
  if (hurt && e.flash > 0.08) faded(g, 0.8, () => g.drawImage(silhouetteOf(c, GOLD), px, py))
  faded(g, q, () => g.drawImage(outlineOf(c), px, py))
  k.lights.push(hurt ? { x: e.x, y: e.y, r: 3, color: GOLD, a: 0.85 } : { x: e.x, y: e.y - 0.3, r: 2.2, color: q > 0.5 ? '#2ff3ff' : '#c4fbff', a: 0.55 })
}

/** The claim's arrow: a white `v`, 1.2 tiles wide, its point at (x, y). */
function arrow(g: G, x: number, y: number) {
  const half = Math.round(T * 0.6)
  const shape = (c: string, grow: number) => {
    for (let row = 0; row <= half; row++) {
      const out = half - row
      const thick = Math.min(5, out + 1)
      r(g, c, x - out - grow, y - half + row - grow, thick + grow * 2, 1 + grow * 2)
      r(g, c, x + out - thick + 1 - grow, y - half + row - grow, thick + grow * 2, 1 + grow * 2)
    }
  }
  shape(DARK, 1)
  shape('#ffffff', 0)
}

/** Over the bodies, unlit (`renderer.ts` `foeBars`): the white bar that lies, the glass's true one, the claim. */
export function hallucinatorMarks(g: G, s: GameState, place: (x: number, y: number) => { x: number; y: number }, time: number, reduced: boolean) {
  const bodies = halluBodies(s.map, s.zoneIndex)
  const lead = bodies[0]
  if (!lead || lead.dead) return
  const q = bossGlass(s, lead)
  for (const e of bodies) {
    if (halluPopped(e)) continue
    const at = place(e.x, e.y + BODY_FEET)
    const x = Math.round(at.x) - 17
    const y = Math.round(at.y) - BODY_TALL - 7
    r(g, DARK, x, y, 34, 5)
    r(g, '#3a3450', x + 1, y + 1, 32, 3)
    r(g, '#ffffff', x + 1, y + 1, Math.max(1, Math.round(32 * halluShown(lead))), 3)
    if (e === lead) faded(g, q, () => {
      r(g, DARK, x, y + 5, 34, 4)
      r(g, '#1a4a58', x + 1, y + 6, 32, 2)
      r(g, '#2ff3ff', x + 1, y + 6, Math.max(1, Math.round((32 * Math.max(0, lead.hp)) / lead.maxHp)), 2)
    })
    if (lead.ai.mode === 'claim' && bodies.indexOf(e) === lead.ai.claimed) {
      arrow(g, Math.round(at.x), y - 4 - Math.round(reduced ? 3 : (0.5 + 0.5 * Math.sin(time * 7)) * T * 0.4))
    }
  }
}

/** A crate with its bottom middle at (x, y), solid as `a` and an outline as `q`. */
function crate(g: G, x: number, y: number, a: number, q: number) {
  const c = sprite('hallu_chest')
  const px = Math.round(x - c.width / 2)
  const py = Math.round(y - c.height)
  faded(g, a * (1 - q), () => g.drawImage(c, px, py))
  faded(g, a * q, () => g.drawImage(outlineOf(c), px, py))
}

/** A faint cyan light on a painted crate's outline, as on the glass's other outlines (`glint`). */
const crateGlint = (k: SideKit, x: number, y: number, a: number) => { if (a > 0.004) k.lights.push({ x, y, r: 1.2, color: '#2ff3ff', a: 0.55 * a }) }

/** When a body was first seen fallen, by the painter's clock. */
const fallen = new WeakMap<Enemy, number>()

/** Under the bodies: the plate's ring and cone, the stencils and crates, the rail, and the bodies that go. */
function hallucinatorStage(k: SideKit, s: GameState) {
  const { g, cx, cy, time, reduced, lights } = k
  const bodies = halluBodies(s.map, s.zoneIndex)
  const lead = bodies[0]
  if (!lead) return
  const floor = HALLU.floor * T - cy
  const mid = ((HALLU.plate[0] + HALLU.plate[1]) / 2) * T - cx
  // Those that are gone: the pale ghost of each, and its puff.
  for (const e of bodies) {
    let age = -1
    let at = e.x
    if (e.dead) {
      if (!fallen.has(e)) fallen.set(e, time)
      if (!halluPopped(e)) age = time - fallen.get(e)!
    } else if (halluPopped(e)) { age = e.ai.pop as number; at = e.ai.gx as number }
    if (age < 0 || age >= HALLU.pop) continue
    const f = age / HALLU.pop
    const ghost = sprite('hallu_ghost')
    faded(g, 1 - f, () => g.drawImage(ghost, Math.round(at * T - ghost.width / 2) - cx, floor - ghost.height - Math.round(f * 4)))
    puff(g, Math.round(at * T) - cx, floor - 22, f, Math.round(at * 7), 2)
  }
  if (lead.dead) return
  const q = bossGlass(s, lead)
  // The spotlight: a ring on the plate while it is ready, a cone from the ceiling while it holds the glass up.
  if (!lead.ai.plate) {
    const wide = 20 + (reduced ? 0 : Math.round(Math.sin(time * 4) * 2))
    for (let i = 0; i < 28; i++) {
      const way = (i / 28) * Math.PI * 2
      r(g, '#b4f6ff', Math.round(mid + Math.cos(way) * wide - 1), Math.round(floor - 2 + Math.sin(way) * 5), 2, 1)
    }
    lights.push({ x: (HALLU.plate[0] + HALLU.plate[1]) / 2, y: HALLU.floor - 0.3, r: 1.6, color: '#2ff3ff', a: 0.5 })
  }
  const spot = (lead.ai.glass as number | undefined) ?? 0
  if (spot > 0) {
    const top = T
    for (let y = top; y < floor - 2; y += 2) {
      const half = Math.round(5 + ((y - top) / (floor - top)) * (T - 5))
      faded(g, 0.13 * spot, () => r(g, '#2ff3ff', mid - half, y, half * 2, 2))
      faded(g, 0.5 * spot, () => { r(g, '#b4f6ff', mid - half, y, 1, 2); r(g, '#b4f6ff', mid + half - 1, y, 1, 2) })
    }
    for (let y = 3; y < HALLU.floor; y += 3) lights.push({ x: (HALLU.plate[0] + HALLU.plate[1]) / 2, y, r: 1.8, color: '#2ff3ff', a: 0.4 * spot })
  }
  // The stencils, then what comes down on and beside them.
  const wt = (lead.ai.wt as number | undefined) ?? 0
  const boxes = lead.ai.mode === 'blows' ? halluBoxes(lead) : []
  danger(k, boxes, wt / HALLU.tell)
  // (A body stands taller and wider than a stencil: along the floor's edge, under everybody's feet, none is ever hidden.)
  for (const b of boxes) {
    const x = Math.round(b.x0 * T) - cx
    const w = Math.round(b.x1 * T) - cx - x
    r(g, DARK, x - 1, floor + 1, w + 2, 6)
    r(g, PINK, x, floor + 2, w, 4)
  }
  const lain = halluLain(lead)
  if (lain) {
    const a = lain.t <= HALLU.lie ? 1 : 1 - (lain.t - HALLU.lie) / HALLU.fade
    for (const x of lain.real) crate(g, x * T - cx, floor, a, 0)
    for (const x of lain.painted) { crate(g, x * T - cx, floor, a, q); crateGlint(k, x, HALLU.floor - 0.7, a * q) }
  }
  if (lead.ai.mode === 'blows' && wt >= HALLU.tell && wt < HALLU.tell + HALLU.fall) {
    const p = (wt - HALLU.tell) / HALLU.fall
    const y = 2 * T + 8 - cy + (floor - (2 * T + 8 - cy)) * p * p
    for (const x of halluAims(lead)) crate(g, x * T - cx, y, 1, 0)
    for (const x of halluPaint(lead)) { crate(g, x * T - cx, y, 1, q); crateGlint(k, x, (y + cy) / T - 0.7, q) }
  }
  // The gold rail: along the whole ceiling, over nobody in particular. It says when.
  if (halluOpen(lead)) {
    const x = HALLU.walls[0] * T - cx
    const w = (HALLU.walls[1] - HALLU.walls[0]) * T
    const y = T - cy
    const tall = Math.round(T * 0.4)
    r(g, DARK, x, y - 1, w, tall + 2)
    r(g, GOLD, x, y, w, tall)
    r(g, '#fff4ff', x, y + 1, w, 1)
    faded(g, 0.35, () => r(g, GOLD, x, y + tall + 1, w, 3))
    for (let i = HALLU.walls[0] + 1; i < HALLU.walls[1]; i += 2) lights.push({ x: i, y: 1.3, r: 2.2, color: GOLD, a: 0.75 })
  }
}

