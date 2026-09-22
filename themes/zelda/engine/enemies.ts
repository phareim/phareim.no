/**
 * Enemy brains. Each kind is a small state machine in `e.ai` (mode + timer);
 * `ai.tell` > 0 means "about to attack" and the renderer shows it.
 */
import type { Enemy, Projectile } from '../types'
import { HERO_R } from '../types'
import { STATS, spawnEnemy } from './spawn'
import { type Ctx, hurtHero, hitEnemy } from './combat'
import { cellRect, lineClear, moveCircle, type MoveMode } from './map'
import { angleDiff, chance, clamp, dirVec, nextId, opposite, pick, rnd, rndRange, toDir, DIRS } from './util'

export const SHARD_R = 0.42
export const SHARD_ORBIT = 2.1

/** World position of the king's i-th shard (the renderer uses this too). */
export function shardPos(e: Enemy, i: number) {
  const a = (e.ai.ang as number) + (i * Math.PI) / 2
  return { x: e.x + Math.cos(a) * SHARD_ORBIT, y: e.y + Math.sin(a) * SHARD_ORBIT * 0.8 }
}

export function enemyActive(c: Ctx, e: Enemy): boolean {
  if (e.dead) return false
  const s = c.s
  if (c.info.def.kind === 'overworld') {
    const f = s.demo ? { x: s.zone.x + s.zone.w / 2, y: s.zone.y + s.zone.h / 2 } : s.hero
    return Math.abs(e.x - f.x) < 15 && Math.abs(e.y - f.y) < 12
  }
  return e.cell === s.zoneIndex
}

export function stepEnemies(c: Ctx, dt: number) {
  const list = c.s.map.enemies
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!
    if (!enemyActive(c, e)) continue
    stepEnemy(c, e, dt)
  }
}

function mode(e: Enemy): MoveMode {
  return STATS[e.kind].flying ? 'fly' : 'enemy'
}

/** Move with collision inside the enemy's own camera room. Returns true if blocked. */
function walk(c: Ctx, e: Enemy, vx: number, vy: number, dt: number): boolean {
  const r = moveCircle(c.w, c.s.map, e.x, e.y, e.r, vx * dt, vy * dt, mode(e))
  let x = r.x
  let y = r.y
  let hit = r.hitX || r.hitY
  if (c.info.def.kind === 'dungeon') {
    const z = cellRect(c.info, e.cell)
    const nx = clamp(x, z.x + 1 + e.r, z.x + z.w - 1 - e.r)
    const ny = clamp(y, z.y + 1 + e.r, z.y + z.h - 1 - e.r)
    if (nx !== x || ny !== y) hit = true
    x = nx
    y = ny
  }
  e.x = x
  e.y = y
  return hit
}

function seesHero(c: Ctx, e: Enemy, range: number): boolean {
  const h = c.s.hero
  if (c.s.demo || h.act === 'dead') return false
  const d = Math.hypot(h.x - e.x, h.y - e.y)
  return d < range && lineClear(c.w, c.s.map, e.x, e.y, h.x, h.y)
}

function heroDist(c: Ctx, e: Enemy) {
  return Math.hypot(c.s.hero.x - e.x, c.s.hero.y - e.y)
}

function shoot(c: Ctx, e: Enemy, kind: Projectile['kind'], vx: number, vy: number, r = 0.22, life = 3) {
  const p = c.s.map.projectiles
  if (p.length > 40) return
  p.push({ id: nextId(c.s), kind, x: e.x, y: e.y, vx, vy, r, t: 0, life, reflect: kind === 'pellet' })
  c.ev.push({ type: 'shoot', x: e.x, y: e.y, kind })
}

