/**
 * The hero: movement, the contextual A button (talk / read / open / use an
 * exit / lift / throw / sword), the charged spin, B items, block pushing,
 * doors, walking out of a door, and the tiles underfoot.
 */
import type { Dir, ExitSpot, Input, TileChar } from '../types'
import {
  ARC_REACH, BEAM_SPEED, CARRY_SPEED, CHARGE_SPEED, CHARGE_TIME, HERO_R, HERO_SPEED, LIFT_TIME, PSI_SPEED, PUSH_DELAY, SPIN_REACH,
  SPIN_TIME, SWING_COOLDOWN, SWING_TIME, SWORD_ARC, SWORD_REACH, THROW_SPEED,
} from '../types'
import { TILE_INFO } from '../world/tiles'
import { acquire, collectDrop, hitEnemy, hurtHero, rollDrop, type Ctx } from './combat'
import { breakShards, enemyActive } from './enemies'
import { addKeys, circleBlocked, condMet, floodRun, hasBigKey, keyCount, has, lineClear, moveCircle, setFlag, setTile, tileAt, cellIndex } from './map'
import { fireHook } from './hook'
import { angleDiff, dirAngle, dirVec, nextId, toDir } from './util'

const CORNER_ASSIST = 0.34
/** Stepping out of a door: one tile in this long (a touch slower than a walk). */
export const WALK_OUT_TIME = 0.22

