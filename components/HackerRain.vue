<template>
  <canvas ref="canvas" class="hacker-rain-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let columns: RainColumn[] = []
let frame = 0

// Mix of binary, katakana fragments and block chars for visual variety
const CHARS = '01アウエオカキクケコサシスセソタチツテトナニヌネノ01ハヒフヘホマミムメモ01ヤユヨラリルレロワヲン'
const TRAIL_ALPHA = 0.055   // how fast trails fade (lower = longer trails)
const UPDATE_EVERY = 2      // update columns every N frames (throttle speed)
const BG = '#0a0a0a'
const ACCENT = '#ff0055'    // hacker theme accent (neon pink)

// Column state types
type ColState = 'normal' | 'glitch' | 'burst' | 'dim'

interface RainColumn {
  x: number
  y: number          // current head position (px)
  speed: number      // cells per update
  length: number     // stream length in cells (visual weight)
  brightness: number // 0..1 — some columns are dimmer
  fontSize: number   // px — varying sizes for depth
  state: ColState    // current visual state
  stateTimer: number // frames remaining in this state
  glitchChar: string // cached char for glitch flash
}

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)]
}

function pickState(): ColState {
  const r = Math.random()
  if (r < 0.04) return 'glitch'
  if (r < 0.08) return 'burst'
  if (r < 0.18) return 'dim'
  return 'normal'
}

function resize() {
  if (!canvas.value) return
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.value.width = w
  canvas.value.height = h
  if (ctx) {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
  }
  initColumns()
}

function initColumns() {
  if (!canvas.value) return
  // Use base font size for column spacing; individual columns have their own size
  const BASE_SIZE = 14
  const numCols = Math.floor(canvas.value.width / BASE_SIZE)
  columns = []
  for (let i = 0; i < numCols; i++) {
    const startY = Math.random() * -canvas.value.height * 1.5
    const state = pickState()
    const fontSize = state === 'burst' ? 12 : (Math.random() < 0.15 ? 18 : 14)
    columns.push({
      x: i * BASE_SIZE,
      y: startY,
      speed: state === 'burst' ? Math.random() * 1.2 + 1.6 : Math.random() * 0.8 + 0.4,
      length: Math.floor(Math.random() * 18 + 6),
      brightness: state === 'dim' ? Math.random() * 0.25 + 0.1 : Math.random() * 0.5 + 0.3,
      fontSize,
      state,
      stateTimer: Math.floor(Math.random() * 120 + 40),
      glitchChar: randomChar(),
    })
  }
}

function draw() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  // Semi-transparent overlay fades existing characters → creates trailing effect
  ctx.fillStyle = `rgba(10, 10, 10, ${TRAIL_ALPHA})`
  ctx.fillRect(0, 0, w, h)

  if (frame % UPDATE_EVERY === 0) {
    for (const col of columns) {
      // Tick state timer; transition to new state on expiry
      col.stateTimer--
      if (col.stateTimer <= 0) {
        col.state = pickState()
        col.stateTimer = Math.floor(Math.random() * 180 + 60)
        col.brightness = col.state === 'dim'
          ? Math.random() * 0.25 + 0.1
          : Math.random() * 0.5 + 0.3
        col.speed = col.state === 'burst'
          ? Math.random() * 1.2 + 1.6
          : Math.random() * 0.8 + 0.4
        col.fontSize = col.state === 'burst' ? 12 : (Math.random() < 0.15 ? 18 : 14)
        col.glitchChar = randomChar()
      }

      if (col.y < 0) {
        col.y += col.fontSize * col.speed
        continue
      }

      ctx.font = `${col.fontSize}px monospace`

      if (col.state === 'glitch') {
        // Pink/accent flash with shadowBlur glow
        ctx.shadowColor = ACCENT
        ctx.shadowBlur = 8
        ctx.fillStyle = `rgba(255, 0, 85, ${0.9 * col.brightness})`
        ctx.fillText(col.glitchChar, col.x, col.y)
        // Occasionally flicker the char below too
        if (col.y > col.fontSize * 2 && Math.random() < 0.4) {
          ctx.fillStyle = `rgba(255, 0, 85, ${0.5 * col.brightness})`
          ctx.fillText(randomChar(), col.x, col.y - col.fontSize)
        }
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'
      } else {
        // Normal / burst / dim — draw bright head
        const headAlpha = (col.state === 'burst' ? 1.0 : 0.85) * col.brightness
        if (col.state === 'burst') {
          ctx.shadowColor = 'rgba(0, 255, 65, 0.6)'
          ctx.shadowBlur = 6
        }
        ctx.fillStyle = `rgba(0, 255, 65, ${headAlpha})`
        ctx.fillText(randomChar(), col.x, col.y)

        // Body character just behind the head
        if (col.y > col.fontSize * 1.5) {
          ctx.shadowBlur = 0
          ctx.shadowColor = 'transparent'
          const bodyAlpha = 0.35 * col.brightness
          ctx.fillStyle = `rgba(0, 180, 40, ${bodyAlpha})`
          ctx.fillText(randomChar(), col.x, col.y - col.fontSize)
        }
        if (col.state === 'burst') {
          ctx.shadowBlur = 0
          ctx.shadowColor = 'transparent'
        }
      }

      col.y += col.fontSize * col.speed

      // Reset stream once it travels far enough off the bottom
      if (col.y > h + col.length * col.fontSize) {
        col.y = Math.random() * -h * 0.8
        col.speed = col.state === 'burst'
          ? Math.random() * 1.2 + 1.6
          : Math.random() * 0.8 + 0.4
        col.length = Math.floor(Math.random() * 18 + 6)
        col.brightness = col.state === 'dim'
          ? Math.random() * 0.25 + 0.1
          : Math.random() * 0.5 + 0.3
      }
    }
  }

  frame++
  animationId = requestAnimationFrame(draw)
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  if (!ctx) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)

  window.addEventListener('resize', resize)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  initColumns()
  draw()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (animationId !== null) cancelAnimationFrame(animationId)
})
</script>

<style scoped>
.hacker-rain-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
