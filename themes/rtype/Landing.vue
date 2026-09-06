<template>
  <DefaultLanding
    :flipped="gameOver"
    :content-class="{ 'rtype-fade': gameStarted }"
  >
    <template #background>
      <Shooter
        @score="s => score = s"
        @distance="m => distance = m"
        @lives="n => lives = n"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
      />
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="rtype-over-title">GAME OVER</h1>
        <p class="rtype-hud rtype-over-score">SCORE: {{ score }} · DIST {{ distance }}M</p>
        <p v-if="score >= highScore && score > 0" class="rtype-hud rtype-new-high">NEW HIGH SCORE!</p>
        <p v-else class="rtype-hud">HIGH SCORE: {{ highScore }}</p>
        <p class="rtype-hint">▶ PRESS ENTER OR TAP TO PLAY AGAIN ◀</p>
      </template>
      <template v-else>
        <div :class="{ 'rtype-fade': gameStarted }">
          <h1>{{ profile.name }}</h1>
          <p v-for="line in profile.blurbs" :key="line" class="blurb">{{ line }}</p>
        </div>
        <p class="location rtype-hud">
          SCORE: {{ score }} · DIST {{ distance }}M<template v-if="gameStarted"> · {{ '◆'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location rtype-hud-dim">HIGH SCORE: {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="rtype-hint">▶ PRESS ENTER OR TAP TO START ◀</p>
          <p class="rtype-hint rtype-hint-dim">ARROWS/WASD MOVE · SPACE FIRE · SHIFT FORCE POD</p>
        </template>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Shooter from './Shooter.vue'
import { profile } from '~/themes/content'

const { navigationLocked } = useTheme()

const score = ref(0)
const distance = ref(0)
const lives = ref(3)
const highScore = ref(0)
const gameOver = ref(false)
const gameStarted = ref(false)

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('rtypeHighScore') || '0', 10)
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
    localStorage.setItem('rtypeHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  navigationLocked.value = true
}
</script>

<style>
.rtype-hud {
  font-family: "Courier New", monospace;
  text-transform: uppercase;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65), 0 0 24px rgba(255, 122, 26, 0.35);
  letter-spacing: 0.15em;
  font-size: 1em;
}

.rtype-over-title {
  font-family: "Courier New", monospace;
  text-transform: uppercase;
  color: #ff7a1a;
  text-shadow: 0 0 12px rgba(255, 122, 26, 0.8), 0 0 40px rgba(255, 122, 26, 0.4);
  font-size: 2.8em;
  letter-spacing: 0.1em;
  margin-top: 0.5em;
  margin-bottom: 0.1em;
}
@media (min-width: 800px) {
  .rtype-over-title {
    font-size: 3.2em;
    margin-top: 0.5em;
  }
}

.rtype-over-score {
  margin-top: 0.3em;
}

.rtype-new-high {
  animation: rtype-pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes rtype-pulse-glow {
  from { text-shadow: 0 0 10px #2ff3ff; }
  to { text-shadow: 0 0 20px #2ff3ff, 0 0 40px #ff7a1a; }
}
@media (prefers-reduced-motion: reduce) {
  .rtype-new-high {
    animation: none;
  }
}

.rtype-hint {
  font-family: "Courier New", monospace;
  text-transform: uppercase;
  color: #ff7a1a;
  text-shadow: 0 0 10px rgba(255, 122, 26, 0.6);
  font-size: 0.9em;
  letter-spacing: 0.12em;
  margin-top: 1em;
}

.rtype-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.2em;
}

.rtype-hud-dim {
  font-family: "Courier New", monospace;
  text-transform: uppercase;
  color: #2ff3ff;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.rtype-fade {
  animation: rtype-fade-out 4s forwards;
}
@keyframes rtype-fade-out {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
