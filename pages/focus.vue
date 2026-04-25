<template>
  <div class="focus-page">
    <header class="focus-header">
      <h1>{{ pageTitle }}</h1>
      <p class="subtitle">{{ pageSubtitle }}</p>
    </header>

    <main class="focus-main">

      <!-- ── Mode tabs ──────────────────────────────────────── -->
      <div class="mode-tabs" role="tablist" aria-label="Timer mode">
        <button
          v-for="m in modeList"
          :key="m.key"
          role="tab"
          :aria-selected="currentMode === m.key"
          :class="['mode-tab', { 'mode-tab--active': currentMode === m.key }]"
          @click="selectMode(m.key)"
        >{{ m.label }}</button>
      </div>

      <!-- ── Hacker: terminal display ───────────────────────── -->
      <div
        v-if="activeTheme === 'hacker'"
        class="hacker-timer"
        aria-live="polite"
        :aria-label="`${formattedTime} remaining`"
      >
        <div class="ht-cmd">
          <span class="ht-prompt">$</span> pomodoro --mode={{ currentMode }} --session={{ sessionCount + 1 }}
        </div>
        <div class="ht-time" :class="{ 'ht-time--pulse': justCompleted }">{{ formattedTime }}</div>
        <div class="ht-bar-wrap">
          <div class="ht-bar" aria-hidden="true">
            <div class="ht-bar-fill" :style="{ width: progressPct + '%' }"></div>
          </div>
          <span class="ht-pct">{{ Math.round(progressPct) }}%</span>
        </div>
        <div class="ht-info">
          <span>sessions: {{ sessionCount }}/{{ SESSIONS_BEFORE_LONG }}</span>
          <span v-if="isRunning" class="ht-running">running</span>
          <span v-else class="ht-paused">paused</span>
        </div>
        <div class="ht-cursor-line">
          <span class="ht-prompt">$</span><span class="ht-cursor">_</span>
        </div>
      </div>

      <!-- ── Scandi + Space: SVG ring ───────────────────────── -->
      <div
        v-else
        class="ring-area"
        aria-live="polite"
        :aria-label="`${formattedTime} remaining`"
      >
        <svg viewBox="0 0 220 220" class="timer-svg" aria-hidden="true">
          <!-- Tick marks -->
          <g class="ring-ticks">
            <line
              v-for="tick in RING_TICKS"
              :key="tick.i"
              :x1="tick.x1" :y1="tick.y1"
              :x2="tick.x2" :y2="tick.y2"
              :class="tick.major ? 'tick-major' : 'tick-minor'"
            />
          </g>
          <!-- Background track -->
          <circle cx="110" cy="110" r="96" fill="none" class="ring-track" stroke-width="8" />
          <!-- Completion flash ring -->
          <circle
            v-if="justCompleted"
            cx="110" cy="110" r="96" fill="none" class="ring-flash"
            stroke-width="8"
          />
          <!-- Progress arc -->
          <circle
            cx="110" cy="110" r="96" fill="none"
            class="ring-progress"
            stroke-width="8"
            stroke-linecap="round"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="progressOffset"
            transform="rotate(-90 110 110)"
          />
        </svg>
        <div class="ring-inner">
          <span class="ring-mode-label">{{ activeModeConfig.label }}</span>
          <span class="ring-time" :class="{ 'ring-time--tick': secondPulse }">{{ formattedTime }}</span>
          <span class="ring-status">{{ isRunning ? runningLabel : pausedLabel }}</span>
        </div>
      </div>

      <!-- ── Controls ───────────────────────────────────────── -->
      <div class="controls" role="group" aria-label="Timer controls">
        <button
          class="ctrl ctrl--sec"
          @click="resetTimer"
          :aria-label="`Reset ${activeModeConfig.label} timer`"
          title="Reset"
        >↺</button>
        <button
          class="ctrl ctrl--main"
          @click="toggleTimer"
          :aria-label="isRunning ? 'Pause timer' : 'Start timer'"
          title="Space"
        >
          <span aria-hidden="true">{{ isRunning ? '⏸' : '▶' }}</span>
          <span class="ctrl-label">{{ isRunning ? pauseLabel : startLabel }}</span>
        </button>
        <button
          class="ctrl ctrl--sec"
          @click="skipMode"
          aria-label="Skip to next phase"
          title="Skip"
        >⏭</button>
      </div>

      <!-- ── Options row (sound + notifications) ───────────────── -->
      <div class="option-row" role="group" aria-label="Timer options">
        <button
          class="option-btn"
          @click="soundEnabled = !soundEnabled"
          :aria-label="soundEnabled ? 'Mute completion sound' : 'Enable completion sound'"
          :title="soundEnabled ? 'Sound on' : 'Sound off'"
        >
          <span aria-hidden="true">{{ soundEnabled ? '🔊' : '🔇' }}</span>
        </button>

        <button
          v-if="notifSupported && notifPermission !== 'denied'"
          class="option-btn"
          @click="toggleNotif"
          :aria-label="notifEnabled ? 'Disable desktop notifications' : 'Enable desktop notifications when timer ends'"
          :title="notifEnabled ? 'Notifications on' : 'Notifications off (click to enable)'"
        >
          <span aria-hidden="true">{{ notifEnabled ? '🔔' : '🔕' }}</span>
        </button>
      </div>

      <!-- ── Keyboard hints ───────────────────────────────────── -->
      <div class="kbd-hints" aria-hidden="true">
        <span class="kbd-hint"><kbd>Space</kbd> play / pause</span>
        <span class="kbd-hint"><kbd>R</kbd> reset</span>
        <span class="kbd-hint"><kbd>S</kbd> skip</span>
      </div>

      <!-- ── Session dots ───────────────────────────────────── -->
      <div class="session-dots" role="status">
        <span
          v-for="i in SESSIONS_BEFORE_LONG"
          :key="i"
          class="sdot"
          :class="{ 'sdot--done': i <= sessionCount }"
          aria-hidden="true"
        ></span>
        <span class="sr-only">{{ sessionCount }} of {{ SESSIONS_BEFORE_LONG }} focus sessions completed</span>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
