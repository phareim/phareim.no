/**
 * Everything that is neither hero nor enemy brain: bombs and blasts, the
 * Prism Disc, thrown pots, drops, projectiles, sliding blocks, pressure
 * plates, gates, chests/items that appear, and wandering NPCs.
 */
import type { Bomb, Cond } from '../types'
import { BOMB_FUSE, BOMB_RADIUS, DISC_RANGE, DISC_SPEED, HERO_R, PUSH_TIME, STAND_WAIT, THROW_RANGE } from '../types'
import { echoOnTile } from './echo'
import { PARROT } from './parrot'
import { stepMagnet } from './magnet'
import { stepGolemFall } from './bossGolem'
import { TILE_INFO, isIron } from '../world/tiles'
import { collectDrop, hitEnemy, hurtHero, rollDrop, type Ctx } from './combat'
import { breakShards, enemyActive } from './enemies'
import { cutTile, throwLever, toggleCrystal } from './hero'
import { cellIndex, circleBlocked, circleOnTile, clearFoes, condMet, has, moveCircle, setFlag, solidTile, tileAt, type GateInfo } from './map'
import { STATS } from './spawn'
import { nextId, rndRange } from './util'
import { isTube } from '../world/tubes'
import { stepAttendants } from './attendants'
import { stepGifts } from './gifts'
import { blastPuzzle, hitPuzzle, isWeighed, potSlides, pressedWeights, puzzleInfo, stepPhysics } from './puzzles/index'

export function stepObjects(c: Ctx, dt: number) {
  const m = c.s.map
  if (m.crystalCool) m.crystalCool = Math.max(0, m.crystalCool - dt)
  stepBombs(c, dt)
  stepDisc(c, dt)
  stepThrown(c, dt)
  stepProjectiles(c, dt)
  stepDrops(c, dt)
  stepBlocks(c, dt)
  stepPhysics(c, dt)
  stepMagnet(c, dt)
  stepGolemFall(c)
  stepPuzzles(c)
  stepStands(c, dt)
  stepNpcs(c, dt)
  stepAttendants(c, dt)
  stepGifts(c, dt)
}

// ---------------------------------------------------------------------------
// Bombs
// ---------------------------------------------------------------------------

function stepBombs(c: Ctx, dt: number) {
  const m = c.s.map
  for (let i = m.bombs.length - 1; i >= 0; i--) {
    const b = m.bombs[i]!
    b.t += dt
    if (b.t >= BOMB_FUSE) {
      m.bombs.splice(i, 1)
      explode(c, b.x, b.y, b.by)
    }
  }
  for (let i = m.blasts.length - 1; i >= 0; i--) {
    m.blasts[i]!.t += dt
    if (m.blasts[i]!.t > 0.5) m.blasts.splice(i, 1)
  }
}

