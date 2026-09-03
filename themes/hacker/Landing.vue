<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'hacker-fade': gameStarted }"
  >
    <template #background>
      <SpaceInvaders
        @score="s => score = s"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
      />
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="game-over-title">GAME OVER</h1>
        <p class="hacker-score game-over-score">SCORE: {{ score }}</p>
        <p v-if="score >= highScore" class="hacker-score new-highscore">NEW HIGH SCORE!</p>
        <p v-else class="hacker-score">HIGH SCORE: {{ highScore }}</p>
        <p class="game-over-restart">PRESS ENTER TO START A NEW GAME</p>
      </template>
      <template v-else>
        <div :class="{ 'hacker-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location hacker-score">SCORE: {{ score }}</p>
        <p v-if="highScore > 0" class="location hacker-highscore-inline">HIGH SCORE: {{ highScore }}</p>
        <p v-if="!gameStarted" class="game-over-restart">PRESS ENTER TO START</p>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import SpaceInvaders from './SpaceInvaders.vue'
import { profile } from '~/themes/content'

const { navigationLocked } = useTheme()

const score = ref(0)
const highScore = ref(0)
const gameOver = ref(false)
const gameStarted = ref(false)

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('hackerHighScore') || '0', 10)
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
    localStorage.setItem('hackerHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  navigationLocked.value = true
}
</script>

<style>
.hacker-score {
  font-family: monospace;
  color: #00ff41;
  text-shadow: 0 0 10px #00ff41;
  letter-spacing: 0.15em;
  font-size: 1em;
}

.game-over-title {
  font-family: monospace;
  color: #00ff41;
  text-shadow: 0 0 20px #00ff41, 0 0 40px #00ff41;
  font-size: 2.8em;
  letter-spacing: 0.1em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
}
@media (min-width: 800px) {
  .game-over-title {
    font-size: 3.2em;
    margin-top: 0.5em;
  }
}

.game-over-score {
  margin-top: 0.3em;
}

.new-highscore {
  animation: pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes pulse-glow {
  from { text-shadow: 0 0 10px #00ff41; }
  to { text-shadow: 0 0 20px #00ff41, 0 0 40px #ffcc00; }
}

.game-over-restart {
  font-family: monospace;
  color: #00ff41;
  text-shadow: 0 0 8px #00ff41;
  font-size: 0.9em;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin-top: 1em;
}

.hacker-highscore-inline {
  font-family: monospace;
  color: #00ff41;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.hacker-fade {
  animation: fade-out-overlay 10s forwards;
}
@keyframes fade-out-overlay {
  0% { opacity: 1; }
  40% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
