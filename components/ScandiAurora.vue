<template>
  <canvas ref="canvas" class="scandi-aurora-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let time = 0

// Mouse parallax state
let mouseParallaxX = 0
let mouseParallaxY = 0
let targetMouseX = 0
let targetMouseY = 0
const MOUSE_SENSITIVITY = 10
const MOUSE_SMOOTHING = 0.04

// Gyroscope parallax state (mobile)
let gyroOffsetX = 0
let gyroOffsetY = 0
let targetGyroX = 0
let targetGyroY = 0
const GYRO_SENSITIVITY = 1.2
const GYRO_SMOOTHING = 0.08

let gyroTapHandler: (() => void) | null = null

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
  parallaxDepth: number  // fraction of mouse offset applied (0 = none, 1 = full)
}

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
  parallaxDepth: number
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

interface AuroraFlare {
  x: number
  width: number
  hue: number
  alpha: number
  decay: number
  heightFrac: number
}

let flares: AuroraFlare[] = []

// parallaxDepth: lower altitude (larger baseY) = closer = more parallax
const LAYERS: AuroraLayer[] = [
  { baseY: 0.28, amplitude: 0.08, speed: 0.00018, waveLen: 0.55, phase: 0.0, thickness: 0.18, hueBase: 145, hueRange: 25, alpha: 0.24, parallaxDepth: 0.5 },
  { baseY: 0.20, amplitude: 0.06, speed: 0.00024, waveLen: 0.70, phase: 1.2, thickness: 0.14, hueBase: 165, hueRange: 20, alpha: 0.18, parallaxDepth: 0.35 },
  { baseY: 0.35, amplitude: 0.07, speed: 0.00014, waveLen: 0.45, phase: 2.5, thickness: 0.12, hueBase: 195, hueRange: 35, alpha: 0.14, parallaxDepth: 0.65 },
  { baseY: 0.14, amplitude: 0.05, speed: 0.00028, waveLen: 0.80, phase: 3.8, thickness: 0.09, hueBase: 318, hueRange: 35, alpha: 0.11, parallaxDepth: 0.2 },
  { baseY: 0.40, amplitude: 0.06, speed: 0.00020, waveLen: 0.60, phase: 5.1, thickness: 0.09, hueBase: 155, hueRange: 18, alpha: 0.10, parallaxDepth: 0.75 },
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
    parallaxDepth: Math.random() * 0.25 + 0.05,
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
    const px = star.x + (mouseParallaxX + gyroOffsetX) * star.parallaxDepth
    const py = star.y + (mouseParallaxY + gyroOffsetY) * star.parallaxDepth
    ctx.beginPath()
    ctx.arc(px, py, star.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${(twinkle * 0.55).toFixed(3)})`
    ctx.fill()
  }
}

function drawRays(w: number, h: number) {
  if (!ctx) return
  for (const ray of rays) {
    const breathe = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * ray.speed + ray.phase))
    const x = ray.xFrac * w + Math.sin(time * ray.driftSpeed + ray.phase) * ray.driftAmp + (mouseParallaxX + gyroOffsetX) * 0.4
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

function triggerFlare(clientX: number) {
  flares.push({
    x: clientX,
    width: 25 + Math.random() * 55,
    hue: 135 + Math.random() * 85,
    alpha: 0.42 + Math.random() * 0.22,
    decay: 0.007 + Math.random() * 0.005,
    heightFrac: 0.25 + Math.random() * 0.18,
  })
  flares.push({
    x: clientX + (Math.random() - 0.5) * 90,
    width: 8 + Math.random() * 22,
    hue: 145 + Math.random() * 65,
    alpha: 0.22 + Math.random() * 0.15,
    decay: 0.01 + Math.random() * 0.007,
    heightFrac: 0.15 + Math.random() * 0.12,
  })
}

function drawFlares(h: number) {
  if (!ctx || flares.length === 0) return
  for (const flare of flares) {
    const topY = h * 0.04
    const botY = topY + flare.heightFrac * h
    const grad = ctx.createLinearGradient(0, topY, 0, botY)
    grad.addColorStop(0.0, `hsla(${flare.hue}, 82%, 65%, 0)`)
    grad.addColorStop(0.1, `hsla(${flare.hue}, 82%, 65%, ${flare.alpha.toFixed(3)})`)
    grad.addColorStop(0.55, `hsla(${flare.hue}, 78%, 60%, ${(flare.alpha * 0.55).toFixed(3)})`)
    grad.addColorStop(1.0, `hsla(${flare.hue}, 75%, 55%, 0)`)
    ctx.fillStyle = grad
    ctx.fillRect(flare.x - flare.width / 2, topY, flare.width, botY - topY)
    flare.alpha -= flare.decay
  }
  flares = flares.filter(f => f.alpha > 0)
}

function drawLayer(layer: AuroraLayer, w: number, h: number) {
  if (!ctx) return

  const STEPS = 80
  const stepW = w / STEPS
  const hue = layer.hueBase + Math.sin(time * 0.00008 + layer.phase) * layer.hueRange
  const thickness = layer.thickness * h
  const offsetX = (mouseParallaxX + gyroOffsetX) * layer.parallaxDepth
  const offsetY = (mouseParallaxY + gyroOffsetY) * layer.parallaxDepth * 0.3

  ctx.beginPath()
  for (let i = 0; i <= STEPS; i++) {
    const x = i * stepW + offsetX
    const sineVal = Math.sin(i / STEPS * Math.PI * 2 / layer.waveLen + time * layer.speed + layer.phase)
    const centerY = layer.baseY * h + sineVal * layer.amplitude * h + offsetY
    const topY = centerY - thickness * 0.5
    if (i === 0) {
      ctx.moveTo(x, topY)
    } else {
      ctx.lineTo(x, topY)
    }
  }
  for (let i = STEPS; i >= 0; i--) {
    const x = i * stepW + offsetX
    const sineVal = Math.sin(i / STEPS * Math.PI * 2 / layer.waveLen + time * layer.speed + layer.phase)
    const centerY = layer.baseY * h + sineVal * layer.amplitude * h + offsetY
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

let reducedMotion = false

function draw() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  // Smooth parallax toward targets
  mouseParallaxX += (targetMouseX - mouseParallaxX) * MOUSE_SMOOTHING
  mouseParallaxY += (targetMouseY - mouseParallaxY) * MOUSE_SMOOTHING
  gyroOffsetX += (targetGyroX - gyroOffsetX) * GYRO_SMOOTHING
  gyroOffsetY += (targetGyroY - gyroOffsetY) * GYRO_SMOOTHING

  ctx.clearRect(0, 0, w, h)

  drawStars(w, h)
  drawRays(w, h)
  drawFlares(h)

  for (const layer of LAYERS) {
    drawLayer(layer, w, h)
  }

  time++
  if (!reducedMotion) animationId = requestAnimationFrame(draw)
}

function handleClick(e: MouseEvent) {
  triggerFlare(e.clientX)
}

function handleTouch(e: TouchEvent) {
  const touch = e.touches[0]
  if (touch) triggerFlare(touch.clientX)
}

function handleMouseMove(e: MouseEvent) {
  if (!canvas.value) return
  const cx = canvas.value.width / 2
  const cy = canvas.value.height / 2
  targetMouseX = ((e.clientX - cx) / cx) * -MOUSE_SENSITIVITY
  targetMouseY = ((e.clientY - cy) / cy) * -MOUSE_SENSITIVITY
}

function handleOrientation(e: DeviceOrientationEvent) {
  if (e.gamma !== null && e.beta !== null) {
    targetGyroX = e.gamma * GYRO_SENSITIVITY
    targetGyroY = (e.beta - 45) * GYRO_SENSITIVITY
  }
}

function enableGyro() {
  const DOE = DeviceOrientationEvent as any
  if (typeof DOE !== 'undefined' && typeof DOE.requestPermission === 'function') {
    DOE.requestPermission().then((state: string) => {
      if (state === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation)
      }
    }).catch(console.warn)
  } else if ('DeviceOrientationEvent' in window) {
    window.addEventListener('deviceorientation', handleOrientation)
  }
}

function onResize() {
  resize()
  if (reducedMotion) draw()
}

function handleVisibilityChange() {
  if (document.hidden) {
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  } else if (!reducedMotion && animationId === null) {
    draw()
  }
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.addEventListener('resize', onResize)
  resize()

  if (!reducedMotion) {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    window.addEventListener('touchstart', handleTouch, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const DOE = DeviceOrientationEvent as any
    if (typeof DOE !== 'undefined' && typeof DOE.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', handleOrientation)
    }
    gyroTapHandler = () => { enableGyro(); document.removeEventListener('click', gyroTapHandler!) }
    document.addEventListener('click', gyroTapHandler, { once: true })
  }

  draw()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('click', handleClick)
  window.removeEventListener('touchstart', handleTouch)
  window.removeEventListener('deviceorientation', handleOrientation)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (gyroTapHandler) document.removeEventListener('click', gyroTapHandler)
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
