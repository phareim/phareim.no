<template>
  <div class="vg2-campaign">
    <Game
      v-if="phase === 'loading' || phase === 'playing'"
      :pilot="save.pilot"
      :mission="sortie"
      :morale="save.morale"
      @started="onStarted"
      @over="onOver"
    />

    <!-- An act begins. -->
    <div v-if="phase === 'act'" class="vg2-screen vg2-act" @click="toHub">
      <div class="vg2-actcard" :style="{ backgroundImage: `url(/voyagers2/card-act-${act}.png)` }" aria-hidden="true" />
      <p class="vg2-line vg2-dim">ACT {{ ['', 'I', 'II', 'III'][act] }}</p>
      <h2 class="vg2-over__title vg2-gold">{{ ACTS[act] }}</h2>
      <p class="vg2-hint vg2-blink">{{ hint('ENTER', 'TAP') }}</p>
    </div>

    <!-- The Deep Dish between sorties. -->
    <div v-else-if="phase === 'hub'" class="vg2-screen vg2-screen--top">
      <Hub :save="save" :sortie="sortie" @update="store" @launch="launch" />
    </div>

    <!-- The debrief: what happened, and Nonna about it. -->
    <div v-else-if="phase === 'debrief' && result" class="vg2-screen" @click="debriefNext">
      <div class="vg2-panel">
        <p class="vg2-line vg2-dim">DEBRIEF · {{ result.mission }}</p>
        <h2 class="vg2-over__title" :class="result.result === 'won' ? 'vg2-gold' : 'vg2-red'">{{ result.result === 'won' ? 'SORTIE WON' : 'SORTIE LOST' }}</h2>
        <p class="vg2-line">{{ WHY[result.why] ?? '' }}</p>
        <p class="vg2-line">KILLS {{ result.kills }} · SCORE {{ result.score }}</p>
        <p class="vg2-line vg2-dim">CAMPAIGN {{ save.score }} · SORTIE {{ save.history.length }} OF 8</p>
        <div v-if="debriefSay" class="vg2-talk vg2-talk--panel">
          <span class="vg2-face" :style="{ backgroundImage: `url(${faceOf(debriefSay)})` }" aria-hidden="true" />
          <div class="vg2-talk__words">
            <p class="vg2-talk__name">{{ nameOf(debriefSay) }}</p>
            <p class="vg2-talk__text">{{ debriefSay.text }}</p>
          </div>
        </div>
        <p class="vg2-hint vg2-blink">{{ debriefLine < debriefLines.length - 1 ? '▸' : hint('ENTER', 'TAP') }}</p>
      </div>
    </div>

    <!-- The end of the campaign. -->
    <div v-else-if="phase === 'ending'" class="vg2-screen" @click="toTitle">
      <div class="vg2-panel">
        <div class="vg2-ending" :style="{ backgroundImage: `url(/voyagers2/card-ending-${won ? 'won' : 'lost'}.png)` }" aria-hidden="true" />
        <h2 class="vg2-over__title" :class="won ? 'vg2-gold' : 'vg2-red'">{{ won ? 'DELIVERED' : 'FRANCHISED' }}</h2>
        <p v-for="l in ENDINGS[won ? 'won' : 'lost']" :key="l" class="vg2-line">{{ l }}</p>
        <p class="vg2-line vg2-gold">CAMPAIGN SCORE {{ save.score }}</p>
        <p v-if="isBest" class="vg2-line vg2-gold vg2-blink">NEW BEST</p>
        <p v-if="rank" class="vg2-line vg2-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="vg2-hint vg2-blink">{{ hint('ENTER', 'TAP') }}</p>
      </div>
    </div>

    <!-- Waiting for the game's chunk (three.js) and the first frame. -->
    <div v-if="phase === 'loading'" class="vg2-screen">
      <p class="vg2-hint vg2-blink">WARMING THE TUBES</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Rex & Nova: Space Voyagers II, the campaign after the title: an act's
 * card, the Deep Dish between sorties (`Hub.vue`), a sortie (`Game.vue`, its
 * own chunk with three.js, mounted only while one runs), the debrief, the
 * ending and the Hall of Fame. `Landing.vue` loads this file when the title
 * is left, so `/` carries none of it. The save is localStorage
 * `voyagers2.save` (`engine/campaign.ts`).
 */
import type { SortieReport } from './Game.vue'
import Hub from './Hub.vue'
import { ACTS, afterSortie, isEnd, TREE } from './engine/campaign'
import type { Save, SortieId } from './engine/campaign'
import { SPEAKERS } from './story/cues'
import { DEBRIEFS, ENDINGS, speaker } from './story/hub'
import type { Say } from './story/hub'

const Game = defineAsyncComponent(() => import('./Game.vue'))

const props = defineProps<{ initial: Save; best: number }>()
const emit = defineEmits<{ title: [save: Save]; best: [score: number]; ready: [] }>()

