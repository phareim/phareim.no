<template>
  <canvas ref="canvas" class="almanac-paper-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let isDarkMode = false
let reducedMotion = false
let time = 0

// ── Dark-mode: warm amber stars ──────────────────────────────────────────────

interface AlmanacStar {
  x: number
  y: number
  r: number
  phase: number
  speed: number
  baseAlpha: number
}

let stars: AlmanacStar[] = []

function initStars(w: number, h: number) {
  stars = Array.from({ length: 30 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h * 0.9 + h * 0.05,
    r: 0.5 + Math.random() * 0.85,
    phase: Math.random() * Math.PI * 2,
    speed: 0.0035 + Math.random() * 0.006,
    baseAlpha: 0.22 + Math.random() * 0.42,
  }))
}

// ── Light-mode: paper grain + vignette ───────────────────────────────────────

interface GrainDot {
  x: number
  y: number
  a: number
  warm: boolean  // slightly warm vs neutral grain
}

let grainDots: GrainDot[] = []

function initGrain(w: number, h: number) {
  grainDots = Array.from({ length: 2200 }, () => ({
    x: Math.floor(Math.random() * w),
    y: Math.floor(Math.random() * h),
    a: 0.011 + Math.random() * 0.022,
    warm: Math.random() < 0.55,
  }))
}

// ── Render ────────────────────────────────────────────────────────────────────

function resize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
  if (isDarkMode) {
    initStars(canvas.value.width, canvas.value.height)
  } else {
    initGrain(canvas.value.width, canvas.value.height)
    drawLightMode()   // redraw static layer immediately after resize
  }
}

function drawDarkMode() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  ctx.clearRect(0, 0, w, h)

  for (const star of stars) {
    const twinkle = 0.55 + 0.45 * Math.sin(time * star.speed + star.phase)
    const alpha = star.baseAlpha * twinkle

    // Soft glow halo — keeps the tiny stars visible without being bright
    const glowR = star.r * 2.8
    const glowGrad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowR)
    glowGrad.addColorStop(0, `rgba(212, 165, 116, ${(alpha * 0.28).toFixed(3)})`)
    glowGrad.addColorStop(1, 'rgba(212, 165, 116, 0)')
    ctx.beginPath()
    ctx.arc(star.x, star.y, glowR, 0, Math.PI * 2)
    ctx.fillStyle = glowGrad
    ctx.fill()

    // Star core
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(212, 165, 116, ${alpha.toFixed(3)})`
    ctx.fill()
  }
}

function drawLightMode() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  ctx.clearRect(0, 0, w, h)

  // Grain dots — warm/neutral mix at very low opacity
  for (const dot of grainDots) {
    ctx.fillStyle = dot.warm
      ? `rgba(100, 70, 38, ${dot.a})`
      : `rgba(80, 72, 60, ${dot.a})`
    ctx.fillRect(dot.x, dot.y, 1, 1)
  }

  // Soft vignette — darkens edges slightly for a physical-paper feel
  const vign = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.65)
  vign.addColorStop(0, 'rgba(90, 60, 30, 0)')
  vign.addColorStop(1, 'rgba(90, 60, 30, 0.10)')
  ctx.fillStyle = vign
  ctx.fillRect(0, 0, w, h)
}

function drawStatic() {
  if (isDarkMode) {
    // Single non-animated frame for reduced-motion
    for (const star of stars) {
      if (!ctx) break
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(212, 165, 116, ${star.baseAlpha.toFixed(3)})`
      ctx.fill()
    }
  } else {
    drawLightMode()
  }
}

function draw() {
  if (isDarkMode) {
    drawDarkMode()
    time++
  }
  // Light mode grain is static — drawn once on init/resize, not every frame
  if (!reducedMotion) animationId = requestAnimationFrame(draw)
}

function handleVisibilityChange() {
  if (document.hidden) {
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  } else if (!reducedMotion && animationId === null && isDarkMode) {
    draw()
  }
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  if (!ctx) return

  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight

  if (isDarkMode) {
    initStars(canvas.value.width, canvas.value.height)
  } else {
    initGrain(canvas.value.width, canvas.value.height)
  }

  window.addEventListener('resize', resize)

  if (reducedMotion) {
    drawStatic()
    return
  }

  if (isDarkMode) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    draw()
  } else {
    drawLightMode()   // static grain — no ongoing animation needed
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (animationId !== null) cancelAnimationFrame(animationId)
})
</script>

<style scoped>
.almanac-paper-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
