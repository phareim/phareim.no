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
  almanac: 600,
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

// ── Almanac: parchment page dissolve ──────────────────────────────────────────
// A warm cream wash (light) or midnight wash (dark) bleeds in, carrying
// horizontal hairline rules that sweep left-to-right like turning almanac pages.
function playParchmentEffect(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h)

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  // Overlay alpha: fade in 0→0.22, hold 0.22→0.68, fade out 0.68→1
  const alpha = t < 0.22 ? t / 0.22 : t > 0.68 ? (1 - t) / 0.32 : 1

  // Background wash — warm paper or midnight paper
  const [bgR, bgG, bgB] = isDark ? [14, 18, 25] : [244, 240, 232]
  ctx.fillStyle = `rgba(${bgR},${bgG},${bgB},${alpha * 0.94})`
  ctx.fillRect(0, 0, w, h)

  // Hairline rules sweeping left → right
  // Sweep starts at t=0.1, every rule fully drawn by t=0.62
  const ruleSpacing = 26
  const ruleCount = Math.ceil(h / ruleSpacing) + 1
  const inkAlpha = isDark ? alpha * 0.20 : alpha * 0.12

  ctx.strokeStyle = isDark
    ? `rgba(235, 228, 212, ${inkAlpha})`
    : `rgba(26, 26, 26, ${inkAlpha})`
  ctx.lineWidth = 0.55

  for (let i = 0; i < ruleCount; i++) {
    const y = i * ruleSpacing + ruleSpacing * 0.5
    // Rows stagger: first row leads, last row trails by 0.14 of the animation
    const rowOffset = (i / ruleCount) * 0.14
    const rowSweep = Math.max(0, Math.min(1, (t - 0.10 - rowOffset) / 0.38))
    const ruleLen = w * rowSweep

    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(ruleLen, y)
    ctx.stroke()
  }

  // Faint marginal vignette — the page edges
  if (alpha > 0.08) {
    const vigAlpha = alpha * 0.22
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.72)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, `rgba(0,0,0,${vigAlpha})`)
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, w, h)
  }
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
    else if (newTheme === 'almanac') playParchmentEffect(ctx, w, h, t)

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
