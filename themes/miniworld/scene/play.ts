/**
 * Mini World's play (2026-09-26): pixel particles, weapon magic and the
 * balloons in Ballongparken.
 *
 * `Particles` is one THREE.Points with a small sprite atlas (square,
 * bubble, star, heart, flower, snowflake, puff, sparkle), sized in logical
 * pixels so every particle is a crisp little sprite. Magic, the fountain,
 * stars, checkpoints and confetti all draw through it: one draw call.
 *
 * Magic per WeaponMagicId, scaled by the weapon's level: bubbles float and
 * pop, stars twinkle, hearts drift up, flowers bloom where they land, snow
 * sprinkles down, confetti bursts, a rainbow arcs, lightning zaps the
 * nearest balloon, the dragon puffs fire. Nobody gets hurt: magic only
 * pops balloons.
 */
import * as THREE from 'three'
import type { WeaponMagicId } from '../types'
import { WEAPON_MAGIC, RAINBOW } from '../catalog'

// ---------------------------------------------------------------- sprites

export const SPR = { square: 0, bubble: 1, star: 2, heart: 3, flower: 4, snow: 5, puff: 6, sparkle: 7 } as const

const SPRITES: string[][] = [
  // square (confetti, drops)
  ['........', '........', '..####..', '..####..', '..####..', '..####..', '........', '........'],
  // bubble: a ring with a glint
  ['..####..', '.#....#.', '#.oo...#', '#.o....#', '#......#', '#......#', '.#....#.', '..####..'],
  // star
  ['...#....', '...#....', '..###...', '#######.', '.#####..', '..###...', '.##.##..', '.#...#..'],
  // heart
  ['........', '.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....', '........'],
  // flower
  ['..oo....', '.o##o...', '.o##oo..', '..oo##o.', '...o##o.', '....oo..', '...g....', '..gg....'],
  // snowflake
  ['...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'],
  // puff
  ['..###...', '.#####..', '#######.', '#######.', '#######.', '.#####..', '..###...', '........'],
  // sparkle: a plus
  ['...#....', '...#....', '...#....', '#######.', '...#....', '...#....', '...#....', '........'],
]

function atlasTexture(): THREE.DataTexture {
  const W = 64, H = 8
  const d = new Uint8Array(W * H * 4)
  SPRITES.forEach((rows, s) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < 8; x++) {
        const ch = row[x]
        const i = ((H - 1 - y) * W + s * 8 + x) * 4
        // '#' tint colour, 'o' white glint / petal edge, 'g' a green stem.
        if (ch === '#') { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255 }
        else if (ch === 'o') { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 200 }
        else if (ch === 'g') { d[i] = 60; d[i + 1] = 200; d[i + 2] = 90; d[i + 3] = 150 }
      }
    })
  })
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

const P_VERT = /* glsl */ `
  attribute vec3 color; attribute float size; attribute float sprite;
  uniform float scale;
  varying vec3 vColor; varying float vSprite;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = size * scale / max(0.1, -mv.z);
    gl_PointSize = size <= 0.0 ? 0.0 : clamp(floor(s + 0.5), 2.0, 48.0);
    vColor = color; vSprite = sprite;
  }`

const P_FRAG = /* glsl */ `
  uniform sampler2D atlas;
  varying vec3 vColor; varying float vSprite;
  void main() {
    vec2 uv = vec2((vSprite + gl_PointCoord.x) / 8.0, 1.0 - gl_PointCoord.y);
    vec4 t = texture2D(atlas, uv);
    if (t.a < 0.1) discard;
    // alpha 200 marks the glint (white), 150 a stem (its own colour), 255 the tint.
    vec3 c = t.a > 0.9 ? vColor : (t.a > 0.7 ? mix(vColor, vec3(1.0), 0.8) : t.rgb * t.rgb);
    gl_FragColor = vec4(c, 1.0);
  }`

// ---------------------------------------------------------------- particles

/** Hit marks: your magic, or another player's (pops balloons, pays nothing). */
export const HIT_OWN = 1
export const HIT_PEER = 2

export const enum Beh { Plain = 0, Float = 1, Twinkle = 2, Bloom = 3, Shrink = 4, Still = 5 }

