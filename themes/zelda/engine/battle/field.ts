/**
 * Field battles, out in the field: the foe groups of a map with
 * `MapDef.battle` stand on it as ordinary enemies (drawn as their look's
 * kind) marked with `Enemy.group`. They do not fight in real time: they
 * mill about their spot, and touching one (or being seen by a group with
 * `sight`, or striking one) starts the fight where everyone stands.
 */
import type { Enemy, MapBattleDef, MapState } from '../../types'
import { HERO_R } from '../../types'
import type { Ctx } from '../combat'
import { spawnEnemy } from '../spawn'
import { cellIndex, circleBlocked, has, lineClear, moveCircle, type MapInfo } from '../map'
import type { GameState, World } from '../../types'
import { rnd } from '../util'
import { FOES } from './data'
import { startBattle } from './fight'

/** Where the foes of a group of n stand round its spot (tiles). */
const CLUSTER: Array<Array<[number, number]>> = [
  [[0, 0]],
  [[-0.7, 0], [0.7, 0]],
  [[-0.9, 0.4], [0.9, 0.4], [0, -0.6]],
  [[-1, -0.5], [1, -0.5], [-0.5, 0.6], [0.6, 0.6]],
]

/** The group's foes as enemies, for `loadMap`. A group won for good (`once`) stays away. */
export function fieldFoes(world: World, s: GameState, info: MapInfo, def: MapBattleDef): Enemy[] {
  const out: Enemy[] = []
  for (const g of def.groups) {
    if (g.once && has(s, `battle:${g.id}`)) continue
    const spots = CLUSTER[Math.min(g.foes.length, 4) - 1]!
    g.foes.slice(0, 4).forEach((f, i) => {
      const [dx, dy] = spots[i]!
      const x = g.x + dx
      const y = g.y + dy
      const e = spawnEnemy(`${info.def.id}:battle:${g.id}:${i}`, FOES[f].look, x, y, 'down', cellIndex(info, x, y))
      e.group = g.id
      e.ai.mode = 'idle'
      e.ai.foe = f
      out.push(e)
    })
  }
  return out
}

/** The field step on a battle map: foes mill about; contact or a sighting starts the fight. */
export function stepField(c: Ctx, dt: number) {
  const def = c.info.def.battle
  if (!def) return
  const s = c.s
  const h = s.hero
  for (const e of s.map.enemies) {
    if (!e.group || e.dead) continue
    if (e.flash > 0) e.flash -= dt
    if (e.stun > 0) { e.stun = Math.max(0, e.stun - dt); continue }
    mill(c, e, dt)
  }
  if (h.auto || s.hook || h.act === 'fall' || h.act === 'dead' || s.mode !== 'play') return
  for (const g of def.groups) {
    const foes = s.map.enemies.filter(e => e.group === g.id && !e.dead)
    if (!foes.length || foes.some(e => e.stun > 0)) continue
    if (foes.some(e => Math.hypot(e.x - h.x, e.y - h.y) < e.r + HERO_R + 0.05)) { startBattle(c, g.id, null); return }
    if (g.sight && foes.some(e => Math.hypot(e.x - h.x, e.y - h.y) < g.sight! && lineClear(c.w, s.map, e.x, e.y, h.x, h.y))) {
      startBattle(c, g.id, 'foes')
      return
    }
  }
}

/** A slow stroll round its spot, flying ones a little wider. */
function mill(c: Ctx, e: Enemy, dt: number) {
  const s = c.s
  e.ai.t -= dt
  if (e.ai.t <= 0) {
    const fly = FOES[e.ai.foe as keyof typeof FOES]?.look === 'bat' || e.kind === 'drone'
    const r = fly ? 0.9 : 0.5
    e.ai.tx = e.home.x + (rnd(s) * 2 - 1) * r
    e.ai.ty = e.home.y + (rnd(s) * 2 - 1) * r
    e.ai.t = 1.2 + rnd(s) * 1.6
  }
  const tx = (e.ai.tx as number | undefined) ?? e.home.x
  const ty = (e.ai.ty as number | undefined) ?? e.home.y
  const dx = tx - e.x
  const dy = ty - e.y
  const d = Math.hypot(dx, dy)
  if (d < 0.05) { e.ai.mode = 'idle'; return }
  const sp = Math.min(d, 0.9 * dt)
  const fly = e.kind === 'bat' || e.kind === 'drone'
  const r = moveCircle(c.w, s.map, e.x, e.y, e.r * 0.8, (dx / d) * sp, (dy / d) * sp, fly ? 'fly' : 'enemy')
  e.x = r.x
  e.y = r.y
  e.ai.mode = 'walk'
  if (Math.abs(dx) > Math.abs(dy)) e.dir = dx < 0 ? 'left' : 'right'
  else e.dir = dy < 0 ? 'up' : 'down'
}

/** A free spot for a walker near (x, y) (spiralling out to `max` tiles), or null. */
export function freeSpot(world: World, m: MapState, x: number, y: number, r: number, max = 2): { x: number; y: number } | null {
  if (!circleBlocked(world, m, x, y, r)) return { x, y }
  for (let d = 0.5; d <= max; d += 0.5) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const px = x + Math.cos(a) * d
      const py = y + Math.sin(a) * d
      if (!circleBlocked(world, m, px, py, r)) return { x: px, y: py }
    }
  }
  return null
}
