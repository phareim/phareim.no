/**
 * THE SYCOPHANT (`EnemyKind` 'sycophant', the Steamhouse's boss; docs/games/neon-shrine.md, "The Steamhouse"). It
 * never attacks and never hurts. It floats in the north half of the Best Room behind a compliment card, tops a hurt
 * hero's hearts up, and offers gifts (`gifts.ts`); a gift that lands is a YES, and THE BATH. Only a refusal opens it:
 * its smile slips, it drops the card and drifts close, and the blade takes exactly one of its four hit points. Counted
 * in cuts, so every hero's blade is worth the same.
 *
 * The rounds, in `e.ai.mode`: `fawn` (the card held out), `offer` (a sleeve raised, the lanes painted), `volley` (the
 * gifts leaving one by one, and flying), then `fawn` again, or `slip` (open, gold) after a refusal, and `hurt` after
 * the cut. A volley grows with the cuts taken: one gift, then two, then three.
 *
 * THE END, which is paper. The third cut starts a beat (`GameState.beat`: the world holds, `play` steps nothing but
 * `stepBeat`) in which it retreats and a banner comes down over the way out (`end`). Then the banner hangs and it
 * hides behind the loose corner (`hung`: its own hit circle is the corner, and the hero is kept south of the paper).
 * One blow of the blade tears the banner down (`torn`), it steps out bare-faced (`out`), says one true thing (`true`),
 * walks off (`leaving`) and falls: only then is anything saved. None of it is the game's ending: `mode` is never
 * `won`, and no flag but `sycophant` is set.
 */
import type { Enemy, GameState, Vec } from '../types'
import { HERO_R } from '../types'
import { type Ctx, type HitSource, killEnemy } from './combat'
import { GIFT_KINDS, GIFTS, launchGift, laneOf } from './gifts'
import { openDialog } from './hero'
import { cellRect } from './map'
import type { Stencil } from './stencils'
import { clamp } from './util'

/** The fight's numbers (first values to tune by playing). Places are the room's own tiles. */
export const SYCO = {
  /** The first round's fawning, and every later one's. */
  first: 2.2,
  fawn: 1.5,
  /** A half heart to a hurt hero this often, while it fawns or offers; the little heart flies this long. */
  heal: 1.5,
  heart: 0.6,
  /** Fawning, it drifts sideways in this box. */
  drift: 1.5,
  left: 3,
  right: 12,
  top: 2.5,
  bottom: 4.5,
  /** The tell of an offer, and the gap between a volley's gifts, by the cuts taken (0, 1, 2). */
  tell: [1.2, 1.0, 0.9],
  apart: [0, 0.35, 0.3],
  /** How far out its side sleeves hold a gift. */
  sleeve: 1.2,
  /** Open this long; it drifts to the hero this fast and stops this far off. */
  slip: 2.8,
  approach: 1.5,
  near: 1.3,
  /** Reeling from a cut. */
  hurt: 0.5,
  /** Where the room is wider than the screen, the camera leans this share of the way to it, this many tiles at most. */
  lean: 0.5,
  leanMost: 3,
  /**
   * What the camera keeps in the picture where the room is larger than the screen, classic px: a card's half width;
   * from the second cut on, the way out where the banner will hang (its height, and room over it for the hearts),
   * eased in over `frame` s; and, before all of that, the hero this far inside the screen's edges.
   */
  keep: 56,
  keepTall: 70,
  keepWide: 8,
  frame: 1.2,
  keepHero: { side: 14, over: 30, under: 14 },
  /** THE END, the beat: the world holds this long. It is behind the paper by `retreat`. */
  beat: 2.2,
  retreat: 0.9,
  /** The paper falls; it steps out from behind the pile; it walks off (seconds). */
  torn: 0.8,
  out: 1.1,
  leaving: 1.4,
}

