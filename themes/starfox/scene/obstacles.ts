/**
 * Obstacles: each biome's props in place of the old pillars and rocks
 * (models/props.ts, instanced), plus mines and arches in the biome's
 * neon (biomeAccent). The rules stay the old ones: a `tall` prop stands on
 * the ground and hurts on contact (a cylinder, trees add a crown sphere),
 * a `float` prop hangs in the lane and breaks when shot or hit, mines
 * fuse near a ship and chain, arches are a window to thread.
 */
import * as THREE from 'three'
import { DMG, MINE_BLAST_RADIUS, MINE_FUSE_RADIUS, MINE_SCORE, MAX_MINES, MAX_ARCHES } from '../balance'
import { createPropField, geyserJet, biomeAccent, type PropField } from '../models/props'
import { P, geo, hullMat, glowMat, mesh, setMat } from '../models/core'
import type { ObstacleKind } from '../encounters'
import type { BiomeId } from '../pixel'
import { GROUND_Y, LANE_Y_HI, LANE_Y_LO, SPAWN_Z, addScore, clamp, live, rand, type Ctx } from './ctx'

export interface Obstacles {
  setBiome(id: BiomeId): void
  /** `x` normalised (−1…1) or null for anywhere. */
  spawn(kind: ObstacleKind, x: number | null): void
  spawnMine(x: number, y: number, z: number): boolean
  update(dt: number): void
  /** A laser at (x, y, z): 0 nothing, 1 stopped by a prop, 2 popped a mine or broke a rock. */
  laserHit(x: number, y: number, z: number): number
  /** Bomb / charge blast: pops mines and breaks floating props in the radius. */
  blast(x: number, y: number, z: number, r: number): void
  /** Steer a flyer's target round what is ahead of it (AI, autopilot). */
  avoid(tx: number, ty: number, out: { x: number; y: number }): void
  clear(): void
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
  readonly mines: number
}

const MAX_TALL = 16
const MAX_FLOAT = 10
const MINE_POOL = 8
const ARCH_HALF_W = 3.5
const ARCH_TOP = 9
/** Past the ship a prop only blocks the camera: it goes (collision is done by then). */
const PAST_Z = 3

interface Tall { active: boolean; x: number; z: number; w: number; h: number; maxH: number; spin: number; v: number; phase: number; geyser: boolean }
interface Float { active: boolean; x: number; y: number; z: number; r: number; spin: number; v: number }
interface Mine { root: THREE.Group; glow: THREE.Mesh; active: boolean; x: number; y: number; z: number; pulse: number }
interface Arch { root: THREE.Group; parts: THREE.Mesh[]; active: boolean; x: number; gapY: number; gapH: number; z: number }

