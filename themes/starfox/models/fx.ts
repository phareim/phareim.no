/**
 * Effects (2026-09-25): explosion debris, the charge orb, the nova bomb
 * and its shockwave, the player's shield bubble, muzzle flash and engine
 * trail. All pooled or single objects built once; no allocation per frame.
 */
import * as THREE from 'three'
import { P, geo, glowMat, hullMat, mesh, mat, light, ringZ, type Hex, type ModelLight } from './core'

// ---------------------------------------------------------------- debris

export interface Debris {
  mesh: THREE.InstancedMesh
  /** Throw `count` tumbling shards from (x, y, z) in `color`, cooling to dark as they fall. */
  spawn(x: number, y: number, z: number, color: Hex, count: number, speed: number, size?: number): void
  /** Gravity, bounce on the ground, cool and shrink. `worldVz` moves resting shards with the world (they stream past). */
  update(dt: number, groundY?: number, worldVz?: number): void
  /** Hot shards as glow anchors (the few brightest), for the stage light map. */
  lights(add: (x: number, y: number, z: number, r: number, color: Hex, a: number) => void, max?: number): void
  clear(): void
}

export function createDebris(capacity = 240): Debris {
  const g = geo('fx/shard', b => { b.loft([[[0, 0.5, 0]], ringZ(3, 0.5, 0.5, 0).map(p => [p[0], 0, p[1]] as [number, number, number]), [[0.1, -0.3, 0.1]]]) })
  const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }), capacity)
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  m.frustumCulled = false
  const pos = new Float32Array(capacity * 3)
  const vel = new Float32Array(capacity * 3)
  const rot = new Float32Array(capacity * 3)
  const spin = new Float32Array(capacity * 3)
  const life = new Float32Array(capacity)
  const max = new Float32Array(capacity)
  const size = new Float32Array(capacity)
  const hot = new Array<THREE.Color>(capacity)
  const hotHex = new Array<string>(capacity).fill(P.white)
  const cold = new THREE.Color(P.dusk)
  const tmpC = new THREE.Color()
  const d = new THREE.Object3D()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < capacity; i++) { m.setMatrixAt(i, zero); m.setColorAt(i, cold); hot[i] = new THREE.Color() }
  let cursor = 0
  let alive = 0

  return {
    mesh: m,
    spawn(x, y, z, color, count, speed, sz = 0.35) {
      for (let k = 0; k < count; k++) {
        const i = cursor
        cursor = (cursor + 1) % capacity
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
        const th = Math.random() * Math.PI * 2
        const up = Math.random() * 0.9 + 0.1
        const sp = speed * (0.35 + Math.random() * 0.65)
        vel[i * 3] = Math.cos(th) * sp * (1 - up * 0.5)
        vel[i * 3 + 1] = up * sp
        vel[i * 3 + 2] = Math.sin(th) * sp * (1 - up * 0.5)
        for (let a = 0; a < 3; a++) { rot[i * 3 + a] = Math.random() * 6.28; spin[i * 3 + a] = (Math.random() - 0.5) * 16 }
        max[i] = life[i] = 1.3 + Math.random() * 1.1
        size[i] = sz * (0.5 + Math.random())
        hotHex[i] = k % 3 === 0 ? P.white : color
        hot[i]!.set(hotHex[i]!)
      }
      alive = capacity
    },
    update(dt, groundY = -5, worldVz = 0) {
      if (alive === 0) return
      let any = 0
      for (let i = 0; i < capacity; i++) {
        if (life[i]! <= 0) continue
        life[i]! -= dt
        if (life[i]! <= 0) { m.setMatrixAt(i, zero); continue }
        any++
        const j = i * 3
        vel[j + 1]! -= 22 * dt
        pos[j]! += vel[j]! * dt
        pos[j + 1]! += vel[j + 1]! * dt
        pos[j + 2]! += (vel[j + 2]! + worldVz) * dt
        const s = size[i]!
        if (pos[j + 1]! < groundY + s * 0.3) {
          pos[j + 1] = groundY + s * 0.3
          vel[j + 1] = Math.abs(vel[j + 1]!) * 0.32
          vel[j]! *= 0.6
          vel[j + 2]! *= 0.6
          spin[j]! *= 0.6; spin[j + 1]! *= 0.6; spin[j + 2]! *= 0.6
        }
        rot[j]! += spin[j]! * dt; rot[j + 1]! += spin[j + 1]! * dt; rot[j + 2]! += spin[j + 2]! * dt
        const age = 1 - life[i]! / max[i]!
        const shrink = Math.min(1, life[i]! / 0.35)
        d.position.set(pos[j]!, pos[j + 1]!, pos[j + 2]!)
        d.rotation.set(rot[j]!, rot[j + 1]!, rot[j + 2]!)
        d.scale.setScalar(s * shrink)
        d.updateMatrix()
        m.setMatrixAt(i, d.matrix)
        // Hot to cold in two steps (a smooth fade would dither to static).
        m.setColorAt(i, age < 0.25 ? hot[i]! : age < 0.55 ? tmpC.copy(hot[i]!).lerp(cold, 0.5) : cold)
      }
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      if (any === 0) alive = 0
    },
    lights(add, maxN = 6) {
      let n = 0
      for (let i = 0; i < capacity && n < maxN; i++) {
        if (life[i]! <= 0 || 1 - life[i]! / max[i]! > 0.25) continue
        add(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, 0.8, hotHex[i]!, 0.5)
        n++
      }
    },
    clear() {
      life.fill(0)
      for (let i = 0; i < capacity; i++) m.setMatrixAt(i, zero)
      m.instanceMatrix.needsUpdate = true
      alive = 0
    },
  }
}

