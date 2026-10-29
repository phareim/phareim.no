<template>
  <div class="vg2" :style="{ '--vk': k }">
    <ClientOnly>
      <Campaign v-if="campaign" :initial="campaign" :best="best" @title="backToTitle" @best="onBest" @ready="loading = false" />
    </ClientOnly>

    <!-- The title: server-rendered, so the first paint is already this. -->
    <div v-if="!campaign || loading" class="vg2-screen vg2-title" @click="primary">
      <div class="vg2-card">
        <h1 class="vg2-name">
          <span class="vg2-name__top">REX &amp; NOVA</span>
          <span class="vg2-name__sub">SPACE VOYAGERS II</span>
          <span class="vg2-name__tag">HEART OF THE OVEN</span>
        </h1>
      </div>
      <div class="vg2-side">
        <template v-if="saved && !isEnd(saved.next)">
          <p class="vg2-line vg2-dim">SORTIE {{ saved.history.length + 1 }} OF 8 · {{ titleOf(saved.next) }}</p>
          <p class="vg2-line vg2-dim">YOU ARE {{ saved.pilot.toUpperCase() }} · SCORE {{ saved.score }}</p>
          <p class="vg2-hint vg2-blink">{{ loading ? 'WARMING THE TUBES' : hint('PRESS ENTER TO CONTINUE', 'TAP TO CONTINUE') }}</p>
          <button type="button" class="vg2-btn" @click.stop="newCampaign">NEW CAMPAIGN</button>
        </template>
        <template v-else>
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
          <p class="vg2-hint vg2-blink">{{ loading ? 'WARMING THE TUBES' : hint('PRESS ENTER TO START', 'TAP TO START') }}</p>
        </template>
        <p v-if="best > 0" class="vg2-line">BEST CAMPAIGN {{ best }}</p>
        <p class="vg2-line vg2-dim vg2-keys">
          <span v-for="c in hint(KEYS, TOUCH).split('|')" :key="c">{{ c }}</span>
        </p>
        <p class="vg2-line vg2-copy">(C) Sleepy Productions, 3Q89</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Rex & Nova: Space Voyagers II, the title: new campaign or go on with the
 * saved one, who you are. Everything after it is `Campaign.vue`, its own
 * chunk, asked for by the tap or key that leaves the title, so `/` pays for
 * the title alone (AGENTS.md, "What `/` costs").
 */
import { isEnd, newSave, readSave, SORTIE_TITLES } from './engine/campaign'
import type { Next, Save } from './engine/campaign'
import type { PilotId } from './engine/types'

const Campaign = defineAsyncComponent(() => import('./Campaign.vue'))

const PILOTS: readonly { id: PilotId; name: string; face: string }[] = [
  { id: 'nova', name: 'NOVA', face: 'portrait-nova-calm' },
  { id: 'rex', name: 'REX', face: 'portrait-rex-cheerful' },
]
const KEYS = 'ARROWS FLY|SPACE GUNS|ENTER MISSILE|TAB BURN|T TARGET|X SWAP SEATS|C COMMS|N AUTOPILOT'
const TOUCH = 'LEFT THUMB FLIES|GUNS FIRE ON THE DIAMOND|TAP A SCREEN|TAP THE SEATS TO SWAP'
const SAVE_KEY = 'voyagers2.save'
const BEST_KEY = 'voyagers2.best'
const PILOT_KEY = 'voyagers2.pilot'

const { hint } = useInputMode()
const radio = useRadio()

const pilot = ref<PilotId>('rex')
const saved = ref<Save | null>(null)
const campaign = ref<Save | null>(null)
const best = ref(0)
const loading = ref(false)
const k = ref<number | undefined>(undefined)
let lastTap = 0

const other = computed(() => (pilot.value === 'rex' ? 'NOVA' : 'REX'))

function titleOf(n: Next): string {
  return isEnd(n) ? '' : SORTIE_TITLES[n]
}

function onBest(b: number): void {
  best.value = b
}

function choose(id: PilotId): void {
  pilot.value = id
  try { localStorage.setItem(PILOT_KEY, id) } catch { /* private mode */ }
}

function primary(): void {
  if (campaign.value) return
  const now = performance.now()
  if (now - lastTap < 450) return
  lastTap = now
  if (saved.value && !isEnd(saved.value.next)) open(saved.value)
  else newCampaign()
}

function newCampaign(): void {
  lastTap = performance.now()
  const s = newSave(pilot.value)
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)) } catch { /* private mode */ }
  open(s)
}

function open(s: Save): void {
  // The site's radio is the music: start it inside this gesture.
  radio.ensurePlaying()
  loading.value = true
  campaign.value = s
}

function backToTitle(s: Save): void {
  saved.value = s
  campaign.value = null
  loading.value = false
  lastTap = performance.now()
}

function onKeyDown(e: KeyboardEvent): void {
  if (campaign.value || e.repeat) return
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { choose('nova'); e.preventDefault() } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { choose('rex'); e.preventDefault() } else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); primary() }
}

/** One pixel size for every screen of the game's HTML: the card (240 × 320) and a column, whole device pixels. */
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
    saved.value = readSave(localStorage.getItem(SAVE_KEY))
    if (saved.value) pilot.value = saved.value.pilot
    else if (localStorage.getItem(PILOT_KEY) === 'nova') pilot.value = 'nova'
  } catch { /* storage unavailable */ }
  fit()
  window.addEventListener('resize', fit)
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  window.removeEventListener('keydown', onKeyDown)
})
</script>
