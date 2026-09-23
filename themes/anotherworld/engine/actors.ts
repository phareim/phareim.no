import type { DeathCause, Guard, Leech, Shot, TideHazard, World } from '../types'
import {
  BODY_H, BOLT_SPEED, GRAVITY, GUARD_CROUCH_H, GUARD_H, GUARD_HALF_W, HALF_W,
  bodyHeight, emit, overlaps,
} from './util'

// Everything that is not the figure: the tide, the rockfall, the pool's
// tentacles, leeches, guards and their shields, the beast, the lifts, and
// every shot in the air. Each step returns the cause if something has the
// figure; the chapter step turns that into a death vignette.

// ---- tide ----

/** Tide rise 0..1: quiet, rising over 15 % of the period, full for 30 %, retreating 10 %. */
export function tideLevel(hz: TideHazard, time: number): number {
  const u = tidePhase(hz, time)
  if (u < 0.35) return 0
  if (u < 0.5) return (u - 0.35) / 0.15
  if (u < 0.8) return 1
  if (u < 0.9) return 1 - (u - 0.8) / 0.1
  return 0
}

export function tidePhase(hz: TideHazard, time: number): number {
  return ((((time + hz.phase) % hz.period) + hz.period) % hz.period) / hz.period
}

function playerBox(world: World): [number, number, number, number] {
  const p = world.player
  return [p.x - HALF_W, p.x + HALF_W, p.y - bodyHeight(world), p.y]
}

export function stepHazards(world: World, h: number, live: boolean): DeathCause | null {
  const p = world.player
  const [l, r, t, b] = playerBox(world)
  let cause: DeathCause | null = null
  for (const hz of world.hazards) {
    if (hz.kind === 'tide') {
      const now = tideLevel(hz, world.time)
      if (live && now >= 0.999 && overlaps(l, r, t, b, hz.x, hz.y, hz.w, hz.h)) cause = 'tide'
    } else if (hz.kind === 'rockfall') {
      if (hz.state === 'hanging') {
        if (live && r > hz.triggerX && l < hz.triggerX + hz.triggerW) {
          hz.state = 'falling'
          hz.vy = 0
          emit(world, { type: 'rockfall' })
        }
      } else if (hz.state === 'falling') {
        hz.vy += GRAVITY * h
        hz.top += hz.vy * h
        let landed = false
        if (hz.top >= hz.y) {
          hz.top = hz.y
          landed = true
        }
        if (live && overlaps(l, r, t, b, hz.x, hz.top, hz.w, hz.h)) cause = 'rockfall'
        if (landed) {
          hz.state = 'landed'
          hz.vy = 0
          world.platforms.push({ x: hz.x, y: hz.y, w: hz.w, h: hz.h, kind: 'rock' })
          emit(world, { type: 'rockLand' })
        }
      }
    } else {
      // The tentacles wake once the figure is swimming in their pool, and
      // sink back when it has climbed out.
      const inPool = p.swimming && p.x > hz.x && p.x < hz.x + hz.w
      if (inPool) hz.active = true
      if (hz.active && inPool) {
        hz.t += h
        if (hz.t >= hz.delay) {
          if (hz.t - h < hz.delay) emit(world, { type: 'tentacles' })
          hz.tip -= 42 * h
        }
        // They take the figure when they reach its waist.
        if (live && hz.tip <= p.y - 28) cause = 'tentacles'
      } else if (!inPool && hz.tip < hz.floor) {
        hz.tip = Math.min(hz.floor, hz.tip + 90 * h)
      }
    }
  }
  return cause
}

// ---- leeches ----