export function createObstacles(ctx: Ctx): Obstacles {
  const tallField: PropField = createPropField('tall', MAX_TALL)
  const floatField: PropField = createPropField('float', MAX_FLOAT)
  ctx.scene.add(tallField.root, floatField.root)
  const talls: Tall[] = []
  for (let i = 0; i < MAX_TALL; i++) talls.push({ active: false, x: 0, z: 0, w: 3, h: 8, maxH: 8, spin: 0, v: 0, phase: 0, geyser: false })
  const floats: Float[] = []
  for (let i = 0; i < MAX_FLOAT; i++) floats.push({ active: false, x: 0, y: 0, z: 0, r: 1.5, spin: 0, v: 0 })

  // Mines: a dark core with spikes in the biome's neon.
  const mineCore = geo('obst/mine-core', g => { g.add(new THREE.IcosahedronGeometry(0.75, 0)) })
  const mineSpikes = geo('obst/mine-spikes', g => {
    const dirs: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
    for (const [x, y, z] of dirs) g.box(x * 0.85, y * 0.85, z * 0.85, x ? 0.55 : 0.22, y ? 0.55 : 0.22, z ? 0.55 : 0.22)
  })
  const mines: Mine[] = []
  for (let i = 0; i < MINE_POOL; i++) {
    const root = new THREE.Group()
    mesh(mineCore, hullMat(P.stoneDeep), root)
    const glow = mesh(mineSpikes, glowMat(P.hot), root)
    root.visible = false
    ctx.scene.add(root)
    mines.push({ root, glow, active: false, x: 0, y: 0, z: 0, pulse: 0 })
  }

  // Arches: two posts, a sill and a lintel in stone, a neon frame round the window.
  const unit = geo('obst/unit-box', g => { g.box(0, 0, 0, 1, 1, 1) })
  const arches: Arch[] = []
  for (let i = 0; i < MAX_ARCHES; i++) {
    const root = new THREE.Group()
    const parts: THREE.Mesh[] = []
    for (let k = 0; k < 4; k++) parts.push(mesh(unit, hullMat(P.stone), root))
    for (let k = 0; k < 4; k++) parts.push(mesh(unit, glowMat(P.hot), root))
    root.visible = false
    ctx.scene.add(root)
    arches.push({ root, parts, active: false, x: 0, gapY: 2, gapH: 3.4, z: 0 })
  }

  let accent = P.hot as string
  let mineCount = 0

  function freeTall(): Tall | null { for (const t of talls) if (!t.active) return t; return null }
  function freeFloat(): Float | null { for (const f of floats) if (!f.active) return f; return null }

  function spawnTall(xn: number | null) {
    const t = freeTall()
    if (!t) return
    const i = talls.indexOf(t)
    const defs = tallField.variants
    t.active = true
    t.x = xn === null ? rand(-ctx.laneX, ctx.laneX) : xn * ctx.laneX
    t.w = rand(2.2, 4.2)
    t.h = t.maxH = rand(5, 15)
    t.z = SPAWN_Z - rand(0, 40)
    t.spin = rand(0, Math.PI * 2)
    t.v = Math.floor(Math.random() * defs.length)
    t.phase = Math.random()
    t.geyser = defs[t.v % defs.length]?.id === 'geyser'
    tallField.set(i, t.x, GROUND_Y, t.z, t.w, t.h, t.spin, t.v)
  }

  function spawnFloat(xn: number | null) {
    const f = freeFloat()
    if (!f) return
    f.active = true
    f.x = xn === null ? rand(-ctx.laneX, ctx.laneX) : xn * ctx.laneX
    f.y = rand(LANE_Y_LO, LANE_Y_HI)
    f.r = rand(1.0, 2.2)
    f.z = SPAWN_Z - rand(0, 40)
    f.spin = rand(0, 6)
    f.v = Math.floor(Math.random() * floatField.variants.length)
  }

  function spawnMine(x: number, y: number, z: number): boolean {
    let m: Mine | null = null
    for (const v of mines) if (!v.active) { m = v; break }
    if (!m) return false
    m.active = true
    m.x = x
    m.y = y
    m.z = z
    m.pulse = 0
    m.root.visible = true
    m.root.position.set(x, y, z)
    mineCount++
    return true
  }

  function spawnArch(xn: number | null) {
    let a: Arch | null = null
    for (const v of arches) if (!v.active) { a = v; break }
    if (!a) return
    const lim = ctx.laneX - ARCH_HALF_W - 0.5
    a.active = true
    a.x = xn === null ? rand(-lim, lim) : clamp(xn * ctx.laneX, -lim, lim)
    a.gapH = rand(3.2, 4.2)
    a.gapY = rand(LANE_Y_LO + a.gapH / 2, LANE_Y_HI - 0.5)
    a.z = SPAWN_Z - rand(0, 40)
    layoutArch(a)
    a.root.visible = true
  }

  function layoutArch(a: Arch) {
    const lo = a.gapY - a.gapH / 2
    const hi = a.gapY + a.gapH / 2
    const [left, right, sill, lintel, nTop, nBot, nL, nR] = a.parts as [THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh]
    const postH = ARCH_TOP - GROUND_Y
    left.position.set(-ARCH_HALF_W, GROUND_Y + postH / 2, 0)
    left.scale.set(1.2, postH, 1.2)
    right.position.set(ARCH_HALF_W, GROUND_Y + postH / 2, 0)
    right.scale.set(1.2, postH, 1.2)
    const sillH = Math.max(0.3, lo - GROUND_Y)
    sill.position.set(0, GROUND_Y + sillH / 2, 0)
    sill.scale.set(ARCH_HALF_W * 2, sillH, 1.1)
    const lintelH = Math.max(1, ARCH_TOP + 2 - hi)
    lintel.position.set(0, hi + lintelH / 2, 0)
    lintel.scale.set(ARCH_HALF_W * 2 + 1.2, lintelH, 1.2)
    const iw = ARCH_HALF_W * 2 - 1.2
    nTop.position.set(0, hi, 0.65); nTop.scale.set(iw, 0.18, 0.1)
    nBot.position.set(0, lo, 0.65); nBot.scale.set(iw, 0.18, 0.1)
    nL.position.set(-ARCH_HALF_W + 0.6, a.gapY, 0.65); nL.scale.set(0.18, a.gapH, 0.1)
    nR.position.set(ARCH_HALF_W - 0.6, a.gapY, 0.65); nR.scale.set(0.18, a.gapH, 0.1)
    a.root.position.set(a.x, 0, a.z)
  }

  /** True when a flyer at (sx, sy) threads this arch cleanly. */
  function archClear(a: Arch, sx: number, sy: number): boolean {
    if (Math.abs(sx - a.x) > ARCH_HALF_W - 0.6) return false
    return Math.abs(sy - a.gapY) < a.gapH / 2 - 0.4
  }

  function detonate(m: Mine, chain: boolean, harmless: boolean) {
    if (!m.active) return
    m.active = false
    m.root.visible = false
    mineCount--
    ctx.fx.explode(m.x, m.y, m.z, accent, 1)
    ctx.shake = Math.max(ctx.shake, 0.4)
    if (!harmless && live(ctx)) {
      const R2 = MINE_BLAST_RADIUS * MINE_BLAST_RADIUS
      const p = ctx.player
      const dx = m.x - p.x, dy = m.y - p.y, dz = m.z
      if (dx * dx + dy * dy + dz * dz < R2) p.damage(DMG.mine)
      ctx.squad.blast(m.x, m.y, m.z, MINE_BLAST_RADIUS, DMG.mine)
    }
    if (chain) {
      const R = MINE_BLAST_RADIUS + 1
      for (const o of mines) {
        if (!o.active) continue
        const dx = o.x - m.x, dy = o.y - m.y, dz = o.z - m.z
        if (dx * dx + dy * dy + dz * dz < R * R) detonate(o, false, harmless)
      }
    }
  }

  /** Does a flyer at (x, y, z) touch tall prop t? */
  function tallHits(t: Tall, i: number, x: number, y: number, z: number, pad: number): boolean {
    const def = tallField.defAt(i)
    if (!def) return false
    const R = def.collide.radius * t.w
    if (Math.abs(z - t.z) > R + 0.6) return false
    if (Math.abs(x - t.x) < R + pad && y < GROUND_Y + t.h + pad) return true
    const c = def.collide.capR
    if (c) {
      const cr = c * t.w + pad
      const dx = x - t.x, dy = y - (GROUND_Y + t.h), dz = z - t.z
      if (dx * dx + dy * dy + dz * dz < cr * cr) return true
    }
    return false
  }

  function floatRadius(f: Float, i: number): number {
    const def = floatField.defAt(i)
    return (def ? def.collide.radius : 0.85) * f.r
  }

  function breakFloat(f: Float, i: number) {
    f.active = false
    floatField.hide(i)
    ctx.fx.explode(f.x, f.y, f.z, P.lavender, 0.6)
  }

  function update(dt: number) {
    const ws = ctx.worldSpeed
    const on = live(ctx)
    const p = ctx.player
    const sq = ctx.squad.members
    // tall props
    for (let i = 0; i < MAX_TALL; i++) {
      const t = talls[i]!
      if (!t.active) continue
      t.z += ws * dt
      if (t.z > PAST_Z) { t.active = false; tallField.hide(i); continue }
      if (t.geyser) t.h = t.maxH * geyserJet(ctx.now, t.phase)
      tallField.set(i, t.x, GROUND_Y, t.z, t.w, t.h, t.spin, t.v)
      if (!on || Math.abs(t.z) > 6) continue
      if (p.visible && tallHits(t, i, p.x, p.y, 0, 0.8)) p.damage(DMG.pillar)
      for (let k = 0; k < sq.length; k++) {
        const w = sq[k]!
        if (w.alive && tallHits(t, i, w.x, w.y, w.z, 0.7)) ctx.squad.damage(k, DMG.pillar)
      }
    }
    tallField.commit()
    // floating props
    for (let i = 0; i < MAX_FLOAT; i++) {
      const f = floats[i]!
      if (!f.active) continue
      f.z += ws * 0.9 * dt
      if (f.z > PAST_Z + 1) { f.active = false; floatField.hide(i); continue }
      f.spin += dt * 0.8
      floatField.set(i, f.x, f.y, f.z, f.r, 0, f.spin, f.v)
      if (!on) continue
      const R = floatRadius(f, i) + 0.9
      if (p.visible) {
        const dx = f.x - p.x, dy = f.y - p.y, dz = f.z
        if (dx * dx + dy * dy + dz * dz < R * R) { breakFloat(f, i); p.damage(DMG.rock); continue }
      }
      for (let k = 0; k < sq.length; k++) {
        const w = sq[k]!
        if (!w.alive) continue
        const dx = f.x - w.x, dy = f.y - w.y, dz = f.z - w.z
        if (dx * dx + dy * dy + dz * dz < R * R) { breakFloat(f, i); ctx.squad.damage(k, DMG.rock); break }
      }
    }
    floatField.commit()
    // mines
    for (const m of mines) {
      if (!m.active) continue
      m.z += ws * 0.7 * dt
      m.pulse += dt * 5
      const s = 1 + Math.sin(m.pulse) * 0.12
      m.root.scale.setScalar(s)
      m.root.rotation.y += dt * 1.4
      m.root.position.set(m.x, m.y, m.z)
      if (m.z > PAST_Z + 1) { m.active = false; m.root.visible = false; mineCount--; continue }
      if (!on) continue
      const F2 = MINE_FUSE_RADIUS * MINE_FUSE_RADIUS
      if (p.visible) {
        const dx = m.x - p.x, dy = m.y - p.y, dz = m.z
        if (dx * dx + dy * dy + dz * dz < F2) { detonate(m, true, false); continue }
      }
      for (const w of sq) {
        if (!w.alive) continue
        const dx = m.x - w.x, dy = m.y - w.y, dz = m.z - w.z
        if (dx * dx + dy * dy + dz * dz < F2) { detonate(m, true, false); break }
      }
    }
    // arches
    for (const a of arches) {
      if (!a.active) continue
      a.z += ws * dt
      if (a.z > PAST_Z - 0.5) { a.active = false; a.root.visible = false; continue }
      a.root.position.z = a.z
      if (!on) continue
      if (p.visible && Math.abs(a.z) < 1.4 && Math.abs(p.x - a.x) < ARCH_HALF_W + 0.8 && !archClear(a, p.x, p.y)) p.damage(DMG.pillar)
      for (let k = 0; k < sq.length; k++) {
        const w = sq[k]!
        if (w.alive && Math.abs(a.z - w.z) < 1.4 && Math.abs(w.x - a.x) < ARCH_HALF_W + 0.8 && !archClear(a, w.x, w.y)) ctx.squad.damage(k, DMG.pillar)
      }
    }
  }

  return {
    get mines() { return mineCount },
    setBiome(id) {
      tallField.setBiome(id)
      floatField.setBiome(id)
      accent = biomeAccent(id)
      for (const m of mines) setMat(m.glow, glowMat(accent))
      for (const a of arches) for (let k = 4; k < 8; k++) setMat(a.parts[k]!, glowMat(accent))
      // Geysers only exist in the ember set; re-read what each slot is now.
      for (let i = 0; i < MAX_TALL; i++) {
        const t = talls[i]!
        t.geyser = tallField.defAt(i)?.id === 'geyser'
        if (!t.geyser) t.h = t.maxH
      }
    },
    spawn(kind, x) {
      if (kind === 'pillar') {
        if (ctx.env.biome === 'space') spawnFloat(x)
        else spawnTall(x)
      } else if (kind === 'rock') spawnFloat(x)
      else if (kind === 'mine') {
        if (mineCount >= MAX_MINES) return
        const lim = ctx.laneX - 1.5
        spawnMine(x === null ? rand(-lim, lim) : clamp(x * ctx.laneX, -lim, lim), rand(LANE_Y_LO, LANE_Y_HI), SPAWN_Z - rand(0, 40))
      } else spawnArch(x)
    },
    spawnMine,
    update,
    laserHit(x, y, z) {
      for (let i = 0; i < MAX_TALL; i++) {
        const t = talls[i]!
        if (!t.active || Math.abs(z - t.z) > 2.2) continue
        if (tallHits(t, i, x, y, z, 0.3)) { ctx.fx.sparks(x, y, z, P.lavender, 5, 6); return 1 }
      }
      for (let i = 0; i < MAX_FLOAT; i++) {
        const f = floats[i]!
        if (!f.active) continue
        const R = floatRadius(f, i) + 0.6
        const dx = x - f.x, dy = y - f.y, dz = z - f.z
        if (dx * dx + dy * dy + dz * dz < R * R) {
          breakFloat(f, i)
          addScore(ctx, 25 * ctx.mult)
          ctx.sfx.tick()
          return 2
        }
      }
      for (const m of mines) {
        if (!m.active) continue
        const dx = x - m.x, dy = y - m.y, dz = z - m.z
        if (dx * dx + dy * dy + dz * dz < 1.6 * 1.6) {
          // Shot early: it pops without hurting anyone.
          detonate(m, false, true)
          addScore(ctx, MINE_SCORE * ctx.mult)
          return 2
        }
      }
      for (const a of arches) {
        if (!a.active || Math.abs(z - a.z) > 1.2) continue
        if (Math.abs(x - a.x) < ARCH_HALF_W + 0.6 && !archClear(a, x, y)) { ctx.fx.sparks(x, y, z, accent, 4, 5); return 1 }
      }
      return 0
    },
    blast(x, y, z, r) {
      const R2 = r * r
      for (const m of mines) {
        if (!m.active) continue
        const dx = x - m.x, dy = y - m.y, dz = z - m.z
        if (dx * dx + dy * dy + dz * dz < R2) { detonate(m, false, true); addScore(ctx, MINE_SCORE) }
      }
      for (let i = 0; i < MAX_FLOAT; i++) {
        const f = floats[i]!
        if (!f.active) continue
        const dx = x - f.x, dy = y - f.y, dz = z - f.z
        if (dx * dx + dy * dy + dz * dz < R2) breakFloat(f, i)
      }
    },
    avoid(tx, ty, out) {
      for (let i = 0; i < MAX_TALL; i++) {
        const t = talls[i]!
        if (!t.active || t.z < -70 || t.z > -4) continue
        const R = (tallField.defAt(i)?.collide.radius ?? 0.5) * t.w
        if (Math.abs(t.x - tx) < R + 2.5 && ty < GROUND_Y + t.h + 1.2) tx = tx < t.x ? t.x - R - 3 : t.x + R + 3
      }
      for (let i = 0; i < MAX_FLOAT; i++) {
        const f = floats[i]!
        if (!f.active || f.z < -70 || f.z > -4) continue
        const R = floatRadius(f, i)
        if (Math.abs(f.x - tx) < 2.5 + R && Math.abs(f.y - ty) < 2.5 + R) tx = tx < f.x ? f.x - R - 3 : f.x + R + 3
      }
      for (const m of mines) {
        if (!m.active || m.z < -70 || m.z > -4) continue
        if (Math.abs(m.x - tx) < 3.5 && Math.abs(m.y - ty) < 3) tx = tx < m.x ? m.x - 4.5 : m.x + 4.5
      }
      for (const a of arches) {
        if (!a.active || a.z < -70 || a.z > -4) continue
        if (Math.abs(tx - a.x) < ARCH_HALF_W + 0.8 && !archClear(a, tx, ty)) { tx = a.x; ty = a.gapY }
      }
      out.x = tx
      out.y = ty
    },
    clear() {
      for (let i = 0; i < MAX_TALL; i++) { talls[i]!.active = false; tallField.hide(i) }
      for (let i = 0; i < MAX_FLOAT; i++) { floats[i]!.active = false; floatField.hide(i) }
      tallField.commit()
      floatField.commit()
      for (const m of mines) { m.active = false; m.root.visible = false }
      mineCount = 0
      for (const a of arches) { a.active = false; a.root.visible = false }
    },
    lights(add) {
      tallField.lights(add)
      floatField.lights(add)
      for (const m of mines) if (m.active) add(m.x, m.y, m.z, 1.8, accent, 0.45 + 0.3 * Math.sin(m.pulse))
      for (const a of arches) {
        if (!a.active) continue
        add(a.x, a.gapY + a.gapH / 2, a.z, 2.2, accent, 0.5)
        add(a.x, a.gapY - a.gapH / 2, a.z, 2.2, accent, 0.5)
      }
    },
  }
}

