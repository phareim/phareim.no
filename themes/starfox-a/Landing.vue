<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'sfxa-fade': gameStarted }"
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
        <h1 class="sfxa-over-title">MISSION FAILED</h1>
        <p class="sfxa-hud sfxa-over-score">SCORE: {{ score }} · {{ distance }} KM</p>
        <p v-if="isNewHigh && score > 0" class="sfxa-hud sfxa-new-high">NEW HIGH SCORE!</p>
        <p v-else class="sfxa-hud">HIGH SCORE: {{ highScore }}</p>
        <p class="sfxa-hint">PRESS ENTER OR TAP TO FLY AGAIN</p>
      </template>
      <template v-else>
        <div :class="{ 'sfxa-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location sfxa-hud">
          SCORE: {{ score }} · {{ distance }} KM<template v-if="gameStarted"> · {{ '◆'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location sfxa-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="sfxa-hint">PRESS ENTER OR TAP TO FLY</p>
          <p class="sfxa-hint sfxa-hint-dim">ARROWS STEER · SPACE FIRE · SHIFT ROLLS</p>
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

const score = ref(0)
const distance = ref(0)
const lives = ref(3)
const highScore = ref(0)
const isNewHigh = ref(false)
const gameOver = ref(false)
const gameStarted = ref(false)

onMounted(() => {
  const v = parseInt(localStorage.getItem('starfox-a-high') || '0', 10)
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
    localStorage.setItem('starfox-a-high', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  isNewHigh.value = false
  navigationLocked.value = true
}
</script>

<style>
.sfxa-hud {
  font-family: var(--theme-font-body, monospace);
  color: var(--theme-accent, #fff);
  letter-spacing: 0.15em;
  font-size: 1em;
}

.sfxa-over-title {
  font-family: var(--theme-font-body, monospace);
  color: var(--theme-accent, #fff);
  font-size: 2.8em;
  letter-spacing: 0.1em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
}
@media (min-width: 800px) {
  .sfxa-over-title {
    font-size: 3.2em;
  }
}

.sfxa-over-score {
  margin-top: 0.3em;
}

.sfxa-new-high {
  animation: sfxa-pulse 0.8s ease-in-out infinite alternate;
}
@keyframes sfxa-pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

.sfxa-hint {
  font-family: var(--theme-font-body, monospace);
  color: var(--theme-accent, #fff);
  font-size: 0.9em;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin-top: 1em;
}

.sfxa-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.sfxa-hud-dim {
  font-family: var(--theme-font-body, monospace);
  color: var(--theme-accent, #fff);
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.sfxa-fade {
  animation: sfxa-fade-out 4s forwards;
}
@keyframes sfxa-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
