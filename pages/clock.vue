<template>
  <div class="clock-page">
    <header class="clock-header">
      <h1>{{ activeTheme === 'hacker' ? 'time.exe' : activeTheme === 'space' ? 'CHRONOMETER' : 'clock' }}</h1>
      <p class="subtitle">{{ activeTheme === 'hacker' ? '// now, in hex' : activeTheme === 'space' ? 'OSLO SECTOR — EARTH' : 'now, precisely' }}</p>
    </header>

    <main class="clock-main">

      <!-- ── Hacker theme: terminal display ─────────────────── -->
      <div v-if="activeTheme === 'hacker'" class="hacker-terminal" aria-live="polite" aria-label="Current time">
        <div class="hacker-line"><span class="hl-label">TIME</span><span class="hl-sep">:</span><span class="hl-value hl-bright">{{ timeStr }}</span></div>
        <div class="hacker-line"><span class="hl-label">HEX </span><span class="hl-sep">:</span><span class="hl-value">0x{{ hexTime }}</span></div>
        <div class="hacker-line"><span class="hl-label">UNIX</span><span class="hl-sep">:</span><span class="hl-value">{{ unixTime }}</span></div>
        <div class="hacker-line"><span class="hl-label">UTC </span><span class="hl-sep">:</span><span class="hl-value">{{ utcStr }}</span></div>
        <div class="hacker-line"><span class="hl-label">DATE</span><span class="hl-sep">:</span><span class="hl-value">{{ iso8601 }}</span></div>
        <div class="hacker-line"><span class="hl-label">DOY </span><span class="hl-sep">:</span><span class="hl-value">{{ dayOfYear }}</span></div>
        <div class="hacker-line hacker-line--cursor">
          <span class="hl-prompt">$</span><span class="hacker-cursor">_</span>
        </div>
      </div>

      <!-- ── Scandinavian + Space: SVG analog clock ─────────── -->
      <div v-else class="analog-wrapper">
        <svg
          class="analog-face"
          viewBox="0 0 200 200"
          aria-hidden="true"
          role="img"
        >
          <!-- Outer ring -->
          <circle cx="100" cy="100" r="96" fill="none" class="face-ring" stroke-width="1.5" />
          <!-- Subtle inner ring -->
          <circle cx="100" cy="100" r="88" fill="none" class="face-ring-inner" stroke-width="0.5" />

          <!-- Hour tick marks -->
          <line
            v-for="i in 12"
            :key="`h${i}`"
            :x1="100 + 80 * Math.sin((i * 30) * DEG)"
            :y1="100 - 80 * Math.cos((i * 30) * DEG)"
            :x2="100 + 90 * Math.sin((i * 30) * DEG)"
            :y2="100 - 90 * Math.cos((i * 30) * DEG)"
            stroke-width="2.5"
            stroke-linecap="round"
            class="tick-major"
          />

          <!-- Minute tick marks -->
          <template v-for="i in 60" :key="`m${i}`">
            <line
              v-if="i % 5 !== 0"
              :x1="100 + 85 * Math.sin((i * 6) * DEG)"
              :y1="100 - 85 * Math.cos((i * 6) * DEG)"
              :x2="100 + 90 * Math.sin((i * 6) * DEG)"
              :y2="100 - 90 * Math.cos((i * 6) * DEG)"
              stroke-width="0.75"
              stroke-linecap="round"
              class="tick-minor"
            />
          </template>

          <!-- Hour hand -->
          <line
            class="hand-hour"
            x1="100" y1="100"
            :x2="100 + 52 * Math.sin(hourAngle * DEG)"
            :y2="100 - 52 * Math.cos(hourAngle * DEG)"
            stroke-width="4"
            stroke-linecap="round"
          />

          <!-- Minute hand -->
          <line
            class="hand-minute"
            x1="100" y1="100"
            :x2="100 + 70 * Math.sin(minuteAngle * DEG)"
            :y2="100 - 70 * Math.cos(minuteAngle * DEG)"
            stroke-width="2.5"
            stroke-linecap="round"
          />

          <!-- Second hand -->
          <line
            class="hand-second"
            x1="100" y1="112"
            :x2="100 + 78 * Math.sin(secondAngle * DEG)"
            :y2="100 - 78 * Math.cos(secondAngle * DEG)"
            stroke-width="1"
            stroke-linecap="round"
          />

          <!-- Center cap -->
          <circle cx="100" cy="100" r="4" class="center-cap" />
          <circle cx="100" cy="100" r="1.5" class="center-cap-inner" />
        </svg>
      </div>

      <!-- ── Digital info panel (Scandi + Space) ─────────────── -->
      <div v-if="activeTheme !== 'hacker'" class="info-panel" aria-live="polite" aria-label="Current time">
        <div class="info-time">{{ timeStr }}</div>
        <div class="info-date">{{ longDate }}</div>
        <div class="info-row">
          <span class="info-label">oslo</span>
          <span class="info-value">UTC+{{ utcOffset }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">utc</span>
          <span class="info-value">{{ utcStr }}</span>
        </div>
        <div v-if="activeTheme === 'space'" class="info-stardate">
          <span class="stardate-label">STARDATE</span>
          <span class="stardate-value">{{ stardate }}</span>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
const { activeTheme } = useTheme()

useHead({ title: 'clock — phareim.no' })

const DEG = Math.PI / 180

// ── Reactive time state ───────────────────────────────────────────────

const now = ref(new Date())

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000)
})

