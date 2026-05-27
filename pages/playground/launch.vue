<template>
  <AlmanacFrame
    title="Launch"
    kicker="A rocket countdown with a Web Audio rumble at zero."
    back="/playground"
    backLabel="back to playground"
  >
    <main class="launch-main">

      <!-- ── Hacker: terminal launch console ───────────────────── -->
      <div
        v-if="activeTheme === 'hacker'"
        class="ht-launch"
        :class="{
          'is-counting': phase === 'counting',
          'is-ignition': phase === 'counting' && tMinus <= IGNITION_AT,
          'is-liftoff': phase === 'liftoff' || phase === 'orbit',
        }"
        aria-live="polite"
      >
        <div class="ht-cmd">
          <span class="ht-prompt">$</span> launch --target=orbit --countdown={{ COUNTDOWN_SECONDS }}
        </div>
        <pre class="ht-rocket" :class="{ 'ht-rocket--rise': phase === 'liftoff' || phase === 'orbit' }" aria-hidden="true">{{ asciiRocket }}</pre>
        <div class="ht-tminus" :aria-label="`T ${tSign} ${pad2(Math.abs(displayT))}`">
          <span class="ht-t">T{{ tSign }}{{ pad2(Math.abs(displayT)) }}</span>
        </div>
        <div class="ht-state">// {{ stateLabel }}</div>
        <div class="ht-log">
          <div v-for="entry in log" :key="entry.id" class="ht-log-line">
            <span class="ht-log-tag">[{{ entry.tag }}]</span>
            <span class="ht-log-text">{{ entry.text.toUpperCase() }}</span>
          </div>
          <div class="ht-cursor-line">
            <span class="ht-prompt">$</span><span class="ht-cursor">_</span>
          </div>
        </div>
      </div>

      <!-- ── Scandi / Space / Almanac: SVG launch scene ────────── -->
      <div
        v-else
        class="svg-launch"
        :class="{
          'is-counting': phase === 'counting',
          'is-ignition': phase === 'counting' && tMinus <= IGNITION_AT,
          'is-liftoff': phase === 'liftoff' || phase === 'orbit',
          'is-orbit': phase === 'orbit',
        }"
        aria-live="polite"
      >
        <svg viewBox="0 0 200 480" class="launch-svg" aria-hidden="true">
          <!-- Stars backdrop (subtle) -->
          <g class="stars">
            <circle
              v-for="s in STARS"
              :key="`star-${s.i}`"
              :cx="s.x"
              :cy="s.y"
              :r="s.r"
              class="star"
              :style="{ animationDelay: `${s.delay}s` }"
            />
          </g>

          <!-- Launch pad -->
          <g class="pad">
            <line x1="34" y1="380" x2="166" y2="380" class="pad-deck" />
            <line x1="55" y1="380" x2="55" y2="440" class="pad-leg" />
            <line x1="80" y1="380" x2="80" y2="446" class="pad-leg" />
            <line x1="120" y1="380" x2="120" y2="446" class="pad-leg" />
            <line x1="145" y1="380" x2="145" y2="440" class="pad-leg" />
            <line x1="30" y1="446" x2="170" y2="446" class="pad-ground" />
          </g>

          <!-- Smoke clouds (during ignition + liftoff) -->
          <g v-if="showSmoke" class="smoke">
            <circle cx="68" cy="385" r="14" class="smoke-puff smoke-puff--1" />
            <circle cx="100" cy="392" r="20" class="smoke-puff smoke-puff--2" />
            <circle cx="132" cy="385" r="15" class="smoke-puff smoke-puff--3" />
            <circle cx="52" cy="400" r="10" class="smoke-puff smoke-puff--4" />
            <circle cx="148" cy="400" r="12" class="smoke-puff smoke-puff--5" />
          </g>

          <!-- Rocket -->
          <g class="rocket">
            <!-- Flame (behind body so nozzle reads on top) -->
            <g v-if="showFlame" class="flame" :class="{ 'flame--full': phase === 'liftoff' }">
              <path d="M 88 354 Q 100 430 112 354 Z" class="flame-outer" />
              <path d="M 92 354 Q 100 405 108 354 Z" class="flame-mid" />
              <path d="M 95 354 Q 100 385 105 354 Z" class="flame-inner" />
            </g>
            <!-- Nose cone -->
            <path d="M 85 145 Q 100 60 115 145 Z" class="rk-nose" />
            <!-- Body -->
            <rect x="85" y="145" width="30" height="180" class="rk-body" />
            <!-- Window -->
            <circle cx="100" cy="190" r="7" class="rk-window" />
            <circle cx="100" cy="190" r="4" class="rk-window-inner" />
            <!-- Decorative bands -->
            <rect x="85" y="225" width="30" height="2.5" class="rk-band" />
            <rect x="85" y="290" width="30" height="2.5" class="rk-band" />
            <!-- Left fin -->
            <path d="M 85 280 L 62 358 L 85 345 Z" class="rk-fin" />
            <!-- Right fin -->
            <path d="M 115 280 L 138 358 L 115 345 Z" class="rk-fin" />
            <!-- Nozzle -->
            <path d="M 90 325 L 87 354 L 113 354 L 110 325 Z" class="rk-nozzle" />
          </g>
        </svg>

        <div class="display">
          <div class="display-tminus">
            <span class="dt-prefix">T</span><span class="dt-sign">{{ tSign }}</span><span class="dt-time">{{ pad2(Math.abs(displayT)) }}</span>
          </div>
          <div class="display-state">{{ stateLabel }}</div>
        </div>

        <ol class="log" :aria-label="logAriaLabel">
          <li v-for="entry in log" :key="entry.id" class="log-entry">
            <span class="log-tag">{{ entry.tag }}</span>
            <span class="log-text">{{ formatLogText(entry.text) }}</span>
          </li>
        </ol>
      </div>

      <!-- ── Controls ──────────────────────────────────────────── -->
      <div class="controls" role="group" aria-label="Launch controls">
        <button
          v-if="phase === 'counting'"
          class="ctrl ctrl--main ctrl--abort"
          @click="abort"
          aria-label="Abort launch sequence"
        >
          <span>{{ abortLabel }}</span>
        </button>
        <button
          v-else
          class="ctrl ctrl--main"
          @click="startCountdown"
          :disabled="phase === 'liftoff'"
          :aria-label="phase === 'orbit' ? 'Launch again' : 'Begin launch sequence'"
        >
          <span aria-hidden="true">▲</span>
          <span class="ctrl-label">{{ phase === 'orbit' ? againLabel : launchLabel }}</span>
        </button>
        <button
          class="ctrl ctrl--sec"
          @click="resetAll"
          :disabled="phase === 'liftoff'"
          :aria-label="`Reset ${pageTitle}`"
          title="Reset"
        >↺</button>
        <button
          class="option-btn"
          :class="{ 'option-btn--active': soundEnabled }"
          @click="soundEnabled = !soundEnabled"
          :aria-label="soundEnabled ? 'Mute launch sounds' : 'Enable launch sounds'"
          :aria-pressed="soundEnabled"
          :title="soundEnabled ? 'Sound on' : 'Sound off'"
        >
          <span aria-hidden="true">{{ soundEnabled ? '🔊' : '🔇' }}</span>
        </button>
      </div>

      <div class="kbd-hints" aria-hidden="true">
        <span class="kbd-hint"><kbd>Space</kbd> launch / abort</span>
        <span class="kbd-hint"><kbd>R</kbd> reset</span>
      </div>

    </main>
  </AlmanacFrame>
