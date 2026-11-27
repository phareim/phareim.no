/**
 * What the Steamhouse paints (`engine/attendants.ts`, `engine/refuse.ts`): each attendant's ring, flat on the floor
 * under everything that stands; the lingering clock over an attendant's head; the robe over the hero; the rack the
 * robe hangs on; the house's own lights; and the gifts, the Sycophant's figure, cards and little hearts
 * (`engine/gifts.ts`, `engine/bossSycophant.ts`). The rings and the clock are the whole of the attendants' rule that
 * can be seen; a gift's lane (`floorMarks.ts`) and its gold are the whole of the fight's.
 *
 * The ring is white, not pink: it is not a blow. A one-pixel ink outline lets it read on any floor. The clock is a
 * white arc that turns pink for its last seconds (pink: this will take you).
 */
import type { Enemy, GameState, GiftKind, Npc, World } from '../types'
import { TILE } from '../types'
import { drawText, textWidth } from '../../base/pixel/font'
import { CARDS, heldGifts, SYCO } from '../engine/bossSycophant'
import { giftGold, GIFTS, laneOf, nextGift, sleeveOf, throwerLanes } from '../engine/gifts'
import { stencilsOf } from '../engine/stencils'
import { sprite } from './sheet'
import { clockOf, HOUSE } from '../engine/attendants'
import { cellDef, cellIndex, mapInfo, type MapInfo } from '../engine/map'
import type { SceneItem } from './renderer'
import type { Light } from './tiles'

type G = CanvasRenderingContext2D
const T = TILE

const INK = '#0b0616'
const WHITE = '#ffffff'
const PINK = '#ff2fa0'
const ROSE = '#ff8ae0'
const GOLD = '#ffd23f'

/** A ring's dashes: this many px painted of every `RING_STEP`. */
const RING_DASH = 5
const RING_STEP = 9

/** The attendants of the hero's room (and of the room scrolling in) whose ring is drawn. */
function ringed(info: MapInfo, s: GameState) {
  const dungeon = info.def.kind === 'dungeon'
  return s.map.npcs.filter(n => n.att && n.att.mode === 'ask' && (!dungeon || !!s.scroll || cellIndex(info, n.x, n.y) === s.zoneIndex))
}

/** A ring's px, from its middle: each with how far along its dash it is (the dashes turn slowly; still under reduced motion). */
function dashes(r: number, time: number, reduced: boolean) {
  const len = Math.round(Math.PI * 2 * r)
  const turn = reduced ? 0 : Math.floor(time * 6)
  const out: Array<{ x: number; y: number; at: number }> = []
  for (let i = 0; i < len; i++) {
    const at = (i + turn) % RING_STEP
    if (at >= RING_DASH) continue
    const a = (i / len) * Math.PI * 2
    out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, at })
  }
  return out
}

/**
 * Every attendant's ring of the hero's room, flat on the floor (classic px for a camera at (cx, cy)): hard white
 * pixels, two wide, in a one-pixel ink edge, never up the walls.
 */
export function drawRings(g: G, world: World, s: GameState, cx: number, cy: number, time: number, reduced: boolean) {
  const info = mapInfo(world, s.map.id)
  for (const n of ringed(info, s)) {
    const a = n.att!
    const x = Math.round(n.x * T - cx)
    const y = Math.round(n.y * T - cy)
    const px = dashes(a.ring * T, time, reduced)
    g.save()
    if (info.def.kind === 'dungeon' && !s.scroll) {
      const z = s.zone
      g.beginPath()
      g.rect((z.x + 1) * T - cx, (z.y + 1) * T - cy, (z.w - 2) * T, (z.h - 2) * T)
      g.clip()
    }
    g.fillStyle = INK
    for (const p of px) g.fillRect(x + Math.round(p.x) - 2, y + Math.round(p.y) - 2, 4, 4)
    g.fillStyle = a.made && !a.linger ? '#b9b4e0' : WHITE
    for (const p of px) g.fillRect(x + Math.round(p.x) - 1, y + Math.round(p.y) - 1, 2, 2)
    g.restore()
  }
}

/**
 * The house's own light, added to the frame's: the dungeon's dim violet would swallow a white line and a white clock,
 * so each dash of a ring and each running clock carries a little of its own; and the boiler is lit by its coal, so
 * the dark hounds in it show against the floor.
 */
