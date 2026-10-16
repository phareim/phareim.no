/**
 * Space Voyagers II: the 3D side of a frame. It keeps a mesh for every ship
 * in the world, the bolts as lines, missiles and their smoke, decoys and
 * debris, the stars and the painted sky, and puts the camera where the
 * player sits (or where a cut looks from). `toon.ts` colours and outlines it.
 *
 * The scene reads the world and never changes it.
 */
import * as THREE from 'three'
import { SHIPS } from '../engine/balance'
import { calzoneTurret, turretAim } from '../engine/seats'
import { live } from '../engine/ships'
import type { Ship, ShipKind } from '../engine/types'
import { calzone } from '../engine/world'
import type { Voyage } from '../engine/world'
import { BODY, chunkData, modelData, VIS, visScale } from './models'
import type { ModelData } from './models'
import { C, hexRgb, M, SPACE } from './palette'
import { Shape } from './shapes'
import { createPost, toonMaterial } from './toon'
import type { PostPass } from './toon'

const MAX_BOLTS = 600
const MAX_PUFFS = 400
const MAX_CHUNKS = 160

interface Chunk { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number }
interface Puff { pos: THREE.Vector3; life: number }

/** One sky piece: a picture far away in a fixed direction. */
export interface SkyPiece { src: string; dir: [number, number, number] }

export interface Scene3D {
  /** Draw the world as the camera sees it into the GL canvas (its size is the view's, in logical pixels). */
  render(w: Voyage, frame: number): void
  resize(w: number, h: number): void
  /** The camera, for projecting HUD marks. */
  camera: THREE.PerspectiveCamera
  /** Where the camera sits: 'front', 'back' or 'outside'. */
  view: 'front' | 'back' | 'outside'
  /** Tell the scene a ship was hit or killed (flashes and debris). */
  hit(id: number): void
  explode(w: Voyage, kind: ShipKind, x: number, y: number, z: number): void
  setSky(pieces: SkyPiece[], act: number): void
  dispose(): void
}

function geometryOf(d: ModelData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3))
  g.setAttribute('mat', new THREE.BufferAttribute(d.mat, 1))
  g.computeBoundingSphere()
  return g
}

function missileData(): ModelData {
  const s = new Shape()
  s.cyl(0.25, 0.25, 2.4, 6, M.white)
  s.cyl(0, 0.25, 0.6, 6, M.red, { at: [0, 0, -1.5] })
  for (const r of [0, Math.PI / 2]) s.box(1.0, 0.08, 0.6, M.red, { at: [0, 0, 1.0], rot: [0, 0, r] })
  return { pos: new Float32Array(s.pos), nor: new Float32Array(s.nor), mat: new Float32Array(s.mat) }
}

function torpedoData(): ModelData {
  const s = new Shape()
  s.cyl(0.8, 0.8, 5, 8, M.steel)
  s.cyl(0, 0.8, 1.4, 8, M.mred, { at: [0, 0, -3.2] })
  s.cyl(0.6, 0.4, 0.4, 6, M.glow, { at: [0, 0, 2.7] })
  return { pos: new Float32Array(s.pos), nor: new Float32Array(s.nor), mat: new Float32Array(s.mat) }
}

/** A seeded number in [0, 1) for star i, part k. */
function seeded(i: number, k: number): number {
  let h = Math.imul(i + 1, 0x9E3779B1) ^ Math.imul(k + 0x7F4A7C15, 0x85EBCA6B)
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12
  return (h >>> 0) / 4294967296
}

