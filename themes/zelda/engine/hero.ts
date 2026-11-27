/**
 * The hero: movement, the contextual A button (talk / read / open / use an
 * exit / lift / throw / sword), the charged spin, B items, block pushing,
 * doors, walking out of a door, and the tiles underfoot.
 */
import type { Dir, ExitSpot, GameState, Input, TileChar, ToolId, UseItem, World } from '../types'
import {
  ARC_REACH, B_ITEMS, BUFFER_A, CARRY_SPEED, CHAIN_CANCEL, CHARGE_SPEED, CHARGE_TIME, COMBO, COMBO_WINDOW, HERO_ACCEL, HERO_R,
  HERO_SPEED, HOP, LIFT_TIME, LUNGE_TIME, PSI_SPEED, PUSH_DELAY, ROLL_CANCEL, ROLL_COOLDOWN, ROLL_DIST, ROLL_TIME, SPIN_REACH,
  SPIN_TIME, SWING_COOLDOWN, SWORD_ARC, SWORD_REACH, TALK_REST, TEMPEST_WINDOW, THROW_SPEED, WINDUP,
} from '../types'
import { aPlan, type AThing } from './action'
import { echoBlade, echoOnTile, setEcho } from './echo'
import { TILE_INFO, isViewBlock } from '../world/tiles'
import { acquire, collectDrop, hitEnemy, hurtHero, rollDrop, type Ctx, type HitOpts } from './combat'
import { breakShards, enemyActive } from './enemies'
import { addKeys, circleBlocked, condMet, floodRun, hasBigKey, keyCount, has, lineClear, moveCircle, setFlag, setTile, stepClear, tileAt, cellIndex } from './map'
import { fireHook } from './hook'
import { hitPuzzle, iceUnder, pushPuzzle, puzzleFloor, slideHero } from './puzzles/index'
import { isMirror } from '../world/puzzles'
import { isTube } from '../world/tubes'
import { angleDiff, dirAngle, dirVec, nextId, toDir } from './util'
import {
  backflipWanted, canTempest, credit, endMoves, feedArts, hopCut, isArt, mastered, springStops, startBackflip,
  startComet, startFlip, startTempest, stepAfter, stepAir, stepArts, useArt, wallSpring,
} from './moves'

const CORNER_ASSIST = 0.34
/** Stepping out of a door: one tile in this long (a touch slower than a walk). */
export const WALK_OUT_TIME = 0.22
/** The NEW GAME machine before the hero has the blade: no quest, no save. */
const NOTHING_TO_WIPE = 'NEW GAME. NOTHING TO WIPE YET: YOUR QUEST HAS NOT BEGUN.'

