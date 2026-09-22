<template>
  <DefaultLanding>
    <template #background>
      <Zelda @phase="onPhase" @result="onResult" />
    </template>

    <template #body>
      <div v-if="phase === 'attract'" class="zelda-title">
        <div class="zelda-sun" aria-hidden="true" />
        <p class="zelda-kicker">A NEON COAST ADVENTURE</p>
        <h1 class="zelda-logo"><span class="zelda-logo-neon">NEON</span><span class="zelda-logo-shrine">SHRINE</span></h1>
        <p class="zelda-tagline">THE SUN WON'T SET. GO GET IT BACK.</p>
        <p class="zelda-start">{{ hasSave ? hint('PRESS ENTER TO CONTINUE', 'TAP TO CONTINUE') : hint('PRESS ENTER TO BEGIN', 'TAP TO BEGIN') }}</p>
        <p class="zelda-keys">{{ hint('ARROWS MOVE · SPACE SWORD / TALK · K ITEM · Q SWAP · P PAUSE', 'DRAG TO MOVE · A SWORD / TALK · B ITEM') }}</p>
        <div v-if="hasSave" class="zelda-row">
          <button class="zelda-btn" @click.stop="newGame">NEW GAME</button>
          <span v-if="inputMode === 'keyboard'" class="zelda-keys">OR PRESS N</span>
        </div>
        <p v-if="bestTime !== null" class="zelda-best">BEST TIME {{ formatTime(bestTime) }}</p>
      </div>

      <div v-else-if="phase === 'over'" class="zelda-panel">
        <h1 class="zelda-panel-title">RESTING</h1>
        <p class="zelda-keys">PROGRESS SAVED · {{ formatTime(result?.elapsed ?? 0) }} PLAYED</p>
        <p class="zelda-start">{{ hint('PRESS ENTER TO CONTINUE', 'TAP TO CONTINUE') }}</p>
      </div>

      <div v-else-if="phase === 'won'" class="zelda-panel zelda-panel--won">
        <div class="zelda-sun zelda-sun--small" aria-hidden="true" />
        <h1 class="zelda-panel-title">THE SUN SETS AT LAST</h1>
        <p class="zelda-time">{{ formatTime(result?.elapsed ?? 0) }}</p>
        <p v-if="isNewBest" class="zelda-best">NEW BEST!</p>
        <p class="zelda-start">{{ hint('PRESS ENTER FOR A NEW QUEST', 'TAP FOR A NEW QUEST') }}</p>
      </div>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Zelda from './Zelda.vue'
import { SAVE_KEY, BEST_KEY } from './types'

const { navigationLocked } = useTheme()
const { hint, inputMode } = useInputMode()

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

function refresh() {
  try {
    hasSave.value = !!localStorage.getItem(SAVE_KEY)
    const best = parseFloat(localStorage.getItem(BEST_KEY) || '')
    bestTime.value = Number.isFinite(best) && best > 0 ? best : null
  } catch { /* private mode */ }
}

function newGame() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
  hasSave.value = false
}

onMounted(refresh)

onBeforeUnmount(() => {
  navigationLocked.value = false
})

function onPhase(p: typeof phase.value) {
  phase.value = p
  navigationLocked.value = p === 'play'
  if (p !== 'play') refresh()
}

function onResult(r: { reason: 'quit' | 'won'; elapsed: number; best: number | null }) {
  result.value = r
  isNewBest.value = r.reason === 'won' && r.best !== null && r.best === r.elapsed
  phase.value = r.reason === 'won' ? 'won' : 'over'
}
</script>

