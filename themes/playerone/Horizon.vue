<template><canvas ref="canvas" class="p1-horizon" aria-hidden="true" /></template>
<script setup>
import { createHorizon } from '~/themes/base/neonHorizon.js'
const canvas = ref(null)
let horizon, ctx, observer, raf = 0, last = 0
let reduced = false
function onPointerMove(event) {
  if (reduced || !canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  horizon?.setView((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1)
}
function resetView() { horizon?.setView(0, 0) }
function onPointerUp(event) { if (event.pointerType !== 'mouse') resetView() }
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
  // Sun out to the right, so it balances the panel on the left instead of
  // sitting behind it. Height is the module's default, jitter included.
  horizon = createHorizon({ sunX: .72 })
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
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp, { passive: true })
  window.addEventListener('pointercancel', resetView, { passive: true })
  window.addEventListener('blur', resetView)
  document.documentElement.addEventListener('pointerleave', resetView)
  if (!reduced) raf = requestAnimationFrame(draw)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', resetView)
  window.removeEventListener('blur', resetView)
  document.documentElement.removeEventListener('pointerleave', resetView)
})
defineExpose({ beat(clear) { if (!reduced) { horizon?.beat(); if (clear) horizon?.flare() } } })
</script>
<style scoped>
.p1-horizon { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
</style>
