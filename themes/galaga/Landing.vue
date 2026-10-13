<template>
  <div class="voyagers" :class="{ 'voyagers--side': side, 'voyagers--under': side === false }" :style="{ '--vk': k, '--vg': kg }">
    <ClientOnly>
      <Game v-if="loaded" ref="game" :pilot="pilot" @started="onStarted" @score="onScore" @over="onOver" />
    </ClientOnly>

    <!-- The title: server-rendered, so the first paint is already this. A tap anywhere starts; a tap on a portrait chooses. -->
    <div v-if="phase === 'title' || phase === 'loading'" class="voyagers-screen voyagers-title" @click="startRun">
      <div class="voyagers-card">
        <h1 class="voyagers-name">
          <span class="voyagers-name__top">REX &amp; NOVA</span>
          <span class="voyagers-name__sub">SPACE VOYAGERS I</span>
        </h1>
      </div>
      <div class="voyagers-side">
        <div class="voyagers-pilots" role="radiogroup" aria-label="Choose your pilot">
          <button
            v-for="p in PILOTS"
            :key="p.id"
            type="button"
            class="voyagers-pilot"
            :class="{ 'voyagers-pilot--on': pilot === p.id }"
            role="radio"
            :aria-checked="pilot === p.id"
            @click.stop="choose(p.id)"
          >
            <span class="voyagers-face" :style="{ backgroundImage: `url(/galaga/${p.face}.png)` }" aria-hidden="true" />
            <span class="voyagers-pilot__name">{{ p.name }}</span>
            <span class="voyagers-pilot__ship">{{ p.ship }}</span>
          </button>
        </div>
        <p class="voyagers-hint voyagers-blink">{{ phase === 'loading' ? 'WARMING THE TUBES' : hint('PRESS ENTER TO START', 'TAP TO START') }}</p>
        <p v-if="highScore > 0" class="voyagers-line">HIGH SCORE {{ highScore }}</p>
        <!-- Each control is one unbroken phrase, so a narrow column breaks the line between two of them. -->
        <p class="voyagers-line voyagers-dim voyagers-keys">
          <span v-for="c in hint(KEYS, TOUCH).split('|')" :key="c">{{ c }}</span>
        </p>
        <p class="voyagers-line voyagers-copy">(C) Sleepy Productions, 2Q89</p>
      </div>
    </div>

    <!-- Game over: how far the run got, over the field where it stopped. -->
    <div v-else-if="phase === 'over'" class="voyagers-screen voyagers-over" @click="startRun">
      <div class="voyagers-panel" :class="{ 'voyagers-panel--row': overRow }">
        <div v-if="delivered && overPicture" class="voyagers-ending" aria-hidden="true" />
        <div class="voyagers-panel__words">
          <h2 class="voyagers-over__title">GAME OVER</h2>
          <p class="voyagers-line">SCORE {{ score }}</p>
          <p v-if="delivered" class="voyagers-line voyagers-gold">PIZZA DELIVERED{{ reached && reached.voyage > 2 ? ` X${reached.voyage - 1}` : '' }}</p>
          <p v-if="reached" class="voyagers-line voyagers-dim">{{ reachedLine[0] }}</p>
          <p v-if="reached" class="voyagers-line voyagers-dim">{{ reachedLine[1] }}</p>
          <p v-if="isBest" class="voyagers-line voyagers-gold voyagers-blink">NEW HIGH SCORE</p>
          <p v-else class="voyagers-line voyagers-dim">HIGH SCORE {{ highScore }}</p>
          <p v-if="rank" class="voyagers-line voyagers-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
          <div class="voyagers-pilots voyagers-pilots--small" role="radiogroup" aria-label="Choose your pilot">
            <button
              v-for="p in PILOTS"
              :key="p.id"
              type="button"
              class="voyagers-pilot"
              :class="{ 'voyagers-pilot--on': pilot === p.id }"
              role="radio"
              :aria-checked="pilot === p.id"
              @click.stop="choose(p.id)"
            >
              <span class="voyagers-pilot__name">{{ p.name }}</span>
            </button>
          </div>
          <p class="voyagers-hint voyagers-blink">{{ hint('ENTER TO FLY AGAIN', 'TAP TO FLY AGAIN') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Rex & Nova: Space Voyagers I, the title and the game-over screen. The
 * game itself is `Game.vue`, its own chunk: it is asked for by the tap or
 * key that starts the first run, so `/` never pays for it (AGENTS.md, "What
 * `/` costs"). The title is HTML over `card-title.png`, lettered here in the
 * pixel font, and server-renders.
 */
import { safeBottom } from '~/themes/base/safeBottom'
import type { RunReport } from './Game.vue'
import type { PilotId } from './story/cues'

const Game = defineAsyncComponent(() => import('./Game.vue'))

const PILOTS: readonly { id: PilotId; name: string; ship: string; face: string }[] = [
  { id: 'nova', name: 'NOVA', ship: 'THE SCOOTER', face: 'portrait-nova-calm' },
  { id: 'rex', name: 'REX', ship: 'THE WAGON', face: 'portrait-rex-cheerful' },
]
const KEYS = 'LEFT RIGHT PICK|ARROWS FLY|SPACE FIRE|SHIFT DUET'
const TOUCH = 'TAP A FACE TO PICK|DRAG TO FLY|TWO FINGERS DUET'
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

const HIGH_SCORE_KEY = 'galagaHighScore'
const PILOT_KEY = 'voyagers.pilot'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
const { hint } = useInputMode()
const radio = useRadio()

const phase = ref<'title' | 'loading' | 'playing' | 'over'>('title')
const loaded = ref(false)
const game = ref<{ start: (pilot: PilotId) => void } | null>(null)
const pilot = ref<PilotId>('rex')
const score = ref(0)
const highScore = ref(0)
const isBest = ref(false)
const reached = ref<RunReport | null>(null)
/**
 * CSS pixels per pixel of the title: the card, the portraits and every letter are drawn at this
 * one size, a whole number of device pixels, set once the screen is known. `kg` is the same for
 * the game-over panel: the size of the game's own pixels, so the panel is lettered like the field under it.
 */
const k = ref<number | undefined>(undefined)
const kg = ref<number | undefined>(undefined)
/** The pilots stand beside the card, not under it. Unknown until the screen is. */
const side = ref<boolean | undefined>(undefined)
/** Game over after a finished voyage: is there room for the ending picture, and does it stand beside the words? */
const overRow = ref(false)
const overPicture = ref(false)
let overAt = 0

/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'galaga' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const delivered = computed(() => (reached.value?.voyage ?? 1) > 1)
const reachedLine = computed(() => {
  const r = reached.value
  if (!r) return ['', '']
  const where = r.stage === 'boss' ? 'THE BOSS' : r.stage === 'bonus' ? 'BONUS RUN' : r.wave > 0 ? `WAVE ${r.wave}` : ''
  // Two rows: the whole of it is wider than a phone's field.
  return [`VOYAGE ${ROMAN[r.voyage] ?? r.voyage} · SECTOR ${r.sector}`, `${r.sectorName}${where ? ` · ${where}` : ''}`]
})

function choose(id: PilotId): void {
  pilot.value = id
  try {
    localStorage.setItem(PILOT_KEY, id)
  } catch {
    // private mode: the choice lasts this visit
  }
}

function startRun(): void {
  if (phase.value === 'playing' || phase.value === 'loading') return
  // The click or key that ended the run must not start the next one.
  if (phase.value === 'over' && performance.now() - overAt < 700) return
  // The site's radio is the music: start it inside this gesture.
  radio.ensurePlaying()
  navigationLocked.value = true
  if (game.value) {
    game.value.start(pilot.value)
    return
  }
  // The first run: Game.vue arrives as its own chunk and starts itself when mounted.
  phase.value = 'loading'
  loaded.value = true
}

function onStarted(): void {
  phase.value = 'playing'
  navigationLocked.value = true
  score.value = 0
}

function onScore(s: number): void {
  score.value = s
}

function onOver(report: RunReport): void {
  reached.value = report
  kg.value = report.px
  // The panel is 240 of the game's pixels across; with the picture, twice that or 420 rows.
  const lw = window.innerWidth / report.px
  const lh = (window.innerHeight - safeBottom()) / report.px
  overRow.value = report.voyage > 1 && lw >= 496 && lh >= 216
  overPicture.value = overRow.value || lh >= 420
  score.value = report.score
  phase.value = 'over'
  overAt = performance.now()
  navigationLocked.value = false
  // A score of 0 is never sent.
  if (report.score > 0) submitScore('galaga', report.score)
  isBest.value = report.score > 0 && report.score >= highScore.value
  if (report.score > highScore.value) {
    highScore.value = report.score
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(report.score))
    } catch {
      // private mode
    }
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (phase.value !== 'title' && phase.value !== 'over') return
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { choose('nova'); e.preventDefault() } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { choose('rex'); e.preventDefault() } else if (e.code === 'Enter' || (e.code === 'Space' && phase.value === 'title')) {
    if (e.repeat) return
    e.preventDefault()
    startRun()
  }
}

/** What the title measures in its own pixels: the card, the column of pilots and words, and the gap between them. */
const CARD_W = 240
const CARD_H = 320
const SIDE_W = 240
const SIDE_GAP = 24
/** The rows under the card when the pilots stand under it: the two portraits, the hint and four lines. */
const UNDER_H = 184

/**
 * The title at the largest whole number of device pixels at which all of it fits above the
 * site's bottom band: the pilots under the card (a phone), or beside it when that is larger
 * (a wide screen, a phone on its side). One pixel size for everything on it.
 */
function fit(): void {
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight - safeBottom()
  const scale = (pxW: number, pxH: number, availH: number): number => Math.max(1, Math.floor(Math.min((w * dpr) / pxW, (availH * dpr) / pxH)))
  const under = scale(CARD_W, CARD_H + UNDER_H, h)
  const beside = w >= 560 ? scale(CARD_W + SIDE_GAP + SIDE_W, CARD_H, h - 24) : 0
  side.value = beside > under || (beside === under && w > h)
  k.value = Math.max(under, beside) / dpr
}

onMounted(() => {
  try {
    // The theme was `hacker` until 2026-09-08: a returning player's best is kept through the old key.
    const stored = localStorage.getItem(HIGH_SCORE_KEY) ?? localStorage.getItem('hackerHighScore')
    highScore.value = parseInt(stored || '0', 10) || 0
    if (localStorage.getItem(PILOT_KEY) === 'nova') pilot.value = 'nova'
  } catch {
    // storage unavailable
  }
  fit()
  window.addEventListener('resize', fit)
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  navigationLocked.value = false
  window.removeEventListener('resize', fit)
  window.removeEventListener('keydown', onKeyDown)
})
</script>
