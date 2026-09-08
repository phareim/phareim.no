<template>
  <DefaultLanding
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
        <p v-if="rank" class="hacker-score hacker-highscore-inline">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="game-over-restart">▶ {{ hint('PRESS ENTER TO PLAY AGAIN', 'TAP TO PLAY AGAIN') }} ◀</p>
      </template>
      <template v-else>
        <p class="location hacker-score">SCORE: {{ score }}</p>
        <p v-if="highScore > 0" class="location hacker-highscore-inline">HIGH SCORE: {{ highScore }}</p>
        <p v-if="!gameStarted" class="game-over-restart">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import SpaceInvaders from './SpaceInvaders.vue'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'hacker' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()

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
  submitScore('hacker', score.value)
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
/* Shared Neon Dreams HUD and threat colours. */
.hacker-score {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
  letter-spacing: 0.15em;
  font-size: 1em;
}

.game-over-title {
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
  from { text-shadow: 0 0 10px #2ff3ff; }
  to { text-shadow: 0 0 20px #2ff3ff, 0 0 40px #ff2fa0; }
}
@media (prefers-reduced-motion: reduce) {
  .new-highscore {
    animation: none;
  }
}

.game-over-restart {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.6);
  font-size: 0.9em;
  letter-spacing: 0.12em;
  margin-top: 1em;
}

.hacker-highscore-inline {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.hacker-fade {
  animation: fade-out-overlay 4s forwards;
}
@keyframes fade-out-overlay {
  0% { opacity: 1; }
  50% { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
</style>
