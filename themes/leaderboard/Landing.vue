<template>
  <!-- Owns the page: the world ranking over the Neon Dreams horizon. One
       game at a time; up/down walks the games, left/right still walks the
       themes, so nothing here locks the shell's navigation. -->
  <div ref="landing" class="lb-landing">
    <Horizon />

    <p class="lb-hud lb-hud--left">HALL OF FAME</p>
    <p class="lb-hud lb-hud--right">PHAREIM.NO</p>

    <section ref="panel" class="lb-panel" aria-live="polite">
      <span class="lb-tick lb-tick--tl" aria-hidden="true" />
      <span class="lb-tick lb-tick--tr" aria-hidden="true" />
      <span class="lb-tick lb-tick--bl" aria-hidden="true" />
      <span class="lb-tick lb-tick--br" aria-hidden="true" />

      <header class="lb-head">
        <p class="lb-over">WORLD RANKING · {{ pad(index + 1) }} / {{ pad(GAMES.length) }}</p>
        <div class="lb-title-row">
          <button class="lb-step" aria-label="Previous game" @click="step(-1)">▲</button>
          <Transition name="lb-fade" mode="out-in">
            <h1 :key="game.id" class="lb-title">{{ game.title }}</h1>
          </Transition>
          <button class="lb-step" aria-label="Next game" @click="step(1)">▼</button>
        </div>
        <p class="lb-tagline">{{ game.tagline }}</p>
      </header>

      <Transition name="lb-fade" mode="out-in">
        <div :key="game.id" ref="boardEl" class="lb-board">
          <ol v-if="visible.length" class="lb-rows">
            <li
              v-for="row in visible"
              :key="row.playerId"
              class="lb-row"
              :class="{ 'lb-row--me': row.playerId === player?.id, 'lb-row--podium': row.rank <= 3 }"
            >
              <span class="lb-rank">{{ pad(row.rank) }}</span>
              <span class="lb-name">{{ row.name.toUpperCase() }}</span>
              <span class="lb-you" aria-hidden="true">◀ YOU</span>
              <span class="lb-score">{{ fmt(row.score) }}</span>
            </li>
            <li v-if="gapBeforeMe" class="lb-row lb-row--gap" aria-hidden="true">· · ·</li>
            <li v-if="meOutside" class="lb-row lb-row--me">
              <span class="lb-rank">{{ pad(meOutside.rank) }}</span>
              <span class="lb-name">{{ meOutside.name.toUpperCase() }}</span>
              <span class="lb-you" aria-hidden="true">◀ YOU</span>
              <span class="lb-score">{{ fmt(meOutside.score) }}</span>
            </li>
          </ol>
          <p v-else-if="status === 'loading'" class="lb-empty">SYNCING…</p>
          <p v-else-if="status === 'error'" class="lb-empty">OFFLINE<br><span>THE BOARD DID NOT ANSWER</span></p>
          <p v-else class="lb-empty">NO SCORES YET<br><span>BE THE FIRST</span></p>
          <p v-if="status === 'ready' && board && board.total > 0 && !board.me" class="lb-nudge">
            NO RUN YET · PLAY {{ game.title.toUpperCase() }} TO ENTER
          </p>
          <p v-else-if="board?.me" class="lb-nudge">
            RANK {{ board.me.rank }} OF {{ board.total }} · BEST {{ fmt(board.me.score) }}
          </p>
        </div>
      </Transition>

      <footer class="lb-footer">
        <span class="lb-footer-label">YOU ARE</span>
        <span class="lb-footer-name">{{ player ? player.name.toUpperCase() : '· · ·' }}</span>
        <button class="lb-reroll" :disabled="rolling || !player" @click="onReroll">
          {{ rolling ? 'ROLLING…' : 'REROLL' }}
        </button>
      </footer>
    </section>

    <nav class="lb-rail" aria-label="Game">
      <button
        v-for="(g, i) in GAMES"
        :key="g.id"
        class="lb-rail-dot"
        :class="{ active: i === index }"
        :title="g.title"
        :aria-label="g.title"
        :aria-current="i === index ? 'true' : undefined"
        @click="go(i)"
      />
    </nav>

    <p class="lb-hint">{{ hint('↑ ↓ MORE GAMES · ← → THE ARCADE', 'SWIPE ↕ GAMES · ↔ ARCADE') }}</p>
  </div>
</template>

<script setup lang="ts">
import Horizon from './Horizon.vue'
import { GAMES, TOP_N, type BoardRow, type GameBoard } from './games'

const { hint } = useInputMode()
const { player, fetchBoards, reroll } = useLeaderboard()

