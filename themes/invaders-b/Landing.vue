<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'invaders-b-fade': gameStarted }"
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
        <h1 class="invaders-b-over-title">GAME OVER</h1>
        <p class="invaders-b-hud invaders-b-over-score">SCORE: <span class="invaders-b-pink">{{ score }}</span> · WAVE {{ wave }}</p>
        <p v-if="score >= highScore && score > 0" class="invaders-b-hud invaders-b-new-high">NEW HIGH SCORE!</p>
        <p v-else class="invaders-b-hud">HIGH SCORE: {{ highScore }}</p>
        <p class="invaders-b-hint">PRESS ENTER OR TAP TO PLAY AGAIN</p>
      </template>
      <template v-else>
        <div :class="{ 'invaders-b-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location invaders-b-hud">
          SCORE: <span class="invaders-b-pink">{{ score }}</span> · WAVE {{ wave }}<template v-if="gameStarted"> · {{ '▲'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location invaders-b-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="invaders-b-hint">PRESS ENTER OR TAP TO START</p>
          <p class="invaders-b-hint invaders-b-hint-dim">← → / A D MOVE · SPACE FIRE</p>
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
  let v = 0
  try {
    const n = parseInt(localStorage.getItem('invaders-bHighScore') || '0', 10)
    v = Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    v = 0
  }
  highScore.value = v
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
    localStorage.setItem('invaders-bHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  navigationLocked.value = true
}
</script>

<style>
.invaders-b-hud {
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  color: #2440b3;
  letter-spacing: 0.08em;
  font-size: 1em;
  font-weight: 700;
}

.invaders-b-pink {
  color: #ff4f8b;
}

.invaders-b-over-title {
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  color: #ff4f8b;
  text-shadow: 2px 2px 0 #2440b3;
  font-size: 2.8em;
  letter-spacing: 0.06em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
  font-weight: 800;
}
@media (min-width: 800px) {
  .invaders-b-over-title {
    font-size: 3.2em;
    margin-top: 0.5em;
  }
}

.invaders-b-over-score {
  margin-top: 0.3em;
}

.invaders-b-new-high {
  animation: invaders-b-pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes invaders-b-pulse-glow {
  from { opacity: 1; }
  to { opacity: 0.45; }
}

.invaders-b-hint {
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  color: #2440b3;
  font-size: 0.9em;
  letter-spacing: 0.08em;
  font-weight: 700;
  opacity: 0.85;
  margin-top: 1em;
}

.invaders-b-hint-dim {
  opacity: 0.5;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.invaders-b-hud-dim {
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  color: #2440b3;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.08em;
}

.invaders-b-fade {
  animation: invaders-b-fade-out 4s forwards;
}
@keyframes invaders-b-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