/** `by`: the Parrot's bomb, or its copy's: the copy's never hurts the Parrot, its own only if it is still on it. */
export function explode(c: Ctx, x: number, y: number, by?: Bomb['by']) {
  const s = c.s
  const m = s.map
  m.blasts.push({ id: nextId(s), x, y, t: 0 })
  c.ev.push({ type: 'boom', x, y })
  c.ev.push({ type: 'hitStop', ms: 50 })
  s.shake = Math.max(s.shake, 0.35)
  for (const e of m.enemies) {
    if (!enemyActive(c, e)) continue
    if (e.kind === 'parrot' && by && (by === 'copy' || Math.hypot(e.x - x, e.y - y) >= PARROT.there)) continue
    if (Math.hypot(e.x - x, e.y - y) < BOMB_RADIUS + e.r) {
      if (e.kind === 'zapper') e.stun = Math.max(e.stun, 0.01)
      if (e.kind === 'king') { if (e.ai.mode === 'down') hitEnemy(c, e, 3, x, y, 'bomb') }
      else hitEnemy(c, e, e.kind === 'knight' ? 2 : 3, x, y, 'bomb')
    }
  }
  breakShards(c, x, y, BOMB_RADIUS)
  const h = s.hero
  if (Math.hypot(h.x - x, h.y - y) < BOMB_RADIUS + HERO_R - 0.2) hurtHero(c, 2, x, y)
  let secret = false
  const r = Math.ceil(BOMB_RADIUS)
  for (let ty = Math.floor(y) - r; ty <= Math.floor(y) + r; ty++) {
    for (let tx = Math.floor(x) - r; tx <= Math.floor(x) + r; tx++) {
      // Distance from blast centre to the nearest point of the tile.
      const nx = Math.max(tx, Math.min(x, tx + 1))
      const ny = Math.max(ty, Math.min(y, ty + 1))
      if (Math.hypot(nx - x, ny - y) > BOMB_RADIUS - 0.35) continue
      const t = tileAt(m, tx, ty)
      const info = TILE_INFO[t]
      if (info.bomb) {
        const i = ty * m.w + tx
        m.tiles[i] = '.'
        m.version++
        setFlag(s, `bomb:${m.id}:${i}`)
        secret = true
      } else if (info.cut) cutTile(c, tx, ty, t)
      else if (info.lift === 'pot') {
        m.tiles[ty * m.w + tx] = '.'
        m.version++
        c.ev.push({ type: 'shatter', x: tx + 0.5, y: ty + 0.5, kind: 'pot' })
        rollDrop(c, tx + 0.5, ty + 0.5, 0.5)
      } else if (t === 'c') toggleCrystal(c, tx, ty)
      else if (t === '}') throwLever(c, tx, ty)
      else if (t === 'ξ') hitPuzzle(c, tx, ty, t)
    }
  }
  blastPuzzle(c, x, y)
  if (secret) c.ev.push({ type: 'secret' })
}

// ---------------------------------------------------------------------------
// The Prism Disc
// ---------------------------------------------------------------------------

function stepDisc(c: Ctx, dt: number) {
  const s = c.s
  const d = s.disc
  if (!d) return
  const h = s.hero
  const m = s.map
  d.t += dt
  if (!d.returning) {
    d.x += d.vx * DISC_SPEED * dt
    d.y += d.vy * DISC_SPEED * dt
    if (d.t * DISC_SPEED >= DISC_RANGE || solidTile(c.w, m, Math.floor(d.x), Math.floor(d.y), 'shot')) {
      if (solidTile(c.w, m, Math.floor(d.x), Math.floor(d.y), 'shot')) c.ev.push({ type: 'clank', x: d.x, y: d.y })
      d.returning = true
    }
  } else {
    const dx = h.x - d.x
    const dy = h.y - d.y
    const len = Math.hypot(dx, dy)
    if (len < 0.45 || d.t > 4) {
      for (const id of d.carrying) {
        const i = m.drops.findIndex(q => q.id === id)
        if (i >= 0) { collectDrop(c, m.drops[i]!.kind); m.drops.splice(i, 1) }
      }
      s.disc = null
      return
    }
    const sp = DISC_SPEED * 1.15 * dt
    d.x += (dx / len) * Math.min(len, sp)
    d.y += (dy / len) * Math.min(len, sp)
  }
  // Hits
  for (const e of m.enemies) {
    if (!enemyActive(c, e) || d.hit.includes(e.id)) continue
    if (Math.hypot(e.x - d.x, e.y - d.y) < e.r + 0.3) {
      d.hit.push(e.id)
      hitEnemy(c, e, 1, d.x, d.y, 'disc')
      d.returning = true
    }
  }
  if (breakShards(c, d.x, d.y, 0.3)) d.returning = true
  const tx = Math.floor(d.x)
  const ty = Math.floor(d.y)
  const key = `t${tx},${ty}`
  if (tileAt(m, tx, ty) === 'c' && !d.hit.includes(key)) {
    d.hit.push(key)
    toggleCrystal(c, tx, ty)
    d.returning = true
  }
  if (tileAt(m, tx, ty) === '}' && !d.hit.includes(key)) {
    d.hit.push(key)
    throwLever(c, tx, ty)
    d.returning = true
  }
  // (A lumen tube under the hero's own feet is not the disc's to turn: it starts out over it.)
  const own = isTube(tileAt(m, tx, ty)) && tx === Math.floor(c.s.hero.x) && ty === Math.floor(c.s.hero.y)
  if (!d.hit.includes(key) && !own && hitPuzzle(c, tx, ty, tileAt(m, tx, ty))) { d.hit.push(key); d.returning = true }
  for (const q of m.drops) {
    if (!d.carrying.includes(q.id) && Math.hypot(q.x - d.x, q.y - d.y) < 0.5) d.carrying.push(q.id)
  }
  for (const id of d.carrying) {
    const q = m.drops.find(o => o.id === id)
    if (q) { q.x = d.x; q.y = d.y; q.z = 0 }
  }
}

