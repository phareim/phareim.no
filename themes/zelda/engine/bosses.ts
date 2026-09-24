/**
 * Project Horizon's bosses, named after other language models.
 *
 * LLAMA (Horizon Lab miniboss) — wool turns every blade; it spits, and its
 *   own spit knocked back with the sword is what hurts it (bombs too).
 * MISTRAL (Horizon Lab boss) — the cold wind: floats out of reach, blows
 *   gusts that shove the hero towards the pits; the hook drags it to the
 *   floor, where it can be struck.
 * DEEPSEEK (Deep Lab miniboss) — swims under the floor towards the hero
 *   and surfaces to bite; while it is up it can be struck, and the hook
 *   hauls it up and holds it.
 * GEMINI (Deep Lab boss) — twins orbiting the Gate, joined by a tether that
 *   burns; a twin brought to zero only falls down, and gets up again unless
 *   the other follows within four seconds.
 * Hit rules live in combat.ts (bossRules).
 */
import type { Enemy } from '../types'
import { HERO_R } from '../types'
import { type Ctx, hurtHero } from './combat'
import { heroDist, seesHero, shoot, walk } from './enemies'
import { cellRect } from './map'
import { dirVec, rnd, rndRange, toDir } from './util'

// ---------------------------------------------------------------------------

export function llama(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  const p2 = e.hp <= 4
  if (ai.mode === 'idle') { ai.mode = 'walk'; ai.t = 1.4 }
  if (ai.mode === 'walk') {
    const d = heroDist(c, e) || 1
    // Keep a spitting distance.
    const want = d > 4.5 ? 1 : d < 3 ? -1 : 0
    walk(c, e, ((h.x - e.x) / d) * 1.4 * want, ((h.y - e.y) / d) * 1.4 * want, dt)
    e.dir = toDir(h.x - e.x, h.y - e.y, e.dir)
    if (ai.t <= 0) {
      const n = ((ai.n as number) ?? 0) + 1
      ai.n = n
      if (n % 4 === 0) { ai.mode = 'rear'; ai.t = 0.6; ai.tell = 0.6 } else { ai.mode = 'aim'; ai.t = 0.5; ai.tell = 0.5 }
    }
    return
  }
  if (ai.mode === 'aim') {
    e.dir = toDir(h.x - e.x, h.y - e.y, e.dir)
    if (ai.t <= 0) {
      const a = Math.atan2(h.y - e.y, h.x - e.x)
      const offs = p2 ? [-0.3, 0, 0.3] : [0]
      for (const o of offs) shoot(c, e, 'spit', Math.cos(a + o) * 6, Math.sin(a + o) * 6, 0.28, 3)
      ai.mode = 'walk'
      ai.t = p2 ? 1.1 : 1.5
    }
    return
  }
  if (ai.mode === 'rear') {
    e.dir = toDir(h.x - e.x, h.y - e.y, e.dir)
    if (ai.t <= 0) { ai.mode = 'charge'; ai.t = 1.4 }
    return
  }
  if (ai.mode === 'charge') {
    const v = dirVec(e.dir)
    if (walk(c, e, v.x * 8, v.y * 8, dt)) {
      ai.mode = 'dazed'
      ai.t = 1.1
      c.s.shake = Math.max(c.s.shake, 0.25)
      c.ev.push({ type: 'boom', x: e.x + v.x * 0.8, y: e.y + v.y * 0.8 })
    } else if (ai.t <= 0) { ai.mode = 'walk'; ai.t = 1.2 }
    return
  }
  if (ai.mode === 'dazed' && ai.t <= 0) { ai.mode = 'walk'; ai.t = 1.0 }
}

// ---------------------------------------------------------------------------

export function mistral(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const s = c.s
  const h = s.hero
  const p2 = ai.phase === 2
  const room = cellRect(c.info, e.cell)
  if (ai.mode === 'idle') { ai.mode = 'float'; ai.t = 1.5; ai.tx = e.x; ai.ty = e.y; ai.phase = 1 }
  ai.ang = ((ai.ang as number) ?? 0) + dt * (ai.mode === 'down' ? 1 : p2 ? 7 : 5)
  if (ai.mode === 'down') {
    if (ai.t <= 0) { ai.mode = 'rise'; ai.t = 0.6; ai.tell = 0.6 }
    return
  }
  if (ai.mode === 'rise') { if (ai.t <= 0) { ai.mode = 'float'; ai.t = 1.2 } return }
  if (ai.mode === 'float') {
    const dx = (ai.tx as number) - e.x
    const dy = (ai.ty as number) - e.y
    const d = Math.hypot(dx, dy)
    if (d < 0.2) {
      ai.tx = rndRange(s, room.x + 4, room.x + room.w - 4)
      ai.ty = rndRange(s, room.y + 3, room.y + room.h - 4)
    } else {
      const sp = p2 ? 2.6 : 1.8
      e.x += (dx / d) * Math.min(d, sp * dt)
      e.y += (dy / d) * Math.min(d, sp * dt)
    }
    if (ai.t <= 0) {
      const n = ((ai.n as number) ?? 0) + 1
      ai.n = n
      if (n % 2 === 1) { ai.mode = 'inhale'; ai.t = 0.8; ai.tell = 0.8 } else { ai.mode = 'spin'; ai.t = 0.5; ai.tell = 0.5 }
    }
    return
  }
  if (ai.mode === 'inhale') {
    if (ai.t <= 0) { ai.mode = 'blow'; ai.t = p2 ? 1.8 : 1.4; ai.puff = 0 }
    return
  }
  if (ai.mode === 'blow') {
    // A cone of gusts at the hero: stand behind a pillar or hold your ground at the pits' edge.
    ai.puff = (ai.puff as number) - dt
    if ((ai.puff as number) <= 0) {
      ai.puff = 0.14
      const a = Math.atan2(h.y - e.y, h.x - e.x) + rndRange(s, -0.25, 0.25)
      shoot(c, e, 'gust', Math.cos(a) * 9, Math.sin(a) * 9, 0.45, 1.2)
    }
    if (ai.t <= 0) { ai.mode = 'float'; ai.t = p2 ? 1.6 : 2.4 }
    return
  }
  if (ai.mode === 'spin') {
    if (ai.t <= 0) {
      // Little whirlwinds all round, slow enough to walk between.
      const n = p2 ? 10 : 8
      const off = rnd(s) * Math.PI
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2
        shoot(c, e, 'gust', Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.4, 3)
      }
      ai.mode = 'float'
      ai.t = p2 ? 1.6 : 2.2
    }
  }
}

