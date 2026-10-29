<template>
  <DefaultLanding>
    <template #background>
      <Shooter
        ref="shooter"
        @score="(s: number) => score = s"
        @distance="(m: number) => distance = m"
        @lives="(n: number) => lives = n"
        @death="onGameOver"
        @restart="onGameRestart"
        @started="onGameStarted"
        @menu="(m: MenuState | null) => menu = m"
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
      <template v-else-if="menu">
        <div v-if="menu.kind === 'pause'" class="rtype-dim" />
        <div class="rtype-menu" :class="`rtype-menu--${menu.kind}`">
          <template v-if="menu.kind === 'title'">
            <h1 class="px-title rtype-px rtype-logo">G-TYPE</h1>
            <p class="px-hud px-dim">(C) 2Q88, Sleepy Productions</p>
          </template>
          <template v-else-if="menu.kind === 'pause'">
            <h1 class="px-title rtype-px">PAUSED</h1>
            <p class="px-hud">SCORE {{ score }} · DIST {{ distance }}M</p>
          </template>
          <template v-else>
            <h1 class="px-title rtype-px">HOW TO PLAY</h1>
            <div class="px-box rtype-help">
              <p v-for="line in controls" :key="line" class="px-hud">{{ line }}</p>
            </div>
          </template>

          <nav class="rtype-menu-items">
            <button
              v-for="(item, i) in menu.items"
              :key="item.id"
              type="button"
              class="px-btn rtype-menu-item"
              :class="{ 'is-on': i === menu.index }"
              @click="shooter?.choose(item.id)"
            >{{ i === menu.index ? '▶ ' : '  ' }}{{ item.label }}{{ i === menu.index ? ' ◀' : '  ' }}</button>
          </nav>

          <p v-if="menu.kind === 'title'" class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
          <p v-if="menu.kind !== 'help'" class="px-hint px-dim">{{ hint('ARROWS OR W/S PICK · ENTER SELECTS', 'TAP A BUTTON') }}</p>
        </div>
      </template>
      <template v-else-if="gameStarted">
        <p class="px-hud rtype-hud-live">
          SCORE {{ score }} · DIST {{ distance }}M · {{ '▶'.repeat(Math.max(0, lives)) }}
        </p>
        <button type="button" class="px-btn rtype-pause-btn" aria-label="Pause" @click="shooter?.choose('pause')">II</button>
      </template>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import SoundToggle from '~/themes/base/SoundToggle.vue'

/** The game is its own chunk (2026-09-30): the landing is the title screen. */
const Shooter = defineAsyncComponent(() => import('./Shooter.vue'))

/** What Shooter's menus look like: the title, the help card or the pause menu. */
interface MenuState {
  kind: 'title' | 'help' | 'pause'
  items: { id: string; label: string }[]
  index: number
}

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'rtype' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const { hint } = useInputMode()
/** The help card's lines: keyboard or touch, one control per line. */
const controls = computed(() => hint(
  'ARROWS OR WASD MOVE · SPACE FIRE, HOLD FOR THE BEAM · SHIFT FORCE POD · P OR ESC PAUSE',
  'DRAG TO MOVE · AUTO-FIRE · DOUBLE-TAP FORCE POD · II PAUSE',
).split(' · '))

const shooter = ref<{ choose: (id: string) => void } | null>(null)
const menu = ref<MenuState | null>(null)
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
/* Text styles: themes/base/pixel/pixel.css (.px-*); G-Type's call to
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

/* The pause button sits just left of the score line (top centre): the radio
   pill owns the top right corner and the sound toggle the bottom left. On
   phones it shares the score line's row below the power-up list. */
.landing .rtype-pause-btn {
  position: absolute;
  top: 14px;
  right: calc(50% + 150px);
  pointer-events: auto;
  z-index: 2;
}
@media (max-width: 640px) {
  .landing .rtype-pause-btn {
    top: calc(max(0.6rem, env(safe-area-inset-top)) + 64px);
    right: calc(50% + 120px);
  }
}

/* Menus: a column of pixel buttons; the cursor row is gold. */
.landing .rtype-dim {
  position: fixed;
  inset: 0;
  background: rgba(6, 3, 16, 0.6);
  pointer-events: none;
}
.landing .rtype-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}
.landing .rtype-menu-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.landing .rtype-menu-item {
  --px-edge: #ff8a3d;
  --px-u: 2px;
  min-width: 15em;
  font-size: 18px;
  padding: 8px 14px;
  color: #ff8a3d;
  pointer-events: auto;
  white-space: pre;
}
.landing .rtype-menu-item.is-on {
  --px-edge: #ffd23f;
  color: #ffd23f;
}
.landing .rtype-help {
  max-width: 34em;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
