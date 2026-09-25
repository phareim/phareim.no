<template><canvas ref="canvas" class="lb-hall" aria-hidden="true" /></template>
<script setup>
// The shrine's hall of champions behind the ranking, on Neon Shrine's pixel
// stage (themes/base/pixel, scene in ./pixel.ts). Reduced motion: one frame.
import { createPixelStage } from '~/themes/base/pixel/stage'
import { createHallScene } from './pixel'
const canvas = ref(null)
let stage, observer, raf = 0
const scene = createHallScene()
let reduced = false
function draw(time) {
  if (!stage) return
  if (!document.hidden) {
    stage.begin()
    scene.draw(stage, reduced ? 0 : time / 1000)
  }
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
</script>
<style scoped>
.lb-hall { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
</style>