export function steamLights(lights: Light[], world: World, s: GameState, time: number, reduced: boolean) {
  if (!HOUSE.has(s.map.id)) return
  const info = mapInfo(world, s.map.id)
  for (const n of ringed(info, s)) {
    const a = n.att!
    const spent = a.made && !a.linger
    for (const p of dashes(a.ring * T, time, reduced)) {
      if (p.at !== 2) continue
      const x = n.x + p.x / T
      const y = n.y + p.y / T
      const z = s.zone
      if (x < z.x + 1 || y < z.y + 1 || x > z.x + z.w - 1 || y > z.y + z.h - 1) continue
      lights.push({ x, y, z: 0.05, r: 0.5, color: '#fff4ff', a: spent ? 0.28 : 0.55 })
    }
    if (clockOf(n)) lights.push({ x: n.x, y: n.y - 1.25, r: 0.9, color: '#fff4ff', a: 0.85 })
  }
  // The lanes keep their pink under the dim ambient: a little of their own light along each.
  const lanes = [...throwerLanes(s), ...s.map.enemies.flatMap(stencilsOf), ...s.map.projectiles.flatMap(p => (p.kind === 'gift' && p.to ? [laneOf(p.x, p.y, p.to, 0)] : []))]
  for (const l of lanes) {
    if (l.t !== 'ray') continue
    const len = Math.hypot(l.x1 - l.x0, l.y1 - l.y0)
    for (let d = 0.6; d < len; d += 1.2) lights.push({ x: l.x0 + ((l.x1 - l.x0) * d) / len, y: l.y0 + ((l.y1 - l.y0) * d) / len, z: 0.05, r: 0.9, color: PINK, a: 0.45 + 0.3 * l.k })
  }
  // A gift glows its own colour: rose, and gold when a cut pressed now will meet it.
  for (const p of s.map.projectiles) if (p.kind === 'gift') lights.push({ x: p.x, y: p.y, z: 0.4, r: giftGold(s, p) ? 1.8 : 1.2, color: giftGold(s, p) ? GOLD : ROSE, a: 0.8 })
  if (s.map.id === 'steamhouse' && cellDef(info, s.zoneIndex)?.name === 'THE BOILER ROOM') {
    const z = s.zone
    const flick = reduced ? 1 : 0.88 + 0.12 * Math.sin(time * 7) * Math.sin(time * 2.3)
    lights.push({ x: z.x + 3, y: z.y + 9.5, r: 4.5, color: '#ff8a3d', a: 0.9 * flick, fire: true })
    lights.push({ x: z.x + 6, y: z.y + 5.5, r: 7, color: '#ffb070', a: 0.4 })
  }
}

/**
 * THE RACK OF HOOKS (A STAND-IN, painted by code over the sign tile it is read from until a prop is drawn): two
 * posts, a rail, and two white robes hanging.
 */
export function queueRack(g: G, world: World, s: GameState, cx: number, cy: number, items: SceneItem[]) {
  if (!HOUSE.has(s.map.id)) return
  const info = mapInfo(world, s.map.id)
  for (const [idx, sign] of info.signs) {
    if (!sign.robe) continue
    const tx = idx % s.map.w
    const ty = Math.floor(idx / s.map.w)
    if (!s.scroll && cellIndex(info, tx + 0.5, ty + 0.5) !== s.zoneIndex) continue
    items.push({ x: tx + 0.5, y: ty + 0.9, foot: 1 / T, draw: () => paintRack(g, tx * T - cx, ty * T - cy) })
  }
}

function paintRack(g: G, x: number, y: number) {
  const r = (c: string, dx: number, dy: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h) }
  // The posts and the rail.
  for (const dx of [-3, 16]) { r(INK, dx - 1, -6, 4, 22); r('#c08a4a', dx, -5, 2, 20) }
  r(INK, -4, -8, 24, 4)
  r('#e0a85c', -3, -7, 22, 2)
  // Two robes on their hooks, a blue belt each.
  for (const dx of [0, 9]) {
    r(INK, dx, -5, 8, 17)
    r('#fff4ff', dx + 3, -5, 2, 2)
    r('#fff4ff', dx + 1, -3, 6, 14)
    r('#cfc6ff', dx + 3, -2, 2, 4)
    r('#9ad7ff', dx + 1, 3, 6, 2)
    r('#cfc6ff', dx + 1, 9, 6, 2)
  }
}

