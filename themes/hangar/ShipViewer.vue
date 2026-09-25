<template>
  <!-- The player's ship in 3D, built by the same builder Star Fox flies,
       drawn the Super FX way (below). Mouse-drag spins it; phones get a
       slow auto-spin instead. -->
  <canvas ref="canvas" class="hg-viewer" aria-label="Your ship in 3D" />
</template>

<script setup lang="ts">
/**
 * Pixel render (2026-09-25), the way Star Fox does it: three.js draws into
 * an offscreen WebGL canvas at a small logical size, Star Fox's quantize
 * pass (themes/starfox/pixel.ts) snaps it to Neon Shrine's palette with a
 * Bayer dither, and the shared 2D pixel stage scales it up by a whole
 * number, with a light map, bloom and scanlines. The stage uses the same
 * whole-number scale as the Hangar's backdrop, so the ship's pixels are the
 * size of the bay's.
 */
import * as THREE from 'three'
import { buildPlayerShip, makeGlowTexture } from '~/themes/ships/three'
import { shipById, STARTER_SHIP } from '~/themes/ships/ships'
import { createPixelPipeline, project, type PixelPipeline } from '~/themes/starfox/pixel'
import { createPixelStage, type PixelStage } from '~/themes/base/pixel/stage'

const props = defineProps<{ shipId: string }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let glCanvas: HTMLCanvasElement | null = null
let pipeline: PixelPipeline | null = null
let stage: PixelStage | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let model: { root: THREE.Group, bank: THREE.Group, engine: THREE.Sprite } | null = null
let glowTex: THREE.Texture | null = null
let skyTex: THREE.CanvasTexture | null = null
let padParts: THREE.Mesh[] = []
let glowColor = '#2ff3ff'
let tipColors: [string, string] = ['#2ff3ff', '#ff2fa0']
let observer: ResizeObserver | undefined
let raf = 0
let last = 0
let reduced = false
// Nose toward the viewer (the nose points -Z; the camera sits at +Z). The
// idle ship swings between its two three-quarter views rather than spinning
// all the way round: side-on, a few dozen pixels of ship stop reading.
let baseY = Math.PI
let swing = 0.6
let rotY = baseY
let rotX = 0.12
let dragging = false
let lastPX = 0
let lastPY = 0
let disposed = false
const tmp = new THREE.Vector3()
/** Hull colours are pulled towards Neon Shrine's grey-violet so they survive the palette. */
const LIFT = new THREE.Color(0x8f86b8)

function disposeModel(): void {
  if (!model || !scene) return
  scene.remove(model.root)
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh || (o as THREE.LineSegments).isLineSegments) {
      const m = mesh as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach(x => x.dispose())
      else mat?.dispose()
    }
  })
  model = null
}

function build(): void {
  if (!scene) return
  disposeModel()
  const def = shipById(props.shipId) ?? shipById(STARTER_SHIP)!
  model = buildPlayerShip(def, glowTex!)
  // At pixel size the additive halo quantizes to a grey disc; the stage's
  // light map carries the engine glow instead.
  model.engine.visible = false
  // The dark metal hull (unlit without an environment map) would vanish
  // into the bay, so it is lifted towards the palette's grey-violet; the
  // trim-coloured edge lines stay as the sprite's lit outline. These
  // materials are this build's own.
  model.root.traverse((o) => {
    const mat = (o as THREE.Mesh).material
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.metalness = 0.15
      mat.roughness = 0.7
      mat.color.lerp(LIFT, 0.45)
    }
  })
  // Vandal is wider: pull it a touch further back so it frames the same.
  model.root.position.set(0, -0.4, def.variant === 'vandal' ? 0.9 : 0)
  scene.add(model.root)
  glowColor = def.colors.glow
  tipColors = [def.colors.hull, def.colors.glow]
}

/** The bay behind the ship: dusk violet, darker at the top, as a background texture. */
function makeSky(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, '#0b0616')
  grad.addColorStop(0.55, '#1c1030')
  grad.addColorStop(1, '#2a1a4c')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A round launch pad of shrine stone with a pink neon ring. */
function buildPad(): void {
  if (!scene) return
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(3.3, 3.6, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a2f70, roughness: 0.9, metalness: 0.1, flatShading: true }),
  )
  stone.position.set(0, -1.75, 0)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.85, 0.08, 4, 40),
    new THREE.MeshBasicMaterial({ color: 0xff2fa0 }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.set(0, -1.56, 0)
  scene.add(stone, ring)
  padParts = [stone, ring]
}