export interface Particles {
  readonly points: THREE.Points
  /**
   * Returns the index, or -1 when full (the oldest is not evicted). `hits`:
   * the particle can pop balloons; `HIT_PEER` marks another player's magic
   * (it pops, but pays no bits).
   */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color | string, size: number, life: number, sprite: number, beh?: Beh, grav?: number, hits?: boolean | number): number
  burst(x: number, y: number, z: number, n: number, colors: readonly string[], opts?: { speed?: number; size?: number; life?: number; sprite?: number; grav?: number; up?: number }): void
  update(dt: number, groundAt: (x: number, y: number, z: number) => number, camera: THREE.PerspectiveCamera, viewH: number): void
  /** Visits live projectiles that can pop balloons (`own`: your magic, not a peer's); return true to consume one. */
  forHits(fn: (x: number, y: number, z: number, own: boolean) => boolean): void
  clear(): void
  dispose(): void
}

export function createParticles(cap = 700): Particles {
  const pos = new Float32Array(cap * 3)
  const vel = new Float32Array(cap * 3)
  const colr = new Float32Array(cap * 3)
  const size = new Float32Array(cap)
  const base = new Float32Array(cap)
  const sprite = new Float32Array(cap)
  const life = new Float32Array(cap)
  const maxLife = new Float32Array(cap)
  const beh = new Uint8Array(cap)
  const grav = new Float32Array(cap)
  const hit = new Uint8Array(cap)
  const phase = new Float32Array(cap)
  let next = 0
  let live = 0

  const geo = new THREE.BufferGeometry()
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)
  const aCol = new THREE.BufferAttribute(colr, 3).setUsage(THREE.DynamicDrawUsage)
  const aSize = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage)
  const aSpr = new THREE.BufferAttribute(sprite, 1).setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', aPos)
  geo.setAttribute('color', aCol)
  geo.setAttribute('size', aSize)
  geo.setAttribute('sprite', aSpr)
  const atlas = atlasTexture()
  const mat = new THREE.ShaderMaterial({ vertexShader: P_VERT, fragmentShader: P_FRAG, uniforms: { atlas: { value: atlas }, scale: { value: 300 } } })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 5
  const tmp = new THREE.Color()

  const self: Particles = {
    points,
    spawn(x, y, z, vx, vy, vz, color, sz, lf, spr, b = Beh.Plain, g = 0, hits = false) {
      // Look for a free slot from `next` (ring order keeps it cheap).
      let i = -1
      for (let k = 0; k < cap; k++) {
        const j = (next + k) % cap
        if (life[j]! <= 0) { i = j; break }
      }
      if (i < 0) return -1
      next = (i + 1) % cap
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz
      if (typeof color === 'string') tmp.set(color); else tmp.copy(color)
      colr[i * 3] = tmp.r; colr[i * 3 + 1] = tmp.g; colr[i * 3 + 2] = tmp.b
      base[i] = sz; size[i] = sz
      sprite[i] = spr
      life[i] = lf; maxLife[i] = lf
      beh[i] = b; grav[i] = g; hit[i] = hits === true ? HIT_OWN : hits ? hits : 0
      phase[i] = Math.random() * 6.28
      live++
      return i
    },
    burst(x, y, z, n, colors, o = {}) {
      const sp = o.speed ?? 6
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2
        const u = Math.random() * 2 - 1
        const r = Math.sqrt(1 - u * u)
        const s = sp * (0.4 + Math.random() * 0.6)
        self.spawn(x, y, z, Math.cos(a) * r * s, u * s + (o.up ?? 2), Math.sin(a) * r * s, colors[k % colors.length]!, (o.size ?? 0.35) * (0.7 + Math.random() * 0.6), (o.life ?? 1.1) * (0.6 + Math.random() * 0.6), o.sprite ?? SPR.square, Beh.Plain, o.grav ?? 14)
      }
    },
    update(dt, groundAt, camera, viewH) {
      mat.uniforms.scale!.value = viewH / (2 * Math.tan((camera.fov * Math.PI) / 360))
      if (live === 0) return
      let n = 0
      for (let i = 0; i < cap; i++) {
        if (life[i]! <= 0) continue
        life[i]! -= dt
        const l = life[i]!
        if (l <= 0) {
          size[i] = 0
          live--
          if (beh[i] === Beh.Float) {
            // A bubble pops into a small ring of glints.
            const x = pos[i * 3]!, y = pos[i * 3 + 1]!, z = pos[i * 3 + 2]!
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * Math.PI * 2
              self.spawn(x, y, z, Math.cos(a) * 2, Math.sin(a) * 2, 0, '#ffffff', 0.12, 0.18, SPR.square, Beh.Plain, 0)
            }
          }
          continue
        }
        n++
        const i3 = i * 3
        const b = beh[i]!
        const t = 1 - l / maxLife[i]!
        if (b === Beh.Still) continue
        if (b === Beh.Bloom && vel[i3 + 1] === 0 && vel[i3] === 0) {
          // Landed: grow, then wilt at the end.
          size[i] = base[i]! * Math.min(1, (maxLife[i]! - l) * 3 + 0.3) * (l < 0.4 ? l / 0.4 : 1)
          continue
        }
        vel[i3 + 1]! -= grav[i]! * dt
        if (b === Beh.Float) {
          vel[i3 + 1]! += (1.2 - vel[i3 + 1]!) * Math.min(1, dt * 2)
          vel[i3]! *= 1 - Math.min(1, dt * 1.5)
          vel[i3 + 2]! *= 1 - Math.min(1, dt * 1.5)
          pos[i3]! += Math.sin(phase[i]! + l * 5) * dt * 0.6
        } else {
          const drag = 1 - Math.min(1, dt * 1.2)
          vel[i3]! *= drag; vel[i3 + 2]! *= drag
        }
        pos[i3]! += vel[i3]! * dt
        pos[i3 + 1]! += vel[i3 + 1]! * dt
        pos[i3 + 2]! += vel[i3 + 2]! * dt
        if (b === Beh.Bloom) {
          const gy = groundAt(pos[i3]!, pos[i3 + 1]! + 0.5, pos[i3 + 2]!)
          if (pos[i3 + 1]! <= gy + 0.15) {
            pos[i3 + 1] = gy + 0.25
            vel[i3] = 0; vel[i3 + 1] = 0; vel[i3 + 2] = 0
            hit[i] = 0
            life[i] = maxLife[i] = 5 + Math.random() * 2
          }
        } else if (b === Beh.Twinkle) {
          size[i] = base[i]! * (0.6 + 0.4 * Math.abs(Math.sin(phase[i]! + l * 14)))
        } else if (b === Beh.Shrink) {
          size[i] = base[i]! * (1 - t * 0.8)
        } else if (b === Beh.Plain && l < 0.25) {
          size[i] = base[i]! * (l / 0.25)
        }
      }
      if (n === 0) live = 0
      aPos.needsUpdate = true
      aCol.needsUpdate = true
      aSize.needsUpdate = true
      aSpr.needsUpdate = true
    },
    forHits(fn) {
      if (live === 0) return
      for (let i = 0; i < cap; i++) {
        if (!hit[i] || life[i]! <= 0) continue
        if (fn(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, hit[i] === HIT_OWN)) { hit[i] = 0; if (beh[i] !== Beh.Bloom) life[i] = Math.min(life[i]!, 0.05) }
      }
    },
    clear() {
      life.fill(0); size.fill(0); live = 0
      aSize.needsUpdate = true
    },
    dispose() {
      geo.dispose(); mat.dispose(); atlas.dispose()
    },
  }
  return self
}

