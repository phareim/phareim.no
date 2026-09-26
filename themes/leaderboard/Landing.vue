<template>
  <!-- Owns the page: the world ranking in the shrine's hall of champions
       (Neon Shrine's pixel look, 2026-09-25). One game at a time; up/down
       walks the games, and nothing here locks the shell's navigation. -->
  <div ref="landing" class="lb-landing">
    <Hall />

    <p class="lb-hud px-text">HALL OF FAME</p>

    <section ref="panel" class="lb-panel px-box" aria-live="polite">
      <header class="lb-head">
        <p class="lb-over"><span class="lb-over-wide">WORLD RANKING</span><span class="lb-over-narrow">HALL OF FAME</span> {{ pad(index + 1) }}/{{ pad(GAMES.length) }}</p>
        <div class="lb-title-row">
          <button class="lb-step px-btn px-btn--pink" aria-label="Previous game" @click="step(-1)">▲</button>
          <Transition name="lb-fade" mode="out-in">
            <h1 :key="game.id" class="lb-title">{{ game.title }}</h1>
          </Transition>
          <button class="lb-step px-btn px-btn--pink" aria-label="Next game" @click="step(1)">▼</button>
        </div>
        <p class="lb-tagline">{{ game.tagline }}</p>
      </header>

      <Transition name="lb-fade" mode="out-in" @after-enter="fit">
        <div :key="game.id" ref="boardEl" class="lb-board">
          <ol v-if="visible.length" class="lb-rows">
            <li
              v-for="row in visible"
              :key="row.key"
              class="lb-row"
              :class="{ 'lb-row--me': row.me, 'lb-row--podium': row.rank <= 3 }"
            >
              <span class="lb-rank">{{ pad(row.rank) }}</span>
              <span class="lb-avatar"><PixelAvatar :src="row.avatar" /></span>
              <span class="lb-name">{{ clip(row.name, row.me ? meChars : nameChars) }}</span>
              <span class="lb-you" aria-hidden="true">◀ YOU</span>
              <span class="lb-score">{{ fmt(row.score) }}</span>
            </li>
            <li v-if="gapBeforeMe" class="lb-row lb-row--gap" aria-hidden="true">· · ·</li>
            <li v-if="meOutside" class="lb-row lb-row--me">
              <span class="lb-rank">{{ pad(meOutside.rank) }}</span>
              <span class="lb-avatar"><PixelAvatar :src="meOutside.avatar" /></span>
              <span class="lb-name">{{ clip(meOutside.name, meChars) }}</span>
              <span class="lb-you" aria-hidden="true">◀ YOU</span>
              <span class="lb-score">{{ fmt(meOutside.score) }}</span>
            </li>
          </ol>
          <p v-else-if="status === 'loading'" class="lb-empty">SYNCING...</p>
          <p v-else-if="status === 'error'" class="lb-empty">OFFLINE<br><span>THE BOARD DID NOT ANSWER</span></p>
          <p v-else class="lb-empty">NO SCORES YET<br><span>BE THE FIRST</span></p>
          <p v-if="status === 'ready' && board && board.total > 0 && !board.me" class="lb-nudge">
            NO RUN YET · PLAY {{ game.title.toUpperCase() }}
          </p>
          <p v-else-if="board?.me" class="lb-nudge">
            RANK {{ board.me.rank }} OF {{ board.total }} · BEST {{ fmt(board.me.score) }}
          </p>
        </div>
      </Transition>

      <!-- REROLL left 2026-09-08: a new name now costs a painting. The
           composable still knows how; the button can come back with a cap. -->
      <footer class="lb-footer">
        <span class="lb-footer-label">YOU ARE</span>
        <span class="lb-footer-who">
          <span class="lb-avatar lb-avatar--me" :class="{ 'lb-avatar--pending': player && !avatar }">
            <PixelAvatar :src="avatar" :n="16" />
          </span>
          <span ref="footName" class="lb-footer-name">{{ player ? clip(player.name, footChars) : '· · ·' }}</span>
        </span>
      </footer>
    </section>

    <nav class="lb-rail" aria-label="Game">
      <button
        v-for="(g, i) in GAMES"
        :key="g.id"
        class="lb-rail-pip"
        :class="{ active: i === index }"
        :title="g.title"
        :aria-label="g.title"
        :aria-current="i === index ? 'true' : undefined"
        @click="go(i)"
      />
    </nav>

    <p class="lb-hint px-text">{{ hint('↑↓ MORE GAMES · ESC PORTAL', 'SWIPE ↑↓ GAMES · ⌂ PORTAL') }}</p>
  </div>
</template>

<script setup lang="ts">
import Hall from './Hall.vue'
import PixelAvatar from './PixelAvatar.vue'
import { GAMES, TOP_N, type BoardRow, type GameBoard } from './games'

const { hint } = useInputMode()
const { player, avatar, fetchBoards } = useLeaderboard()

const landing = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const boardEl = ref<HTMLElement | null>(null)
const footName = ref<HTMLElement | null>(null)

const index = ref(0)
const game = computed(() => GAMES[index.value])

const boards = ref<Record<string, GameBoard> | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')

const board = computed(() => boards.value?.[game.value.id] ?? null)

/** How many rows fit in the space the viewport leaves the board. */
const rowsFit = ref(TOP_N)
const ROW_PX = 32
const MIN_ROWS = 3

const meOutside = computed<BoardRow | null>(() => {
  const b = board.value
  if (!b?.me) return null
  return b.me.rank > visibleCount.value ? b.me : null
})

const visibleCount = computed(() => {
  const b = board.value
  if (!b) return 0
  // A player outside the visible top needs two rows: the gap and themself.
  const reserve = b.me && b.me.rank > rowsFit.value ? 2 : 0
  return Math.max(MIN_ROWS, Math.min(TOP_N, rowsFit.value - reserve))
})

const visible = computed(() => board.value?.top.slice(0, visibleCount.value) ?? [])
const gapBeforeMe = computed(() => !!meOutside.value && meOutside.value.rank > visibleCount.value + 1)

/**
 * Names are up to 20 letters; the pixel font cannot ellipsize mid-glyph, so
 * a name that does not fit its column is cut at a whole letter and ends in
 * a dot. The column widths do not depend on the text (see fit()).
 */
const nameChars = ref(20)
const meChars = ref(20)
const footChars = ref(20)

function clip(name: string, max: number): string {
  const n = name.toUpperCase()
  return n.length <= max ? n : n.slice(0, Math.max(1, max - 1)).trimEnd() + '.'
}

/** Whole pixel-font letters that fit an element's width (advance 0.75 em). */
function charsIn(el: Element | null | undefined): number | null {
  if (!(el instanceof HTMLElement) || !el.clientWidth) return null
  return Math.max(4, Math.floor(el.clientWidth / (parseFloat(getComputedStyle(el).fontSize) * 0.75)))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(score: number): string {
  return String(score).padStart(6, '0')
}

function go(i: number): void {
  index.value = (i + GAMES.length) % GAMES.length
}

function step(delta: number): void {
  go(index.value + delta)
}

/**
 * A player's pilot is painted on Sleeper after registration (~40 s). While
 * ours is missing, or a reroll made it stale, one more fetch after a pause
 * picks it up — then we stop asking; the next visit shows it anyway.
 */
const AVATAR_RECHECK_MS = 45_000
let avatarTimer: ReturnType<typeof setTimeout> | undefined
let avatarRechecks = 0

function scheduleAvatarRecheck(): void {
  if (avatarRechecks >= 2 || avatarTimer) return
  avatarTimer = setTimeout(() => {
    avatarTimer = undefined
    avatarRechecks += 1
    load()
  }, AVATAR_RECHECK_MS)
}

async function load(): Promise<void> {
  status.value = boards.value ? 'ready' : 'loading'
  try {
    const data = await fetchBoards()
    boards.value = data.boards
    status.value = 'ready'
    if (data.player && !data.player.avatar) scheduleAvatarRecheck()
  } catch {
    status.value = 'error'
  }
}

/** Rows the viewport leaves the board: total height minus the panel's chrome. */
function fit(): void {
  const l = landing.value
  const p = panel.value
  const b = boardEl.value
  if (!l || !p || !b) return
  const cs = getComputedStyle(l)
  const available = l.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  const chrome = p.offsetHeight - b.offsetHeight
  const nudge = 32 // the line under the rows
  rowsFit.value = Math.max(MIN_ROWS, Math.min(TOP_N, Math.floor((available - chrome - nudge) / ROW_PX)))
  nextTick(() => {
    nameChars.value = charsIn(boardEl.value?.querySelector('.lb-row:not(.lb-row--me):not(.lb-row--gap) .lb-name')) ?? nameChars.value
    meChars.value = charsIn(boardEl.value?.querySelector('.lb-row--me .lb-name')) ?? meChars.value
    footChars.value = charsIn(footName.value) ?? footChars.value
  })
}

// --- input: up/down walks the games; left/right is the shell's -------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { step(1); e.preventDefault() }
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') { step(-1); e.preventDefault() }
}

let wheelAcc = 0
let wheelLock = 0
function onWheel(e: WheelEvent): void {
  const now = performance.now()
  if (now < wheelLock) return
  wheelAcc += e.deltaY
  if (Math.abs(wheelAcc) < 60) return
  step(wheelAcc > 0 ? 1 : -1)
  wheelAcc = 0
  wheelLock = now + 450
}

let touchY = 0
let touchX = 0
let touchT = 0
function onTouchStart(e: TouchEvent): void {
  if (e.touches.length !== 1) { touchT = 0; return }
  touchY = e.touches[0].clientY
  touchX = e.touches[0].clientX
  touchT = Date.now()
}
function onTouchEnd(e: TouchEvent): void {
  if (!touchT || Date.now() - touchT > 700) return
  touchT = 0
  const t = e.changedTouches[0]
  const dy = t.clientY - touchY
  const dx = t.clientX - touchX
  if (Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx) * 1.5) return
  // Finger moving up reveals the next game, like a list.
  step(dy < 0 ? 1 : -1)
}

