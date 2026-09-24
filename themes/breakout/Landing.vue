<template>
  <DefaultLanding>
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
      <SoundToggle />
      <template v-if="gameOver">
        <h1 class="px-title">GAME OVER</h1>
        <p class="px-hud">SCORE {{ score }} · LEVEL {{ level }}</p>
        <p v-if="score >= highScore && score > 0" class="px-hud px-blink" style="--px-hud: #ffd23f">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO PLAY AGAIN', 'TAP TO PLAY AGAIN') }} ◀</p>
      </template>
      <template v-else>
        <p class="location px-hud" :class="{ 'breakout-hud-live': gameStarted }">
          SCORE {{ score }}<template v-if="gameStarted"> · LEVEL {{ level }} · {{ '♥'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="location px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
          <p class="px-hint px-dim">{{ hint('← → MOVE · SPACE LAUNCH · ESC PAUSE', 'DRAG TO MOVE · TAP TO LAUNCH') }}</p>
        </template>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Breakout from './Breakout.vue'
import SoundToggle from '~/themes/base/SoundToggle.vue'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'breakout' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
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
  submitScore('breakout', score.value)
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
/* Text styles: themes/base/pixel/pixel.css (.px-*). */

/* During a run the HUD line moves to the top-left corner, clear of the
   ball's path; on phones it sits between the radio widget and the bricks. */
.landing .breakout-hud-live {
  position: absolute;
  top: 16px;
  left: 16px;
  margin: 0;
  text-align: left;
  pointer-events: none;
}
@media (max-width: 640px) {
  .landing .breakout-hud-live {
    top: calc(max(0.6rem, env(safe-area-inset-top)) + 42px);
    left: 12px;
  }
}
</style>
