<template>
  <!-- The Hangar: who you are, your bests, and the ship you fly in every
       ship game. Left/right still walks the themes, so ship browsing is
       buttons only — nothing here locks the shell's navigation. -->
  <div class="hg-landing">
    <Horizon />

    <p class="hg-hud hg-hud--left">HANGAR</p>
    <p class="hg-hud hg-hud--right">PHAREIM.NO</p>

    <section class="hg-panel" aria-live="polite">
      <span class="hg-tick hg-tick--tl" aria-hidden="true" />
      <span class="hg-tick hg-tick--tr" aria-hidden="true" />
      <span class="hg-tick hg-tick--bl" aria-hidden="true" />
      <span class="hg-tick hg-tick--br" aria-hidden="true" />

      <!-- Two frames on wide screens (pilot/scores · ship); one flow
           everywhere else — the cols dissolve via display:contents. -->
      <div class="hg-cols">
        <div class="hg-col hg-col--id">
          <p class="hg-over">PILOT PROFILE</p>
          <div class="hg-who">
            <span class="hg-avatar" :class="{ 'hg-avatar--pending': player && !pic }" aria-hidden="true">
              <img v-if="pic" :src="pic" alt="" decoding="async">
            </span>
            <span class="hg-name">{{ player ? player.name.toUpperCase() : '· · ·' }}</span>
          </div>

          <p class="hg-label">HIGH SCORES</p>
          <ol v-if="status === 'ready'" class="hg-scores">
            <li v-for="g in GAMES" :key="g.id" class="hg-score">
              <span class="hg-score-game">{{ g.title.toUpperCase() }}</span>
              <span v-if="bests[g.id]" class="hg-score-line">BEST {{ fmt(bests[g.id]!.score) }} · #{{ bests[g.id]!.rank }}</span>
              <span v-else class="hg-score-line hg-score-line--none">NO RUN YET</span>
            </li>
          </ol>
          <p v-else-if="status === 'loading'" class="hg-empty">SYNCING…</p>
          <p v-else class="hg-empty">OFFLINE<br><span>THE HANGAR DID NOT ANSWER</span></p>
        </div>

        <div class="hg-col hg-col--ship">
          <p class="hg-label">YOUR SHIP</p>
          <div class="hg-viewer-box">
            <ShipViewer :ship-id="preview.id" />
          </div>
          <div class="hg-ship-row">
            <button class="hg-step" aria-label="Previous ship" @click="stepShip(-1)">◀</button>
            <Transition name="hg-fade" mode="out-in">
              <div :key="preview.id" class="hg-ship-name">
                <strong>{{ preview.name.toUpperCase() }}</strong>
                <span>{{ preview.tagline.toUpperCase() }}</span>
              </div>
            </Transition>
            <button class="hg-step" aria-label="Next ship" @click="stepShip(1)">▶</button>
          </div>
          <div class="hg-ship-cta">
            <button
              v-if="previewState?.unlocked && preview.id !== selected"
              class="hg-fly"
              @click="fly"
            >FLY THIS SHIP</button>
            <p v-else-if="preview.id === selected" class="hg-flying">◈ FLYING THIS SHIP</p>
            <p v-else class="hg-locked">LOCKED · SCORE IN {{ remaining }} MORE {{ remaining === 1 ? 'GAME' : 'GAMES' }} ({{ distinctGames }}/4)</p>
          </div>
        </div>
      </div>

      <p class="hg-nudge">{{ nudge }}</p>
    </section>

    <p class="hg-hint">{{ hint('← → THE ARCADE', 'SWIPE ↔ ARCADE') }}</p>
  </div>
</template>

<script setup lang="ts">
import Horizon from './Horizon.vue'
import { GAMES } from '~/themes/leaderboard/games'
import { SHIPS, unlockProgress } from '~/themes/ships/ships'

const ShipViewer = defineAsyncComponent(() => import('./ShipViewer.vue'))

const { hint } = useInputMode()
const { player, avatar, fetchBoards } = useLeaderboard()
const { selected, ships, bests, distinctGames, avatarFull, loadProfile, selectShip } = useShip()

/** The portrait: the full painting once the profile answers, thumbnail meanwhile. */
const pic = computed(() => avatarFull.value ?? avatar.value)

const status = ref<'loading' | 'ready' | 'error'>('loading')
const previewIndex = ref(0)
const notice = ref('')

const preview = computed(() => SHIPS[previewIndex.value] ?? SHIPS[0])
const previewState = computed(() => ships.value.find(s => s.id === preview.value.id) ?? null)
const remaining = computed(() => unlockProgress(distinctGames.value).remaining)