onBeforeUnmount(() => {
  if (timer !== null) clearInterval(timer)
})

// ── Clock hands (smooth, accounting for sub-unit progress) ───────────

const secondAngle = computed(() => now.value.getSeconds() * 6)

const minuteAngle = computed(() =>
  now.value.getMinutes() * 6 + now.value.getSeconds() * 0.1
)

const hourAngle = computed(() =>
  (now.value.getHours() % 12) * 30
  + now.value.getMinutes() * 0.5
  + now.value.getSeconds() * (0.5 / 60)
)

// ── Formatted strings ────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

const timeStr = computed(() => {
  const d = now.value
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

const utcStr = computed(() => {
  const d = now.value
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
})

const utcOffset = computed(() => {
  const off = -now.value.getTimezoneOffset() / 60
  return off >= 0 ? String(off) : String(off)
})

const longDate = computed(() =>
  now.value.toLocaleDateString('en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
)

const iso8601 = computed(() => now.value.toISOString().slice(0, 10))

const dayOfYear = computed(() => {
  const d = now.value
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return String(Math.floor(diff / 86400000)).padStart(3, '0')
})

const unixTime = computed(() => String(Math.floor(now.value.getTime() / 1000)))

const hexTime = computed(() => {
  const d = now.value
  const hh = d.getHours().toString(16).padStart(2, '0').toUpperCase()
  const mm = d.getMinutes().toString(16).padStart(2, '0').toUpperCase()
  const ss = d.getSeconds().toString(16).padStart(2, '0').toUpperCase()
  return `${hh}${mm}${ss}`
})

// Star Trek–style stardate: 1000 per year, starting TNG era (2364 = 41000)
const stardate = computed(() => {
  const d = now.value
  const year = d.getFullYear()
  const startOfYear = new Date(year, 0, 1).getTime()
  const endOfYear = new Date(year + 1, 0, 1).getTime()
  const fraction = (d.getTime() - startOfYear) / (endOfYear - startOfYear)
  const sd = (year - 1987) * 1000 + fraction * 1000
  return sd.toFixed(1).padStart(8, '0')
})
</script>

<style scoped>
/* ── Page shell ───────────────────────────────────────────────────── */

.clock-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 520px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

/* ── Header ───────────────────────────────────────────────────────── */

.clock-header {
  margin-bottom: 3rem;
}

h1 {
  font-size: clamp(2rem, 6vw, 3.5rem);
  margin: 0 0 0.5rem;
  color: var(--theme-text, #111);
  font-weight: 500;
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--theme-text-muted, #666);
  font-size: 1rem;
  margin: 0;
}

/* ── Main ─────────────────────────────────────────────────────────── */

.clock-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  flex: 1;
}

/* ── SVG Analog clock ─────────────────────────────────────────────── */

.analog-wrapper {
  width: 100%;
  max-width: 260px;
  animation: clock-enter 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.analog-face {
  width: 100%;
  height: auto;
  overflow: visible;
}

@keyframes clock-enter {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
}

/* SVG element styles */
.face-ring {
  stroke: var(--theme-card-border, rgba(0, 0, 0, 0.15));
}

.face-ring-inner {
  stroke: var(--theme-card-border, rgba(0, 0, 0, 0.06));
}

.tick-major {
  stroke: var(--theme-text, #111);
}

.tick-minor {
  stroke: var(--theme-text-subtle, #aaa);
}

.hand-hour {
  stroke: var(--theme-text, #111);
  transition: transform 0.1s ease;
}

.hand-minute {
  stroke: var(--theme-text, #111);
}

.hand-second {
  stroke: var(--theme-accent, #6b8cae);
}

.center-cap {
  fill: var(--theme-text, #111);
}

.center-cap-inner {
  fill: var(--theme-bg, #f5f5f3);
}

/* ── Info panel ───────────────────────────────────────────────────── */

.info-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
  animation: info-enter 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s both;
}

@keyframes info-enter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.info-time {
  font-size: clamp(2.5rem, 8vw, 4rem);
  font-weight: 300;
  letter-spacing: 0.04em;
  color: var(--theme-text, #111);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.info-date {
  font-size: 0.9rem;
  color: var(--theme-text-muted, #666);
  margin-bottom: 0.4rem;
}

.info-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.78rem;
}

.info-label {
  color: var(--theme-text-subtle, #aaa);
  text-transform: lowercase;
  letter-spacing: 0.04em;
  min-width: 3rem;
  text-align: right;
}

.info-value {
  color: var(--theme-text-muted, #555);
  font-variant-numeric: tabular-nums;
}

/* Space: stardate */
.info-stardate {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.stardate-label {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--theme-text-subtle, #aaa);
}

.stardate-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--theme-text, #fff);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
}

/* ── Hacker terminal display ─────────────────────────────────────── */

.hacker-terminal {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  font-family: monospace;
  animation: term-enter 0.4s steps(8) both;
}

@keyframes term-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.hacker-line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.hl-label {
  color: var(--theme-text-muted, #008F11);
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  min-width: 3.2rem;
  flex-shrink: 0;
}

.hl-sep {
  color: var(--theme-text-subtle, #555);
  font-size: 0.85rem;
}

.hl-value {
  color: var(--theme-text, #00ff41);
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}

.hl-bright {
  font-size: 1.6rem;
  text-shadow: 0 0 12px currentColor;
  letter-spacing: 0.1em;
}

.hacker-line--cursor {
  margin-top: 0.75rem;
}

.hl-prompt {
  color: var(--theme-text-muted, #008F11);
  font-size: 0.9rem;
}

.hacker-cursor {
  display: inline-block;
  color: var(--theme-text, #00ff41);
  text-shadow: 0 0 8px currentColor;
  animation: blink 1.1s step-end infinite;
  font-size: 1rem;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Hacker theme overrides ───────────────────────────────────────── */

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
  letter-spacing: 0.05em;
}

:global(.hacker-page) .subtitle {
  font-family: monospace;
  color: var(--theme-text-muted, #008F11);
}

/* ── Space theme overrides ────────────────────────────────────────── */

:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .subtitle {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
}

:global(.space-page) .face-ring {
  stroke: rgba(140, 170, 220, 0.2);
}

:global(.space-page) .face-ring-inner {
  stroke: rgba(140, 170, 220, 0.08);
}

:global(.space-page) .tick-major {
  stroke: rgba(140, 170, 220, 0.7);
}

:global(.space-page) .tick-minor {
  stroke: rgba(140, 170, 220, 0.25);
}

:global(.space-page) .hand-hour {
  stroke: var(--space-text, #fff);
}

:global(.space-page) .hand-minute {
  stroke: var(--space-text, #fff);
  opacity: 0.85;
}

:global(.space-page) .hand-second {
  stroke: var(--space-accent-amber, #e8c87a);
  filter: drop-shadow(0 0 3px var(--space-accent-amber, #e8c87a));
}

:global(.space-page) .center-cap {
  fill: var(--space-accent-blue, #89abd0);
  filter: drop-shadow(0 0 4px rgba(137, 171, 208, 0.6));
}

:global(.space-page) .center-cap-inner {
  fill: var(--space-bg, #0a0a0f);
}

:global(.space-page) .info-time {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-shadow: 0 0 30px rgba(140, 170, 220, 0.2);
}

:global(.space-page) .info-date {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.72rem;
}

:global(.space-page) .info-label {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  text-transform: uppercase;
  font-size: 0.65rem;
}

:global(.space-page) .info-value {
  font-family: monospace;
  letter-spacing: 0.08em;
}

/* ── Responsive ───────────────────────────────────────────────────── */

@media (max-width: 480px) {
  .analog-wrapper {
    max-width: 220px;
  }

  .info-time {
    font-size: clamp(2rem, 10vw, 3rem);
  }
}
</style>
