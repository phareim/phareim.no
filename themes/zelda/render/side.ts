/**
 * The side view's painter (`MapDef.kind` 'side'), used by the classic (8-bit) engine in place of the top-down
 * world: a flat backdrop in two layers (the far one still with the room, the near one sliding at half the camera's
 * speed), the room's tiles as blocks seen from the side in the colours of the map's `look`, and everyone standing
 * on them. The foes, the blade, the lights, the effects and the HUD are the classic renderer's own: it hands them
 * over as a `SideKit` and lays its light, glows and HUD on the picture as ever. Read-only on the game state.
 *
 * The hero has no art of his own here: his side frames, mirrored for left, and for what a top-down game has no
 * frame of: rising, the run's airborne frame (`hero_side_run_2`); falling, the arm-up carry stance
 * (`hero_side_carry_0`); on a ladder the push and the carry frames hand over hand; off the bottom of a room the
 * hurt frame, shrinking.
 */
import type { Enemy, GameState, MapDef, MapState, Rect, TileChar, World } from '../types'
import { HERO_R, ROLL_TIME, SPIN_TIME, TILE, WINDUP } from '../types'
import { ladderTop } from '../engine/side'
import { has, mapInfo } from '../engine/map'
import { swingDur } from '../engine/hero'
import { LADDER, PLATFORM, SPRING, TILE_INFO } from '../world/tiles'
import { chestStar, hash2, type Light } from './tiles'
import { CLASSIC, realmLook } from './looks'
import { itemSpriteName } from './itemIcon'
import { eraBackdrop, eraInk } from './eras'
import { diveStreak, lateshowOver, lateshowUnder } from './lateshowPaint'
import { actBackdrop, actInk, actStage, glassHides, glassRing, glassThingsPaint, veiledTiles } from './actthreePaint'
import { CHASE } from '../engine/chase'
import { frameCount, hasSprite, makeCanvas, paintRows, sprite } from './sheet'

type G = CanvasRenderingContext2D
const T = TILE

/**
 * The whole-number scale for a side map on a screen of W × H device px: the largest at which a room's width fits, and
 * on a wide screen 12 rows of its height too. (An upright phone shows 16 tiles across and many up.) A screen that
 * scrolls by itself is as wide as itself, whatever its room's width.
 */
export function sideScale(W: number, H: number, def: Pick<MapDef, 'cell' | 'rows' | 'autoscroll'>): number {
  const across = (def.autoscroll ? CHASE.screen : def.cell?.w ?? def.rows[0]!.length) * T
  const up = (def.cell?.h ?? def.rows.length) * T
  return Math.max(1, Math.min(Math.floor(W / across), Math.floor(H / up)))
}

/** What the painter takes from the classic renderer. */
export interface SideKit {
  g: G
  world: World
  /** The camera and the scene's size, px. */
  cx: number
  cy: number
  vw: number
  vh: number
  time: number
  reduced: boolean
  lights: Light[]
  put(name: string, x: number, y: number, flip?: boolean, flash?: boolean, sx?: number, sy?: number): void
  /** The blade in the hand at (x, y): by the swing or the charge. */
  blade(x: number, y: number): void
  spin(x: number, y: number): void
  /** A foe standing or flying, or the pop of one just fallen. */
  foe(e: Enemy): void
}