export function stepEnemy(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  if (e.flash > 0) e.flash -= dt
  if (e.invuln > 0) e.invuln -= dt
  if (e.knock) {
    walk(c, e, e.knock.vx, e.knock.vy, dt)
    e.knock.t -= dt
    if (e.knock.t <= 0) e.knock = null
    contact(c, e)
    return
  }
  if (e.stun > 0) {
    e.stun -= dt
    ai.tell = 0
    return
  }
  ai.t -= dt
  if (ai.tell > 0) ai.tell = Math.max(0, ai.tell - dt)
  switch (e.kind) {
    case 'blob': blob(c, e, dt); break
    case 'spitter': spitter(c, e, dt); break
    case 'sentry': sentry(c, e, dt); break
    case 'bat': bat(c, e, dt); break
    case 'dasher': dasher(c, e, dt); break
    case 'zapper': zapper(c, e, dt); break
    case 'skull': skull(c, e, dt); break
    case 'eye': eye(c, e, dt); break
    case 'blade': blade(c, e, dt); break
    case 'knight': knight(c, e, dt); break
    case 'king': king(c, e, dt); break
  }
  contact(c, e)
}

function contact(c: Ctx, e: Enemy) {
  if (e.dead || e.stun > 0) return
  const st = STATS[e.kind]
  const h = c.s.hero
  const harmless = e.kind === 'king' && (e.ai.mode === 'down' || e.ai.mode === 'rise')
  if (st.dmg > 0 && !harmless && Math.hypot(h.x - e.x, h.y - e.y) < e.r + HERO_R - 0.05) {
    hurtHero(c, st.dmg, e.x, e.y, e.kind === 'zapper')
  }
  if (e.kind === 'king' && e.ai.mode !== 'down') {
    const bits = e.ai.shards as number
    for (let i = 0; i < 4; i++) {
      if (!(bits & (1 << i))) continue
      const p = shardPos(e, i)
      if (Math.hypot(h.x - p.x, h.y - p.y) < SHARD_R + HERO_R) hurtHero(c, 2, p.x, p.y)
    }
  }
}

// ---------------------------------------------------------------------------

function blob(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  if (ai.mode === 'hop') {
    walk(c, e, ai.vx as number, ai.vy as number, dt)
    if (ai.t <= 0) { ai.mode = 'idle'; ai.t = rndRange(c.s, 0.5, 1.1) }
    return
  }
  if (ai.t <= 0) {
    const h = c.s.hero
    let a = rnd(c.s) * Math.PI * 2
    if (seesHero(c, e, 6) && chance(c.s, 0.65)) a = Math.atan2(h.y - e.y, h.x - e.x) + rndRange(c.s, -0.4, 0.4)
    ai.vx = Math.cos(a) * 3.2
    ai.vy = Math.sin(a) * 3.2
    ai.mode = 'hop'
    ai.t = 0.38
  }
}

function spitter(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'aim') {
    if (ai.t <= 0) {
      const v = dirVec(e.dir)
      shoot(c, e, 'pellet', v.x * 6.5, v.y * 6.5)
      ai.mode = 'idle'
      ai.t = rndRange(c.s, 0.4, 0.8)
    }
    return
  }
  if (ai.mode === 'walk') {
    const v = dirVec(e.dir)
    if (walk(c, e, v.x * 1.7, v.y * 1.7, dt)) e.dir = opposite(e.dir)
    if (ai.t > 0) return
  }
  if (ai.t > 0) return
  // Decide: shoot if roughly lined up, else wander.
  const dx = h.x - e.x
  const dy = h.y - e.y
  if (seesHero(c, e, 8) && (Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8) && chance(c.s, 0.75)) {
    e.dir = toDir(dx, dy, e.dir)
    ai.mode = 'aim'
    ai.t = 0.45
    ai.tell = 0.45
  } else {
    e.dir = pick(c.s, DIRS)
    ai.mode = 'walk'
    ai.t = rndRange(c.s, 0.8, 1.8)
  }
}