/** The lingering clock over an attendant's head (`x`, `y`: its feet, classic px): an arc filling clockwise. */
export function drawClock(g: G, n: Npc, x: number, y: number, time: number, reduced: boolean) {
  const c = clockOf(n)
  if (!c) return
  const cxp = Math.round(x)
  const cyp = Math.round(y - 26)
  const r = 5
  const start = -Math.PI / 2
  g.save()
  g.lineCap = 'butt'
  g.strokeStyle = INK
  g.lineWidth = 4
  g.beginPath()
  g.arc(cxp, cyp, r, 0, Math.PI * 2)
  g.stroke()
  // (Pink for the last stretch, and under it the pink still flickers a little: this will take you.)
  g.strokeStyle = c.pink ? (reduced || Math.floor(time * 10) % 4 ? PINK : '#ffc2e6') : WHITE
  g.lineWidth = 2
  g.beginPath()
  g.arc(cxp, cyp, r, start, start + Math.PI * 2 * Math.max(0.04, c.k))
  g.stroke()
  g.restore()
}

/**
 * The robe, over the hero's figure as the view draws it: a white towelling robe from the shoulders to the shins with
 * a blue belt, and a towel wound on the head. Painted in rects over any look and any pose, so there are no hero
 * sprites of its own; the same in both views. (`x`: the middle, `feet`: where the feet stand, classic px.)
 */
export function drawRobe(g: G, x: number, feet: number) {
  const hx = Math.round(x)
  const f = Math.round(feet)
  const body = (c: string, dx: number, dy: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(hx + dx, f + dy, w, h) }
  // The ink edge: shoulders, then the skirt of it a px wider.
  body(INK, -4, -9, 8, 1)
  body(INK, -5, -8, 10, 4)
  body(INK, -6, -4, 12, 3)
  body(WHITE, -3, -8, 6, 1)
  body(WHITE, -4, -7, 8, 3)
  body(WHITE, -5, -4, 10, 2)
  // The collar crossed over, the folds, the belt and its knot, the hem.
  body('#cfc6ff', -1, -8, 2, 2)
  body('#cfc6ff', -3, -4, 1, 2)
  body('#cfc6ff', 2, -4, 1, 2)
  body('#5a8cff', -4, -5, 8, 1)
  body('#5a8cff', 1, -4, 1, 2)
  const top = f - 18
  const r = (c: string, dx: number, dy: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(hx + dx, top + dy, w, h) }
  // The towel: a knot off to one side, a round wrap, a blue stripe.
  r(INK, 0, -1, 5, 3)
  r(INK, -4, 0, 8, 6)
  r(INK, -5, 2, 10, 3)
  r(WHITE, 1, 0, 3, 2)
  r(WHITE, -3, 1, 6, 4)
  r(WHITE, -4, 2, 8, 2)
  r('#cfc6ff', -2, 2, 4, 1)
  r('#9ad7ff', -4, 4, 8, 1)
}

// ---------------------------------------------------------------------------
// The Sycophant and the gifts
// ---------------------------------------------------------------------------

/** How high the Sycophant floats over its foot point, classic px: its bob's top, and where its bar is set. */
export const SYCO_HOVER = 7

/** The Sycophant's picture for what it is doing. */
export function sycophantSprite(e: Enemy, time: number): string {
  switch (e.ai.mode) {
    case 'offer': case 'volley': return 'syco_offer'
    case 'slip': return 'syco_slip'
    case 'hurt': return 'syco_hurt'
    default: return Math.floor(time * 2) % 2 ? 'syco_1' : 'syco_0'
  }
}

/** Where the figure's foot is drawn, px over its own foot point: it bobs (still under reduced motion). */
export const sycophantLift = (time: number, reduced: boolean) => SYCO_HOVER - 2 - (reduced ? 0 : Math.round(Math.sin(time * 2) * 2))

/** Its light: a soft white, gold while the smile is slipped. */
export function sycophantLight(e: Enemy): Light {
  const open = e.ai.mode === 'slip'
  return { x: e.x, y: e.y - 0.6, r: open ? 3.4 : 2.8, color: open ? GOLD : '#fff4ff', a: open ? 0.75 : 0.65 }
}

/** The gold round the figure while it is open: its own shape two px out each way (`silhouette` draws it in one colour). */
export function sycophantGold(e: Enemy, time: number, reduced: boolean, silhouette: (dx: number, dy: number, color: string) => void) {
  if (e.ai.mode !== 'slip') return
  const color = !reduced && Math.floor(time * 8) % 2 ? '#fff1b0' : GOLD
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [1, -1], [-1, 1]] as const) silhouette(dx, dy, color)
}

