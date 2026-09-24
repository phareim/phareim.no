/**
 * The grappling hook (B, once found in Horizon Lab). It flies straight
 * along the hero's facing. It bites into a hook post, pillar, torch or
 * chest and reels the hero over whatever lies between (pits, water,
 * spikes); it stuns what it strikes and drags small loot back. It never
 * leaves the hero's camera room, so a pull never crosses a doorway.
 * While the chain is out the hero stands still.
 */
import { HERO_R, HOOK_PULL_SPEED, HOOK_RANGE, HOOK_SPEED } from '../types'
import { TILE_INFO } from '../world/tiles'
import { collectDrop, hitEnemy, type Ctx } from './combat'
import { enemyActive } from './enemies'
import { toggleCrystal, throwLever } from './hero'
import { cellIndex, circleBlocked, solidTile, tileAt } from './map'
import { dirVec } from './util'

export function fireHook(c: Ctx) {
  const s = c.s
  const h = s.hero
  if (s.hook) return
  const v = dirVec(h.dir)
  s.hook = { x: h.x + v.x * 0.35, y: h.y + v.y * 0.35, dx: v.x, dy: v.y, dist: 0, phase: 'out', to: null, hit: [], carrying: [] }
  h.act = 'hook'
  h.actT = 0
  h.charge = -1
  h.vx = 0
  h.vy = 0
  c.ev.push({ type: 'hook' })
}

export function stepHook(c: Ctx, dt: number) {
  const s = c.s
  const k = s.hook
  if (!k) return
  const h = s.hero
  const m = s.map
  if (k.phase === 'out') {
    const home = cellIndex(c.info, h.x, h.y)
    let left = HOOK_SPEED * dt
    while (left > 1e-9 && k.phase === 'out') {
      const d = Math.min(0.2, left)
      left -= d
      k.x += k.dx * d
      k.y += k.dy * d
      k.dist += d
      const tx = Math.floor(k.x)
      const ty = Math.floor(k.y)
      const t = tileAt(m, tx, ty)
      if (c.info.def.kind === 'dungeon' && cellIndex(c.info, k.x, k.y) !== home) { clank(c); break }
      if (TILE_INFO[t].hook) {
        // Reel in to the tile in front of the anchor, centred on its line.
        const to = { x: tx + 0.5 - k.dx, y: ty + 0.5 - k.dy }
        if (k.dx !== 0) to.y = ty + 0.5
        else to.x = tx + 0.5
        if (Math.hypot(to.x - h.x, to.y - h.y) < 0.3) { clank(c); break }
        k.x = tx + 0.5 - k.dx * 0.5
        k.y = ty + 0.5 - k.dy * 0.5
        k.phase = 'pull'
        k.to = to
        c.ev.push({ type: 'hookHit', x: k.x, y: k.y })
        c.ev.push({ type: 'pull' })
        break
      }
      if (t === '}') { throwLever(c, tx, ty); k.phase = 'back'; break }
      if (t === 'c' && !k.hit.includes(`t${tx},${ty}`)) { k.hit.push(`t${tx},${ty}`); toggleCrystal(c, tx, ty); k.phase = 'back'; break }
      if (solidTile(c.w, m, tx, ty, 'fly')) { clank(c); break }
      for (const e of m.enemies) {
        if (!enemyActive(c, e) || k.hit.includes(e.id)) continue
        if (Math.hypot(e.x - k.x, e.y - k.y) < e.r + 0.25) {
          k.hit.push(e.id)
          hitEnemy(c, e, 1, k.x, k.y, 'hook')
          k.phase = 'back'
          break
        }
      }
      for (const q of m.drops) {
        if (!k.carrying.includes(q.id) && q.t > 0.25 && Math.hypot(q.x - k.x, q.y - k.y) < 0.5) { k.carrying.push(q.id); k.phase = 'back' }
      }
      if (k.dist >= HOOK_RANGE) k.phase = 'back'
    }
  } else if (k.phase === 'back') {
    const dx = h.x - k.x
    const dy = h.y - k.y
    const len = Math.hypot(dx, dy)
    const sp = HOOK_SPEED * 1.25 * dt
    if (len <= sp + 0.3) {
      for (const id of k.carrying) {
        const i = m.drops.findIndex(q => q.id === id)
        if (i >= 0) { collectDrop(c, m.drops[i]!.kind); m.drops.splice(i, 1) }
      }
      s.hook = null
      h.act = 'idle'
      return
    }
    k.x += (dx / len) * sp
    k.y += (dy / len) * sp
  } else {
    // Pull: the hero flies over the floor to the anchor; nothing touches him on the way.
    const to = k.to!
    const dx = to.x - h.x
    const dy = to.y - h.y
    const len = Math.hypot(dx, dy)
    const sp = HOOK_PULL_SPEED * dt
    h.invuln = Math.max(h.invuln, 0.05)
    if (len > sp) {
      h.x += (dx / len) * sp
      h.y += (dy / len) * sp
      return
    }
    h.x = to.x
    h.y = to.y
    s.hook = null
    h.act = 'idle'
    settle(c, -k.dx, -k.dy)
    h.safe = { x: h.x, y: h.y }
  }
  for (const id of k.carrying) {
    const q = m.drops.find(o => o.id === id)
    if (q) { q.x = k.x; q.y = k.y; q.z = 0 }
  }
}

function clank(c: Ctx) {
  const k = c.s.hook!
  c.ev.push({ type: 'clank', x: k.x, y: k.y })
  k.phase = 'back'
}

/** After a pull: never end inside a wall, over a pit or in water — back off along the chain. */
function settle(c: Ctx, bx: number, by: number) {
  const h = c.s.hero
  const m = c.s.map
  for (let i = 0; i < 40; i++) {
    const t = tileAt(m, Math.floor(h.x), Math.floor(h.y))
    if (!circleBlocked(c.w, m, h.x, h.y, HERO_R) && t !== 'O' && t !== '~') return
    h.x += bx * 0.25
    h.y += by * 0.25
  }
}
