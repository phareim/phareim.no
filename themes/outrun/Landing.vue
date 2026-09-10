<template>
  <DefaultLanding
    :content-class="{ 'outrun-fade': gameStarted }"
  >
    <template #background>
      <OutRun
        @score="(s: number) => score = s"
        @distance="(m: number) => distance = m"
        @time="(t: number) => timeLeft = t"
        @stage="(n: number) => stage = n"
        @speed="(k: number) => speed = k"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
        @over="onGameEnded"
        @quit="onQuit"
      />
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="outrun-over-title">{{ timedOut ? 'TIME UP' : 'GAME OVER' }}</h1>
        <p class="outrun-hud outrun-over-score">SCORE: {{ score }} · {{ distance }}M · STAGE {{ stage + 1 }}</p>
        <p v-if="score >= highScore && score > 0" class="outrun-hud outrun-new-high">NEW HIGH SCORE!</p>
        <p v-else class="outrun-hud">HIGH SCORE: {{ highScore }}</p>
        <p v-if="rank" class="outrun-hud outrun-hud-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="outrun-hint">▶ {{ hint('PRESS ENTER TO DRIVE AGAIN', 'TAP TO DRIVE AGAIN') }} ◀</p>
      </template>
      <template v-else>
        <p class="location outrun-hud">
          SCORE: {{ score }} · {{ distance }}M
        </p>
        <div v-if="gameStarted" class="outrun-dock">
          <div class="outrun-timebar" role="status" aria-label="Time left">
            <div class="outrun-timebar-fill" :class="{ 'outrun-time-low': timeLeft <= 10 }" :style="{ width: `${timePct}%` }" />
          </div>
          <p class="location outrun-hud outrun-sub">
            {{ timeLeft }}S · STAGE {{ stage + 1 }} · {{ speed }} KM/H
          </p>
        </div>
        <p v-if="highScore > 0 && !gameStarted" class="location outrun-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="outrun-hint">▶ {{ hint('PRESS ENTER TO DRIVE', 'TAP TO DRIVE') }} ◀</p>
          <p class="outrun-hint outrun-hint-dim">{{ hint('← → STEER · ↓ BRAKE · ESC PAUSE', 'DRAG TO STEER · 2ND FINGER BRAKES') }}</p>
        </template>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import OutRun from './OutRun.vue'
import { START_TIME } from './engine'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'outrun' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()

const score = ref(0)
const distance = ref(0)
const timeLeft = ref(START_TIME)
const stage = ref(0)
const speed = ref(0)
const highScore = ref(0)
const gameOver = ref(false)
const timedOut = ref(true)
const gameStarted = ref(false)

const timePct = computed(() => Math.max(0, Math.min(100, (timeLeft.value / START_TIME) * 100)))

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('outrunHighScore') || '0', 10)
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => { navigationLocked.value = false })

function onGameStarted() {
  gameStarted.value = true
  navigationLocked.value = true
}

// 'over' fires the moment the run ends; 'death' a little later, after TIME UP.
function onGameEnded() {
  navigationLocked.value = false
}

function onGameOver() {
  gameOver.value = true
  navigationLocked.value = false
  submitScore('outrun', score.value)
  if (score.value > highScore.value) {
    highScore.value = score.value
    localStorage.setItem('outrunHighScore', String(highScore.value))
  }
}

/** A manual Esc-hold quit shows GAME OVER; only the clock shows TIME UP. */
function onQuit() {
  timedOut.value = false
}

function onGameRestart() {
  gameOver.value = false
  timedOut.value = true
  navigationLocked.value = true
}
</script>

<style>
.outrun-hud {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
  letter-spacing: 0.15em;
  font-size: 1em;
}

.outrun-over-title {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  text-shadow: 0 0 12px rgba(255, 47, 160, 0.8), 0 0 40px rgba(255, 47, 160, 0.4);
  font-size: 2.8em;
  letter-spacing: 0.1em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
}
@media (min-width: 800px) {
  .outrun-over-title {
    font-size: 3.2em;
    margin-top: 0.5em;
  }
}

.outrun-over-score {
  margin-top: 0.3em;
}

.outrun-new-high {
  animation: outrun-pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes outrun-pulse-glow {
  from { text-shadow: 0 0 10px #2ff3ff; }
  to { text-shadow: 0 0 20px #2ff3ff, 0 0 40px #ff2fa0; }
}
@media (prefers-reduced-motion: reduce) {
  .outrun-new-high {
    animation: none;
  }
}

.outrun-hint {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.6);
  font-size: 0.9em;
  letter-spacing: 0.12em;
  margin-top: 1em;
}

.outrun-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.outrun-hud-dim {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

/* Countdown bar + speed readout dock above the pager dots. */
.outrun-dock {
  width: min(320px, 64vw);
  margin: 0.5em auto 0;
  pointer-events: none;
}
.outrun-timebar {
  display: block;
  height: 6px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(47, 243, 255, 0.4);
  border-radius: 3px;
  overflow: hidden;
}
.outrun-timebar-fill {
  display: block;
  height: 100%;
  background: #2ff3ff;
  box-shadow: 0 0 8px rgba(47, 243, 255, 0.8);
  transition: width 0.2s linear;
}
.outrun-time-low {
  background: #ff2fa0;
  box-shadow: 0 0 8px rgba(255, 47, 160, 0.8);
  animation: outrun-pulse-glow 0.5s ease-in-out infinite alternate;
}
.outrun-sub {
  margin-top: 0.4em;
}

.outrun-fade {
  animation: outrun-fade-out 4s forwards;
}
@keyframes outrun-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
