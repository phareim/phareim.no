/**
 * What the Steamhouse paints (`engine/attendants.ts`, `engine/refuse.ts`): each attendant's ring, flat on the floor
 * under everything that stands; the lingering clock over an attendant's head; the robe over the hero; the rack the
 * robe hangs on, the baths' folding screens and the laundry's sheets; the house's own lights; the gifts, the
 * Sycophant's figure, cards and little hearts (`engine/gifts.ts`, `engine/bossSycophant.ts`); and THE END: the
 * letterbox of its beat, the paper banner and the pile it leaves. The rings and the clock are the whole of the
 * attendants' rule that can be seen; a gift's lane (`floorMarks.ts`) and its gold are the whole of the fight's.
 *
 * The ring is white, not pink: it is not a blow. A one-pixel ink outline lets it read on any floor. The clock is a
 * white arc that turns pink for its last seconds (pink: this will take you).
 */
import type { Enemy, GameState, GiftKind, Npc, TileChar, ViewSide, World } from '../types'
import { TILE } from '../types'
import { drawText, textWidth } from '../../base/pixel/font'
import { BANNER, CARDS, heldGifts, SYCO } from '../engine/bossSycophant'
import { flightLane, giftGold, GIFTS, nextGift, sleeveOf, throwerLanes } from '../engine/gifts'
import { stencilsOf } from '../engine/stencils'
import { sprite } from './sheet'
import { clockOf, HOUSE } from '../engine/attendants'
import { cellDef, cellIndex, cellRect, mapInfo, type MapInfo } from '../engine/map'
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
  paperLights(lights, s)
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
  const lw = { w: world, s }
  const lanes = [...throwerLanes(lw), ...s.map.enemies.flatMap(e => stencilsOf(e, lw)), ...s.map.projectiles.flatMap(p => (p.kind === 'gift' ? [flightLane(p, lw)] : []))]
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
 * True where the house paints a tile's thing itself (`queueHouse`), so that the isometric view stands nothing of the
 * tile's own there: the laundry's sheets (fence tiles), the baths' folding screens (diamond blocks, while they are
 * up) and the lobby's rack of hooks (the sign it is read from).
 */
export function houseTile(info: MapInfo, t: TileChar, tx: number, ty: number, view: ViewSide): boolean {
  if (info.def.id !== 'steamhouse') return false
  return t === 'F' || (t === '◇' && view === 'iso') || (t === 'S' && !!info.signs.get(ty * info.w + tx)?.robe)
}

/** The house's standing things, queued with the frame's own: the rack, the screens, the sheets, and THE END's banner. */
export function queueHouse(g: G, world: World, s: GameState, cx: number, cy: number, time: number, reduced: boolean, items: SceneItem[], lights: Light[]) {
  if (!HOUSE.has(s.map.id)) return
  const info = mapInfo(world, s.map.id)
  const m = s.map
  const here = (x: number, y: number) => !!s.scroll || cellIndex(info, x, y) === s.zoneIndex
  if (m.id === 'steamhouse') {
    for (let i = 0; i < m.tiles.length; i++) {
      const tx = i % m.w
      const ty = Math.floor(i / m.w)
      const t = m.tiles[i]!
      if (!houseTile(info, t, tx, ty, s.view) || !here(tx + 0.5, ty + 0.5)) continue
      const x = tx * T - cx
      const y = ty * T - cy
      const draw = t === 'F' ? () => paintSheet(g, x, y, tx, time, reduced)
        : () => { shade(g, x + 1, y + 13, 14); g.drawImage(sprite(t === '◇' ? 'screen_fold' : 'rack_hooks'), x, y - 1) }
      items.push({ x: tx + 0.5, y: ty + 0.9, foot: 1 / T, draw })
      lights.push({ x: tx + 0.5, y: ty + 0.4, z: 0.6, r: 0.9, color: '#fff4ff', a: t === 'F' ? 0.35 : t === 'S' ? 0.5 : 0.15 })
    }
  }
  queueBanner(g, info, s, cx, cy, time, reduced, items, lights)
}

function shade(g: G, x: number, y: number, w: number) {
  g.fillStyle = 'rgba(11,6,22,0.45)'
  g.fillRect(x, y, w, 3)
}