export function stepHero(c: Ctx, inp: Input, dt: number) {
  const s = c.s
  const h = s.hero
  h.actT += dt
  if (h.invuln > 0) h.invuln -= dt
  if (h.cooldown > 0) h.cooldown -= dt
  if (h.talkRest > 0) h.talkRest -= dt
  if ((h.rollCool ?? 0) > 0) h.rollCool! -= dt
  if (h.combo && h.combo.t > 0 && !h.swing) h.combo.t -= dt
  stepAfter(h, dt)
  // The art rests, whatever the hero is doing.
  stepArts(c, dt)
  // A roll that something else ended (a shove, a door, a find) leaves no roll behind, nor the other way round.
  if (h.roll && h.act !== 'roll') h.roll = null
  if (!h.roll && h.act === 'roll') h.act = 'idle'
  // The same for the air.
  if (h.air && h.act !== 'air') h.air = null
  if (!h.air && h.act === 'air') h.act = 'idle'
  if (h.auto) { walkOut(c, dt); return }
  // On the end of the hook's chain: stepHook moves him.
  if (s.hook) { h.act = 'hook'; return }

  if (h.act === 'fall') {
    if (h.actT > 0.55) {
      h.x = h.safe.x
      h.y = h.safe.y
      // (A view block may have risen on that spot since: beside it, then.)
      stepClear(c.w, s)
      h.act = 'idle'
      h.actT = 0
      h.invuln = 0
      hurtHero(c, 1, h.x, h.y)
      h.knock = null
    }
    return
  }
  // Presses that cannot act yet wait a moment (BUFFER_A): through a shove, a swing, a roll.
  if ((h.bufA ?? 0) > 0) h.bufA! -= dt
  if (inp.rollPress) h.bufRoll = BUFFER_A
  else if ((h.bufRoll ?? 0) > 0) h.bufRoll! -= dt
  if (h.knock) {
    // A shove (a shield, a gust) brings the hero down out of the air.
    if (h.air) { endMoves(h); h.act = 'idle' }
    if (inp.aPress && s.inv.sword && !h.carry) h.bufA = BUFFER_A
    const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, h.knock.vx * dt, h.knock.vy * dt)
    h.x = r.x
    h.y = r.y
    h.knock.t -= dt
    if (h.knock.t <= 0) { h.knock = null; if (h.act === 'hurt') h.act = 'idle' }
    underfoot(c)
    return
  }
  if (h.act === 'lift') {
    if (h.actT >= LIFT_TIME) { h.act = 'carry'; h.actT = 0 }
    return
  }
  if ((h.act === 'throw' || h.act === 'use') && h.actT > 0.16) h.act = 'idle'

  // --- the air (`moves.ts`) ------------------------------------------------------
  if (h.air) { stepAir(c, inp, dt); return }

  // --- the dodge roll ------------------------------------------------------------
  // Out of the chain with the stick at rest or pulled back, the roll is a back flip.
  if ((h.bufRoll ?? 0) > 0 && canRoll(c)) {
    if (backflipWanted(c, inp)) { h.bufRoll = 0; if (startBackflip(c)) return }
    startRoll(c, inp)
  }
  if (h.roll) {
    // A in the roll: the flip (FLIP CUT); on ice, where the air may not start, the strike waits for its end.
    if (inp.aPress && s.inv.sword && startFlip(c, inp)) return
    if (inp.aPress && s.inv.sword) h.bufA = BUFFER_A
    // The hop straight out of the roll's second half.
    if (inp.bPress && isArt(s.inv.selected) && h.roll.t > 0.12) {
      h.roll = null
      h.rollCool = ROLL_COOLDOWN
      h.act = 'idle'
      useArt(c, inp, s.inv.selected)
      return
    }
    stepRoll(c, inp, dt)
    return
  }

  // --- A button -------------------------------------------------------------
  if (inp.aPress) {
    // (On ice the TEMPEST cannot leave the ground, and the press still ends its window.)
    if (!h.carry && s.inv.sword && !h.spin && iceUnder(c) && canTempest(h)) h.combo = undefined
    // What the press does is `aPlan`'s to say (the touch deck's picture asks it too).
    const a = aPlan(c)
    if (a.do === 'tempest') { startTempest(c, inp); return }
    if (a.do === 'comet') { startComet(c, inp); return }
    // A tap too many after someone's lines: each press starts A's rest again.
    if (a.do === 'rest') h.talkRest = TALK_REST
    // A fresh press talks, reads or opens first; only what is left swings (through the buffer, below).
    if (a.do === 'blade' || a.do === 'rest') { if (s.inv.sword) h.bufA = BUFFER_A }
    else if (a.do === 'throw') throwCarried(c)
    else useThing(c, a)
    // Talking, reading or an item-get pose freezes the rest of the step.
    if (s.mode !== 'play') { h.bufA = 0; return }
  }
  // Charge while A stays held after a swing; release for the spin.
  if (h.charge >= 0) {
    if (inp.a && s.inv.sword && !h.carry) {
      if (!h.swing) {
        const before = h.charge
        h.charge += dt
        if (before < CHARGE_TIME && h.charge >= CHARGE_TIME) c.ev.push({ type: 'charged' })
      }
    } else {
      if (h.charge >= CHARGE_TIME && !h.swing) startSpin(c)
      h.charge = -1
    }
  }

  // --- B item + cycling -------------------------------------------------------
  if (inp.cycle) cycleItem(c)
  // (The hop may cut a hit of the chain short, as the roll may.)
  const cuts = !!h.swing && isArt(s.inv.selected) && h.swing.t / swingDur(h.swing) >= ROLL_CANCEL
  if (inp.bPress && !h.carry && !h.spin && (!h.swing || cuts)) useItem(c, inp)
  if (h.air) return

  if (h.swing) stepSwing(c, inp, dt)
  if (h.spin) stepSpin(c, dt)
  // The press waiting in the buffer: the next hit of the chain, from CHAIN_CANCEL into the one before
  // (never cutting the finisher short), or a fresh swing once the blade is free.
  if ((h.bufA ?? 0) > 0 && s.inv.sword && !h.carry && !h.spin && h.cooldown <= 0) {
    const sw = h.swing
    if (!sw || (sw.n !== undefined && sw.n < 2 && sw.t / swingDur(sw) >= CHAIN_CANCEL)) { h.bufA = 0; startSwing(c, inp) }
  }

  // --- movement ---------------------------------------------------------------
  const charging = h.charge > 0.12
  let speed = h.carry ? CARRY_SPEED : charging ? CHARGE_SPEED : HERO_SPEED
  if (h.swing) speed *= 0.25
  if (h.spin) speed = 0
  let mx = inp.move.x
  let my = inp.move.y
  const mag = Math.hypot(mx, my)
  if (mag > 1) { mx /= mag; my /= mag }
  const moving = mag > 0.08
  if (moving && !h.swing && !h.spin && !charging) { h.dir = faceFor(h.dir, mx, my); h.aim = Math.atan2(my, mx) }

  let blockedAhead = false
  // On ice the hero slides (`puzzles/`); null: ordinary ground.
  // The step into a blow of the chain moves him on its own (`lunge`).
  const lunging = lunge(c, dt)
  const slid = lunging ? null : slideHero(c, mx, my, moving, dt)
  if (slid) blockedAhead = slid.blocked
  else if (lunging) {
    // (Moved along the blow.)
  } else if (moving && speed > 0) {
    // Up to speed in a few hundredths of a second from a stand; a turn keeps the pace; a stop is at once.
    const sp = Math.min(speed, Math.hypot(h.vx, h.vy) + HERO_ACCEL * dt)
    const dx = mx * sp * dt
    const dy = my * sp * dt
    const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, dx, dy)
    let nx = r.x
    let ny = r.y
    // Corner assist: a mostly-straight walk into a tile edge slips round it.
    if (r.hitX && Math.abs(my) < 0.35) {
      const slip = cornerSlip(c, h.x, h.y, Math.sign(dx), 0)
      if (slip !== 0) ny += Math.sign(slip) * Math.min(Math.abs(slip), sp * dt)
    }
    if (r.hitY && Math.abs(mx) < 0.35) {
      const slip = cornerSlip(c, h.x, h.y, 0, Math.sign(dy))
      if (slip !== 0) nx += Math.sign(slip) * Math.min(Math.abs(slip), sp * dt)
    }
    if (!circleBlocked(c.w, s.map, nx, ny, HERO_R)) { h.x = nx; h.y = ny } else { h.x = r.x; h.y = r.y }
    h.vx = mx * sp
    h.vy = my * sp
    blockedAhead = (r.hitX && Math.abs(mx) > 0.7) || (r.hitY && Math.abs(my) > 0.7)
    h.walkT += dt * (sp / HERO_SPEED)
  } else {
    h.vx = 0
    h.vy = 0
  }

  // Pushing blocks and bumping locked doors.
  if (blockedAhead && !h.carry && !h.swing && !h.spin) {
    const v = dirVec(h.dir)
    const tx = Math.floor(h.x + v.x * (HERO_R + 0.2))
    const ty = Math.floor(h.y + v.y * (HERO_R + 0.2))
    const t = tileAt(s.map, tx, ty)
    if (t === 'b' || isMirror(t)) {
      h.push += dt
      if (h.push >= PUSH_DELAY) { tryPush(c, tx, ty, h.dir); h.push = 0 }
    } else h.push = 0
    if ((t === 'L' && keyCount(s) > 0) || (t === 'K' && hasBigKey(s))) unlockDoor(c, tx, ty, t)
  } else h.push = 0

  if (!h.swing && !h.spin && h.act !== 'throw' && h.act !== 'use') {
    h.act = h.carry ? 'carry' : h.push > 0.08 ? 'push' : moving ? 'walk' : 'idle'
  }
  underfoot(c)
  collect(c)
}

/** The short walk out of a door after spawning on a `Spot.out` entry; input waits. */
function walkOut(c: Ctx, dt: number) {
  const s = c.s
  const h = s.hero
  const a = h.auto!
  const v = dirVec(a.dir)
  const left = Math.max(0, (a.x - h.x) * v.x + (a.y - h.y) * v.y)
  const d = Math.min(left, dt / WALK_OUT_TIME)
  const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, v.x * d, v.y * d)
  h.x = r.x
  h.y = r.y
  h.dir = a.dir
  h.act = 'walk'
  h.walkT += dt * (1 / WALK_OUT_TIME / HERO_SPEED)
  h.vx = v.x / WALK_OUT_TIME
  h.vy = v.y / WALK_OUT_TIME
  a.t -= dt
  // Done on arrival, or when something (an NPC) blocks the way and time runs out.
  if (left - d > 1e-6 && a.t > 0) return
  h.auto = null
  h.act = 'idle'
  h.actT = 0
  h.vx = 0
  h.vy = 0
  h.safe = { x: h.x, y: h.y }
  if (a.intro && c.w.intro) openDialog(c, c.w.intro.lines, c.w.intro.who ?? null)
}

/** Keep facing along an axis the stick still pushes (diagonals don't flicker). */
function faceFor(cur: Dir, mx: number, my: number): Dir {
  const v = dirVec(cur)
  if (mx * v.x + my * v.y > 0.38) return cur
  return toDir(mx, my, cur)
}

