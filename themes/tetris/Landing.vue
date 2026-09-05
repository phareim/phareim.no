<template>
  <!-- Owns the page: profile stack beside the Tetris arcade cabinet.
    Desktop (≥900px): two columns. Mobile: compact header above the board,
    removed instantly while a run is active. -->
  <div class="tetris-landing" :class="{ 'tetris-run': running }">
    <div class="tetris-profile">
      <ProfileCard :flipped="false" />
      <h1 class="tetris-name">{{ profile.name }}</h1>
      <p v-for="line in profile.blurbs" :key="line" class="tetris-blurb">{{ line }}</p>
      <p v-if="idle" class="tetris-location">{{ profile.location }}</p>
      <p v-else class="tetris-location tetris-readout">SCORE {{ scoreText }} · LINES {{ linesText }} · LV {{ tetrisState.level }}</p>
      <div class="social-links tetris-socials">
        <SocialLink
          v-for="s in profile.socials"
          :key="s.type"
          :href="s.href"
          :type="s.type"
          :css-class="s.cssClass ?? ''"
        />
      </div>
    </div>
    <Arcade @state="onState" />
  </div>
</template>

<script setup lang="ts">
import ProfileCard from '~/themes/base/ProfileCard.vue'
import SocialLink from '~/themes/base/SocialLink.vue'
import Arcade from './Arcade.vue'
import type { TetrisState } from './Game.vue'
import { profile } from '~/themes/content'

const tetrisState = ref<TetrisState>({
  phase: 'idle',
  score: 0,
  lines: 0,
  level: 1,
  best: 0,
  next: null,
  hold: null,
  canHold: true,
  newBest: false,
  levelUpUntil: 0,
})

const idle = computed(() => tetrisState.value.phase === 'idle')
const running = computed(() => tetrisState.value.phase === 'playing' || tetrisState.value.phase === 'paused')
const scoreText = computed(() => String(tetrisState.value.score).padStart(6, '0'))
const linesText = computed(() => String(tetrisState.value.lines).padStart(2, '0'))

function onState(s: TetrisState) {
  tetrisState.value = s
}

// The game itself owns navigationLocked while a run is active; reset here too
// so a mid-run theme switch never leaves the shell locked.
const { navigationLocked } = useTheme()
onBeforeUnmount(() => { navigationLocked.value = false })
</script>

<style scoped>
.tetris-landing {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 900px) {
  .tetris-landing {
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 48px;
    padding: 24px;
  }
}

.tetris-profile {
  text-align: center;
  max-width: 360px;
  flex: 0 0 auto;
}

.tetris-name {
  font-family: 'Press Start 2P', 'Courier New', monospace;
  font-size: clamp(1.3rem, 3.6vw, 2.1rem);
  line-height: 1.4;
  letter-spacing: 0.02em;
  font-weight: 400;
  color: var(--theme-text, #f4f1ff);
  text-shadow: 3px 3px 0 var(--theme-card-border, #3b3470);
  margin: 8px 0 4px;
}

.tetris-blurb {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 1em;
  line-height: 1.5;
  color: var(--theme-text, #f4f1ff);
  margin: 2px 0;
}
@media (min-width: 800px) {
  .tetris-blurb {
    font-size: 1.2em;
  }
}

.tetris-location {
  font-size: 0.7em;
  color: var(--theme-text-muted, #b4add9);
  margin: 4px 0 8px;
}

.tetris-readout {
  font-family: 'Press Start 2P', 'Courier New', monospace;
  font-size: 11px;
  color: var(--theme-accent, #ffd500);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

.tetris-socials {
  text-align: center;
}

@media (max-width: 899px) {
  .tetris-profile :deep(.flip-container) {
    width: 64px;
    height: 64px;
  }
  .tetris-profile :deep(.profile-pic) {
    width: 64px;
    height: 64px;
    border-width: 3px;
  }
  .tetris-name {
    font-size: 1rem;
    margin: 4px 0 2px;
  }
  .tetris-profile .tetris-blurb {
    display: none;
  }
  .tetris-location {
    margin: 2px 0 4px;
  }
  .tetris-socials :deep(svg),
  .tetris-socials :deep(img) {
    width: 32px;
    height: 32px;
  }
  /* The compact header is removed instantly while a run is active. */
  .tetris-run .tetris-profile {
    display: none;
  }
}
</style>