</template>

<script setup lang="ts">
const { activeTheme } = useTheme()

// ── Constants ─────────────────────────────────────────────────

const COUNTDOWN_SECONDS = 10
const IGNITION_AT = 3
const LIFTOFF_DURATION_MS = 3200
const LOG_VISIBLE = 7

type Phase = 'idle' | 'counting' | 'liftoff' | 'orbit'

// Deterministic star field — generated once, not random per render
const STARS = Array.from({ length: 22 }, (_, i) => {
  // Hash-y but deterministic distribution
  const x = (i * 37 + 19) % 200
  const y = ((i * 53 + 11) % 340) + 20
  const r = i % 5 === 0 ? 1.4 : 0.7
  return { i, x, y, r, delay: (i * 0.27) % 3 }
})

const COUNT_PHRASES: Record<number, string> = {
  10: 'all systems nominal',
  9: 'gantry retracting',
  8: 'internal power',
  7: 'tanks pressurized',
  6: 'guidance is internal',
  5: 'auto-sequence start',
  4: 'engines armed',
  3: 'ignition sequence',
  2: 'mainstage thrust',
  1: 'clamps release',
}

const LIFTOFF_PHRASE = 'liftoff'
const ORBIT_PHRASE = 'orbit achieved'
const ABORT_PHRASE = 'sequence aborted'