function pushLights(time: number): void {
  if (!stage || !camera || !model) return
  const s = stage
  const add = (v: THREE.Vector3, r: number, color: string, a: number) => {
    const p = project(camera!, s.vw, s.vh, v.x, v.y, v.z, r, 2, 40)
    if (p) s.light(p.x, p.y, p.r, color, a)
  }
  const flicker = reduced ? 0.8 : 0.72 + Math.random() * 0.2
  add(model.engine.getWorldPosition(tmp), 1.6, glowColor, flicker)
  // The pad's ring and a soft pool under the ship.
  add(tmp.set(0, -1.5, 0), 3.2, '#ff2fa0', 0.35)
  add(tmp.set(-2.8, -1.4, 1.2), 1.2, '#ff2fa0', 0.3)
  add(tmp.set(2.8, -1.4, 1.2), 1.2, '#ff2fa0', 0.3)
  // Wingtip lights: the two glow balls at the gun tips.
  let i = 0
  model.bank.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !(m.material instanceof THREE.MeshBasicMaterial) || i > 2) return
    add(m.getWorldPosition(tmp), 0.5, tipColors[i % 2]!, 0.6 + 0.2 * Math.sin(time * 3 + i))
    i++
  })
}

function draw(time: number): void {
  if (disposed || !renderer || !scene || !camera || !pipeline || !stage || !glCanvas) return
  const dt = Math.min((time - (last || time)) / 1000, 0.05)
  last = time
  if (!reduced && !dragging) swing += dt * 0.4
  rotY = baseY + Math.sin(swing) * 0.95
  if (model) {
    model.root.rotation.y = rotY
    model.root.rotation.x = rotX
    // A slow hover, a whole pixel at a time rather than a breathing scale.
    if (!reduced) model.root.position.y = -0.4 + Math.sin(time / 700) * 0.08
  }
  pipeline.render(scene, camera)
  const g = stage.begin()
  g.drawImage(glCanvas, 0, 0)
  pushLights(time / 1000)
  stage.present({ ambient: '#c9bde6' })
  if (!reduced || dragging) raf = requestAnimationFrame(draw)
  else raf = 0
}

function kick(): void {
  if (!raf && !disposed) raf = requestAnimationFrame(draw)
}

/**
 * The whole-number scale the Hangar's backdrop uses (Horizon.vue: at least
 * 160 or 240 × 180 logical pixels over the viewport), so the viewer's
 * pixels match the bay's.
 */
function backdropScale(dpr: number): number {
  const w = window.innerWidth
  const h = window.innerHeight
  return Math.max(1, Math.floor(Math.min(w * dpr / (w < 600 ? 160 : 240), h * dpr / 180)))
}

function resize(w: number, h: number): void {
  if (!stage || !pipeline || !camera) return
  const dpr = Math.max(1, Math.min(3, devicePixelRatio || 1))
  const S = backdropScale(dpr)
  // minW/minH chosen so the stage lands on exactly S.
  stage.resize(w, h, dpr, Math.round(w * dpr) / (S + 0.001), 1)
  pipeline.setSize(stage.vw, stage.vh)
  camera.aspect = stage.vw / stage.vh
  // Keep the ship's width framed on narrow, short boxes.
  camera.fov = camera.aspect < 1.6 ? 34 : 28
  camera.updateProjectionMatrix()
  if (reduced) { last = 0; draw(performance.now()) }
}

function onPointerDown(e: PointerEvent): void {
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  dragging = true
  lastPX = e.clientX
  lastPY = e.clientY
  canvas.value?.setPointerCapture(e.pointerId)
  kick()
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging || e.pointerType !== 'mouse') return
  baseY += (e.clientX - lastPX) * 0.012
  rotX = Math.max(-0.6, Math.min(0.6, rotX + (e.clientY - lastPY) * 0.008))
  lastPX = e.clientX
  lastPY = e.clientY
}

function onPointerUp(): void {
  dragging = false
}

onMounted(() => {
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const el = canvas.value
  if (!el) return
  glCanvas = document.createElement('canvas')
  try {
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'low-power' })
  } catch {
    return // no WebGL: the bay stays empty, the rest of the page works
  }
  pipeline = createPixelPipeline(renderer)
  stage = createPixelStage(el, { bg: '#0b0616' })
  scene = new THREE.Scene()
  skyTex = makeSky()
  scene.background = skyTex
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(0, 3.1, 11.2)
  camera.lookAt(0, -0.3, 0)

  scene.add(new THREE.HemisphereLight(0xb9a8ff, 0x1c1030, 1.4))
  const key = new THREE.DirectionalLight(0x6ff6ff, 2.2)
  key.position.set(4, 6, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xff5fb8, 1.8)
  rim.position.set(-5, 2, -4)
  scene.add(rim)

  glowTex = makeGlowTexture()
  buildPad()
  build()

  observer = new ResizeObserver(() => {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) resize(rect.width, rect.height)
  })
  observer.observe(el)
  const rect = el.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) resize(rect.width, rect.height)

  el.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp, { passive: true })
  kick()
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(raf)
  observer?.disconnect()
  canvas.value?.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  disposeModel()
  for (const m of padParts) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
  glowTex?.dispose()
  skyTex?.dispose()
  pipeline?.dispose()
  renderer?.dispose()
  renderer = null
  scene = null
})

watch(() => props.shipId, () => { build(); kick() })
</script>

<style scoped>
.hg-viewer {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: pan-x pan-y;
  cursor: grab;
}
.hg-viewer:active { cursor: grabbing; }
</style>
