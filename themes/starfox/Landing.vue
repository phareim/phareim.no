<template>
  <DefaultLanding>
    <template #background>
      <ClientOnly>
        <ModelLab v-if="modelLab" />
        <Flight
          v-else
          @score="(s: number) => score = s"
          @distance="(m: number) => distance = m"
          @health="(n: number, m: number) => { hp = n; hpMax = m }"
          @sector="(n: number, p: SectorPhase) => { sector = n; phase = p }"
          @boss="onBoss"
          @squad="(l: SquadHud[]) => squad = l"
          @arsenal="(a: ArsenalHud) => kit = a"
          @toast="(t: string) => flashMsg('toast', t, 2200)"
          @alert="(t: string) => flashMsg('alert', t, 2400)"
          @callout="(t: string) => flashMsg('callout', t, 2200)"
          @title="onTitle"
          @intercom="(l: IntercomView | null) => intercom = l"
          @intercom-shown="(n: number) => intercomShown = n"
          @over="onGameEnded"
          @death="onGameOver"
          @restart="onGameRestart"
          @started="onGameStarted"
        />
        <Intercom v-if="!modelLab" :line="intercom" :shown="intercomShown" />
      </ClientOnly>
    </template>

    <template #body>
      <SoundToggle />
      <template v-if="gameOver">
        <h1 class="px-title">MISSION FAILED</h1>
        <p class="px-hud">SCORE {{ score }} · {{ distance }} KM</p>
        <div class="sfx-route-pips" aria-hidden="true">
          <span v-for="(s, i) in SECTORS" :key="s.name" class="sfx-pip" :class="{ 'sfx-pip--on': summary && (summary.loop > 0 || i < summary.index), 'sfx-pip--here': summary && i === summary.index }" />
        </div>
        <p v-if="summary" class="px-hud sfx-gold">REACHED {{ summary.loop ? '' : `SECTOR ${summary.sector} · ` }}{{ summary.name }}</p>
        <p v-if="summary" class="px-hud px-dim">{{ summary.survivors }}</p>
        <p v-if="isNewHigh && score > 0" class="px-hud px-blink" style="--px-hud: #ffd23f">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO FLY AGAIN', 'TAP TO FLY AGAIN') }} ◀</p>
      </template>

      <template v-else-if="!gameStarted && !modelLab">
        <!-- Title: the operation, the route and the squad round a clear
          middle band where the attract ship flies. -->
        <div class="sfx-title">
          <h1 class="px-title sfx-op"><span>OPERATION</span> <span>NIGHTLIGHT</span></h1>
        </div>
        <div class="sfx-panel sfx-route px-box px-box--pink">
          <p class="sfx-panel-h">THE ROUTE</p>
          <ol>
            <li v-for="(s, i) in SECTORS" :key="s.name"><span class="sfx-num">{{ i + 1 }}</span> {{ s.name }}</li>
          </ol>
        </div>
        <div class="sfx-panel sfx-roster px-box px-box--gold">
          <p class="sfx-panel-h">THE SQUAD</p>
          <ul>
            <li class="sfx-lead"><span class="sfx-lead-tag">LEAD</span> {{ leadName }}</li>
            <li v-for="p in roster" :key="p.id" :style="{ '--trim': p.trim }">
              <img :src="p.portrait" width="40" height="40" alt="">
              <span class="sfx-pilot"><b>{{ p.name }}</b><i>{{ p.slot }} · {{ p.role.split(' · ')[0] }}</i></span>
            </li>
          </ul>
        </div>
        <div class="sfx-dock sfx-dock--title">
          <p v-if="highScore > 0" class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
          <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO FLY', 'TAP TO FLY') }} ◀</p>
          <p class="px-hint px-dim sfx-controls">{{ hint('ARROWS · SPACE FIRE/HOLD CHARGE · B BOMB · SHIFT ROLL', 'DRAG · 2ND FINGER CHARGE · BOMB BUTTON · DOUBLE-TAP ROLL') }}</p>
        </div>
      </template>

      <template v-else-if="gameStarted">
        <Transition name="sfx-card">
          <div v-if="card" :key="card" class="sfx-card">
            <p class="px-hud sfx-card-kicker">{{ cardKicker }}</p>
            <p class="px-title sfx-card-name">{{ cardName }}</p>
          </div>
        </Transition>
        <!-- In-game HUD: meters at the bottom, the squad bottom-left, the
          arsenal bottom-right, so the corridor and the ship stay clear. On
          phones the boss bar and banners move to the top, under the
          intercom, and the dock keeps only the score and the hull. -->
        <div class="sfx-dock">
          <div v-if="bossActive || banner || msg.toast" class="sfx-alerts">
            <div v-if="bossActive" class="sfx-dock-boss">
              <span class="sfx-boss-name px-hud">{{ bossName }}</span>
              <span class="sfx-bar sfx-boss-bar" role="status" aria-label="Boss integrity">
                <span class="sfx-bar-fill sfx-bar-boss" :style="{ width: `${bossMax > 0 ? Math.round(100 * bossHp / bossMax) : 0}%` }" />
              </span>
            </div>
            <p v-if="banner" class="px-hud px-blink sfx-gold sfx-banner">{{ banner }}</p>
            <p v-else-if="msg.toast" class="px-hud sfx-gold sfx-banner">{{ msg.toast }}</p>
          </div>
          <p class="location px-hud sfx-line">S{{ pad(sector) }} · {{ score }}</p>
          <div class="sfx-bar" role="status" aria-label="Hull integrity">
            <div class="sfx-bar-fill" :class="hpClass" :style="{ width: `${Math.round(100 * hp / hpMax)}%` }" />
          </div>
        </div>
        <div class="sfx-side sfx-side--left" role="status" aria-label="Squad">
          <p v-if="msg.callout" class="sfx-callout">{{ msg.callout }}</p>
          <span v-for="w in squad" :key="w.id" class="sfx-chip" :class="{ 'sfx-chip--down': !w.alive, 'sfx-chip--trouble': w.trouble }" :style="{ '--trim': pilot(w.id).trim }">
            <img :src="pilot(w.id).portrait" width="16" height="16" alt="">
            <span class="sfx-chip-name">{{ pilot(w.id).short }}</span>
            <span v-if="w.alive" class="sfx-pips"><i v-for="k in 4" :key="k" :class="{ on: k <= Math.ceil(4 * w.hp / w.max) }" /></span>
            <span v-else class="sfx-chip-t">{{ w.respawn }}S</span>
          </span>
        </div>
        <div class="sfx-side sfx-side--right" :class="{ 'sfx-side--touch': isTouch }">
          <span v-if="kit.shield" class="sfx-k sfx-k--t" style="--c: #3fd8b0">SHIELD {{ kit.shield }}</span>
          <span v-if="kit.overdrive" class="sfx-k sfx-k--t" style="--c: #9a4ff0">OVERDRIVE {{ kit.overdrive }}</span>
          <span v-if="kit.wingOd" class="sfx-k sfx-k--t" style="--c: #ffd23f">WING OD {{ kit.wingOd }}</span>
          <span class="sfx-k sfx-k--laser">{{ laserName(kit.laser || 1) }}</span>
          <span class="sfx-k sfx-k--bombs" :aria-label="`${kit.bombs} bombs`"><b>B</b><i v-for="k in kit.bombs" :key="k" /></span>
          <span class="sfx-k sfx-charge" :class="{ 'sfx-charge--ready': kit.charge >= 1 }" aria-label="Charge"><i :style="{ width: `${Math.round(kit.charge * 100)}%` }" /></span>
        </div>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import SoundToggle from '~/themes/base/SoundToggle.vue'