/**
 * A sheet hung to dry, one to a fence tile: pale cloth pegged on a line, folds down it, its hem stirring a px (still
 * under reduced motion). Neighbours differ a little in length, so a run reads as washing and not as a wall.
 */
function paintSheet(g: G, x: number, y: number, seed: number, time: number, reduced: boolean) {
  const r = (c: string, dx: number, dy: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h) }
  const drop = seed % 2 ? 0 : 2
  const stir = reduced ? 0 : Math.round(Math.sin(time * 1.6 + seed * 1.9))
  shade(g, x + 2, y + 13, 12)
  // The line, and a post's worth of it between two sheets.
  r(INK, 0, -6, 16, 3)
  r('#c08a4a', 0, -5, 16, 1)
  const h = 15 - drop
  r(INK, 1, -4, 14, h + 1)
  r('#e8e4ff', 2, -4, 12, h)
  r(WHITE, 3, -3, 2, h - 2)
  r('#cfc6ff', 6, -2, 1, h - 3)
  r('#cfc6ff', 10, -4, 2, h)
  r(WHITE, 12, -3, 1, h - 3)
  // The hem: two folds hang a px lower, and shift.
  r(INK, 2 + stir, h - 3, 5, 2)
  r('#e8e4ff', 3 + stir, h - 4, 3, 2)
  r(INK, 9 + stir, h - 3, 4, 2)
  r('#cfc6ff', 10 + stir, h - 4, 2, 2)
  // Two pegs.
  for (const dx of [3, 11]) { r(INK, dx - 1, -8, 4, 5); r('#e0a85c', dx, -7, 2, 3) }
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
    // Bare-faced, once the mask is done with: going behind the paper, out from behind it, and away.
    case 'end': case 'hung': case 'torn': case 'out': case 'true': case 'leaving': return 'syco_true'
    default: return Math.floor(time * 2) % 2 ? 'syco_1' : 'syco_0'
  }
}

/** Where the figure's foot is drawn, px over its own foot point: it bobs (still under reduced motion). */
export const sycophantLift = (time: number, reduced: boolean) => SYCO_HOVER - 2 - (reduced ? 0 : Math.round(Math.sin(time * 2) * 2))

/**
 * How much of it is to be seen: it goes as it backs behind the coming banner, is not there while that hangs, comes
 * into sight as the paper drops, and fades as it walks off.
 */
export function sycophantAlpha(e: Enemy): number {
  const k = e.ai.mode === 'end' ? 1 - ((e.ai.gone as number | undefined) ?? 0)
    : e.ai.mode === 'hung' ? 0
    : e.ai.mode === 'torn' ? 1 - e.ai.t / SYCO.torn
    : e.ai.mode === 'leaving' ? e.ai.t / SYCO.leaving
    : 1
  return Math.max(0, Math.min(1, k))
}
export const sycophantShown = (e: Enemy) => sycophantAlpha(e) > 0
/** Its bar: through the fight, and over the hanging banner (the fourth cut is the corner's); not while it only talks. */
export const sycophantBar = (e: Enemy) => !['end', 'torn', 'out', 'true', 'leaving'].includes(e.ai.mode as string)
/** While the banner hangs it hides up where the classic view ends: its bar lies on the floor under the loose corner. */
export const sycophantBarFloor = (s: GameState, e: Enemy) => (e.kind === 'sycophant' && e.ai.mode === 'hung' ? { x: e.x, y: s.zone.y + BANNER.y1 } : null)

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

/** What of the scene is on the screen, in the painter's own px (`g` may be scaled or moved). */
function onScreen(g: G) {
  const m = g.getTransform()
  return { x0: -m.e / m.a, y0: -m.f / m.d, x1: (g.canvas.width - m.e) / m.a, y1: (g.canvas.height - m.f) / m.d }
}

/**
 * The compliment card: a strip of paper with one line in the 5×7 font, held in front of the figure, and never off the
 * screen's edge: whenever it shows it can be read.
 */
function card(g: G, text: string, x: number, y: number) {
  const w = textWidth(text) + 8
  const see = onScreen(g)
  const left = Math.round(Math.max(see.x0 + 2, Math.min(see.x1 - w - 2, x - w / 2)))
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
  letterbox(g, info, s, place)
}

// ---------------------------------------------------------------------------
// THE END
// ---------------------------------------------------------------------------

