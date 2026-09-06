<template><canvas ref="canvas" class="tetris-horizon" aria-hidden="true" /></template>
<script setup>
import { createHorizon } from '~/themes/base/neonHorizon.js'
const canvas = ref(null)
let horizon, ctx, observer, raf = 0, last = 0
let reduced = false
function draw(time) {
  if (!ctx) return
  if (!document.hidden) {
    horizon.update(reduced ? 0 : Math.min((time - (last || time)) / 1000, .05))
    horizon.draw(ctx, reduced ? 0 : time / 1000)
  }
  last = time
  if (!reduced) raf = requestAnimationFrame(draw)
}
onMounted(() => {
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  ctx = canvas.value.getContext('2d')
  if (!ctx) return
  horizon = createHorizon()
  observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect
    const dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.value.width = Math.round(width * dpr)
    canvas.value.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    horizon.resize(width, height, ctx)
    if (reduced) draw(0)
  })
  observer.observe(canvas.value)
  if (!reduced) raf = requestAnimationFrame(draw)
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); observer?.disconnect() })
defineExpose({ beat(clear) { if (!reduced) { horizon?.beat(); if (clear) horizon?.flare() } } })
</script>
<style scoped>
.tetris-horizon { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }
</style>