function cornerSlip(c: Ctx, x: number, y: number, sx: number, sy: number): number {
  for (const off of [0.08, 0.16, 0.24, CORNER_ASSIST]) {
    for (const sgn of [1, -1]) {
      const px = sx === 0 ? x + off * sgn : x
      const py = sy === 0 ? y + off * sgn : y
      if (!circleBlocked(c.w, c.s.map, px, py, HERO_R) && !circleBlocked(c.w, c.s.map, px + sx * 0.06, py + sy * 0.06, HERO_R)) return off * sgn
    }
  }
  return 0
}

// ---------------------------------------------------------------------------
// Tiles underfoot, warps, pickups
// ---------------------------------------------------------------------------

export function underfoot(c: Ctx) {
  const s = c.s
  const h = s.hero
  const t = tileAt(s.map, Math.floor(h.x), Math.floor(h.y))
  if (t === 'O' && c.info.def.below) {
    // A hole: down to the floor below, landing on the same spot.
    h.act = 'fall'
    h.actT = 0
    h.swing = null
    h.spin = null
    h.roll = null
    endMoves(h)
    h.charge = -1
    h.carry = null
    s.mode = 'warp'
    s.warp = { t: 0, to: c.info.def.below, entry: '', swapped: false, at: { x: h.x, y: h.y }, drop: true }
    c.ev.push({ type: 'fall' })
    return
  }
  stepOnGlyph(c)
  // Out in the open a fall puts you back where you last stood clear of the edge.
  if (c.info.def.kind === 'overworld' && t !== 'O' && !h.knock) {
    const edge = [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]].some(([dx, dy]) => tileAt(s.map, Math.floor(h.x + dx!), Math.floor(h.y + dy!)) === 'O')
    if (!edge) h.safe = { x: h.x, y: h.y }
  }
  if (t === 'O') {
    h.act = 'fall'
    h.actT = 0
    h.swing = null
    h.spin = null
    h.roll = null
    endMoves(h)
    h.charge = -1
    h.carry = null
    c.ev.push({ type: 'fall' })
    return
  }
  if (t === 'x' && h.invuln <= 0) hurtHero(c, 1, h.x - h.vx * 0.1, h.y - h.vy * 0.1 + 0.01)
  // Crystal blocks that rose under the hero become solid once left.
  if (s.map.pending.length) s.map.pending = s.map.pending.filter(i => circleOnTileIdx(c, i))
}

function circleOnTileIdx(c: Ctx, i: number) {
  const m = c.s.map
  const tx = i % m.w
  const ty = Math.floor(i / m.w)
  const h = c.s.hero
  const cx = Math.max(tx, Math.min(h.x, tx + 1))
  const cy = Math.max(ty, Math.min(h.y, ty + 1))
  return (h.x - cx) ** 2 + (h.y - cy) ** 2 < HERO_R * HERO_R
}

function collect(c: Ctx) {
  const s = c.s
  const h = s.hero
  const m = s.map
  for (let i = m.drops.length - 1; i >= 0; i--) {
    const d = m.drops[i]!
    if (d.t < 0.25) continue
    if (Math.hypot(d.x - h.x, d.y - h.y) < HERO_R + 0.4) {
      m.drops.splice(i, 1)
      collectDrop(c, d.kind)
    }
  }
  for (let i = 0; i < m.pickups.length; i++) {
    const p = m.pickups[i]!
    if (p.hidden || p.shop) continue
    if (Math.hypot(p.x - h.x, p.y - h.y) < HERO_R + 0.45) {
      m.pickups.splice(i, 1)
      setFlag(s, `took:${p.id}`)
      acquire(c, p.item)
      return
    }
  }
}

// ---------------------------------------------------------------------------
// A: interaction
// ---------------------------------------------------------------------------

/** Do what `aPlan` found in front of the hero (`action.ts` decides; this only acts). */
function useThing(c: Ctx, a: AThing) {
  const s = c.s
  const h = s.hero
  switch (a.do) {
    case 'luna': {
      const L = s.luna!
      openDialog(c, a.lines, 'luna', a.set ? { set: [a.set] } : null)
      L.dir = toDir(h.x - L.x, h.y - L.y, L.dir)
      c.ev.push({ type: 'talk' })
      return
    }
    case 'npc':
      talkTo(c, a.npc.id)
      a.npc.dir = toDir(h.x - a.npc.x, h.y - a.npc.y, a.npc.dir)
      return
    case 'exit': {
      const { exit, lines } = a
      if ('reset' in exit.to) {
        // The NEW GAME machine: nothing to wipe before the blade.
        if (!s.inv.sword) openDialog(c, [NOTHING_TO_WIPE], null)
        else if (lines) openDialog(c, lines, null, { startOver: true })
        else c.ev.push({ type: 'startOver' })
      } else if ('panel' in exit.to) {
        // The login console, the NEW LOOK stall, the newsstand: the shell opens its panel over the world, the hero stays put.
        c.ev.push({ type: 'panel', id: exit.id, panel: exit.to.panel })
      } else if (lines) openDialog(c, lines, null, { exit: { id: exit.id, to: exit.to } })
      else beginExit(c, exit)
      return
    }
    case 'words': openDialog(c, a.lines, null); return
    case 'psi': psiPush(c, a.tx, a.ty, h.dir); return
    case 'lever': throwLever(c, a.tx, a.ty); return
    case 'part': hitPuzzle(c, a.tx, a.ty, a.t); return
    case 'chest':
      setFlag(s, `chest:${a.id}`)
      s.map.version++
      c.ev.push({ type: 'chest', x: a.tx + 0.5, y: a.ty + 0.5 })
      acquire(c, a.item)
      return
    case 'ware': buy(c, a.id); return
    case 'lift':
      setTile(s.map, a.tx, a.ty, '.')
      h.carry = a.what
      h.act = 'lift'
      h.actT = 0
      h.charge = -1
      c.ev.push({ type: 'lift' })
      return
    case 'lock':
      if (a.key) unlockDoor(c, a.tx, a.ty, a.t)
      else openDialog(c, [a.t === 'L' ? 'LOCKED. A SMALL KEY WOULD OPEN IT.' : 'A GREAT LOCK. ONLY THE BIG KEY FITS.'], null)
  }
}

function talkTo(c: Ctx, id: string) {
  const s = c.s
  for (const m of c.info.marks) {
    const e = m.ent
    if (e.t !== 'npc' || e.id !== id) continue
    for (const br of e.talk) {
      if (!condFor(c, br.when)) continue
      // A gift is given once: per person and item, and per step where the branch sets a flag (Gunn pays a heart
      // piece for the lamp and another for the sign). A save from before the step key counts a step whose flag it holds as paid.
      const got = `got:${id}:${br.give}`
      const step = br.set ? `${got}:${br.set}` : got
      const paid = has(s, step) || (has(s, got) && (!br.set || has(s, br.set)))
      const give = br.give && !paid ? br.give : undefined
      openDialog(c, br.lines, e.look, { give, set: [br.set, ...(give ? [got, step] : [])].filter((x): x is string => !!x), clear: br.clear ? [br.clear] : undefined, panel: br.panel ? { id, panel: br.panel } : undefined })
      if (br.ask) s.dialog!.ask = br.ask
      c.ev.push({ type: 'talk' })
      return
    }
  }
}