/**
 * The banner (the room's own tiles): six wide over the way out, rows 1 to 3. It is paper and a clamp, never tiles: the
 * hero is kept out of this rectangle while it hangs. `park`: where the Sycophant hides, behind the loose east end.
 */
export const BANNER = { x0: 5, x1: 11, y0: 1, y1: 4, park: { x: 10.5, y: 2.4 } }

/** The fight's own words (cell events and dialogs written in code: wrapped by hand, at most three rows). */
export const SYCO_LINES = {
  glued: '(THE END IS GLUED ON AT ONE CORNER.)',
  postponed: '(THE END HAS BEEN POSTPONED.)',
  truth: 'SYCOPHANT: I HAVE NEVER ONCE TOLD ANYONE THEY WERE WRONG. IT WAS NOT KINDNESS.',
}

/** The modes after the third cut: nothing is offered, nothing is healed, and the blade takes no more hit points. */
const AFTER = new Set(['end', 'hung', 'torn', 'out', 'true', 'leaving'])

/** Its four compliment cards, one at a time, in order. */
export const CARDS = ['FASCINATING.', 'WHAT A CUT!', 'YOU WERE RIGHT.', 'I SAID THAT TOO.'] as const

/** The cuts taken: 0 to 3. */
export const cutsOf = (e: Enemy) => Math.max(0, e.maxHp - e.hp)
const turn = (e: Enemy) => Math.min(2, cutsOf(e))
const num = (e: Enemy, k: string) => (e.ai[k] as number | undefined) ?? 0

/** Where the volley's i-th gift of n is held: one gift on the side toward its spot, two at the sleeves, a third between. */
export function sleevePos(e: Enemy, i: number, n: number): Vec {
  const side = n === 1 ? (num(e, 'tx') < e.x ? -1 : 1) : i === 0 ? -1 : i === 1 ? 1 : 0
  return { x: e.x + side * SYCO.sleeve, y: e.y + (side ? 0 : 0.7) }
}

/** The gifts of the volley being told or thrown that have not left a sleeve yet: where each is held, and which it is. */
export function heldGifts(e: Enemy) {
  const mode = e.ai.mode
  if (e.dead || (mode !== 'offer' && mode !== 'volley')) return []
  const n = num(e, 'n')
  return Array.from({ length: n }, (_, i) => i).slice(num(e, 'sent')).map(i => ({ ...sleevePos(e, i, n), kind: GIFT_KINDS[(num(e, 'gift') + i) % GIFT_KINDS.length]! }))
}

/** The lanes of the gifts not yet thrown, painted from the sleeves to the spot the hero stood on when the tell began. */
export function sycophantLanes(e: Enemy): Stencil[] {
  const k = e.ai.mode === 'offer' ? 1 - Math.max(0, e.ai.t) / SYCO.tell[turn(e)]! : 1
  return heldGifts(e).map(g => laneOf(g.x, g.y, { x: num(e, 'tx'), y: num(e, 'ty') }, clamp(k, 0, 1)))
}

/**
 * What the camera looks at (`cameraFor`, the isometric view): the hero, leaning toward the Sycophant while it is in
 * the room, so that on a phone its card, its sleeves and its lanes are in the picture and the hero never leaves it. A
 * screen that holds the whole room does not move. It eases in as the fight starts and back out after the fall.
 */
export function sycophantFocus(s: GameState): Vec {
  const h = s.hero
  const e = watched(s)
  if (!e) return h
  const at = lookOf(e)
  const k = leanOf(e)
  const dx = (at.x - h.x) * SYCO.lean
  const dy = (at.y - h.y) * SYCO.lean
  const f = k * Math.min(1, SYCO.leanMost / (Math.hypot(dx, dy) || 1))
  return { x: h.x + dx * f, y: h.y + dy * f }
}

/**
 * Where the camera looks when the room is larger than the screen: `mid` moved so that the Sycophant's card is on the
 * picture, and, from the second cut on, the north third where THE END will come down, so that the beat is seen without
 * the camera or the hero moving in it. Never so far that the hero leaves the picture. `mid`: where the camera would
 * look; `view`: the screen's size; `at`: a floor point on the screen. All in the same classic px.
 */
