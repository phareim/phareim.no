/**
 * The bosses' own projectiles, pooled (2026-09-25). Aimed bolts and fans
 * go through the shared bolt pool (shots.ts); these are the ones that
 * don't fly straight:
 *
 *   orb    spore mines (the Moth) and rear mines (the Crown's chase): they
 *          fan out from the boss to their lanes, then hang in the air while
 *          the ship flies into them; shootable
 *   lob    lava lobs (the Furnace): a marked landing spot at the ship's
 *          plane, then an arcing blob with a blast; shootable in flight
 *   wave   stomp shockwaves (the Furnace): a wall of heat rolling along the
 *          ground toward the ship; fly above its crest
 *   wall   crossing walls (the Twins): light panels over every lane but one
 *   beam   the Crown's eye beam, a wedge of light sweeping across the lanes
 *   chunk  hull debris (the Crown's chase), tumbling; shootable
 *
 * The fairness rules live in bosses.ts (shockwaveHits, twinsWallHits,
 * crownBeamHits); this file only moves things and asks them.
 */
import * as THREE from 'three'
import { DMG, LANES as LANES_ALL, SHIP_RADIUS } from '../../balance'
import { crownBeamHits, laneFloat, laneX, shockwaveHits, twinsWallHits } from '../../bosses'
import { P } from '../../models/core'
import { bossMat } from '../../models/bosses/shared'
import { GROUND_Y, LANE_Y_HI, LANE_Y_LO, addScore, live, type Ctx } from '../ctx'
import type { HudKit } from './types'

type Add = (x: number, y: number, z: number, r: number, color: string, a: number) => void

export interface Hazards {
  /** A spore (style 0, mint) or mine (style 1, red) floating out from
   * (x, y, z) to (tx, ty) over 0.7 s, then drifting with the world. */
  orb(x: number, y: number, z: number, tx: number, ty: number, style: 0 | 1): void
  /** A lava lob: the landing spot (tx, ty, tz) is marked at once, the blob
   * leaves (x, y, z) after `delay` s and lands `flight` s later. */
  lob(x: number, y: number, z: number, tx: number, ty: number, tz: number, delay: number, flight: number, blast: number): void
  /** A stomp wave starting at depth z, rolling toward the ship at `speed`, crest at world y `top`. */
  wave(z: number, speed: number, top: number): void
  /** A crossing wall at depth z covering every lane but `gap`. */
  wall(z: number, speed: number, gap: number, color: string): void
  /** The eye beam, set every frame it shows: from (fx, fy, fz) to float lane `lane` at the ship plane. */
  beam(on: boolean, fx?: number, fy?: number, fz?: number, lane?: number): void
  /** A tumbling hull chunk. */
  chunk(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number): void
  update(dt: number): void
  /** A laser point that moved `step` units this frame: true if it hit something. */
  laserHit(x: number, y: number, z: number, step: number): boolean
  /** A bomb clears orbs, lobs and chunks in its radius. */
  blast(x: number, y: number, z: number, r: number): void
  clear(): void
  lights(add: Add): void
  hud(h: HudKit): void
  readonly count: number
}

const MAX_ORBS = 40
const MAX_LOBS = 8
const MAX_WAVES = 6
const MAX_WALLS = 6
const MAX_CHUNKS = 14
const ORB_R = 1.0
const ORB_SPREAD = 0.7
const LOB_ARC = 9