let observer: ResizeObserver | undefined

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('wheel', onWheel, { passive: true })
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchend', onTouchEnd, { passive: true })
  observer = new ResizeObserver(() => fit())
  if (landing.value) observer.observe(landing.value)
  fit()
  load().then(() => nextTick(fit))
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('wheel', onWheel)
  document.removeEventListener('touchstart', onTouchStart)
  document.removeEventListener('touchend', onTouchEnd)
  observer?.disconnect()
  if (avatarTimer) clearTimeout(avatarTimer)
})

watch(index, () => nextTick(fit))
</script>

<style scoped>
.lb-landing {
  --lb-shadow: 2px 2px 0 #0b0616;
  position: relative;
  width: 100vw;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  touch-action: none;
  display: grid;
  place-items: center;
  padding: 12px 12px calc(12px + var(--app-safe-bottom, 0px));
  box-sizing: border-box;
}

/* Everything speaks in Neon Shrine's 5×7 letters, in 8 px steps. */
.lb-panel,
.lb-hud,
.lb-hint {
  font-family: var(--font-pixel);
  font-weight: 400;
  letter-spacing: 0;
  text-transform: uppercase;
  -webkit-font-smoothing: none;
  font-size: 16px;
  line-height: 1;
}

.lb-hud {
  position: absolute;
  z-index: 2;
  top: 16px;
  left: 16px;
  margin: 0;
  color: var(--lb-gold);
  text-shadow: var(--lb-shadow);
}

