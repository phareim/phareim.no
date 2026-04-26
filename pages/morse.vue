<template>
  <div class="morse-page">
    <header class="morse-header">
      <h1>{{ pageTitle }}</h1>
      <p class="subtitle">{{ pageSubtitle }}</p>
    </header>

    <main class="morse-content">

      <!-- Input -->
      <div class="morse-section">
        <label class="morse-label" for="morse-text">text</label>
        <textarea
          id="morse-text"
          v-model="inputText"
          class="morse-textarea"
          placeholder="type something…"
          rows="2"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          @keydown.stop
        ></textarea>
      </div>

      <!-- Morse visual output -->
      <div v-if="tokens.length" class="morse-section">
        <label class="morse-label">output</label>
        <div class="morse-tokens" role="region" aria-label="Morse code output">
          <template v-for="(token, ti) in tokens" :key="ti">
            <span v-if="token.type === 'word-gap'" class="morse-word-gap" aria-hidden="true"></span>
            <span
              v-else
              class="morse-token"
              :class="{ 'is-active': activeTokenIdx === ti }"
              :aria-label="`${token.char}: ${token.morse}`"
            >
              <span class="token-char" aria-hidden="true">{{ token.char }}</span>
              <span class="token-symbols" aria-hidden="true">
                <span
                  v-for="(sym, si) in token.symbols"
                  :key="si"
                  class="morse-sym"
                  :class="[
                    sym === '.' ? 'sym-dot' : 'sym-dash',
                    { 'is-active': activeTokenIdx === ti && activeSymIdx === si }
                  ]"
                ></span>
              </span>
            </span>
          </template>
        </div>

        <!-- Plain text copy row -->
        <div class="morse-plain-row">
          <span class="morse-plain-text" aria-label="Morse code as text">{{ plainMorse }}</span>
          <button class="morse-copy-btn" @click="copyMorse" :aria-label="copied ? 'Copied' : 'Copy morse code'">
            {{ copied ? 'copied' : 'copy' }}
          </button>
        </div>
      </div>

      <!-- Playback controls -->
      <div v-if="tokens.length" class="morse-controls">
        <button
          class="morse-play-btn"
          :class="{ 'is-playing': playing }"
          @click="togglePlay"
          :aria-label="playing ? 'Stop playback' : 'Play morse code'"
        >
          <span class="btn-icon" aria-hidden="true">{{ playing ? '■' : '▶' }}</span>
          {{ playing ? 'stop' : 'play' }}
        </button>

        <div class="morse-speed">
          <label class="speed-label" for="wpm-slider">{{ wpm }} wpm</label>
          <input
            id="wpm-slider"
            type="range"
            min="5"
            max="30"
            step="1"
            v-model.number="wpm"
            :disabled="playing"
            class="morse-slider"
            aria-label="Playback speed in words per minute"
          />
        </div>
      </div>

      <!-- Reference table (shown when empty) -->
      <div v-if="!inputText" class="morse-section morse-reference">
        <label class="morse-label">reference</label>
        <div class="morse-ref-grid">
          <div
            v-for="([ch, code]) in referenceChars"
            :key="ch"
            class="morse-ref-item"
            role="button"
            tabindex="0"
            :aria-label="`${ch}: ${code}`"
            @click="appendChar(ch)"
            @keydown.enter="appendChar(ch)"
            @keydown.space.prevent="appendChar(ch)"
          >
            <span class="ref-char">{{ ch }}</span>
            <span class="ref-code">{{ code }}</span>
          </div>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
const { activeTheme } = useTheme()

const pageTitle = computed(() => {
  if (activeTheme.value === 'hacker') return 'morse.exe'
  if (activeTheme.value === 'space')  return 'SIGNAL ENCODER'
  return 'morse'
})

const pageSubtitle = computed(() => {
  if (activeTheme.value === 'hacker') return '// encode · transmit · decode'
  if (activeTheme.value === 'space')  return 'DASH DOT TRANSMISSION PROTOCOL'
  return 'text → morse code + audio'
})