/** A look's colours from the side: the sky behind, the near silhouettes, a block's face, shade, top and lit edge. */
export interface Ink { sky: string; sky2: string; far: string; face: string; shade: string; mortar: string; top: string; lip: string; wood: string; woodL: string; coil?: string }
const SHRINE: Ink = { sky: '#0d0920', sky2: '#150f30', far: '#1f1746', face: '#3a2f70', shade: '#271f50', mortar: '#2f2660', top: '#6a58b4', lip: '#3ff0ff', wood: '#8a4a8e', woodL: '#ff8ae0' }
const LAB: Ink = { ...SHRINE, sky: '#071018', sky2: '#0c1a26', far: '#132a38', face: '#33465e', shade: '#212e42', mortar: '#2a3a50', top: '#6c8aa6', lip: '#b6ff4a', wood: '#4a6a7a', woodL: '#9fd8e8' }
/** The colours a side map wears: Act Three's stage, a film's year, else its look's. */
const inkOf = (def: MapDef): Ink => actInk(def) ?? eraInk(def) ?? inks(def.look)
function inks(look: string | undefined): Ink {
  const realm = realmLook(look)
  if (!realm) return look === 'lab' ? LAB : SHRINE
  const c = CLASSIC[realm]
  return { sky: c.rockDD!, sky2: c.rockD!, far: c.canopyD!, face: c.rock!, shade: c.rockD!, mortar: c.rockD!, top: c.rockL!, lip: c.foam!, wood: c.path!, woodL: c.pebble! }
}

const r = (g: G, c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h) }

/** The tiles drawn as a wall's block. */
const BLOCKS: ReadonlySet<TileChar> = new Set<TileChar>(['#', '^', '%', 'Z', 'H', '[', 'q', 'R', 'T', 'I', 'b', 'B', SPRING])

/** The lines of a split block, as corner points (px within the tile): the split through it, and two short ones off it. */
const SPLITS: ReadonlyArray<{ w: number; at: ReadonlyArray<readonly [number, number]> }> = [
  { w: 2, at: [[7, 0], [5, 4], [9, 8], [6, 12], [8, 15]] },
  { w: 1, at: [[9, 8], [13, 10]] },
  { w: 1, at: [[5, 4], [2, 5]] },
]

/**
 * A block that will give way: a slab of its own (dark joints at its sides), split from top to bottom by a jagged
 * line, with a break in the floor's lip over it. Every other one is its neighbour's mirror.
 */
function cracks(g: G, ink: Ink, px: number, py: number, mirror: boolean) {
  const dark = '#05030c'
  r(g, dark, px, py, 1, T)
  r(g, dark, px + T - 1, py, 1, T)
  for (const line of SPLITS) {
    for (let k = 1; k < line.at.length; k++) {
      const [x0, y0] = line.at[k - 1]!
      const [x1, y1] = line.at[k]!
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n)
        r(g, dark, px + (mirror ? T - x - line.w : x), py + Math.round(y0 + ((y1 - y0) * i) / n), line.w, 1)
      }
    }
  }
  // Light on the broken edge of the lip.
  r(g, ink.shade, px + (mirror ? 5 : 9), py + 1, 2, 3)
}

/** A platform's tile (landed on from above); `first` / `last`: an end of its run, with a bracket under it. */
export function platform(g: G, ink: Ink, px: number, py: number, first: boolean, last: boolean) {
  r(g, ink.lip, px, py, T, 1)
  r(g, ink.woodL, px, py + 1, T, 1)
  r(g, ink.wood, px, py + 2, T, 3)
  r(g, '#0b0616', px, py + 5, T, 1)
  r(g, '#0b0616', px + (((px / T) & 1) ? 5 : 11), py + 2, 1, 3)
  if (first) { r(g, ink.wood, px + 1, py + 6, 2, 3); r(g, ink.wood, px + 3, py + 6, 2, 1) }
  if (last) { r(g, ink.wood, px + 13, py + 6, 2, 3); r(g, ink.wood, px + 11, py + 6, 2, 1) }
}

/** A door or a stair in a side wall: a frame standing 2 px over its tile, and the dark within. */
export function doorway(g: G, ink: Ink, px: number, py: number) {
  r(g, ink.top, px + 1, py - 2, 14, T + 2)
  r(g, '#05030c', px + 3, py, 10, T)
}

