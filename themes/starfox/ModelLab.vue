<template>
  <div class="sf-lab">
    <canvas ref="canvas" class="sf-lab-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
/**
 * Model lab (2026-09-25): every Star Fox model on a turntable, rendered
 * through the game's own pipeline (three.js at the stage's logical size,
 * palette snap + Bayer dither, the 2D pixel stage with light map, bloom
 * and scanlines), so what you see here is what the game shows.
 *
 * ?theme=starfox&lab=models&page=enemies|bosses|capsules|props|fx|biomes|squad
 *   &biome=coast|woods|ember|lake|space   backdrop (props: which biome)
 *   &boss=pincer|moth|furnace|twins|crown (bosses page)
 *   &t=<s>&freeze=1   hold one moment     &spin=0&yaw=<rad>  stop the turntable
 *   &hits=1  draw boss hit spheres        &near=1  bosses closer
 *   &far=1   grid pages at game distance  &flash=1  blink the hit flash
 *   &only=<name>  grid pages: just the matching models, close up
 */
import * as THREE from 'three'
import { createPixelStage, type PixelStage } from '../base/pixel/stage'
import { drawText, textWidth } from '../base/pixel/sprites'
import { createPixelPipeline, project, type PixelPipeline, type BiomeId } from './pixel'
import { buildBackdrop, type Backdrop } from './lab/backdrop'
import { createPage, type LabPage, type LabParams } from './lab/pages'
import { disposeModelCaches } from './models/core'
import { disposeBossMats } from './models/bosses'

const canvas = ref<HTMLCanvasElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let glCanvas: HTMLCanvasElement | null = null
let pipeline: PixelPipeline | null = null
let stage: PixelStage | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let backdrop: Backdrop
let page: LabPage
let raf = 0
let last = 0
let clock = 0
let params: LabParams

function readParams(): LabParams {
  const q = new URLSearchParams(window.location.search)
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)
  return {
    page: q.get('page') ?? 'enemies',
    biome: (q.get('biome') ?? '') as BiomeId | 'all' | '',
    boss: q.get('boss') ?? '',
    t: num('t', 0),
    freeze: q.get('freeze') === '1',
    spin: q.get('spin') !== '0',
    yaw: num('yaw', 0.5),
    hits: q.get('hits') === '1',
    near: q.get('near') === '1',
    far: q.get('far') === '1',
    flash: q.get('flash') === '1',
    only: (q.get('only') ?? '').toUpperCase(),
  }
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
  last = now
  if (!params.freeze) clock += dt
  const t = clock
  page.update(t, params.freeze ? 0 : dt)
  backdrop.tick(t, page.offset ?? 0)
  if (!pipeline || !stage || !glCanvas) return
  pipeline.render(scene, camera)
  const g = stage.begin()
  g.drawImage(glCanvas, 0, 0)
  const s = stage
  page.lights((x, y, z, r, color, a) => {
    const p = project(camera, s.vw, s.vh, x, y, z, r, 2, 60)
    if (p) s.light(p.x, p.y, p.r, color, a)
  })
  // Labels and hit spheres on the HUD layer (not lit, not bloomed).
  const hud = s.hud
  for (const l of page.labels()) {
    const p = project(camera, s.vw, s.vh, l.x, l.y, l.z, 1)
    if (!p) continue
    const w = textWidth(l.text)
    drawText(hud, l.text, Math.round(p.x * s.hw / s.vw - w / 2), Math.round(p.y * s.hh / s.vh), l.color ?? '#cfc6ff', '#0b0616')
  }
  if (page.circles) {
    hud.strokeStyle = '#b6ff4a'
    hud.lineWidth = 1
    for (const c of page.circles()) {
      const p = project(camera, s.vw, s.vh, c.x, c.y, c.z, c.r, 1, 400)
      if (!p) continue
      hud.strokeStyle = c.color
      hud.beginPath()
      hud.arc(Math.round(p.x * s.hw / s.vw) + 0.5, Math.round(p.y * s.hh / s.vh) + 0.5, p.r * s.hw / s.vw, 0, Math.PI * 2)
      hud.stroke()
    }
  }
  page.draw?.(hud, (x, y, z) => {
    const p = project(camera, s.vw, s.vh, x, y, z, 1)
    return p ? { x: p.x * s.hw / s.vw, y: p.y * s.hh / s.vh } : null
  })
  drawText(hud, page.title, 4, 4, '#ffd23f', '#0b0616')
  s.present({ ambient: '#c9bde6' })
}

function resize() {
  if (!renderer || !stage || !pipeline) return
  const W = window.innerWidth
  const H = window.innerHeight
  const portrait = H > W
  stage.resize(W, H, window.devicePixelRatio || 1, portrait ? 180 : 320, 180)
  pipeline.setSize(stage.vw, stage.vh)
  camera.aspect = stage.vw / stage.vh
  camera.fov = portrait ? 80 : 62
  camera.updateProjectionMatrix()
}

onMounted(() => {
  params = readParams()
  clock = params.t
  try {
    glCanvas = document.createElement('canvas')
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'low-power' })
  } catch { return }
  stage = createPixelStage(canvas.value!)
  pipeline = createPixelPipeline(renderer)
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200)
  camera.position.set(0, 3.8, 11.5)
  camera.lookAt(0, 1, -40)
  backdrop = buildBackdrop(scene)
  page = createPage(params, scene, camera, backdrop)
  resize()
  window.addEventListener('resize', resize)
  ;(window as unknown as { __lab: unknown }).__lab = { page, params, scene, camera, renderer }
  last = performance.now()
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  page?.dispose?.()
  pipeline?.dispose()
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = null
  disposeModelCaches()
  disposeBossMats()
})
</script>

<style>
.sf-lab {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #0b0616;
}
.sf-lab-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
