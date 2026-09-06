<template>
  <!-- Owns the page: profile stack beside the Tetris arcade cabinet.
    Desktop (≥900px): two columns. Mobile: compact header above the board,
    removed instantly while a run is active. -->
  <div class="tetris-landing" :class="{ 'tetris-run': running }">
    <Horizon ref="horizon" />
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
    <Arcade @state="onState" @beat="horizon?.beat($event)" />
  </div>
</template>

<script setup lang="ts">
import ProfileCard from '~/themes/base/ProfileCard.vue'
import SocialLink from '~/themes/base/SocialLink.vue'
import Arcade from './Arcade.vue'
import Horizon from './Horizon.vue'
const horizon = ref<InstanceType<typeof Horizon> | null>(null)
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
.tetris-landing { position: relative; isolation: isolate; height: 100dvh; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(54px, calc(42px + env(safe-area-inset-bottom))) max(16px, env(safe-area-inset-left)); }
.tetris-profile { text-align: center; max-width: 360px; flex: 0 0 auto; }
.tetris-name { font: 700 clamp(36px, 4vw, 56px)/1.05 system-ui, sans-serif; color: var(--tetris-text); letter-spacing: -.04em; margin: 20px 0 16px; text-transform: lowercase; }
.tetris-blurb { font: 16px/1.5 system-ui, sans-serif; margin: 2px 0; }
.tetris-location { color: var(--tetris-text-muted); font-size: 12px; margin: 12px 0; }
.tetris-readout { color: var(--tetris-accent); font: 11px 'Courier New', monospace; font-variant-numeric: tabular-nums; }
@media (min-width: 900px) { .tetris-landing { flex-direction: row; justify-content: center; gap: clamp(32px, 6vw, 96px); padding-top: 24px; } .tetris-profile { padding: 24px; border: 1px solid var(--tetris-card-border); border-radius: 12px; background: var(--tetris-card-bg); box-shadow: 0 0 24px var(--tetris-card-shadow); } }
@media (max-width: 899px) { .tetris-profile { display: grid; grid-template-columns: 44px auto; column-gap: 12px; align-items: center; text-align: left; } .tetris-profile :deep(.flip-container), .tetris-profile :deep(.profile-pic) { width: 44px; height: 44px; } .tetris-profile :deep(.flip-container) { grid-row: span 2; } .tetris-profile :deep(.profile-pic) { border-width: 1px; } .tetris-name { font-size: 23px; margin: 0; } .tetris-blurb, .tetris-location { display: none; } .tetris-socials :deep(svg), .tetris-socials :deep(img) { width: 22px; height: 22px; } .tetris-run .tetris-profile { display: none; } }
@media (max-height: 480px) { .tetris-profile { display: none; } .tetris-landing { padding-top: 6px; gap: 4px; } }
</style>