useHead({ title: 'morse — phareim.no' })

// ── Morse table ──────────────────────────────────────────────────────────

const MORSE: Record<string, string> = {
  A: '.-',   B: '-...', C: '-.-.', D: '-..',  E: '.',    F: '..-.',
  G: '--.',  H: '....', I: '..',   J: '.---', K: '-.-',  L: '.-..',
  M: '--',   N: '-.',   O: '---',  P: '.--.', Q: '--.-', R: '.-.',
  S: '...',  T: '-',    U: '..-',  V: '...-', W: '.--',  X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.',
}

const referenceChars = Object.entries(MORSE).slice(0, 26)

// ── Types ────────────────────────────────────────────────────────────────

interface CharToken { type: 'char'; char: string; morse: string; symbols: string[] }
interface GapToken  { type: 'word-gap' }
type Token = CharToken | GapToken

// ── State ────────────────────────────────────────────────────────────────

const inputText    = ref('')
const wpm          = ref(15)
const playing      = ref(false)
const copied       = ref(false)
const activeTokenIdx = ref<number | null>(null)
const activeSymIdx   = ref<number | null>(null)

let audioCtx: AudioContext | null = null
let pendingTimeouts: ReturnType<typeof setTimeout>[] = []
let playId = 0

// ── Computed ─────────────────────────────────────────────────────────────

const tokens = computed<Token[]>(() => {
  const result: Token[] = []
  const words = inputText.value.toUpperCase().split(/\s+/).filter(Boolean)
  for (let wi = 0; wi < words.length; wi++) {
    if (wi > 0) result.push({ type: 'word-gap' })
    for (const ch of words[wi]) {
      const morse = MORSE[ch]
      if (morse) result.push({ type: 'char', char: ch, morse, symbols: morse.split('') })
    }
  }
  return result
})

const plainMorse = computed(() =>
  tokens.value
    .map(t => t.type === 'word-gap' ? '/' : t.morse)
    .join(' ')
)

// ── Helpers ───────────────────────────────────────────────────────────────

function appendChar(ch: string) {
  inputText.value += ch.toLowerCase()
}

async function copyMorse() {
  try {
    await navigator.clipboard.writeText(plainMorse.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch {}
}

// ── Audio ─────────────────────────────────────────────────────────────────

function scheduleBeep(ctx: AudioContext, startTime: number, duration: number) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.value = 620 // Hz — classic Morse code pitch
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.22, startTime + 0.004)
  gain.gain.setValueAtTime(0.22, startTime + duration - 0.004)
  gain.gain.linearRampToValueAtTime(0, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

function stopPlay() {
  playing.value = false
  activeTokenIdx.value = null
  activeSymIdx.value = null
  playId++
  for (const t of pendingTimeouts) clearTimeout(t)
  pendingTimeouts = []
  if (audioCtx) {
    try { audioCtx.close() } catch {}
    audioCtx = null
  }
}

async function startPlay() {
  const charTokens = tokens.value.filter(t => t.type === 'char')
  if (!charTokens.length) return

  stopPlay()

  const ActxClass = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!ActxClass) return

  audioCtx = new ActxClass() as AudioContext
  const ctx = audioCtx
  const id = ++playId

  playing.value = true

  // Timing: unit = 1.2 / WPM seconds (Paris standard)
  const unit      = 1.2 / wpm.value
  const startTime = ctx.currentTime + 0.06
  let   t         = startTime

  for (let ti = 0; ti < tokens.value.length; ti++) {
    const token = tokens.value[ti]

    if (token.type === 'word-gap') {
      // 7 unit word gap (3 units already included at end of prev letter, so add 4 more)
      t += unit * 4
      continue
    }

    // Visual: highlight token when we start playing it
    const tokenDelay = Math.max(0, (t - startTime) * 1000)
    const curTi = ti
    const to1 = setTimeout(() => {
      if (playId !== id) return
      activeTokenIdx.value = curTi
      activeSymIdx.value = 0
    }, tokenDelay)
    pendingTimeouts.push(to1)

    for (let si = 0; si < token.symbols.length; si++) {
      const sym = token.symbols[si]
      const dur = sym === '.' ? unit : unit * 3

      scheduleBeep(ctx, t, dur)

      // Visual: highlight current symbol
      const symDelay = Math.max(0, (t - startTime) * 1000)
      const curSi = si
      const to2 = setTimeout(() => {
        if (playId !== id) return
        activeSymIdx.value = curSi
      }, symDelay)
      pendingTimeouts.push(to2)

      t += dur + unit // symbol duration + inter-element gap (1 unit)
    }

    // After last symbol of letter: inter-letter gap = 3 units total.
    // We already added 1 unit inter-element gap after the last symbol, add 2 more.
    t += unit * 2
  }

  // End of playback
  const endDelay = Math.max(0, (t - startTime) * 1000 + 200)
  const toEnd = setTimeout(() => {
    if (playId !== id) return
    playing.value = false
    activeTokenIdx.value = null
    activeSymIdx.value = null
  }, endDelay)
  pendingTimeouts.push(toEnd)
}

function togglePlay() {
  if (playing.value) stopPlay()
  else startPlay()
}

// Stop if text changes mid-play
watch(inputText, () => { if (playing.value) stopPlay() })

onUnmounted(() => { stopPlay() })
</script>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────────────── */

.morse-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 680px;
  margin: 0 auto;
}

