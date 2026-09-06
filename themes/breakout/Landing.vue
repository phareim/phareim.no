<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'breakout-fade': gameStarted }"
  >
    <template #background>
      <Breakout
        @score="s => score = s"
        @lives="n => lives = n"
        @level="n => level = n"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
      />
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="breakout-over-title">GAME OVER</h1>
        <p class="breakout-hud breakout-over-score">SCORE: {{ score }} · LEVEL {{ level }}</p>
        <p v-if="score >= highScore && score > 0" class="breakout-hud breakout-new-high">NEW HIGH SCORE!</p>
        <p v-else class="breakout-hud">HIGH SCORE: {{ highScore }}</p>
        <p class="breakout-hint">▶ {{ hint('PRESS ENTER TO PLAY AGAIN', 'TAP TO PLAY AGAIN') }} ◀</p>
      </template>
      <template v-else>
        <div :class="{ 'breakout-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location breakout-hud">
          SCORE: {{ score }}<template v-if="gameStarted"> · LEVEL {{ level }} · {{ '◆'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location breakout-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="breakout-hint">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
          <p class="breakout-hint breakout-hint-dim">{{ hint('← → MOVE · SPACE LAUNCH', 'DRAG TO MOVE · TAP TO LAUNCH') }}</p>
        </template>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Breakout from './Breakout.vue'
import { profile } from '~/themes/content'

const { navigationLocked } = useTheme()
const { hint } = useInputMode()

const score = ref(0)
const lives = ref(3)
const level = ref(1)
const highScore = ref(0)
const gameOver = ref(false)
const gameStarted = ref(false)

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('breakoutHighScore') || '0', 10)
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
    localStorage.setItem('breakoutHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  navigationLocked.value = true
}
</script>

<style>
.breakout-hud {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
  letter-spacing: 0.15em;
  font-size: 1em;
}

.breakout-over-title {
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
  .breakout-over-title {
    font-size: 3.2em;
    margin-top: 0.5em;
  }
}

.breakout-over-score {
  margin-top: 0.3em;
}

.breakout-new-high {
  animation: breakout-pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes breakout-pulse-glow {
  from { text-shadow: 0 0 10px #2ff3ff; }
  to { text-shadow: 0 0 20px #2ff3ff, 0 0 40px #ff2fa0; }
}
@media (prefers-reduced-motion: reduce) {
  .breakout-new-high {
    animation: none;
  }
}

.breakout-hint {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.6);
  font-size: 0.9em;
  letter-spacing: 0.12em;
  margin-top: 1em;
}

.breakout-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.breakout-hud-dim {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.breakout-fade {
  animation: breakout-fade-out 4s forwards;
}
@keyframes breakout-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