const asciiRocket = `       /\\
      /  \\
     /    \\
     |    |
     | () |
     |    |
    /|    |\\
   / |    | \\
  /__|____|__\\
     /\\/\\
     \\/\\/`

// ── State ─────────────────────────────────────────────────────

const phase = ref<Phase>('idle')
const tMinus = ref(COUNTDOWN_SECONDS)
const liftoffElapsed = ref(0)
const log = ref<{ id: number; tag: string; text: string }[]>([])
let logSeq = 0

const soundEnabled = ref(import.meta.client ? localStorage.getItem('launch-sound') !== '0' : true)
watch(soundEnabled, v => { if (import.meta.client) localStorage.setItem('launch-sound', v ? '1' : '0') })

let countTimer: ReturnType<typeof setInterval> | null = null
let liftoffTickTimer: ReturnType<typeof setInterval> | null = null
let liftoffEndTimer: ReturnType<typeof setTimeout> | null = null

const pad2 = (n: number) => String(n).padStart(2, '0')

const docTitle = computed(() => {
  if (phase.value === 'counting') return `T-${pad2(tMinus.value)} · launch — phareim.no`
  if (phase.value === 'liftoff') return `liftoff — phareim.no`
  if (phase.value === 'orbit') return `orbit — phareim.no`
  return 'launch — phareim.no'
})
useHead({ title: docTitle })

// ── Derived ───────────────────────────────────────────────────

const showFlame = computed(() =>
  phase.value === 'liftoff' ||
  (phase.value === 'counting' && tMinus.value <= IGNITION_AT && tMinus.value > 0)
)
const showSmoke = computed(() =>
  phase.value === 'liftoff' ||
  phase.value === 'orbit' ||
  (phase.value === 'counting' && tMinus.value <= IGNITION_AT && tMinus.value > 0)
)

const displayT = computed(() => {
  if (phase.value === 'counting') return tMinus.value
  if (phase.value === 'liftoff' || phase.value === 'orbit') return Math.floor(liftoffElapsed.value)
  return COUNTDOWN_SECONDS
})

const tSign = computed(() => {
  if (phase.value === 'liftoff' || phase.value === 'orbit') return '+'
  return '−'
})

const pageTitle = computed(() => {
  if (activeTheme.value === 'hacker') return 'launch.exe'
  if (activeTheme.value === 'space') return 'LAUNCH CONTROL'
  return 'launch'
})

const stateLabel = computed(() => {
  const themeKey = activeTheme.value === 'hacker' ? 'hacker' :
                   activeTheme.value === 'space' ? 'space' : 'scandi'
  const labels: Record<Phase, Record<string, string>> = {
    idle:     { scandi: 'ready on the pad', hacker: 'STATUS: STANDBY', space: 'READY ON THE PAD' },
    counting: { scandi: 'counting down',     hacker: 'STATUS: COUNTDOWN', space: 'COUNTDOWN' },
    liftoff:  { scandi: 'we have liftoff',   hacker: 'STATUS: LIFTOFF', space: 'LIFTOFF — TOWER CLEAR' },
    orbit:    { scandi: 'in orbit',          hacker: 'STATUS: ORBITAL', space: 'ORBITAL INSERTION COMPLETE' },
  }
  return labels[phase.value][themeKey]
})

const launchLabel = computed(() => {
  if (activeTheme.value === 'hacker') return 'execute'
  if (activeTheme.value === 'space') return 'LAUNCH'
  return 'launch'
})

const abortLabel = computed(() => {
  if (activeTheme.value === 'hacker') return 'abort'
  if (activeTheme.value === 'space') return 'ABORT'
  return 'abort'
})

const againLabel = computed(() => {
  if (activeTheme.value === 'hacker') return 're-run'
  if (activeTheme.value === 'space') return 'NEW LAUNCH'
  return 'launch again'
})