/** A chest standing on its tile's floor, with its glint and its light (`a`: how much of the light, the glass's fade). */
export function chest(k: SideKit, px: number, py: number, tx: number, ty: number, big: boolean, open: boolean, a = 1) {
  const c = chest.picture(big, open)
  k.g.drawImage(c, Math.round(px + 8 - c.width / 2), py + T - c.height)
  if (open) return
  k.lights.push({ x: tx + 0.5, y: ty + 0.5, r: 1.8, color: '#ffd23f', a: 0.5 * a })
  if (!k.reduced) chestStar(k.g, px + 8, py + T - c.height + 2, k.time, tx * 31 + ty)
}
chest.picture = (big: boolean, open: boolean) => sprite(big ? (open ? 'bigchest_open' : 'bigchest') : open ? 'chest_open' : 'chest')

/**
 * A spring pad flush with the floor: a wide plate to stand on, a coil under it seen from the side (each turn a bar
 * that slants down to the next), a foot, all in a dark well; `down` px pressed flat.
 */
function spring(g: G, ink: Ink, px: number, py: number, down: number) {
  const coil = ink.coil ?? ink.woodL
  r(g, '#05030c', px + 1, py, T - 2, 15)
  // The foot, and the turns between it and the plate.
  r(g, coil, px + 3, py + 13, 10, 2)
  const top = 3 + down
  const turns = 3
  const gap = (13 - top) / turns
  for (let k = 0; k < turns; k++) {
    const y = top + Math.round(k * gap)
    const h = Math.max(1, Math.round(gap))
    for (let i = 0; i < 10; i++) r(g, coil, px + 3 + i, py + y + Math.floor((i * h) / 10), 1, down ? 1 : 2)
  }
  r(g, ink.lip, px, py + down, T, 2)
  r(g, coil, px + 1, py + down + 2, T - 2, 1)
}

// ---------------------------------------------------------------------------
// The still layer
// ---------------------------------------------------------------------------

