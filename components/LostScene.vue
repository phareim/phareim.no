<template><canvas ref="canvas" class="lost-scene" aria-hidden="true" /></template>

<script setup lang="ts">
/**
 * The 404's backdrop on the pixel stage (themes/base/pixel): the rose path
 * runs out of town and stops at a signpost that reads 404, under the dusk
 * sky and the striped sun. Two lamps and the sign glow through the light
 * map. Reduced motion draws one frame.
 */
import { createPixelStage, makeCanvas, type PixelStage } from '~/themes/base/pixel/stage'
import { drawText, textWidth } from '~/themes/base/pixel/sprites'
import { DUSK, drawStars, hash2, paintGrass, paintLamp, paintRidge, paintSky, paintSun, paintTreeLine, rect } from '~/themes/base/pixel/scenery'

const canvas = ref<HTMLCanvasElement | null>(null)
let stage: PixelStage | null = null
let back: HTMLCanvasElement | null = null
let sunLayer: HTMLCanvasElement | null = null
let front: HTMLCanvasElement | null = null
let horizon = 0
let lamps: { x: number; y: number }[] = []
let sign = { x: 0, y: 0, w: 0, h: 0 }
let observer: ResizeObserver | undefined
let raf = 0
let reduced = false

function layout(W: number, H: number): void {
  horizon = Math.round(H * 0.56)
  const ground = horizon + Math.max(10, Math.round(H * 0.08))

  back = makeCanvas(W, H)
  const b = back.getContext('2d')!
  paintSky(b, W, horizon)

  sunLayer = makeCanvas(W, H)
  const sr = Math.max(10, Math.min(28, Math.round(Math.min(W, H) * 0.13)))
  paintSun(sunLayer.getContext('2d')!, W * (W < H ? 0.66 : 0.74), horizon - Math.round(sr * 0.25), sr)

  front = makeCanvas(W, H)
  const g = front.getContext('2d')!
  const farH = Math.max(10, Math.round(H * 0.1))
  paintRidge(g, W, horizon + 2, farH, ground, DUSK.ridgeFar, DUSK.ridgeFarRim, 6, 0.7)
  paintRidge(g, W, horizon + 6, Math.round(farH * 0.55), ground, DUSK.ridge, DUSK.ridgeRim, 17, 0.3)
  paintTreeLine(g, 0, W, ground, Math.max(5, Math.round(H * 0.045)), 9)
  paintGrass(g, 0, W, ground, H, 7)

  // The path: from the bottom-left corner up to the sign, narrowing with
  // distance, then nothing but grass.
  const endX = Math.round(W * (W < H ? 0.62 : 0.58))
  const endY = ground + Math.round((H - ground) * 0.3)
  const rows = H - endY
  for (let i = 0; i < rows; i++) {
    const y = endY + i
    const t = i / rows
    const cx = endX + (0 - endX) * t * t * 0.9
    const half = Math.round(3 + t * W * 0.12)
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const edge = Math.min(x - (cx - half), cx + half - x)
      if (edge < 1.2 && hash2(x, y, 3) < 0.5) continue
      rect(g, hash2(x >> 1, y, 4) > 0.86 ? DUSK.pathL : hash2(x, y >> 1, 5) < 0.12 ? DUSK.pathD : DUSK.path, x, y)
    }
  }

  // The signpost where the path gives out.
  const sw = textWidth('404') + 6
  const sh = 11
  const px = endX + 2
  const top = endY - 16
  rect(g, DUSK.trunk, px + Math.floor(sw / 2) - 1, top + sh, 2, endY - top - sh + 2)
  rect(g, '#140a22', px - 1, top - 1, sw + 2, sh + 2)
  rect(g, '#4a2c4c', px, top, sw, sh)
  rect(g, '#6a3e62', px, top, sw, 1)
  sign = { x: px + 3, y: top + 2, w: sw, h: sh }

  // Lamps along the way.
  lamps = [0.2, 0.42].map((t, i) => {
    const y = endY + Math.round(rows * (0.35 + i * 0.25))
    const x = Math.round(endX * (1 - t * 1.6)) - 10
    return paintLamp(g, Math.max(4, x), y, 12, i ? '#2ff3ff' : '#ff2fa0')
  })
}

function draw(time: number): void {
  const s = stage
  if (!s || !back || !front || !sunLayer) return
  const t = reduced ? 0 : time / 1000
  const g = s.begin()
  g.drawImage(back, 0, 0)
  drawStars(g, s.vw, horizon - 8, t, 1, 23)
  g.drawImage(sunLayer, 0, 0)
  s.emitImage(sunLayer)
  g.drawImage(front, 0, 0)
  const flick = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 7)
  lamps.forEach((l, i) => s.light(l.x, l.y, 26, i ? '#2ff3ff' : '#ff2fa0', 0.9 * flick))
  s.light(sign.x + sign.w / 2 - 3, sign.y + 3, 22, '#ff2fa0', 0.7)
  s.present({
    ambient: '#8f84c4',
    afterLight: (a) => {
      const on = reduced || Math.floor(t * 1.3) % 7 !== 0
      drawText(a, '404', sign.x, sign.y, on ? '#ff5ec0' : '#6a3e62', '#140a22')
    },
  })
  if (!reduced) raf = requestAnimationFrame(draw)
}

function fit(width: number, height: number): void {
  if (!stage || !width || !height) return
  stage.resize(width, height, devicePixelRatio || 1, width < 600 ? 150 : 240, 150)
  layout(stage.vw, stage.vh)
  if (reduced) draw(0)
}

onMounted(() => {
  const c = canvas.value
  if (!c) return
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  stage = createPixelStage(c)
  fit(c.clientWidth, c.clientHeight)
  observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width, entry.contentRect.height))
  observer.observe(c)
  if (!reduced) raf = requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
})
</script>

<style scoped>
.lost-scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
</style>