/** A gift in the air or in a sleeve: its shadow on the floor, and over it the picture on a disc ringed rose, or gold. */
function gift(g: G, kind: GiftKind, x: number, floor: number, lift: number, gold: boolean, time: number, reduced: boolean) {
  const px = Math.round(x)
  const py = Math.round(floor - lift)
  g.fillStyle = 'rgba(11,6,22,0.45)'
  g.fillRect(px - 4, Math.round(floor) + 1, 8, 2)
  const disc = (r: number, c: string) => {
    g.fillStyle = c
    for (let dy = -r; dy < r; dy++) {
      const w = Math.round(Math.sqrt(r * r - (dy + 0.5) ** 2))
      g.fillRect(px - w, py + dy, w * 2, 1)
    }
  }
  const beat = gold && !reduced && Math.floor(time * 8) % 2 ? 1 : 0
  disc(10 + beat, INK)
  disc(9 + beat, gold ? GOLD : ROSE)
  disc(7, gold ? '#6a4432' : '#2a1f4a')
  g.drawImage(sprite(`gift_${kind}`), px - 6, py - 6)
  if (gold) {
    // Four glints: now.
    g.fillStyle = '#fff4ff'
    const o = 13 + beat
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) g.fillRect(px + dx * o - 1, py + dy * o - 1, 2, 2)
  }
}

/** The compliment card: a strip of paper with one line in the 5×7 font, held in front of the figure. */
function card(g: G, text: string, x: number, y: number) {
  const w = textWidth(text) + 8
  const left = Math.round(x - w / 2)
  const top = Math.round(y)
  g.fillStyle = INK
  g.fillRect(left - 1, top - 1, w + 2, 15)
  g.fillStyle = WHITE
  g.fillRect(left, top, w, 13)
  g.fillStyle = '#cfc6ff'
  g.fillRect(left, top + 11, w, 2)
  drawText(g, text, left + 4, top + 2, INK)
}

function rose(g: G, x: number, y: number) {
  const px = Math.round(x)
  const py = Math.round(y)
  g.fillStyle = INK
  g.fillRect(px - 4, py - 3, 9, 5)
  g.fillRect(px - 2, py + 2, 5, 2)
  g.fillStyle = ROSE
  g.fillRect(px - 3, py - 2, 3, 3)
  g.fillRect(px + 1, py - 2, 3, 3)
  g.fillRect(px - 2, py, 5, 2)
  g.fillRect(px, py + 2, 1, 1)
}

/**
 * Everything of the house that is drawn over the lit scene, crisp in every view (`place` puts a floor point on the
 * scene): the gifts held up and in flight, the Sycophant's card, and the half heart on its way to the hero.
 */
export function drawGifts(g: G, world: World, s: GameState, place: (x: number, y: number) => { x: number; y: number }, time: number, reduced: boolean) {
  if (!HOUSE.has(s.map.id)) return
  const info = mapInfo(world, s.map.id)
  for (const n of s.map.npcs) {
    const t = n.toss
    if (!t || t.tell <= 0 || cellIndex(info, n.x, n.y) !== s.zoneIndex) continue
    const at = sleeveOf(n)
    const p = place(at.x, at.y)
    // (Raised over its head as the tell runs.)
    gift(g, nextGift(s, n), p.x, p.y, 8 + Math.min(1, (GIFTS.tell - t.tell) / 0.25) * 10, false, time, reduced)
  }
  for (const e of s.map.enemies) {
    if (e.kind !== 'sycophant' || e.dead || e.cell !== s.zoneIndex) continue
    for (const h of heldGifts(e)) {
      const p = place(h.x, h.y)
      gift(g, h.kind, p.x, p.y, 8, giftGold(s, h), time, reduced)
    }
    const foot = place(e.x, e.y + e.r)
    if (e.ai.mode === 'fawn' || e.ai.mode === 'idle') card(g, CARDS[((e.ai.card as number | undefined) ?? 0) % CARDS.length]!, foot.x, foot.y - sycophantLift(time, reduced) - 17)
    const heart = (e.ai.heart as number | undefined) ?? 0
    if (heart > 0) {
      const k = 1 - heart / SYCO.heart
      const to = place(s.hero.x, s.hero.y)
      rose(g, foot.x + (to.x - foot.x) * k, foot.y - 30 + (to.y - 10 - (foot.y - 30)) * k - Math.sin(k * Math.PI) * 10)
    }
  }
  for (const p of s.map.projectiles) {
    if (p.kind !== 'gift') continue
    const at = place(p.x, p.y)
    gift(g, p.gift!, at.x, at.y, 6 + 8 * Math.max(0, 1 - p.t / 0.25), giftGold(s, p), time, reduced)
  }
}