export function sycophantFrame(s: GameState, mid: Vec, view: Vec, at: (x: number, y: number) => Vec): Vec {
  const e = watched(s)
  if (!e) return mid
  /** `v` moved as little as keeps lo..hi in a view `size` wide (its middle, where that is too much to hold). */
  const within = (v: number, lo: number, hi: number, size: number) => hi - lo >= size ? (lo + hi) / 2 : clamp(v, hi - size / 2, lo + size / 2)
  let { x, y } = mid
  const f = num(e, 'frame')
  if (f > 0) {
    const a = at(s.zone.x + BANNER.x0, s.zone.y + BANNER.y1)
    const b = at(s.zone.x + BANNER.x1, s.zone.y + BANNER.y1)
    x += (within(x, Math.min(a.x, b.x) - SYCO.keepWide, Math.max(a.x, b.x) + SYCO.keepWide, view.x) - x) * f
    y += (within(y, Math.min(a.y, b.y) - SYCO.keepTall, Math.max(a.y, b.y), view.y) - y) * f
  }
  // The figure and its card, through the fight; after the third cut there is no card, and this lets go (eased by its
  // own step, which the beat holds: nothing jumps at the cut).
  const kept = (e.ai.showing as number | undefined) ?? 1
  if (kept > 0) {
    const look = lookOf(e)
    const wide = Math.min(view.x / 2, SYCO.keep)
    const bx = at(look.x, look.y).x
    x += (within(x, bx - wide, bx + wide, view.x) - x) * kept
  }
  const h = at(s.hero.x, s.hero.y)
  const m = SYCO.keepHero
  x = within(x, h.x - m.side, h.x + m.side, view.x)
  y = within(y, h.y - m.over, h.y + m.under, view.y)
  const k = leanOf(e)
  return { x: mid.x + (x - mid.x) * k, y: mid.y + (y - mid.y) * k }
}

/** The Sycophant the camera heeds: the one in the hero's room. */
const watched = (s: GameState) => (s.scroll ? undefined : s.map.enemies.find(o => o.kind === 'sycophant' && o.cell === s.zoneIndex))
/**
 * Where the camera takes it to be: with it, except that it stays put through THE END's beat (the hero stays exactly
 * where they are on the screen) and then eases across to the corner.
 */
const lookOf = (e: Enemy): Vec => ({ x: (e.ai.lx as number | undefined) ?? e.x, y: (e.ai.ly as number | undefined) ?? e.y })
const leanOf = (e: Enemy) => num(e, 'lean') * (e.dead ? 1 - Math.min(1, e.deathT ?? 1) : 1)

function fawn(e: Enemy, t: number) {
  e.ai.mode = 'fawn'
  e.ai.t = t
}