// ---------------------------------------------------------------- charge orb

export interface ChargeOrb {
  root: THREE.Group
  lights: ModelLight[]
  /** 0 hidden, 0–1 charging (grows), 1 locked (spikes out, faster). */
  set(charge: number, t: number): void
}

export function createChargeOrb(): ChargeOrb {
  const root = new THREE.Group()
  const core = mesh(geo('fx/orb-core', g => { g.add(new THREE.IcosahedronGeometry(0.35, 0)) }), glowMat(P.white), root)
  const shell = mesh(geo('fx/orb-shell', g => { g.add(new THREE.IcosahedronGeometry(0.62, 0)) }), glowMat(P.cyan), root)
  const spikes = mesh(geo('fx/orb-spikes', g => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      g.add(new THREE.ConeGeometry(0.12, 0.7, 4), mat(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0, 0, 0, a - Math.PI / 2))
    }
  }), glowMat(P.cyanDark), root)
  ;(shell.material as THREE.MeshBasicMaterial).transparent = false
  const lights = [light(root, 0, 0, 0, 1.2, P.cyan, 0.8)]
  return {
    root, lights,
    set(c, t) {
      root.visible = c > 0.02
      const k = Math.min(1, c)
      core.scale.setScalar(0.5 + k * 0.7)
      shell.scale.setScalar(0.3 + k * 0.8)
      shell.rotation.set(t * 3, t * 4, 0)
      spikes.visible = k >= 1
      spikes.rotation.z = t * 8
      shell.visible = Math.floor(t * (k >= 1 ? 20 : 8)) % 3 !== 0
      lights[0]!.r = 0.6 + k * 1.4
    },
  }
}

// ---------------------------------------------------------------- nova bomb + shockwave

export interface BombShell { root: THREE.Group; lights: ModelLight[]; animate(t: number): void }

export function createBombShell(): BombShell {
  const root = new THREE.Group()
  const spinner = new THREE.Group()
  root.add(spinner)
  mesh(geo('fx/bomb-body', g => { g.loft([[[0, 0, 0.7]], ringZ(6, 0.36, 0.36, 0.3), ringZ(6, 0.36, 0.36, -0.35), ringZ(6, 0.2, 0.2, -0.6)]) }), hullMat(P.pinkDark), spinner)
  mesh(geo('fx/bomb-glow', g => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      g.add(new THREE.BoxGeometry(0.06, 0.34, 0.4), mat(Math.cos(a) * 0.42, Math.sin(a) * 0.42, -0.4, 0, 0, a - Math.PI / 2))
    }
    g.loft([ringZ(6, 0.38, 0.38, 0.1), ringZ(6, 0.38, 0.38, -0.1)], false, false)
  }), glowMat(P.hot), spinner)
  const lights = [light(root, 0, 0, 0, 1.1, P.hot, 0.8)]
  return { root, lights, animate(t) { spinner.rotation.z = t * 9 } }
}