const landing = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const boardEl = ref<HTMLElement | null>(null)

const index = ref(0)
const game = computed(() => GAMES[index.value])

const boards = ref<Record<string, GameBoard> | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const rolling = ref(false)

const board = computed(() => boards.value?.[game.value.id] ?? null)

/** How many rows fit in the space the viewport leaves the board. */
const rowsFit = ref(TOP_N)
const ROW_PX = 30
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

async function load(): Promise<void> {
  status.value = boards.value ? 'ready' : 'loading'
  try {
    const data = await fetchBoards()
    boards.value = data.boards
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

async function onReroll(): Promise<void> {
  if (rolling.value) return
  rolling.value = true
  try {
    await reroll()
    await load()
  } catch {
    // keep the old name; the board simply did not answer
  } finally {
    rolling.value = false
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
  const nudge = 28 // the line under the rows
  rowsFit.value = Math.max(MIN_ROWS, Math.min(TOP_N, Math.floor((available - chrome - nudge) / ROW_PX)))
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
})

watch(index, () => nextTick(fit))
</script>

<style scoped>
.lb-landing {
  position: relative;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  touch-action: none;
  display: grid;
  place-items: center;
  padding: 12px;
  box-sizing: border-box;
}

/* The machine speaks: mono, uppercase, tracked. */
.lb-hud,
.lb-over,
.lb-title,
.lb-tagline,
.lb-rows,
.lb-empty,
.lb-nudge,
.lb-footer,
.lb-step,
.lb-reroll,
.lb-hint {
  font-family: var(--font-machine);
  text-transform: uppercase;
  letter-spacing: .15em;
}

.lb-hud {
  position: absolute;
  z-index: 2;
  top: 16px;
  margin: 0;
  font-size: 10.4px;
  color: var(--lb-text-subtle);
}

.lb-hud--left { left: 18px; }
.lb-hud--right { right: 18px; }

/* Blueprint panel, as on Player One. */
.lb-panel {
  position: relative;
  z-index: 2;
  width: min(460px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 22px 16px;
  box-sizing: border-box;
  background: var(--lb-card-bg);
  border: 1px solid rgba(47, 243, 255, .28);
  border-radius: 4px;
  box-shadow: 0 0 24px var(--lb-card-shadow);
}

.lb-tick {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 0 solid var(--lb-accent);
  opacity: .8;
}

.lb-tick--tl { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; }
.lb-tick--tr { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; }
.lb-tick--bl { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; }
.lb-tick--br { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; }

.lb-head { text-align: center; }

.lb-over {
  margin: 0 0 6px;
  font-size: 10.4px;
  color: var(--lb-text-subtle);
}

.lb-title-row {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
}

.lb-title {
  margin: 0;
  font-size: 26px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--lb-accent);
  text-shadow: 0 0 8px rgba(47, 243, 255, .65), 0 0 24px rgba(255, 47, 160, .35);
  letter-spacing: .12em;
}

.lb-step {
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--lb-pink);
  font-size: 12px;
  cursor: pointer;
  text-shadow: 0 0 10px rgba(255, 47, 160, .6);
  -webkit-tap-highlight-color: transparent;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.lb-step:hover,
.lb-step:focus-visible {
  border-color: rgba(255, 47, 160, .4);
  background: rgba(255, 47, 160, .1);
  outline: none;
}

.lb-tagline {
  margin: 4px 0 0;
  font-size: 10.4px;
  color: var(--lb-text-subtle);
  letter-spacing: .12em;
}

/* The board: a rule above, rows in three columns, a rule below. */
.lb-board {
  min-height: 0;
  margin: 12px 0 10px;
  padding: 8px 0 0;
  border-top: 1px solid rgba(255, 47, 160, .25);
  border-bottom: 1px solid rgba(255, 47, 160, .25);
}

.lb-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lb-row {
  display: grid;
  grid-template-columns: 30px 1fr auto auto;
  align-items: center;
  column-gap: 10px;
  height: 30px;
  padding: 0 8px;
  box-sizing: border-box;
  font-size: 12px;
  border: 1px solid transparent;
  border-radius: 3px;
  white-space: nowrap;
}

.lb-rank {
  color: var(--lb-text-subtle);
  font-variant-numeric: tabular-nums;
}

.lb-row--podium .lb-rank {
  color: var(--lb-gold);
  text-shadow: 0 0 8px rgba(255, 210, 63, .6);
}

.lb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--lb-text);
}

.lb-you {
  display: none;
  font-size: 9.6px;
  color: var(--lb-pink);
  letter-spacing: .12em;
}

.lb-score {
  color: var(--lb-accent);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 8px rgba(47, 243, 255, .45);
}

