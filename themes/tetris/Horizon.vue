<template><canvas ref="canvas" class="tetris-horizon" aria-hidden="true" /></template>
<script setup>
// The town at dusk behind the cabinet, on Neon Shrine's pixel stage
// (themes/base/pixel, scene in ./pixel.ts). A lock pulses the horizon; a
// clear also flares the sun. The near layers lean with the falling piece.
import { createPixelStage } from '~/themes/base/pixel/stage'
import { createTetrisScene } from './pixel'
const canvas = ref(null)
let stage, observer, raf = 0, last = 0
const scene = createTetrisScene()
let reduced = false
let view = 0
let viewTarget = 0
let beat = 0
let flare = 0
function draw(time) {
  if (!stage) return
  if (!document.hidden) {
    const dt = reduced ? 0 : Math.min((time - (last || time)) / 1000, .05)
    view += (viewTarget - view) * Math.min(1, dt * 3)
    beat = Math.max(0, beat - dt * 2.5)
    flare = Math.max(0, flare - dt * 0.9)
    stage.begin()
    scene.draw(stage, reduced ? 0 : time / 1000, view, beat, flare)
    stage.present({ ambient: '#a497d4' })
  }
  last = time
  if (!reduced) raf = requestAnimationFrame(draw)
}
onMounted(() => {
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  stage = createPixelStage(canvas.value)
  observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect
    stage.resize(width, height, devicePixelRatio || 1, width < 600 ? 160 : 240, 180)
    scene.layout(stage.vw, stage.vh)
    if (reduced) draw(0)
  })
  observer.observe(canvas.value)
  if (!reduced) raf = requestAnimationFrame(draw)
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); observer?.disconnect() })
defineExpose({ setView(x) { viewTarget = x }, beat(clear) { if (!reduced) { beat = 1; if (clear) flare = 1 } } })
</script>
<style scoped>
.tetris-horizon { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }
</style>
