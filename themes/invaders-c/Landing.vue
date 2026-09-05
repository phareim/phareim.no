<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'invaders-c-fade': gameStarted }"
  >
    <template #background>
      <Invaders
        @score="s => score = s"
        @wave="n => wave = n"
        @lives="n => lives = n"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
      />
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="invaders-c-over-title">GAME OVER</h1>
        <p class="invaders-c-hud invaders-c-over-score">SCORE: {{ score }} · WAVE {{ wave }}</p>
        <p v-if="score >= highScore && score > 0" class="invaders-c-hud invaders-c-new-high">NEW HIGH SCORE!</p>
        <p v-else class="invaders-c-hud">HIGH SCORE: {{ highScore }}</p>
        <p class="invaders-c-hint">PRESS ENTER OR TAP TO PLAY AGAIN</p>
      </template>
      <template v-else>
        <div :class="{ 'invaders-c-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location invaders-c-hud">
          SCORE: {{ score }} · WAVE {{ wave }}<template v-if="gameStarted"> · {{ '▲'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location invaders-c-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="invaders-c-hint">PRESS ENTER OR TAP TO START</p>
          <p class="invaders-c-hint invaders-c-hint-dim">← → / A-D MOVE · SPACE FIRE · 1 SHOT AT A TIME</p>
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
const gameOver = ref(false)
const gameStarted = ref(false)

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('invaders-cHighScore') || '0', 10)
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => { navigationLocked.value = false })

function onGameStarted() {
  gameStarted.value = true
  navigationLocked.value = true
}

function onGameOver() {
  gameOver.value = true
  navigationLocked.value = false
  if (score.value > highScore.value) {
    highScore.value = score.value
    localStorage.setItem('invaders-cHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  navigationLocked.value = true
}
</script>

<style>
.invaders-c-hud {
  font-family: "Courier New", monospace;
  color: #2ff3ff;
  text-shadow: 0 0 10px #2ff3ff;
  letter-spacing: 0.15em;
  font-size: 1em;
}

.invaders-c-over-title {
  font-family: "Courier New", monospace;
  color: #ff2fa0;
  text-shadow: 0 0 20px #ff2fa0, 0 0 40px #ff2fa0;
  font-size: 2.8em;
  letter-spacing: 0.1em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
}
@media (min-width: 800px) {
  .invaders-c-over-title {
    font-size: 3.2em;
    margin-top: 0.5em;
  }
}

.invaders-c-over-score {
  margin-top: 0.3em;
}

.invaders-c-new-high {
  animation: invaders-c-pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes invaders-c-pulse-glow {
  from { text-shadow: 0 0 10px #2ff3ff; }
  to { text-shadow: 0 0 20px #2ff3ff, 0 0 40px #ff2fa0; }
}

.invaders-c-hint {
  font-family: "Courier New", monospace;
  color: #2ff3ff;
  text-shadow: 0 0 8px #2ff3ff;
  font-size: 0.9em;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin-top: 1em;
}

.invaders-c-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.invaders-c-hud-dim {
  font-family: "Courier New", monospace;
  color: #2ff3ff;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.invaders-c-fade {
  animation: invaders-c-fade-out 4s forwards;
}
@keyframes invaders-c-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