function condFor(c: Ctx, cond: import('../types').Cond | undefined) {
  return condMet(c.s, c.w, cond, -1)
}

export function openDialog(c: Ctx, lines: string[], who: string | null, after: import('../types').Dialog['after'] = null) {
  const s = c.s
  s.dialog = { lines, line: 0, chars: 0, who, after, choice: 0, held: true }
  s.mode = 'dialog'
  const h = s.hero
  h.swing = null
  h.roll = null
  endMoves(h)
  h.bufA = 0
  h.charge = -1
  if (h.act === 'walk' || h.act === 'push') h.act = 'idle'
}

/** Start the door fade that leaves the game through an exit (see game.ts `warp`). */
export function beginExit(c: Ctx, exit: Pick<ExitSpot, 'id' | 'to'>) {
  const s = c.s
  const h = s.hero
  s.mode = 'warp'
  s.warp = { t: 0, to: s.map.id, entry: '', swapped: false, exit: { id: exit.id, to: exit.to } }
  h.swing = null
  h.spin = null
  h.roll = null
  endMoves(h)
  h.charge = -1
  h.vx = 0
  h.vy = 0
  if (h.act !== 'walk') h.act = 'idle'
  c.ev.push({ type: 'warp' })
}

function buy(c: Ctx, id: string) {
  const s = c.s
  const p = s.map.pickups.find(q => q.id === id)
  if (!p || !p.shop) return
  const price = p.shop.price
  const full =
    (p.item === 'bombs5' && (!s.inv.bombBag || s.inv.bombs >= 12)) ||
    (p.item === 'heart' && s.hero.hp >= s.hero.maxHp)
  if (full) {
    openDialog(c, [p.item === 'bombs5' && !s.inv.bombBag ? "VENDOR: YOU'LL NEED A BOMB BAG FOR THOSE, FRIEND." : 'VENDOR: YOU ARE ALREADY FULL UP.'], 'vendor')
    c.ev.push({ type: 'buy', ok: false })
    return
  }
  if (s.inv.bits < price) {
    openDialog(c, [`VENDOR: THAT'S ${price} BITS. COME BACK RICHER.`], 'vendor')
    c.ev.push({ type: 'buy', ok: false })
    return
  }
  s.inv.bits -= price
  if (p.shop.once) {
    setFlag(s, `took:${p.id}`)
    s.map.pickups = s.map.pickups.filter(q => q !== p)
  }
  c.ev.push({ type: 'buy', ok: true })
  acquire(c, p.item)
}

function unlockDoor(c: Ctx, tx: number, ty: number, t: TileChar) {
  const s = c.s
  const m = s.map
  const run = floodRun(m.tiles, m.w, m.h, ty * m.w + tx, t)
  if (t === 'L') addKeys(s, -1)
  for (const i of run) {
    m.tiles[i] = '.'
    setFlag(s, `door:${m.id}:${i}`)
  }
  m.version++
  c.ev.push({ type: 'unlock', x: tx + 0.5, y: ty + 0.5 })
}

// ---------------------------------------------------------------------------
// Sword
// ---------------------------------------------------------------------------

function startSwing(c: Ctx, inp: Input) {
  const s = c.s
  const h = s.hero
  // Read the stick afresh for every hit: the chain can turn between blows.
  const mx = inp.move.x
  const my = inp.move.y
  if (Math.hypot(mx, my) > 0.08) { h.dir = faceFor(h.dir, mx, my); h.aim = Math.atan2(my, mx) }
  if (inp.autoFace && Math.hypot(mx, my) < 0.1) {
    let best: { d: number; dir: Dir; a: number } | null = null
    for (const e of s.map.enemies) {
      if (!enemyActive(c, e)) continue
      const d = Math.hypot(e.x - h.x, e.y - h.y)
      if (d < SWORD_REACH + e.r + 0.6 && (!best || d < best.d)) best = { d, dir: toDir(e.x - h.x, e.y - h.y, h.dir), a: Math.atan2(e.y - h.y, e.x - h.x) }
    }
    if (best) { h.dir = best.dir; h.aim = best.a }
  }
  // Out of a hop, the HOP CUT: the hit springs back in at the foe before it cuts (`moves.ts`).
  const hc = hopCut(c, inp)
  if (hc) { h.dir = toDir(Math.cos(hc.a), Math.sin(hc.a), h.dir); h.aim = hc.a }
  // The next hit of the chain while one is under way or just done; else its first.
  const prev = h.swing?.n ?? (h.combo && h.combo.t > 0 ? h.combo.n : undefined)
  const n = (prev === undefined ? 0 : (prev + 1) % 3) as 0 | 1 | 2
  const aim = aimOf(h)
  h.swing = { t: 0, dir: h.dir, a: aim, hit: [], n, side: n === 1 ? -1 : 1 }
  if (hc) Object.assign(h.swing, { t: -hc.dist / HOP.speed, spring: hc.dist, ...(hc.crit ? { crit: true } : {}) })
  h.combo = { n, t: 0 }
  h.act = 'swing'
  h.actT = 0
  h.charge = 0
  c.ev.push({ type: 'swing', n, ...(hc ? { spring: { x: h.x, y: h.y, a: h.swing.a!, d: hc.dist } } : {}) })
}

/** How long a swing lasts: its hit of the chain's time. */
export function swingDur(sw: { n: 0 | 1 | 2 }): number {
  return COMBO[sw.n]!.time
}

/**
 * Where the hero is headed, exactly: `aim` while it still agrees with the way they face (within a quarter
 * turn of `dir`), and the facing itself once something else has turned them (a door, a talk, a shove).
 */
export function aimOf(h: { dir: Dir; aim?: number }): number {
  const base = dirAngle(h.dir)
  if (h.aim === undefined) return base
  const d = Math.atan2(Math.sin(h.aim - base), Math.cos(h.aim - base))
  return Math.abs(d) < Math.PI / 2 - 0.01 ? h.aim : base
}

/**
 * Angle of the blade at swing progress p (0..1): sweeps across the way the swing was aimed. A hit of the chain
 * (`n`) first draws back a touch over WINDUP, then cuts across its own arc, fast and settling, the way `side`
 * says (the second hit comes back the other way). Without `n` the sweep is the plain one, as it always was.
 */
