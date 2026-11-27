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
 * THE END HERE IS A STAND-IN: after the third cut it falls at once (`killEnemy`). The paper banner, the one true thing
 * and the Weight come between the third cut and the fall in part three.
 */
import type { Enemy, GameState, Vec } from '../types'
import { type Ctx, type HitSource, killEnemy } from './combat'
import { GIFT_KINDS, GIFTS, launchGift, laneOf } from './gifts'
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
}

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
  const e = s.scroll ? undefined : s.map.enemies.find(o => o.kind === 'sycophant' && o.cell === s.zoneIndex)
  if (!e) return h
  const k = num(e, 'lean') * (e.dead ? 1 - Math.min(1, e.deathT ?? 1) : 1)
  const dx = (e.x - h.x) * SYCO.lean
  const dy = (e.y - h.y) * SYCO.lean
  const f = k * Math.min(1, SYCO.leanMost / (Math.hypot(dx, dy) || 1))
  return { x: h.x + dx * f, y: h.y + dy * f }
}

function fawn(e: Enemy, t: number) {
  e.ai.mode = 'fawn'
  e.ai.t = t
}

export function sycophant(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  const z = cellRect(c.info, e.cell)
  if (ai.heart) ai.heart = Math.max(0, num(e, 'heart') - dt)
  ai.lean = Math.min(1, num(e, 'lean') + dt)
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
 * blade at any other time, clanks off the card, which swaps to the next.
 */
export function sycophantHit(c: Ctx, e: Enemy, fromX: number, fromY: number, src: HitSource): boolean {
  const ai = e.ai
  const blade = src === 'sword' || src === 'spin' || src === 'echo'
  const mercy = (t: number) => { if (src === 'echo') e.echoInvuln = t; else e.invuln = t }
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
    // STAND-IN END (part two): the third cut ends the fight at once. Part three hangs the banner here instead.
    if (e.hp <= 1) killEnemy(c, e)
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