/** The banner's picture: its own size, classic px (six tiles by three). */
const BW = (BANNER.x1 - BANNER.x0) * T
const BH = (BANNER.y1 - BANNER.y0) * T
/** The rod's rows at the top of the picture. */
const ROD = 5
/** The Sycophant of the hero's room, after the third cut or not. */
const sycoHere = (s: GameState) => s.map.enemies.find(e => e.kind === 'sycophant' && e.cell === s.zoneIndex)

/** How far the paper has come down (0 to 1) and how far it has fallen again (0 to 1); null when none is up. */
function bannerNow(s: GameState): { down: number; fallen: number } | null {
  const e = sycoHere(s)
  if (!e || e.dead) return null
  if (e.ai.mode === 'hung') return { down: 1, fallen: 0 }
  if (e.ai.mode === 'torn') return { down: 1, fallen: 1 - Math.max(0, e.ai.t) / SYCO.torn }
  if (e.ai.mode !== 'end' || !s.beat) return null
  const t = SYCO.beat - s.beat.t
  return { down: Math.max(0, Math.min(1, (t - 0.3) / 0.8)), fallen: 0 }
}

/**
 * THE END, hanging across the room's north third over the way out: one picture that stands along the room's x in every
 * view (`wall`), so a hero south of it is before it. It unrolls from its rod through the beat; the loose corner flaps
 * and glows gold; torn, it drops in a heap.
 */
function queueBanner(g: G, info: MapInfo, s: GameState, cx: number, cy: number, time: number, reduced: boolean, items: SceneItem[], lights: Light[]) {
  const now = bannerNow(s)
  if (!now || s.scroll) return
  const z = cellRect(info, s.zoneIndex)
  const x = z.x + (BANNER.x0 + BANNER.x1) / 2
  const low = z.y + BANNER.y1
  const name = !reduced && Math.floor(time * 3) % 2 ? 'banner_end' : 'banner_loose'
  // (Before the paper unrolls, the rod drops into place from above.)
  const drop = s.beat ? Math.max(0, 1 - (SYCO.beat - s.beat.t) / 0.3) * 24 : 0
  const keep = 1 - now.fallen * now.fallen
  const paper = Math.round((BH - ROD) * now.down * keep)
  items.push({
    x, y: low - 0.05, ay: low - 0.05, big: true, wall: true,
    draw: () => {
      const img = sprite(name)
      const left = Math.round(x * T - cx - BW / 2)
      const top = Math.round((low - 0.05) * T - cy - BH + (BH - ROD) * (1 - keep) - drop)
      if (paper > 0) g.drawImage(img, 0, BH - paper, BW, paper, left, top + ROD, BW, paper)
      g.drawImage(img, 0, 0, BW, ROD, left, top, BW, ROD)
    },
  })
  // A little light of its own, so the dim room does not grey the letters.
  lights.push({ x, y: low + 0.2, z: 1.2, r: 3.2, color: '#fff4ff', a: 0.22 })
  if (now.down >= 1 && !now.fallen) {
    // The corner coming loose: gold, "hit me".
    const beat = reduced ? 0.7 : 0.5 + 0.4 * Math.abs(Math.sin(time * 4))
    lights.push({ x: z.x + BANNER.x1 - 0.4, y: low + 0.1, z: 0.3, r: 1.5, color: GOLD, a: beat })
  }
}

/**
 * What is left of THE END on the floor where it hung: sheets and scraps with the letters still on them, and the rod.
 * Flat, painted with the floor, never solid; it stays when the room is quiet.
 */
