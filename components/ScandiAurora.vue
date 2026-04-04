<template>
  <canvas ref="canvas" class="scandi-aurora-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let time = 0

interface AuroraLayer {
  baseY: number        // vertical anchor (fraction of height)
  amplitude: number    // wave height (fraction of height)
  speed: number        // animation speed multiplier
  waveLen: number      // horizontal wave length (fraction of width)
  phase: number        // initial phase offset
  thickness: number    // band thickness (fraction of height)
  hueBase: number      // base hue (degrees)
  hueRange: number     // hue drift range
  alpha: number        // max opacity
}

const LAYERS: AuroraLayer[] = [
  { baseY: 0.28, amplitude: 0.08, speed: 0.00018, waveLen: 0.55, phase: 0.0,  thickness: 0.18, hueBase: 150, hueRange: 30, alpha: 0.22 },
  { baseY: 0.20, amplitude: 0.06, speed: 0.00024, waveLen: 0.70, phase: 1.2,  thickness: 0.14, hueBase: 175, hueRange: 25, alpha: 0.18 },
  { baseY: 0.35, amplitude: 0.07, speed: 0.00014, waveLen: 0.45, phase: 2.5,  thickness: 0.12, hueBase: 200, hueRange: 40, alpha: 0.14 },
  { baseY: 0.15, amplitude: 0.05, speed: 0.00030, waveLen: 0.80, phase: 3.8,  thickness: 0.10, hueBase: 280, hueRange: 30, alpha: 0.12 },
  { baseY: 0.40, amplitude: 0.06, speed: 0.00020, waveLen: 0.60, phase: 5.1,  thickness: 0.09, hueBase: 160, hueRange: 20, alpha: 0.10 },
]

function resize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
}

function drawLayer(layer: AuroraLayer, w: number, h: number) {
  if (!ctx) return

  const STEPS = 80
  const stepW = w / STEPS
  const hue = layer.hueBase + Math.sin(time * 0.00008 + layer.phase) * layer.hueRange
  const thickness = layer.thickness * h

  // Build a path tracing the top and bottom edge of the aurora band
  ctx.beginPath()
  for (let i = 0; i <= STEPS; i++) {
    const x = i * stepW
    const sineVal = Math.sin(i / STEPS * Math.PI * 2 / layer.waveLen + time * layer.speed + layer.phase)
    const centerY = layer.baseY * h + sineVal * layer.amplitude * h
    const topY = centerY - thickness * 0.5
    if (i === 0) {
      ctx.moveTo(x, topY)
    } else {
      ctx.lineTo(x, topY)
    }
  }
  for (let i = STEPS; i >= 0; i--) {
    const x = i * stepW
    const sineVal = Math.sin(i / STEPS * Math.PI * 2 / layer.waveLen + time * layer.speed + layer.phase)
    const centerY = layer.baseY * h + sineVal * layer.amplitude * h
    const bottomY = centerY + thickness * 0.5
    ctx.lineTo(x, bottomY)
  }
  ctx.closePath()

  // Vertical gradient within the band (transparent → color → transparent)
  // Use approximate center Y for gradient anchor
  const midSine = Math.sin(0.5 * Math.PI * 2 / layer.waveLen + time * layer.speed + layer.phase)
  const midY = layer.baseY * h + midSine * layer.amplitude * h
  const grad = ctx.createLinearGradient(0, midY - thickness * 0.5, 0, midY + thickness * 0.5)
  const saturation = 70 + Math.sin(time * 0.00005 + layer.phase * 2) * 15
  const lightness = 55 + Math.sin(time * 0.00007 + layer.phase) * 10
  grad.addColorStop(0.0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`)
  grad.addColorStop(0.3, `hsla(${hue}, ${saturation}%, ${lightness}%, ${layer.alpha})`)
  grad.addColorStop(0.5, `hsla(${hue}, ${saturation + 10}%, ${lightness + 5}%, ${layer.alpha * 1.3})`)
  grad.addColorStop(0.7, `hsla(${hue}, ${saturation}%, ${lightness}%, ${layer.alpha})`)
  grad.addColorStop(1.0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`)

  ctx.fillStyle = grad
  ctx.fill()
}

function draw() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  ctx.clearRect(0, 0, w, h)

  // Draw layers back to front
  for (const layer of LAYERS) {
    drawLayer(layer, w, h)
  }

  time++
  animationId = requestAnimationFrame(draw)
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  window.addEventListener('resize', resize)
  resize()
  draw()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.scandi-aurora-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