export function stepHero(c: Ctx, inp: Input, dt: number) {
  const s = c.s
  const h = s.hero
  h.actT += dt
  if (h.invuln > 0) h.invuln -= dt
  if (h.cooldown > 0) h.cooldown -= dt
  if (h.auto) { walkOut(c, dt); return }
  // On the end of the hook's chain: stepHook moves him.
  if (s.hook) { h.act = 'hook'; return }

  if (h.act === 'fall') {
    if (h.actT > 0.55) {
      h.x = h.safe.x
      h.y = h.safe.y
      h.act = 'idle'
      h.actT = 0
      h.invuln = 0
      hurtHero(c, 1, h.x, h.y)
      h.knock = null
    }
    return
  }
  if (h.knock) {
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

  // --- A button -------------------------------------------------------------
  if (inp.aPress) {
    if (h.carry) throwCarried(c)
    else if (!h.swing && !h.spin && !interact(c)) {
      if (s.inv.sword && h.cooldown <= 0) startSwing(c, inp)
    }
    // Talking, reading or an item-get pose freezes the rest of the step.
    if (s.mode !== 'play') return
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
  if (inp.bPress && !h.carry && !h.swing && !h.spin) useItem(c, inp)

  if (h.swing) stepSwing(c, dt)
  if (h.spin) stepSpin(c, dt)

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
  if (moving && !h.swing && !h.spin && !charging) h.dir = faceFor(h.dir, mx, my)

  let blockedAhead = false
  if (moving && speed > 0) {
    const dx = mx * speed * dt
    const dy = my * speed * dt
    const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, dx, dy)
    let nx = r.x
    let ny = r.y
    // Corner assist: a mostly-straight walk into a tile edge slips round it.
    if (r.hitX && Math.abs(my) < 0.35) {
      const slip = cornerSlip(c, h.x, h.y, Math.sign(dx), 0)
      if (slip !== 0) ny += Math.sign(slip) * Math.min(Math.abs(slip), speed * dt)
    }
    if (r.hitY && Math.abs(mx) < 0.35) {
      const slip = cornerSlip(c, h.x, h.y, 0, Math.sign(dy))
      if (slip !== 0) nx += Math.sign(slip) * Math.min(Math.abs(slip), speed * dt)
    }
    if (!circleBlocked(c.w, s.map, nx, ny, HERO_R)) { h.x = nx; h.y = ny } else { h.x = r.x; h.y = r.y }
    h.vx = mx * speed
    h.vy = my * speed
    blockedAhead = (r.hitX && Math.abs(mx) > 0.7) || (r.hitY && Math.abs(my) > 0.7)
    h.walkT += dt * (speed / HERO_SPEED)
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
    if (t === 'b') {
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

function underfoot(c: Ctx) {
  const s = c.s
  const h = s.hero
  const t = tileAt(s.map, Math.floor(h.x), Math.floor(h.y))
  if (t === 'O' && c.info.def.below) {
    // A hole: down to the floor below, landing on the same spot.
    h.act = 'fall'
    h.actT = 0
    h.swing = null
    h.spin = null
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

/** Talk / read / open / buy / lift in front of the hero. False = nothing there. */
function interact(c: Ctx): boolean {
  const s = c.s
  const h = s.hero
  const v = dirVec(h.dir)
  const fx = h.x + v.x * 0.8
  const fy = h.y + v.y * 0.8
  const tx = Math.floor(fx)
  const ty = Math.floor(fy)
  const t = tileAt(s.map, tx, ty)

  // Luna, a step behind — she talks only when nothing is attacking (in a fight, A swings).
  const L = s.luna
  const calm = !s.map.enemies.some(e => enemyActive(c, e) && Math.hypot(e.x - h.x, e.y - h.y) < 8)
  if (L && calm && Math.hypot(L.x - fx, L.y - fy) < 0.75 && c.w.luna) {
    const br = c.w.luna.find(b => condMet(s, c.w, b.when, -1))
    if (br) {
      openDialog(c, br.lines, 'luna', br.set ? { set: [br.set] } : null)
      L.dir = toDir(h.x - L.x, h.y - L.y, L.dir)
      c.ev.push({ type: 'talk' })
      return true
    }
  }
  // NPCs in front (also across a counter).
  for (const n of s.map.npcs) {
    const near = Math.hypot(n.x - fx, n.y - fy) < 0.75
    const across = t === 'n' && Math.hypot(n.x - (h.x + v.x * 1.8), n.y - (h.y + v.y * 1.8)) < 0.8
    if (near || across) { talkTo(c, n.id); n.dir = toDir(h.x - n.x, h.y - n.y, n.dir); return true }
  }
  const idx = ty * s.map.w + tx
  const exit = c.info.exits.get(idx)
  if (exit && !exit.walk) {
    const lines = c.info.exitLines.get(idx)
    if (lines) openDialog(c, lines, null, { exit: { id: exit.id, to: exit.to } })
    else beginExit(c, exit)
    return true
  }
  if (t === 'S') {
    const lines = c.info.signs.get(idx)
    if (lines) { openDialog(c, lines, null); return true }
  }
  if (t === 'B') {
    if (s.luna) psiPush(c, tx, ty, h.dir)
    else openDialog(c, ['A HEAVY BLOCK WITH A MOON CARVED IN IT. IT WON\'T BUDGE.', 'SOMEONE WITH A STRONGER MIND MIGHT MOVE IT.'], null)
    return true
  }
  if (t === '}') {
    if (!has(s, c.info.levers.get(idx) ?? '')) { throwLever(c, tx, ty); return true }
    return false
  }
  if (t === '$') {
    const chest = c.info.chests.get(idx)
    if (chest && !has(s, `chest:${chest.id}`)) {
      setFlag(s, `chest:${chest.id}`)
      s.map.version++
      c.ev.push({ type: 'chest', x: tx + 0.5, y: ty + 0.5 })
      acquire(c, chest.item)
      return true
    }
    return false
  }
  const shop = s.map.pickups.find(p => p.shop && Math.floor(p.x) === tx && Math.floor(p.y) === ty)
  if (shop && shop.shop) {
    buy(c, shop.id)
    return true
  }
  const info = TILE_INFO[t]
  if (info.lift) {
    setTile(s.map, tx, ty, '.')
    h.carry = info.lift
    h.act = 'lift'
    h.actT = 0
    h.charge = -1
    c.ev.push({ type: 'lift' })
    return true
  }
  if (t === 'L' || t === 'K') {
    const ok = t === 'L' ? keyCount(s) > 0 : hasBigKey(s)
    if (ok) unlockDoor(c, tx, ty, t)
    else openDialog(c, [t === 'L' ? 'LOCKED. A SMALL KEY WOULD OPEN IT.' : 'A GREAT LOCK. ONLY THE BIG KEY FITS.'], null)
    return true
  }
  return false
}

function talkTo(c: Ctx, id: string) {
  const s = c.s
  for (const m of c.info.marks) {
    const e = m.ent
    if (e.t !== 'npc' || e.id !== id) continue
    for (const br of e.talk) {
      if (!condFor(c, br.when)) continue
      const give = br.give && !has(s, `got:${id}:${br.give}`) ? br.give : undefined
      openDialog(c, br.lines, e.look, { give, set: [br.set, give ? `got:${id}:${give}` : undefined].filter((x): x is string => !!x) })
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
  s.dialog = { lines, line: 0, chars: 0, who, after }
  s.mode = 'dialog'
  const h = s.hero
  h.swing = null
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
  if (inp.autoFace && Math.hypot(inp.move.x, inp.move.y) < 0.1) {
    let best: { d: number; dir: Dir } | null = null
    for (const e of s.map.enemies) {
      if (!enemyActive(c, e)) continue
      const d = Math.hypot(e.x - h.x, e.y - h.y)
      if (d < SWORD_REACH + e.r + 0.6 && (!best || d < best.d)) best = { d, dir: toDir(e.x - h.x, e.y - h.y, h.dir) }
    }
    if (best) h.dir = best.dir
  }
  h.swing = { t: 0, dir: h.dir, hit: [] }
  h.act = 'swing'
  h.actT = 0
  h.charge = 0
  c.ev.push({ type: 'swing' })
  // The Arc Blade throws a beam while the hero's hearts are full.
  if (s.inv.arc && h.hp >= h.maxHp && !s.map.projectiles.some(p => p.kind === 'beam')) {
    const v = dirVec(h.dir)
    s.map.projectiles.push({ id: nextId(s), kind: 'beam', x: h.x + v.x * 0.7, y: h.y + v.y * 0.7, vx: v.x * BEAM_SPEED, vy: v.y * BEAM_SPEED, r: 0.32, t: 0, life: 0.55, friendly: true })
    c.ev.push({ type: 'beam' })
  }
}

/** Angle of the blade at swing progress p (0..1): sweeps across the facing. */
export function swingAngle(dir: Dir, p: number): number {
  const base = dirAngle(dir)
  const e = 1 - (1 - Math.min(1, p)) ** 2
  return base - SWORD_ARC / 2 + SWORD_ARC * e
}

function stepSwing(c: Ctx, dt: number) {
  const h = c.s.hero
  const sw = h.swing!
  const p0 = sw.t / SWING_TIME
  sw.t += dt
  const p1 = Math.min(1, sw.t / SWING_TIME)
  // Sample the sweep between the last and this step.
  for (let k = 0; k <= 2; k++) {
    const a = swingAngle(sw.dir, p0 + ((p1 - p0) * k) / 2)
    const arc = c.s.inv.arc
    bladeHits(c, a, arc ? ARC_REACH : SWORD_REACH, arc ? 2 : 1, 'sword', sw.hit)
  }
  if (sw.t >= SWING_TIME) {
    h.swing = null
    h.cooldown = SWING_COOLDOWN
    h.act = 'idle'
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
    bladeHits(c, a, SPIN_REACH + (c.s.inv.arc ? 0.2 : 0), c.s.inv.arc ? 3 : 2, 'spin', sp.hit)
  }
  if (sp.t >= SPIN_TIME) {
    h.spin = null
    h.cooldown = SWING_COOLDOWN
    h.act = 'idle'
  }
}

/** Everything the blade at angle `a` touches: enemies, shards, pellets, tiles. */
function bladeHits(c: Ctx, a: number, reach: number, dmg: number, src: 'sword' | 'spin', hit: string[]) {
  const s = c.s
  const h = s.hero
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
      hitEnemy(c, e, dmg, h.x, h.y, src)
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
  // Tiles along the blade.
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
    }
  }
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
  const s = c.s
  const m = s.map
  const v = dirVec(d)
  const nx = tx + v.x
  const ny = ty + v.y
  const t = tileAt(m, nx, ny)
  if (!(t === '.' || t === ',' || t === '_')) return
  if (m.moving.some(b => b.tx === tx && b.ty === ty)) return
  for (const e of m.enemies) if (!e.dead && Math.floor(e.x) === nx && Math.floor(e.y) === ny) return
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

export function cycleItem(c: Ctx) {
  const inv = c.s.inv
  const owned: Array<'disc' | 'bombs' | 'hook'> = []
  if (inv.hook) owned.push('hook')
  if (inv.disc) owned.push('disc')
  if (inv.bombBag) owned.push('bombs')
  if (!owned.length) return
  const i = inv.selected ? owned.indexOf(inv.selected) : -1
  inv.selected = owned[(i + 1) % owned.length]!
  c.ev.push({ type: 'cycle', item: inv.selected })
}

function useItem(c: Ctx, inp: Input) {
  const s = c.s
  const h = s.hero
  const inv = s.inv
  if (inv.selected === 'bombs') {
    if (inv.bombs <= 0 || s.map.bombs.length >= 2) { c.ev.push({ type: 'error' }); return }
    const v = dirVec(h.dir)
    let bx = h.x + v.x * 0.7
    let by = h.y + v.y * 0.7
    if (circleBlocked(c.w, s.map, bx, by, 0.2, 'enemy')) { bx = h.x; by = h.y }
    inv.bombs--
    s.map.bombs.push({ id: nextId(s), x: bx, y: by, t: 0 })
    h.act = 'use'
    h.actT = 0
    c.ev.push({ type: 'bombPlace' })
  } else if (inv.selected === 'hook') {
    fireHook(c)
  } else if (inv.selected === 'disc') {
    if (s.disc) return
    let dx = inp.move.x
    let dy = inp.move.y
    const len = Math.hypot(dx, dy)
    if (len < 0.3) { const v = dirVec(h.dir); dx = v.x; dy = v.y } else { dx /= len; dy /= len }
    s.disc = { x: h.x + dx * 0.4, y: h.y + dy * 0.4, vx: dx, vy: dy, t: 0, returning: false, hit: [], carrying: [] }
    h.act = 'use'
    h.actT = 0
    c.ev.push({ type: 'disc' })
  } else if (s.inv.sword) c.ev.push({ type: 'error' }) // no buzz for a visitor who has nothing yet
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
  const free = (t: TileChar) => t === '.' || t === ',' || t === '_' || t === ':' || t === '{' || t === 'i' || t === 'f'
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
    const h = s.hero
    if (Math.abs(h.x - (nx + 0.5)) < 0.5 + HERO_R && Math.abs(h.y - (ny + 0.5)) < 0.5 + HERO_R) break
    x = nx
    y = ny
  }
  if (s.luna) { s.luna.psi = 0.7; s.luna.dir = toDir(tx + 0.5 - s.luna.x, ty + 0.5 - s.luna.y, s.luna.dir) }
  c.ev.push({ type: 'psi', x: tx + 0.5, y: ty + 0.5 })
  if (x === tx && y === ty) return
  m.tiles[ty * m.w + tx] = '.'
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
