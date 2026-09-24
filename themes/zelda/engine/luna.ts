/**
 * Luna, the girl who escaped Project Horizon, following the hero once she
 * has joined (flag `luna`): she walks the hero's trail a step behind, can
 * be talked to for a hint (the world's `luna` talk), and slides psi blocks
 * with her mind. NPCs with `hide` vanish after the talk that makes it hold;
 * one with `join` becomes the follower where she stood.
 *
 * Walk her back to where she joined (her fort) and she sits down there and
 * waits (flag `luna.home`); talking to her clears it and she follows again.
 */
import type { Dir, GameState } from '../types'
import { HERO_SPEED } from '../types'
import type { Ctx } from './combat'
import { TILE_INFO } from '../world/tiles'
import { condMet, has, tileAt } from './map'
import type { MarkAt } from './map'
import { openDialog } from './hero'
import { dirVec, toDir } from './util'

/** How far behind the hero she walks, along his trail (tiles). */
const GAP = 1.15
/** She sits down when the hero comes this close to her fort… */
const HOME_NEAR = 2.2
/** …once he has been this far from it since she joined. */
const HOME_AWAY = 3.5

export function placeLuna(s: GameState) {
  if (!has(s, 'luna') || has(s, 'luna.home')) { s.luna = null; return }
  const h = s.hero
  // A step behind the hero if there is floor there, else right on his heels.
  const v = dirVec(h.dir)
  let x = h.x - v.x * 0.9
  let y = h.y - v.y * 0.9
  const t = tileAt(s.map, Math.floor(x), Math.floor(y))
  if (TILE_INFO[t].solid || t === 'O' || t === 'D' || t === '>') { x = h.x; y = h.y }
  s.luna = { x, y, dir: h.dir, walkT: 0, trail: [{ x, y }, { x: h.x, y: h.y }], psi: 0 }
}

export function stepLuna(c: Ctx, dt: number) {
  const s = c.s
  const L = s.luna
  if (!L) return
  if (L.psi > 0) L.psi = Math.max(0, L.psi - dt)
  const h = s.hero
  const home = c.info.marks.find(mk => mk.ent.t === 'npc' && mk.ent.join)
  if (home) {
    const d = Math.hypot(h.x - home.x - 0.5, h.y - home.y - 0.5)
    if (!L.armed) { if (d > HOME_AWAY) L.armed = true }
    else if (d < HOME_NEAR && !h.auto && !s.hook) { sitDown(c, home); return }
  }
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

/** Back at her fort: she leaves the hero's heels and waits where she was found. */
function sitDown(c: Ctx, home: MarkAt) {
  const s = c.s
  if (home.ent.t !== 'npc') return
  s.flags['luna.home'] = true
  s.luna = null
  const x = home.x + 0.5
  const y = home.y + 0.5
  s.map.npcs.push({ id: home.ent.id, look: home.ent.look, x, y, dir: 'down', home: { x, y }, wander: false, t: 0, vx: 0, vy: 0 })
  openDialog(c, ['LUNA: MY FORT. I\'LL WAIT HERE.', 'LUNA: COME AND GET ME WHEN YOU NEED ME.'], 'luna')
  c.ev.push({ type: 'wait' })
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
      s.luna = { x: n.x, y: n.y, dir: n.dir, walkT: 0, trail: [{ x: s.hero.x, y: s.hero.y }], psi: 0, armed: false }
      c.ev.push({ type: 'join' })
    }
  }
}