const logAriaLabel = computed(() => `Launch sequence transcript, ${log.value.length} entries`)

function formatLogText(text: string) {
  if (activeTheme.value === 'hacker' || activeTheme.value === 'space') return text.toUpperCase()
  return text
}

// ── Helpers ───────────────────────────────────────────────────

function pushLog(tag: string, text: string) {
  logSeq += 1
  const next = [...log.value, { id: logSeq, tag, text }]
  log.value = next.length > LOG_VISIBLE ? next.slice(-LOG_VISIBLE) : next
}

// ── Audio ─────────────────────────────────────────────────────

function getAudioCtx(): AudioContext | null {
  if (!import.meta.client) return null
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    return new Ctor() as AudioContext
  } catch {
    return null
  }
}

function playBeep(freq: number, duration = 0.1, peak = 0.18) {
  if (!soundEnabled.value) return
  const ctx = getAudioCtx()
  if (!ctx) return
  const t = ctx.currentTime + 0.01
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(peak, t + 0.01)
  gain.gain.linearRampToValueAtTime(0, t + duration)
  osc.start(t)
  osc.stop(t + duration + 0.05)
  setTimeout(() => ctx.close(), (duration + 0.2) * 1000)
}

function playRumble() {
  if (!soundEnabled.value) return
  const ctx = getAudioCtx()
  if (!ctx) return
  const t = ctx.currentTime + 0.01
  const duration = 2.2

  // Sweep low oscillator from 80Hz to 35Hz
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(80, t)
  osc.frequency.exponentialRampToValueAtTime(35, t + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.22, t + 0.15)
  gain.gain.linearRampToValueAtTime(0.18, t + duration - 0.5)
  gain.gain.linearRampToValueAtTime(0, t + duration)
  osc.start(t)
  osc.stop(t + duration + 0.05)

  // Noise burst overlay for thrust texture
  try {
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.5
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0, t)
    noiseGain.gain.linearRampToValueAtTime(0.08, t + 0.2)
    noiseGain.gain.linearRampToValueAtTime(0, t + duration)
    noise.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(t)
    noise.stop(t + duration)
  } catch {
    // ignore noise failures
  }

  setTimeout(() => ctx.close(), (duration + 0.3) * 1000)
}

function playOrbitChord() {
  if (!soundEnabled.value) return
  const ctx = getAudioCtx()
  if (!ctx) return
  const notes = [523, 659, 784, 988]
  const duration = 0.24
  const gap = 0.16
  const startTime = ctx.currentTime + 0.05
  notes.forEach((freq, i) => {
    const t = startTime + i * gap
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
    gain.gain.linearRampToValueAtTime(0, t + duration)
    osc.start(t)
    osc.stop(t + duration)
  })
  setTimeout(() => ctx.close(), (notes.length * gap + duration + 0.3) * 1000)
}

// ── Sequence ──────────────────────────────────────────────────

function clearAllTimers() {
  if (countTimer !== null) { clearInterval(countTimer); countTimer = null }
  if (liftoffTickTimer !== null) { clearInterval(liftoffTickTimer); liftoffTickTimer = null }
  if (liftoffEndTimer !== null) { clearTimeout(liftoffEndTimer); liftoffEndTimer = null }
}

function startCountdown() {
  if (phase.value === 'counting' || phase.value === 'liftoff') return
  clearAllTimers()
  log.value = []
  tMinus.value = COUNTDOWN_SECONDS
  liftoffElapsed.value = 0
  phase.value = 'counting'

  pushLog(`T-${COUNTDOWN_SECONDS}`, COUNT_PHRASES[COUNTDOWN_SECONDS])
  playBeep(660, 0.08, 0.16)

  countTimer = setInterval(() => {
    tMinus.value -= 1
    if (tMinus.value > 0) {
      const phrase = COUNT_PHRASES[tMinus.value] ?? ''
      pushLog(`T-${tMinus.value}`, phrase)
      const freq = tMinus.value <= IGNITION_AT ? 880 : 660
      playBeep(freq, 0.1, 0.18)
    } else {
      if (countTimer !== null) { clearInterval(countTimer); countTimer = null }
      beginLiftoff()
    }
  }, 1000)
}