export interface Shockwave {
  root: THREE.Group
  /** Start at (x, y, z) growing to `radius` over `duration` seconds. */
  fire(x: number, y: number, z: number, radius: number, duration?: number): void
  update(dt: number): void
  readonly active: boolean
  /** Current radius (for the kill test) and 0–1 progress. */
  readonly radius: number
  readonly k: number
  lights(add: (x: number, y: number, z: number, r: number, color: Hex, a: number) => void): void
}

export function createShockwave(): Shockwave {
  const root = new THREE.Group()
  root.visible = false
  const shellMat = new THREE.MeshBasicMaterial({ color: P.hot, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, wireframe: false })
  const shell = new THREE.Mesh(geo('fx/shock-shell', g => { g.add(new THREE.IcosahedronGeometry(1, 1)) }), shellMat)
  root.add(shell)
  const ringMat = new THREE.MeshBasicMaterial({ color: P.pink, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const ring = new THREE.Mesh(geo('fx/shock-ring', g => { g.add(new THREE.TorusGeometry(1, 0.06, 3, 24), mat(0, 0, 0, Math.PI / 2)) }), ringMat)
  root.add(ring)
  const core = mesh(geo('fx/shock-core', g => { g.add(new THREE.IcosahedronGeometry(1, 0)) }), glowMat(P.white), root)
  let t = 0
  let dur = 0.7
  let R = 12
  let active = false
  const wave: Shockwave = {
    root,
    get active() { return active },
    get radius() { return active ? R * ease(t / dur) : 0 },
    get k() { return active ? t / dur : 1 },
    fire(x, y, z, radius, duration = 0.7) {
      root.position.set(x, y, z)
      R = radius
      dur = duration
      t = 0
      active = true
      root.visible = true
    },
    update(dt) {
      if (!active) return
      t += dt
      const k = t / dur
      if (k >= 1) { active = false; root.visible = false; return }
      const r = R * ease(k)
      shell.scale.setScalar(r)
      shellMat.opacity = 0.55 * (1 - k)
      ring.scale.setScalar(r * 1.05)
      ringMat.opacity = 1 - k * k
      core.scale.setScalar(Math.max(0.01, R * 0.18 * (1 - k * 3)))
      core.visible = k < 0.33
    },
    lights(add) {
      if (!active) return
      const k = t / dur
      add(root.position.x, root.position.y, root.position.z, R * ease(k) * 0.8, P.hot, 0.9 * (1 - k))
    },
  }
  return wave
}

function ease(k: number): number {
  return 1 - (1 - k) * (1 - k) * (1 - k)
}

// ---------------------------------------------------------------- shield bubble

export interface ShieldBubble {
  root: THREE.Group
  /** strength 0–1 (0 hides it; low strength flickers), t for the shimmer. */
  set(strength: number, t: number): void
  /** A hit: the bubble flashes white for a moment. */
  hit(): void
  update(dt: number): void
}

export function createShieldBubble(radius = 2.6): ShieldBubble {
  const root = new THREE.Group()
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(P.jade) }, uHit: { value: 0 }, uTime: { value: 0 }, uStrength: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        vP = position;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      uniform vec3 uColor; uniform float uHit; uniform float uTime; uniform float uStrength;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), vV));
        // Rim in steps: at pixel size a smooth rim is dither noise.
        float a = f > 0.72 ? 0.9 : (f > 0.5 ? 0.35 : 0.0);
        float band = step(0.85, fract(vP.y * 1.2 - uTime * 0.8));
        a = max(a, band * 0.3);
        a *= uStrength;
        vec3 c = mix(uColor, vec3(1.0), uHit);
        gl_FragColor = vec4(c * (a + uHit * 0.6), 1.0);
      }`,
  })
  const s = new THREE.Mesh(geo('fx/shield', g => { g.add(new THREE.IcosahedronGeometry(1, 1)) }), m)
  s.scale.set(radius * 1.35, radius * 0.75, radius)
  root.add(s)
  let hitT = 0
  return {
    root,
    set(strength, t) {
      root.visible = strength > 0.01 && (strength > 0.25 || Math.floor(t * 12) % 2 === 0)
      m.uniforms.uStrength!.value = Math.min(1, 0.5 + strength)
      m.uniforms.uTime!.value = t
    },
    hit() { hitT = 0.18 },
    update(dt) {
      hitT = Math.max(0, hitT - dt)
      m.uniforms.uHit!.value = hitT > 0 ? 1 : 0
    },
  }
}

// ---------------------------------------------------------------- muzzle flash

export interface MuzzleFlash { root: THREE.Group; fire(): void; update(dt: number): void; lights: ModelLight[] }

export function createMuzzleFlash(color: Hex = P.cyan): MuzzleFlash {
  const root = new THREE.Group()
  const star = mesh(geo('fx/muzzle', g => {
    g.fin([[0, 0.5, 0], [0, 0, 0.9], [0, -0.5, 0], [0, 0, -0.2]], 0.02)
    g.plate([[0.5, 0, 0], [0, 0, 0.9], [-0.5, 0, 0], [0, 0, -0.2]], 0.02)
  }), glowMat(color), root)
  const core = mesh(geo('fx/muzzle-core', g => { g.add(new THREE.OctahedronGeometry(0.22)) }), glowMat(P.white), root)
  const lights = [light(root, 0, 0, 0.2, 0.9, color, 0.8)]
  let t = 0
  root.visible = false
  return {
    root, lights,
    fire() { t = 0.07; root.visible = true; root.rotation.z = Math.random() * Math.PI },
    update(dt) {
      if (t <= 0) return
      t -= dt
      const k = Math.max(0, t / 0.07)
      star.scale.setScalar(0.5 + k * 0.8)
      core.scale.setScalar(k)
      if (t <= 0) root.visible = false
      lights[0]!.on = t > 0
    },
  }
}

// ---------------------------------------------------------------- engine trail

export interface EngineTrail {
  mesh: THREE.Mesh
  /** Feed the engine's world position each frame; `worldVz` streams old points back (+Z). */
  update(dt: number, x: number, y: number, z: number, worldVz: number): void
  reset(x: number, y: number, z: number): void
}

/** A tapering ribbon of `n` segments behind an engine, facing up (seen from behind and above). */
export function createEngineTrail(color: Hex = P.cyan, n = 9, width = 0.34, maxLen = 3.2): EngineTrail {
  const pts = new Float32Array(n * 3)
  const pos = new Float32Array(n * 2 * 3)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const idx: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  g.setIndex(idx)
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const me = new THREE.Mesh(g, m)
  me.frustumCulled = false
  let acc = 0
  let fresh = true
  const trail: EngineTrail = {
    mesh: me,
    reset(x, y, z) {
      for (let i = 0; i < n; i++) { pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z }
    },
    update(dt, x, y, z, worldVz) {
      if (fresh) { trail.reset(x, y, z); fresh = false }
      acc += dt
      for (let i = 1; i < n; i++) pts[i * 3 + 2]! += worldVz * dt
      if (acc > 1 / 60) {
        acc = 0
        for (let i = n - 1; i > 0; i--) { pts[i * 3] = pts[(i - 1) * 3]!; pts[i * 3 + 1] = pts[(i - 1) * 3 + 1]!; pts[i * 3 + 2] = pts[(i - 1) * 3 + 2]! }
      }
      pts[0] = x; pts[1] = y; pts[2] = z
      // Cap each segment (slow frames and fast turns would otherwise stretch it into a streak).
      const seg = maxLen / (n - 1)
      for (let i = 1; i < n; i++) {
        const j = i * 3, k = j - 3
        const dx = pts[j]! - pts[k]!, dy = pts[j + 1]! - pts[k + 1]!, dz = pts[j + 2]! - pts[k + 2]!
        const l = Math.hypot(dx, dy, dz)
        if (l > seg) {
          const f = seg / l
          pts[j] = pts[k]! + dx * f
          pts[j + 1] = pts[k + 1]! + dy * f
          pts[j + 2] = pts[k + 2]! + dz * f
        }
      }
      for (let i = 0; i < n; i++) {
        const w = width * (1 - i / n) * 0.5
        // Ribbon crosses both ways (an X in section) so it reads from behind and from the side.
        const px = pts[i * 3]!, py = pts[i * 3 + 1]!, pz = pts[i * 3 + 2]!
        pos[i * 6] = px - w; pos[i * 6 + 1] = py + w * 0.4; pos[i * 6 + 2] = pz
        pos[i * 6 + 3] = px + w; pos[i * 6 + 4] = py - w * 0.4; pos[i * 6 + 5] = pz
      }
      g.attributes.position!.needsUpdate = true
    },
  }
  return trail
}
