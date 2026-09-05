<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'invaders-a-fade': gameStarted }"
  >
    <template #background>
      <Invaders
        @score="s => score = s"
        @wave="n => wave = n"
        @lives="n => lives = n"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
        @over="onGameOverUnlock"
      />
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="invaders-a-over-title">GAME OVER</h1>
        <p class="invaders-a-hud invaders-a-over-score">SCORE: {{ score }} · WAVE {{ wave }}</p>
        <p v-if="score >= highScore && score > 0" class="invaders-a-hud invaders-a-new-high">NEW HIGH SCORE!</p>
        <p v-else class="invaders-a-hud">HIGH SCORE: {{ highScore }}</p>
        <p class="invaders-a-hint">PRESS ENTER OR TAP TO PLAY AGAIN</p>
      </template>
      <template v-else>
        <div :class="{ 'invaders-a-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location invaders-a-hud">
          SCORE: {{ score }} · WAVE {{ wave }}<template v-if="gameStarted"> · {{ '▲'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location invaders-a-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="invaders-a-hint">PRESS ENTER OR TAP TO START</p>
          <p class="invaders-a-hint invaders-a-hint-dim">ARROWS/A-D MOVE · SPACE FIRE · 1 SHOT AT A TIME</p>
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
  try {
    const n = parseInt(localStorage.getItem('invaders-aHighScore') || '0', 10)
    highScore.value = Number.isNaN(n) ? 0 : n
  } catch { highScore.value = 0 }
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
    try { localStorage.setItem('invaders-aHighScore', String(highScore.value)) } catch { /* private mode */ }
  }
}

// Fired the moment the run ends (up to ~0.9 s before the GAME OVER card, while
// the explosion plays out) so the arrow keys are never dead.
function onGameOverUnlock() {
  navigationLocked.value = false
}

function onGameRestart() {
  gameOver.value = false
  navigationLocked.value = true
}
</script>

<style>
.invaders-a-hud {
  font-family: "Courier New", monospace;
  color: #39ff6a;
  text-shadow: 0 0 10px #39ff6a;
  letter-spacing: 0.15em;
  font-size: 1em;
}

.invaders-a-over-title {
  font-family: "Courier New", monospace;
  color: #ff3b30;
  text-shadow: 0 0 20px #ff3b30, 0 0 40px #ff3b30;
  font-size: 2.8em;
  letter-spacing: 0.1em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
}
@media (min-width: 800px) {
  .invaders-a-over-title {
    font-size: 3.2em;
    margin-top: 0.5em;
  }
}

.invaders-a-over-score {
  margin-top: 0.3em;
}

.invaders-a-new-high {
  animation: invaders-a-pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes invaders-a-pulse-glow {
  from { text-shadow: 0 0 10px #39ff6a; }
  to { text-shadow: 0 0 20px #39ff6a, 0 0 40px #ff3b30; }
}

.invaders-a-hint {
  font-family: "Courier New", monospace;
  color: #dfe8df;
  text-shadow: 0 0 8px #dfe8df;
  font-size: 0.9em;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin-top: 1em;
}

.invaders-a-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.invaders-a-hud-dim {
  font-family: "Courier New", monospace;
  color: #39ff6a;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.invaders-a-fade {
  animation: invaders-a-fade-out 4s forwards;
}
@keyframes invaders-a-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
