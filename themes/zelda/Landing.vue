<template>
  <DefaultLanding>
    <template #background>
      <Zelda @phase="onPhase" @result="onResult" />
    </template>

    <template #body>
      <div v-if="phase === 'attract'" class="zelda-title-block">
        <h1 class="zelda-logo">NEON SHRINE</h1>
        <p class="zelda-tag">THREE SHORES · ONE SHRINE · FIVE HEARTS</p>
        <div class="zelda-hints">
          <p class="zelda-hint">{{ hint('PRESS ENTER TO WAKE', 'TAP TO WAKE') }}</p>
          <p class="zelda-hint zelda-hint-dim">{{ hint('ARROWS MOVE · SPACE SWORD · E INTERACT', 'LEFT: DRAG TO MOVE · RIGHT: TAP TO SWING') }}</p>
          <div v-if="hasSave" class="zelda-buttons">
            <button class="zelda-btn" @click.stop="newGame">NEW GAME</button>
            <p class="zelda-hint-dim" style="margin-top: 0.5em">or press N</p>
          </div>
          <p v-if="bestTime !== null" class="zelda-best">BEST: {{ formatTime(bestTime) }}</p>
        </div>
      </div>

      <div v-else-if="phase === 'over'" class="zelda-over">
        <h1 class="zelda-over-title">RESTING</h1>
        <p class="zelda-time">{{ formatTime(result?.elapsed ?? 0) }}</p>
        <p class="zelda-hint">{{ hint('PRESS ENTER TO CONTINUE', 'TAP TO CONTINUE') }}</p>
      </div>

      <div v-else-if="phase === 'won'" class="zelda-over zelda-won">
        <h1 class="zelda-over-title">THE SHRINE WAKES</h1>
        <p class="zelda-time">{{ formatTime(result?.elapsed ?? 0) }}</p>
        <p v-if="isNewBest" class="zelda-best">NEW BEST!</p>
        <p class="zelda-hint">{{ hint('PRESS ENTER FOR NEW QUEST', 'TAP FOR NEW QUEST') }}</p>
      </div>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Zelda from './Zelda.vue'

const { navigationLocked } = useTheme()
const { hint } = useInputMode()

const phase = ref<'attract' | 'play' | 'over' | 'won'>('attract')
const result = ref<{ reason: 'quit' | 'won'; elapsed: number; best: number | null } | null>(null)
const hasSave = ref(false)
const bestTime = ref<number | null>(null)
const isNewBest = ref(false)

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function newGame() {
  try {
    localStorage.removeItem('zeldaSave')
  } catch { /* ignore */ }
  hasSave.value = false
}

onMounted(() => {
  try {
    hasSave.value = !!localStorage.getItem('zeldaSave')
    const best = localStorage.getItem('zeldaBest')
    if (best) {
      bestTime.value = parseInt(best, 10)
    }
  } catch { /* ignore */ }
})

onBeforeUnmount(() => {
  navigationLocked.value = false
})

function onPhase(p: typeof phase.value) {
  phase.value = p
  navigationLocked.value = p === 'play'
}

function onResult(r: { reason: 'quit' | 'won'; elapsed: number; best: number | null }) {
  result.value = r
  isNewBest.value = r.reason === 'won' && r.best !== null && r.best === r.elapsed
  
  if (r.reason === 'won') {
    phase.value = 'won'
  } else {
    phase.value = 'over'
  }
}
</script>

<style>
.zelda-logo {
  font-family: var(--font-machine);
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #ff2fa0;
  text-shadow: 0 0 2px #0b0616, 0 0 12px rgba(255, 47, 160, 0.8), 0 0 40px rgba(255, 47, 160, 0.4);
  font-size: clamp(2.2em, 12vw, 5em) !important;
  margin: 0 0 0.2em;
}

.zelda-tag {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65), 0 0 24px rgba(255, 47, 160, 0.35);
  letter-spacing: 0.15em;
  font-size: 0.7em !important;
  opacity: 0.8;
  margin: 0 0 1.2em;
}

.zelda-title-block {
  pointer-events: none;
  padding: 0 16px;
  position: absolute;
  left: 0;
  right: 0;
  top: 10vh;
}

.zelda-hints {
  pointer-events: auto;
  display: inline-block;
  background: rgba(11, 6, 22, 0.62);
  border: 1px solid rgba(255, 47, 160, 0.35);
  border-radius: 4px;
  padding: 0.8em 1.2em;
  margin-top: 0.8em;
}

.zelda-hint {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.6);
  font-size: 0.9em;
  letter-spacing: 0.12em;
  margin: 0.3em 0;
  animation: zelda-blink 1.6s ease-in-out infinite alternate;
}

.zelda-hint-dim {
  opacity: 0.45;
  font-size: 0.7em !important;
  animation: none;
}

.zelda-best {
  color: #ffd23f;
  text-shadow: 0 0 10px rgba(255, 210, 63, 0.7);
  font-size: 0.75em !important;
  opacity: 0.85;
  margin-top: 0.6em;
}

.zelda-buttons {
  margin-top: 0.8em;
  pointer-events: auto;
}

.zelda-btn {
  font-family: var(--font-machine);
  text-transform: uppercase;
  background: rgba(47, 243, 255, 0.1);
  border: 1px solid rgba(47, 243, 255, 0.5);
  color: #2ff3ff;
  padding: 0.5em 1em;
  cursor: pointer;
  font-size: 0.9em;
  letter-spacing: 0.1em;
  transition: all 0.2s;
}

.zelda-btn:hover {
  background: rgba(47, 243, 255, 0.2);
  box-shadow: 0 0 12px rgba(47, 243, 255, 0.4);
}

.zelda-over {
  background: rgba(11, 6, 22, 0.66);
  border: 1px solid rgba(255, 47, 160, 0.35);
  border-radius: 12px;
  box-shadow: 0 0 24px rgba(47, 243, 255, 0.15);
  padding: 1.2em 1.6em 1.4em;
  max-width: min(92vw, 560px);
  pointer-events: none;
}

.zelda-over-title {
  font-family: var(--font-machine);
  text-transform: uppercase;
  color: #ff2fa0;
  text-shadow: 0 0 12px rgba(255, 47, 160, 0.8), 0 0 40px rgba(255, 47, 160, 0.4);
  font-size: 2.8em !important;
  letter-spacing: 0.1em;
  margin: 0 0 0.4em;
}

.zelda-time {
  font-family: var(--font-machine);
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.65);
  font-size: 1.4em !important;
  letter-spacing: 0.1em;
  margin: 0.2em 0 0.8em;
}

.zelda-won .zelda-over-title {
  color: #ffd23f;
  text-shadow: 0 0 12px rgba(255, 210, 63, 0.8), 0 0 40px rgba(255, 210, 63, 0.4);
}

@keyframes zelda-blink {
  from { opacity: 0.55; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .zelda-hint {
    animation: none;
  }
}
</style>
