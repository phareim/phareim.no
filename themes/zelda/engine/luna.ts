/**
 * Luna, the girl who escaped Project Horizon, following the hero once she
 * has joined (flag `luna`): she walks the hero's trail a step behind, can
 * be talked to for a hint (the world's `luna` talk), and slides psi blocks
 * with her mind. NPCs with `hide` vanish after the talk that makes it hold;
 * one with `join` becomes the follower where she stood.
 */
import type { Dir, GameState } from '../types'
import { HERO_SPEED } from '../types'
import type { Ctx } from './combat'
import { condMet, has } from './map'
import { toDir } from './util'

/** How far behind the hero she walks, along his trail (tiles). */
const GAP = 1.15

export function placeLuna(s: GameState) {
  if (!has(s, 'luna')) { s.luna = null; return }
  const h = s.hero
  s.luna = { x: h.x, y: h.y, dir: h.dir, walkT: 0, trail: [{ x: h.x, y: h.y }], psi: 0 }
}

export function stepLuna(c: Ctx, dt: number) {
  const s = c.s
  const L = s.luna
  if (!L) return
  if (L.psi > 0) L.psi = Math.max(0, L.psi - dt)
  const h = s.hero
  const last = L.trail[L.trail.length - 1]
  if (!last || Math.hypot(h.x - last.x, h.y - last.y) > 0.08) {
    L.trail.push({ x: h.x, y: h.y })
    if (L.trail.length > 60) L.trail.shift()
  }
  // The point GAP tiles back along the trail.
  let need = GAP
  let tx = L.trail[L.trail.length - 1]!.x
  let ty = L.trail[L.trail.length - 1]!.y
  for (let i = L.trail.length - 1; i > 0; i--) {
    const a = L.trail[i]!
    const b = L.trail[i - 1]!
    const len = Math.hypot(a.x - b.x, a.y - b.y)
    if (len >= need) { tx = a.x + ((b.x - a.x) * need) / len; ty = a.y + ((b.y - a.y) * need) / len; need = 0; break }
    need -= len
    tx = b.x
    ty = b.y
  }
  const dx = tx - L.x
  const dy = ty - L.y
  const d = Math.hypot(dx, dy)
  if (d > 5) { L.x = tx; L.y = ty; return }
  if (d > 0.04) {
    const sp = Math.min(d, HERO_SPEED * 1.2 * dt)
    L.x += (dx / d) * sp
    L.y += (dy / d) * sp
    L.walkT += dt
    L.dir = toDir(dx, dy, L.dir) as Dir
  } else if (L.walkT > 0) L.walkT = 0
}

/** After a talk: NPCs whose `hide` now holds leave; a `join` NPC becomes Luna. */
export function refreshNpcs(c: Ctx) {
  const s = c.s
  const m = s.map
  for (const mk of c.info.marks) {
    const e = mk.ent
    if (e.t !== 'npc' || !e.hide) continue
    const i = m.npcs.findIndex(n => n.id === e.id)
    if (i < 0 || !condMet(s, c.w, e.hide, -1)) continue
    const n = m.npcs[i]!
    m.npcs.splice(i, 1)
    if (e.join) {
      s.flags.luna = true
      s.luna = { x: n.x, y: n.y, dir: n.dir, walkT: 0, trail: [{ x: s.hero.x, y: s.hero.y }], psi: 0 }
      c.ev.push({ type: 'join' })
    }
  }
}
