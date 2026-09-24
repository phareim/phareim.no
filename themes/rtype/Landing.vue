<template>
  <DefaultLanding>
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
      <SoundToggle />
      <template v-if="gameOver">
        <h1 class="px-title rtype-px">GAME OVER</h1>
        <p class="px-hud">SCORE {{ score }} · DIST {{ distance }}M</p>
        <p v-if="score >= highScore && score > 0" class="px-hud px-blink" style="--px-hud: #ffd23f">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink rtype-px">▶ {{ hint('PRESS ENTER TO PLAY AGAIN', 'TAP TO PLAY AGAIN') }} ◀</p>
      </template>
      <template v-else>
        <p class="px-hud" :class="{ 'rtype-hud-live': gameStarted }">
          SCORE {{ score }} · DIST {{ distance }}M<template v-if="gameStarted"> · {{ '▶'.repeat(Math.max(0, lives)) }}</template>
        </p>
        <p v-if="highScore > 0 && !gameStarted" class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <template v-if="!gameStarted">
          <p class="px-hint px-blink rtype-px">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
          <p class="px-hint px-dim">{{ hint('ARROWS/WASD MOVE · SPACE FIRE · SHIFT FORCE POD · ESC PAUSE', 'DRAG TO MOVE · AUTO-FIRE · DOUBLE-TAP FORCE POD') }}</p>
        </template>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Shooter from './Shooter.vue'
import SoundToggle from '~/themes/base/SoundToggle.vue'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'rtype' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()

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
  submitScore('rtype', score.value)
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
/* Text styles: themes/base/pixel/pixel.css (.px-*); R-Type's call to
   action and title stay in its orange danger hue. */
.landing .rtype-px {
  --px-hint: #ff8a3d;
  --px-title: #ff8a3d;
}

/* During a run the score line moves to the top centre (the canvas lists
   active power-ups top-left); on phones it sits below that list. */
.landing .rtype-hud-live {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  pointer-events: none;
}
@media (max-width: 640px) {
  .landing .rtype-hud-live {
    top: calc(max(0.6rem, env(safe-area-inset-top)) + 64px);
  }
}
</style>
