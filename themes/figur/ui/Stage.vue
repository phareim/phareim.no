<template>
  <!-- The figure on its game's backdrop: the style paints a buffer at a
    whole-number scale that fills the area; what is left under one scale
    step is the style's letterbox colour. Tap the figure: a little hop. -->
  <div ref="areaRef" class="fg-stage" :style="{ background: style.bg }">
    <canvas
      ref="canvasRef"
      class="fg-stage-canvas"
      :style="{ width: `${fit.w * fit.scale}px`, height: `${fit.h * fit.scale}px` }"
      role="img"
      :aria-label="`${figure.name} i ${style.label}`"
      @pointerdown="hop"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, reactive } from 'vue'
import type { DrawnGarment, Figure, StyleId } from '../types'
import { frameFor, styleById } from '../render/styles'
import { writeRGBA } from '../render/pixels'
import { stageFit } from './board'

const props = defineProps<{
  figure: Figure
  closet: DrawnGarment[]
  styleId: StyleId
  /** Bumps on every change: the figure cheers. */
  changes: number
}>()
const emit = defineEmits<{ hop: [] }>()

const areaRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const style = computed(() => styleById(props.styleId))
const area = reactive({ w: 0, h: 0 })
const fit = computed(() => stageFit(area.w, area.h, style.value.size))

const CHEER_S = 0.8
const BOB_S = 0.6

let raf = 0
let t0 = 0
let cheerAt = -10
let nextBlink = 2.5
let blinkUntil = 0
let img: ImageData | null = null
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function draw(now: number) {
  raf = 0
  const c = canvasRef.value
  if (!c || !area.w || !area.h) return
  const t = (now - t0) / 1000
  const { w, h } = fit.value
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; img = null }
  const g = c.getContext('2d')
  if (!g) return
  if (t > nextBlink) { blinkUntil = t + 0.14; nextBlink = t + 2.5 + Math.random() * 3 }
  const cheer = Math.max(0, 1 - (t - cheerAt) / CHEER_S)
  const bob = reduced ? 0 : Math.floor(t / BOB_S) % 2
  const buf = frameFor(props.figure, props.closet, style.value, {
    t, pose: { bob, blink: t < blinkUntil, cheer: reduced ? 0 : cheer }, backdrop: true, w, h,
  })
  if (!img || img.width !== buf.w || img.height !== buf.h) img = g.createImageData(buf.w, buf.h)
  writeRGBA(buf, img.data)
  g.putImageData(img, 0, 0)
  loop()
}

function loop() {
  if (!raf && document.visibilityState === 'visible') raf = requestAnimationFrame(draw)
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

function cheerNow() {
  cheerAt = (performance.now() - t0) / 1000
}

function hop() {
  cheerNow()
  emit('hop')
}

watch(() => props.changes, cheerNow)

let ro: ResizeObserver | null = null
function measure() {
  const el = areaRef.value
  if (!el) return
  area.w = el.clientWidth
  area.h = el.clientHeight
}

function onVisibility() {
  if (document.visibilityState === 'visible') loop()
  else stop()
}

onMounted(() => {
  t0 = performance.now()
  measure()
  ro = new ResizeObserver(measure)
  if (areaRef.value) ro.observe(areaRef.value)
  document.addEventListener('visibilitychange', onVisibility)
  loop()
})

onBeforeUnmount(() => {
  stop()
  ro?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.fg-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.fg-stage-canvas {
  display: block;
  image-rendering: pixelated;
  touch-action: manipulation;
  cursor: pointer;
}
</style>