const nudge = computed(() => {
  if (notice.value) return notice.value
  if (status.value !== 'ready') return '· · ·'
  if (remaining.value > 0) return `FLOWN IN ${distinctGames.value}/6 GAMES · ${remaining.value} MORE TO UNLOCK THE VANDAL`
  return `FLOWN IN ${distinctGames.value}/6 GAMES · BOTH SHIPS UNLOCKED`
})

function fmt(score: number): string {
  return String(score).padStart(6, '0')
}

function stepShip(delta: number): void {
  previewIndex.value = (previewIndex.value + delta + SHIPS.length) % SHIPS.length
}

async function fly(): Promise<void> {
  const ok = await selectShip(preview.value.id)
  notice.value = ok ? `${preview.value.name.toUpperCase()} READY ON ALL FLIGHT LINES` : 'THE HANGAR DID NOT ANSWER'
  if (ok) setTimeout(() => { notice.value = '' }, 4000)
}

onMounted(async () => {
  try {
    await fetchBoards().catch(() => null)
  } catch {
    // avatar sync is a bonus; the profile carries the scores
  }
  const profile = await loadProfile()
  if (profile) {
    const i = SHIPS.findIndex(s => s.id === profile.selected)
    if (i >= 0) previewIndex.value = i
    status.value = 'ready'
  } else {
    status.value = 'error'
  }
})
</script>

<style scoped>
.hg-landing {
  position: relative;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  touch-action: none;
  display: grid;
  place-items: center;
  padding: 12px;
  box-sizing: border-box;
}

.hg-hud,
.hg-over,
.hg-label,
.hg-who,
.hg-scores,
.hg-empty,
.hg-ship-name,
.hg-ship-cta,
.hg-nudge,
.hg-step,
.hg-fly,
.hg-hint {
  font-family: var(--font-machine);
  text-transform: uppercase;
  letter-spacing: .15em;
}

.hg-hud {
  position: absolute;
  z-index: 2;
  top: 16px;
  margin: 0;
  font-size: 10.4px;
  color: var(--hg-text-subtle);
}

.hg-hud--left { left: 18px; }
.hg-hud--right { right: 18px; }

.hg-panel {
  position: relative;
  z-index: 2;
  width: min(480px, 100%);
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 18px 22px 14px;
  box-sizing: border-box;
  background: var(--hg-card-bg);
  border: 1px solid rgba(47, 243, 255, .28);
  border-radius: 4px;
  box-shadow: 0 0 24px var(--hg-card-shadow);
}

.hg-tick {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 0 solid var(--hg-accent);
  opacity: .8;
}

.hg-tick--tl { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; }
.hg-tick--tr { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; }
.hg-tick--bl { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; }
.hg-tick--br { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; }

/* Narrow: the two frames dissolve — everything flows in the one panel. */
.hg-cols,
.hg-col { display: contents; }

.hg-over {
  margin: 0;
  text-align: center;
  font-size: 10.4px;
  color: var(--hg-text-subtle);
}

.hg-who {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 8px 0 4px;
}

.hg-avatar {
  display: inline-block;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(255, 47, 160, .7);
  box-shadow: 0 0 10px rgba(255, 47, 160, .45);
  background: rgba(255, 47, 160, .06);
  overflow: hidden;
}

.hg-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hg-avatar--pending { animation: hg-breathe 2.4s ease-in-out infinite; }

@keyframes hg-breathe {
  0%, 100% { box-shadow: 0 0 4px rgba(255, 47, 160, .2); }
  50% { box-shadow: 0 0 12px rgba(255, 47, 160, .6); }
}

@media (prefers-reduced-motion: reduce) {
  .hg-avatar--pending { animation: none; }
}

.hg-name {
  font-size: 17px;
  color: var(--hg-pink);
  text-shadow: 0 0 8px rgba(255, 47, 160, .6);
}

.hg-label {
  margin: 10px 0 4px;
  font-size: 10.4px;
  color: var(--hg-text-subtle);
  border-top: 1px solid rgba(255, 47, 160, .25);
  padding-top: 10px;
}

.hg-scores {
  list-style: none;
  margin: 0;
  padding: 0;
}

.hg-score {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  min-height: 22px;
  font-size: 11.2px;
  white-space: nowrap;
}

.hg-score-game { color: var(--hg-text); }
.hg-score-line {
  color: var(--hg-accent);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 8px rgba(47, 243, 255, .45);
}
.hg-score-line--none { color: var(--hg-text-subtle); text-shadow: none; }

.hg-empty {
  margin: 0;
  min-height: 60px;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 12px;
  line-height: 1.8;
  color: var(--hg-text-muted);
}

.hg-empty span {
  font-size: 10.4px;
  color: var(--hg-text-subtle);
}