function sentry(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'alert') {
    e.dir = toDir(h.x - e.x, h.y - e.y, e.dir)
    if (ai.t <= 0) { ai.mode = 'chase'; ai.t = 4.5; ai.lost = 0 }
    return
  }
  if (ai.mode === 'chase') {
    const d = heroDist(c, e) || 1
    const vx = ((h.x - e.x) / d) * 3.3
    const vy = ((h.y - e.y) / d) * 3.3
    walk(c, e, vx, vy, dt)
    e.dir = toDir(vx, vy, e.dir)
    ai.lost = seesHero(c, e, 9) ? 0 : (ai.lost as number) + dt
    if (ai.t <= 0 || (ai.lost as number) > 1.4) { ai.mode = 'patrol'; ai.t = 1.2 }
    return
  }
  // patrol
  const v = dirVec(e.dir)
  if (walk(c, e, v.x * 1.4, v.y * 1.4, dt) || ai.t <= 0) {
    e.dir = pick(c.s, DIRS)
    ai.t = rndRange(c.s, 1.2, 2.6)
    ai.mode = 'patrol'
  }
  if (seesHero(c, e, 6)) {
    const dx = h.x - e.x
    const dy = h.y - e.y
    const facing = dx * v.x + dy * v.y > 0
    if (facing || Math.hypot(dx, dy) < 2.5) { ai.mode = 'alert'; ai.t = 0.45; ai.tell = 0.45 }
  }
}

function bat(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'fly') {
    ai.ph = ((ai.ph as number) ?? 0) + dt * 5
    let tx = h.x
    let ty = h.y
    if (!seesHero(c, e, 9)) { tx = e.home.x; ty = e.home.y }
    const d = Math.hypot(tx - e.x, ty - e.y) || 1
    const w = Math.sin(ai.ph as number) * 2.6
    const vx = ((tx - e.x) / d) * 3.4 - ((ty - e.y) / d) * w
    const vy = ((ty - e.y) / d) * 3.4 + ((tx - e.x) / d) * w
    walk(c, e, vx, vy, dt)
    if (ai.t <= 0) { ai.mode = 'rest'; ai.t = rndRange(c.s, 0.6, 1.6) }
    return
  }
  if (ai.t <= 0) { ai.mode = 'fly'; ai.t = rndRange(c.s, 1.4, 2.8); ai.ph = rnd(c.s) * 6 }
}

function dasher(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'dash') {
    const v = dirVec(e.dir)
    if (walk(c, e, v.x * 9, v.y * 9, dt) || ai.t <= 0) { ai.mode = 'rest'; ai.t = 0.7 }
    return
  }
  if (ai.mode === 'rest') { if (ai.t <= 0) { ai.mode = 'wander'; ai.t = 1 } return }
  const v = dirVec(e.dir)
  if (walk(c, e, v.x * 1.3, v.y * 1.3, dt) || ai.t <= 0) {
    e.dir = pick(c.s, DIRS)
    ai.t = rndRange(c.s, 0.8, 1.8)
  }
  const dx = h.x - e.x
  const dy = h.y - e.y
  if ((Math.abs(dx) < 0.45 || Math.abs(dy) < 0.45) && seesHero(c, e, 7)) {
    e.dir = toDir(dx, dy, e.dir)
    ai.mode = 'dash'
    ai.t = 1.2
    ai.tell = 0.12
  }
}

function zapper(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  ai.ph = ((ai.ph as number) ?? 0) + dt
  let vx = Math.cos((ai.ph as number) * 1.3) * 0.6
  let vy = Math.sin((ai.ph as number) * 1.7) * 0.6
  if (seesHero(c, e, 7)) {
    const d = heroDist(c, e) || 1
    vx += ((h.x - e.x) / d) * 0.9
    vy += ((h.y - e.y) / d) * 0.9
  }
  walk(c, e, vx, vy, dt)
}