function paintTile(g: G, ink: Ink, m: MapState, tx: number, ty: number, veiled: ReadonlySet<number>) {
  // (A hidden ledge is air to this layer: only the glass draws it.)
  const at = (x: number, y: number): TileChar => (x < 0 || y < 0 || x >= m.w || y >= m.h ? '#' : veiled.has(y * m.w + x) ? '.' : m.tiles[y * m.w + x]!)
  const t = at(tx, ty)
  const px = tx * T
  const py = ty * T
  if (BLOCKS.has(t)) {
    const open = (x: number, y: number) => !BLOCKS.has(at(x, y))
    r(g, ink.face, px, py, T, T)
    // Courses of stone, every other one shifted.
    for (let k = 0; k < 2; k++) {
      r(g, ink.mortar, px, py + 7 + k * 8, T, 1)
      r(g, ink.mortar, px + ((tx + ty * 2 + k) % 2 ? 4 : 12), py + k * 8, 1, 7)
    }
    if (hash2(tx, ty, 41) > 0.7) r(g, ink.top, px + 3 + Math.floor(hash2(tx, ty, 42) * 9), py + 3 + Math.floor(hash2(tx, ty, 43) * 9), 2, 1)
    if (open(tx - 1, ty)) r(g, ink.shade, px, py, 2, T)
    if (open(tx + 1, ty)) r(g, ink.shade, px + T - 2, py, 2, T)
    if (open(tx, ty + 1)) r(g, ink.shade, px, py + T - 3, T, 3)
    // The lit top edge: where one stands.
    if (open(tx, ty - 1)) {
      r(g, ink.top, px, py, T, 4)
      r(g, ink.lip, px, py, T, 1)
      r(g, ink.shade, px, py + 4, T, 1)
    }
    if (t === '%' || t === 'R') cracks(g, ink, px, py, tx % 2 === 1)
    if (t === SPRING) spring(g, ink, px, py, 0)
    return
  }
  if (t === PLATFORM) { platform(g, ink, px, py, at(tx - 1, ty) !== PLATFORM, at(tx + 1, ty) !== PLATFORM); return }
  if (t === LADDER) {
    for (const x of [3, 11]) { r(g, '#0b0616', px + x - 1, py, 4, T); r(g, ink.wood, px + x, py, 2, T) }
    for (let y = 2; y < T; y += 5) { r(g, ink.woodL, px + 5, py + y, 6, 2); r(g, '#0b0616', px + 5, py + y + 2, 6, 1) }
    // Its top is a platform: a lit bar across, the rails standing a little over it.
    if (ladderTop(at, (x, y) => TILE_INFO[at(x, y)].solid, tx, ty)) {
      r(g, ink.lip, px, py, T, 1)
      r(g, ink.woodL, px, py + 1, T, 1)
      for (const x of [3, 11]) { r(g, '#0b0616', px + x - 1, py - 4, 4, 4); r(g, ink.woodL, px + x, py - 3, 2, 3) }
    }
    return
  }
  if (t === 'L' || t === 'K') {
    const big = t === 'K'
    r(g, '#0b0616', px + 2, py, 12, T)
    r(g, big ? '#8c2e72' : '#6a4a2e', px + 3, py, 10, T)
    r(g, big ? '#ff5fd0' : '#c89a5a', px + 4, py, 1, T)
    for (const y of [1, 13]) r(g, '#9690c4', px + 3, py + y, 10, 2)
    // The lock on the run's lowest tile, at a hand's height.
    if (at(tx, ty + 1) !== t) { r(g, '#ffd23f', px + 5, py + 4, 6, 6); r(g, '#0b0616', px + 7, py + 5, 2, 2); r(g, '#0b0616', px + 7, py + 7, 2, 2) }
    return
  }
  if (t === 'X') {
    for (const x of [2, 7, 12]) { r(g, '#0b0616', px + x - 1, py, 4, T); r(g, '#9690c4', px + x, py, 2, T) }
    r(g, '#6f6aa0', px, py + 3, T, 2)
    return
  }
  if (t === 'x') {
    for (let k = 0; k < 4; k++) { r(g, '#9690c4', px + k * 4 + 1, py + 11, 2, 5); r(g, '#ffffff', px + k * 4 + 1, py + 10, 1, 1) }
    return
  }
  if (t === 'D' || t === '>') { doorway(g, ink, px, py); return }
  if (t === 'S') {
    r(g, ink.wood, px + 7, py + 8, 2, 8)
    r(g, '#0b0616', px + 2, py + 2, 12, 8)
    r(g, ink.woodL, px + 3, py + 3, 10, 6)
    r(g, '#0b0616', px + 5, py + 5, 6, 1)
    r(g, '#0b0616', px + 5, py + 7, 4, 1)
    return
  }
  if (t === 't') { r(g, ink.wood, px + 7, py + 7, 2, 6); r(g, ink.woodL, px + 5, py + 7, 6, 2); return }
  if (t === 'o' || t === 'r') { const c = sprite(t === 'o' ? 'pot' : 'rock'); g.drawImage(c, px, py + T - c.height); return }
  // Anything else that blocks the way: a plain block, so that no wall is ever invisible. (A chest is drawn live.)
  if (t !== '$' && TILE_INFO[t].solid) { r(g, ink.shade, px, py, T, T); r(g, ink.top, px, py, T, 2) }
}

const layers = new WeakMap<MapState, { version: number; canvas: HTMLCanvasElement }>()
function layerOf(world: World, m: MapState): HTMLCanvasElement {
  let l = layers.get(m)
  if (l && l.version === m.version) return l.canvas
  const canvas = l?.canvas ?? makeCanvas(m.w * T, m.h * T)
  const g = canvas.getContext('2d')!
  g.clearRect(0, 0, canvas.width, canvas.height)
  const info = mapInfo(world, m.id)
  const ink = inkOf(info.def)
  const veiled = veiledTiles(info)
  // Bottom rows first, so a ladder's rails over its top lie on what is above.
  for (let ty = m.h - 1; ty >= 0; ty--) for (let tx = 0; tx < m.w; tx++) paintTile(g, ink, m, tx, ty, veiled)
  layers.set(m, { version: m.version, canvas })
  return canvas
}