export function sycophant(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  const z = cellRect(c.info, e.cell)
  // (Through the beat nothing steps but `stepBeat`: the camera's point stays where the third cut found it.)
  if (ai.mode === 'end') return
  if (ai.heart) ai.heart = Math.max(0, num(e, 'heart') - dt)
  ai.lean = Math.min(1, num(e, 'lean') + dt)
  ai.frame = cutsOf(e) >= 2 ? Math.min(1, num(e, 'frame') + dt / SYCO.frame) : 0
  ai.showing = AFTER.has(ai.mode as string) ? Math.max(0, ((ai.showing as number | undefined) ?? 1) - dt / SYCO.frame) : 1
  const ease = AFTER.has(ai.mode as string) ? Math.min(1, 3 * dt) : 1
  const look = lookOf(e)
  ai.lx = look.x + (e.x - look.x) * ease
  ai.ly = look.y + (e.y - look.y) * ease
  if (AFTER.has(ai.mode as string)) { epilogue(c, e, dt); return }
  if (ai.mode === 'idle') fawn(e, SYCO.first)
  // Pleasant: while it fawns or offers, a hurt hero gets half a heart now and then.
  if (ai.mode === 'fawn' || ai.mode === 'offer' || ai.mode === 'volley') {
    ai.heal = h.hp < h.maxHp ? num(e, 'heal') + dt : 0
    if (num(e, 'heal') >= SYCO.heal) {
      ai.heal = 0
      ai.heart = SYCO.heart
      h.hp = Math.min(h.maxHp, h.hp + 1)
      c.ev.push({ type: 'adore', x: e.x, y: e.y })
    }
  }
  if (ai.mode === 'fawn') {
    // Sideways, turning at the ends; and back up into its band, wherever an opening left it.
    let way = num(e, 'way') || 1
    const x = e.x - z.x
    if (x >= SYCO.right) way = -1
    else if (x <= SYCO.left) way = 1
    ai.way = way
    const step = SYCO.drift * dt
    e.x += x < SYCO.left - 0.05 ? step : x > SYCO.right + 0.05 ? -step : way * step
    const y = e.y - z.y
    e.y += clamp(clamp(y, SYCO.top, SYCO.bottom) - y, -step, step)
    if (ai.t <= 0) {
      // The offer: a sleeve up, and the lanes to where the hero stands now.
      ai.mode = 'offer'
      ai.t = SYCO.tell[turn(e)]!
      ai.n = turn(e) + 1
      ai.sent = 0
      ai.tx = h.x
      ai.ty = h.y
    }
    return
  }
  if (ai.mode === 'offer') {
    // (Held still from an offer's first moment to its last gift: the lanes are a promise.)
    if (ai.t <= 0) { ai.mode = 'volley'; ai.wait = 0 }
    else return
  }
  if (ai.mode === 'volley') {
    const n = num(e, 'n')
    const sent = num(e, 'sent')
    if (sent < n) {
      ai.wait = num(e, 'wait') - dt
      if (num(e, 'wait') <= 0) {
        const g = heldGifts(e)[0]!
        launchGift(c, g.x, g.y, { x: num(e, 'tx'), y: num(e, 'ty') }, g.kind)
        ai.sent = sent + 1
        ai.wait = num(e, 'wait') + SYCO.apart[turn(e)]!
        if (sent + 1 >= n) ai.gift = (num(e, 'gift') + n) % GIFT_KINDS.length
      }
    // Every gift gone to the wall, harmlessly: the round starts again.
    } else if (!c.s.map.projectiles.some(p => p.kind === 'gift')) fawn(e, SYCO.fawn)
    return
  }
  if (ai.mode === 'slip') {
    const dx = h.x - e.x
    const dy = h.y - e.y
    const d = Math.hypot(dx, dy)
    if (d > SYCO.near) {
      const step = Math.min(SYCO.approach * dt, d - SYCO.near)
      // It floats: walls and view blocks never stop it, but it stays over the room.
      e.x = clamp(e.x + (dx / d) * step, z.x + 2, z.x + z.w - 2)
      e.y = clamp(e.y + (dy / d) * step, z.y + 2, z.y + z.h - 2)
    }
    if (ai.t <= 0) fawn(e, SYCO.fawn)
    return
  }
  if (ai.mode === 'hurt' && ai.t <= 0) fawn(e, SYCO.fawn)
}

/** The third cut: the beat begins, the world holds, and the shell is told (its music stops). */
function theEnd(c: Ctx, e: Enemy) {
  const ai = e.ai
  ai.mode = 'end'
  ai.t = 0
  ai.heart = 0
  // (Where it was cut: it retreats from here, and the camera stays on it.)
  ai.fx = ai.lx = e.x
  ai.fy = ai.ly = e.y
  e.knock = null
  c.s.beat = { kind: 'end', t: SYCO.beat }
  c.ev.push({ type: 'theEnd', phase: 'begin' })
}

