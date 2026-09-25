/**
 * The world around the corridor: the scene lights, the biome sky, the
 * striped sun, the ground (one shader, a mode per biome), the flat-shaded
 * ridges, the warp between sectors (FOV kick + speed streaks) and the
 * chase camera. Space hides the ground, ridges and sun.
 */
import * as THREE from 'three'
import { BIOMES, createGroundMaterial, createSkyMaterial, setBiome as paintBiome, setSunDir, tickBiome, type BiomeId } from '../pixel'
import { clamp, rand, type Ctx } from './ctx'

export interface Env {
  readonly biome: BiomeId
  /** 0–1 while warping between sectors. */
  readonly warp: number
  setBiome(id: BiomeId): void
  /** Start the warp; the biome should change about 1 s later (its peak). */
  warpIn(): void
  update(dt: number): void
  resize(): void
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
}

const RIDGES = 44
const STREAKS = 56
const WARP_RISE = 1.0
const WARP_HOLD = 0.25
const WARP_FALL = 0.8
const OFFSET_WRAP = 4096

/** The attract camera looks up a little on phones, so the ship sits low under the title. */
const ATTRACT_LOOK_UP_PORTRAIT = 1.6

export function createEnv(ctx: Ctx): Env {
  const { scene, camera } = ctx
  scene.background = new THREE.Color('#0b0616')
  scene.fog = new THREE.Fog('#6a2a7c', 60, 340)
  scene.add(new THREE.HemisphereLight(0x9a7bff, 0x0b0616, 1.0))
  const key = new THREE.DirectionalLight(0xff2fa0, 1.4)
  key.position.set(-6, 10, -20)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x2ff3ff, 0.9)
  fill.position.set(6, -2, 8)
  scene.add(fill)

  // Sky: stars, nebula and the planet per biome (./pixel.ts).
  const skyMat = createSkyMaterial()
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), skyMat)
  sky.renderOrder = -5
  scene.add(sky)

  // The striped sun (the halo is left to the stage's bloom).
  const sunMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#fff1b0') }, bottom: { value: new THREE.Color('#ff2fa0') } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 top; uniform vec3 bottom;
      void main() {
        vec2 p = vUv - 0.5;
        if (length(p) > 0.5) discard;
        float y = vUv.y;
        if (fract(y * 11.0) < (1.0 - y) * 0.42) discard;
        gl_FragColor = vec4(mix(bottom, top, pow(y, 1.1)), 1.0);
      }`,
  })
  const sun = new THREE.Mesh(new THREE.CircleGeometry(55, 48), sunMat)
  sun.renderOrder = -2
  scene.add(sun)

  const groundMat = createGroundMaterial()
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 800, 1, 1), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -5, -260)
  ground.renderOrder = -1
  scene.add(ground)

  // ---- ridges: a ridged height field, 44 instances in one draw call
  const ridgeMat = new THREE.MeshLambertMaterial({ color: 0x2c2058, emissive: 0x140b26, flatShading: true })
  const ridges = new THREE.InstancedMesh(ridgeGeometry(), ridgeMat, RIDGES)
  ridges.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  ridges.frustumCulled = false
  scene.add(ridges)
  const rx = new Float32Array(RIDGES), rw = new Float32Array(RIDGES), rh = new Float32Array(RIDGES)
  const rz = new Float32Array(RIDGES), ryaw = new Float32Array(RIDGES), rside = new Float32Array(RIDGES)
  for (let i = 0; i < RIDGES; i++) {
    rside[i] = i % 2 === 0 ? -1 : 1
    rx[i] = rside[i]! * rand(26, 110)
    rw[i] = rand(14, 34)
    rh[i] = rand(10, 42)
    rz[i] = rand(-410, -90)
    ryaw[i] = rand(-0.6, 0.6)
  }
  let parX = 0
  let parY = 0

  // ---- warp streaks
  const streakMat = new THREE.MeshBasicMaterial({ color: '#cfc6ff', fog: false })
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 1), streakMat, STREAKS)
  streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  streaks.frustumCulled = false
  streaks.visible = false
  scene.add(streaks)
  const sx = new Float32Array(STREAKS), sy = new Float32Array(STREAKS), sz = new Float32Array(STREAKS)
  for (let i = 0; i < STREAKS; i++) {
    const a = rand(0, Math.PI * 2)
    const r = rand(6, 28)
    sx[i] = Math.cos(a) * r
    sy[i] = 2 + Math.sin(a) * r * 0.7
    sz[i] = rand(-170, 8)
  }

  const d = new THREE.Object3D()
  const tv = new THREE.Vector3()
  const look = new THREE.Vector3()
  let biome: BiomeId = 'coast'
  let warpT = -1
  let warp = 0
  let offset = 0
  let pulseT = 0
  let fovBase = 62
  let fovSet = 0

  function placeSun() {
    if (ctx.portrait) {
      sun.position.set(150, 200, -460)
      sun.scale.setScalar(0.5)
    } else {
      sun.position.set(300, 30, -460)
      sun.scale.setScalar(1)
    }
    sun.lookAt(0, camera.position.y, camera.position.z)
    tv.copy(sun.position).sub(camera.position)
    setSunDir(groundMat, tv.x, tv.y, tv.z)
  }

  function setBiome(id: BiomeId) {
    biome = id
    const b = BIOMES[id]
    paintBiome(groundMat, id, skyMat)
    ;(scene.fog as THREE.Fog).color.set(b.fog)
    ridgeMat.color.set(b.ridge)
    ridges.visible = b.ridges
    sun.visible = b.sun
    ground.visible = b.mode !== 5
  }

  function updateRidges(dt: number) {
    const motion = ctx.reduced ? 0 : 1
    const follow = 1 - Math.exp(-3.5 * dt)
    parX += (-ctx.player.x * 1.8 * motion - parX) * follow
    parY += (-ctx.player.y * 0.45 * motion - parY) * follow
    if (!ridges.visible) return
    for (let i = 0; i < RIDGES; i++) {
      rz[i]! += ctx.worldSpeed * 0.85 * dt * motion
      if (rz[i]! > -90) {
        rz[i]! -= 320
        rx[i] = rside[i]! * rand(26, 110)
        rw[i] = rand(14, 34)
        rh[i] = rand(10, 42)
      }
      // Near slopes move farther than the distant ridges; the sun stays put.
      const depth = clamp((rz[i]! + 410) / 320, 0, 1)
      d.position.set(rx[i]! + parX * (0.2 + depth * 0.8), -7 + parY * depth, rz[i]!)
      d.scale.set(rw[i]!, rh[i]!, rw[i]! * 0.8)
      d.rotation.set(0, ryaw[i]!, 0)
      d.updateMatrix()
      ridges.setMatrixAt(i, d.matrix)
    }
    ridges.instanceMatrix.needsUpdate = true
  }

  function updateWarp(dt: number) {
    if (warpT >= 0) {
      warpT += dt
      if (warpT < WARP_RISE) warp = warpT / WARP_RISE
      else if (warpT < WARP_RISE + WARP_HOLD) warp = 1
      else warp = Math.max(0, 1 - (warpT - WARP_RISE - WARP_HOLD) / WARP_FALL)
      if (warpT > WARP_RISE + WARP_HOLD + WARP_FALL) { warpT = -1; warp = 0 }
    }
    streaks.visible = warp > 0.02
    if (streaks.visible) {
      const len = 2 + 30 * warp
      for (let i = 0; i < STREAKS; i++) {
        sz[i]! += (ctx.worldSpeed * 2 + 260 * warp) * dt
        if (sz[i]! > 12) sz[i]! -= 180
        d.position.set(sx[i]!, sy[i]!, sz[i]!)
        d.scale.set(1, 1, len)
        d.rotation.set(0, 0, 0)
        d.updateMatrix()
        streaks.setMatrixAt(i, d.matrix)
      }
      streaks.instanceMatrix.needsUpdate = true
    }
    // FOV kick: eased, smaller with reduced motion.
    const kick = warp * warp * (3 - 2 * warp) * (ctx.reduced ? 6 : 24)
    const fov = fovBase + kick
    if (Math.abs(fov - fovSet) > 0.01) {
      camera.fov = fov
      fovSet = fov
      camera.updateProjectionMatrix()
    }
  }

  function updateCamera(dt: number) {
    const p = ctx.player
    const portrait = ctx.portrait
    // A portrait screen is narrow for the lane: the camera follows the ship
    // further across, so it stays on screen at the lane's edges.
    const fx = portrait ? 0.75 : 0.5
    const k = 1 - Math.exp(-4.5 * dt)
    const t = ctx.now
    tv.set(
      p.x * fx + Math.sin(t * 1.3) * 0.15,
      (portrait ? 6.5 : 3.8) + p.y * 0.28 * fx + Math.sin(t * 1.7) * 0.12,
      portrait ? 14 : 11.5,
    )
    camera.position.lerp(tv, k)
    if (ctx.shake > 0) {
      ctx.shake = Math.max(0, ctx.shake - dt * 2.4)
      if (!ctx.reduced) {
        const s = ctx.shake * ctx.shake * 0.9
        camera.position.x += rand(-s, s)
        camera.position.y += rand(-s, s)
      }
    }
    look.set(p.x * (portrait ? 0.85 : 0.75), 1.0 + p.y * 0.3 + (portrait && !ctx.started ? ATTRACT_LOOK_UP_PORTRAIT : 0), -40)
    camera.lookAt(look)
  }

  setBiome('coast')

  return {
    get biome() { return biome },
    get warp() { return warp },
    setBiome,
    warpIn() { warpT = 0 },
    update(dt) {
      pulseT += dt
      const beat = Math.pow(Math.max(0, Math.sin(pulseT * 2.4)), 6)
      const u = groundMat.uniforms
      u.uPulse!.value = 0.25 + beat
      offset = (offset + ctx.worldSpeed * dt) % OFFSET_WRAP
      u.uOffset!.value = offset
      tickBiome(groundMat, skyMat, pulseT)
      updateRidges(dt)
      updateWarp(dt)
      updateCamera(dt)
    },
    resize() {
      fovBase = ctx.portrait ? 80 : 62
      fovSet = 0
      placeSun()
    },
    lights(add) {
      // Keep the sun bright through the light map; under 0.3 the stage adds
      // no bloom for it, which would wash the ridges in front of it grey.
      if (sun.visible) add(sun.position.x, sun.position.y, sun.position.z, 60 * sun.scale.x, '#ffffff', 0.29)
    },
  }
}

/** The ridged height field: shoulders, gullies and subsidiary summits. */
function ridgeGeometry(): THREE.BufferGeometry {
  // 14×10 cells: at the stage's ~320×200 pixels the old 24×18 grid (38k
  // triangles for the 44 ridges) looked the same and cost a quarter of
  // the frame in software GL.
  const columns = 14
  const rows = 10
  const positions: number[] = []
  const indices: number[] = []
  for (let z = 0; z <= rows; z++) {
    for (let x = 0; x <= columns; x++) {
      const px = x / columns * 2 - 1
      const pz = z / rows * 2 - 1
      const envelope = Math.pow(Math.max(0, 1 - px * px), 1.2) * Math.pow(Math.max(0, 1 - pz * pz), 1.5)
      const spine = pz + 0.19 * Math.sin(px * 5.7) - 0.1 * px
      const ridge = Math.exp(-Math.abs(spine) * 3.4)
      const peaks = 0.62 + 0.2 * Math.sin(px * 5.1 + 0.7) + 0.11 * Math.sin(px * 11.3 - 1.2)
      const gullies = 0.07 * Math.sin(px * 27 + pz * 9) + 0.035 * Math.sin(px * 43 - pz * 17)
      positions.push(px, envelope * Math.max(0.04, 0.16 + ridge * peaks + gullies), pz)
      if (x < columns && z < rows) {
        const a = z * (columns + 1) + x
        const b = a + columns + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  }
  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  indexed.setIndex(indices)
  const geo = indexed.toNonIndexed()
  indexed.dispose()
  geo.computeVertexNormals()
  return geo
}