function skull(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'hop' || ai.mode === 'dodge') {
    walk(c, e, ai.vx as number, ai.vy as number, dt)
    if (ai.t <= 0) { ai.mode = 'idle'; ai.t = rndRange(c.s, 0.5, 1.2) }
    return
  }
  // Dodge a sword in the act.
  if ((h.swing || h.charge > 0.2) && heroDist(c, e) < 2.3 && chance(c.s, 0.08)) {
    const d = heroDist(c, e) || 1
    ai.vx = ((e.x - h.x) / d) * 6.5
    ai.vy = ((e.y - h.y) / d) * 6.5
    ai.mode = 'dodge'
    ai.t = 0.3
    return
  }
  if (ai.t <= 0) {
    let a = rnd(c.s) * Math.PI * 2
    if (seesHero(c, e, 7) && chance(c.s, 0.7)) a = Math.atan2(h.y - e.y, h.x - e.x)
    ai.vx = Math.cos(a) * 3.6
    ai.vy = Math.sin(a) * 3.6
    ai.mode = 'hop'
    ai.t = 0.34
  }
}

function eye(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (typeof ai.ang !== 'number') ai.ang = rnd(c.s) * Math.PI * 2
  if (ai.mode === 'aim') {
    ai.ang = Math.atan2(h.y - e.y, h.x - e.x)
    if (ai.t <= 0) {
      const a = ai.ang as number
      shoot(c, e, 'laser', Math.cos(a) * 13, Math.sin(a) * 13, 0.2, 1.4)
      ai.mode = 'cool'
      ai.t = 1.4
    }
    return
  }
  ai.ang = (ai.ang as number) + dt * 1.1
  if (ai.mode === 'cool' && ai.t > 0) return
  ai.mode = 'sweep'
  const a = Math.atan2(h.y - e.y, h.x - e.x)
  if (seesHero(c, e, 9) && angleDiff(a, ai.ang as number) < 0.4) {
    ai.mode = 'aim'
    ai.t = 0.5
    ai.tell = 0.5
  }
}

function blade(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'go') {
    const v = dirVec(e.dir)
    if (walk(c, e, v.x * 8.5, v.y * 8.5, dt)) { ai.mode = 'back'; c.ev.push({ type: 'clank', x: e.x, y: e.y }) }
    return
  }
  if (ai.mode === 'back') {
    const dx = e.home.x - e.x
    const dy = e.home.y - e.y
    const d = Math.hypot(dx, dy)
    if (d < 0.05) { e.x = e.home.x; e.y = e.home.y; ai.mode = 'wait'; ai.t = 0.4; return }
    const s = Math.min(d, 2.6 * dt)
    e.x += (dx / d) * s
    e.y += (dy / d) * s
    return
  }
  if (ai.t > 0) return
  const dx = h.x - e.x
  const dy = h.y - e.y
  if ((Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5) && seesHero(c, e, 8)) {
    e.dir = toDir(dx, dy, e.dir)
    ai.mode = 'go'
  }
}

function knight(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'idle') { ai.mode = 'walk'; ai.t = 2 }
  if (ai.mode === 'walk') {
    e.dir = toDir(h.x - e.x, h.y - e.y, e.dir)
    const d = heroDist(c, e) || 1
    walk(c, e, ((h.x - e.x) / d) * 1.3, ((h.y - e.y) / d) * 1.3, dt)
    if (ai.t <= 0) { ai.mode = 'tell'; ai.t = 0.6; ai.tell = 0.6 }
    return
  }
  if (ai.mode === 'tell') {
    e.dir = toDir(h.x - e.x, h.y - e.y, e.dir)
    if (ai.t <= 0) { ai.mode = 'charge'; ai.t = 1.5 }
    return
  }
  if (ai.mode === 'charge') {
    const v = dirVec(e.dir)
    if (walk(c, e, v.x * 8.5, v.y * 8.5, dt)) {
      ai.mode = 'dazed'
      ai.t = 1.6
      c.s.shake = Math.max(c.s.shake, 0.3)
      c.ev.push({ type: 'boom', x: e.x + v.x * 0.7, y: e.y + v.y * 0.7 })
    } else if (ai.t <= 0) { ai.mode = 'walk'; ai.t = rndRange(c.s, 1.6, 2.4) }
    return
  }
  if (ai.mode === 'dazed' && ai.t <= 0) { ai.mode = 'walk'; ai.t = rndRange(c.s, 1.4, 2.2) }
}