export function swingAngle(sw: { dir: Dir; a?: number; n?: number; side?: number }, p: number): number {
  const base = sw.a ?? dirAngle(sw.dir)
  if (sw.n === undefined) {
    const e = 1 - (1 - Math.min(1, p)) ** 2
    return base - SWORD_ARC / 2 + SWORD_ARC * e
  }
  const side = sw.side ?? 1
  const arc = COMBO[sw.n as 0 | 1 | 2]!.arc
  const q = Math.max(0, Math.min(1, (p - WINDUP) / (1 - WINDUP)))
  const e = p < WINDUP ? -0.12 * (Math.max(0, p) / WINDUP) : 1 - (1 - q) ** 3
  return base - (side * arc) / 2 + side * arc * e
}

function stepSwing(c: Ctx, inp: Input, dt: number) {
  const h = c.s.hero
  const sw = h.swing!
  const dur = swingDur(sw)
  // A stick that lands a moment after A still turns the blow.
  if (sw.n !== undefined && sw.t < 0.05) {
    const mx = inp.move.x
    const my = inp.move.y
    if (Math.hypot(mx, my) > 0.3) {
      const a = Math.atan2(my, mx)
      const d = toDir(mx, my, sw.dir)
      // (Only toward the way the blow already faces, or across it: a turn right round is the next hit's.)
      if (angleDiff(a, sw.a ?? dirAngle(sw.dir)) < Math.PI * 0.55) { sw.a = a; sw.dir = d; h.dir = d; h.aim = a }
    }
  }
  const p0 = sw.t / dur
  sw.t += dt
  const p1 = Math.min(1, sw.t / dur)
  const arc = c.s.inv.arc
  const hit = sw.n === undefined ? null : COMBO[sw.n]!
  // A mastered TRIPLE CUT's finisher bites one harder, and a mastered HOP CUT.
  const more = (sw.n === 2 && mastered(c.s, 'triple') ? 1 : 0) + (sw.spring !== undefined && mastered(c.s, 'hopcut') ? 1 : 0)
  const dmg = (hit ? hit.dmg + more : 1) * (arc ? 2 : 1)
  const reach = (arc ? ARC_REACH : SWORD_REACH) + (sw.n === 2 ? 0.1 : 0)
  const opt: HitOpts | undefined = hit ? { knock: hit.knock, stagger: hit.stagger, stop: hit.stop, chain: sw.n! < 2, finisher: sw.n === 2, ...(sw.crit ? { crit: true } : {}) } : undefined
  // Sample the sweep between the last and this step (the pull-back at the start cuts nothing).
  for (let k = 0; k <= 2; k++) {
    const p = p0 + ((p1 - p0) * k) / 2
    if (hit && p < WINDUP) continue
    const n = bladeHits(c, swingAngle(sw, p), reach, dmg, 'sword', sw.hit, opt)
    echoBlade(c, { of: sw, lap: sw.hit, kind: 'swing', n: sw.n, base: sw.a ?? dirAngle(sw.dir), dur: dur * (1 - WINDUP) }, swingAngle(sw, p), reach, dmg, opt)
    if (n > 0 && sw.n === 2 && !sw.landed) { sw.landed = true; credit(c, 'triple') }
    if (n > 0 && sw.spring !== undefined && !sw.sprung) { sw.sprung = true; credit(c, 'hopcut') }
  }
  if (sw.t >= dur) {
    h.swing = null
    h.act = 'idle'
    if (sw.n === undefined) { h.cooldown = SWING_COOLDOWN; return }
    // The chain goes on if A comes again soon; after the finisher it starts over, after a breath.
    // (After the finisher, a short window stays open: A there is the TEMPEST, `moves.ts`.)
    h.combo = { n: sw.n, t: sw.n === 2 ? TEMPEST_WINDOW : COMBO_WINDOW }
    h.cooldown = COMBO[sw.n]!.cool
  }
}

/**
 * The step forward at the start of a hit of the chain (LUNGE_TIME), along the blow. It stops short of a foe
 * already within half the blade's reach ahead, of the edge of a pit or spikes, and of ice (on ice, or onto it,
 * the swing stays where it is and the slide keeps him). True while it holds him.
 *
 * The HOP CUT's spring (`sw.spring`, while its clock is below 0) goes the same way, farther and faster; it stops
 * short of the same things and (in a dungeon) of the room's edge, and where it stops the cut begins.
 */
function lunge(c: Ctx, dt: number): boolean {
  const s = c.s
  const h = s.hero
  const sw = h.swing
  if (sw?.spring !== undefined && sw.t < 0) return spring(c, dt)
  if (!sw || sw.n === undefined || sw.t >= LUNGE_TIME) return false
  if (iceUnder(c)) return false
  const a = sw.a ?? dirAngle(sw.dir)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  if (iceUnder(c, h.x + ca * (HERO_R + 0.1), h.y + sa * (HERO_R + 0.1))) return false
  h.vx = 0
  h.vy = 0
  const reach = (s.inv.arc ? ARC_REACH : SWORD_REACH) * 0.55
  for (const e of s.map.enemies) {
    if (!enemyActive(c, e)) continue
    const dx = e.x - h.x
    const dy = e.y - h.y
    if (dx * ca + dy * sa > 0 && Math.hypot(dx, dy) < reach + e.r) return true
  }
  const v = COMBO[sw.n]!.lunge / LUNGE_TIME
  const ahead = tileAt(s.map, Math.floor(h.x + ca * (HERO_R + 0.3)), Math.floor(h.y + sa * (HERO_R + 0.3)))
  if (ahead === 'O' || ahead === 'x') return true
  const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, ca * v * dt, sa * v * dt)
  h.x = r.x
  h.y = r.y
  h.vx = ca * v
  h.vy = sa * v
  return true
}

/** The HOP CUT's spring back in: one step of it; true while it holds him. */
function spring(c: Ctx, dt: number): boolean {
  const s = c.s
  const h = s.hero
  const sw = h.swing!
  const a = sw.a ?? dirAngle(sw.dir)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  h.vx = 0
  h.vy = 0
  const stop = () => { sw.t = 0; return true }
  const reach = (s.inv.arc ? ARC_REACH : SWORD_REACH) * 0.55
  for (const e of s.map.enemies) {
    if (!enemyActive(c, e)) continue
    const dx = e.x - h.x
    const dy = e.y - h.y
    if (dx * ca + dy * sa > 0 && Math.hypot(dx, dy) < reach + e.r) return stop()
  }
  const step = Math.min(HOP.speed * dt, -sw.t * HOP.speed)
  const er = HERO_R + 0.06
  if (iceUnder(c) || springStops(c, h.x + ca * (er + step), h.y + sa * (er + step))) return stop()
  if (c.info.def.kind === 'dungeon' && cellIndex(c.info, h.x + ca * (er + step), h.y + sa * (er + step)) !== cellIndex(c.info, h.x, h.y)) return stop()
  const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, ca * step, sa * step)
  h.x = r.x
  h.y = r.y
  h.vx = ca * HOP.speed
  h.vy = sa * HOP.speed
  if (r.hitX || r.hitY) return stop()
  return true
}