export function createScene(renderer: THREE.WebGLRenderer): Scene3D {
  const main = new THREE.Scene()
  const sky = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 30000)
  const skyCam = new THREE.PerspectiveCamera(70, 1, 1, 5000)
  const post: PostPass = createPost()
  let space = new THREE.Color(...hexRgb(SPACE[0]!.base))
  let viewH = 200

  // ---- ships
  const geos = new Map<string, THREE.BufferGeometry>()
  const geo = (key: string, make: () => ModelData): THREE.BufferGeometry => {
    let g = geos.get(key)
    if (!g) { g = geometryOf(make()); geos.set(key, g) }
    return g
  }
  const meshes = new Map<number, { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; flash: number }>()

  // ---- bolts: one set of line segments, the head light and the tail darker
  const boltPos = new Float32Array(MAX_BOLTS * 6)
  const boltCol = new Float32Array(MAX_BOLTS * 6)
  const boltGeo = new THREE.BufferGeometry()
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPos, 3).setUsage(THREE.DynamicDrawUsage))
  boltGeo.setAttribute('color', new THREE.BufferAttribute(boltCol, 3).setUsage(THREE.DynamicDrawUsage))
  const bolts = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ vertexColors: true, depthWrite: false }))
  bolts.frustumCulled = false
  main.add(bolts)
  const colours = {
    ours: [hexRgb(C.boltCore), hexRgb(C.bolt)],
    turret: [hexRgb('#ffe0b0'), hexRgb(C.turretBolt)],
    theirs: [hexRgb(C.enemyBoltCore), hexRgb(C.enemyBolt)],
  }

  // ---- missiles, smoke, decoys
  const missileMeshes: THREE.Mesh[] = []
  const missileMat = toonMaterial()
  const puffs: Puff[] = []
  const puffPos = new Float32Array(MAX_PUFFS * 3)
  const puffCol = new Float32Array(MAX_PUFFS * 3)
  const puffGeo = new THREE.BufferGeometry()
  puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3).setUsage(THREE.DynamicDrawUsage))
  puffGeo.setAttribute('color', new THREE.BufferAttribute(puffCol, 3).setUsage(THREE.DynamicDrawUsage))
  const puffPoints = new THREE.Points(puffGeo, new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, vertexColors: true, depthWrite: false }))
  puffPoints.frustumCulled = false
  main.add(puffPoints)
  const smokeHi = hexRgb('#b4bccc'), smokeLo = hexRgb('#5a6078')

  // ---- debris
  const chunks: Chunk[] = []
  const chunkGeos = new Map<number, THREE.BufferGeometry>()

  // ---- stars and the painted sky
  const STARS = 1400
  const starPos = new Float32Array(STARS * 3)
  const starCol = new Float32Array(STARS * 3)
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
  for (let i = 0; i < STARS; i++) {
    const u = seeded(i, 1) * 2 - 1, a = seeded(i, 2) * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    starPos[i * 3] = Math.cos(a) * r * 2000
    starPos[i * 3 + 1] = u * 2000
    starPos[i * 3 + 2] = Math.sin(a) * r * 2000
  }
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, vertexColors: true, depthWrite: false }))
  sky.add(stars)
  let skySprites: THREE.Sprite[] = []
  const loader = new THREE.TextureLoader()

  function setSky(pieces: SkyPiece[], act: number): void {
    const sp = SPACE[Math.max(0, Math.min(SPACE.length - 1, act))]!
    space = new THREE.Color(...hexRgb(sp.base))
    const tones = [hexRgb(sp.far), hexRgb(sp.mid), hexRgb(sp.near)]
    for (let i = 0; i < STARS; i++) {
      const t = seeded(i, 3)
      const c = t < 0.62 ? tones[0]! : t < 0.92 ? tones[1]! : tones[2]!
      starCol[i * 3] = c[0]; starCol[i * 3 + 1] = c[1]; starCol[i * 3 + 2] = c[2]
    }
    ;(starGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    for (const s of skySprites) { sky.remove(s); s.material.map?.dispose(); s.material.dispose() }
    skySprites = []
    for (const p of pieces) {
      const mat = new THREE.SpriteMaterial({ transparent: false, alphaTest: 0.5, depthWrite: false, depthTest: false })
      const spr = new THREE.Sprite(mat)
      const d = new THREE.Vector3(...p.dir).normalize().multiplyScalar(1800)
      spr.position.copy(d)
      spr.visible = false
      loader.load(p.src, tex => {
        tex.magFilter = THREE.NearestFilter
        tex.minFilter = THREE.NearestFilter
        tex.generateMipmaps = false
        // Not decoded: the picture's pixels are palette tones and go to the screen as they are.
        tex.colorSpace = THREE.NoColorSpace
        mat.map = tex
        mat.needsUpdate = true
        spr.userData.w = (tex.image as { width: number }).width
        spr.userData.h = (tex.image as { height: number }).height
        spr.visible = true
        sizeSprites()
      }, undefined, () => { /* a missing picture leaves the sky bare */ })
      sky.add(spr)
      skySprites.push(spr)
    }
  }

  /** A sky piece is drawn at one texel a logical pixel. */
  function sizeSprites(): void {
    const radPerPx = (camera.fov * Math.PI / 180) / viewH
    for (const s of skySprites) {
      if (!s.userData.w) continue
      const k = 1800 * Math.tan(radPerPx)
      s.scale.set(s.userData.w * k, s.userData.h * k, 1)
    }
  }

  function meshFor(s: Ship): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; flash: number } {
    let m = meshes.get(s.id)
    if (!m) {
      const mat = toonMaterial()
      const mesh = new THREE.Mesh(geo(s.kind, () => modelData(s.kind)), mat)
      mesh.scale.setScalar(visScale(SHIPS[s.kind].capital === true))
      main.add(mesh)
      m = { mesh, mat, flash: 0 }
      meshes.set(s.id, m)
    }
    return m
  }

  const tmpV = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const up = new THREE.Vector3()
  const look = new THREE.Vector3()
  let orbit = 0
  const outsideFrom = new THREE.Vector3()

  function place(w: Voyage, frame: number): void {
    const me = calzone(w)
    const stage = w.mission.stage
    const inside = live(me) && (stage === 'fly') && !w.ejected
    if (inside && me) {
      const back = w.seat === 'back' && w.crew.swapping < 25
      const front = w.seat === 'front' && w.crew.swapping < 25
      const viewSeat = front || (w.seat === 'back' && !back) ? 'front' : 'back'
      // Halfway through a change of seats the view jumps to the other seat.
      const seat = w.crew.swapping > 0 ? (w.crew.swapping >= 25 ? (w.seat === 'front' ? 'back' : 'front') : w.seat) : w.seat
      void viewSeat
      tmpQ.set(me.q.x, me.q.y, me.q.z, me.q.w)
      if (seat === 'front') {
        tmpV.set(0, 2.1 * VIS, -2.8 * VIS).applyQuaternion(tmpQ)
        camera.position.set(me.pos.x + tmpV.x, me.pos.y + tmpV.y, me.pos.z + tmpV.z)
        camera.quaternion.copy(tmpQ)
        api.view = 'front'
      } else {
        const t = calzoneTurret(me)
        if (t) {
          tmpV.set(t.at.x, t.at.y + 1.0, t.at.z).applyQuaternion(tmpQ)
          camera.position.set(me.pos.x + tmpV.x, me.pos.y + tmpV.y, me.pos.z + tmpV.z)
          const a = turretAim(me)
          up.set(0, 1, 0).applyQuaternion(tmpQ)
          look.set(camera.position.x + a.x, camera.position.y + a.y, camera.position.z + a.z)
          camera.up.copy(up)
          camera.lookAt(look)
        }
        api.view = 'back'
      }
      return
    }
    api.view = 'outside'
    // Outside: the cuts.
    const target = me ?? w.ships[0]
    if (!target) return
    tmpQ.set(target.q.x, target.q.y, target.q.z, target.q.w)
    if (stage === 'launch') {
      // From beside the oven door, watching the Calzone come out.
      const home = w.ships.find(s => s.id === w.carrier)
      if (home && w.mission.t <= 1) {
        // Out along the Calzone's way, a little to the side and above, so the Deep Dish is behind it.
        tmpV.set(55, 22, -620).applyQuaternion(tmpQ)
        outsideFrom.set(home.pos.x + tmpV.x, home.pos.y + tmpV.y, home.pos.z + tmpV.z)
      }
      camera.position.copy(outsideFrom)
      camera.up.set(0, 1, 0)
      const k = Math.min(1, w.mission.t / 120)
      look.set(home ? home.pos.x * (1 - k) + target.pos.x * k : target.pos.x, home ? home.pos.y * (1 - k) + target.pos.y * k : target.pos.y, home ? home.pos.z * (1 - k) + target.pos.z * k : target.pos.z)
      camera.lookAt(look)
    } else if (stage === 'auto' || stage === 'land') {
      // A slow orbit behind and above, the wing in the picture.
      orbit = frame / 240
      const r = stage === 'land' ? 170 : 130
      tmpV.set(Math.sin(orbit) * r * 0.6, 30 + Math.cos(orbit * 0.7) * 14, r).applyQuaternion(tmpQ)
      camera.position.set(target.pos.x + tmpV.x, target.pos.y + tmpV.y, target.pos.z + tmpV.z)
      up.set(0, 1, 0).applyQuaternion(tmpQ)
      camera.up.copy(up)
      tmpV.set(0, 0, -90).applyQuaternion(tmpQ)
      camera.lookAt(target.pos.x + tmpV.x, target.pos.y + tmpV.y, target.pos.z + tmpV.z)
    } else {
      // The Calzone lost, or the sortie over: hold a point and watch.
      if (outsideFrom.lengthSq() === 0 || frame % 600 === 0) {
        tmpV.set(70, 40, 140).applyQuaternion(tmpQ)
        outsideFrom.set(target.pos.x + tmpV.x, target.pos.y + tmpV.y, target.pos.z + tmpV.z)
      }
      camera.position.copy(outsideFrom)
      camera.up.set(0, 1, 0)
      camera.lookAt(target.pos.x, target.pos.y, target.pos.z)
    }
  }

  function syncShips(w: Voyage): void {
    const seen = new Set<number>()
    const me = calzone(w)
    for (const s of w.ships) {
      if (s.dead > 0 || s.gone) continue
      seen.add(s.id)
      const m = meshFor(s)
      m.mesh.position.set(s.pos.x, s.pos.y, s.pos.z)
      m.mesh.quaternion.set(s.q.x, s.q.y, s.q.z, s.q.w)
      // From the front seat the Calzone itself is the dashboard; from the bubble its tail is in view.
      // From either seat the Calzone itself is the cockpit (the dashboard, the bubble's frame): it is not drawn.
      m.mesh.visible = !(me && s.id === me.id && api.view !== 'outside')
      m.mat.uniforms.uFlash!.value = m.flash > 0 ? 1 : 0
      if (m.flash > 0) m.flash--
    }
    for (const [id, m] of meshes) {
      if (seen.has(id)) continue
      main.remove(m.mesh)
      m.mat.dispose()
      meshes.delete(id)
    }
  }

  function syncBolts(w: Voyage): void {
    let n = 0
    for (const b of w.shots) {
      if (n >= MAX_BOLTS) break
      const sp = Math.hypot(b.vel.x, b.vel.y, b.vel.z) || 1
      const len = b.kind === 'turret' ? 14 : 22
      const o = n * 6
      boltPos[o] = b.pos.x; boltPos[o + 1] = b.pos.y; boltPos[o + 2] = b.pos.z
      boltPos[o + 3] = b.pos.x - b.vel.x / sp * len
      boltPos[o + 4] = b.pos.y - b.vel.y / sp * len
      boltPos[o + 5] = b.pos.z - b.vel.z / sp * len
      const c = b.side === 'them' ? colours.theirs : b.kind === 'turret' ? colours.turret : colours.ours
      boltCol.set(c[0]!, o)
      boltCol.set(c[1]!, o + 3)
      n++
    }
    boltGeo.setDrawRange(0, n * 2)
    ;(boltGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(boltGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  }

  function syncMissiles(w: Voyage, frame: number): void {
    const mg = geo('missile', missileData)
    const tg = geo('torpedo', torpedoData)
    let i = 0
    for (const m of w.missiles) {
      let mesh = missileMeshes[i]
      if (!mesh) { mesh = new THREE.Mesh(mg, missileMat); main.add(mesh); missileMeshes.push(mesh) }
      mesh.geometry = m.kind === 'torpedo' ? tg : mg
      mesh.visible = true
      mesh.position.set(m.pos.x, m.pos.y, m.pos.z)
      mesh.quaternion.set(m.q.x, m.q.y, m.q.z, m.q.w)
      if (frame % 2 === 0) {
        if (puffs.length >= MAX_PUFFS) puffs.shift()
        puffs.push({ pos: new THREE.Vector3(m.pos.x, m.pos.y, m.pos.z), life: 60 })
      }
      i++
    }
    for (; i < missileMeshes.length; i++) missileMeshes[i]!.visible = false
    // Decoys: points that blink.
    let n = 0
    for (let k = puffs.length - 1; k >= 0; k--) {
      const p = puffs[k]!
      p.life--
      if (p.life <= 0) { puffs.splice(k, 1); continue }
    }
    for (const p of puffs) {
      if (n >= MAX_PUFFS) break
      puffPos[n * 3] = p.pos.x; puffPos[n * 3 + 1] = p.pos.y; puffPos[n * 3 + 2] = p.pos.z
      puffCol.set(p.life > 30 ? smokeHi : smokeLo, n * 3)
      n++
    }
    for (const d of w.decoys) {
      if (n >= MAX_PUFFS) break
      puffPos[n * 3] = d.pos.x; puffPos[n * 3 + 1] = d.pos.y; puffPos[n * 3 + 2] = d.pos.z
      puffCol.set(frame % 6 < 3 ? hexRgb('#fff6e0') : hexRgb('#ffd23f'), n * 3)
      n++
    }
    puffGeo.setDrawRange(0, n)
    ;(puffGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(puffGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  }

  function stepChunks(): void {
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i]!
      c.life--
      c.mesh.position.addScaledVector(c.vel, 1 / 60)
      c.mesh.rotation.x += c.spin.x
      c.mesh.rotation.y += c.spin.y
      c.mesh.rotation.z += c.spin.z
      if (c.life <= 0) {
        main.remove(c.mesh)
        chunks.splice(i, 1)
      }
    }
  }

  const api: Scene3D = {
    camera,
    view: 'front',
    render(w, frame) {
      place(w, frame)
      syncShips(w)
      syncBolts(w)
      syncMissiles(w, frame)
      stepChunks()
      camera.updateMatrixWorld()
      skyCam.fov = camera.fov
      skyCam.aspect = camera.aspect
      skyCam.updateProjectionMatrix()
      skyCam.quaternion.copy(camera.quaternion)
      skyCam.position.set(0, 0, 0)
      // The sky onto the canvas, the scene into the target, then the target over the sky.
      renderer.setRenderTarget(null)
      renderer.setClearColor(space, 1)
      renderer.clear(true, true, true)
      renderer.render(sky, skyCam)
      renderer.setRenderTarget(post.target)
      renderer.setClearColor(0x000000, 0)
      renderer.clear(true, true, true)
      renderer.render(main, camera)
      renderer.setRenderTarget(null)
      renderer.render(post.scene, post.camera)
    },
    resize(width, height) {
      viewH = height
      camera.aspect = width / height
      // A tall phone view gets a wider vertical angle; the horizontal angle stays about 66°.
      const hfov = width > height ? 70 : 58
      camera.fov = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / camera.aspect) * 180) / Math.PI
      camera.updateProjectionMatrix()
      post.resize(width, height)
      sizeSprites()
    },
    hit(id) {
      const m = meshes.get(id)
      if (m) m.flash = 4
    },
    explode(_w, kind, x, y, z) {
      const big = SHIPS[kind].capital === true
      const n = big ? 30 : 10
      const size = big ? 18 : Math.max(1.6, SHIPS[kind].r * 0.45)
      const mats = [BODY[kind], M.dark, M.glow]
      for (let i = 0; i < n && chunks.length < MAX_CHUNKS; i++) {
        const mat = mats[i % mats.length]!
        let g = chunkGeos.get(mat * 1000 + Math.round(size * 10))
        if (!g) { g = geometryOf(chunkData(mat, size)); chunkGeos.set(mat * 1000 + Math.round(size * 10), g) }
        const mesh = new THREE.Mesh(g, missileMat)
        mesh.position.set(x, y, z)
        const s = big ? 60 : 30
        const vel = new THREE.Vector3(seeded(i, x | 0) - 0.5, seeded(i, y | 0) - 0.5, seeded(i, z | 0) - 0.5).normalize().multiplyScalar(s * (0.4 + seeded(i, 7)))
        const spin = new THREE.Vector3(seeded(i, 11) - 0.5, seeded(i, 12) - 0.5, seeded(i, 13) - 0.5).multiplyScalar(0.4)
        main.add(mesh)
        chunks.push({ mesh, vel, spin, life: 70 + Math.round(seeded(i, 5) * 50) })
      }
    },
    setSky,
    dispose() {
      for (const m of meshes.values()) m.mat.dispose()
      for (const g of geos.values()) g.dispose()
      for (const g of chunkGeos.values()) g.dispose()
      boltGeo.dispose()
      puffGeo.dispose()
      starGeo.dispose()
      missileMat.dispose()
      post.dispose()
      for (const s of skySprites) { s.material.map?.dispose(); s.material.dispose() }
    },
  }
  return api
}