function stepLeech(world: World, a: Leech, h: number, live: boolean): DeathCause | null {
  const p = world.player
  if (a.state === 'dead') {
    a.t += h
    return null
  }
  if (a.state === 'hang') {
    if (live && p.x > a.x - 42 && p.x < a.x + 30 && p.y > a.y) {
      a.state = 'drop'
      a.vy = 0
      emit(world, { type: 'leechDrop' })
    }
    return null
  }
  if (a.state === 'drop') {
    a.vy = Math.min(a.vy + GRAVITY * 0.8 * h, 900)
    const ny = a.y + a.vy * h
    for (const pl of world.platforms) {
      if (a.x < pl.x || a.x > pl.x + pl.w) continue
      if (a.y <= pl.y + 0.5 && ny >= pl.y) {
        a.y = pl.y
        a.state = 'crawl'
        a.minX = pl.x + 6
        a.maxX = pl.x + pl.w - 6
        a.dir = p.x < a.x ? -1 : 1
        break
      }
    }
    if (a.state === 'drop') a.y = ny
    if (a.y > world.killY) a.state = 'dead'
  } else {
    a.x += a.dir * 20 * h
    if (a.x < a.minX) { a.x = a.minX; a.dir = 1 }
    if (a.x > a.maxX) { a.x = a.maxX; a.dir = -1 }
  }
  if (!live || p.mantle) return null
  // The sting: any touch of the lower body, or landing on it.
  const top = a.state === 'drop' ? a.y - 8 : a.y - 7
  if (overlaps(p.x - HALF_W + 3, p.x + HALF_W - 3, p.y - (a.state === 'drop' ? bodyHeight(world) : 22), p.y, a.x - 8, top, 16, 8)) return 'leech'
  return null
}

// ---- guards ----

function guardHeight(g: Guard): number {
  return g.crouch ? GUARD_CROUCH_H : GUARD_H
}

/** A wall or a closed door between two points at one height. */
function lineBlocked(world: World, x0: number, x1: number, y: number): boolean {
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  for (const pl of world.platforms) {
    if (pl.x + pl.w < lo || pl.x > hi) continue
    if (y > pl.y && y < pl.y + pl.h) return true
  }
  return false
}

function stepGuard(world: World, g: Guard, h: number, live: boolean): void {
  const p = world.player
  g.t += h
  if (g.state === 'dead') return
  if (g.state === 'dying') {
    if (g.t > 0.7) g.state = 'dead'
    return
  }
  if (g.state === 'walk') {
    const d = g.goalX - g.x
    g.facing = d < 0 ? -1 : 1
    g.x += Math.sign(d) * Math.min(Math.abs(d), 95 * h)
    if (Math.abs(d) < 1) {
      g.state = 'idle'
      g.facing = p.x < g.x ? -1 : 1
    }
  }
  const dx = p.x - g.x
  // A guard notices a figure standing on its own floor, never one mid-jump
  // or still climbing: the first bolt always comes after the landing.
  const sees = live && !world.dying && p.grounded && !p.mantle && Math.abs(dx) < g.range && Math.abs(p.y - g.y) < 30 &&
    (dx * g.facing > 0 || Math.abs(dx) < 140) && !lineBlocked(world, g.x, p.x, g.y - 36)
  if (g.state === 'idle' && sees) {
    g.state = 'alert'
    g.alertT = 0
    g.fireT = Math.max(0.95, Math.min(g.fireT, 1.1))
    emit(world, { type: 'guardAlert' })
  }
  if (g.state !== 'alert') return
  g.alertT += h
  g.facing = dx < 0 ? -1 : 1

  // Crouch to meet a crouching figure, stand when it stands.
  const want = p.crouching && p.grounded
  if (want !== g.crouch) {
    g.crouchT += h
    if (g.crouchT > (want ? 0.55 : 0.35)) {
      g.crouch = want
      g.crouchT = 0
    }
  } else {
    g.crouchT = 0
  }

  const own = world.shields.find(s => s.owner === 'guard' && s.ownerId === g.id)
  if (own) own.x = g.x + g.facing * 26
  if (!own) {
    g.shieldT -= h
    if (g.shieldT <= 0 && g.alertT > 0.35) {
      world.shields.push({ owner: 'guard', ownerId: g.id, x: g.x + g.facing * 26, y: g.y, h: 62, hp: g.shieldHp, t: 0, life: 6 })
      g.shieldT = 2.4
      emit(world, { type: 'shield', owner: 'guard' })
    }
  }
  if (!live || world.dying) return
  g.fireT -= h
  if (g.fireT <= 0 && g.alertT > 0.6) {
    g.fireT = g.fireEvery
    world.shots.push({
      owner: 'guard', kind: 'bolt',
      x: g.x + g.facing * 22, y: g.y - (g.crouch ? 20 : 36),
      vx: g.facing * BOLT_SPEED, alive: true, t: 0,
    })
    emit(world, { type: 'bolt' })
  }
}

