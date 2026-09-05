<template>
  <canvas ref="canvas" class="sfx-canvas"></canvas>
</template>

<script setup lang="ts">
/**
 * Star Fox — an on-rails 3D flight shooter in three.js, behind the landing
 * overlay. Same contract as rtype/Shooter.vue and invaders/Invaders.vue:
 * full-viewport canvas, attract mode (autopilot) until Enter/tap, events up
 * to Landing.vue for the HUD:
 *   score(n)  distance(km)  lives(n)  started  restart
 *   over      — the moment the run ends (unlocks theme navigation)
 *   death     — after the explosion (shows the GAME OVER card)
 *
 * SCAFFOLD: this file only proves the plumbing (renderer, resize, dispose,
 * input, events). The scene below is a placeholder to be replaced.
 */
import * as THREE from 'three'

const emit = defineEmits<{
  score: [n: number]
  distance: [km: number]
  lives: [n: number]
  started: []
  restart: []
  over: []
  death: []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let raf = 0
let last = 0
let W = 0
let H = 0

let gameStarted = false
let gameOver = false
let score = 0
let distance = 0
let lives = 3

const keys = new Set<string>()

// ---- placeholder scene -----------------------------------------------
let ship: THREE.Mesh
let grid: THREE.GridHelper

function buildScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05060c)
  scene.fog = new THREE.Fog(0x05060c, 30, 120)

  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300)
  camera.position.set(0, 3, 10)
  camera.lookAt(0, 0, -20)

  ship = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 2.2, 4),
    new THREE.MeshBasicMaterial({ color: 0x19f0ff, wireframe: true }),
  )
  ship.rotation.x = -Math.PI / 2
  scene.add(ship)

  grid = new THREE.GridHelper(400, 80, 0x19f0ff, 0x0a3a44)
  grid.position.y = -4
  scene.add(grid)
}

function update(dt: number, t: number) {
  const speed = gameStarted ? 40 : 18
  distance += speed * dt
  ;(grid.position as THREE.Vector3).z = (t * speed) % 5

  if (gameStarted) {
    const dx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0)
    const dy = (keys.has('ArrowUp') || keys.has('w') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('s') ? 1 : 0)
    ship.position.x = THREE.MathUtils.clamp(ship.position.x + dx * 12 * dt, -6, 6)
    ship.position.y = THREE.MathUtils.clamp(ship.position.y + dy * 10 * dt, -3, 4)
    ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, -dx * 0.6, 0.1)
  } else {
    ship.position.x = Math.sin(t * 0.7) * 3
    ship.position.y = Math.cos(t * 0.5) * 1.5
    ship.rotation.z = -Math.cos(t * 0.7) * 0.4
  }
}
// ----------------------------------------------------------------------

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000 || 0)
  last = now
  update(dt, now / 1000)
  const km = Math.floor(distance / 100)
  if (km !== lastKm) { lastKm = km; emit('distance', km) }
  renderer!.render(scene, camera)
}
let lastKm = 0

function resize() {
  if (!renderer) return
  W = window.innerWidth
  H = window.innerHeight
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(W, H, false)
  camera.aspect = W / H
  camera.updateProjectionMatrix()
}

function startGame() {
  if (gameOver) emit('restart')
  gameStarted = true
  gameOver = false
  score = 0
  distance = 0
  lives = 3
  emit('started')
  emit('score', 0)
  emit('distance', 0)
  emit('lives', lives)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (!gameStarted || gameOver)) { startGame(); return }
  if (!gameStarted) return
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault()
  keys.add(e.key)
}
function onKeyUp(e: KeyboardEvent) { keys.delete(e.key) }

// Start on TAP, not touchstart, so a horizontal swipe on the idle game still
// changes theme (the shell listens on document).
let touchStart: { x: number; y: number; t: number } | null = null
function onTouchStart(e: TouchEvent) {
  const t = e.touches[0]
  touchStart = { x: t.clientX, y: t.clientY, t: performance.now() }
  if (gameStarted && !gameOver) e.preventDefault()
}
function onTouchEnd(e: TouchEvent) {
  if (!touchStart) return
  const t = e.changedTouches[0]
  const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y)
  const quick = performance.now() - touchStart.t < 300
  touchStart = null
  if (moved < 12 && quick && (!gameStarted || gameOver)) startGame()
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value!, antialias: false, powerPreference: 'low-power' })
  buildScene()
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  last = performance.now()
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchend', onTouchEnd)
  scene?.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose?.()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach(x => x.dispose())
    else mat?.dispose?.()
  })
  renderer?.dispose()
  renderer = null
})
</script>

<style>
.sfx-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 1;
}
</style>