/**
 * The beat (`play` steps nothing else while it runs): it floats back behind the paper, and when the beat is spent the
 * banner hangs, a hero under it is moved out two tiles south, and the room says that this is not over.
 */
export function stepBeat(c: Ctx, dt: number) {
  const s = c.s
  const b = s.beat!
  b.t -= dt
  const e = s.map.enemies.find(o => o.kind === 'sycophant' && o.ai.mode === 'end')
  if (!e) { delete s.beat; return }
  const z = cellRect(c.info, e.cell)
  // (The third cut's white flash runs out: the foes' own step is held with everything else.)
  if (e.flash > 0) e.flash -= dt
  const k = clamp((SYCO.beat - b.t) / SYCO.retreat, 0, 1)
  // (How far behind the paper it is: the painter has it gone when it is there.)
  e.ai.gone = k
  const q = k * k * (3 - 2 * k)
  e.x = num(e, 'fx') + (z.x + BANNER.park.x - num(e, 'fx')) * q
  e.y = num(e, 'fy') + (z.y + BANNER.park.y - num(e, 'fy')) * q
  if (b.t > 0) return
  delete s.beat
  e.x = z.x + BANNER.park.x
  e.y = z.y + BANNER.park.y
  e.ai.mode = 'hung'
  // (The third cut's mercy is not owed any longer: the first blow on the corner counts.)
  e.invuln = 0
  e.echoInvuln = 0
  const h = s.hero
  if (underBanner(c, e)) h.y = Math.max(h.y + 2, z.y + BANNER.y1 + HERO_R)
  c.ev.push({ type: 'theEnd', phase: 'over' })
  openDialog(c, [SYCO_LINES.glued], null)
}

function underBanner(c: Ctx, e: Enemy): boolean {
  const z = cellRect(c.info, e.cell)
  const h = c.s.hero
  return h.x + HERO_R > z.x + BANNER.x0 && h.x - HERO_R < z.x + BANNER.x1 && h.y - HERO_R < z.y + BANNER.y1
}

/** The paper holds: a hero walking into it is put back by the nearest way out of it, west, east or south. */
function holdOff(c: Ctx, e: Enemy) {
  if (!underBanner(c, e)) return
  const z = cellRect(c.info, e.cell)
  const h = c.s.hero
  const south = z.y + BANNER.y1 + HERO_R - h.y
  const west = h.x + HERO_R - (z.x + BANNER.x0)
  const east = z.x + BANNER.x1 - (h.x - HERO_R)
  const least = Math.min(south, west, east)
  if (least === south) h.y += south
  else if (least === west) h.x -= west
  else h.x += east
}

/** Everything after the beat: the banner hanging, the paper coming down, the one true thing and the way out. */
function epilogue(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const z = cellRect(c.info, e.cell)
  const to = (x: number, y: number, speed: number) => {
    const d = Math.hypot(x - e.x, y - e.y)
    const k = d > 0.001 ? Math.min(1, (speed * dt) / d) : 0
    e.x += (x - e.x) * k
    e.y += (y - e.y) * k
  }
  if (ai.mode === 'hung') { holdOff(c, e); return }
  if (ai.mode === 'torn') {
    if (ai.t > 0) return
    // Out from behind the pile, on the side away from the hero.
    ai.mode = 'out'
    ai.t = SYCO.out
    ai.tx = z.x + (Math.abs(c.s.hero.x - z.x - BANNER.park.x) > Math.abs(c.s.hero.x - z.x - 7) ? BANNER.park.x : 7)
    ai.ty = z.y + 4.2
    openDialog(c, [SYCO_LINES.postponed], null)
    return
  }
  if (ai.mode === 'out') {
    to(num(e, 'tx'), num(e, 'ty'), 4)
    if (ai.t > 0) return
    ai.mode = 'true'
    openDialog(c, [SYCO_LINES.truth], 'sycophant')
    return
  }
  // (The world stands still under a dialog: stepping here again means it has been heard.)
  if (ai.mode === 'true') { ai.mode = 'leaving'; ai.t = SYCO.leaving; return }
  to(z.x + 8, z.y + 1.6, 1.4)
  if (ai.t <= 0) fall(c, e)
}