import { sectorClearBonus, HEAL_CLEAR, type SectorPhase } from './balance'
import { laserName } from './arsenal'
import { PILOTS, SECTORS, callsignFrom, rosterFor, type PilotId } from './story'
import { readStoredPlayer } from '~/composables/useLeaderboard'
import Intercom from './Intercom.vue'
import type { ArsenalHud, DeathSummary, IntercomView, SquadHud } from './scene/ctx'

// three.js is ~170 KB gzipped: load it only when this theme is on screen.
const Flight = defineAsyncComponent(() => import('./Flight.vue'))
// The model lab (?lab=models) swaps in for the game: every model through the game's pipeline.
const ModelLab = defineAsyncComponent(() => import('./ModelLab.vue'))
const modelLab = useRoute().query.lab === 'models'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'starfox' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint, isTouch } = useInputMode()

const score = ref(0)
const distance = ref(0)
const hp = ref(100)
const hpMax = ref(100)
const sector = ref(1)
const phase = ref<SectorPhase>('travel')
const bossHp = ref(0)
const bossMax = ref(0)
const bossActive = ref(false)
const bossName = ref('')
const squad = ref<SquadHud[]>([])
const kit = ref<ArsenalHud>({ laser: 1, bombs: 3, charge: 0, shield: 0, overdrive: 0, wingOd: 0 })
const intercom = ref<IntercomView | null>(null)
const intercomShown = ref(0)
const highScore = ref(0)
const isNewHigh = ref(false)
const gameOver = ref(false)
const gameStarted = ref(false)
const summary = ref<DeathSummary | null>(null)
const card = ref('')
const callsign = ref('pilot')
const leadName = ref('PILOT')
const roster = computed(() => rosterFor(callsign.value))