// ---------------------------------------------------------------------------
// Thrown pots and rocks
// ---------------------------------------------------------------------------

function stepThrown(c: Ctx, dt: number) {
  const m = c.s.map
  for (let i = m.thrown.length - 1; i >= 0; i--) {
    const o = m.thrown[i]!
    const step = Math.hypot(o.vx, o.vy) * dt
    o.x += o.vx * dt
    o.y += o.vy * dt
    o.dist += step
    const p = Math.min(1, o.dist / THROW_RANGE)
    o.z = 0.9 * (1 - p * p)
    // (Come down on ice, it slides on until it hits something.)
    let smash = (o.dist >= THROW_RANGE && !potSlides(c, o)) || solidTile(c.w, m, Math.floor(o.x), Math.floor(o.y), 'shot')
    for (const e of m.enemies) {
      if (!enemyActive(c, e)) continue
      if (Math.hypot(e.x - o.x, e.y - o.y) < e.r + 0.35) {
        if (e.kind === 'zapper') e.stun = Math.max(e.stun, 0.01)
        hitEnemy(c, e, 2, o.x - o.vx * 0.1, o.y - o.vy * 0.1, 'pot')
        smash = true
      }
    }
    if (breakShards(c, o.x, o.y, 0.3)) smash = true
    if (tileAt(m, Math.floor(o.x), Math.floor(o.y)) === 'c') { toggleCrystal(c, Math.floor(o.x), Math.floor(o.y)); smash = true }
    if (smash) {
      m.thrown.splice(i, 1)
      const bx = o.x - o.vx * 0.02
      const by = o.y - o.vy * 0.02
      c.ev.push({ type: 'shatter', x: bx, y: by, kind: o.kind })
      if (o.kind === 'pot') rollDrop(c, bx, by, 0.45)
    }
  }
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

function stepProjectiles(c: Ctx, dt: number) {
  const s = c.s
  const m = s.map
  const h = s.hero
  for (let i = m.projectiles.length - 1; i >= 0; i--) {
    const p = m.projectiles[i]!
    // The Steamhouse's gifts fly by their own rules (`gifts.ts`).
    if (p.kind === 'gift') continue
    p.t += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    let dead = p.t > p.life || solidTile(c.w, m, Math.floor(p.x), Math.floor(p.y), 'shot')
    if (p.friendly) {
      // Beams and reflected shots flip switches and throw levers on their way.
      const tx = Math.floor(p.x)
      const ty = Math.floor(p.y)
      const t = tileAt(m, tx, ty)
      if (t === 'c') { toggleCrystal(c, tx, ty); dead = true } else if (t === '}') { throwLever(c, tx, ty); dead = true }
    }
    if (!dead && !p.friendly && p.kind === 'gust') {
      // Wind: no harm, a hard shove (towards the pits, if Mistral has aimed well).
      if (Math.hypot(h.x - p.x, h.y - p.y) < p.r + HERO_R && h.act !== 'fall' && !s.hook && !h.air) {
        const len = Math.hypot(p.vx, p.vy) || 1
        h.knock = { vx: (p.vx / len) * 9, vy: (p.vy / len) * 9, t: 0.32 }
        h.swing = null
        h.charge = -1
        c.ev.push({ type: 'gust', x: p.x, y: p.y })
        dead = true
      }
    } else if (!dead && !p.friendly && Math.hypot(h.x - p.x, h.y - p.y) < p.r + HERO_R) {
      if (hurtHero(c, p.kind === 'laser' || p.kind === 'spark' ? 2 : 1, p.x - p.vx * 0.05, p.y - p.vy * 0.05, false, true)) dead = true
      else if (h.invuln > 0) dead = p.kind !== 'laser'
    }
    if (!dead && p.friendly) {
      for (const e of m.enemies) {
        if (!enemyActive(c, e) || e.kind === 'eye') continue
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
          hitEnemy(c, e, 2, p.x - p.vx * 0.05, p.y - p.vy * 0.05, p.kind === 'spit' ? 'spit' : 'shot')
          dead = true
          break
        }
      }
    }
    if (dead) m.projectiles.splice(i, 1)
  }
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

function stepDrops(c: Ctx, dt: number) {
  const m = c.s.map
  for (let i = m.drops.length - 1; i >= 0; i--) {
    const d = m.drops[i]!
    d.t += dt
    if (d.z > 0 || d.vz > 0) {
      d.vz -= 22 * dt
      d.z += d.vz * dt
      if (d.z <= 0) { d.z = 0; d.vz = Math.abs(d.vz) > 3 ? -d.vz * 0.35 : 0 }
    }
    if (d.t > d.life) m.drops.splice(i, 1)
  }
}

// ---------------------------------------------------------------------------
// Blocks, plates, gates, appearing things
// ---------------------------------------------------------------------------

function stepBlocks(c: Ctx, dt: number) {
  const m = c.s.map
  for (let i = m.moving.length - 1; i >= 0; i--) {
    const b = m.moving[i]!
    b.t += dt
    if (b.t >= (b.dur ?? PUSH_TIME)) m.moving.splice(i, 1)
  }
}

function stepPuzzles(c: Ctx) {
  const s = c.s
  const m = s.map
  // Plates: pressed by a resting block.
  const pressed: string[] = []
  c.info.plates.forEach((id, idx) => {
    if (isWeighed(c, idx)) return // weighed plates and scales: `puzzles/`
    const tx = idx % m.w
    const ty = Math.floor(idx / m.w)
    const moving = m.moving.some(b => b.tx === tx && b.ty === ty)
    // (The echo holds a plain plate as a block does, and so does iron come to rest on it.)
    if (((m.tiles[idx] === 'b' || m.tiles[idx] === 'B' || isIron(m.tiles[idx]!)) && !moving) || echoOnTile(c, tx, ty)) pressed.push(id)
  })
  pressed.push(...pressedWeights(c))
  for (const id of pressed) {
    if (!m.plates.includes(id)) {
      // (An unmarked weighed plate is not in the map's plates: its id is `w:<tile>`, from `puzzleInfo`.)
      const at = [...c.info.plates, ...puzzleInfo(c.info).weights].find(([, v]) => v === id)
      if (at) c.ev.push({ type: 'plate', x: (at[0] % m.w) + 0.5, y: Math.floor(at[0] / m.w) + 0.5 })
    }
  }
  m.plates = pressed
  // Gates.
  for (const g of c.info.gates) {
    if (g.trap) { stepTrap(c, g); continue }
    if (g.latch) { stepHeld(c, g, g.latch); continue }
    if (m.tiles[g.tiles[0]!] !== 'X') continue
    if (!condMet(s, c.w, g.open, g.cell)) continue
    for (const i of g.tiles) m.tiles[i] = '.'
    m.version++
    setFlag(s, `gate:${g.id}`)
    const i0 = g.tiles[0]!
    c.ev.push({ type: 'gate', x: (i0 % m.w) + 0.5, y: Math.floor(i0 / m.w) + 0.5 })
    c.ev.push({ type: 'secret' })
  }
  // Chests that appear.
  const h = s.hero
  for (const ch of c.info.chestList) {
    if (!ch.appear || has(s, `appear:${ch.id}`)) continue
    if (!condMet(s, c.w, ch.appear, ch.cell)) continue
    const cx = Math.max(ch.x, Math.min(h.x, ch.x + 1))
    const cy = Math.max(ch.y, Math.min(h.y, ch.y + 1))
    if ((h.x - cx) ** 2 + (h.y - cy) ** 2 < HERO_R * HERO_R) continue // wait until the hero steps off
    m.tiles[ch.idx] = '$'
    m.version++
    setFlag(s, `appear:${ch.id}`)
    c.ev.push({ type: 'secret' })
  }
  for (const p of m.pickups) {
    if (p.hidden && condMet(s, c.w, p.appear, -1)) {
      p.hidden = false
      c.ev.push({ type: 'secret' })
    }
  }
}

/**
 * A trap gate: open until the hero is in its room and clear of its tiles while a foe the room's `clear` counts still
 * lives, then shut; open for good (`gate:<id>`) once the room is clear. Loading the map and entering a room put an
 * unsolved one back to open (`loadMap`, `enterCell`).
 */
function stepTrap(c: Ctx, g: GateInfo) {
  const s = c.s
  const m = s.map
  const flag = `gate:${g.id}`
  if (s.demo || has(s, flag)) return
  const shut = m.tiles[g.tiles[0]!] === 'X'
  const i0 = g.tiles[0]!
  const at = { x: (i0 % m.w) + 0.5, y: Math.floor(i0 / m.w) + 0.5 }
  if (condMet(s, c.w, g.open, g.cell)) {
    if (shut) {
      for (const i of g.tiles) m.tiles[i] = '.'
      m.version++
      c.ev.push({ type: 'gate', ...at })
    }
    setFlag(s, flag)
    c.ev.push({ type: 'secret' })
    return
  }
  const h = s.hero
  // (Not while the chain is out: a pull flies him over whatever lies on its way.)
  if (shut || s.zoneIndex !== g.cell || cellIndex(c.info, h.x, h.y) !== g.cell || s.hook) return
  if (!clearFoes(s, g.cell).some(e => !e.dead)) return
  if (!clearToShut(c, g)) return
  for (const i of g.tiles) m.tiles[i] = 'X'
  m.version++
  s.shake = Math.max(s.shake, 0.25)
  c.ev.push({ type: 'gate', ...at, shut: true })
}

/** Never down on anyone or anything: the hero, a walking foe, a block come to rest in the doorway. */
function clearToShut(c: Ctx, g: GateInfo): boolean {
  const m = c.s.map
  const h = c.s.hero
  return g.tiles.every(i => {
    const tx = i % m.w
    const ty = Math.floor(i / m.w)
    if (m.tiles[i] !== '.' || circleOnTile(h.x, h.y, HERO_R, tx, ty) || echoOnTile(c, tx, ty)) return false
    return !m.enemies.some(e => !e.dead && !STATS[e.kind].flying && circleOnTile(e.x, e.y, e.r, tx, ty))
  })
}

/**
 * A held gate (`latch`): open while its `open` holds (a plate stood on), shut again when it does not, and open for
 * good (`gate:<id>`) once the latch holds.
 */
function stepHeld(c: Ctx, g: GateInfo, latch: Cond) {
  const s = c.s
  const m = s.map
  const flag = `gate:${g.id}`
  if (s.demo || has(s, flag)) return
  const shut = m.tiles[g.tiles[0]!] === 'X'
  const i0 = g.tiles[0]!
  const at = { x: (i0 % m.w) + 0.5, y: Math.floor(i0 / m.w) + 0.5 }
  const latched = condMet(s, c.w, latch, g.cell)
  if (latched || condMet(s, c.w, g.open, g.cell)) {
    if (shut) {
      for (const i of g.tiles) m.tiles[i] = '.'
      m.version++
      c.ev.push({ type: 'gate', ...at })
    }
    if (latched) { setFlag(s, flag); c.ev.push({ type: 'secret' }) }
    return
  }
  if (shut || !clearToShut(c, g)) return
  for (const i of g.tiles) m.tiles[i] = 'X'
  m.version++
  c.ev.push({ type: 'gate', ...at, shut: true })
}

/**
 * Pot stands: while the hero's room holds no pot at all (none standing, none in the hands, none in the air), the
 * clock runs; at `STAND_WAIT`, with every stand of the room free to stand on, each gets a pot back.
 */
function stepStands(c: Ctx, dt: number) {
  const s = c.s
  const m = s.map
  if (!c.info.stands.length) return
  const stands = c.info.stands.filter(i => cellIndex(c.info, (i % m.w) + 0.5, Math.floor(i / m.w) + 0.5) === s.zoneIndex)
  if (!stands.length) { m.standT = 0; return }
  const z = s.zone
  let any = s.hero.carry === 'pot' || m.thrown.some(o => o.kind === 'pot')
  for (let y = z.y; y < z.y + z.h && !any; y++) for (let x = z.x; x < z.x + z.w; x++) if (m.tiles[y * m.w + x] === 'o') { any = true; break }
  if (any) { m.standT = 0; return }
  m.standT = (m.standT ?? 0) + dt
  if (m.standT < STAND_WAIT) return
  const h = s.hero
  const free = stands.every(i => {
    const tx = i % m.w
    const ty = Math.floor(i / m.w)
    if (circleOnTile(h.x, h.y, HERO_R, tx, ty) || echoOnTile(c, tx, ty)) return false
    if (m.bombs.some(b => circleOnTile(b.x, b.y, 0.2, tx, ty))) return false
    return !m.enemies.some(e => !e.dead && !STATS[e.kind].flying && circleOnTile(e.x, e.y, e.r, tx, ty))
  })
  if (!free) return
  for (const i of stands) {
    m.tiles[i] = 'o'
    c.ev.push({ type: 'restock', x: (i % m.w) + 0.5, y: Math.floor(i / m.w) + 0.5 })
  }
  m.version++
  m.standT = 0
}

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

function stepNpcs(c: Ctx, dt: number) {
  const s = c.s
  for (const n of s.map.npcs) {
    n.t -= dt
    if (!n.wander) continue
    if (n.t <= 0) {
      if (n.vx || n.vy) { n.vx = 0; n.vy = 0; n.t = rndRange(s, 1, 2.5) }
      else {
        const a = Math.floor(rndRange(s, 0, 4))
        const dirs = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']] as const
        const [vx, vy, d] = dirs[a]!
        n.vx = vx * 1.1
        n.vy = vy * 1.1
        n.dir = d
        n.t = rndRange(s, 0.6, 1.4)
      }
    }
    if (n.vx || n.vy) {
      const nx = n.x + n.vx * dt
      const ny = n.y + n.vy * dt
      const far = Math.hypot(nx - n.home.x, ny - n.home.y) > 2.2
      const h = s.hero
      const bump = Math.hypot(nx - h.x, ny - h.y) < 0.36 + HERO_R + 0.05
      if (far || bump || circleBlocked(c.w, s.map, nx, ny, 0.34, 'enemy')) { n.vx = 0; n.vy = 0; n.t = 0.8 }
      else {
        const r = moveCircle(c.w, s.map, n.x, n.y, 0.34, n.vx * dt, n.vy * dt, 'enemy')
        n.x = r.x
        n.y = r.y
      }
    }
  }
}