export function createHazards(ctx: Ctx): Hazards {
  const hide = new THREE.Matrix4().makeTranslation(0, -999, 0)
  const d = new THREE.Object3D()
  const col = new THREE.Color()
  let live_ = 0
  const q = { x: 0, y: 0, r: 0 }

  // ---- orbs: one instanced mesh
  const orbMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(ORB_R * 0.85, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_ORBS)
  orbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  orbMesh.frustumCulled = false
  for (let i = 0; i < MAX_ORBS; i++) { orbMesh.setMatrixAt(i, hide); orbMesh.setColorAt(i, col.set(P.mint)) }
  orbMesh.visible = false
  ctx.scene.add(orbMesh)
  const O = {
    on: new Uint8Array(MAX_ORBS), x: new Float32Array(MAX_ORBS), y: new Float32Array(MAX_ORBS), z: new Float32Array(MAX_ORBS),
    sx: new Float32Array(MAX_ORBS), sy: new Float32Array(MAX_ORBS), tx: new Float32Array(MAX_ORBS), ty: new Float32Array(MAX_ORBS),
    t: new Float32Array(MAX_ORBS), style: new Uint8Array(MAX_ORBS),
  }
  let orbsLive = 0

  // ---- lobs
  const lobGeo = new THREE.OctahedronGeometry(0.75, 0)
  const lobMat = new THREE.MeshBasicMaterial({ color: P.orange })
  const lobs = Array.from({ length: MAX_LOBS }, () => {
    const m = new THREE.Mesh(lobGeo, lobMat)
    m.visible = false
    ctx.scene.add(m)
    return { m, on: false, delay: 0, t: 0, flight: 1, x0: 0, y0: 0, z0: 0, tx: 0, ty: 0, tz: 0, r: 2.5, x: 0, y: 0, z: 0 }
  })

  // ---- waves: a translucent body and a hot crest, both unit boxes scaled
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const waveBodyMat = new THREE.MeshBasicMaterial({ color: P.orange, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false })
  const waveCrestMat = new THREE.MeshBasicMaterial({ color: P.gold })
  const waves = Array.from({ length: MAX_WAVES }, () => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(unitBox, waveBodyMat)
    const crest = new THREE.Mesh(unitBox, waveCrestMat)
    g.add(body, crest)
    g.visible = false
    ctx.scene.add(g)
    return { g, body, crest, on: false, z: 0, speed: 30, top: 0, hit: false }
  })

  // ---- walls: every bar of every wall in one instanced mesh
  const wallMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
  const barMesh = new THREE.InstancedMesh(unitBox, wallMat, MAX_WALLS * LANES_ALL)
  barMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  barMesh.frustumCulled = false
  for (let i = 0; i < MAX_WALLS * LANES_ALL; i++) { barMesh.setMatrixAt(i, hide); barMesh.setColorAt(i, col.set(P.cyan)) }
  barMesh.visible = false
  ctx.scene.add(barMesh)
  const walls = Array.from({ length: MAX_WALLS }, () => ({ on: false, z: 0, speed: 30, gap: 0, color: P.cyan as string, hit: false }))

  // ---- beam: two wedges (a wide faint one, a hot core), five vertices each
  const beamOuterMat = new THREE.MeshBasicMaterial({ color: P.hot, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const beamCoreMat = new THREE.MeshBasicMaterial({ color: P.pink, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  function wedge(mat: THREE.Material) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3))
    g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1])
    const m = new THREE.Mesh(g, mat)
    m.frustumCulled = false
    m.visible = false
    ctx.scene.add(m)
    return m
  }
  const beamOuter = wedge(beamOuterMat)
  const beamCore = wedge(beamCoreMat)
  const beamState = { on: false, fx: 0, fy: 0, fz: 0, lane: 0 }

  // ---- chunks
  const chunkGeo = new THREE.IcosahedronGeometry(1, 0)
  const chunks = Array.from({ length: MAX_CHUNKS }, (_, i) => {
    const m = new THREE.Mesh(chunkGeo, bossMat(i % 2 ? P.purple : P.grey, i % 2 ? P.purpleDark : P.stoneDark))
    m.visible = false
    ctx.scene.add(m)
    return { m, on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, hp: 2, spin: 1 }
  })

  function popOrb(i: number, score: boolean) {
    O.on[i] = 0
    orbMesh.setMatrixAt(i, hide)
    orbsLive--
    live_--
    ctx.fx.sparks(O.x[i]!, O.y[i]!, O.z[i]!, O.style[i] ? P.red : P.mint, 14, 9)
    ctx.fx.flashLight(O.x[i]!, O.y[i]!, O.z[i]!, 3, O.style[i] ? P.red : P.mint, 0.3)
    if (score) addScore(ctx, 20)
  }

  function landLob(l: typeof lobs[number]) {
    l.on = false
    l.m.visible = false
    live_--
    ctx.fx.explode(l.tx, l.ty, l.tz - 1, P.orange, 1.1)
    ctx.fx.sparks(l.tx, l.ty, l.tz, P.gold, 18, 10)
    ctx.sfx.boom(false)
    if (!live(ctx)) return
    const p = ctx.player
    const dx = p.x - l.tx, dy = p.y - l.ty
    if (p.visible && dx * dx + dy * dy < (l.r + SHIP_RADIUS * 0.4) ** 2) p.damage(DMG.lob)
    ctx.squad.blast(l.tx, l.ty, l.tz, l.r, DMG.lob)
  }

  function popLob(l: typeof lobs[number]) {
    l.on = false
    l.m.visible = false
    live_--
    ctx.fx.sparks(l.x, l.y, l.z, P.orange, 16, 9)
    addScore(ctx, 40)
  }

  function breakChunk(c: typeof chunks[number], score: boolean) {
    c.on = false
    c.m.visible = false
    live_--
    ctx.fx.explode(c.x, c.y, c.z, P.purple, 0.6 + c.size * 0.3)
    if (score) addScore(ctx, 40)
  }

  function setWedge(m: THREE.Mesh, fx: number, fy: number, fz: number, bx: number, hw: number) {
    const a = (m.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    const lo = LANE_Y_LO - 1, hi = LANE_Y_HI + 1, z = 1
    a[0] = fx; a[1] = fy; a[2] = fz
    a[3] = bx - hw; a[4] = lo; a[5] = z
    a[6] = bx + hw; a[7] = lo; a[8] = z
    a[9] = bx + hw; a[10] = hi; a[11] = z
    a[12] = bx - hw; a[13] = hi; a[14] = z
    m.geometry.getAttribute('position').needsUpdate = true
  }

  function updateOrbs(dt: number) {
    if (orbsLive <= 0) { orbMesh.visible = false; return }
    orbMesh.visible = true
    const p = ctx.player
    const on = live(ctx) && p.visible
    const drift = ctx.worldSpeed
    // a phone's corridor is narrower: the orbs shrink with it so the gap stays a lane
    const kk = Math.max(0.6, ctx.laneX / 11)
    const catchR = ORB_R * kk + SHIP_RADIUS * 0.8
    for (let i = 0; i < MAX_ORBS; i++) {
      if (!O.on[i]) continue
      O.t[i]! += dt
      const u = Math.min(1, O.t[i]! / ORB_SPREAD)
      const e = 1 - (1 - u) * (1 - u)
      O.x[i] = O.sx[i]! + (O.tx[i]! - O.sx[i]!) * e
      O.y[i] = O.sy[i]! + (O.ty[i]! - O.sy[i]!) * e + Math.sin(ctx.now * 3 + i) * 0.15
      O.z[i]! += drift * dt
      const x = O.x[i]!, y = O.y[i]!, z = O.z[i]!
      if (z > 12) { O.on[i] = 0; orbMesh.setMatrixAt(i, hide); orbsLive--; live_--; continue }
      if (on) {
        const dx = x - p.x, dy = y - p.y
        if (dx * dx + dy * dy + z * z < catchR * catchR) {
          if (!p.rolling) p.damage(DMG.mine)
          popOrb(i, false)
          continue
        }
      }
      d.position.set(x, y, z)
      d.rotation.set(ctx.now * 1.5 + i, ctx.now * 2 + i, 0)
      const s = (1 + 0.12 * Math.sin(ctx.now * 7 + i)) * kk
      d.scale.set(s, s, s)
      d.updateMatrix()
      orbMesh.setMatrixAt(i, d.matrix)
    }
    d.rotation.set(0, 0, 0)
    d.scale.set(1, 1, 1)
    orbMesh.instanceMatrix.needsUpdate = true
  }

  function updateLobs(dt: number) {
    for (const l of lobs) {
      if (!l.on) continue
      if (l.delay > 0) { l.delay -= dt; continue }
      l.t += dt
      const u = Math.min(1, l.t / l.flight)
      l.x = l.x0 + (l.tx - l.x0) * u
      l.y = l.y0 + (l.ty - l.y0) * u + LOB_ARC * 4 * u * (1 - u)
      l.z = l.z0 + (l.tz - l.z0) * u
      l.m.visible = true
      l.m.position.set(l.x, l.y, l.z)
      l.m.rotation.set(l.t * 5, l.t * 3, 0)
      if (u >= 1) landLob(l)
    }
  }

  function updateWaves(dt: number) {
    const p = ctx.player
    const w = ctx.laneX * 2 + 14
    for (const v of waves) {
      if (!v.on) continue
      const prev = v.z
      v.z += v.speed * dt
      if (!v.hit && prev < 0 && v.z >= 0) {
        v.hit = true
        if (live(ctx) && p.visible && shockwaveHits(v.top, p.y)) p.damage(DMG.shockwave)
      }
      // gone once past the ship: a wall of heat through the camera hides everything
      if (v.z > 4) { v.on = false; v.g.visible = false; live_--; continue }
      const h = v.top - GROUND_Y
      v.body.scale.set(w, h, 0.9)
      v.body.position.set(0, GROUND_Y + h / 2, 0)
      v.crest.scale.set(w, 0.32, 0.5)
      v.crest.position.set(0, v.top, 0)
      v.g.position.z = v.z
    }
  }

  function updateWalls(dt: number) {
    let any = false
    const p = ctx.player
    const hw = ctx.laneX
    const bw = (2 * hw) / LANES_ALL
    const h = LANE_Y_HI - LANE_Y_LO + 3
    for (let k = 0; k < MAX_WALLS; k++) {
      const v = walls[k]!
      if (!v.on) continue
      const prev = v.z
      v.z += v.speed * dt
      if (!v.hit && prev < 0 && v.z >= 0) {
        v.hit = true
        if (live(ctx) && p.visible && twinsWallHits(v.gap, p.x, hw)) p.damage(DMG.bossBolt)
      }
      // gone once past the ship (through the camera it would fill the screen)
      if (v.z > 2.5) {
        v.on = false
        live_--
        for (let l = 0; l < LANES_ALL; l++) barMesh.setMatrixAt(k * LANES_ALL + l, hide)
        continue
      }
      any = true
      for (let l = 0; l < LANES_ALL; l++) {
        const i = k * LANES_ALL + l
        if (l === v.gap) { barMesh.setMatrixAt(i, hide); continue }
        d.position.set(laneX(l, hw), (LANE_Y_LO + LANE_Y_HI) / 2, v.z)
        d.scale.set(bw * 0.9, h, 0.3)
        d.updateMatrix()
        barMesh.setMatrixAt(i, d.matrix)
      }
    }
    d.scale.set(1, 1, 1)
    barMesh.visible = any
    if (any) barMesh.instanceMatrix.needsUpdate = true
  }

  function updateBeam() {
    const on = beamState.on
    beamOuter.visible = on
    beamCore.visible = on
    if (!on) return
    const hw = ctx.laneX
    const bx = laneX(beamState.lane, hw)
    const lw = (2 * hw) / LANES_ALL
    setWedge(beamOuter, beamState.fx, beamState.fy, beamState.fz, bx, lw * 0.4)
    setWedge(beamCore, beamState.fx, beamState.fy, beamState.fz, bx, lw * 0.1)
    const p = ctx.player
    if (live(ctx) && p.visible && crownBeamHits(beamState.lane, laneFloat(p.x, hw), hw)) p.damage(DMG.beam)
  }

  function updateChunks(dt: number) {
    const p = ctx.player
    const on = live(ctx) && p.visible
    for (const c of chunks) {
      if (!c.on) continue
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.z += (c.vz + ctx.worldSpeed) * dt
      if (c.z > 14) { c.on = false; c.m.visible = false; live_--; continue }
      c.m.position.set(c.x, c.y, c.z)
      c.m.rotation.x += dt * c.spin
      c.m.rotation.y += dt * c.spin * 0.7
      if (on) {
        const dx = c.x - p.x, dy = c.y - p.y
        const r = c.size + SHIP_RADIUS * 0.8
        if (dx * dx + dy * dy + c.z * c.z < r * r) {
          if (!p.rolling) p.damage(DMG.rock)
          breakChunk(c, false)
        }
      }
    }
  }

  const h: Hazards = {
    get count() { return live_ },
    orb(x, y, z, tx, ty, style) {
      let i = -1
      for (let k = 0; k < MAX_ORBS; k++) if (!O.on[k]) { i = k; break }
      if (i < 0) return
      O.on[i] = 1
      O.x[i] = x; O.y[i] = y; O.z[i] = z
      O.sx[i] = x; O.sy[i] = y; O.tx[i] = tx; O.ty[i] = ty
      O.t[i] = 0
      O.style[i] = style
      orbMesh.setColorAt(i, col.set(style ? P.red : P.mint))
      if (orbMesh.instanceColor) orbMesh.instanceColor.needsUpdate = true
      orbsLive++
      live_++
    },
    lob(x, y, z, tx, ty, tz, delay, flight, blast) {
      const l = lobs.find(v => !v.on)
      if (!l) return
      l.on = true
      l.delay = delay
      l.t = 0
      l.flight = Math.max(0.3, flight)
      l.x0 = x; l.y0 = y; l.z0 = z
      l.x = x; l.y = y; l.z = z
      l.tx = tx; l.ty = ty; l.tz = tz
      l.r = blast
      l.m.visible = false
      live_++
    },
    wave(z, speed, top) {
      const v = waves.find(w => !w.on)
      if (!v) return
      v.on = true
      v.z = z
      v.speed = speed
      v.top = top
      v.hit = false
      v.g.visible = true
      v.g.position.set(0, 0, z)
      live_++
    },
    wall(z, speed, gap, color) {
      const k = walls.findIndex(w => !w.on)
      if (k < 0) return
      const v = walls[k]!
      v.on = true
      v.z = z
      v.speed = speed
      v.gap = gap
      v.color = color
      v.hit = false
      col.set(color)
      for (let l = 0; l < LANES_ALL; l++) barMesh.setColorAt(k * LANES_ALL + l, col)
      if (barMesh.instanceColor) barMesh.instanceColor.needsUpdate = true
      live_++
    },
    beam(on, fx = 0, fy = 0, fz = 0, lane = 0) {
      beamState.on = on
      beamState.fx = fx; beamState.fy = fy; beamState.fz = fz
      beamState.lane = lane
    },
    chunk(x, y, z, vx, vy, vz, size) {
      const c = chunks.find(v => !v.on)
      if (!c) return
      c.on = true
      c.x = x; c.y = y; c.z = z
      c.vx = vx; c.vy = vy; c.vz = vz
      c.size = size
      c.hp = size > 1.3 ? 3 : 2
      c.spin = 1 + Math.random() * 2.5
      c.m.scale.setScalar(size)
      c.m.position.set(x, y, z)
      c.m.visible = true
      live_++
    },
    update(dt) {
      if (live_ <= 0 && !beamState.on) {
        orbMesh.visible = false
        beamOuter.visible = false
        beamCore.visible = false
        return
      }
      updateOrbs(dt)
      updateLobs(dt)
      updateWaves(dt)
      updateWalls(dt)
      updateBeam()
      updateChunks(dt)
    },
    laserHit(x, y, z, step) {
      if (live_ <= 0) return false
      const z0 = z - 0.6, z1 = z + step + 0.6
      if (orbsLive > 0) {
        for (let i = 0; i < MAX_ORBS; i++) {
          if (!O.on[i] || O.z[i]! < z0 || O.z[i]! > z1) continue
          const dx = x - O.x[i]!, dy = y - O.y[i]!
          if (dx * dx + dy * dy < (ORB_R + 0.35) ** 2) { popOrb(i, true); return true }
        }
      }
      for (const l of lobs) {
        if (!l.on || l.delay > 0 || l.z < z0 || l.z > z1) continue
        const dx = x - l.x, dy = y - l.y
        if (dx * dx + dy * dy < 1.3 * 1.3) { popLob(l); return true }
      }
      for (const c of chunks) {
        if (!c.on || c.z < z0 - c.size || c.z > z1 + c.size) continue
        const dx = x - c.x, dy = y - c.y
        if (dx * dx + dy * dy < (c.size + 0.3) ** 2) {
          c.hp--
          ctx.fx.sparks(x, y, c.z, P.lavender, 5, 6)
          if (c.hp <= 0) breakChunk(c, true)
          return true
        }
      }
      return false
    },
    blast(x, y, z, r) {
      const r2 = r * r
      for (let i = 0; i < MAX_ORBS; i++) {
        if (!O.on[i]) continue
        const dx = O.x[i]! - x, dy = O.y[i]! - y, dz = O.z[i]! - z
        if (dx * dx + dy * dy + dz * dz < r2) popOrb(i, true)
      }
      for (const l of lobs) {
        if (!l.on || l.delay > 0) continue
        const dx = l.x - x, dy = l.y - y, dz = l.z - z
        if (dx * dx + dy * dy + dz * dz < r2) popLob(l)
      }
      for (const c of chunks) {
        if (!c.on) continue
        const dx = c.x - x, dy = c.y - y, dz = c.z - z
        if (dx * dx + dy * dy + dz * dz < r2) breakChunk(c, true)
      }
    },
    clear() {
      for (let i = 0; i < MAX_ORBS; i++) { O.on[i] = 0; orbMesh.setMatrixAt(i, hide) }
      orbMesh.instanceMatrix.needsUpdate = true
      orbMesh.visible = false
      orbsLive = 0
      for (const l of lobs) { l.on = false; l.m.visible = false }
      for (const v of waves) { v.on = false; v.g.visible = false }
      for (let k = 0; k < MAX_WALLS; k++) walls[k]!.on = false
      for (let i = 0; i < MAX_WALLS * LANES_ALL; i++) barMesh.setMatrixAt(i, hide)
      barMesh.instanceMatrix.needsUpdate = true
      barMesh.visible = false
      beamState.on = false
      beamOuter.visible = false
      beamCore.visible = false
      for (const c of chunks) { c.on = false; c.m.visible = false }
      live_ = 0
    },
    lights(add) {
      if (orbsLive > 0) for (let i = 0; i < MAX_ORBS; i++) if (O.on[i]) add(O.x[i]!, O.y[i]!, O.z[i]!, 1.6, O.style[i] ? P.red : P.mint, 0.75)
      for (const l of lobs) if (l.on && l.delay <= 0) add(l.x, l.y, l.z, 1.8, P.orange, 0.9)
      for (const v of waves) if (v.on) {
        add(-ctx.laneX * 0.6, v.top, v.z, 3, P.orange, 0.7)
        add(ctx.laneX * 0.6, v.top, v.z, 3, P.orange, 0.7)
        add(0, v.top, v.z, 3, P.gold, 0.8)
      }
      if (beamState.on) {
        const bx = laneX(beamState.lane, ctx.laneX)
        add(bx, (LANE_Y_LO + LANE_Y_HI) / 2, -2, 3, P.hot, 0.9)
        add(beamState.fx, beamState.fy, beamState.fz, 3.5, P.hot, 1)
      }
    },
    hud(k) {
      // Lava lob landing marks: corners closing in on the spot as the blob falls.
      for (const l of lobs) {
        if (!l.on) continue
        if (!k.project(l.tx, l.ty, l.tz, l.r, q)) continue
        const left = l.delay > 0 ? 1 : 1 - Math.min(1, l.t / l.flight)
        const s = q.r * (0.8 + 1.4 * left) + k.pulse
        k.corners(q.x, q.y, s, k.pulse ? P.orange : P.gold)
        k.dotted(q.x - 2, q.y, q.x + 2, q.y, P.orange)
        k.dotted(q.x, q.y - 2, q.x, q.y + 2, P.orange)
      }
      // The gap in the nearest incoming wall.
      let best = -1
      for (let i = 0; i < MAX_WALLS; i++) {
        const v = walls[i]!
        if (!v.on || v.z > -4) continue
        if (best < 0 || v.z > walls[best]!.z) best = i
      }
      if (best >= 0) {
        const v = walls[best]!
        const cx = laneX(v.gap, ctx.laneX)
        const w = ctx.laneX / LANES_ALL
        if (k.project(cx - w, LANE_Y_LO, v.z, 1, q)) {
          const x0 = q.x, y0 = q.y
          if (k.project(cx + w, LANE_Y_HI, v.z, 1, q)) {
            k.dotted(x0, y0, x0, q.y, P.white)
            k.dotted(q.x, y0, q.x, q.y, P.white)
          }
        }
      }
    },
  }
  return h
}
