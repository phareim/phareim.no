<template>
  <canvas
    v-if="isPlaying"
    ref="canvas"
    class="theme-transition-overlay"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
const { activeTheme } = useTheme()
const canvas = ref<HTMLCanvasElement | null>(null)
const isPlaying = ref(false)
let animationId: number | null = null

// Per-theme animation durations (ms)
const DURATIONS: Record<string, number> = {
  scandi: 750,
  hacker: 480,
  space: 850,
  almanac: 550,
}

// ── Scandinavian: frost / ice-crystal radiate ────────────────────────────────
function playFrostEffect(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h)
  // Arc: fade in fast, hold, fade out
  const alpha = t < 0.35 ? t / 0.35 : t > 0.65 ? (1 - t) / 0.35 : 1

  ctx.fillStyle = `rgba(245, 245, 243, ${alpha * 0.82})`
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const maxR = Math.hypot(cx, cy)
  const phase = t < 0.5 ? t * 2 : 2 - t * 2

  const NUM_ARMS = 12
  for (let i = 0; i < NUM_ARMS; i++) {
    const angle = (i / NUM_ARMS) * Math.PI * 2
    const len = maxR * phase

    // Main arm
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len)
    ctx.strokeStyle = `rgba(160, 210, 240, ${alpha * 0.55})`
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Branch tines at 1/3, 1/2, 2/3
    for (const frac of [0.33, 0.5, 0.67]) {
      const bx = cx + Math.cos(angle) * len * frac
      const by = cy + Math.sin(angle) * len * frac
      const tineLen = len * 0.18
      for (const sign of [-1, 1]) {
        const ta = angle + sign * Math.PI / 3
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx + Math.cos(ta) * tineLen, by + Math.sin(ta) * tineLen)
        ctx.strokeStyle = `rgba(180, 220, 245, ${alpha * 0.35})`
        ctx.lineWidth = 0.7
        ctx.stroke()
      }
    }
  }
}

// ── Hacker: matrix-rain cascade ──────────────────────────────────────────────
function playMatrixEffect(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h)
  const alpha = t < 0.12 ? t / 0.12 : t > 0.78 ? (1 - t) / 0.22 : 1

  ctx.fillStyle = `rgba(10, 10, 10, ${alpha * 0.93})`
  ctx.fillRect(0, 0, w, h)

  const SIZE = 15
  const cols = Math.ceil(w / SIZE)
  const rows = Math.ceil(h / SIZE)
  const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ'

  ctx.font = `${SIZE}px 'Courier New', monospace`

  for (let col = 0; col < cols; col++) {
    // Stagger columns left-to-right
    const colT = (t - (col / cols) * 0.25) / 0.75
    if (colT <= 0) continue

    const headRow = Math.floor(Math.min(colT, 1) * (rows + 20))
    const TAIL = 18

    for (let row = Math.max(0, headRow - TAIL); row <= Math.min(headRow, rows - 1); row++) {
      const dist = headRow - row
      const charAlpha = dist === 0 ? 1 : Math.max(0, 1 - dist / TAIL)
      const brightness = dist === 0 ? 255 : 65
      // Deterministic char — changes every ~3 frames for subtle shimmer
      const charIdx = (col * 137 + row * 29 + Math.floor(t * 20)) % CHARS.length
      ctx.fillStyle = `rgba(0, ${brightness}, ${dist === 0 ? 65 : 41}, ${charAlpha * alpha})`
      ctx.fillText(CHARS[charIdx]!, col * SIZE, row * SIZE + SIZE)
    }
  }
}

