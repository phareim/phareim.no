<template>
  <div class="vg2" :style="{ '--vk': k }">
    <ClientOnly>
      <Game v-if="loaded" ref="game" :pilot="pilot" @started="onStarted" @over="onOver" />
    </ClientOnly>

    <!-- The title: server-rendered. A tap anywhere launches; a tap on a face chooses who you are. -->
    <div v-if="phase === 'title' || phase === 'loading'" class="vg2-screen vg2-title" @click="launch">
      <div class="vg2-card">
        <h1 class="vg2-name">
          <span class="vg2-name__top">REX &amp; NOVA</span>
          <span class="vg2-name__sub">SPACE VOYAGERS II</span>
          <span class="vg2-name__tag">HEART OF THE OVEN</span>
        </h1>
      </div>
      <div class="vg2-side">
        <p class="vg2-line vg2-dim">WHO ARE YOU?</p>
        <div class="vg2-pilots" role="radiogroup" aria-label="Choose who you are">
          <button
            v-for="p in PILOTS"
            :key="p.id"
            type="button"
            class="vg2-pilot"
            :class="{ 'vg2-pilot--on': pilot === p.id }"
            role="radio"
            :aria-checked="pilot === p.id"
            @click.stop="choose(p.id)"
          >
            <span class="vg2-face" :style="{ backgroundImage: `url(/galaga/${p.face}.png)` }" aria-hidden="true" />
            <span class="vg2-pilot__name">{{ p.name }}</span>
          </button>
        </div>
        <p class="vg2-line vg2-dim">ONE SHIP, TWO SEATS. YOU FLY, {{ other }} HAS THE TURRET.</p>
        <p class="vg2-hint vg2-blink">{{ phase === 'loading' ? 'WARMING THE TUBES' : hint('PRESS ENTER TO LAUNCH', 'TAP TO LAUNCH') }}</p>
        <p v-if="best > 0" class="vg2-line">BEST {{ best }}</p>
        <p class="vg2-line vg2-dim vg2-keys">
          <span v-for="c in hint(KEYS, TOUCH).split('|')" :key="c">{{ c }}</span>
        </p>
        <p class="vg2-line vg2-copy">(C) Sleepy Productions, 3Q89</p>
      </div>
    </div>

    <!-- The debrief. -->
    <div v-else-if="phase === 'over' && result" class="vg2-screen vg2-over" @click="launch">
      <div class="vg2-panel">
        <p class="vg2-line vg2-dim">DEBRIEF · {{ result.mission }}</p>
        <h2 class="vg2-over__title" :class="result.result === 'won' ? 'vg2-gold' : 'vg2-red'">{{ result.result === 'won' ? 'SORTIE WON' : 'SORTIE LOST' }}</h2>
        <p class="vg2-line">{{ WHY[result.why] ?? '' }}</p>
        <p class="vg2-line">KILLS {{ result.kills }} · {{ Math.floor(result.secs / 60) }}:{{ String(result.secs % 60).padStart(2, '0') }}</p>
        <p class="vg2-line">SCORE {{ result.score }}</p>
        <p v-if="isBest" class="vg2-line vg2-gold vg2-blink">NEW BEST</p>
        <div class="vg2-pilots vg2-pilots--small" role="radiogroup" aria-label="Choose who you are">
          <button
            v-for="p in PILOTS"
            :key="p.id"
            type="button"
            class="vg2-pilot"
            :class="{ 'vg2-pilot--on': pilot === p.id }"
            role="radio"
            :aria-checked="pilot === p.id"
            @click.stop="choose(p.id)"
          >
            <span class="vg2-pilot__name">{{ p.name }}</span>
          </button>
        </div>
        <p class="vg2-hint vg2-blink">{{ hint('ENTER TO FLY AGAIN', 'TAP TO FLY AGAIN') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Rex & Nova: Space Voyagers II, the title and the debrief. The game itself
 * is `Game.vue`, its own chunk, asked for by the tap or key that launches
 * the first sortie, so `/` never pays for it or for three.js (AGENTS.md,
 * "What `/` costs").
 */
import type { SortieReport } from './Game.vue'
import type { PilotId } from './engine/types'

const Game = defineAsyncComponent(() => import('./Game.vue'))

const PILOTS: readonly { id: PilotId; name: string; face: string }[] = [
  { id: 'nova', name: 'NOVA', face: 'portrait-nova-calm' },
  { id: 'rex', name: 'REX', face: 'portrait-rex-cheerful' },
]
const KEYS = 'ARROWS FLY|SPACE GUNS|ENTER MISSILE|TAB BURN|T TARGET|X SWAP SEATS|C COMMS|N AUTOPILOT'
const TOUCH = 'LEFT THUMB FLIES|GUNS FIRE ON THE DIAMOND|TAP A SCREEN|TAP THE SEATS TO SWAP'
const WHY: Record<string, string> = {
  landed: 'HOME THROUGH THE OVEN DOOR.',
  eject: 'THE CALZONE IS LOST. YOU BOTH GOT OUT.',
  carrier: 'THE DEEP DISH IS LOST.',
  target: 'THE TARGET GOT AWAY.',
  quit: 'YOU TURNED BACK.',
}
const BEST_KEY = 'voyagers2.best'
const PILOT_KEY = 'voyagers2.pilot'

const { navigationLocked } = useTheme()
const { hint } = useInputMode()
const radio = useRadio()

const phase = ref<'title' | 'loading' | 'playing' | 'over'>('title')
const loaded = ref(false)
const game = ref<{ start: (pilot: PilotId) => void } | null>(null)
const pilot = ref<PilotId>('rex')
const best = ref(0)
const isBest = ref(false)
const result = ref<SortieReport | null>(null)
const k = ref<number | undefined>(undefined)
let overAt = 0

const other = computed(() => (pilot.value === 'rex' ? 'NOVA' : 'REX'))

function choose(id: PilotId): void {
  pilot.value = id
  try { localStorage.setItem(PILOT_KEY, id) } catch { /* private mode */ }
}

function launch(): void {
  if (phase.value === 'playing' || phase.value === 'loading') return
  if (phase.value === 'over' && performance.now() - overAt < 700) return
  radio.ensurePlaying()
  navigationLocked.value = true
  if (game.value) {
    game.value.start(pilot.value)
    return
  }
  phase.value = 'loading'
  loaded.value = true
}

function onStarted(): void {
  phase.value = 'playing'
  navigationLocked.value = true
}

function onOver(r: SortieReport): void {
  result.value = r
  phase.value = 'over'
  overAt = performance.now()
  navigationLocked.value = false
  isBest.value = r.score > 0 && r.score > best.value
  if (r.score > best.value) {
    best.value = r.score
    try { localStorage.setItem(BEST_KEY, String(r.score)) } catch { /* private mode */ }
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (phase.value !== 'title' && phase.value !== 'over') return
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { choose('nova'); e.preventDefault() } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { choose('rex'); e.preventDefault() } else if (e.code === 'Enter' || (e.code === 'Space' && phase.value === 'title')) {
    if (e.repeat) return
    e.preventDefault()
    launch()
  }
}

/** One pixel size for the title: the card (240 × 320) and the column under or beside it, whole device pixels. */
function fit(): void {
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  const under = Math.max(1, Math.floor(Math.min((w * dpr) / 240, (h * dpr) / (320 + 170))))
  const beside = w >= 560 ? Math.max(1, Math.floor(Math.min((w * dpr) / (240 + 24 + 260), (h * dpr) / 330))) : 0
  k.value = Math.max(under, beside) / dpr
}

onMounted(() => {
  try {
    best.value = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0
    if (localStorage.getItem(PILOT_KEY) === 'nova') pilot.value = 'nova'
  } catch { /* storage unavailable */ }
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
