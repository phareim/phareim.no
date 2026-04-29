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
const TRAIL_DEPTH = 4       // bright-trail characters drawn behind head
const MUTATION_CHANCE = 0.08 // probability a mid-trail char mutates per update
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
  shockBoosted: boolean // true while shockwave has boosted this column
}

interface Shockwave {
  x: number
  y: number
  radius: number
  maxRadius: number
  startFrame: number
}

const SHOCK_SPEED = 7       // px per frame expansion
const SHOCK_WIDTH = 22      // px — wave band that triggers columns
const shockwaves: Shockwave[] = []
let reducedMotion = false

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
  if (reducedMotion) drawStatic()
}

function initColumns() {
  if (!canvas.value) return
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
      shockBoosted: false,
    })
  }
}

function triggerShockwave(clientX: number, clientY: number) {
  if (!canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const maxR = Math.sqrt(canvas.value.width ** 2 + canvas.value.height ** 2)
  shockwaves.push({ x, y, radius: 0, maxRadius: maxR, startFrame: frame })
}

function advanceShockwaves() {
  if (!ctx || !canvas.value) return
  const h = canvas.value.height

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]!
    sw.radius += SHOCK_SPEED

    // Trigger columns whose nearest point on the column falls within the wave band
    for (const col of columns) {
      if (col.shockBoosted) continue
      const colY = Math.max(0, Math.min(h, col.y))
      const dist = Math.sqrt((col.x - sw.x) ** 2 + (colY - sw.y) ** 2)
      if (dist >= sw.radius - SHOCK_WIDTH && dist < sw.radius) {
        col.state = Math.random() < 0.55 ? 'glitch' : 'burst'
        col.stateTimer = Math.floor(Math.random() * 30 + 20)
        col.brightness = 0.9 + Math.random() * 0.1
        col.glitchChar = randomChar()
        col.shockBoosted = true
      }
    }

    // Draw thin ring
    const alpha = Math.max(0, 1 - sw.radius / sw.maxRadius) * 0.55
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(0, 255, 65, ${alpha.toFixed(3)})`
    ctx.lineWidth = 1.5
    ctx.stroke()

    if (sw.radius >= sw.maxRadius) {
      shockwaves.splice(i, 1)
    }
  }
}

function draw() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  // Semi-transparent overlay fades existing characters → creates trailing effect
  ctx.fillStyle = `rgba(10, 10, 10, ${TRAIL_ALPHA})`
  ctx.fillRect(0, 0, w, h)

  advanceShockwaves()

  if (frame % UPDATE_EVERY === 0) {
    for (const col of columns) {
      // Tick state timer; transition to new state on expiry
      col.stateTimer--
      if (col.stateTimer <= 0) {
        col.shockBoosted = false
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
        // Normal / burst / dim — near-white head + multi-char bright trail
        const isBurst = col.state === 'burst'
        const headAlpha = (isBurst ? 1.0 : 0.95) * col.brightness
        if (isBurst) {
          ctx.shadowColor = 'rgba(0, 255, 65, 0.6)'
          ctx.shadowBlur = 6
        }
        ctx.fillStyle = `rgba(220, 255, 220, ${headAlpha})`
        ctx.fillText(randomChar(), col.x, col.y)

        if (isBurst) {
          ctx.shadowBlur = 0
          ctx.shadowColor = 'transparent'
        }

        // Fresh-trail segment fading from bright to dim green behind the head —
        // creates a crisp bright zone before the canvas-persistence fade takes over.
        const depth = Math.min(TRAIL_DEPTH, Math.floor(col.length / 2))
        for (let t = 1; t <= depth; t++) {
          const trailY = col.y - col.fontSize * t
          if (trailY < 0) break
          const fade = 1 - t / (depth + 1)
          const green = Math.floor(80 + 160 * fade)
          const alpha = 0.65 * col.brightness * fade
          ctx.fillStyle = `rgba(0, ${green}, 40, ${alpha})`
          ctx.fillText(randomChar(), col.x, trailY)
        }

        // Occasional mid-trail mutation — the signature "flickering glyph" look.
        if (Math.random() < MUTATION_CHANCE) {
          const mutOffset = depth + 1 + Math.floor(Math.random() * Math.max(1, col.length - depth - 1))
          const mutY = col.y - col.fontSize * mutOffset
          if (mutY > 0) {
            ctx.fillStyle = `rgba(0, 130, 30, ${0.28 * col.brightness})`
            ctx.fillText(randomChar(), col.x, mutY)
          }
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

function drawStatic() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)
  initColumns()
  ctx.font = '14px monospace'
  for (const col of columns) {
    if (col.y < 0) continue
    ctx.fillStyle = `rgba(0, 255, 65, ${0.4 * col.brightness})`
    ctx.fillText(col.glitchChar, col.x, Math.max(col.fontSize, Math.min(h, col.y + h * 0.5)))
  }
}

function handleClick(e: MouseEvent) {
  triggerShockwave(e.clientX, e.clientY)
}

function handleTouch(e: TouchEvent) {
  const touch = e.touches[0]
  if (touch) triggerShockwave(touch.clientX, touch.clientY)
}

function handleVisibilityChange() {
  if (document.hidden) {
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  } else if (animationId === null) {
    draw()
  }
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  if (!ctx) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  window.addEventListener('resize', resize)

  if (reducedMotion) {
    drawStatic()
    return
  }

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('click', handleClick)
  window.addEventListener('touchstart', handleTouch, { passive: true })
  initColumns()
  draw()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('click', handleClick)
  window.removeEventListener('touchstart', handleTouch)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
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