const { activeTheme } = useTheme()

const docTitle = computed(() => {
  if (isRunning.value) return `${formattedTime.value} · focus — phareim.no`
  return 'focus — phareim.no'
})
useHead({ title: docTitle })

// ── Constants ──────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 96 // ≈ 603.19

// Static tick positions: 60 marks around the ring, 4 major marks at quarters
const RING_TICKS = Array.from({ length: 60 }, (_, i) => {
  const angle = (i / 60) * Math.PI * 2 - Math.PI / 2
  const major = i % 15 === 0
  const r1 = major ? 101 : 102
  const r2 = major ? 110 : 107
  return {
    i,
    major,
    x1: +(110 + Math.cos(angle) * r1).toFixed(2),
    y1: +(110 + Math.sin(angle) * r1).toFixed(2),
    x2: +(110 + Math.cos(angle) * r2).toFixed(2),
    y2: +(110 + Math.sin(angle) * r2).toFixed(2),
  }
})

const SESSIONS_BEFORE_LONG = 4

type ModeKey = 'focus' | 'short' | 'long'

interface ModeConfig {
  seconds: number
  label: string
  hackerLabel: string
  spaceLabel: string
}

const MODES: Record<ModeKey, ModeConfig> = {
  focus: { seconds: 25 * 60, label: 'focus',       hackerLabel: 'work',  spaceLabel: 'MISSION'  },
  short: { seconds:  5 * 60, label: 'short break',  hackerLabel: 'break', spaceLabel: 'STANDBY'  },
  long:  { seconds: 15 * 60, label: 'long break',   hackerLabel: 'rest',  spaceLabel: 'REST'     },
}

// ── State ──────────────────────────────────────────────────────────────

const currentMode = ref<ModeKey>('focus')
const timeLeft = ref(MODES.focus.seconds)
const isRunning = ref(false)
const sessionCount = ref(0)
const justCompleted = ref(false)
const secondPulse = ref(false)

let ticker: ReturnType<typeof setInterval> | null = null
let flashTimer: ReturnType<typeof setTimeout> | null = null