export function killGuard(world: World, g: Guard): void {
  g.state = 'dying'
  g.t = 0
  world.shields = world.shields.filter(s => !(s.owner === 'guard' && s.ownerId === g.id))
  emit(world, { type: 'guardDie' })
  if (g.carriesGun) world.items.push({ kind: 'gun', x: g.x - g.facing * 18, y: g.y, taken: false })
}

// ---- shots ----

function stepShot(world: World, s: Shot, h: number, live: boolean): DeathCause | null {
  const x0 = s.x
  s.x += s.vx * h
  s.t += h
  const lo = Math.min(x0, s.x)
  const hi = Math.max(x0, s.x)
  const half = s.kind === 'beam' ? 5 : 2.5
  let cause: DeathCause | null = null

  // Shields of the other side, nearest first along the path.
  const hits = world.shields
    .filter(sh => sh.owner !== s.owner && sh.hp > 0 && sh.x + 3 >= lo && sh.x - 3 <= hi && s.y > sh.y - sh.h && s.y < sh.y)
    .sort((a, b) => (s.vx > 0 ? a.x - b.x : b.x - a.x))
  for (const sh of hits) {
    if (s.kind === 'beam') {
      sh.hp = 0
      emit(world, { type: 'shieldBreak' })
      continue
    }
    sh.hp -= 1
    s.alive = false
    emit(world, { type: sh.hp <= 0 ? 'shieldBreak' : 'shieldHit' })
    return null
  }

  if (s.owner === 'player') {
    for (const a of world.actors) {
      if (a.kind === 'leech' && (a.state === 'crawl' || a.state === 'drop')) {
        if (a.x + 8 >= lo && a.x - 8 <= hi && s.y > a.y - 14 && s.y < a.y + 1) {
          a.state = 'dead'
          a.t = 0
          emit(world, { type: 'leechDie' })
          if (s.kind !== 'beam') { s.alive = false; return null }
        }
        continue
      }
      if (a.kind !== 'guard' || a.state === 'dying' || a.state === 'dead') continue
      const gh = guardHeight(a)
      if (a.x + GUARD_HALF_W < lo || a.x - GUARD_HALF_W > hi) continue
      if (s.y < a.y - gh || s.y > a.y) continue
      killGuard(world, a)
      if (s.kind !== 'beam') { s.alive = false; return null }
    }
  } else if (live && !world.dying) {
    const p = world.player
    const bh = bodyHeight(world)
    if (!p.mantle && p.x + HALF_W >= lo && p.x - HALF_W <= hi && s.y + half > p.y - bh && s.y - half < p.y) {
      s.alive = false
      cause = 'bolt'
    }
  }

  // Walls stop everything; a beam opens a blast door.
  for (let i = 0; i < world.platforms.length; i++) {
    const pl = world.platforms[i]
    if (pl.x > hi || pl.x + pl.w < lo || s.y < pl.y || s.y > pl.y + pl.h) continue
    if (s.kind === 'beam' && pl.kind === 'door' && pl.id?.startsWith('blast')) {
      world.platforms.splice(i, 1)
      world.flags.push(`open:${pl.id}`)
      emit(world, { type: 'door' })
    }
    s.alive = false
    break
  }
  if (s.t > 2.2 || s.x < -200 || s.x > world.width + 400) s.alive = false
  return cause
}