// ---------------------------------------------------------------------------
// The dodge roll
// ---------------------------------------------------------------------------

/** May the hero roll now? With the blade only (before it the town stays quiet), and nothing in his hands or under way. */
function canRoll(c: Ctx): boolean {
  const s = c.s
  const h = s.hero
  if (!s.inv.sword || h.carry || h.spin || h.roll || h.air || (h.rollCool ?? 0) > 0) return false
  if (h.act === 'lift' || h.act === 'get' || h.act === 'fall' || h.act === 'dead' || h.act === 'hurt') return false
  // Not on ice, where the hero slides (standing still on it included: a roll would steer him off his lane).
  if (iceUnder(c)) return false
  const sw = h.swing
  return !sw || sw.t / swingDur(sw) >= ROLL_CANCEL
}

function startRoll(c: Ctx, inp: Input) {
  const h = c.s.hero
  let mx = inp.move.x
  let my = inp.move.y
  const mag = Math.hypot(mx, my)
  if (mag > 0.2) { mx /= mag; my /= mag } else { const a = aimOf(h); mx = Math.cos(a); my = Math.sin(a) }
  const v0 = ROLL_DIST / (ROLL_TIME * 0.7)
  h.dir = toDir(mx, my, h.dir)
  h.aim = Math.atan2(my, mx)
  h.roll = { t: 0, vx: mx * v0, vy: my * v0 }
  h.slipped = false
  h.bufRoll = 0
  h.swing = null
  h.charge = -1
  h.push = 0
  h.act = 'roll'
  h.actT = 0
  c.ev.push({ type: 'roll' })
}

function stepRoll(c: Ctx, inp: Input, dt: number) {
  const s = c.s
  const h = s.hero
  const r0 = h.roll!
  r0.t += dt
  const p = Math.min(1, r0.t / ROLL_TIME)
  // A little steering along the way.
  const mx = inp.move.x
  const my = inp.move.y
  const v0 = Math.hypot(r0.vx, r0.vy) || 1
  if (Math.hypot(mx, my) > 0.3) {
    const want = Math.atan2(my, mx)
    const cur = Math.atan2(r0.vy, r0.vx)
    const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur))
    const turn = Math.max(-4 * dt, Math.min(4 * dt, d))
    r0.vx = Math.cos(cur + turn) * v0
    r0.vy = Math.sin(cur + turn) * v0
  }
  const k = 1 - 0.6 * p
  const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, r0.vx * k * dt, r0.vy * k * dt)
  h.x = r.x
  h.y = r.y
  h.vx = r0.vx * k
  h.vy = r0.vy * k
  h.walkT += dt
  // Into a wall: the WALL SPRING kicks off it (`moves.ts`).
  if ((r.hitX || r.hitY) && wallSpring(c, r.hitX, r.hitY)) return
  // Onto ice the roll ends at its edge: the slide takes him from there, along its lanes.
  if (iceUnder(c)) r0.t = ROLL_TIME
  underfoot(c)
  if (!h.roll) return
  collect(c)
  if (s.mode !== 'play' || !h.roll) return
  if (r0.t >= ROLL_TIME) {
    h.roll = null
    h.rollCool = ROLL_COOLDOWN
    h.act = 'idle'
    h.vx = 0
    h.vy = 0
    // A press of A in the roll's last moments: the strike comes straight out of it.
    if ((h.bufA ?? 0) > 0 && s.inv.sword) { h.bufA = 0; h.combo = undefined; startSwing(c, inp) }
  }
}

function startSpin(c: Ctx) {
  const h = c.s.hero
  h.spin = { t: 0, hit: [] }
  h.act = 'spin'
  h.actT = 0
  c.ev.push({ type: 'spin' })
}

function stepSpin(c: Ctx, dt: number) {
  const h = c.s.hero
  const sp = h.spin!
  const p0 = sp.t / SPIN_TIME
  sp.t += dt
  const p1 = Math.min(1, sp.t / SPIN_TIME)
  const base = dirAngle(h.dir)
  for (let k = 0; k <= 3; k++) {
    const a = base + Math.PI * 2 * (p0 + ((p1 - p0) * k) / 3)
    const dmg = (c.s.inv.arc ? 3 : 2) + (mastered(c.s, 'whirl') ? 1 : 0)
    const n = bladeHits(c, a, SPIN_REACH + (c.s.inv.arc ? 0.2 : 0), dmg, 'spin', sp.hit, SPIN_HIT)
    echoBlade(c, { of: sp, lap: sp.hit, kind: 'spin', base, dur: SPIN_TIME }, a, SPIN_REACH + (c.s.inv.arc ? 0.2 : 0), dmg, SPIN_HIT)
    if (n > 0 && !sp.landed) { sp.landed = true; credit(c, 'whirl') }
  }
  if (sp.t >= SPIN_TIME) {
    h.spin = null
    h.cooldown = SWING_COOLDOWN
    h.combo = undefined
    h.act = 'idle'
  }
}

/** The spin's blows: a hard shove and a heavy stop. */
const SPIN_HIT: HitOpts = { knock: 1.2, stop: 55 }

/**
 * Everything the blade at angle `a` touches: enemies, shards, pellets, tiles. Returns how many foes it struck. The
 * blade is the hero's, or with `src` 'echo' the echo's, struck from `from` (`engine/echo.ts`): that one also
 * shatters a pot it sweeps, and feeds no art.
 */