type MsgKind = 'toast' | 'alert' | 'callout'
const msg = reactive<Record<MsgKind, string>>({ toast: '', alert: '', callout: '' })
const timers: Partial<Record<MsgKind | 'card', ReturnType<typeof setTimeout>>> = {}

function flashMsg(kind: MsgKind, text: string, ms: number) {
  msg[kind] = text
  if (timers[kind]) clearTimeout(timers[kind])
  timers[kind] = setTimeout(() => { msg[kind] = '' }, ms)
}

function onTitle(text: string) {
  card.value = text
  if (timers.card) clearTimeout(timers.card)
  timers.card = setTimeout(() => { card.value = '' }, 2800)
}
const cardKicker = computed(() => card.value.split(' · ')[0] ?? '')
const cardName = computed(() => card.value.split(' · ').slice(1).join(' · '))

function onBoss(n: number, m: number, active: boolean, name: string) {
  bossHp.value = n
  bossMax.value = m
  bossActive.value = active
  if (name) bossName.value = name
}

function pilot(id: string) {
  return PILOTS[id as PilotId]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const hpClass = computed(() => {
  const frac = hpMax.value > 0 ? hp.value / hpMax.value : 1
  if (frac < 0.3) return 'sfx-bar-low'
  if (frac < 0.6) return 'sfx-bar-mid'
  return ''
})

const banner = computed(() => {
  if (!gameStarted.value || gameOver.value) return ''
  if (msg.alert) return msg.alert
  if (phase.value === 'warning') return bossName.value ? `! ${bossName.value} APPROACHING !` : '! WARNING !'
  if (phase.value === 'clear') return `SECTOR ${pad(sector.value)} CLEAR · +${sectorClearBonus(sector.value)} · +${HEAL_CLEAR} HULL`
  return ''
})

onMounted(() => {
  const v = parseInt(localStorage.getItem('starfoxHighScore') || '0', 10)
  highScore.value = Number.isNaN(v) ? 0 : v
  const name = readStoredPlayer()?.name
  callsign.value = callsignFrom(name)
  leadName.value = (name ?? 'PILOT').toUpperCase()
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => {
  navigationLocked.value = false
  for (const t of Object.values(timers)) if (t) clearTimeout(t)
})

function onGameStarted() {
  gameStarted.value = true
  navigationLocked.value = true
}

// 'over' fires the moment the run ends; 'death' a little later, after the explosion.
function onGameEnded() {
  navigationLocked.value = false
}

function onGameOver(s: DeathSummary) {
  summary.value = s
  gameOver.value = true
  bossActive.value = false
  navigationLocked.value = false
  submitScore('starfox', score.value)
  isNewHigh.value = score.value > highScore.value
  if (isNewHigh.value) {
    highScore.value = score.value
    localStorage.setItem('starfoxHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  isNewHigh.value = false
  summary.value = null
  msg.toast = msg.alert = msg.callout = ''
  bossActive.value = false
  bossHp.value = 0
  bossMax.value = 0
  sector.value = 1
  phase.value = 'travel'
  navigationLocked.value = true
}
</script>

<style>
/* Text: themes/base/pixel/pixel.css (.px-*). Meters are pixel bars: hard
   2 px frames, stepped fills, no radius, no soft glow. */
.sfx-gold {
  --px-hud: #ffd23f;
}

/* ---- title screen ---------------------------------------------------- */
.sfx-title {
  position: fixed;
  left: 0;
  right: 0;
  top: max(150px, 19vh); /* below the intercom box (Claude's hello on the title screen) */
  text-align: center;
  pointer-events: none;
  z-index: 3;
}
.landing .px-title.sfx-op {
  margin: 0;
  font-size: 48px;
  line-height: 1.1;
  --px-title: #ff2fa0;
}
.sfx-op span { display: inline-block; }
.sfx-panel {
  position: fixed;
  top: max(300px, 38vh);
  z-index: 3;
  padding: 12px 14px 10px;
  text-align: left;
  pointer-events: none;
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
  text-transform: uppercase;
}
.sfx-panel ol,
.sfx-panel ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.sfx-panel li {
  font-size: 16px;
  line-height: 24px;
  color: #cfc6ff;
  text-shadow: 2px 2px 0 #0b0616;
  white-space: nowrap;
}
.sfx-panel-h {
  margin: 0 0 6px;
  font-size: 16px;
  color: #ffd23f;
  text-shadow: 2px 2px 0 #0b0616;
}
.sfx-route { left: 24px; }
.sfx-route .sfx-num { color: #ff2fa0; }
.sfx-roster { right: 24px; }
.sfx-roster li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.sfx-roster img {
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
  box-shadow: 0 0 0 2px var(--trim, #ffd23f);
}
.sfx-pilot { display: flex; flex-direction: column; line-height: 18px; }
.sfx-pilot b { font-weight: 400; color: var(--trim, #ffd23f); }
.sfx-pilot i { font-style: normal; font-size: 8px; line-height: 12px; color: #b9a8d9; }
.sfx-roster .sfx-lead { color: #2ff3ff; margin-top: 0; }
.sfx-lead-tag { color: #b9a8d9; }

@media (max-width: 900px) {
  .sfx-title { top: calc(max(12px, env(safe-area-inset-top)) + 118px); }
  .landing .px-title.sfx-op { font-size: 32px; }
  .sfx-op span { display: block; }
  .sfx-panel {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    padding: 8px 10px 6px;
  }
  .sfx-route { top: calc(max(12px, env(safe-area-inset-top)) + 212px); width: 264px; }
  .sfx-route li { font-size: 8px; line-height: 12px; }
  .sfx-route ol { columns: 2; column-gap: 12px; }
  .sfx-roster { top: calc(max(12px, env(safe-area-inset-top)) + 298px); width: 264px; }
  .sfx-roster ul { display: flex; justify-content: space-between; }
  .sfx-roster li { flex-direction: column; gap: 2px; margin: 0; }
  .sfx-roster .sfx-lead { display: none; }
  .sfx-pilot { align-items: center; }
  .sfx-pilot b { font-size: 8px; line-height: 12px; }
  .sfx-pilot i { display: none; }
  .sfx-panel-h { font-size: 8px; margin-bottom: 4px; }
  .landing p.px-hint.sfx-controls { font-size: 8px; line-height: 12px; }
}

/* ---- sector title card ------------------------------------------------ */
.sfx-card {
  position: fixed;
  left: 0;
  right: 0;
  top: 24vh;
  text-align: center;
  pointer-events: none;
  z-index: 3;
}
.landing .sfx-card-kicker { --px-hud: #ffd23f; margin: 0; }
.landing .px-title.sfx-card-name { margin: 4px 0 0; font-size: 48px; --px-title: #fff4ff; }
@media (max-width: 640px) {
  .sfx-card { top: calc(max(12px, env(safe-area-inset-top)) + 204px); }
  .landing .px-title.sfx-card-name { font-size: 24px; text-shadow: 3px 3px 0 #0b0616; }
}
.sfx-card-enter-active { transition: opacity 0.2s steps(3); }
.sfx-card-leave-active { transition: opacity 0.4s steps(4); }
.sfx-card-enter-from,
.sfx-card-leave-to { opacity: 0; }

/* ---- the dock and the side blocks ------------------------------------ */
/* All in-game text and meters sit low so the corridor stays clear, above
   the bottom band (--app-safe-bottom). The sound toggle keeps the
   bottom-left corner, the BOMB button (touch) the bottom-right. */
/* Centred without a transform, so the phone's .sfx-alerts can be fixed to
   the viewport from inside it. */
.sfx-dock {
  position: fixed;
  left: 0;
  right: 0;
  margin: 0 auto;
  bottom: max(3rem, calc(2.2rem + var(--app-safe-bottom, 0px)));
  z-index: 3;
  width: min(420px, calc(100vw - 280px));
  text-align: center;
  pointer-events: none;
}
.sfx-dock--title { bottom: max(2.2rem, calc(1.6rem + var(--app-safe-bottom, 0px))); width: min(820px, 94vw); }
.landing .sfx-dock .px-hud { margin-top: 0.3em; }
.sfx-side {
  position: fixed;
  bottom: calc(64px + var(--app-safe-bottom, 0px));
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
  text-transform: uppercase;
  font-size: 16px;
  line-height: 20px;
  text-shadow: 2px 2px 0 #0b0616;
}
.sfx-side--left { left: 16px; align-items: flex-start; }
.sfx-side--right { right: 16px; align-items: flex-end; }
.sfx-side--touch { bottom: calc(96px + var(--app-safe-bottom, 0px)); }
.sfx-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--trim, #ffd23f);
}
.sfx-chip img {
  width: 20px;
  height: 20px;
  image-rendering: pixelated;
  box-shadow: 0 0 0 2px var(--trim, #ffd23f);
}
.sfx-chip--down { color: #5a5285; }
.sfx-chip--down img { filter: grayscale(1) brightness(0.5); }
.sfx-chip--trouble { animation: px-blink 0.5s steps(1) infinite; }
.sfx-pips { display: inline-flex; gap: 2px; }
.sfx-pips i { width: 5px; height: 10px; background: #2a1a4c; }
.sfx-pips i.on { background: var(--trim, #ffd23f); }
.sfx-chip-t { color: #b9a8d9; }
.sfx-callout { margin: 0 0 2px; color: #b9a8d9; }
.landing .sfx-line { margin-top: 2px; }
.sfx-k--laser { color: #2ff3ff; }
.sfx-k--bombs { display: inline-flex; align-items: center; gap: 4px; color: #ff2fa0; }
.sfx-k--bombs b { font-weight: 400; margin-right: 2px; }
.sfx-k--bombs i {
  width: 8px;
  height: 8px;
  background: #ff2fa0;
  box-shadow: 0 0 0 1px #0b0616;
  transform: rotate(45deg);
}
.sfx-charge {
  display: inline-block;
  width: 64px;
  height: 8px;
  margin-top: 4px;
  background: #1c1030;
  box-shadow: 0 0 0 2px #1a9fc4;
}
.sfx-charge i { display: block; height: 100%; background: #1a9fc4; }
.sfx-charge--ready { box-shadow: 0 0 0 2px #fff4ff; }
.sfx-charge--ready i { background: #2ff3ff; }
.sfx-k--t { color: var(--c); }

/* Phones: the ship flies where the desktop dock sits, so the dock drops to
   the bottom edge between the sound toggle and the BOMB button (score over
   hull), the boss bar and the banners go to the top under the intercom
   (at most three lines, 130 px), and the side blocks take 8 px text. */
@media (max-width: 640px) {
  .sfx-dock { width: 172px; bottom: calc(12px + var(--app-safe-bottom, 0px)); }
  .sfx-dock .sfx-bar { width: 160px; height: 8px; }
  .landing .sfx-dock .sfx-line { margin: 0; line-height: 1; }
  .sfx-alerts {
    position: fixed;
    left: 16px;
    right: 16px;
    top: calc(max(12px, env(safe-area-inset-top)) + 136px);
  }
  .sfx-alerts .sfx-bar { width: min(288px, 70vw); }
  .landing .sfx-alerts .sfx-banner { font-size: 16px; line-height: 20px; }
  .sfx-dock--title { width: calc(100vw - 32px); bottom: calc(60px + var(--app-safe-bottom, 0px)); }
  .sfx-side { font-size: 8px; line-height: 12px; gap: 5px; text-shadow: 1px 1px 0 #0b0616; bottom: calc(60px + var(--app-safe-bottom, 0px)); }
  .sfx-side--touch { bottom: calc(86px + var(--app-safe-bottom, 0px)); }
  .sfx-chip { gap: 4px; }
  .sfx-chip img { width: 16px; height: 16px; box-shadow: 0 0 0 1px var(--trim, #ffd23f); }
  .sfx-pips i { width: 4px; height: 8px; }
  .sfx-k--bombs i { width: 6px; height: 6px; }
  .sfx-charge { width: 48px; height: 6px; }
}

.sfx-bar {
  display: block;
  width: min(288px, 60vw);
  height: 10px;
  margin: 0.4em auto 0;
  background: #1c1030;
  border: 2px solid #0b0616;
  box-shadow: 0 0 0 2px #2a8579;
  overflow: hidden;
}
.sfx-bar-fill {
  display: block;
  height: 100%;
  background: #2ff3ff;
  box-shadow: inset 0 2px 0 #fff4ff, inset 0 -2px 0 #1a9fc4;
  transition: width 0.2s steps(4);
}
.sfx-bar-mid {
  background: #ffd23f;
  box-shadow: inset 0 2px 0 #fff1b0, inset 0 -2px 0 #c4861c;
}
.sfx-bar-low {
  background: #ff2fa0;
  box-shadow: inset 0 2px 0 #ff8ae0, inset 0 -2px 0 #b01874;
  animation: px-blink 0.5s steps(1) infinite;
}
.sfx-dock-boss {
  text-align: center;
  pointer-events: none;
  margin-bottom: 0.4em;
}
.landing .sfx-boss-name {
  --px-hud: #ff2fa0;
  display: block;
  margin: 0;
}
.sfx-boss-bar {
  box-shadow: 0 0 0 2px #b01874;
}
.sfx-bar-boss {
  background: #ff2fa0;
  box-shadow: inset 0 2px 0 #ff8ae0, inset 0 -2px 0 #b01874;
}

/* ---- game over ----------------------------------------------------------- */
.sfx-route-pips {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}
.sfx-pip {
  width: 14px;
  height: 8px;
  background: #2a1a4c;
  box-shadow: 0 0 0 2px #0b0616;
}
.sfx-pip--on { background: #ffd23f; }
.sfx-pip--here { background: #ff2fa0; animation: px-blink 1.1s steps(1) infinite; }
</style>