.morse-header {
  margin-bottom: 2.5rem;
}

h1 {
  font-size: clamp(2rem, 6vw, 3.5rem);
  margin: 0 0 0.4rem;
  color: var(--theme-text, #111);
  font-weight: 500;
}

.subtitle {
  color: var(--theme-text-muted, #666);
  font-size: 0.95rem;
  margin: 0;
}

/* ── Sections ────────────────────────────────────────────────────────── */

.morse-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.morse-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.morse-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
}

/* ── Textarea ────────────────────────────────────────────────────────── */

.morse-textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 0.9rem 1.1rem;
  font-family: inherit;
  font-size: 1rem;
  color: var(--theme-text, #111);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  line-height: 1.6;
}

.morse-textarea::placeholder {
  color: var(--theme-text-subtle, #bbb);
}

.morse-textarea:focus {
  border-color: var(--theme-accent, #6b8cae);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #6b8cae) 15%, transparent);
}

/* ── Token display ───────────────────────────────────────────────────── */

.morse-tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  align-items: flex-end;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1.1rem 1.2rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  min-height: 64px;
}

.morse-word-gap {
  width: 1rem;
  display: inline-block;
}

.morse-token {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.3rem;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.morse-token.is-active {
  background: color-mix(in srgb, var(--theme-accent, #6b8cae) 12%, transparent);
}

.token-char {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--theme-text-subtle, #aaa);
  line-height: 1;
}

.morse-token.is-active .token-char {
  color: var(--theme-accent, #6b8cae);
}

.token-symbols {
  display: flex;
  align-items: center;
  gap: 3px;
}

/* ── Dots and dashes ─────────────────────────────────────────────────── */

.morse-sym {
  display: inline-block;
  height: 7px;
  border-radius: 3px;
  background: var(--theme-text-muted, #888);
  transition: background 0.1s ease, box-shadow 0.1s ease;
  flex-shrink: 0;
}

.sym-dot  { width: 7px; }
.sym-dash { width: 21px; }

.morse-sym.is-active {
  background: var(--theme-accent, #6b8cae);
  box-shadow: 0 0 8px color-mix(in srgb, var(--theme-accent, #6b8cae) 60%, transparent);
}

/* ── Plain text + copy ───────────────────────────────────────────────── */

.morse-plain-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0 0.1rem;
}

.morse-plain-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.78rem;
  color: var(--theme-text-subtle, #aaa);
  word-break: break-all;
  flex: 1;
  min-width: 0;
  line-height: 1.6;
}

.morse-copy-btn {
  background: none;
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
  border-radius: 6px;
  padding: 0.2rem 0.6rem;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--theme-text-subtle, #aaa);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.morse-copy-btn:hover {
  color: var(--theme-text, #111);
  border-color: var(--theme-accent, #6b8cae);
}

.morse-copy-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
}

/* ── Controls ────────────────────────────────────────────────────────── */

.morse-controls {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.morse-play-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.3rem;
  background: var(--theme-accent, #6b8cae);
  border: none;
  border-radius: calc(var(--theme-card-radius, 16px) * 0.6);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6b8cae) 35%, transparent);
}

.morse-play-btn:hover {
  opacity: 0.88;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--theme-accent, #6b8cae) 40%, transparent);
}

.morse-play-btn:active { transform: translateY(0); }

.morse-play-btn.is-playing {
  background: var(--theme-accent-danger, #c1272d);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent-danger, #c1272d) 35%, transparent);
}

.morse-play-btn.is-playing:hover {
  box-shadow: 0 4px 14px color-mix(in srgb, var(--theme-accent-danger, #c1272d) 40%, transparent);
}

.btn-icon {
  font-size: 0.7rem;
  line-height: 1;
}

.morse-speed {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 120px;
}

.speed-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
}

.morse-slider {
  width: 100%;
  accent-color: var(--theme-accent, #6b8cae);
  cursor: pointer;
  height: 4px;
}

.morse-slider:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Reference grid ──────────────────────────────────────────────────── */

.morse-reference {
  gap: 0.75rem;
}

.morse-ref-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 0.4rem;
}

.morse-ref-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.5rem 0.4rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 10px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: border-color 0.15s ease, background 0.15s ease;
  user-select: none;
}

.morse-ref-item:hover {
  border-color: var(--theme-accent, #6b8cae);
  background: color-mix(in srgb, var(--theme-accent, #6b8cae) 6%, var(--theme-card-bg, rgba(255,255,255,0.6)));
}

.morse-ref-item:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
}

.ref-char {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--theme-text, #111);
  line-height: 1;
}

.ref-code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.62rem;
  color: var(--theme-text-subtle, #aaa);
  letter-spacing: 0.1em;
}

/* ── Hacker theme ────────────────────────────────────────────────────── */

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .subtitle,
:global(.hacker-page) .morse-label,
:global(.hacker-page) .speed-label {
  font-family: monospace;
}

:global(.hacker-page) .morse-textarea {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .morse-tokens {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .token-char {
  font-family: monospace;
}

:global(.hacker-page) .morse-sym {
  border-radius: 1px;
}

:global(.hacker-page) .morse-sym.is-active {
  box-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .morse-token.is-active {
  background: rgba(0, 255, 65, 0.08);
}

:global(.hacker-page) .morse-play-btn {
  border-radius: 0;
  font-family: monospace;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

:global(.hacker-page) .morse-copy-btn {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .morse-ref-item {
  border-radius: 0;
}

:global(.hacker-page) .ref-char,
:global(.hacker-page) .ref-code {
  font-family: monospace;
}

/* ── Space theme ─────────────────────────────────────────────────────── */

:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .morse-sym.is-active {
  box-shadow: 0 0 14px rgba(137, 171, 208, 0.7);
}

:global(.space-page) .morse-play-btn {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

:global(.space-page) .morse-token.is-active {
  background: color-mix(in srgb, var(--space-accent-blue, #89abd0) 12%, transparent);
}

:global(.space-page) .morse-tokens,
:global(.space-page) .morse-textarea {
  background: rgba(15, 15, 30, 0.75);
  border-color: rgba(140, 170, 220, 0.15);
}
</style>