export function drawPaper(g: G, world: World, s: GameState, cx: number, cy: number) {
  if (s.map.id !== 'steamsuite') return
  const info = mapInfo(world, s.map.id)
  const e = s.map.enemies.find(o => o.kind === 'sycophant')
  const mode = e && !e.dead ? e.ai.mode as string : null
  const grown = mode === 'torn' ? 1 - Math.max(0, e!.ai.t) / SYCO.torn : mode === 'out' || mode === 'true' || mode === 'leaving' || s.flags.sycophant ? 1 : 0
  if (!grown) return
  // (The Best Room is the suite's second.)
  const z = cellRect(info, 1)
  if (!s.scroll && s.zoneIndex !== 1) return
  const img = sprite('banner_end')
  const x0 = (z.x + BANNER.x0) * T - cx
  const y0 = (z.y + BANNER.y1) * T - cy
  g.save()
  g.globalAlpha = Math.min(1, grown * 1.5)
  // The rod, fallen askew.
  g.fillStyle = INK
  for (let i = 0; i < 12; i++) g.fillRect(x0 + 4 + i * 7, y0 - 24 + Math.floor(i / 3), 8, 4)
  g.fillStyle = '#e07a4e'
  for (let i = 0; i < 12; i++) g.fillRect(x0 + 5 + i * 7, y0 - 23 + Math.floor(i / 3), 6, 2)
  for (const [dx, dy, a, sx, sy, w, h] of PILE) {
    g.save()
    g.translate(Math.round(x0 + dx), Math.round(y0 + dy))
    g.rotate(a)
    g.fillStyle = INK
    g.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2)
    g.drawImage(img, sx, sy, w, h, -w / 2, -h / 2, w, h)
    // A crease across it.
    g.fillStyle = '#cfc6ff'
    g.fillRect(-w / 2, Math.round(h / 6), Math.round(w * 0.7), 1)
    g.restore()
  }
  g.restore()
}

/** The pile: each piece's place (px from the banner's lower west end), its turn, and the cut of the picture on it. */
const PILE: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
  [10, -12, -0.3, 4, 26, 18, 12],
  [26, -17, 0.5, 40, 6, 14, 10],
  [31, -7, -0.12, 8, 12, 24, 16],
  [52, -14, 0.24, 30, 14, 22, 18],
  [66, -6, -0.55, 74, 26, 16, 11],
  [76, -16, 0.1, 56, 12, 24, 17],
  [88, -7, 0.7, 6, 5, 12, 9],
  [43, -3, 0.9, 62, 34, 10, 7],
]

/** The pile's own light, so that paper on a dim carpet is seen. */
function paperLights(lights: Light[], s: GameState) {
  if (s.map.id !== 'steamsuite' || !s.flags.sycophant && !['torn', 'out', 'true', 'leaving'].includes(sycoHere(s)?.ai.mode as string)) return
  lights.push({ x: 16 + (BANNER.x0 + BANNER.x1) / 2, y: BANNER.y1 - 0.6, z: 0.2, r: 3, color: '#fff4ff', a: 0.12 })
}

/**
 * The beat's black bars, sliding in at the top and the bottom and out again as it ends. They give way to what the
 * beat is about: the top one stops over the banner's rod, the bottom one under the hero's feet.
 */
function letterbox(g: G, info: MapInfo, s: GameState, place: (x: number, y: number) => { x: number; y: number }) {
  if (!s.beat) return
  const t = SYCO.beat - s.beat.t
  const k = Math.max(0, Math.min(1, t / 0.3, s.beat.t / 0.2))
  const see = onScreen(g)
  // (Deeper on an upright screen, where the room lies in the middle with dark above and below it.)
  const tall = (see.y1 - see.y0) * (see.y1 - see.y0 > (see.x1 - see.x0) * 1.3 ? 0.2 : 0.12)
  const z = cellRect(info, s.zoneIndex)
  const rod = Math.min(place(z.x + BANNER.x0, z.y + BANNER.y1).y, place(z.x + BANNER.x1, z.y + BANNER.y1).y) - BH
  const feet = place(s.hero.x, s.hero.y).y + 10
  const top = Math.round(Math.max(10, Math.min(tall, rod - see.y0 - 2)) * k)
  const bottom = Math.round(Math.max(10, Math.min(tall, see.y1 - feet)) * k)
  const x = Math.floor(see.x0)
  const w = Math.ceil(see.x1 - see.x0) + 1
  g.fillStyle = '#000000'
  g.fillRect(x, Math.floor(see.y0), w, top)
  g.fillRect(x, Math.ceil(see.y1) - bottom, w, bottom + 1)
  // Their inner edges, a thin line: black on the dark round a room would not be seen to come in.
  if (k <= 0) return
  g.fillStyle = '#5a5285'
  g.fillRect(x, Math.floor(see.y0) + top, w, 1)
  g.fillRect(x, Math.ceil(see.y1) - bottom - 1, w, 1)
}
