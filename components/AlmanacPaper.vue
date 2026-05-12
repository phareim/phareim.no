<template>
  <canvas ref="canvas" class="almanac-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let reducedMotion = false
let isDark = false
let darkQuery: MediaQueryList | null = null
let time = 0

// Warm amber palette matching --almanac-amber and --almanac-night-ink
const STAR_PALETTES = [
  [212, 165, 116],  // almanac-amber
  [235, 225, 200],  // pale parchment
  [200, 180, 148],  // warm beige
  [248, 240, 220],  // near-white warm
]

interface AlmanacStar {
  x: number
  y: number
  r: number
  baseOpacity: number
  phase: number
  speed: number    // very slow — this is paper, not space
  color: number[]
}

let stars: AlmanacStar[] = []

function initStars() {
  if (!canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  stars = []
  for (let i = 0; i < 65; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.25 + Math.random() * 0.9,
      baseOpacity: 0.18 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.005,   // very slow twinkle
      color: STAR_PALETTES[Math.floor(Math.random() * STAR_PALETTES.length)]!,
    })
  }
}

function drawStars(animated: boolean) {
  if (!ctx || !canvas.value || !isDark) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  for (const star of stars) {
    const twinkle = animated
      ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase))
      : 0.6
    const [r, g, b] = star.color
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r},${g},${b},${(star.baseOpacity * twinkle).toFixed(3)})`
    ctx.fill()
  }
}

function draw() {
  if (!ctx || !canvas.value) return
  if (!isDark) {
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
    animationId = requestAnimationFrame(draw)
    return
  }
  drawStars(true)
  time++
  animationId = requestAnimationFrame(draw)
}

function resize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
  initStars()
  if (reducedMotion) drawStars(false)
}

function handleDarkModeChange(e: MediaQueryListEvent) {
  isDark = e.matches
  if (!isDark && ctx && canvas.value) {
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  }
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
  if (!ctx) return

  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
  initStars()
  window.addEventListener('resize', resize)

  if (reducedMotion) {
    drawStars(false)
    return
  }

  darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
  darkQuery.addEventListener('change', handleDarkModeChange)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  draw()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (darkQuery) darkQuery.removeEventListener('change', handleDarkModeChange)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (animationId !== null) cancelAnimationFrame(animationId)
})
</script>

<style scoped>
.almanac-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