.hg-viewer-box {
  height: 190px;
  border: 1px solid rgba(47, 243, 255, .18);
  border-radius: 3px;
  background: radial-gradient(ellipse at 50% 65%, rgba(47, 243, 255, .07), transparent 70%);
  overflow: hidden;
}

.hg-ship-row {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  margin-top: 6px;
}

.hg-ship-name {
  text-align: center;
  display: grid;
  gap: 2px;
}

.hg-ship-name strong {
  font-size: 14px;
  font-weight: 400;
  color: var(--hg-accent);
  text-shadow: 0 0 8px rgba(47, 243, 255, .65);
}

.hg-ship-name span {
  font-size: 9.6px;
  color: var(--hg-text-subtle);
}

.hg-step {
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--hg-pink);
  font-size: 12px;
  cursor: pointer;
  text-shadow: 0 0 10px rgba(255, 47, 160, .6);
  -webkit-tap-highlight-color: transparent;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.hg-step:hover,
.hg-step:focus-visible {
  border-color: rgba(255, 47, 160, .4);
  background: rgba(255, 47, 160, .1);
  outline: none;
}

.hg-ship-cta {
  display: grid;
  place-items: center;
  min-height: 30px;
  margin-top: 2px;
}

.hg-fly {
  font-family: var(--font-machine);
  font-size: 11.2px;
  letter-spacing: .15em;
  color: var(--hg-gold);
  background: rgba(255, 210, 63, .08);
  border: 1px solid rgba(255, 210, 63, .5);
  border-radius: 3px;
  padding: 7px 18px;
  cursor: pointer;
  text-shadow: 0 0 8px rgba(255, 210, 63, .6);
  -webkit-tap-highlight-color: transparent;
}

.hg-fly:hover,
.hg-fly:focus-visible {
  background: rgba(255, 210, 63, .16);
  outline: none;
}

.hg-flying {
  margin: 0;
  font-size: 11.2px;
  color: var(--hg-accent);
  text-shadow: 0 0 8px rgba(47, 243, 255, .6);
}

.hg-locked {
  margin: 0;
  font-size: 10.4px;
  text-align: center;
  line-height: 1.5;
  color: var(--hg-text-subtle);
}

.hg-nudge {
  margin: 8px 0 0;
  text-align: center;
  font-size: 9.6px;
  line-height: 1.4;
  color: var(--hg-text-subtle);
  letter-spacing: .12em;
}

.hg-hint {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 42px;
  margin: 0;
  text-align: center;
  font-size: 11.2px;
  letter-spacing: .12em;
  color: var(--hg-text-subtle);
  text-shadow: 0 0 10px rgba(255, 47, 160, .6);
}

.hg-fade-enter-active,
.hg-fade-leave-active { transition: opacity 180ms ease; }
.hg-fade-enter-from,
.hg-fade-leave-to { opacity: 0; }

@media (min-width: 900px) and (min-height: 620px) {
  .hg-landing {
    justify-items: start;
    padding-left: clamp(48px, 10vw, 160px);
  }
}

/* Wide: the panel spreads into two frames — pilot + scores left, the
   ship in a larger bay right, portrait at full-painting size. */
@media (min-width: 1024px) and (min-height: 700px) {
  .hg-panel { width: min(920px, 100%); }
  .hg-cols {
    display: grid;
    grid-template-columns: 330px 1fr;
    gap: 16px;
    align-items: stretch;
  }
  .hg-col {
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(47, 243, 255, .16);
    border-radius: 3px;
    background: rgba(11, 6, 22, .45);
    padding: 16px 18px 14px;
    box-sizing: border-box;
    min-width: 0;
  }
  .hg-label {
    border-top: none;
    padding-top: 0;
  }
  .hg-label:first-child { margin-top: 0; }
  .hg-who {
    justify-content: flex-start;
    margin: 12px 0 6px;
  }
  .hg-avatar {
    width: 88px;
    height: 88px;
    border-width: 2px;
  }
  .hg-name { font-size: 22px; }
  .hg-score {
    min-height: 27px;
    font-size: 12px;
  }
  .hg-viewer-box { height: 330px; }
  .hg-ship-name strong { font-size: 16px; }
}

@media (max-width: 640px), (max-height: 700px) {
  .hg-landing { padding: 10px 46px 48px; }
  .hg-panel { padding: 12px 14px 10px; }
  .hg-viewer-box { height: 150px; }
  .hg-hint { display: none; }
}

@media (max-height: 560px) {
  .hg-hud { display: none; }
  .hg-landing { padding: 8px 46px 26px; }
  .hg-panel { width: min(560px, 100%); }
  .hg-over { display: none; }
  .hg-viewer-box { height: 110px; }
  .hg-score { min-height: 19px; font-size: 10.4px; }
  .hg-nudge { display: none; }
}
</style>