// ---------------------------------------------------------------------------

export function deepseek(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const s = c.s
  const h = s.hero
  const p2 = ai.phase === 2
  const room = cellRect(c.info, e.cell)
  if (ai.mode === 'idle') { ai.mode = 'under'; ai.t = 2; ai.phase = 1 }
  if (ai.mode === 'under') {
    // Seek: straight at the hero under the floor, walls or not (inside its room).
    const d = heroDist(c, e) || 1
    const sp = p2 ? 3.8 : 3
    e.x = Math.max(room.x + 1.5, Math.min(room.x + room.w - 1.5, e.x + ((h.x - e.x) / d) * Math.min(d, sp * dt)))
    e.y = Math.max(room.y + 1.5, Math.min(room.y + room.h - 1.5, e.y + ((h.y - e.y) / d) * Math.min(d, sp * dt)))
    if (ai.t <= 0 || d < 0.6) { ai.mode = 'rise'; ai.t = p2 ? 0.45 : 0.6; ai.tell = ai.t }
    return
  }
  if (ai.mode === 'rise') {
    if (ai.t <= 0) {
      ai.mode = 'up'
      ai.t = p2 ? 1.2 : 1.6
      s.shake = Math.max(s.shake, 0.2)
      // Surfacing right under the hero bites.
      if (heroDist(c, e) < e.r + HERO_R + 0.2) hurtHero(c, 2, e.x, e.y)
      // The lure flashes: a ring of pellets (knock them back for a bonus hit).
      if (p2) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; shoot(c, e, 'pellet', Math.cos(a) * 5, Math.sin(a) * 5) }
    }
    return
  }
  if (ai.mode === 'up' || ai.mode === 'hauled') {
    e.dir = toDir(h.x - e.x, h.y - e.y, e.dir)
    if (ai.mode === 'up' && seesHero(c, e, 3) && ai.tell <= 0 && ai.t > 0.5 && !ai.snapped) {
      ai.snapped = true
      ai.tell = 0.3
    }
    if (ai.t <= 0) { ai.mode = 'under'; ai.t = rndRange(s, 1.6, 2.6); ai.snapped = false }
  }
}

// ---------------------------------------------------------------------------

export function gemini(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const s = c.s
  const h = s.hero
  const room = cellRect(c.info, e.cell)
  const cx = room.x + room.w / 2
  const cy = room.y + room.h / 2
  if (typeof ai.ang !== 'number') {
    // The twin that starts west takes the far side of the circle.
    ai.ang = e.home.x < cx ? Math.PI : 0
    ai.fire = e.home.x < cx ? 1.2 : 2.4
    if (ai.mode === 'idle') ai.mode = 'orbit'
  }
  const twin = s.map.enemies.find(o => o !== e && o.kind === 'gemini' && o.cell === e.cell && !o.dead)
  if (ai.mode === 'down') {
    if (ai.t <= 0) {
      e.hp = 3
      ai.mode = 'orbit'
      ai.fire = 1
      ai.angry = true
      c.ev.push({ type: 'bossPhase', phase: 2 })
    }
    return
  }
  const alone = !twin || twin.ai.mode === 'down'
  const sp = (ai.angry ? 1.25 : 0.9) + (alone ? 0.4 : 0)
  ai.ang = (ai.ang as number) + dt * sp
  ai.rt = ((ai.rt as number) ?? 0) + dt
  const R = 3.3 + Math.sin((ai.rt as number) * 0.8) * 1.2
  e.x = cx + Math.cos(ai.ang as number) * R * 1.3
  e.y = cy + Math.sin(ai.ang as number) * R * 0.75
  ai.fire = (ai.fire as number) - dt
  if ((ai.fire as number) <= 0.5 && (ai.fire as number) > 0 && ai.tell <= 0) ai.tell = 0.5
  if ((ai.fire as number) <= 0) {
    ai.fire = alone ? 1.7 : 2.4
    const n = alone ? 8 : 6
    const off = rnd(s) * Math.PI
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2
      shoot(c, e, 'spark', Math.cos(a) * 4, Math.sin(a) * 4, 0.24, 3.5)
    }
  }
  // The tether between the twins burns (checked by the eastern twin only).
  if (twin && twin.ai.mode !== 'down' && e.home.x >= cx) {
    const ax = e.x
    const ay = e.y
    const bx = twin.x
    const by = twin.y
    const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1
    const t = Math.max(0, Math.min(1, ((h.x - ax) * (bx - ax) + (h.y - ay) * (by - ay)) / L2))
    const px = ax + (bx - ax) * t
    const py = ay + (by - ay) * t
    if (Math.hypot(h.x - px, h.y - py) < HERO_R + 0.12 && t > 0.08 && t < 0.92) hurtHero(c, 1, px, py, true)
  }
}