// ---------------------------------------------------------------------------
// The backdrop
// ---------------------------------------------------------------------------

/**
 * Behind a room: bands of the far sky that stay with the room, and a near row of towers that slides at half the
 * camera's speed, down and across.
 */
function backdrop(k: SideKit, ink: Ink, z: Rect) {
  const { g, cx, cy, vw, vh } = k
  const x = z.x * T - cx
  const y = z.y * T - cy
  const w = z.w * T
  const h = z.h * T
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  r(g, ink.sky, x, y, w, h)
  for (let i = 0; i < 4; i++) r(g, ink.sky2, x, y + h - (4 - i) * 22, w, 22 - i * 5)
  for (let i = 0; i < (w * h) / 1600; i++) r(g, i % 3 ? ink.mortar : ink.top, x + Math.floor(hash2(i, z.y, 51) * w), y + Math.floor(hash2(i, z.y, 52) * h), 1, 1)
  // Half the way the camera has moved from where it would look at the room's middle.
  const dx = Math.round((cx - (z.x * T + (w - vw) / 2)) / 2)
  const dy = Math.round((cy - (z.y * T + (h - vh) / 2)) / 2)
  for (let floor = h + 40; floor > -80; floor -= 150) {
    for (let i = -2; i < w / 36 + 2; i++) {
      const wide = 18 + Math.floor(hash2(i, floor, 53) * 16)
      const tall = 28 + Math.floor(hash2(i, floor, 54) * 76)
      const bx = x + dx + i * 36
      const by = y + dy + floor - tall
      r(g, ink.far, bx, by, wide, tall)
      r(g, ink.sky2, bx, by, wide, 1)
      for (let wy = by + 5; wy < by + tall - 4; wy += 9) if (hash2(i, wy - by, 55) > 0.62) r(g, ink.mortar, bx + 4 + Math.floor(hash2(i, wy - by, 56) * (wide - 9)), wy, 2, 3)
    }
  }
  g.restore()
}

// ---------------------------------------------------------------------------
// The picture
// ---------------------------------------------------------------------------