<style>
.zelda-title,
.zelda-panel {
  position: relative;
  pointer-events: none;
  padding: 0 22px;
  font-family: var(--font-machine);
  text-transform: uppercase;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.zelda-title {
  transform: translateY(-4vh);
}

/* A dark pool behind the title so it reads over the drifting world. */
.zelda-title::before {
  content: '';
  position: absolute;
  inset: -18% -30%;
  background: radial-gradient(closest-side, rgba(11, 6, 22, 0.82), rgba(11, 6, 22, 0.55) 60%, rgba(11, 6, 22, 0));
  z-index: -2;
}

@media (max-width: 480px) {
  .zelda-kicker { letter-spacing: 0.2em; font-size: 10px; }
  .zelda-tagline { letter-spacing: 0.14em; font-size: 11px; }
  .zelda-start { font-size: 14px; letter-spacing: 0.16em; }
}

/* The striped synthwave sun behind the logo. */
.zelda-sun {
  position: absolute;
  left: 50%;
  top: -0.6em;
  width: min(62vw, 300px);
  aspect-ratio: 2 / 1;
  transform: translateX(-50%);
  border-radius: 300px 300px 0 0;
  background:
    repeating-linear-gradient(180deg, transparent 0 58%, #0b0616 58% 61%, transparent 61% 67%, #0b0616 67% 71%, transparent 71% 77%, #0b0616 77% 82%, transparent 82% 88%, #0b0616 88% 94%),
    linear-gradient(180deg, #ffd23f 0%, #ff8a3d 45%, #ff2fa0 80%, #b01874 100%);
  opacity: 0.85;
  filter: drop-shadow(0 0 28px rgba(255, 47, 160, 0.55));
  z-index: -1;
}

.zelda-sun--small {
  position: relative;
  top: 0;
  left: 0;
  transform: none;
  width: 120px;
  margin: 0 auto 0.6em;
}

.zelda-kicker {
  margin: 0 0 0.2em;
  font-size: 11px;
  letter-spacing: 0.34em;
  color: #2ff3ff;
  text-shadow: 0 0 10px rgba(47, 243, 255, 0.7);
}

.zelda-logo {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.92;
  font-weight: 700;
}

.zelda-logo-neon {
  font-family: var(--font-person);
  font-weight: 500;
  font-style: italic;
  font-size: clamp(30px, 8vw, 54px);
  letter-spacing: 0.08em;
  color: #fff4ff;
  text-shadow: 0 0 6px #ff2fa0, 0 0 18px #ff2fa0, 0 0 42px rgba(255, 47, 160, 0.8);
  transform: rotate(-4deg) translateY(0.12em);
}

.zelda-logo-shrine {
  font-size: clamp(46px, 15vw, 104px);
  letter-spacing: 0.06em;
  background: linear-gradient(180deg, #ffffff 0%, #cfe9ff 38%, #2ff3ff 50%, #7b3fe4 51%, #ff2fa0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.35);
  filter: drop-shadow(0 3px 0 #0b0616) drop-shadow(0 0 16px rgba(47, 243, 255, 0.45));
}

.zelda-tagline {
  margin: 0.8em 0 1.4em;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: #ffd23f;
  text-shadow: 0 0 10px rgba(255, 210, 63, 0.6);
}

.zelda-start {
  margin: 0.3em 0;
  font-size: 15px;
  letter-spacing: 0.2em;
  color: #ff2fa0;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.75);
  animation: zelda-blink 1.4s ease-in-out infinite alternate;
}

.zelda-keys {
  margin: 0.5em 0 0;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: rgba(232, 246, 255, 0.55);
  max-width: 32em;
  line-height: 1.7;
}

.zelda-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 1em;
  pointer-events: auto;
}

.zelda-btn {
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.14em;
  padding: 0.7em 1.2em;
  min-height: 44px;
  background: rgba(11, 6, 22, 0.7);
  border: 1px solid rgba(47, 243, 255, 0.6);
  border-radius: 6px;
  color: #2ff3ff;
  cursor: pointer;
}

.zelda-btn:hover {
  box-shadow: 0 0 14px rgba(47, 243, 255, 0.45);
}

.zelda-best {
  margin: 1em 0 0;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: #ffd23f;
  text-shadow: 0 0 10px rgba(255, 210, 63, 0.6);
}

.zelda-panel {
  background: rgba(11, 6, 22, 0.72);
  border: 1px solid rgba(255, 47, 160, 0.45);
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(255, 47, 160, 0.2);
  padding: 1.4em 1.8em 1.5em;
  max-width: min(90vw, 560px);
}

.zelda-panel-title {
  margin: 0 0 0.3em;
  font-size: clamp(24px, 7vw, 44px);
  letter-spacing: 0.1em;
  color: #ff2fa0;
  text-shadow: 0 0 12px rgba(255, 47, 160, 0.8), 0 0 40px rgba(255, 47, 160, 0.35);
}

.zelda-panel--won .zelda-panel-title {
  color: #ffd23f;
  text-shadow: 0 0 12px rgba(255, 210, 63, 0.8), 0 0 40px rgba(255, 138, 61, 0.4);
}

.zelda-time {
  margin: 0.2em 0 0.6em;
  font-size: 26px;
  letter-spacing: 0.12em;
  color: #2ff3ff;
  text-shadow: 0 0 10px rgba(47, 243, 255, 0.7);
}

@media (max-height: 480px) {
  .zelda-title { transform: none; }
  .zelda-logo-neon { font-size: 24px; }
  .zelda-logo-shrine { font-size: 44px; }
  .zelda-tagline { margin: 0.4em 0 0.6em; }
  .zelda-keys { display: none; }
  .zelda-sun { width: 180px; }
}

@keyframes zelda-blink {
  from { opacity: 0.5; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .zelda-start { animation: none; }
}
</style>
