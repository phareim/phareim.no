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
        <h1 class="px-title">GAME OVER</h1>
        <p class="px-hud">SCORE {{ score }}</p>
        <p v-if="reached" class="px-hud px-dim">SECTOR {{ reached.sector }} · {{ reached.sectorName }} · WAVE {{ reached.wave }}</p>
        <p v-if="score >= highScore" class="px-hud px-blink" style="--px-hud: #ffd23f">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO PLAY AGAIN', 'TAP TO PLAY AGAIN') }} ◀</p>
      </template>
      <!-- During a run the canvas HUD carries the score; the page stays clear. -->
      <template v-else-if="!gameStarted">
        <h1 class="px-title galaga-title">GALAGA</h1>
        <p class="px-hud">KESTREL HAS GONE QUIET</p>
        <p v-if="highScore > 0" class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
        <p class="px-hint px-dim">{{ hint('ARROWS MOVE · SPACE FIRE · SHIFT SYNC · ESC PAUSE', 'DRAG TO FLY · TWO FINGERS SYNC') }}</p>
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
/* Text styles: themes/base/pixel/pixel.css (.px-*). */
.landing .galaga-title {
  letter-spacing: 16px;
  margin-right: -16px;
}
</style>