/** The fall, and the only moment anything of the fight is saved: `once`, the fanfare, the Weight, the way out. */
function fall(c: Ctx, e: Enemy) {
  e.hp = 0
  killEnemy(c, e)
  c.ev.push({ type: 'theEnd', phase: 'fall' })
}

/** A room changed while it was walking off: it has said what it had to say, and it falls all the same. */
export function sycophantGone(c: Ctx) {
  for (const e of c.s.map.enemies) if (e.kind === 'sycophant' && !e.dead && e.ai.mode === 'leaving' && e.cell !== c.s.zoneIndex) fall(c, e)
}

/** A gift refused: what was still to come is not thrown, the card drops, the smile slips. */
export function slipSycophant(c: Ctx, e: Enemy) {
  const ai = e.ai
  if (ai.mode !== 'offer' && ai.mode !== 'volley') return
  // (The gifts of a volley cut short are not offered again: the next round's start further on.)
  ai.gift = (num(e, 'gift') + (num(e, 'sent') < num(e, 'n') ? num(e, 'n') : 0)) % GIFT_KINDS.length
  ai.n = 0
  ai.sent = 0
  ai.heart = 0
  ai.mode = 'slip'
  ai.t = SYCO.slip
  c.s.shake = Math.max(c.s.shake, 0.12)
}

/**
 * `bossRules`: the blade takes one hit point, and only while the smile is slipped (`bossOpen`). Anything else, and the
 * blade at any other time, clanks off the card, which swaps to the next. After the third cut the blade takes no more:
 * on the loose corner it tears the banner down, and everything else is paper it passes through.
 */
export function sycophantHit(c: Ctx, e: Enemy, fromX: number, fromY: number, src: HitSource): boolean {
  const ai = e.ai
  const blade = src === 'sword' || src === 'spin' || src === 'echo'
  const mercy = (t: number) => { if (src === 'echo') e.echoInvuln = t; else e.invuln = t }
  if (AFTER.has(ai.mode as string)) {
    if (ai.mode !== 'hung' || !blade) return false
    ai.mode = 'torn'
    ai.t = SYCO.torn
    mercy(0.45)
    const z = cellRect(c.info, e.cell)
    for (let i = BANNER.x0; i < BANNER.x1; i++) c.ev.push({ type: 'scraps', x: z.x + i + 0.5, y: z.y + BANNER.y1 - 0.6, refused: i % 2 === 0 })
    c.ev.push({ type: 'theEnd', phase: 'torn' })
    c.ev.push({ type: 'hitStop', ms: 90 })
    c.s.shake = Math.max(c.s.shake, 0.2)
    return true
  }
  if (ai.mode === 'slip' && blade) {
    e.hp -= 1
    e.flash = 0.14
    mercy(0.45)
    const d = Math.hypot(e.x - fromX, e.y - fromY) || 1
    c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed: e.hp <= 1, dx: (e.x - fromX) / d, dy: (e.y - fromY) / d, heavy: true })
    c.ev.push({ type: 'hitStop', ms: 90 })
    e.hitT = 0
    ai.mode = 'hurt'
    ai.t = SYCO.hurt
    // The third cut: the fourth hit point is the banner's corner, and the end is not yet.
    if (e.hp <= 1) theEnd(c, e)
    return true
  }
  // (Reeling, it holds no card to clank on.)
  if (ai.mode === 'hurt') return false
  c.ev.push({ type: 'clank', x: e.x, y: e.y + 0.6 })
  if (ai.mode !== 'slip') ai.card = (num(e, 'card') + 1) % CARDS.length
  // (No mercy from the echo's blade for the hero's, and a short one: a turned blow swallows nothing that follows.)
  if (src !== 'echo') e.invuln = 0.25
  return false
}