export function paintSide(k: SideKit, s: GameState) {
  const { g, world, cx, cy, vw, vh, time, reduced, lights } = k
  const m = s.map
  const info = mapInfo(world, m.id)
  const ink = inkOf(info.def)
  const sky = actBackdrop(info.def) ?? eraBackdrop(info.def)
  r(g, '#05030c', 0, 0, vw, vh)
  // A screen that scrolls by itself shows its own width and nothing past it, however wide the window.
  if (m.chase) {
    g.save()
    g.beginPath()
    g.rect(Math.round(m.chase.left * T) - cx, -cy, CHASE.screen * T, m.h * T)
    g.clip()
  }
  for (const z of s.scroll ? [s.scroll.from, s.scroll.to] : [s.zone]) { if (sky) sky(k, z, m.id); else backdrop(k, ink, z) }
  g.drawImage(layerOf(world, m), -cx, -cy)
  // What lies on the stage and under everything that moves (`lateshowPaint.ts`).
  lateshowUnder(k, s)
  // A pad just struck, pressed flat for a moment (the still layer has it at rest).
  const flat = s.hero.side?.squash
  if (flat) spring(g, ink, (flat.i % m.w) * T - cx, Math.floor(flat.i / m.w) * T - cy, 5)
  // THE LENS: what is painted and what is hidden (`actthreePaint.ts`).
  glassThingsPaint(k, s, ink)

  const x0 = Math.max(0, Math.floor(cx / T))
  const x1 = Math.min(m.w - 1, Math.floor((cx + vw) / T))
  const y0 = Math.max(0, Math.floor(cy / T))
  const y1 = Math.min(m.h - 1, Math.floor((cy + vh) / T))
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = m.tiles[ty * m.w + tx]!
      const px = tx * T - cx
      const py = ty * T - cy
      if (t === 't') {
        const flick = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 9 + tx * 3.1 + ty)
        const tall = Math.round(flick * 3)
        r(g, '#ff3b5c', px + 6, py + 4 - tall, 4, 3 + tall)
        r(g, '#ffd23f', px + 7, py + 5 - tall, 2, 2 + tall)
        lights.push({ x: tx + 0.5, y: ty + 0.4, r: 4, color: '#ff8a3d', a: 0.85 * flick, fire: true })
      } else if (t === '$') {
        if (glassHides(s, info, ty * m.w + tx)) continue
        const ch = info.chests.get(ty * m.w + tx)
        chest(k, px, py, tx, ty, !!ch?.big, ch ? has(s, `chest:${ch.id}`) : true)
      } else if ((t === 'L' || t === 'K') && m.tiles[(ty + 1) * m.w + tx] !== t) lights.push({ x: tx + 0.5, y: ty + 0.5, r: 1.4, color: '#ffd23f', a: 0.5 })
    }
  }

  // Act Three's set, bags and stencils: over the tiles, under everything that moves.
  actStage(k, s)

  for (const d of m.drops) {
    if (d.life - d.t < 2 && Math.floor(time * 12) % 2 === 0) continue
    const name = d.kind === 'heart' ? 'drop_heart' : d.kind === 'bit' ? 'bit_1' : d.kind === 'bit5' ? 'bit_5' : d.kind === 'bomb' ? 'drop_bomb' : 'drop_key'
    k.put(name, d.x * T - cx, Math.round((d.y + 0.25) * T) - cy - Math.round(d.z * T))
    if (d.kind === 'key') lights.push({ x: d.x, y: d.y, r: 0.9, color: '#ffd23f', a: 0.5 })
  }
  for (const p of m.pickups) {
    if (p.hidden) continue
    const bob = reduced ? 0 : Math.round(Math.sin(time * 3 + p.x) * 1.5)
    k.put(itemSpriteName(p.item), p.x * T - cx, p.y * T - cy + 6 + bob)
    lights.push({ x: p.x, y: p.y, r: 1.8, color: '#ffd23f', a: 0.8 })
  }
  for (const n of m.npcs) {
    const name = hasSprite(`${n.look}_side_0`) ? `${n.look}_side_0` : `${n.look}_${Math.floor(time * 2 + n.home.x) % frameCount(n.look, 2)}`
    k.put(name, n.x * T - cx, (Math.floor(n.y) + 1) * T - cy, n.dir === 'left')
  }
  for (const e of m.enemies) {
    if (e.cell !== s.zoneIndex && !(s.scroll && e.cell === s.scroll.index)) continue
    k.foe(e)
  }
  if (s.hero.x > -10) { glassRing(k, s); hero(k, s) }
  lateshowOver(k, s)
  if (m.chase) {
    g.restore()
    // And no light from past its edges.
    for (let i = lights.length - 1; i >= 0; i--) if (lights[i]!.x < m.chase.left - 0.5 || lights[i]!.x > m.chase.left + CHASE.screen + 0.5) lights.splice(i, 1)
  }
}

