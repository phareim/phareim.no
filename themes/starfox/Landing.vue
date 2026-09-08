<template>
  <DefaultLanding
    :content-class="{ 'sfx-fade': gameStarted }"
  >
    <template #background>
      <ClientOnly>
        <Flight
          @score="(s: number) => score = s"
          @distance="(m: number) => distance = m"
          @health="(n: number, m: number) => { hp = n; hpMax = m }"
          @power="onPower"
          @sector="(n: number, p: SectorPhase) => { sector = n; phase = p }"
          @boss="(n: number, m: number, a: boolean) => { bossHp = n; bossMax = m; bossActive = a }"
          @over="onGameEnded"
          @death="onGameOver"
          @restart="onGameRestart"
          @started="onGameStarted"
        />
      </ClientOnly>
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="sfx-over-title">MISSION FAILED</h1>
        <p class="sfx-hud sfx-over-score">SCORE: {{ score }} · {{ distance }} KM · SECTOR {{ pad(sector) }}</p>
        <p v-if="isNewHigh && score > 0" class="sfx-hud sfx-new-high">NEW HIGH SCORE!</p>
        <p v-else class="sfx-hud">HIGH SCORE: {{ highScore }}</p>
        <p v-if="rank" class="sfx-hud sfx-hud-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="sfx-hint">{{ hint('PRESS ENTER TO FLY AGAIN', 'TAP TO FLY AGAIN') }}</p>
      </template>
      <template v-else>
        <p class="location sfx-hud">
          SECTOR {{ pad(sector) }} · SCORE: {{ score }} · {{ distance }} KM
        </p>
        <div v-if="gameStarted" class="sfx-bar" role="status" aria-label="Hull integrity">
          <div class="sfx-bar-fill" :class="hpClass" :style="{ width: `${Math.round(100 * hp / hpMax)}%` }" />
        </div>
        <p v-if="banner" class="location sfx-hud sfx-banner">{{ banner }}</p>
        <p v-if="powerMsg" class="location sfx-hud sfx-power">{{ powerMsg }}</p>
        <p v-if="highScore > 0 && !gameStarted" class="location sfx-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="sfx-hint">▶ {{ hint('PRESS ENTER TO FLY', 'TAP TO FLY') }} ◀</p>
          <p class="sfx-hint sfx-hint-dim">{{ hint('ARROWS · SPACE FIRE · SHIFT ROLL · ESC PAUSE', 'DRAG TO STEER · AUTO-FIRE · DOUBLE-TAP ROLL') }}</p>
        </template>
      </template>
      <!-- The boss meter sits above the card, fixed to the viewport top. -->
      <div v-if="bossActive && !gameOver" class="sfx-boss">
        <span class="sfx-boss-name">{{ BOSS_NAME }}</span>
        <span class="sfx-bar sfx-boss-bar" role="status" aria-label="Boss integrity">
          <span class="sfx-bar-fill sfx-bar-boss" :style="{ width: `${bossMax > 0 ? Math.round(100 * bossHp / bossMax) : 0}%` }" />
        </span>
      </div>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import { BOSS_NAME, sectorClearBonus, HEAL_CLEAR, type SectorPhase } from './balance'

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
const highScore = ref(0)
const isNewHigh = ref(false)
const gameOver = ref(false)
const gameStarted = ref(false)
const powerMsg = ref('')
let powerTimer: ReturnType<typeof setTimeout> | null = null

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
  if (phase.value === 'warning') return `⚠ ${BOSS_NAME} APPROACHING`
  if (phase.value === 'clear') return `SECTOR ${pad(sector.value)} CLEAR · +${sectorClearBonus(sector.value)} · +${HEAL_CLEAR} HULL`
  return ''
})

onMounted(() => {
  const v = parseInt(localStorage.getItem('starfoxHighScore') || '0', 10)
  highScore.value = Number.isNaN(v) ? 0 : v
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => { navigationLocked.value = false })

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
  bossActive.value = false
  bossHp.value = 0
  bossMax.value = 0
  sector.value = 1
  phase.value = 'travel'
  navigationLocked.value = true
}
</script>

<style>
.sfx-hud {
  font-family: var(--font-machine);
  color: var(--sfx-cyan, #2ff3ff);
  letter-spacing: 0.15em;
  font-size: 1em;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
}

.sfx-over-title {
  font-family: var(--font-machine);
  color: var(--sfx-pink, #ff2fa0);
  font-size: 2.8em;
  letter-spacing: 0.1em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
  text-shadow: 0 0 12px rgba(255, 47, 160, 0.8), 0 0 40px rgba(255, 47, 160, 0.4);
}
@media (min-width: 800px) {
  .sfx-over-title {
    font-size: 3.2em;
  }
}

.sfx-over-score {
  margin-top: 0.3em;
}

.sfx-new-high {
  animation: sfx-pulse 0.8s ease-in-out infinite alternate;
}

.sfx-power {
  color: var(--sfx-gold, #ffd23f);
  text-shadow: 0 0 8px rgba(255, 210, 63, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
}

/* Hull + boss meters: thin machine-font bars, never touch targets. */
.sfx-bar {
  display: block;
  width: min(280px, 60vw);
  height: 6px;
  margin: 0.5em auto 0;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(47, 243, 255, 0.4);
  border-radius: 3px;
  overflow: hidden;
}
.sfx-bar-fill {
  display: block;
  height: 100%;
  background: var(--sfx-cyan, #2ff3ff);
  box-shadow: 0 0 8px rgba(47, 243, 255, 0.8);
  transition: width 0.2s linear;
}
.sfx-bar-mid {
  background: var(--sfx-gold, #ffd23f);
  box-shadow: 0 0 8px rgba(255, 210, 63, 0.8);
}
.sfx-bar-low {
  background: var(--sfx-pink, #ff2fa0);
  box-shadow: 0 0 8px rgba(255, 47, 160, 0.8);
  animation: sfx-pulse 0.5s ease-in-out infinite alternate;
}
.sfx-banner {
  color: var(--sfx-gold, #ffd23f);
  text-shadow: 0 0 8px rgba(255, 210, 63, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
  animation: sfx-pulse 0.8s ease-in-out infinite alternate;
}
.sfx-boss {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  text-align: center;
  pointer-events: none;
}
.sfx-boss-name {
  font-family: var(--font-machine);
  font-size: 0.7em;
  letter-spacing: 0.3em;
  color: var(--sfx-pink, #ff2fa0);
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.7);
}
.sfx-boss-bar {
  margin-top: 0.3em;
  border-color: rgba(255, 47, 160, 0.5);
}
.sfx-bar-boss {
  background: var(--sfx-pink, #ff2fa0);
  box-shadow: 0 0 8px rgba(255, 47, 160, 0.8);
}
@keyframes sfx-pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

.sfx-hint {
  font-family: var(--font-machine);
  color: var(--sfx-pink, #ff2fa0);
  font-size: 0.9em;
  letter-spacing: 0.12em;
  opacity: 0.9;
  margin-top: 1em;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.6);
  animation: sfx-blink 1.6s ease-in-out infinite alternate;
}
@keyframes sfx-blink {
  from { opacity: 0.55; }
  to { opacity: 1; }
}

.sfx-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.sfx-hud-dim {
  font-family: var(--font-machine);
  color: var(--theme-accent, #fff);
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.sfx-fade {
  animation: sfx-fade-out 4s forwards;
}
@keyframes sfx-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
