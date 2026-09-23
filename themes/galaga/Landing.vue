<template>
  <DefaultLanding>
    <template #background>
      <Galaga
        @score="s => score = s"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
      />
    </template>

    <template #body>
      <template v-if="gameOver">
        <h1 class="game-over-title">GAME OVER</h1>
        <p class="galaga-score game-over-score">SCORE: {{ score }}</p>
        <p v-if="reached" class="galaga-score galaga-highscore-inline">SECTOR {{ reached.sector }} · {{ reached.sectorName }} · WAVE {{ reached.wave }}</p>
        <p v-if="score >= highScore" class="galaga-score new-highscore">NEW HIGH SCORE!</p>
        <p v-else class="galaga-score">HIGH SCORE: {{ highScore }}</p>
        <p v-if="rank" class="galaga-score galaga-highscore-inline">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="game-over-restart">▶ {{ hint('PRESS ENTER TO PLAY AGAIN', 'TAP TO PLAY AGAIN') }} ◀</p>
      </template>
      <!-- During a run the canvas HUD carries the score; the page stays clear. -->
      <template v-else-if="!gameStarted">
        <h1 class="game-over-title galaga-title">GALAGA</h1>
        <p class="galaga-score galaga-sub">KESTREL HAS GONE QUIET</p>
        <p v-if="highScore > 0" class="galaga-score galaga-highscore-inline">HIGH SCORE: {{ highScore }}</p>
        <p class="game-over-restart">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
        <p class="galaga-controls">{{ hint('ARROWS MOVE · SPACE FIRE · SHIFT SYNC · ESC PAUSE', 'DRAG TO FLY · TWO FINGERS SYNC') }}</p>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Galaga from './Galaga.vue'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'galaga' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()

const HIGH_SCORE_KEY = 'galagaHighScore'

const score = ref(0)
const highScore = ref(0)
const gameOver = ref(false)
const gameStarted = ref(false)
/** How far the last run got, from Galaga's death event. */
const reached = ref<{ sector: number; sectorName: string; wave: number } | null>(null)

onMounted(() => {
  // The theme was called Cyberpunk with the id `hacker` until 2026-09-08; keep
  // returning players' high score by falling back to the old key once.
  const stored = localStorage.getItem(HIGH_SCORE_KEY) ?? localStorage.getItem('hackerHighScore')
  highScore.value = parseInt(stored || '0', 10)
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => { navigationLocked.value = false })

function onGameStarted() {
  gameStarted.value = true
  navigationLocked.value = true
}

function onGameOver(progress?: { sector: number; sectorName: string; wave: number }) {
  reached.value = progress ?? null
  gameOver.value = true
  navigationLocked.value = false
  submitScore('galaga', score.value)
  if (score.value > highScore.value) {
    highScore.value = score.value
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  navigationLocked.value = true
}
</script>

<style>
/* Shared Neon Dreams HUD and threat colours. */
.galaga-score {
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

.galaga-highscore-inline {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  opacity: 0.5;
  font-size: 0.65em;
  letter-spacing: 0.1em;
}

.galaga-title {
  letter-spacing: 0.3em;
  margin-bottom: 0.2em;
}

.galaga-sub {
  font-size: 0.8em;
  opacity: 0.8;
}
@media (max-width: 480px) {
  .galaga-sub { font-size: 0.66em; }
  .galaga-controls { font-size: 0.6em; }
}

.galaga-controls {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  opacity: 0.45;
  font-size: 0.7em;
  letter-spacing: 0.12em;
  margin-top: 0.6em;
}
</style>