const WHY: Record<string, string> = {
  landed: 'HOME THROUGH THE OVEN DOOR.',
  delivered: 'DELIVERED.',
  eject: 'THE CALZONE IS LOST. YOU BOTH GOT OUT.',
  carrier: 'THE DEEP DISH IS LOST.',
  oven: 'THE DEEP DISH TOOK TOO MANY TORPEDOES.',
  target: 'THE TARGET IS STILL OUT THERE.',
  convoy: 'THE CONVOY DID NOT MAKE IT.',
  duel: 'THE PRINCE WON THE DUEL.',
  navs: 'YOU CAME HOME BEFORE THE JOB WAS DONE.',
  quit: 'YOU TURNED BACK.',
}
const SAVE_KEY = 'voyagers2.save'
const BEST_KEY = 'voyagers2.best'

const { navigationLocked } = useTheme()
const { hint } = useInputMode()
const { submitScore, lastSubmission } = useLeaderboard()
const radio = useRadio()

type Phase = 'act' | 'hub' | 'loading' | 'playing' | 'debrief' | 'ending'
const phase = ref<Phase>('act')
const save = ref<Save>(props.initial)
const result = ref<SortieReport | null>(null)
const debriefLines = ref<Say[]>([])
const debriefLine = ref(0)
const isBest = ref(false)
let lastTap = performance.now()

const sortie = computed<SortieId>(() => (isEnd(save.value.next) ? 'firstshift' : save.value.next))
const act = computed((): number => TREE[sortie.value as SortieId].act)
const won = computed(() => save.value.next === 'end-won')
const debriefSay = computed(() => debriefLines.value[debriefLine.value] ?? null)
const rank = computed(() => (lastSubmission.value?.game === 'voyagers2' && lastSubmission.value.score === save.value.score ? lastSubmission.value : null))

function faceOf(s: Say): string {
  const who = speaker(s, save.value.pilot)
  const sp = SPEAKERS[who]
  return `/${sp.dir}/portrait-${who}-${s.mood ?? sp.moods[0]}.png`
}
function nameOf(s: Say): string {
  return SPEAKERS[speaker(s, save.value.pilot)].name
}

function store(s: Save): void {
  save.value = s
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)) } catch { /* private mode: the campaign lasts this visit */ }
}

/** A tap must not do two things: the one that ended a screen does not also end the next. */
function debounce(): boolean {
  const now = performance.now()
  if (now - lastTap < 450) return false
  lastTap = now
  return true
}

/** The next sortie: its act's card first when a new act begins, then the hub. */
function enterSortie(): void {
  const prev = save.value.history[save.value.history.length - 1]
  phase.value = !prev || TREE[prev.id as SortieId].act !== act.value ? 'act' : 'hub'
}

function toHub(): void {
  if (!debounce()) return
  phase.value = 'hub'
}

function launch(): void {
  // The site's radio is the music: start it inside this gesture.
  radio.ensurePlaying()
  navigationLocked.value = true
  phase.value = 'loading'
}

function onStarted(): void {
  phase.value = 'playing'
  navigationLocked.value = true
}

function onOver(r: SortieReport): void {
  navigationLocked.value = false
  result.value = r
  store(afterSortie(save.value, r.id as SortieId, r.result, r.score, r.kills))
  debriefLines.value = DEBRIEFS[r.id as SortieId]?.[r.result] ?? []
  debriefLine.value = 0
  phase.value = 'debrief'
  lastTap = performance.now()
}

function debriefNext(): void {
  if (!debounce()) return
  if (debriefLine.value < debriefLines.value.length - 1) { debriefLine.value++; return }
  if (isEnd(save.value.next)) finish()
  else enterSortie()
}

function finish(): void {
  const s: Save = save.value
  phase.value = 'ending'
  isBest.value = s.score > props.best
  if (s.score > props.best) {
    emit('best', s.score)
    try { localStorage.setItem(BEST_KEY, String(s.score)) } catch { /* private mode */ }
  }
  // The campaign is the run: its score goes to the Hall of Fame once, at the end.
  if (s.score > 0 && !s.flags.submitted) {
    void submitScore('voyagers2', s.score)
    store({ ...s, flags: { ...s.flags, submitted: true } })
  }
}

function toTitle(): void {
  if (!debounce()) return
  emit('title', save.value)
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.repeat || (e.code !== 'Enter' && e.code !== 'Space')) return
  const p = phase.value
  if (p === 'act') { e.preventDefault(); toHub() } else if (p === 'debrief') { e.preventDefault(); debriefNext() } else if (p === 'ending') { e.preventDefault(); toTitle() } else if (p === 'hub' && e.code === 'Enter') { e.preventDefault(); launch() }
}

onMounted(() => {
  enterSortie()
  emit('ready')
  window.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  navigationLocked.value = false
  window.removeEventListener('keydown', onKeyDown)
})
</script>