// ── Space: star-warp burst ────────────────────────────────────────────────────
function playWarpEffect(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h)
  const alpha = t < 0.12 ? t / 0.12 : t > 0.72 ? (1 - t) / 0.28 : 1

  ctx.fillStyle = `rgba(10, 10, 15, ${alpha * 0.96})`
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const maxR = Math.hypot(cx, cy)
  const warp = Math.min(1, t * 1.6) // accelerate expansion

  const NUM_STARS = 140
  for (let i = 0; i < NUM_STARS; i++) {
    const angle = (i / NUM_STARS) * Math.PI * 2
    const offset = (i % 9) * 12        // vary start distance
    const speed = 0.45 + (i % 7) * 0.12

    const r0 = offset + 5
    const r1 = r0 + warp * maxR * speed

    const x1 = cx + Math.cos(angle) * r0
    const y1 = cy + Math.sin(angle) * r0
    const x2 = cx + Math.cos(angle) * r1
    const y2 = cy + Math.sin(angle) * r1

    const hue = 195 + (i % 55)
    const lineAlpha = Math.min(1, warp * 2.5) * alpha * 0.85
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = `hsla(${hue}, 65%, 78%, ${lineAlpha})`
    ctx.lineWidth = 0.4 + (i % 4) * 0.25
    ctx.stroke()
  }

  // Brief blue-white flash at warp peak
  if (t > 0.28 && t < 0.52) {
    const flashT = (t - 0.28) / 0.24
    const flashA = Math.sin(flashT * Math.PI) * 0.28 * alpha
    ctx.fillStyle = `rgba(140, 170, 220, ${flashA})`
    ctx.fillRect(0, 0, w, h)
  }
}

// ── Almanac: quiet paper breath ──────────────────────────────────────────────
// Warm paper wash with a gentle centre bloom — matching the almanac's
// "no-chrome, opacity-only" philosophy. Dark OS mode uses midnight paper.
function playAlmanacEffect(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h)
  // Bell-curve alpha: 0 → 1 by t=0.3, hold, back to 0 by t=1
  const alpha = t < 0.30 ? t / 0.30 : t > 0.62 ? (1 - t) / 0.38 : 1

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  // paper tone: warm ivory in light, midnight blue-black in dark
  const [r, g, b] = isDark ? [14, 18, 25] : [244, 240, 232]
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.88).toFixed(3)})`
  ctx.fillRect(0, 0, w, h)

  // Soft centre bloom: lighter circle that fades to the paper colour at the edge
  const cx = w / 2
  const cy = h / 2
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(cx, cy) * 0.8)
  if (isDark) {
    bloom.addColorStop(0, `rgba(30, 40, 55, ${(alpha * 0.30).toFixed(3)})`)
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)')
  } else {
    bloom.addColorStop(0, `rgba(255, 254, 248, ${(alpha * 0.38).toFixed(3)})`)
    bloom.addColorStop(1, 'rgba(210, 200, 180, 0)')
  }
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, w, h)
}

// ── Orchestration ─────────────────────────────────────────────────────────────
watch(activeTheme, (newTheme) => {
  if (!import.meta.client) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (animationId !== null) cancelAnimationFrame(animationId)

  isPlaying.value = true
  const duration = DURATIONS[newTheme] ?? 700
  const startTime = performance.now()

  const tick = () => {
    const el = canvas.value
    if (!el) { isPlaying.value = false; return }
    const ctx = el.getContext('2d')
    if (!ctx) { isPlaying.value = false; return }

    const w = window.innerWidth
    const h = window.innerHeight
    if (el.width !== w) el.width = w
    if (el.height !== h) el.height = h

    const t = Math.min(1, (performance.now() - startTime) / duration)

    if (newTheme === 'scandi') playFrostEffect(ctx, w, h, t)
    else if (newTheme === 'hacker') playMatrixEffect(ctx, w, h, t)
    else if (newTheme === 'space') playWarpEffect(ctx, w, h, t)
    else if (newTheme === 'almanac') playAlmanacEffect(ctx, w, h, t)

    if (t < 1) {
      animationId = requestAnimationFrame(tick)
    } else {
      animationId = null
      isPlaying.value = false
    }
  }

  nextTick(() => { animationId = requestAnimationFrame(tick) })
})

onBeforeUnmount(() => {
  if (animationId !== null) cancelAnimationFrame(animationId)
})
</script>

<style scoped>
.theme-transition-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  display: block;
}
</style>