// ---- the beast ----

function stepBeast(world: World, h: number, live: boolean): DeathCause | null {
  const p = world.player
  for (const a of world.actors) {
    if (a.kind !== 'beast') continue
    a.t += h
    if (a.state !== 'chase') continue
    const gap = p.x - a.x
    // It keeps in sight when far behind, and gains slowly on a clean run.
    a.speed = gap > 520 ? 340 : gap > 380 ? 285 : 262
    a.x += a.speed * h
    if (live && !world.dying && gap < 40 && Math.abs(p.y - a.y) < 140) {
      a.state = 'pounce'
      a.t = 0
      emit(world, { type: 'beastPounce' })
      return 'beast'
    }
  }
  return null
}

// ---- lifts ----

function stepLifts(world: World, h: number): void {
  const p = world.player
  for (const lift of world.lifts) {
    const pl = world.platforms.find(q => q.kind === 'lift' && q.id === lift.id)
    if (!pl) continue
    const riding = p.grounded && Math.abs(p.y - pl.y) < 1 && p.x + HALF_W > pl.x && p.x - HALF_W < pl.x + pl.w
    let dy = 0
    if (lift.state === 'lowering') {
      dy = Math.min(lift.yBottom - lift.y, 140 * h)
      if (lift.y + dy >= lift.yBottom) lift.state = 'down'
    } else if (lift.state === 'rising') {
      dy = -Math.min(lift.y - lift.yTop, 110 * h)
      if (lift.y + dy <= lift.yTop) lift.state = 'up'
    }
    lift.y += dy
    pl.y = lift.y
    if (riding) p.y = pl.y
    lift.t = riding ? lift.t + h : 0
  }
}

// ---- shields ----

function stepShields(world: World, h: number): void {
  for (const s of world.shields) {
    s.t += h
    s.life -= h
  }
  world.shields = world.shields.filter(s => s.life > 0 && s.hp > 0)
}

/** Everything but the figure, one substep. Returns what killed it, if anything did. */
export function stepActors(world: World, h: number, live: boolean): DeathCause | null {
  let cause: DeathCause | null = stepHazards(world, h, live)
  stepLifts(world, h)
  for (const a of world.actors) {
    if (a.kind === 'leech') {
      const c = stepLeech(world, a, h, live)
      if (c && !cause) cause = c
    } else if (a.kind === 'guard') {
      stepGuard(world, a, h, live)
    }
  }
  const b = stepBeast(world, h, live)
  if (b && !cause) cause = b
  stepShields(world, h)
  for (const s of world.shots) {
    if (!s.alive) continue
    const c = stepShot(world, s, h, live)
    if (c && !cause) cause = c
  }
  world.shots = world.shots.filter(s => s.alive)
  world.actors = world.actors.filter(a => !(a.kind === 'leech' && a.state === 'dead' && a.t > 1.2))
  return cause
}

/** Lamps light on touch; items are picked up by walking over them. */
export function touchThings(world: World): void {
  const p = world.player
  for (let i = 0; i < world.lamps.length; i++) {
    const lamp = world.lamps[i]
    if (lamp.lit) continue
    if (Math.abs(p.x - lamp.x) < 34 && Math.abs(p.y - lamp.y) < BODY_H) {
      lamp.lit = true
      if (i > world.checkpoint) world.checkpoint = i
      emit(world, { type: 'lamp', final: !!lamp.final })
    }
  }
  for (const it of world.items) {
    if (it.taken || !p.grounded) continue
    if (Math.abs(p.x - it.x) < 24 && Math.abs(p.y - it.y) < 10) {
      it.taken = true
      p.hasGun = true
      world.hint = 'gun'
      emit(world, { type: 'gun' })
    }
  }
}
