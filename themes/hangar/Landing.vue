<template>
  <!-- The Hangar: who you are, your bests, and the ship you fly in every
       ship game, in Neon Shrine's dialog box over the launch bay. Ship
       browsing is buttons only; nothing here locks the shell's navigation. -->
  <div class="hg-landing">
    <Horizon />

    <p class="hg-hud px-text">HANGAR</p>

    <section class="hg-panel px-box" aria-live="polite">
      <!-- Two columns on wide screens (pilot/scores · ship); one flow
           everywhere else — the cols dissolve via display:contents. -->
      <div class="hg-cols">
        <div class="hg-col hg-col--id">
          <div class="hg-who">
            <span class="hg-avatar" :class="{ 'hg-avatar--pending': player && !pic }" aria-hidden="true">
              <PixelPortrait :src="pic" />
            </span>
            <span class="hg-who-text">
              <span class="hg-label">PILOT</span>
              <span class="hg-name">{{ player ? player.name.toUpperCase() : '· · ·' }}</span>
            </span>
          </div>

          <p class="hg-label hg-label--rule">HIGH SCORES</p>
          <ol v-if="status === 'ready'" class="hg-scores">
            <li v-for="g in GAMES" :key="g.id" class="hg-score">
              <span class="hg-score-game">{{ g.title.toUpperCase() }}</span>
              <span v-if="bests[g.id]" class="hg-score-line">{{ fmt(bests[g.id]!.score) }} #{{ bests[g.id]!.rank }}</span>
              <span v-else class="hg-score-line hg-score-line--none">NO RUN YET</span>
            </li>
            <li v-for="(g, i) in SAVE_GAMES" :key="g.id" class="hg-score" :class="{ 'hg-score--quest': i === 0 }">
              <span class="hg-score-game">{{ g.title.toUpperCase() }}</span>
              <span class="hg-score-line" :class="{ 'hg-score-line--none': !saves[g.id] }">{{ questLine(g.id) }}</span>
            </li>
          </ol>
          <p v-else-if="status === 'loading'" class="hg-empty">SYNCING…</p>
          <p v-else class="hg-empty">OFFLINE<br><span>THE HANGAR DID NOT ANSWER</span></p>
        </div>

        <div class="hg-col hg-col--ship">
          <p class="hg-label hg-label--rule hg-label--ship">YOUR SHIP</p>
          <div class="hg-viewer-box">
            <ShipViewer :ship-id="preview.id" />
          </div>
          <div class="hg-ship-row">
            <button class="hg-step px-btn px-btn--pink" aria-label="Previous ship" @click="stepShip(-1)">◀</button>
            <Transition name="hg-fade" mode="out-in">
              <div :key="preview.id" class="hg-ship-name">
                <strong>{{ preview.name.toUpperCase() }}</strong>
                <span>{{ preview.tagline.toUpperCase() }}</span>
              </div>
            </Transition>
            <button class="hg-step px-btn px-btn--pink" aria-label="Next ship" @click="stepShip(1)">▶</button>
          </div>
          <div class="hg-ship-cta">
            <button
              v-if="previewState?.unlocked && preview.id !== selected"
              class="hg-fly px-btn"
              @click="fly"
            >FLY THIS SHIP</button>
            <p v-else-if="preview.id === selected" class="hg-flying">◈ FLYING THIS SHIP</p>
            <p v-else class="hg-locked">LOCKED · SCORE IN {{ remaining }} MORE {{ remaining === 1 ? 'GAME' : 'GAMES' }} ({{ distinctGames }}/4)</p>
          </div>
        </div>
      </div>

      <p class="hg-nudge">{{ nudge }}</p>
    </section>

    <p class="hg-hint px-text">{{ hint('ESC · BACK TO THE PORTAL', '⌂ BACK TO THE PORTAL') }}</p>
  </div>
</template>

<script setup lang="ts">
import Horizon from './Horizon.vue'
import PixelPortrait from './PixelPortrait.vue'
import { GAMES, SAVE_GAMES } from '~/themes/leaderboard/games'
import { QUEST_STEPS, formatPlayTime, summarizeRaw } from '~/themes/zelda/progress'
import { CHAPTER_COUNT, summarizeShoreRaw } from '~/themes/anotherworld/progress'
import { SOLVE_COUNT, summarizeBatteryRaw } from '~/themes/battery/progress'
import { SHIPS, unlockProgress } from '~/themes/ships/ships'

const ShipViewer = defineAsyncComponent(() => import('./ShipViewer.vue'))

