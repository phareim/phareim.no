<template>
  <!-- The Hangar: who you are, your high scores and your adventures, in
       Neon Shrine's dialog box over the launch bay. Nothing to pick here:
       the ship picker went on 2026-10-13. -->
  <div class="hg-landing">
    <Horizon />

    <p class="hg-hud px-text">HANGAR</p>

    <section class="hg-panel px-box" aria-live="polite">
      <!-- Two columns on wide screens (pilot and status · scores); one flow
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

          <p class="hg-label hg-label--rule">STATUS</p>
          <ul v-if="status === 'ready'" class="hg-status">
            <li class="hg-row">
              <span class="hg-row-key">GAMES WITH A SCORE</span>
              <span class="hg-row-val">{{ distinctGames }}</span>
            </li>
            <li class="hg-row">
              <span class="hg-row-key">ADVENTURES STARTED</span>
              <span class="hg-row-val">{{ startedAdventures }}</span>
            </li>
          </ul>
          <p v-else-if="status === 'loading'" class="hg-empty">SYNCING…</p>
          <p v-else class="hg-empty">OFFLINE<br><span>THE HANGAR DID NOT ANSWER</span></p>
        </div>

        <div class="hg-col hg-col--scores">
          <p class="hg-label hg-label--rule">HIGH SCORES</p>
          <ol v-if="status === 'ready'" class="hg-scores">
            <li v-for="g in GAMES" :key="g.id" class="hg-row">
              <span class="hg-row-key">{{ g.title.toUpperCase() }}</span>
              <span v-if="bests[g.id]" class="hg-row-val">{{ fmt(bests[g.id]!.score) }} #{{ bests[g.id]!.rank }}</span>
              <span v-else class="hg-row-val hg-row-val--none">NO RUN YET</span>
            </li>
          </ol>

          <p class="hg-label hg-label--rule">ADVENTURES</p>
          <ol v-if="status === 'ready'" class="hg-scores">
            <li v-for="g in SAVE_GAMES" :key="g.id" class="hg-row">
              <span class="hg-row-key">{{ g.title.toUpperCase() }}</span>
              <span class="hg-row-val" :class="{ 'hg-row-val--none': !saves[g.id] }">{{ questLine(g.id) }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <p class="hg-hint px-text">{{ hint('ESC · BACK TO THE PORTAL', '⌂ BACK TO THE PORTAL') }}</p>
  </div>
</template>

<script setup lang="ts">
import PixelPortrait from './PixelPortrait.vue'
import { GAMES, SAVE_GAMES } from '~/themes/leaderboard/games'
import { QUEST_STEPS, formatPlayTime, summarizeRaw } from '~/themes/zelda/progress'
import { CHAPTER_COUNT, summarizeShoreRaw } from '~/themes/anotherworld/progress'
import { SOLVE_COUNT, summarizeBatteryRaw } from '~/themes/battery/progress'

/** The hangar's horizon backdrop is its own chunk (2026-09-30). */
const Horizon = defineAsyncComponent(() => import('./Horizon.vue'))

const { hint } = useInputMode()
const { player, avatar, fetchBoards } = useLeaderboard()
const { bests, distinctGames, saves, avatarFull, loadProfile } = useShip()

/** The portrait: the full painting once the profile answers, thumbnail meanwhile. */
const pic = computed(() => avatarFull.value ?? avatar.value)

const status = ref<'loading' | 'ready' | 'error'>('loading')

/** Adventure slots that have been started at all (any state past NOT STARTED). */
const startedAdventures = computed(() => SAVE_GAMES.filter(g => questLine(g.id) !== 'NOT STARTED').length)

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
  } else if (game === 'figur') {
    const f = slot.data ? summarizeFigurRaw(slot.data) : null
    if (f) return `${f.figures} ${f.figures === 1 ? 'FIGUR' : 'FIGURER'} · ${f.drawn} KLÆR`
    return 'INGEN FIGUR'
  } else {
    const q = slot.data ? summarizeRaw(slot.data) : null
    if (q) return `${q.step}/${QUEST_STEPS} ${formatPlayTime(q.elapsed)}`
  }
  if (slot.best !== null) return `BEST ${formatPlayTime(slot.best)}`
  return slot.clears > 0 ? 'CLEARED' : 'NEW QUEST'
}

/** Lag Din Figur's slot, read defensively: figures made, and clothes drawn. */
function summarizeFigurRaw(raw: unknown): { figures: number; drawn: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.figures)) return null
  return { figures: r.figures.length, drawn: Array.isArray(r.closet) ? r.closet.length : 0 }
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

onMounted(async () => {
  try {
    await fetchBoards().catch(() => null)
  } catch {
    // avatar sync is a bonus; the profile carries the scores
  }
  const profile = await loadProfile()
  status.value = profile ? 'ready' : 'error'
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
  touch-action: pan-y;
  display: grid;
  place-items: stretch;
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

/* The box fills the screen; on a short phone the list scrolls inside it. */
.hg-panel {
  z-index: 2;
  width: 100%;
  height: 100%;
  overflow-y: auto;
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

.hg-label {
  color: var(--hg-text-subtle);
}

/* Scoped under .hg-panel: `.hg-landing p` sets margin 0 at a lower specificity. */
.hg-panel .hg-label--rule {
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

.hg-status,
.hg-scores {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
}

/* One label and one value per row; the label wraps onto a second line when
   the column is narrow, the value stays at the right edge. */
.hg-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.hg-row-key { color: var(--hg-text); min-width: 0; overflow-wrap: anywhere; }
.hg-row-val { color: var(--hg-accent); flex: none; white-space: nowrap; }
.hg-row-val--none { color: var(--hg-text-subtle); }

.hg-empty {
  min-height: 60px;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--hg-text-muted);
}

.hg-empty span { color: var(--hg-text-subtle); }

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

/* Wide: pilot and status left, the scores right, filling the screen. */
@media (min-width: 720px) {
  .hg-landing { padding: 56px 40px calc(56px + var(--app-safe-bottom, 0px)); }
  .hg-panel { padding: 20px 22px 16px; }
  .hg-cols {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 2fr;
    gap: 28px;
    align-items: start;
  }
  .hg-col { display: flex; flex-direction: column; min-width: 0; }
  .hg-col > * { flex: none; }
  .hg-col--scores .hg-label--rule:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
  .hg-status,
  .hg-scores { line-height: 24px; }
}

/* Wide: room for the big portrait and name. */
@media (min-width: 1024px) {
  .hg-avatar { width: 128px; height: 128px; }
  .hg-who { align-items: flex-end; gap: 16px; }
  .hg-name { font-size: 24px; line-height: 28px; }
}

@media (min-width: 1024px) and (min-height: 700px) {
  .hg-hint { display: block; }
}
</style>
