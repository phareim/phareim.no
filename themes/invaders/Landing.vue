<template>
  <DefaultLanding
    :class="{ 'invaders-playing': gameStarted && !gameOver }"
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
      <SoundToggle />
      <template v-if="gameOver">
        <h1 class="px-title">GAME OVER</h1>
        <p class="px-hud">SCORE {{ score }} · WAVE {{ wave }}</p>
        <p v-if="isNewHigh && score > 0" class="px-hud px-blink" style="--px-hud: #ffd23f">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO PLAY AGAIN', 'TAP TO PLAY AGAIN') }} ◀</p>
      </template>
      <template v-else>
        <p class="location px-hud">
          SCORE {{ score }} · WAVE {{ wave }}<template v-if="gameStarted"> · {{ '▲'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
          <p class="px-hint px-dim">{{ hint('← → / A-D MOVE · HOLD SPACE FIRE · ESC PAUSE', 'DRAG TO MOVE · HOLD TO FIRE') }}</p>
          <p class="px-hint px-dim">GOLD CRATES · P PIERCE · B BLAST</p>
        </template>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Invaders from './Invaders.vue'
import SoundToggle from '~/themes/base/SoundToggle.vue'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'invaders' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()

const score = ref(0)
const wave = ref(1)
const lives = ref(1)
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
  submitScore('invaders', score.value)
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
/* Text styles: themes/base/pixel/pixel.css (.px-*). */
.invaders-playing .landing-overlay {
  align-items: flex-start;
  padding-top: max(14px, env(safe-area-inset-top));
  pointer-events: none;
}
.invaders-playing .px-hud {
  margin: 0;
}
/* On phones the run's score sits top-left, clear of the radio. */
@media (max-width: 600px) {
  .invaders-playing .landing-overlay {
    justify-content: flex-start;
  }
  .invaders-playing .landing-home {
    text-align: left;
    margin: 0;
  }
}
</style>