/* Neon Shrine's dialog box (pixel.css .px-box). */
.lb-panel {
  z-index: 2;
  width: min(480px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 18px 16px 14px;
  box-sizing: border-box;
  color: var(--lb-text);
}

.lb-head { text-align: center; }

.lb-over {
  margin: 0 0 8px;
  color: var(--lb-text-subtle);
}

.lb-title-row {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  align-items: center;
  column-gap: 8px;
}

.lb-title {
  margin: 0;
  font-size: 32px;
  font-weight: 400;
  line-height: 1;
  color: var(--lb-accent);
  text-shadow: 4px 4px 0 #0b0616;
  white-space: nowrap;
}

.lb-step {
  width: 32px;
  height: 32px;
  padding: 0;
  display: grid;
  place-items: center;
}

.lb-over-narrow { display: none; }

.lb-tagline {
  margin: 10px 0 0;
  line-height: 1.25;
  color: var(--lb-text-muted);
}

/* The board between two violet pixel rules. */
.lb-board {
  min-height: 0;
  margin: 14px 0 12px;
  padding: 6px 0 0;
  border-top: 2px solid #54259e;
  border-bottom: 2px solid #54259e;
}

.lb-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lb-row {
  display: grid;
  grid-template-columns: 32px 24px 1fr auto auto;
  align-items: center;
  column-gap: 10px;
  height: 32px;
  padding: 0 8px;
  box-sizing: border-box;
  white-space: nowrap;
}

.lb-rank { color: var(--lb-text-subtle); }

.lb-row--podium .lb-rank {
  color: var(--lb-gold);
  text-shadow: var(--lb-shadow);
}

.lb-name {
  overflow: hidden;
  text-overflow: clip;
  color: var(--lb-text);
  text-shadow: var(--lb-shadow);
}

/* The pilot on the pixel grid: 12×12 painting pixels at 2 CSS px each,
   inside a one-pixel edge (2 CSS px, like the font's pixels). */
.lb-avatar {
  display: block;
  width: 24px;
  height: 24px;
  box-shadow: 0 0 0 2px #2a1f4a;
  background: #140b26;
}

.lb-row--podium .lb-avatar { box-shadow: 0 0 0 2px #c4861c; }

.lb-row--me .lb-avatar,
.lb-avatar--me { box-shadow: 0 0 0 2px var(--lb-pink); }

.lb-you {
  display: none;
  color: var(--lb-pink);
}

.lb-score {
  color: var(--lb-accent);
  text-shadow: var(--lb-shadow);
}

/* You: the pink row, a small dialog box of its own. */
.lb-row--me {
  margin: 4px 2px;
  background: rgba(255, 47, 160, .16);
  box-shadow: 0 -2px 0 0 var(--lb-pink), 0 2px 0 0 var(--lb-pink), -2px 0 0 0 var(--lb-pink), 2px 0 0 0 var(--lb-pink);
  height: 28px;
}

.lb-row--me .lb-name { color: var(--lb-pink); }
.lb-row--me .lb-you { display: inline; }

.lb-row--gap {
  grid-template-columns: 1fr;
  text-align: center;
  color: var(--lb-text-subtle);
}

.lb-empty {
  margin: 0;
  min-height: 96px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  text-align: center;
  color: var(--lb-text);
  text-shadow: var(--lb-shadow);
}

.lb-empty span { color: var(--lb-pink); }

.lb-nudge {
  margin: 8px 0 8px;
  text-align: center;
  line-height: 1.25;
  color: var(--lb-text-subtle);
}

/* Footer: who this browser is. */
.lb-footer {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 14px;
}

.lb-footer-label { color: var(--lb-text-subtle); }

.lb-footer-who {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.lb-avatar--me {
  flex: none;
  width: 32px;
  height: 32px;
}

/* Painting in progress: the edge blinks, stepped, until the picture lands. */
.lb-avatar--pending { animation: lb-blink 1.2s steps(1) infinite; }

@keyframes lb-blink {
  50% { box-shadow: 0 0 0 2px #54259e; }
}

@media (prefers-reduced-motion: reduce) {
  .lb-avatar--pending { animation: none; }
}

.lb-footer-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  color: var(--lb-pink);
  text-shadow: var(--lb-shadow);
}

/* The game rail: one square pip per game, beside the panel. */
.lb-rail {
  position: absolute;
  z-index: 2;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  gap: 8px;
}

.lb-rail-pip {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: #2a1f4a;
  box-shadow: inset 0 0 0 2px #0b0616;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.lb-rail-pip:hover,
.lb-rail-pip:focus-visible { outline: none; background: #54259e; }

.lb-rail-pip.active { background: var(--lb-accent); }

.lb-hint {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: calc(40px + var(--app-safe-bottom, 0px));
  margin: 0;
  text-align: center;
  color: var(--lb-pink);
  text-shadow: var(--lb-shadow);
}

/* The switch between games is the site's 180 ms fade, nothing more. */
.lb-fade-enter-active,
.lb-fade-leave-active { transition: opacity 180ms ease; }
.lb-fade-enter-from,
.lb-fade-leave-to { opacity: 0; }

/* Wide screens: the panel sits left, the statue and its arch on the right. */
@media (min-width: 900px) and (min-height: 620px) {
  .lb-landing {
    justify-items: start;
    padding-left: clamp(48px, 9vw, 150px);
  }
  .lb-rail { right: auto; left: calc(clamp(48px, 9vw, 150px) + min(480px, 100%) + 20px); }
}

/* Phones and short screens: no rail, no hint; the title steps down. */
@media (max-width: 640px), (max-height: 700px) {
  .lb-landing { padding: 56px 12px calc(56px + var(--app-safe-bottom, 0px)); }
  .lb-panel { padding: 14px 12px 12px; }
  .lb-hud { display: none; }
  .lb-over-wide { display: none; }
  .lb-over-narrow { display: inline; }
  .lb-title-row { grid-template-columns: 24px 1fr 24px; }
  .lb-step { width: 24px; height: 24px; }
  .lb-title { font-size: 24px; text-shadow: 2px 2px 0 #0b0616; }
  .lb-row { padding: 0 6px; column-gap: 8px; grid-template-columns: 24px 24px 1fr auto auto; }
  .lb-rail { display: none; }
  .lb-hint { display: none; }
}

@media (max-height: 560px) {
  .lb-hud { display: none; }
  /* Landscape phones: the panel keeps left of the radio (top-right). */
  .lb-landing { justify-items: start; padding: 8px 12px calc(12px + var(--app-safe-bottom, 0px)); }
  .lb-panel { width: min(560px, calc(100vw - 300px)); }
  .lb-row .lb-you { display: none; }
  .lb-over, .lb-tagline { display: none; }
  .lb-board { margin: 8px 0 6px; padding-top: 4px; }
  .lb-nudge { margin: 4px 0 2px; }
}

/* Narrow phones: the pink row says "you" on its own; long titles step down. */
@media (max-width: 460px) {
  .lb-row .lb-you { display: none; }
}

</style>
