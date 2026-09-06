<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'sfx-fade': gameStarted }"
  >
    <template #background>
      <ClientOnly>
        <Flight
          @score="(s: number) => score = s"
          @distance="(m: number) => distance = m"
          @lives="(n: number) => lives = n"
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
        <p class="sfx-hud sfx-over-score">SCORE: {{ score }} · {{ distance }} KM</p>
        <p v-if="isNewHigh && score > 0" class="sfx-hud sfx-new-high">NEW HIGH SCORE!</p>
        <p v-else class="sfx-hud">HIGH SCORE: {{ highScore }}</p>
        <p class="sfx-hint">{{ hint('PRESS ENTER TO FLY AGAIN', 'TAP TO FLY AGAIN') }}</p>
      </template>
      <template v-else>
        <div :class="{ 'sfx-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location sfx-hud">
          SCORE: {{ score }} · {{ distance }} KM<template v-if="gameStarted"> · {{ '◆'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location sfx-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="sfx-hint">▶ {{ hint('PRESS ENTER TO FLY', 'TAP TO FLY') }} ◀</p>
          <p class="sfx-hint sfx-hint-dim">{{ hint('ARROWS · SPACE FIRE · SHIFT ROLL', 'DRAG TO STEER · AUTO-FIRE · DOUBLE-TAP ROLL') }}</p>
        </template>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import { profile } from '~/themes/content'

// three.js is ~170 KB gzipped: load it only when this theme is on screen.
const Flight = defineAsyncComponent(() => import('./Flight.vue'))

const { navigationLocked } = useTheme()
const { hint } = useInputMode()

const score = ref(0)
const distance = ref(0)
const lives = ref(3)
const highScore = ref(0)
const isNewHigh = ref(false)
const gameOver = ref(false)
const gameStarted = ref(false)

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

// 'over' fires the moment the run ends; 'death' a little later, after the explosion.
function onGameEnded() {
  navigationLocked.value = false
}

function onGameOver() {
  gameOver.value = true
  navigationLocked.value = false
  isNewHigh.value = score.value > highScore.value
  if (isNewHigh.value) {
    highScore.value = score.value
    localStorage.setItem('starfoxHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  isNewHigh.value = false
  navigationLocked.value = true
}
</script>

<style>
.sfx-hud {
  font-family: var(--theme-font-body, monospace);
  color: var(--sfx-cyan, #2ff3ff);
  letter-spacing: 0.15em;
  font-size: 1em;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
}

.sfx-over-title {
  font-family: var(--theme-font-body, monospace);
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
@keyframes sfx-pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

.sfx-hint {
  font-family: var(--theme-font-body, monospace);
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
  font-family: var(--theme-font-body, monospace);
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