// ── Audio ──────────────────────────────────────────────────────────────

const soundEnabled = ref(true)

// ── Notifications ──────────────────────────────────────────────────────

const notifSupported = ref(false)
const notifEnabled = ref(false)
const notifPermission = ref<NotificationPermission>('default')

async function toggleNotif() {
  if (!notifSupported.value) return
  if (notifEnabled.value) {
    notifEnabled.value = false
    localStorage.setItem('focus-notif', '0')
    return
  }
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission()
    notifPermission.value = result
    if (result !== 'granted') return
  }
  notifEnabled.value = true
  localStorage.setItem('focus-notif', '1')
}

function sendNotification(wasFocus: boolean) {
  if (!notifEnabled.value || !notifSupported.value || Notification.permission !== 'granted') return
  if (!document.hidden) return

  const title = wasFocus
    ? (activeTheme.value === 'hacker' ? 'BREAK INITIATED' : activeTheme.value === 'space' ? 'PHASE COMPLETE' : 'focus session done')
    : (activeTheme.value === 'hacker' ? 'RESUME WORK.EXE' : activeTheme.value === 'space' ? 'FOCUS PROTOCOL ENGAGED' : 'break over — back to work')

  const body = wasFocus
    ? (activeTheme.value === 'hacker' ? '> rest.exe running...' : activeTheme.value === 'space' ? 'Standby mode engaged.' : 'Take a short break ☕')
    : (activeTheme.value === 'hacker' ? '> focus.exe ready' : activeTheme.value === 'space' ? 'Begin next mission.' : 'Ready to focus? 🎯')

  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'focus-timer' })
  } catch {
    // Blocked in sandboxed contexts
  }
}

function playCompletionSound(isFocusComplete: boolean) {
  if (!soundEnabled.value) return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx() as AudioContext

    // Focus done → break: ascending C-E-G triad
    // Break done → focus: descending E-C
    const notes = isFocusComplete ? [523, 659, 784] : [659, 523]
    const duration = 0.18
    const gap = 0.22
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
      gain.gain.linearRampToValueAtTime(0.28, t + 0.01)
      gain.gain.linearRampToValueAtTime(0, t + duration)
      osc.start(t)
      osc.stop(t + duration)
    })

    setTimeout(() => ctx.close(), (notes.length * gap + duration + 0.2) * 1000)
  } catch {
    // Web Audio API unavailable
  }
}

// ── Derived ────────────────────────────────────────────────────────────

const activeModeConfig = computed(() => MODES[currentMode.value])
const totalSeconds = computed(() => activeModeConfig.value.seconds)

const progressPct = computed(
  () => ((totalSeconds.value - timeLeft.value) / totalSeconds.value) * 100
)

const progressOffset = computed(
  () => CIRCUMFERENCE * (timeLeft.value / totalSeconds.value)
)

const pad = (n: number) => String(n).padStart(2, '0')

const formattedTime = computed(() => {
  const m = Math.floor(timeLeft.value / 60)
  const s = timeLeft.value % 60
  return `${pad(m)}:${pad(s)}`
})

// Mode tabs, labels adapted to active theme
const modeList = computed(() =>
  (Object.keys(MODES) as ModeKey[]).map(key => {
    const cfg = MODES[key]
    return {
      key,
      label:
        activeTheme.value === 'hacker' ? cfg.hackerLabel
        : activeTheme.value === 'space' ? cfg.spaceLabel
        : cfg.label,
    }
  })
)

// Theme-aware text ─────────────────────────────────────────────────────

const pageTitle = computed(() => {
  if (activeTheme.value === 'hacker') return 'pomodoro.exe'
  if (activeTheme.value === 'space')  return 'MISSION TIMER'
  return 'focus'
})

const pageSubtitle = computed(() => {
  if (activeTheme.value === 'hacker') return '// block time. ship code.'
  if (activeTheme.value === 'space')  return 'FOCUS PROTOCOLS — OSLO BASE'
  return 'work in rhythm'
})

const startLabel = computed(() => {
  if (activeTheme.value === 'hacker') return 'execute'
  if (activeTheme.value === 'space')  return 'LAUNCH'
  return 'start'
})

