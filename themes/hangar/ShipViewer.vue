<template>
  <!-- The player's ship in 3D, built by the same builder Star Fox flies.
       Mouse-drag spins it; touch is left to the shell (swipe switches
       theme), so phones get a slow auto-spin instead. -->
  <canvas ref="canvas" class="hg-viewer" aria-label="Your ship in 3D" />
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { buildPlayerShip, makeGlowTexture } from '~/themes/ships/three'
import { shipById, STARTER_SHIP } from '~/themes/ships/ships'

const props = defineProps<{ shipId: string }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let model: { root: THREE.Group, bank: THREE.Group, engine: THREE.Sprite } | null = null
let glowTex: THREE.Texture | null = null
let observer: ResizeObserver | undefined
let raf = 0
let last = 0
let reduced = false
let rotY = 0.6
let rotX = 0.12
let dragging = false
let lastPX = 0
let lastPY = 0
let disposed = false

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
  // Vandal is wider: pull it a touch further back so it frames the same.
  model.root.position.set(0, -0.4, def.variant === 'vandal' ? 0.9 : 0)
  scene.add(model.root)
}

function draw(time: number): void {
  if (disposed || !renderer || !scene || !camera) return
  const dt = Math.min((time - (last || time)) / 1000, 0.05)
  last = time
  if (!reduced && !dragging && model) {
    rotY += dt * 0.45
  }
  if (model) {
    model.root.rotation.y = rotY
    model.root.rotation.x = rotX
    if (!reduced) {
      const s = 1 + Math.sin(time / 380) * 0.012
      model.root.scale.set(s, s, s)
      // Engine flicker: pulse opacity, never scale (the base differs per ship).
      const m = model.engine.material as THREE.SpriteMaterial
      m.opacity = 0.5 + Math.random() * 0.25
    }
  }
  renderer.render(scene, camera)
  raf = requestAnimationFrame(draw)
}

function resize(w: number, h: number): void {
  if (!renderer || !camera || !canvas.value) return
  const dpr = Math.min(devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function onPointerDown(e: PointerEvent): void {
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  dragging = true
  lastPX = e.clientX
  lastPY = e.clientY
  canvas.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging || e.pointerType !== 'mouse') return
  rotY += (e.clientX - lastPX) * 0.012
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
  renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: true })
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(0, 1.4, 8.2)
  camera.lookAt(0, 0.1, 0)

  scene.add(new THREE.AmbientLight(0xbfc8ff, 0.85))
  const key = new THREE.DirectionalLight(0x2ff3ff, 1.6)
  key.position.set(4, 6, 5)
  scene.add(key)
  const rim = new THREE.PointLight(0xff2fa0, 30, 30)
  rim.position.set(-5, 1, -3)
  scene.add(rim)

  glowTex = makeGlowTexture()
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
  raf = requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(raf)
  observer?.disconnect()
  canvas.value?.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  disposeModel()
  glowTex?.dispose()
  renderer?.dispose()
  renderer = null
  scene = null
})

watch(() => props.shipId, () => build())
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