function beginLiftoff() {
  phase.value = 'liftoff'
  liftoffElapsed.value = 0
  pushLog('T+00', LIFTOFF_PHRASE)
  playRumble()

  liftoffTickTimer = setInterval(() => {
    liftoffElapsed.value = Math.min(liftoffElapsed.value + 0.1, LIFTOFF_DURATION_MS / 1000)
  }, 100)

  liftoffEndTimer = setTimeout(() => {
    if (liftoffTickTimer !== null) { clearInterval(liftoffTickTimer); liftoffTickTimer = null }
    phase.value = 'orbit'
    pushLog('ORB', ORBIT_PHRASE)
    playOrbitChord()
  }, LIFTOFF_DURATION_MS)
}

function abort() {
  if (phase.value !== 'counting') return
  clearAllTimers()
  pushLog('ABT', ABORT_PHRASE)
  phase.value = 'idle'
  tMinus.value = COUNTDOWN_SECONDS
  playBeep(220, 0.4, 0.18)
}

function resetAll() {
  if (phase.value === 'liftoff') return
  clearAllTimers()
  phase.value = 'idle'
  tMinus.value = COUNTDOWN_SECONDS
  liftoffElapsed.value = 0
  log.value = []
}

// ── Keyboard ──────────────────────────────────────────────────