const pauseLabel = computed(() => {
  if (activeTheme.value === 'hacker') return 'suspend'
  if (activeTheme.value === 'space')  return 'PAUSE'
  return 'pause'
})

const runningLabel = computed(() => {
  if (activeTheme.value === 'space') return 'IN PROGRESS'
  return 'running'
})

const pausedLabel = computed(() => {
  if (activeTheme.value === 'space') return 'READY'
  return 'ready'
})

// ── Timer logic ────────────────────────────────────────────────────────

function tick() {
  if (timeLeft.value <= 1) {
    timeLeft.value = 0
    stopTimer()
    onTimerComplete()
    return
  }
  timeLeft.value--
  secondPulse.value = false
  nextTick(() => { secondPulse.value = true })
}

function startTimer() {
  if (ticker !== null) return
  ticker = setInterval(tick, 1000)
  isRunning.value = true
}

function stopTimer() {
  if (ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
  isRunning.value = false
}

function toggleTimer() {
  isRunning.value ? stopTimer() : startTimer()
}

function resetTimer() {
  stopTimer()
  timeLeft.value = totalSeconds.value
}

function selectMode(mode: ModeKey) {
  stopTimer()
  currentMode.value = mode
  timeLeft.value = MODES[mode].seconds
}

function skipMode() {
  stopTimer()
  advanceMode()
}

function advanceMode() {
  if (currentMode.value === 'focus') {
    const next = sessionCount.value + 1
    // Keep dots filled during the long break; reset after it completes
    sessionCount.value = next >= SESSIONS_BEFORE_LONG ? SESSIONS_BEFORE_LONG : next
    const nextMode: ModeKey = next >= SESSIONS_BEFORE_LONG ? 'long' : 'short'
    currentMode.value = nextMode
    timeLeft.value = MODES[nextMode].seconds
  } else {
    if (currentMode.value === 'long') sessionCount.value = 0
    currentMode.value = 'focus'
    timeLeft.value = MODES.focus.seconds
  }
}

function onTimerComplete() {
  const wasFocus = currentMode.value === 'focus'
  playCompletionSound(wasFocus)
  sendNotification(wasFocus)
  justCompleted.value = true
  if (flashTimer !== null) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { justCompleted.value = false }, 1200)
  advanceMode()
}

// ── Keyboard shortcuts ─────────────────────────────────────────

const handleGlobalKey = (event: KeyboardEvent) => {
  const tag = (event.target as HTMLElement).tagName
  if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(tag)) return
  if (event.metaKey || event.ctrlKey || event.altKey) return

  switch (event.key) {
    case ' ':
      event.preventDefault()
      toggleTimer()
      break
    case 'r':
    case 'R':
      event.preventDefault()
      resetTimer()
      break
    case 's':
    case 'S':
      event.preventDefault()
      skipMode()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKey)
  if (typeof Notification !== 'undefined') {
    notifSupported.value = true
    notifPermission.value = Notification.permission
    if (Notification.permission === 'granted' && localStorage.getItem('focus-notif') === '1') {
      notifEnabled.value = true
    }
  }
})

onBeforeUnmount(() => {
  if (ticker !== null) clearInterval(ticker)
  if (flashTimer !== null) clearTimeout(flashTimer)
  document.removeEventListener('keydown', handleGlobalKey)
})
</script>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────── */

.focus-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────────────────────────── */

