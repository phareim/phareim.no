<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'invaders-fade': gameStarted }"
  >
    <template #background>
      <Invaders
        @score="s => score = s"
        @wave="n => wave = n"
        @lives="n => lives = n"
        @over="onGameEnded"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
      />
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="invaders-over-title">GAME OVER</h1>
        <p class="invaders-hud invaders-over-score">SCORE: {{ score }} · WAVE {{ wave }}</p>
        <p v-if="isNewHigh && score > 0" class="invaders-hud invaders-new-high">NEW HIGH SCORE!</p>
        <p v-else class="invaders-hud">HIGH SCORE: {{ highScore }}</p>
        <p class="invaders-hint">PRESS ENTER OR TAP TO PLAY AGAIN</p>
      </template>
      <template v-else>
        <div :class="{ 'invaders-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location invaders-hud">
          SCORE: {{ score }} · WAVE {{ wave }}<template v-if="gameStarted"> · {{ '▲'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location invaders-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="invaders-hint">PRESS ENTER OR TAP TO START</p>
          <p class="invaders-hint invaders-hint-dim">← → / A-D MOVE · SPACE FIRE · 1 SHOT AT A TIME</p>
        </template>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Invaders from './Invaders.vue'
import { profile } from '~/themes/content'

const { navigationLocked } = useTheme()

const score = ref(0)
const wave = ref(1)
const lives = ref(3)
const highScore = ref(0)
const isNewHigh = ref(false)
const gameOver = ref(false)
const gameStarted = ref(false)

onMounted(() => {
  const v = parseInt(localStorage.getItem('invadersHighScore') || '0', 10)
  highScore.value = Number.isNaN(v) ? 0 : v
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => { navigationLocked.value = false })

function onGameStarted() {
  gameStarted.value = true
  navigationLocked.value = true
}

// 'over' fires the moment the run ends; 'death' ~0.9 s later, after the explosion.
function onGameEnded() {
  navigationLocked.value = false
}

function onGameOver() {
  gameOver.value = true
  navigationLocked.value = false
  isNewHigh.value = score.value > highScore.value
  if (isNewHigh.value) {
    highScore.value = score.value
    localStorage.setItem('invadersHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  isNewHigh.value = false
  navigationLocked.value = true
}
</script>

<style>
.invaders-hud {
  font-family: "Courier New", monospace;
  color: #2ff3ff;
  text-shadow: 0 0 10px #2ff3ff;
  letter-spacing: 0.15em;
  font-size: 1em;
}

.invaders-over-title {
  font-family: "Courier New", monospace;
  color: #ff2fa0;
  text-shadow: 0 0 20px #ff2fa0, 0 0 40px #ff2fa0;
  font-size: 2.8em;
  letter-spacing: 0.1em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
}
@media (min-width: 800px) {
  .invaders-over-title {
    font-size: 3.2em;
    margin-top: 0.5em;
  }
}

.invaders-over-score {
  margin-top: 0.3em;
}

.invaders-new-high {
  animation: invaders-pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes invaders-pulse-glow {
  from { text-shadow: 0 0 10px #2ff3ff; }
  to { text-shadow: 0 0 20px #2ff3ff, 0 0 40px #ff2fa0; }
}

.invaders-hint {
  font-family: "Courier New", monospace;
  color: #2ff3ff;
  text-shadow: 0 0 8px #2ff3ff;
  font-size: 0.9em;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin-top: 1em;
}

.invaders-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.invaders-hud-dim {
  font-family: "Courier New", monospace;
  color: #2ff3ff;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.invaders-fade {
  animation: invaders-fade-out 4s forwards;
}
@keyframes invaders-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
