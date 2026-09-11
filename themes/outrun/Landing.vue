<template>
  <DefaultLanding>
    <template #background>
      <OutRun @phase="onPhase" @over="onOver" />
    </template>

    <template #body>
      <div v-if="phase === 'attract'" class="outrun-title-block">
        <h1 class="outrun-logo">OUTRUN</h1>
        <p class="outrun-hud outrun-tag">FIVE STAGES · FIFTEEN ROADS · ONE CLOCK</p>
        <div class="outrun-plate">
          <p class="outrun-hint">▶ {{ hint('PRESS ENTER TO DRIVE', 'TAP TO DRIVE') }} ◀</p>
          <p class="outrun-hint outrun-hint-dim">{{ hint('↑ GAS · ↓ BRAKE · ← → STEER · M RADIO', 'DRAG TO STEER · 2ND FINGER BRAKES') }}</p>
          <p v-if="highScore > 0" class="outrun-hud outrun-dim">HIGH SCORE: {{ highScore }}</p>
        </div>
      </div>
      <div v-else-if="phase === 'over' && result" class="outrun-over">
        <h1 class="outrun-over-title">{{ title }}</h1>
        <p class="outrun-hud">SCORE: {{ result.score }}</p>
        <p class="outrun-hud outrun-route">{{ result.route.join(' · ') }}</p>
        <p v-if="isNewHigh" class="outrun-hud outrun-new-high">NEW HIGH SCORE!</p>
        <p v-else class="outrun-hud outrun-dim">HIGH SCORE: {{ highScore }}</p>
        <p v-if="rank" class="outrun-hud outrun-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="outrun-hint">▶ {{ hint('PRESS ENTER TO DRIVE AGAIN', 'TAP TO DRIVE AGAIN') }} ◀</p>
      </div>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import OutRun from './OutRun.vue'
import type { OutrunResult } from './engine'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
const { hint } = useInputMode()

const phase = ref<'attract' | 'radio' | 'play' | 'over'>('attract')
const result = ref<OutrunResult | null>(null)
const highScore = ref(0)
const isNewHigh = ref(false)

/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'outrun' && result.value && lastSubmission.value.score === result.value.score ? lastSubmission.value : null)

const title = computed(() => {
  if (!result.value) return ''
  if (result.value.reason === 'goal') return 'GOAL'
  if (result.value.reason === 'timeup') return 'TIME UP'
  return 'GAME OVER'
})

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('outrunHighScore') || '0', 10) || 0
})

// The game owns the arrows while the radio screen or a run is up.
onBeforeUnmount(() => { navigationLocked.value = false })

function onPhase(p: typeof phase.value) {
  phase.value = p
  navigationLocked.value = p === 'radio' || p === 'play'
  if (p !== 'over') isNewHigh.value = false
}

function onOver(r: OutrunResult) {
  result.value = r
  if (r.score > 0) submitScore('outrun', r.score)
  isNewHigh.value = r.score > highScore.value && r.score > 0
  if (isNewHigh.value) {
    highScore.value = r.score
    localStorage.setItem('outrunHighScore', String(r.score))
  }
}
</script>

<style>
.outrun-title-block,
.outrun-over {
  pointer-events: none;
  padding: 0 16px;
}

/* The logo sits in the sky, over the sun, like the cabinet's title screen;
   the call to action gets a glass plate so the road does not eat it. */
.outrun-title-block {
  position: absolute;
  left: 0;
  right: 0;
  top: 9vh;
}
.outrun-plate {
  display: inline-block;
  margin-top: 1.2em;
  padding: 0.6em 1.2em 0.7em;
  background: rgba(11, 6, 22, 0.62);
  border: 1px solid rgba(255, 47, 160, 0.35);
  border-radius: 4px;
}
.outrun-plate .outrun-hint {
  margin-top: 0;
}
.outrun-over {
  background: rgba(11, 6, 22, 0.66);
  border: 1px solid rgba(255, 47, 160, 0.35);
  border-radius: 12px;
  box-shadow: 0 0 24px rgba(47, 243, 255, 0.15);
  padding: 1.2em 1.6em 1.4em;
  max-width: min(92vw, 560px);
}

.outrun-logo {
  font-family: var(--font-machine);
  font-weight: 700;
  font-style: italic;
  letter-spacing: 0.08em;
  color: #ff2fa0;
  text-shadow: 0 0 2px #0b0616, 0 0 12px rgba(255, 47, 160, 0.8), 0 0 40px rgba(255, 47, 160, 0.4);
  -webkit-text-stroke: 1.5px #0b0616;
  font-size: clamp(2.8em, 14vw, 6em) !important;
  margin: 0 0 0.1em;
  transform: skewX(-8deg);
}

.outrun-hud {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
  letter-spacing: 0.15em;
  font-size: 1em;
  margin: 0.3em 0;
}

.outrun-tag {
  font-size: 0.7em !important;
  opacity: 0.8;
}

.outrun-dim {
  opacity: 0.55;
  font-size: 0.7em !important;
}

.outrun-route {
  font-size: 0.65em !important;
  opacity: 0.85;
  letter-spacing: 0.1em;
  line-height: 1.6;
}

.outrun-over-title {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  text-shadow: 0 0 12px rgba(255, 47, 160, 0.8), 0 0 40px rgba(255, 47, 160, 0.4);
  font-size: 2.8em !important;
  letter-spacing: 0.1em;
  margin: 0 0 0.2em;
}
@media (min-width: 800px) {
  .outrun-over-title {
    font-size: 3.2em !important;
  }
}

.outrun-new-high {
  color: #ffd23f;
  text-shadow: 0 0 10px rgba(255, 210, 63, 0.7);
  animation: outrun-pulse 0.8s ease-in-out infinite alternate;
}
@keyframes outrun-pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

.outrun-hint {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.6);
  font-size: 0.9em;
  letter-spacing: 0.12em;
  margin-top: 1.2em;
  animation: outrun-blink 1.6s ease-in-out infinite alternate;
}

.outrun-hint-dim {
  opacity: 0.45;
  font-size: 0.7em;
  margin-top: 0.3em;
  animation: none;
}

@keyframes outrun-blink {
  from { opacity: 0.55; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .outrun-new-high,
  .outrun-hint {
    animation: none;
  }
}
</style>