/* You: the pink row. */
.lb-row--me {
  border-color: rgba(255, 47, 160, .55);
  background: rgba(255, 47, 160, .1);
  box-shadow: 0 0 14px rgba(255, 47, 160, .25), inset 0 0 12px rgba(255, 47, 160, .08);
}

.lb-row--me .lb-name {
  color: var(--lb-pink);
  text-shadow: 0 0 8px rgba(255, 47, 160, .6);
}

.lb-row--me .lb-you { display: inline; }

.lb-row--gap {
  justify-content: center;
  grid-template-columns: 1fr;
  text-align: center;
  color: var(--lb-text-subtle);
  height: 30px;
}

.lb-empty {
  margin: 0;
  min-height: 90px;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 12px;
  line-height: 1.8;
  color: var(--lb-text-muted);
}

.lb-empty span {
  font-size: 10.4px;
  color: var(--lb-text-subtle);
}

.lb-nudge {
  margin: 8px 0 6px;
  text-align: center;
  font-size: 9.6px;
  line-height: 1.4;
  color: var(--lb-text-subtle);
  letter-spacing: .12em;
}

/* Footer: who this browser is, and the reroll. */
.lb-footer {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: 12px;
  font-size: 10.4px;
}

.lb-footer-label { color: var(--lb-text-subtle); }

.lb-footer-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--lb-pink);
  text-shadow: 0 0 8px rgba(255, 47, 160, .6);
}

.lb-reroll {
  min-height: 34px;
  padding: 0 12px;
  background: transparent;
  border: 1px solid rgba(255, 47, 160, .4);
  border-radius: 3px;
  color: var(--lb-text);
  font-size: 10.4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}

.lb-reroll:hover:not(:disabled),
.lb-reroll:focus-visible {
  background: rgba(255, 47, 160, .12);
  border-color: var(--lb-pink);
  box-shadow: 0 0 18px rgba(255, 47, 160, .3);
  outline: none;
}

.lb-reroll:active:not(:disabled) { transform: translateY(1px); }
.lb-reroll:disabled { opacity: .5; cursor: default; }

/* The game rail: one dot per game, beside the panel. */
.lb-rail {
  position: absolute;
  z-index: 2;
  right: 5.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  gap: 10px;
}

.lb-rail-dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--lb-text-subtle);
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 120ms ease, box-shadow 120ms ease;
}

.lb-rail-dot.active {
  border-color: var(--lb-accent);
  background: var(--lb-accent);
  box-shadow: 0 0 8px rgba(47, 243, 255, .8);
}

.lb-hint {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 42px;
  margin: 0;
  text-align: center;
  font-size: 11.2px;
  letter-spacing: .12em;
  color: var(--lb-text-subtle);
  text-shadow: 0 0 10px rgba(255, 47, 160, .6);
}

/* The switch between games is the site's 180 ms fade, nothing more. */
.lb-fade-enter-active,
.lb-fade-leave-active { transition: opacity 180ms ease; }
.lb-fade-enter-from,
.lb-fade-leave-to { opacity: 0; }

/* Wide screens: the panel sits left of centre so the striped sun reads. */
@media (min-width: 900px) and (min-height: 620px) {
  .lb-landing {
    justify-items: start;
    padding-left: clamp(48px, 10vw, 160px);
  }
  .lb-rail { right: auto; left: calc(clamp(48px, 10vw, 160px) + min(460px, 100%) + 18px); }
}

/* Phones: room for the pager chevrons; the dots rail and hint go. */
@media (max-width: 640px), (max-height: 700px) {
  .lb-landing { padding: 10px 46px 48px; }
  .lb-panel { padding: 14px 14px 12px; }
  .lb-title { font-size: 22px; }
  .lb-row { padding: 0 6px; column-gap: 8px; font-size: 11.2px; letter-spacing: .1em; }
  .lb-footer-name { letter-spacing: .1em; }
  .lb-rail { display: none; }
  .lb-hint { display: none; }
}

@media (max-height: 560px) {
  .lb-hud { display: none; }
  .lb-landing { padding: 8px 46px 26px; }
  .lb-panel { width: min(560px, 100%); }
  .lb-over, .lb-tagline { display: none; }
  .lb-board { margin: 8px 0 6px; padding-top: 4px; }
  .lb-nudge { margin: 4px 0 2px; }
}

/* Narrow phones: the pink row says "you" on its own. */
@media (max-width: 420px) {
  .lb-row .lb-you { display: none; }
  .lb-row { letter-spacing: .08em; }
}

@media (max-width: 380px) {
  .lb-title { font-size: 19px; }
}
</style>
