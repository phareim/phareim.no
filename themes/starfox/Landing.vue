<template>
  <DefaultLanding>
    <template #background>
      <ClientOnly>
        <Flight
          @score="(s: number) => score = s"
          @distance="(m: number) => distance = m"
          @health="(n: number, m: number) => { hp = n; hpMax = m }"
          @power="onPower"
          @sector="(n: number, p: SectorPhase) => { sector = n; phase = p }"
          @boss="(n: number, m: number, a: boolean) => { bossHp = n; bossMax = m; bossActive = a }"
          @wing="(hpLeft: number, alive: boolean, respawnT: number) => { wingHp = hpLeft; wingAlive = alive; wingRespawn = respawnT }"
          @wing-say="onWingSay"
          @over="onGameEnded"
          @death="onGameOver"
          @restart="onGameRestart"
          @started="onGameStarted"
        />
      </ClientOnly>
    </template>

    <template #body>
      <SoundToggle />
      <template v-if="gameOver">
        <h1 class="px-title">MISSION FAILED</h1>
        <p class="px-hud">SCORE {{ score }} · {{ distance }} KM · SECTOR {{ pad(sector) }}</p>
        <p v-if="isNewHigh && score > 0" class="px-hud px-blink" style="--px-hud: #ffd23f">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO FLY AGAIN', 'TAP TO FLY AGAIN') }} ◀</p>
      </template>
      <template v-else>
        <!-- In-game HUD lives in a bottom dock so the corridor stays clear. -->
        <div class="sfx-dock">
          <div v-if="bossActive" class="sfx-dock-boss">
            <span class="sfx-boss-name px-hud">{{ BOSS_NAME }}</span>
            <span class="sfx-bar sfx-boss-bar" role="status" aria-label="Boss integrity">
              <span class="sfx-bar-fill sfx-bar-boss" :style="{ width: `${bossMax > 0 ? Math.round(100 * bossHp / bossMax) : 0}%` }" />
            </span>
          </div>
          <p v-if="gameStarted" class="location px-hud">
            SECTOR {{ pad(sector) }} · SCORE {{ score }} · {{ distance }} KM
          </p>
          <div v-if="gameStarted" class="sfx-bar" role="status" aria-label="Hull integrity">
            <div class="sfx-bar-fill" :class="hpClass" :style="{ width: `${Math.round(100 * hp / hpMax)}%` }" />
          </div>
          <p v-if="banner" class="location px-hud px-blink sfx-gold">{{ banner }}</p>
          <p v-if="powerMsg" class="location px-hud sfx-gold">{{ powerMsg }}</p>
          <p v-if="gameStarted" class="location px-hud px-dim sfx-wing">{{ wingMsg }}</p>
          <p v-if="highScore > 0 && !gameStarted" class="location px-hud px-dim">HIGH SCORE {{ highScore }}</p>
          <template v-if="!gameStarted">
            <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO FLY', 'TAP TO FLY') }} ◀</p>
            <p class="px-hint px-dim">{{ hint('ARROWS · SPACE FIRE · SHIFT ROLL · WINGMAN HUNTS · ESC PAUSE', 'DRAG TO STEER · AUTO-FIRE · DOUBLE-TAP ROLL · WINGMAN HUNTS') }}</p>
          </template>
        </div>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import { BOSS_NAME, sectorClearBonus, HEAL_CLEAR, type SectorPhase } from './balance'
import { WING_AI } from './wingmanAi'
import SoundToggle from '~/themes/base/SoundToggle.vue'

// three.js is ~170 KB gzipped: load it only when this theme is on screen.
const Flight = defineAsyncComponent(() => import('./Flight.vue'))

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'starfox' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()

const score = ref(0)
const distance = ref(0)
const hp = ref(100)
const hpMax = ref(100)
const sector = ref(1)
const phase = ref<SectorPhase>('travel')
const bossHp = ref(0)
const bossMax = ref(0)
const bossActive = ref(false)
const wingHp = ref(50)
const wingAlive = ref(true)
const wingRespawn = ref(0)
const highScore = ref(0)
const isNewHigh = ref(false)
const gameOver = ref(false)
const gameStarted = ref(false)
const powerMsg = ref('')
let powerTimer: ReturnType<typeof setTimeout> | null = null
const wingCallout = ref('')
let wingCalloutTimer: ReturnType<typeof setTimeout> | null = null

function onWingSay(text: string) {
  wingCallout.value = text
  if (wingCalloutTimer) clearTimeout(wingCalloutTimer)
  wingCalloutTimer = setTimeout(() => { wingCallout.value = '' }, WING_AI.calloutTime * 1000)
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
  if (phase.value === 'warning') return `! ${BOSS_NAME} APPROACHING !`
  if (phase.value === 'clear') return `SECTOR ${pad(sector.value)} CLEAR · +${sectorClearBonus(sector.value)} · +${HEAL_CLEAR} HULL`
  return ''
})

const wingMsg = computed(() => {
  if (gameOver.value) return ''
  if (wingCallout.value) return `WING ▶ ${wingCallout.value}`
  return wingAlive.value ? 'WING · ONLINE' : `WING · BACK IN ${Math.ceil(wingRespawn.value)}S`
})

onMounted(() => {
  const v = parseInt(localStorage.getItem('starfoxHighScore') || '0', 10)
  highScore.value = Number.isNaN(v) ? 0 : v
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => {
  navigationLocked.value = false
  if (wingCalloutTimer) clearTimeout(wingCalloutTimer)
})

function onGameStarted() {
  gameStarted.value = true
  navigationLocked.value = true
}

function onPower(level: number) {
  if (!gameStarted.value || gameOver.value) {
    powerMsg.value = ''
    return
  }
  powerMsg.value = level >= 3 ? 'WEAPONS MAXED' : level === 2 ? 'WEAPON UP ×2' : 'WEAPONS NOMINAL'
  if (powerTimer) clearTimeout(powerTimer)
  powerTimer = setTimeout(() => { powerMsg.value = '' }, 2200)
}

// 'over' fires the moment the run ends; 'death' a little later, after the explosion.
function onGameEnded() {
  navigationLocked.value = false
}

function onGameOver() {
  gameOver.value = true
  powerMsg.value = ''
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
  powerMsg.value = ''
  wingCallout.value = ''
  if (wingCalloutTimer) { clearTimeout(wingCalloutTimer); wingCalloutTimer = null }
  bossActive.value = false
  bossHp.value = 0
  bossMax.value = 0
  wingAlive.value = true
  wingRespawn.value = 0
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
.landing .sfx-wing {
  margin-top: 0.25em;
}

.sfx-bar {
  display: block;
  width: min(288px, 60vw);
  height: 10px;
  margin: 0.5em auto 0;
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
/* Bottom dock: all in-game text and meters sit here so the corridor
   stays clear. Sits above the bottom band (--app-safe-bottom), at least 3 rem up. */
.sfx-dock {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: max(3rem, calc(2.2rem + var(--app-safe-bottom, 0px)));
  z-index: 3;
  width: min(560px, 92vw);
  text-align: center;
  pointer-events: none;
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
</style>