.focus-header {
  margin-bottom: 2.5rem;
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

/* ── Main layout ────────────────────────────────────────────── */

.focus-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

/* ── Mode tabs ──────────────────────────────────────────────── */

.mode-tabs {
  display: flex;
  gap: 0.3rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 999px;
  padding: 0.25rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.mode-tab {
  padding: 0.4rem 1.1rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--theme-text-muted, #666);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease;
}

.mode-tab:hover {
  color: var(--theme-text, #111);
}

.mode-tab--active {
  background: var(--theme-accent, #6b8cae);
  color: #fff;
}

.mode-tab:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
}

/* ── SVG Ring timer ─────────────────────────────────────────── */

.ring-area {
  position: relative;
  width: 100%;
  max-width: 280px;
}

.timer-svg {
  width: 100%;
  height: auto;
  display: block;
}

.ring-track {
  stroke: var(--theme-card-border, rgba(0, 0, 0, 0.1));
}

.ring-flash {
  stroke: var(--theme-accent, #6b8cae);
  opacity: 0;
  animation: ring-flash 1.2s ease-out forwards;
}

@keyframes ring-flash {
  0%   { opacity: 0.6; }
  100% { opacity: 0; }
}

.ring-progress {
  stroke: var(--theme-accent, #6b8cae);
  transition: stroke-dashoffset 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.ring-ticks {
  opacity: 0.22;
}

.tick-minor {
  stroke: var(--theme-text-subtle, #aaa);
  stroke-width: 0.9;
  stroke-linecap: round;
}

.tick-major {
  stroke: var(--theme-text-muted, #888);
  stroke-width: 1.8;
  stroke-linecap: round;
}

.ring-inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  pointer-events: none;
}

.ring-mode-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
  font-weight: 600;
}

.ring-time {
  font-size: clamp(2.8rem, 10vw, 4.2rem);
  font-weight: 300;
  color: var(--theme-text, #111);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: 1;
}

@keyframes second-tick {
  0% { transform: scale(1); }
  35% { transform: scale(1.032); }
  100% { transform: scale(1); }
}

.ring-time--tick {
  animation: second-tick 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@media (prefers-reduced-motion: reduce) {
  .ring-time--tick {
    animation: none;
  }
}

.ring-status {
  font-size: 0.68rem;
  color: var(--theme-text-subtle, #aaa);
  letter-spacing: 0.06em;
}

/* ── Hacker terminal ────────────────────────────────────────── */

.hacker-timer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  font-family: monospace;
  animation: term-enter 0.4s steps(8) both;
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

.ht-time {
  font-size: clamp(3rem, 14vw, 5.5rem);
  color: var(--theme-text, #00ff41);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
  text-shadow: 0 0 20px currentColor;
  line-height: 1;
  font-family: monospace;
}

.ht-time--pulse {
  animation: ht-pulse 1.2s ease-out;
}

@keyframes ht-pulse {
  0%, 100% { text-shadow: 0 0 20px currentColor; }
  50%       { text-shadow: 0 0 60px currentColor, 0 0 120px currentColor; }
}

.ht-bar-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.ht-bar {
  flex: 1;
  height: 10px;
  background: rgba(0, 20, 0, 0.8);
  border: 1px solid var(--theme-text-muted, #008F11);
  overflow: hidden;
}

.ht-bar-fill {
  height: 100%;
  background: var(--theme-text, #00ff41);
  box-shadow: 0 0 6px currentColor;
  transition: width 0.9s linear;
}

.ht-pct {
  font-size: 0.75rem;
  color: var(--theme-text-muted, #008F11);
  min-width: 2.8rem;
  text-align: right;
  font-family: monospace;
}

.ht-info {
  display: flex;
  gap: 1.5rem;
  font-size: 0.75rem;
}

.ht-running {
  color: var(--theme-text, #00ff41);
  text-shadow: 0 0 8px currentColor;
}

.ht-paused {
  color: var(--theme-text-muted, #008F11);
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
  animation: blink 1.1s step-end infinite;
  font-family: monospace;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Controls ───────────────────────────────────────────────── */

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.ctrl {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
}

.ctrl:active {
  transform: scale(0.94);
}

.ctrl:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 3px;
}

.ctrl--main {
  padding: 0.75rem 2rem;
  border-radius: 999px;
  background: var(--theme-accent, #6b8cae);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--theme-accent, #6b8cae) 30%, transparent);
  min-width: 9.5rem;
}

.ctrl--main:hover {
  opacity: 0.88;
  box-shadow: 0 6px 24px color-mix(in srgb, var(--theme-accent, #6b8cae) 45%, transparent);
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

.ctrl--sec:hover {
  color: var(--theme-text, #111);
  border-color: var(--theme-accent, #6b8cae);
}

.ctrl-label {
  font-size: 0.88rem;
}

/* ── Session dots ───────────────────────────────────────────── */

.session-dots {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.sdot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.12));
  transition: background 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
}

.sdot--done {
  background: var(--theme-accent, #6b8cae);
  transform: scale(1.25);
}

/* ── Hacker theme overrides ─────────────────────────────────── */

:global(.hacker-page) h1 {
  font-family: monospace;
  text-shadow: 0 0 10px currentColor;
  letter-spacing: 0.04em;
}

:global(.hacker-page) .subtitle {
  font-family: monospace;
  color: var(--theme-text-muted, #008F11);
}

:global(.hacker-page) .mode-tabs {
  background: rgba(0, 20, 0, 0.8);
  border-color: var(--theme-text-muted, #008F11);
  border-radius: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.hacker-page) .mode-tab {
  border-radius: 0;
  font-family: monospace;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
}

:global(.hacker-page) .mode-tab--active {
  background: var(--theme-text, #00ff41);
  color: var(--theme-bg, #0a0a0a);
}

:global(.hacker-page) .ctrl--main {
  border-radius: 0;
  font-family: monospace;
  letter-spacing: 0.1em;
}

:global(.hacker-page) .ctrl--sec {
  border-radius: 0;
  font-family: monospace;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.hacker-page) .sdot {
  border-radius: 0;
}

:global(.hacker-page) .sdot--done {
  background: var(--theme-text, #00ff41);
  box-shadow: 0 0 6px var(--theme-text, #00ff41);
}

/* ── Space theme overrides ──────────────────────────────────── */

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
  font-size: 0.75rem;
  letter-spacing: 0.12em;
}

:global(.space-page) .mode-tabs {
  border-radius: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.space-page) .mode-tab {
  border-radius: 0;
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}

:global(.space-page) .ring-progress {
  stroke: var(--space-accent-amber, #e8c87a);
  filter: drop-shadow(0 0 6px rgba(232, 200, 122, 0.7));
}

:global(.space-page) .ring-flash {
  stroke: var(--space-accent-amber, #e8c87a);
}

:global(.space-page) .ring-time {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-shadow: 0 0 24px rgba(140, 170, 220, 0.4);
}

:global(.space-page) .ring-mode-label {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  font-size: 0.58rem;
}

:global(.space-page) .ring-status {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}

:global(.space-page) .ctrl--main {
  border-radius: 0;
  background: var(--space-accent-amber, #e8c87a);
  color: var(--space-bg, #0a0a0f);
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  letter-spacing: 0.1em;
  box-shadow: 0 4px 20px rgba(232, 200, 122, 0.3);
}

:global(.space-page) .ctrl--main:hover {
  box-shadow: 0 6px 32px rgba(232, 200, 122, 0.5);
}

:global(.space-page) .ctrl--sec {
  border-radius: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.space-page) .sdot--done {
  background: var(--space-accent-amber, #e8c87a);
  box-shadow: 0 0 8px rgba(232, 200, 122, 0.6);
}

:global(.space-page) .ring-ticks {
  opacity: 0.2;
}

:global(.space-page) .tick-minor,
:global(.space-page) .tick-major {
  stroke: var(--space-accent-blue, #89abd0);
}

/* ── Options row (sound + notifications) ────────────────────── */

.option-row {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: center;
}

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
  opacity: 0.45;
  transition: opacity 0.2s ease;
  padding: 0;
}

.option-btn:hover {
  opacity: 0.8;
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

:global(.space-page) .kbd-hint kbd {
  border-radius: 0;
  background: rgba(15, 15, 30, 0.7);
  border-color: rgba(140, 170, 220, 0.2);
  box-shadow: 0 1px 0 rgba(140, 170, 220, 0.15);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* ── Responsive ─────────────────────────────────────────────── */

@media (max-width: 400px) {
  .ring-area {
    max-width: 240px;
  }

  .ctrl--main {
    min-width: 8rem;
    padding: 0.65rem 1.5rem;
  }

  .mode-tab {
    padding: 0.4rem 0.75rem;
    font-size: 0.72rem;
  }
}
</style>