// ---------------------------------------------------------------- magic

const LEVEL = [
  { n: 1, size: 1, range: 1 },
  { n: 1.6, size: 1.2, range: 1.25 },
  { n: 2.4, size: 1.45, range: 1.55 },
]

export interface MagicTarget { x: number; y: number; z: number }

/**
 * Fire a weapon's magic from `o` along the facing (fx, fz). `target`
 * (lightning): the nearest balloon ahead, if any. `owner`: `HIT_PEER` for
 * another player's magic (it pops balloons, pays no bits).
 */
export function fireMagic(p: Particles, magic: WeaponMagicId, level: 1 | 2 | 3, o: THREE.Vector3, fx: number, fz: number, target: MagicTarget | null, owner: number = HIT_OWN) {
  const L = LEVEL[level - 1]!
  const cols = WEAPON_MAGIC.find(m => m.id === magic)?.colors ?? ['#ffffff']
  const pick = () => cols[Math.floor(Math.random() * cols.length)]!
  const n = (k: number) => Math.round(k * L.n)
  const rx = -fz, rz = fx
  const rnd = (a: number) => (Math.random() * 2 - 1) * a
  switch (magic) {
    case 'bubbles':
      for (let i = 0; i < n(7); i++) {
        const s = 4 + Math.random() * 3 * L.range
        const side = rnd(1.4)
        p.spawn(o.x, o.y, o.z, fx * s + rx * side, 1 + Math.random(), fz * s + rz * side, pick(), 0.5 * L.size * (0.7 + Math.random() * 0.6), 1.6 + Math.random() * 1.2, SPR.bubble, Beh.Float, 0, owner)
      }
      break
    case 'stars':
      for (let i = 0; i < n(8); i++) {
        const s = 12 * L.range * (0.7 + Math.random() * 0.4)
        p.spawn(o.x, o.y, o.z, fx * s + rx * rnd(2), rnd(1.5) + 1, fz * s + rz * rnd(2), pick(), 0.42 * L.size, 0.9, SPR.star, Beh.Twinkle, 2, owner)
      }
      break
    case 'hearts':
      for (let i = 0; i < n(6); i++) {
        const s = 6 * L.range * (0.7 + Math.random() * 0.4)
        p.spawn(o.x, o.y, o.z, fx * s + rx * rnd(2.5), 2.5 + Math.random() * 2, fz * s + rz * rnd(2.5), pick(), 0.48 * L.size, 1.6, SPR.heart, Beh.Float, 0, owner)
      }
      break
    case 'flowers':
      for (let i = 0; i < n(6); i++) {
        const s = 6 * L.range * (0.6 + Math.random() * 0.6)
        p.spawn(o.x, o.y, o.z, fx * s + rx * rnd(2.5), 5 + Math.random() * 2, fz * s + rz * rnd(2.5), pick(), 0.5 * L.size, 3, SPR.flower, Beh.Bloom, 16, owner)
      }
      break
    case 'snow':
      for (let i = 0; i < n(16); i++) {
        const s = 5 * L.range * Math.random()
        p.spawn(o.x + rnd(0.5), o.y + 1 + Math.random() * 1.5, o.z + rnd(0.5), fx * s + rx * rnd(2.5), 1 + Math.random() * 2, fz * s + rz * rnd(2.5), pick(), 0.3 * L.size, 2 + Math.random(), SPR.snow, Beh.Plain, 2.2, owner)
      }
      break
    case 'confetti': {
      const cx = o.x + fx * 1.5, cz = o.z + fz * 1.5
      for (let i = 0; i < n(26); i++) {
        const a = Math.random() * Math.PI * 2
        const s = (3 + Math.random() * 6) * L.range
        p.spawn(cx, o.y, cz, Math.cos(a) * s * 0.6 + fx * s * 0.8, 4 + Math.random() * 5, Math.sin(a) * s * 0.6 + fz * s * 0.8, pick(), 0.28 * L.size, 1.5 + Math.random(), SPR.square, Beh.Plain, 12, owner)
      }
      break
    }
    case 'rainbow': {
      const len = 9 * L.range
      const steps = n(14)
      for (let b = 0; b < RAINBOW.length; b++) {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          const d = t * len
          const h = Math.sin(t * Math.PI) * len * 0.45 + b * 0.28
          p.spawn(o.x + fx * d, o.y + h - 0.3, o.z + fz * d, 0, 0, 0, RAINBOW[b]!, 0.36 * L.size, 0.9 + t * 0.5, SPR.square, Beh.Still, 0, i % 3 === 0 ? owner : 0)
        }
      }
      break
    }
    case 'lightning': {
      const tx = target ? target.x : o.x + fx * 9 * L.range
      const ty = target ? target.y : o.y - 1
      const tz = target ? target.z : o.z + fz * 9 * L.range
      const segs = 7
      let px = o.x, py = o.y, pz = o.z
      for (let s = 1; s <= segs; s++) {
        const t = s / segs
        const jx = s === segs ? 0 : rnd(0.8), jy = s === segs ? 0 : rnd(0.8)
        const nx = o.x + (tx - o.x) * t + rx * jx, ny = o.y + (ty - o.y) * t + jy, nz = o.z + (tz - o.z) * t + rz * jx
        const k = 5
        for (let j = 0; j < k; j++) {
          const u = j / k
          p.spawn(px + (nx - px) * u, py + (ny - py) * u, pz + (nz - pz) * u, 0, 0, 0, j % 2 ? cols[1]! : cols[0]!, 0.24 * L.size, 0.22 + Math.random() * 0.1, SPR.square, Beh.Still, 0, s === segs && j === k - 1 ? owner : 0)
        }
        px = nx; py = ny; pz = nz
      }
      p.burst(tx, ty, tz, n(8), cols, { speed: 5, size: 0.25, life: 0.4, sprite: SPR.sparkle, grav: 0 })
      break
    }
    case 'dragon':
      for (let i = 0; i < n(18); i++) {
        const s = (6 + Math.random() * 6) * L.range
        const k = Math.random()
        const c = k < 0.3 ? cols[2]! : k < 0.75 ? cols[0]! : cols[1]!
        p.spawn(o.x, o.y, o.z, fx * s + rx * rnd(2.2), rnd(1) + 1.5, fz * s + rz * rnd(2.2), c, 0.55 * L.size * (0.6 + Math.random() * 0.6), 0.5 + Math.random() * 0.4, SPR.puff, Beh.Shrink, -2, owner)
      }
      break
  }
}