const { hint } = useInputMode()
const { player, avatar, fetchBoards } = useLeaderboard()
const { selected, ships, bests, distinctGames, saves, avatarFull, loadProfile, selectShip } = useShip()

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

/**
 * The adventure row: the quest in progress, else the best finish, else
 * nothing yet. Short enough to sit beside the title on a 375 px phone.
 */
function questLine(game: string): string {
  const slot = saves.value[game]
  if (!slot) return 'NOT STARTED'
  if (game === 'anotherworld') {
    const c = slot.data ? summarizeShoreRaw(slot.data) : null
    if (c) return `CH ${c.chapter}/${CHAPTER_COUNT} ${formatPlayTime(c.elapsed)}`
  } else if (game === 'battery') {
    const b = slot.data ? summarizeBatteryRaw(slot.data) : null
    if (b) return `${b.solved}/${SOLVE_COUNT} ${formatPlayTime(b.elapsed)}`
  } else if (game === 'miniworld') {
    const m = slot.data ? summarizeMiniWorldRaw(slot.data) : null
    if (m) return `${m.persons} ${m.persons === 1 ? 'PERSON' : 'PERSONER'} · ${m.things} TING`
    return 'NY VERDEN'
  } else {
    const q = slot.data ? summarizeRaw(slot.data) : null
    if (q) return `${q.step}/${QUEST_STEPS} ${formatPlayTime(q.elapsed)}`
  }
  if (slot.best !== null) return `BEST ${formatPlayTime(slot.best)}`
  return slot.clears > 0 ? 'CLEARED' : 'NEW QUEST'
}

/** Mini World's slot, read defensively: people made, and things owned (clothes, furniture, magic weapons). */
function summarizeMiniWorldRaw(raw: unknown): { persons: number; things: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const len = (v: unknown) => (Array.isArray(v) ? v.length : 0)
  if (!Array.isArray(r.persons)) return null
  return { persons: len(r.persons), things: len(r.closet) + len(r.furniture) + len(r.weapons) }
}

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
/* Neon Shrine's pixel look (2026-09-25): the dialog box and the pixel font
   from themes/base/pixel/pixel.css, text at 16 px (two CSS px per font
   pixel), hard edges, no glow on HTML text — the bay behind does the glowing. */
.hg-landing {
  position: relative;
  width: 100vw;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  touch-action: none;
  display: grid;
  place-items: center;
  /* Top clears the radio (top-right), bottom the ⌂ chip. */
  padding: 56px 12px calc(56px + var(--app-safe-bottom, 0px));
  box-sizing: border-box;
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
}

.hg-landing p { margin: 0; }

.hg-hud {
  position: absolute;
  z-index: 2;
  top: 18px;
  left: 16px;
  font-size: 16px;
  line-height: 1;
  color: var(--hg-accent);
  text-shadow: 2px 2px 0 #0b0616;
}

.hg-panel {
  z-index: 2;
  width: min(480px, 100%);
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 14px 14px 12px;
  box-sizing: border-box;
  font-size: 16px;
  line-height: 20px;
  color: var(--hg-text);
}

/* Narrow: the two columns dissolve — everything flows in the one box. */
.hg-cols,
.hg-col { display: contents; }

/* Only the ship's bay gives way when a short screen runs out of room. */
.hg-panel > *,
.hg-col > * { flex: none; }

.hg-label {
  color: var(--hg-text-subtle);
}

.hg-label--rule {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 2px dotted rgba(255, 47, 160, .45);
}

.hg-who {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hg-who-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.hg-name {
  font-size: 24px;
  line-height: 28px;
  color: var(--hg-pink);
  overflow-wrap: anywhere;
}

/* The pilot: their painting as a 32×32 sprite, at 2× (4× on wide screens),
   in a one-pixel pink frame with notched corners like the box. */
.hg-avatar {
  flex: none;
  width: 64px;
  height: 64px;
  box-shadow: 0 -2px 0 0 var(--hg-pink), 0 2px 0 0 var(--hg-pink), -2px 0 0 0 var(--hg-pink), 2px 0 0 0 var(--hg-pink);
  margin: 2px;
  background: #1c1030;
}

.hg-avatar--pending { animation: hg-blink 1.1s steps(1) infinite; }

@keyframes hg-blink {
  50% { box-shadow: 0 -2px 0 0 var(--hg-text-subtle), 0 2px 0 0 var(--hg-text-subtle), -2px 0 0 0 var(--hg-text-subtle), 2px 0 0 0 var(--hg-text-subtle); }
}

@media (prefers-reduced-motion: reduce) {
  .hg-avatar--pending { animation: none; }
}

.hg-scores {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
}

.hg-score {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  white-space: nowrap;
}

.hg-score-game { color: var(--hg-text); }
.hg-score-line { color: var(--hg-accent); }
.hg-score-line--none { color: var(--hg-text-subtle); }
.hg-score--quest {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 2px dotted rgba(47, 243, 255, .3);
}

.hg-empty {
  min-height: 60px;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--hg-text-muted);
}

