<template>
  <DefaultLanding>
    <template #background>
      <Breakout
        ref="game"
        @score="(s: number) => score = s"
        @lives="(n: number) => lives = n"
        @level="(n: number) => level = n"
        @paused="(v: boolean) => paused = v"
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

      <template v-else-if="gameStarted && paused">
        <div class="px-box odyssey-card">
          <h1 class="px-title odyssey-paused">PAUSED</h1>
          <p class="px-hud">SCORE {{ score }} · LEVEL {{ level }}</p>
          <button class="px-btn odyssey-btn" type="button" @click="resume">RESUME</button>
          <button class="px-btn odyssey-btn" type="button" @click="quit">QUIT</button>
          <p class="px-hud px-dim">{{ hint('ESC OR P TO RESUME · HOLD ESC TO QUIT', 'RESUME OR QUIT ABOVE') }}</p>
        </div>
      </template>

      <template v-else-if="gameStarted">
        <p class="location px-hud breakout-hud-live">
          SCORE {{ score }} · LEVEL {{ level }} · {{ '♥'.repeat(Math.max(0, lives)) }}
          <button class="px-btn odyssey-pause" type="button" aria-label="Pause" @click="pause">II</button>
        </p>
      </template>

      <template v-else>
        <div class="odyssey-start">
          <h1 class="px-title odyssey-logo">SPACE PADDLE</h1>
          <p class="px-hud odyssey-sub">THE ODYSSEY</p>
          <p class="px-hud px-dim odyssey-review">"en syretripp av et spill. David Bowie nikker anerkjennende."<br>GAMER'S DIGEST · 9/10</p>
          <p v-if="highScore > 0" class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
          <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
          <p class="px-hint px-dim">{{ hint('← → MOVE · SPACE LAUNCH · P PAUSE', 'DRAG TO MOVE · TAP TO LAUNCH') }}</p>
          <p class="px-hud px-dim odyssey-copy">(C) SLEEPY PRODUCTIONS, 2Q89</p>
        </div>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import SoundToggle from '~/themes/base/SoundToggle.vue'

/** The game is its own chunk (2026-09-30): the landing is the title screen. */
const Breakout = defineAsyncComponent(() => import('./Breakout.vue'))

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'breakout' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()

const game = ref(null)
const score = ref(0)
const lives = ref(3)
const level = ref(1)
const paused = ref(false)
const highScore = ref(0)
const gameOver = ref(false)
const gameStarted = ref(false)

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('breakoutHighScore') || '0', 10)
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => { navigationLocked.value = false })

function pause() { game.value?.togglePause() }
function resume() { game.value?.togglePause() }
function quit() { game.value?.quitToGameOver() }

function onGameStarted() {
  gameStarted.value = true
  navigationLocked.value = true
}

function onGameOver() {
  gameOver.value = true
  paused.value = false
  navigationLocked.value = false
  submitScore('breakout', score.value)
  if (score.value > highScore.value) {
    highScore.value = score.value
    localStorage.setItem('breakoutHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  paused.value = false
  navigationLocked.value = true
}
</script>

<style>
/* Text styles: themes/base/pixel/pixel.css (.px-*). Hard pixel shadows only, no glows. */

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

/* The touch pause button sits in the HUD line, so it never meets the paddle. */
.landing .odyssey-pause {
  pointer-events: auto;
  margin-left: 12px;
  padding: 2px 8px;
}

/* The title screen: the logo in pink with a cyan hard shadow, like a 1989 box. */
.landing .odyssey-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.landing .odyssey-logo {
  color: #ff2fa0;
  text-shadow: 3px 3px 0 #2ff3ff, 6px 6px 0 #0b0616;
  margin: 0;
}
.landing .odyssey-sub {
  color: #ffd23f;
  margin: 0;
  letter-spacing: 0.2em;
}
.landing .odyssey-review {
  max-width: 28ch;
  margin: 0;
}
.landing .odyssey-copy {
  margin-top: 6px;
}
/* The start text sits over the sun: a hard dark shadow keeps it readable. */
.landing .odyssey-start p {
  text-shadow: 2px 2px 0 #0b0616;
}

/* The pause card: a dialog box over the frozen field. */
.landing .odyssey-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  text-align: center;
}
.landing .odyssey-paused {
  color: #2ff3ff;
  text-shadow: 3px 3px 0 #ff2fa0;
  margin: 0;
}
.landing .odyssey-btn {
  min-width: 10em;
}
</style>
