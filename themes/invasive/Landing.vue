<template>
  <DefaultLanding :class="{ 'invasive-playing': gameStarted && !gameOver }">
    <template #background>
      <Game
        ref="game"
        @score="(s: number) => score = s"
        @layer="onLayer"
        @hint="(t: string) => hintText = t"
        @paused="(v: boolean) => paused = v"
        @over="onGameEnded"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
      />
    </template>

    <template #body>
      <SoundToggle />
      <template v-if="gameOver">
        <h1 class="px-title invasive-dark">THE TOWN IS DARK</h1>
        <p class="px-hud">SCORE {{ score }} · LAYER {{ layer }} {{ species }}</p>
        <p v-if="isNewHigh && score > 0" class="px-hud px-blink" style="--px-hud: #ffd23f">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO PLAY AGAIN', 'TAP TO PLAY AGAIN') }} ◀</p>
      </template>

      <template v-else-if="gameStarted && paused">
        <div class="px-box invasive-card">
          <h1 class="px-title invasive-paused">PAUSED</h1>
          <p class="px-hud">SCORE {{ score }} · LAYER {{ layer }}</p>
          <button class="px-btn invasive-btn" type="button" @click="resume">RESUME</button>
          <button class="px-btn invasive-btn" type="button" @click="quit">QUIT</button>
          <p class="px-hud px-dim">{{ hint('ESC OR P TO RESUME · HOLD ESC TO QUIT', 'RESUME OR QUIT ABOVE') }}</p>
        </div>
      </template>

      <template v-else-if="gameStarted">
        <div class="invasive-hud-live">
          <p class="px-hud">
            {{ score }} · LAYER {{ layer }}
            <button class="px-btn invasive-pause" type="button" aria-label="Pause" @click="pause">II</button>
          </p>
          <p v-if="hintText" class="px-hud invasive-tip">{{ hintText }}</p>
        </div>
      </template>

      <template v-else>
        <div class="invasive-start">
          <p class="px-hud invasive-over">INVADERS · MARK II</p>
          <h1 class="px-title invasive-logo">INVASIVE</h1>
          <p class="px-hud invasive-line">THEY STOPPED COMING IN ROWS.<br>NOW THE SKY IS ONE OF THEM.</p>
          <p v-if="highScore > 0" class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
          <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO START', 'TAP TO START') }} ◀</p>
          <p class="px-hint px-dim">CUT A TENDRIL: THE REST DIES<br>THE LANCE KILLS THE HEART<br>KEEP THE WINDOWS LIT</p>
          <p class="px-hint px-dim">{{ hint('← → MOVE · HOLD SPACE FIRE · P PAUSE', 'DRAG TO MOVE · TOUCH TO FIRE') }}</p>
        </div>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import SoundToggle from '~/themes/base/SoundToggle.vue'

/** The game is its own chunk: the landing is the title screen. */
const Game = defineAsyncComponent(() => import('./Game.vue'))

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'invasive' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()

const game = ref<{ togglePause(): void, quitToGameOver(): void } | null>(null)
const score = ref(0)
const layer = ref(1)
const species = ref('MOSS')
const hintText = ref('')
const paused = ref(false)
const highScore = ref(0)
const isNewHigh = ref(false)
const gameOver = ref(false)
const gameStarted = ref(false)

onMounted(() => {
  const v = parseInt(localStorage.getItem('invasiveHighScore') || '0', 10)
  highScore.value = Number.isNaN(v) ? 0 : v
})

// The game owns the arrow keys and horizontal touch while it runs.
onBeforeUnmount(() => { navigationLocked.value = false })

function pause() { game.value?.togglePause() }
function resume() { game.value?.togglePause() }
function quit() { game.value?.quitToGameOver() }

function onLayer(n: number, name: string) {
  layer.value = n
  species.value = name
}

function onGameStarted() {
  gameStarted.value = true
  navigationLocked.value = true
}

// 'over' fires the moment the last window goes out; 'death' two seconds later, once the town has gone dark.
function onGameEnded() {
  navigationLocked.value = false
  hintText.value = ''
}

function onGameOver() {
  gameOver.value = true
  paused.value = false
  navigationLocked.value = false
  if (score.value > 0) submitScore('invasive', score.value)
  isNewHigh.value = score.value > highScore.value
  if (isNewHigh.value) {
    highScore.value = score.value
    localStorage.setItem('invasiveHighScore', String(highScore.value))
  }
}

function onGameRestart() {
  gameOver.value = false
  isNewHigh.value = false
  paused.value = false
  hintText.value = ''
  navigationLocked.value = true
}
</script>

<style>
/* Text styles: themes/base/pixel/pixel.css (.px-*). Hard pixel shadows only. */

/* During a run the score sits top-left, clear of the radio, and lets touches through. */
.invasive-playing .landing-overlay {
  pointer-events: none;
}
.landing .invasive-hud-live {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  left: 12px;
  right: 12px;
  text-align: left;
  pointer-events: none;
}
.landing .invasive-hud-live .px-hud {
  margin: 0;
}
.landing .invasive-hud-live .invasive-tip {
  /* Below the radio widget, which shares the top edge on a phone. */
  margin-top: 26px;
  color: #ffd23f;
  max-width: 34ch;
}
.landing .invasive-pause {
  pointer-events: auto;
  margin-left: 12px;
  padding: 2px 8px;
}

/* The title: pink on a hard gold shadow, over the live sky. */
.landing .invasive-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 0 12px;
}
.landing .invasive-start p {
  margin: 0;
  text-shadow: 2px 2px 0 #0b0616;
}
.landing .invasive-over {
  color: #2ff3ff;
  letter-spacing: 0.2em;
}
.landing .invasive-logo {
  color: #ff2fa0;
  text-shadow: 3px 3px 0 #ffd23f, 6px 6px 0 #0b0616;
  margin: 0;
}
.landing .invasive-line {
  color: #fff4ff;
}
.landing .invasive-dark {
  color: #8f86b8;
  text-shadow: 4px 4px 0 #0b0616;
  font-size: 32px;
}
@media (min-width: 800px) {
  .landing .invasive-dark { font-size: 48px; }
}

/* The pause card: a dialog box over the frozen sky. */
.landing .invasive-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  text-align: center;
  pointer-events: auto;
}
.landing .invasive-paused {
  color: #2ff3ff;
  text-shadow: 3px 3px 0 #ff2fa0;
  margin: 0;
}
.landing .invasive-btn {
  min-width: 10em;
}
</style>