.hg-empty span { color: var(--hg-text-subtle); }

/* The ship's bay: a dim-edged box round the pixel render. */
.hg-viewer-box {
  --px-u: 2px;
  --px-edge: #4a3d88;
  flex: 0 1 auto !important;
  height: 112px;
  min-height: 72px;
  margin: 8px 2px 0;
  background: #0b0616;
  box-shadow: 0 -2px 0 0 var(--px-edge), 0 2px 0 0 var(--px-edge), -2px 0 0 0 var(--px-edge), 2px 0 0 0 var(--px-edge);
  overflow: hidden;
}

.hg-ship-row {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.hg-step {
  width: 32px;
  height: 32px;
  padding: 0;
  margin: 2px;
  display: grid;
  place-items: center;
}

.hg-ship-name {
  text-align: center;
  display: grid;
  gap: 2px;
}

.hg-ship-name strong {
  font-weight: 400;
  color: var(--hg-accent);
}

.hg-ship-name span { color: var(--hg-text-subtle); }

.hg-ship-cta {
  display: grid;
  place-items: center;
  min-height: 36px;
  margin-top: 8px;
  text-align: center;
}

.hg-fly {
  --px-edge: var(--hg-gold);
  padding: 8px 12px;
}

.hg-flying { color: var(--hg-accent); }
.hg-locked { color: var(--hg-text-subtle); }

.hg-nudge {
  margin-top: 10px !important;
  padding-top: 8px;
  border-top: 2px dotted rgba(255, 47, 160, .45);
  text-align: center;
  color: var(--hg-text-muted);
}

.hg-hint {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: calc(20px + var(--app-safe-bottom, 0px));
  text-align: center;
  font-size: 16px;
  line-height: 1;
  color: var(--hg-pink);
  text-shadow: 2px 2px 0 #0b0616;
  display: none;
}

.hg-fade-enter-active,
.hg-fade-leave-active { transition: opacity 180ms steps(3); }
.hg-fade-enter-from,
.hg-fade-leave-to { opacity: 0; }

/* Tall phones: room for a bigger bay. */
@media (min-height: 760px) {
  .hg-viewer-box { height: 176px; }
}

/* Short screens: the tagline and the nudge go. */
@media (max-height: 700px) {
  .hg-ship-name span,
  .hg-nudge { display: none; }
  .hg-label--rule { margin-top: 8px; padding-top: 6px; }
}

/* Landscape phones: the scores in two columns beside the ship. */
@media (max-height: 520px) and (min-width: 600px) {
  .hg-landing { padding: 48px 56px calc(12px + var(--app-safe-bottom, 0px)); }
  .hg-panel { width: min(760px, 100%); }
  .hg-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .hg-col { display: flex; flex-direction: column; min-width: 0; }
  .hg-avatar { width: 32px; height: 32px; }
  .hg-name { font-size: 16px; line-height: 20px; }
  .hg-who-text .hg-label { display: none; }
  .hg-label--ship { margin-top: 0; padding-top: 0; border-top: 0; }
  .hg-viewer-box { height: 110px; }
}

/* Wide: two columns — pilot and scores left, the ship in a large bay right. */
@media (min-width: 1024px) and (min-height: 700px) {
  .hg-landing {
    justify-items: start;
    padding-left: clamp(48px, 10vw, 160px);
  }
  .hg-panel {
    width: min(920px, 100%);
    padding: 20px 22px 16px;
  }
  .hg-cols {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 28px;
    align-items: start;
  }
  .hg-col { display: flex; flex-direction: column; min-width: 0; }
  .hg-avatar { width: 128px; height: 128px; }
  .hg-who { align-items: flex-end; gap: 16px; }
  .hg-name { font-size: 32px; line-height: 36px; }
  .hg-scores { line-height: 24px; }
  .hg-label--ship { margin-top: 0; padding-top: 0; border-top: 0; }
  .hg-viewer-box { height: 316px; }
  .hg-hint { display: block; }
}
</style>