// ---------------------------------------------------------------- balloons

export interface BalloonPark {
  readonly group: THREE.Group
  /** Nearest live balloon ahead of (x, z) along (fx, fz), within range. */
  nearestAhead(x: number, y: number, z: number, fx: number, fz: number, range: number): MagicTarget | null
  /** Pops a balloon near the point; returns true if one popped. `own` false: a peer's magic (onPop learns it). */
  tryPop(x: number, y: number, z: number, own?: boolean): boolean
  update(dt: number, t: number): void
  dispose(): void
}

const BALLOON_COLORS = ['#ff4f6f', '#ffd84f', '#4fb8ff', '#7fe07f', '#b89aff', '#ff8ac8', '#ff9f3f']

export function createBalloons(area: { minX: number; maxX: number; minZ: number; maxZ: number }, count: number, particles: Particles, onPop: (x: number, y: number, z: number, gold: boolean, own: boolean) => void): BalloonPark {
  const group = new THREE.Group()
  const geo = new THREE.IcosahedronGeometry(0.7, 0)
  geo.scale(1, 1.2, 1)
  const knot = new THREE.ConeGeometry(0.18, 0.25, 4)
  knot.rotateX(Math.PI)
  knot.translate(0, -0.95, 0)
  const merged = mergeTwo(geo, knot)
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff })
  const mesh = new THREE.InstancedMesh(merged, mat, count)
  const strGeo = new THREE.BoxGeometry(0.05, 1.6, 0.05)
  strGeo.translate(0, -1.9, 0)
  const strMat = new THREE.MeshBasicMaterial({ color: '#fff8fc' })
  const strings = new THREE.InstancedMesh(strGeo, strMat, count)
  mesh.castShadow = true
  mesh.frustumCulled = false
  strings.frustumCulled = false
  group.add(mesh, strings)
  const st = Array.from({ length: count }, (_, i) => ({
    x: area.minX + 1.5 + Math.random() * (area.maxX - area.minX - 3),
    z: area.minZ + 1.5 + Math.random() * (area.maxZ - area.minZ - 3),
    y: 2.8 + Math.random() * 3.5,
    ph: Math.random() * 6.28,
    alive: true,
    wait: 0,
    gold: i % 11 === 5,
    rise: 0,
  }))
  const c = new THREE.Color()
  st.forEach((b, i) => { mesh.setColorAt(i, c.set(b.gold ? '#ffd23f' : BALLOON_COLORS[i % BALLOON_COLORS.length]!)) })
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const sc = new THREE.Vector3()
  const v = new THREE.Vector3()
  const zero = new THREE.Vector3(0, 0, 0)
  const cur = (b: typeof st[number], t: number) => v.set(b.x + Math.sin(t * 0.4 + b.ph) * 0.8, b.y + Math.sin(t * 0.9 + b.ph * 2) * 0.35 - b.rise, b.z + Math.cos(t * 0.35 + b.ph) * 0.8)
  let clock = 0

  return {
    group,
    nearestAhead(x, y, z, fx, fz, range) {
      let best: MagicTarget | null = null
      let bd = range * range
      for (const b of st) {
        if (!b.alive) continue
        const p = cur(b, clock)
        const dx = p.x - x, dz = p.z - z
        if (dx * fx + dz * fz < 0) continue
        const d = dx * dx + dz * dz + (p.y - y) * (p.y - y) * 0.3
        if (d < bd) { bd = d; best = { x: p.x, y: p.y, z: p.z } }
      }
      return best
    },
    tryPop(x, y, z, own = true) {
      if (x < area.minX - 2 || x > area.maxX + 2 || z < area.minZ - 2 || z > area.maxZ + 2) return false
      for (const b of st) {
        if (!b.alive) continue
        const p = cur(b, clock)
        const dx = p.x - x, dy = p.y - y, dz = p.z - z
        if (dx * dx + dy * dy * 0.7 + dz * dz < 1.1) {
          b.alive = false
          b.wait = 4 + Math.random() * 4
          particles.burst(p.x, p.y, p.z, b.gold ? 30 : 18, b.gold ? ['#ffd23f', '#fff1b0', '#ffffff'] : ['#ff4f6f', '#ffd84f', '#4fb8ff', '#7fe07f', '#ff8ac8'], { speed: 7, size: 0.28, life: 1.2 })
          onPop(p.x, p.y, p.z, b.gold, own)
          return true
        }
      }
      return false
    },
    update(dt, t) {
      clock = t
      for (let i = 0; i < st.length; i++) {
        const b = st[i]!
        if (!b.alive) {
          b.wait -= dt
          if (b.wait <= 0) { b.alive = true; b.rise = 3; b.x = area.minX + 1.5 + Math.random() * (area.maxX - area.minX - 3); b.z = area.minZ + 1.5 + Math.random() * (area.maxZ - area.minZ - 3) }
          m4.compose(zero, q, sc.set(0, 0, 0))
          mesh.setMatrixAt(i, m4); strings.setMatrixAt(i, m4)
          continue
        }
        if (b.rise > 0) b.rise = Math.max(0, b.rise - dt * 1.5)
        cur(b, t)
        q.setFromAxisAngle(sc.set(0, 0, 1), Math.sin(t * 1.1 + b.ph) * 0.12)
        m4.compose(v, q, sc.set(1, 1, 1))
        mesh.setMatrixAt(i, m4)
        strings.setMatrixAt(i, m4)
      }
      mesh.instanceMatrix.needsUpdate = true
      strings.instanceMatrix.needsUpdate = true
    },
    dispose() {
      geo.dispose(); knot.dispose(); merged.dispose(); mat.dispose(); strGeo.dispose(); strMat.dispose()
      mesh.dispose(); strings.dispose()
    },
  }
}

/** Two non-indexed-compatible geometries into one (positions and normals). */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const A = a.index ? a.toNonIndexed() : a
  const B = b.index ? b.toNonIndexed() : b
  const pa = A.getAttribute('position').array as Float32Array, pb = B.getAttribute('position').array as Float32Array
  const na = A.getAttribute('normal').array as Float32Array, nb = B.getAttribute('normal').array as Float32Array
  const pos = new Float32Array(pa.length + pb.length); pos.set(pa); pos.set(pb, pa.length)
  const nrm = new Float32Array(na.length + nb.length); nrm.set(na); nrm.set(nb, na.length)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  return g
}