function king(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const s = c.s
  const h = s.hero
  const p2 = ai.phase === 2
  if (typeof ai.ang !== 'number') { ai.ang = 0; ai.shards = 15; ai.fire = 2.5; ai.tx = e.x; ai.ty = e.y; ai.mode = 'float'; ai.phase = 1 }
  ai.ang = (ai.ang as number) + dt * (p2 ? 2.5 : 1.6)
  const room = cellRect(c.info, e.cell)
  if (ai.mode === 'float') {
    const dx = (ai.tx as number) - e.x
    const dy = (ai.ty as number) - e.y
    const d = Math.hypot(dx, dy)
    if (d < 0.2 || ai.t <= 0) {
      ai.tx = rndRange(s, room.x + 3.5, room.x + room.w - 3.5)
      ai.ty = rndRange(s, room.y + 3, room.y + room.h - 4)
      ai.t = 3
    } else {
      const sp = p2 ? 2.2 : 1.5
      e.x += (dx / d) * Math.min(d, sp * dt)
      e.y += (dy / d) * Math.min(d, sp * dt)
    }
    ai.fire = (ai.fire as number) - dt
    if ((ai.fire as number) <= 0.5 && ai.tell <= 0 && (ai.fire as number) > 0) ai.tell = 0.5
    if ((ai.fire as number) <= 0) {
      ai.fire = p2 ? 2.1 : 3.1
      const vol = ((ai.vol as number) ?? 0) + 1
      ai.vol = vol
      if (p2 && vol % 2 === 0) {
        const a = Math.atan2(h.y - e.y, h.x - e.x)
        for (const o of [-0.28, 0, 0.28]) shoot(c, e, 'spark', Math.cos(a + o) * 6.5, Math.sin(a + o) * 6.5, 0.26, 3)
      } else {
        const n = p2 ? 10 : 8
        const off = rnd(s) * Math.PI
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2
          shoot(c, e, 'spark', Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0.26, 3.5)
        }
      }
    }
    if ((ai.shards as number) === 0) {
      ai.mode = 'down'
      ai.t = p2 ? 3 : 3.6
      s.shake = Math.max(s.shake, 0.25)
      c.ev.push({ type: 'boom', x: e.x, y: e.y + 0.6 })
    }
    if (p2 && !ai.summoned) {
      ai.summoned = true
      for (const [ox, oy] of [[-4, 1], [4, 1]] as const) {
        s.map.enemies.push(spawnEnemy(`king.bat${ox}`, 'bat', clamp(e.x + ox, room.x + 2, room.x + room.w - 2), clamp(e.y + oy, room.y + 2, room.y + room.h - 2), 'down', e.cell))
      }
    }
    return
  }
  if (ai.mode === 'down') {
    if (ai.t <= 0) { ai.mode = 'rise'; ai.t = 0.7; ai.tell = 0.7 }
    return
  }
  if (ai.mode === 'rise' && ai.t <= 0) {
    ai.shards = 15
    ai.mode = 'float'
    ai.fire = 1.6
    ai.t = 0
  }
}

/** Break any king shard within `r` of (x, y). Returns true if one broke. */
export function breakShards(c: Ctx, x: number, y: number, r: number): boolean {
  let broke = false
  for (const e of c.s.map.enemies) {
    if (e.kind !== 'king' || e.dead || e.ai.mode !== 'float') continue
    for (let i = 0; i < 4; i++) {
      const bits = e.ai.shards as number
      if (!(bits & (1 << i))) continue
      const p = shardPos(e, i)
      if (Math.hypot(p.x - x, p.y - y) < r + SHARD_R) {
        e.ai.shards = bits & ~(1 << i)
        c.ev.push({ type: 'hit', x: p.x, y: p.y, kind: 'king', killed: false })
        c.ev.push({ type: 'hitStop', ms: 40 })
        broke = true
      }
    }
  }
  return broke
}

export { hitEnemy }