export function bladeHits(
  c: Ctx, a: number, reach: number, dmg: number, src: 'sword' | 'spin' | 'echo', hit: string[], opt?: HitOpts,
  from: { x: number; y: number; dir: Dir } = c.s.hero,
): number {
  const s = c.s
  const h = from
  let struck = 0
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  for (const e of s.map.enemies) {
    if (!enemyActive(c, e) || hit.includes(e.id)) continue
    const dx = e.x - h.x
    const dy = e.y - h.y
    const d = Math.hypot(dx, dy)
    if (d > reach + e.r) continue
    const off = angleDiff(Math.atan2(dy, dx), a)
    // Close enemies count if the blade passes within their radius.
    const perp = Math.abs(dx * sa - dy * ca)
    if ((off < 0.5 || perp < e.r + 0.15) && dx * ca + dy * sa > -0.2 && lineClear(c.w, s.map, h.x, h.y, e.x, e.y)) {
      hit.push(e.id)
      // A landed blow shortens every art's rest (`moves.ts`).
      if (hitEnemy(c, e, dmg, h.x, h.y, src, opt)) { struck++; if (src !== 'echo') feedArts(s) }
    }
  }
  for (let r = 0.6; r <= reach; r += 0.3) breakShards(c, h.x + ca * r, h.y + sa * r, 0.15)
  // Reflect pellets.
  for (const p of s.map.projectiles) {
    if (!p.reflect || p.friendly) continue
    const dx = p.x - h.x
    const dy = p.y - h.y
    if (Math.hypot(dx, dy) < reach + 0.2 && angleDiff(Math.atan2(dy, dx), a) < 0.7) {
      p.vx = -p.vx * 1.3
      p.vy = -p.vy * 1.3
      p.friendly = true
      p.t = 0
      c.ev.push({ type: 'reflect', x: p.x, y: p.y })
    }
  }
  // Tiles along the blade. (A lumen tube turns only straight ahead: a sweep over a board turns one, the one faced.)
  const fv = dirVec(h.dir)
  const front = { x: Math.floor(h.x + fv.x * 0.8), y: Math.floor(h.y + fv.y * 0.8) }
  for (const r of [0.75, reach - 0.1]) {
    const tx = Math.floor(h.x + ca * r)
    const ty = Math.floor(h.y + sa * r)
    const key = `t${tx},${ty}`
    if (hit.includes(key)) continue
    const t = tileAt(s.map, tx, ty)
    if (TILE_INFO[t].cut) {
      hit.push(key)
      cutTile(c, tx, ty, t)
    } else if (t === 'c') {
      hit.push(key)
      toggleCrystal(c, tx, ty)
    } else if (t === 'l') {
      hit.push(key)
      if (s.inv.arc) cutTile(c, tx, ty, t)
      else c.ev.push({ type: 'clank', x: tx + 0.5, y: ty + 0.5 })
    } else if (t === '}') {
      hit.push(key)
      throwLever(c, tx, ty)
    } else if (src === 'echo' && t === 'o') {
      hit.push(key)
      setTile(s.map, tx, ty, '.')
      c.ev.push({ type: 'shatter', x: tx + 0.5, y: ty + 0.5, kind: 'pot' })
      rollDrop(c, tx + 0.5, ty + 0.5, 0.45)
    } else if ((!isTube(t) || (tx === front.x && ty === front.y)) && hitPuzzle(c, tx, ty, t)) hit.push(key)
  }
  return struck
}

export function cutTile(c: Ctx, tx: number, ty: number, t: TileChar) {
  setTile(c.s.map, tx, ty, '.')
  c.ev.push({ type: 'cut', x: tx + 0.5, y: ty + 0.5, tile: t })
  rollDrop(c, tx + 0.5, ty + 0.5, t === '*' ? 0.38 : 0.22)
}

export function toggleCrystal(c: Ctx, tx: number, ty: number) {
  const s = c.s
  const m = s.map
  const cell = cellIndex(c.info, tx + 0.5, ty + 0.5)
  if ((m.crystalCool ?? 0) > 0) return
  m.crystalCool = 0.35
  const group = c.info.def.crystal
  const cur = m.crystalAll ?? m.crystal[cell] ?? 'pink'
  const next = cur === 'pink' ? 'cyan' : 'pink'
  if (group) {
    // One state for the whole group, on every floor: kept in a flag.
    m.crystalAll = next
    if (next === 'cyan') s.flags[`crystal:${group}`] = true
    else delete s.flags[`crystal:${group}`]
  } else m.crystal[cell] = next
  // Blocks rising under the hero wait until he steps off.
  const raise: TileChar = next === 'pink' ? 'P' : 'C'
  const h = s.hero
  for (let y = Math.floor(h.y - 1); y <= Math.floor(h.y + 1); y++) {
    for (let x = Math.floor(h.x - 1); x <= Math.floor(h.x + 1); x++) {
      if (tileAt(m, x, y) !== raise) continue
      const i = y * m.w + x
      if (circleOnTileIdx(c, i) && !m.pending.includes(i)) m.pending.push(i)
    }
  }
  m.version++
  c.ev.push({ type: 'crystal', state: next })
}

// ---------------------------------------------------------------------------
// Carry, throw, push
// ---------------------------------------------------------------------------

function throwCarried(c: Ctx) {
  const s = c.s
  const h = s.hero
  const v = dirVec(h.dir)
  s.map.thrown.push({ id: nextId(s), kind: h.carry!, x: h.x, y: h.y - 0.05, vx: v.x * THROW_SPEED, vy: v.y * THROW_SPEED, z: 0.9, dist: 0 })
  h.carry = null
  h.act = 'throw'
  h.actT = 0
  c.ev.push({ type: 'throw' })
}

function tryPush(c: Ctx, tx: number, ty: number, d: Dir) {
  if (pushPuzzle(c, tx, ty, d)) return
  const s = c.s
  const m = s.map
  const v = dirVec(d)
  const nx = tx + v.x
  const ny = ty + v.y
  const t = tileAt(m, nx, ny)
  if (!(t === '.' || t === ',' || t === '_')) return
  if (m.moving.some(b => b.tx === tx && b.ty === ty)) return
  for (const e of m.enemies) if (!e.dead && Math.floor(e.x) === nx && Math.floor(e.y) === ny) return
  if (echoOnTile(c, nx, ny)) return
  // Stay inside the block's camera room.
  if (cellIndex(c.info, nx + 0.5, ny + 0.5) !== cellIndex(c.info, tx + 0.5, ty + 0.5)) return
  m.tiles[ty * m.w + tx] = '.'
  m.tiles[ny * m.w + nx] = 'b'
  m.version++
  m.moving.push({ id: nextId(s), fx: tx, fy: ty, tx: nx, ty: ny, t: 0 })
  c.ev.push({ type: 'push', x: nx + 0.5, y: ny + 0.5 })
}

// ---------------------------------------------------------------------------
// B items
// ---------------------------------------------------------------------------

/** The B items the hero has, in the cycle's order (`B_ITEMS`: the hook, the disc, bombs, then the hop). */
export function useItems(s: GameState): UseItem[] {
  return B_ITEMS.filter(b => b.owned(s.inv)).map(b => b.id)
}

export function cycleItem(c: Ctx) {
  const inv = c.s.inv
  const owned = useItems(c.s)
  if (!owned.length) return
  const i = inv.selected ? owned.indexOf(inv.selected) : -1
  inv.selected = owned[(i + 1) % owned.length]!
  c.ev.push({ type: 'cycle', item: inv.selected })
}

/** What pressing B does with each thing of `B_ITEMS`; an art does its own (`moves.ts` `useArt`). */
const TOOL_USE: Record<ToolId, (c: Ctx, inp: Input) => void> = {
  hook: c => fireHook(c),
  disc: throwDisc,
  bombs: setBomb,
  echo: c => { setEcho(c) },
}

function useItem(c: Ctx, inp: Input) {
  const sel = c.s.inv.selected
  if (isArt(sel)) useArt(c, inp, sel)
  else if (sel && Object.prototype.hasOwnProperty.call(TOOL_USE, sel)) TOOL_USE[sel](c, inp)
  else if (c.s.inv.sword) c.ev.push({ type: 'error' }) // no buzz for a visitor who has nothing yet
}