function onKey(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement | null)?.tagName ?? ''
  if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(tag)) return
  if (event.metaKey || event.ctrlKey || event.altKey) return

  switch (event.key) {
    case ' ':
      event.preventDefault()
      if (phase.value === 'counting') abort()
      else if (phase.value !== 'liftoff') startCountdown()
      break
    case 'r':
    case 'R':
      event.preventDefault()
      resetAll()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  clearAllTimers()
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────── */

.launch-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

/* ── SVG scene ──────────────────────────────────────────────── */

.svg-launch {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.launch-svg {
  width: 100%;
  max-width: 320px;
  height: auto;
  display: block;
  overflow: visible;
}

/* Stars */
.star {
  fill: var(--theme-text-subtle, #aaa);
  opacity: 0.35;
  animation: star-twinkle 3.5s ease-in-out infinite;
}

@keyframes star-twinkle {
  0%, 100% { opacity: 0.2; }
  50%       { opacity: 0.55; }
}

/* Pad */
.pad-deck {
  stroke: var(--theme-text-muted, #666);
  stroke-width: 2;
  stroke-linecap: round;
}

.pad-leg {
  stroke: var(--theme-text-subtle, #aaa);
  stroke-width: 1.2;
  stroke-linecap: round;
}

.pad-ground {
  stroke: var(--theme-text-muted, #666);
  stroke-width: 1;
  stroke-linecap: round;
  opacity: 0.6;
}

/* Rocket */
.rocket {
  transform-origin: 100px 250px;
  will-change: transform;
}

.svg-launch.is-counting.is-ignition .rocket {
  animation: rocket-shudder 0.18s ease-in-out infinite;
}

.svg-launch.is-liftoff .rocket {
  animation: rocket-rise 3.2s cubic-bezier(0.55, 0.05, 0.7, 0.18) forwards;
}

@keyframes rocket-shudder {
  0%, 100% { transform: translate(0, 0); }
  25%       { transform: translate(-0.6px, 0.3px); }
  75%       { transform: translate(0.6px, -0.3px); }
}

@keyframes rocket-rise {
  0%   { transform: translateY(0); }
  3%   { transform: translateY(-2px); }
  6%   { transform: translateY(0); }
  10%  { transform: translateY(-8px); }
  35%  { transform: translateY(-90px); }
  100% { transform: translateY(-540px); }
}

@media (prefers-reduced-motion: reduce) {
  .svg-launch.is-counting.is-ignition .rocket {
    animation: none;
  }
  .svg-launch.is-liftoff .rocket {
    animation: rocket-rise-soft 1.6s ease-out forwards;
  }
  .star {
    animation: none;
    opacity: 0.4;
  }
}

@keyframes rocket-rise-soft {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-540px); }
}

.rk-nose {
  fill: var(--theme-text, #111);
}

.rk-body {
  fill: var(--theme-card-bg, rgba(255, 255, 255, 0.85));
  stroke: var(--theme-text, #111);
  stroke-width: 1.4;
}

.rk-window {
  fill: var(--theme-accent, #6b8cae);
  opacity: 0.85;
}

.rk-window-inner {
  fill: var(--theme-bg, #fafaf7);
  opacity: 0.75;
}

.rk-band {
  fill: var(--theme-text, #111);
  opacity: 0.55;
}

.rk-fin {
  fill: var(--theme-text, #111);
}

.rk-nozzle {
  fill: var(--theme-text-muted, #555);
}

/* Flame */
.flame-outer {
  fill: var(--theme-accent, #d97a4a);
  opacity: 0.85;
  animation: flame-flicker 0.12s ease-in-out infinite;
  transform-origin: 100px 354px;
}

.flame-mid {
  fill: #ffb04a;
  opacity: 0.92;
  animation: flame-flicker 0.09s ease-in-out infinite;
  transform-origin: 100px 354px;
}

.flame-inner {
  fill: #fff1c9;
  opacity: 0.98;
  animation: flame-flicker 0.07s ease-in-out infinite;
  transform-origin: 100px 354px;
}

.flame--full .flame-outer,
.flame--full .flame-mid,
.flame--full .flame-inner {
  animation-duration: 0.06s;
}

@keyframes flame-flicker {
  0%, 100% { transform: scaleY(1) scaleX(1); }
  50%       { transform: scaleY(1.18) scaleX(0.92); }
}

@media (prefers-reduced-motion: reduce) {
  .flame-outer, .flame-mid, .flame-inner {
    animation: none;
  }
}

/* Smoke */
.smoke-puff {
  fill: var(--theme-text-subtle, #aaa);
  opacity: 0.55;
  animation: smoke-puff 1.6s ease-out infinite;
  transform-origin: center;
}

.smoke-puff--1 { animation-delay: 0s; }
.smoke-puff--2 { animation-delay: 0.2s; }
.smoke-puff--3 { animation-delay: 0.4s; }
.smoke-puff--4 { animation-delay: 0.1s; }
.smoke-puff--5 { animation-delay: 0.3s; }

@keyframes smoke-puff {
  0%   { transform: scale(0.6) translateY(0); opacity: 0.7; }
  100% { transform: scale(1.6) translateY(8px); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .smoke-puff {
    animation: none;
    opacity: 0.4;
  }
}

/* ── Display readout ────────────────────────────────────────── */

.display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.display-tminus {
  display: flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
  font-size: clamp(2.2rem, 7vw, 3.2rem);
  font-weight: 300;
  letter-spacing: 0.05em;
  color: var(--theme-text, #111);
  line-height: 1;
}

.dt-prefix {
  font-size: 0.55em;
  color: var(--theme-text-muted, #666);
  margin-right: 0.1em;
}

.dt-sign {
  font-size: 0.85em;
  margin-right: 0.05em;
  color: var(--theme-text-muted, #666);
}

.svg-launch.is-liftoff .dt-sign,
.svg-launch.is-orbit .dt-sign {
  color: var(--theme-accent, #6b8cae);
}

.display-state {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--theme-text-subtle, #aaa);
}

.svg-launch.is-counting.is-ignition .display-state,
.svg-launch.is-liftoff .display-state {
  color: var(--theme-accent, #6b8cae);
}

/* ── Log ────────────────────────────────────────────────────── */

.log {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 7.5rem;
}

.log-entry {
  display: grid;
  grid-template-columns: 3.2rem 1fr;
  gap: 0.6rem;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: var(--theme-text-muted, #666);
  animation: log-enter 0.25s ease-out;
}

.log-tag {
  color: var(--theme-text-subtle, #aaa);
  font-weight: 500;
  text-align: right;
}

.log-text {
  color: var(--theme-text, #111);
}

@keyframes log-enter {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .log-entry { animation: none; }
}

/* ── Controls ───────────────────────────────────────────────── */

.controls {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 0.5rem;
}

.ctrl {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
}

.ctrl:active {
  transform: scale(0.94);
}

.ctrl:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 3px;
}

.ctrl:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ctrl--main {
  padding: 0.75rem 1.8rem;
  border-radius: 999px;
  background: var(--theme-accent, #6b8cae);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--theme-accent, #6b8cae) 30%, transparent);
  min-width: 10rem;
  text-transform: uppercase;
}

.ctrl--main:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 6px 24px color-mix(in srgb, var(--theme-accent, #6b8cae) 45%, transparent);
}

.ctrl--abort {
  background: #b14a4a;
  box-shadow: 0 4px 16px rgba(177, 74, 74, 0.3);
}

.ctrl--abort:hover:not(:disabled) {
  box-shadow: 0 6px 24px rgba(177, 74, 74, 0.45);
}

.ctrl--sec {
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 50%;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  color: var(--theme-text-muted, #666);
  font-size: 1rem;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.ctrl--sec:hover:not(:disabled) {
  color: var(--theme-text, #111);
  border-color: var(--theme-accent, #6b8cae);
}

.ctrl-label {
  font-size: 0.88rem;
}

/* ── Sound toggle ───────────────────────────────────────────── */

.option-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.38;
  transition: opacity 0.2s ease;
  padding: 0;
}

.option-btn--active {
  opacity: 0.9;
}

.option-btn:hover {
  opacity: 1;
}

.option-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 4px;
}

/* ── Keyboard hints ─────────────────────────────────────────── */

.kbd-hints {
  display: flex;
  gap: 1.25rem;
  justify-content: center;
  flex-wrap: wrap;
}

.kbd-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #aaa);
}

.kbd-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.3rem;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--theme-text-muted, #666);
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
  border-radius: 4px;
  box-shadow: 0 1px 0 var(--theme-card-border, rgba(0, 0, 0, 0.15));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  line-height: 1;
}

/* ── Hacker terminal launch console ─────────────────────────── */

.ht-launch {
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-family: monospace;
  animation: term-enter 0.3s steps(6) both;
}

@keyframes term-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.ht-cmd {
  font-size: 0.78rem;
  color: var(--theme-text-muted, #008F11);
}

.ht-prompt {
  color: var(--theme-text-muted, #008F11);
  margin-right: 0.3rem;
}

.ht-rocket {
  margin: 0.4rem 0;
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.05;
  color: var(--theme-text, #00ff41);
  text-shadow: 0 0 8px currentColor;
  white-space: pre;
  letter-spacing: 0.04em;
  align-self: center;
  transition: text-shadow 0.2s ease;
}

.ht-launch.is-ignition .ht-rocket {
  text-shadow: 0 0 16px currentColor, 0 0 32px currentColor;
}

.ht-rocket--rise {
  animation: ht-rocket-rise 3.2s cubic-bezier(0.55, 0.05, 0.7, 0.18) forwards;
}

@keyframes ht-rocket-rise {
  0%   { transform: translateY(0); opacity: 1; }
  10%  { transform: translateY(-6px); }
  100% { transform: translateY(-420px); opacity: 0.1; }
}

@media (prefers-reduced-motion: reduce) {
  .ht-rocket--rise {
    animation: ht-rocket-rise-soft 1.6s ease-out forwards;
  }
}

@keyframes ht-rocket-rise-soft {
  0%   { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-200px); opacity: 0.1; }
}

.ht-tminus {
  font-size: clamp(2.8rem, 11vw, 4.4rem);
  font-variant-numeric: tabular-nums;
  color: var(--theme-text, #00ff41);
  text-shadow: 0 0 18px currentColor;
  letter-spacing: 0.08em;
  line-height: 1;
  margin-top: 0.3rem;
}

.ht-launch.is-ignition .ht-tminus {
  animation: ht-flicker 0.6s ease-in-out infinite;
}

@keyframes ht-flicker {
  0%, 100% { text-shadow: 0 0 18px currentColor; }
  50%       { text-shadow: 0 0 36px currentColor, 0 0 72px currentColor; }
}

.ht-state {
  font-size: 0.78rem;
  color: var(--theme-text-muted, #008F11);
  letter-spacing: 0.04em;
}

.ht-log {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  margin-top: 0.5rem;
  font-size: 0.78rem;
  min-height: 7rem;
}

.ht-log-line {
  display: grid;
  grid-template-columns: 3.6rem 1fr;
  gap: 0.6rem;
  animation: log-enter 0.2s ease-out;
}

.ht-log-tag {
  color: var(--theme-text-muted, #008F11);
}

.ht-log-text {
  color: var(--theme-text, #00ff41);
  text-shadow: 0 0 6px currentColor;
}

.ht-cursor-line {
  margin-top: 0.4rem;
  display: flex;
  align-items: center;
}

.ht-cursor {
  display: inline-block;
  color: var(--theme-text, #00ff41);
  text-shadow: 0 0 8px currentColor;
  animation: ht-blink 1.1s step-end infinite;
}

@keyframes ht-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Hacker overrides ───────────────────────────────────────── */

:global(.hacker-page) .ctrl--main {
  border-radius: 0;
  font-family: monospace;
  letter-spacing: 0.1em;
  background: var(--theme-text, #00ff41);
  color: var(--theme-bg, #0a0a0a);
  box-shadow: 0 0 16px var(--theme-text, #00ff41);
}

:global(.hacker-page) .ctrl--main:hover:not(:disabled) {
  box-shadow: 0 0 28px var(--theme-text, #00ff41);
}

:global(.hacker-page) .ctrl--abort {
  background: #ff4646;
  color: #0a0a0a;
  box-shadow: 0 0 16px #ff4646;
}

:global(.hacker-page) .ctrl--abort:hover:not(:disabled) {
  box-shadow: 0 0 28px #ff4646;
}

:global(.hacker-page) .ctrl--sec {
  border-radius: 0;
  font-family: monospace;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  background: rgba(0, 20, 0, 0.8);
  border-color: var(--theme-text-muted, #008F11);
  color: var(--theme-text, #00ff41);
}

:global(.hacker-page) .kbd-hints {
  font-family: monospace;
}

:global(.hacker-page) .kbd-hint kbd {
  border-radius: 0;
  color: var(--theme-text-muted, #008F11);
  background: rgba(0, 20, 0, 0.8);
  border-color: var(--theme-text-muted, #008F11);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* ── Space overrides ────────────────────────────────────────── */

:global(.space-page) .ctrl--main {
  border-radius: 0;
  background: var(--space-accent-amber, #e8c87a);
  color: var(--space-bg, #0a0a0f);
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  letter-spacing: 0.1em;
  box-shadow: 0 4px 20px rgba(232, 200, 122, 0.3);
}

:global(.space-page) .ctrl--main:hover:not(:disabled) {
  box-shadow: 0 6px 32px rgba(232, 200, 122, 0.5);
}

:global(.space-page) .ctrl--abort {
  background: #d96a6a;
  box-shadow: 0 4px 20px rgba(217, 106, 106, 0.4);
}

:global(.space-page) .ctrl--sec {
  border-radius: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.space-page) .rk-window {
  fill: var(--space-accent-amber, #e8c87a);
}

:global(.space-page) .rk-window-inner {
  fill: rgba(255, 240, 200, 0.85);
}

:global(.space-page) .flame-outer {
  fill: var(--space-accent-amber, #e8c87a);
  filter: drop-shadow(0 0 6px rgba(232, 200, 122, 0.65));
}

:global(.space-page) .display-tminus {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-shadow: 0 0 24px rgba(140, 170, 220, 0.4);
}

:global(.space-page) .display-state {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
}

:global(.space-page) .log-entry {
  font-family: var(--font-space-mono, ui-monospace, SFMono-Regular, monospace);
  letter-spacing: 0.04em;
}

:global(.space-page) .log-tag {
  color: var(--space-accent-amber, #e8c87a);
  opacity: 0.85;
}

:global(.space-page) .kbd-hint kbd {
  border-radius: 0;
  background: rgba(15, 15, 30, 0.7);
  border-color: rgba(140, 170, 220, 0.2);
  box-shadow: 0 1px 0 rgba(140, 170, 220, 0.15);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* ── Almanac: stay quiet, lean on theme vars ──────────────── */

:global(.almanac-page) .rk-window {
  fill: var(--theme-accent, #d4a574);
}

:global(.almanac-page) .ctrl--main {
  border-radius: 0;
}

:global(.almanac-page) .ctrl--sec {
  border-radius: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.almanac-page) .kbd-hint kbd {
  border-radius: 2px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* ── Responsive ─────────────────────────────────────────────── */

@media (max-width: 400px) {
  .launch-svg {
    max-width: 260px;
  }

  .ctrl--main {
    min-width: 8.5rem;
    padding: 0.65rem 1.4rem;
  }

  .log {
    max-width: 260px;
  }
}
</style>