function hero(k: SideKit, s: GameState) {
  const { cx, cy, time, reduced, lights } = k
  const h = s.hero
  const sd = h.side
  const x = Math.round(h.x * T) - cx
  const feet = Math.round((h.y + HERO_R) * T) - cy
  const face = sd?.face ?? (h.dir === 'left' ? 'left' : 'right')
  let flip = h.dir === 'left' || (h.dir !== 'right' && face === 'left')
  if (h.act === 'dead') {
    const d = s.dying?.t ?? 0
    k.put(d < 0.8 ? 'hero_side_stagger' : 'hero_dead', x, feet, flip)
    return
  }
  if (h.act === 'fall') {
    const q = Math.min(1, h.actT / 0.55)
    k.put('hero_side_hurt', x, feet + Math.round(q * 8), flip, false, 1 - 0.6 * q, 1 - 0.6 * q)
    return
  }
  // (The stomp's moment of mercy is no hurt: the hero does not blink for it.)
  if (h.invuln > (sd?.mercy ?? 0) && h.act !== 'get' && Math.floor(time * 20) % 2 === 0) return
  const sw = h.swing
  const charging = h.charge > 0.12 && s.inv.sword && !h.carry
  let name = 'hero_side_0'
  if (h.spin) {
    flip = Math.floor((h.spin.t / SPIN_TIME) * 4) % 2 === (face === 'left' ? 0 : 1)
    k.put('hero_side_atk', x, feet, flip)
    k.spin(x, feet - 7)
    return
  }
  if (h.act === 'roll' && h.roll) name = `hero_side_roll_${Math.floor(Math.min(0.999, h.roll.t / ROLL_TIME) * 4)}`
  else if (h.act === 'get') name = 'hero_get'
  else if (h.act === 'hurt') name = 'hero_side_hurt'
  else if (sw) {
    const p = sw.t / swingDur(sw)
    name = p < WINDUP ? 'hero_side_atk_wind' : sw.n === 1 ? 'hero_side_atk_back' : sw.n === 2 ? (p < 0.7 ? 'hero_side_atk_lunge' : 'hero_side_atk_land') : 'hero_side_atk'
  } else if (sd?.dive) name = 'hero_side_carry_0'
  else if (sd?.ladder) name = Math.floor(h.walkT * 6) % 2 ? 'hero_side_carry_0' : 'hero_side_push'
  else if (sd && !sd.ground) name = sd.vy < 0 ? 'hero_side_run_2' : 'hero_side_carry_0'
  else if (charging) name = 'hero_side_charge'
  else if (Math.abs(h.vx) > 0.5) name = Math.abs(h.vx) >= 4.5 ? `hero_side_run_${Math.floor(h.walkT * 12) % 6}` : `hero_side_${[1, 0, 2, 0][Math.floor(h.walkT * 8.5) % 4]}`
  else if (!reduced && Math.floor(time / 0.7) % 2 === 1) name = 'hero_side_idle_1'
  const armed = !!sw || charging
  // The blade behind the body while it is drawn back for a charge, else before it.
  if (armed && !sw) k.blade(x, feet - 7)
  k.put(name, x, feet, flip)
  if (sd?.dive) {
    diveStreak(k.g, x, feet, time, reduced)
    lights.push({ x: h.x, y: h.y + 0.5, r: 2.2, color: '#2ff3ff', a: 0.8 })
  }
  if (sw) k.blade(x, feet - 7)
  if (h.act === 'get' && s.get) {
    const c = sprite(itemSpriteName(s.get.item))
    k.g.drawImage(c, Math.round(x - c.width / 2), Math.round(feet - 18 - c.height))
    lights.push({ x: h.x, y: h.y - 1.4, r: 3.5, color: '#ffd23f', a: 0.9 })
  }
}

// ---------------------------------------------------------------------------
// The jump's picture (the B box, and the touch deck's B pad on a side map)
// ---------------------------------------------------------------------------

const ARROW = [
  '................',
  '.......kk.......',
  '......kCCk......',
  '.....kCCCCk.....',
  '....kCCCCCCk....',
  '...kCCCCCCCCk...',
  '..kCCCCCCCCCCk..',
  '.kCCCCCCCCCCCCk.',
  '.kkkkkCCCCkkkkk.',
  '.....kCCCCk.....',
  '.....kCCCCk.....',
  '.....kCCCCk.....',
  '.....kcccck.....',
  '.....kcccck.....',
  '.....kkkkkk.....',
  '................',
]

let arrow: HTMLCanvasElement | null = null
export function jumpIcon(): HTMLCanvasElement {
  return arrow ??= paintRows(ARROW, { k: '#0b0616', C: '#2ff3ff', c: '#1a9fc4' })
}