function setBomb(c: Ctx) {
  const s = c.s
  const h = s.hero
  if (s.inv.bombs <= 0 || s.map.bombs.length >= 2) { c.ev.push({ type: 'error' }); return }
  const v = dirVec(h.dir)
  let bx = h.x + v.x * 0.7
  let by = h.y + v.y * 0.7
  if (circleBlocked(c.w, s.map, bx, by, 0.2, 'enemy')) { bx = h.x; by = h.y }
  // Not on a view block's tile, up or down: nothing but the hero may be where one rises.
  if (isViewBlock(tileAt(s.map, Math.floor(bx), Math.floor(by)))) { c.ev.push({ type: 'error' }); return }
  s.inv.bombs--
  s.map.bombs.push({ id: nextId(s), x: bx, y: by, t: 0 })
  h.act = 'use'
  h.actT = 0
  c.ev.push({ type: 'bombPlace' })
}

function throwDisc(c: Ctx, inp: Input) {
  const s = c.s
  const h = s.hero
  if (s.disc) return
  let dx = inp.move.x
  let dy = inp.move.y
  const len = Math.hypot(dx, dy)
  if (len < 0.3) { const v = dirVec(h.dir); dx = v.x; dy = v.y } else { dx /= len; dy /= len }
  s.disc = { x: h.x + dx * 0.4, y: h.y + dy * 0.4, vx: dx, vy: dy, t: 0, returning: false, hit: [], carrying: [] }
  h.act = 'use'
  h.actT = 0
  c.ev.push({ type: 'disc' })
}

export function heroInvulnFlash(h: { invuln: number }) {
  return h.invuln > 0
}

export { hurtHero }

// ---------------------------------------------------------------------------
// Levers, psi blocks, letter stones
// ---------------------------------------------------------------------------

/** A hit on a lever: throws it for good and sets its flag. */
export function throwLever(c: Ctx, tx: number, ty: number) {
  const s = c.s
  const flag = c.info.levers.get(ty * s.map.w + tx)
  if (!flag || has(s, flag)) return
  setFlag(s, flag)
  s.map.version++
  s.shake = Math.max(s.shake, 0.15)
  c.ev.push({ type: 'lever', x: tx + 0.5, y: ty + 0.5 })
  c.ev.push({ type: 'secret' })
}

/** Luna slides a psi block along `d` until something stops it (a wall, a block, the room's edge, a foe). */
export function psiPush(c: Ctx, tx: number, ty: number, d: Dir) {
  const s = c.s
  const m = s.map
  const v = dirVec(d)
  const cell = cellIndex(c.info, tx + 0.5, ty + 0.5)
  const free = (t: TileChar) => t === '.' || t === ',' || t === '_' || t === ':' || t === '{' || t === 'i' || t === 'f' || t === 'α' || t === 'θ' || t === 'η' || t === 'σ' || t === 'ψ'
  let x = tx
  let y = ty
  let falls = false
  for (let n = 0; n < 64; n++) {
    const nx = x + v.x
    const ny = y + v.y
    // Into a hole: the block drops to the floor below.
    if (tileAt(m, nx, ny) === 'O' && c.info.def.below) { x = nx; y = ny; falls = true; break }
    if (!free(tileAt(m, nx, ny))) break
    if (c.info.def.kind === 'dungeon' && cellIndex(c.info, nx + 0.5, ny + 0.5) !== cell) break
    if (m.enemies.some(e => !e.dead && Math.floor(e.x) === nx && Math.floor(e.y) === ny)) break
    if (m.npcs.some(n2 => Math.floor(n2.x) === nx && Math.floor(n2.y) === ny)) break
    if (echoOnTile(c, nx, ny)) break
    const h = s.hero
    if (Math.abs(h.x - (nx + 0.5)) < 0.5 + HERO_R && Math.abs(h.y - (ny + 0.5)) < 0.5 + HERO_R) break
    x = nx
    y = ny
  }
  if (s.luna) { s.luna.psi = 0.7; s.luna.dir = toDir(tx + 0.5 - s.luna.x, ty + 0.5 - s.luna.y, s.luna.dir) }
  c.ev.push({ type: 'psi', x: tx + 0.5, y: ty + 0.5 })
  if (x === tx && y === ty) return
  m.tiles[ty * m.w + tx] = puzzleFloor(c, ty * m.w + tx)
  const dist = Math.abs(x - tx) + Math.abs(y - ty)
  const dur = Math.max(0.12, dist / PSI_SPEED)
  if (falls) {
    // It lands on the same spot one floor down, for good.
    setFlag(s, `drop:${c.info.def.below}:${y * m.w + x}`)
    m.moving.push({ id: nextId(s), fx: tx, fy: ty, tx: x, ty: y, t: 0, dur, kind: 'B', falls: true })
    m.version++
    c.ev.push({ type: 'fall' })
    return
  }
  m.tiles[y * m.w + x] = 'B'
  m.version++
  m.moving.push({ id: nextId(s), fx: tx, fy: ty, tx: x, ty: y, t: 0, dur, kind: 'B' })
  // Out in the open a moved block stays moved (the lab's door must stay clear).
  if (c.info.def.kind !== 'dungeon') {
    const key = Object.keys(s.flags).find(f => f.startsWith(`psi:${m.id}:`) && f.endsWith(`:${ty * m.w + tx}`))
    const home = key ? key.split(':')[2] : String(ty * m.w + tx)
    if (key) delete s.flags[key]
    s.flags[`psi:${m.id}:${home}:${y * m.w + x}`] = true
  }
}

/** Stepping onto a letter stone adds its letter; a finished word sets its flag. */
function stepOnGlyph(c: Ctx) {
  const s = c.s
  const m = s.map
  const h = s.hero
  const idx = Math.floor(h.y) * m.w + Math.floor(h.x)
  const ch = c.info.glyphs.get(idx)
  if (ch === undefined) { m.onGlyph = -1; return }
  if (m.onGlyph === idx) return
  m.onGlyph = idx
  const codes = (c.info.def.codes ?? []).filter(k => !has(s, k.flag))
  if (!codes.length) { c.ev.push({ type: 'glyph', x: (idx % m.w) + 0.5, y: Math.floor(idx / m.w) + 0.5, ok: true }); return }
  const next = m.spell + ch
  let ok = true
  if (codes.some(k => k.word.startsWith(next))) { m.spell = next; m.spellTiles.push(idx) } else {
    ok = false
    if (codes.some(k => k.word.startsWith(ch))) { m.spell = ch; m.spellTiles = [idx] } else { m.spell = ''; m.spellTiles = [] }
  }
  c.ev.push({ type: 'glyph', x: (idx % m.w) + 0.5, y: Math.floor(idx / m.w) + 0.5, ok })
  if (!ok) c.ev.push({ type: 'error' })
  const done = codes.find(k => k.word === m.spell)
  if (done) {
    setFlag(s, done.flag)
    m.spell = ''
    m.spellTiles = []
    m.version++
    c.ev.push({ type: 'secret' })
  }
}
