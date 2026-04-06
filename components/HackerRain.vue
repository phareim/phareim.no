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
const FONT_SIZE = 14
const TRAIL_ALPHA = 0.055   // how fast trails fade (lower = longer trails)
const UPDATE_EVERY = 2      // update columns every N frames (throttle speed)
const BG = '#0a0a0a'

interface RainColumn {
  x: number
  y: number          // current head position (px)
  speed: number      // cells per update
  length: number     // stream length in cells (visual weight)
  brightness: number // 0..1 — some columns are dimmer
}

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)]
}

function resize() {
  if (!canvas.value) return
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.value.width = w
  canvas.value.height = h
  // Repaint dark background after resize so there are no blank white strips
  if (ctx) {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
  }
  initColumns()
}

function initColumns() {
  if (!canvas.value) return
  const numCols = Math.floor(canvas.value.width / FONT_SIZE)
  columns = []
  for (let i = 0; i < numCols; i++) {
    const startY = Math.random() * -canvas.value.height * 1.5
    columns.push({
      x: i * FONT_SIZE,
      y: startY,
      speed: Math.random() * 0.8 + 0.4,
      length: Math.floor(Math.random() * 18 + 6),
      brightness: Math.random() * 0.5 + 0.3,
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
    ctx.font = `${FONT_SIZE}px monospace`

    for (const col of columns) {
      if (col.y < 0) {
        // Column hasn't entered the screen yet — still advance it
        col.y += FONT_SIZE * col.speed
        continue
      }

      // Draw head character (bright)
      const headAlpha = 0.85 * col.brightness
      ctx.fillStyle = `rgba(0, 255, 65, ${headAlpha})`
      ctx.fillText(randomChar(), col.x, col.y)

      // Draw one dim character behind the head for the body colour
      if (col.y > FONT_SIZE * 1.5) {
        const bodyAlpha = 0.35 * col.brightness
        ctx.fillStyle = `rgba(0, 180, 40, ${bodyAlpha})`
        ctx.fillText(randomChar(), col.x, col.y - FONT_SIZE)
      }

      col.y += FONT_SIZE * col.speed

      // Reset stream once it travels far enough off the bottom
      if (col.y > h + col.length * FONT_SIZE) {
        col.y = Math.random() * -h * 0.8
        col.speed = Math.random() * 0.8 + 0.4
        col.length = Math.floor(Math.random() * 18 + 6)
        col.brightness = Math.random() * 0.5 + 0.3
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
  // Fill with dark background immediately so there is no flash of white
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)

  window.addEventListener('resize', resize)
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
