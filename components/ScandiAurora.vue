<template>
  <canvas ref="canvas" class="scandi-aurora-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let time = 0

interface AuroraLayer {
  baseY: number
  amplitude: number
  speed: number
  waveLen: number
  phase: number
  thickness: number
  hueBase: number
  hueRange: number
  alpha: number
}

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
}

interface CurtainRay {
  xFrac: number
  baseY: number
  length: number
  width: number
  hue: number
  alpha: number
  phase: number
  speed: number
  driftAmp: number
  driftSpeed: number
}

const LAYERS: AuroraLayer[] = [
  { baseY: 0.28, amplitude: 0.08, speed: 0.00018, waveLen: 0.55, phase: 0.0, thickness: 0.18, hueBase: 145, hueRange: 25, alpha: 0.24 },
  { baseY: 0.20, amplitude: 0.06, speed: 0.00024, waveLen: 0.70, phase: 1.2, thickness: 0.14, hueBase: 165, hueRange: 20, alpha: 0.18 },
  { baseY: 0.35, amplitude: 0.07, speed: 0.00014, waveLen: 0.45, phase: 2.5, thickness: 0.12, hueBase: 195, hueRange: 35, alpha: 0.14 },
  { baseY: 0.14, amplitude: 0.05, speed: 0.00028, waveLen: 0.80, phase: 3.8, thickness: 0.09, hueBase: 318, hueRange: 35, alpha: 0.11 }, // high-altitude pink
  { baseY: 0.40, amplitude: 0.06, speed: 0.00020, waveLen: 0.60, phase: 5.1, thickness: 0.09, hueBase: 155, hueRange: 18, alpha: 0.10 },
]

let stars: Star[] = []
let rays: CurtainRay[] = []

function initStars(w: number, h: number) {
  stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h * 0.55,
    r: 0.3 + Math.random() * 1.1,
    phase: Math.random() * Math.PI * 2,
    speed: 0.0015 + Math.random() * 0.0025,
  }))
}

function initRays(w: number, h: number) {
  rays = Array.from({ length: 10 }, (_, i) => {
    const slot = (i + 0.5) / 10
    return {
      xFrac: slot + (Math.random() - 0.5) * 0.07,
      baseY: 0.06 + Math.random() * 0.12,
      length: 0.14 + Math.random() * 0.22,
      width: 7 + Math.random() * 22,
      hue: 130 + Math.random() * 75,
      alpha: 0.04 + Math.random() * 0.09,
      phase: Math.random() * Math.PI * 2,
      speed: 0.00007 + Math.random() * 0.00018,
      driftAmp: 15 + Math.random() * 25,
      driftSpeed: 0.000025 + Math.random() * 0.00004,
    }
  })
}

function resize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
  initStars(canvas.value.width, canvas.value.height)
  initRays(canvas.value.width, canvas.value.height)
}

function drawStars(w: number, h: number) {
  if (!ctx) return
  for (const star of stars) {
    const twinkle = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase))
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${(twinkle * 0.55).toFixed(3)})`
    ctx.fill()
  }
}

function drawRays(w: number, h: number) {
  if (!ctx) return
  for (const ray of rays) {
    const breathe = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * ray.speed + ray.phase))
    const x = ray.xFrac * w + Math.sin(time * ray.driftSpeed + ray.phase) * ray.driftAmp
    const topY = ray.baseY * h
    const botY = topY + ray.length * h

    const grad = ctx.createLinearGradient(0, topY, 0, botY)
    const a = (ray.alpha * breathe).toFixed(3)
    const aMid = (ray.alpha * breathe * 0.55).toFixed(3)
    grad.addColorStop(0.0, `hsla(${ray.hue}, 78%, 62%, 0)`)
    grad.addColorStop(0.15, `hsla(${ray.hue}, 78%, 62%, ${a})`)
    grad.addColorStop(0.55, `hsla(${ray.hue}, 75%, 58%, ${aMid})`)
    grad.addColorStop(1.0, `hsla(${ray.hue}, 72%, 54%, 0)`)

    ctx.fillStyle = grad
    ctx.fillRect(x - ray.width / 2, topY, ray.width, botY - topY)
  }
}

function drawLayer(layer: AuroraLayer, w: number, h: number) {
  if (!ctx) return

  const STEPS = 80
  const stepW = w / STEPS
  const hue = layer.hueBase + Math.sin(time * 0.00008 + layer.phase) * layer.hueRange
  const thickness = layer.thickness * h

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

  const midSine = Math.sin(0.5 * Math.PI * 2 / layer.waveLen + time * layer.speed + layer.phase)
  const midY = layer.baseY * h + midSine * layer.amplitude * h
  const grad = ctx.createLinearGradient(0, midY - thickness * 0.5, 0, midY + thickness * 0.5)
  const saturation = 70 + Math.sin(time * 0.00005 + layer.phase * 2) * 15
  const lightness = 55 + Math.sin(time * 0.00007 + layer.phase) * 10
  grad.addColorStop(0.0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`)
  grad.addColorStop(0.3, `hsla(${hue}, ${saturation}%, ${lightness}%, ${layer.alpha})`)
  grad.addColorStop(0.5, `hsla(${hue}, ${saturation + 10}%, ${lightness + 5}%, ${(layer.alpha * 1.3).toFixed(3)})`)
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

  drawStars(w, h)
  drawRays(w, h)

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
