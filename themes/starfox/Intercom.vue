<template>
  <Transition name="sf-intercom">
    <div
      v-if="line"
      :key="line.id"
      class="sf-intercom"
      :class="[`sf-intercom--${line.who}`, { 'sf-intercom--talking': typing }]"
      role="status"
      aria-live="polite"
    >
      <div class="sf-intercom-portrait" aria-hidden="true">
        <canvas :ref="el => paint(el, line?.who, 0)" class="sf-intercom-face sf-intercom-face--a" width="13" height="13" />
        <canvas :ref="el => paint(el, line?.who, 1)" class="sf-intercom-face sf-intercom-face--b" width="13" height="13" />
      </div>
      <div class="sf-intercom-body">
        <p class="sf-intercom-who">{{ NAMES[line.who] }}</p>
        <p class="sf-intercom-text">
          <span>{{ line.text.slice(0, shown) }}</span><span v-if="typing" class="sf-intercom-caret">▶</span><span class="sf-intercom-ghost">{{ line.text.slice(shown) }}</span>
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * The Star Fox intercom (OPERATION NIGHTLIGHT, 2026-09-25): one line at a
 * time from the story director (story.ts), typed out in Neon Shrine's
 * dialog box, modelled on Galaga's Intercom.vue. Three voices, each with a
 * 13×13 pixel portrait that swaps between two frames while it talks:
 *   claude  gold edge, the gold spark (as in Galaga)
 *   hollow  pink edge, a dark ringed eye that glitches; the text jitters
 *   hangar  cyan edge, the town's radio mast with its red light and signal
 * The untyped remainder is laid out invisibly, so the panel never resizes
 * while typing. Top-left on wide screens, just under the radio widget on
 * phones (full width, compact, no name line), never over the bottom dock.
 * Position is fixed; pointer-events none.
 *
 * Usage (Landing.vue; the director lives where the game clock is):
 *
 *   <Intercom :line="intercom" :shown="intercomShown" />
 *
 *   const director = createDirector({ reduced: prefersReducedMotion })
 *   const intercom = ref<{ id: number; who: Speaker; text: string } | null>(null)
 *   const intercomShown = ref(0)
 *   // every frame, after director.tick(dt) (skip the tick while paused):
 *   const cur = director.current()
 *   if ((cur?.id ?? 0) !== (intercom.value?.id ?? 0)) intercom.value = cur && { id: cur.id, who: cur.who, text: cur.text }
 *   if ((cur?.shown ?? 0) !== intercomShown.value) intercomShown.value = cur?.shown ?? 0
 */
import { computed } from 'vue'
import { PAL } from '~/themes/base/pixel/sprites'
import type { Speaker } from './story'

const props = defineProps<{
  line: { id: number; who: Speaker; text: string } | null
  /** Characters typed so far. */
  shown: number
}>()

const NAMES: Record<Speaker, string> = {
  claude: 'CLAUDE · WING',
  hollow: 'THE HOLLOW · INTERCEPT',
  hangar: 'HANGAR · CONTROL',
}

const typing = computed(() => !!props.line && props.shown < props.line.text.length)

const N = 13
const MID = 6

/** A portrait as a 13×13 pixel map (PAL letters, '.' clear); frame 1 is the talking beat. */
function face(who: Speaker, frame: number): string[] {
  const grid = Array.from({ length: N }, () => Array<string>(N).fill('.'))
  const set = (x: number, y: number, ch: string) => { if (x >= 0 && y >= 0 && x < N && y < N) grid[y]![x] = ch }
  if (who === 'claude') {
    // Eight rays round a hot core, long and short alternating; they swap on the beat.
    const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
    dirs.forEach(([dx, dy], i) => {
      const len = i % 2 === frame ? 6 : 4
      for (let r = 2; r <= len; r++) set(MID + dx! * r, MID + dy! * r, r === len ? 'Y' : 'y')
    })
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) set(MID + x, MID + y, 'e')
    set(MID, MID, 'w')
  } else if (who === 'hollow') {
    // A dark ringed eye: outer ring, an almond lid, a hollow iris.
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.round(Math.hypot(x - MID, y - MID))
      if (d === 6) set(x, y, 'P')
      const u = (x - MID) / 5
      const lid = Math.round(3.2 * (1 - u * u))
      if (Math.abs(x - MID) <= 5 && Math.abs(y - MID) <= lid) {
        set(x, y, Math.abs(y - MID) === lid ? 'p' : 'k')
      }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - MID, y - MID)
      if (d > 1.2 && d <= 2.4) set(x, y, 'm')
    }
    set(MID, MID, 'k')
    set(MID + 1, MID - 1, 'w')
    if (frame) {
      // The glitch: three rows slip sideways, the lid tears.
      for (const [row, dx] of [[4, 2], [6, -1], [8, 1]] as const) {
        const r = grid[row]!
        const moved = r.map((_, x) => r[(x - dx + N) % N]!)
        grid[row] = moved
      }
      set(1, MID - 2, 'c')
      set(11, MID + 2, 'c')
    }
  } else {
    // The town's radio mast: a lattice tower, a red light on top, signal arcs.
    for (let y = 2; y <= 11; y++) {
      const w = y < 5 ? 0 : y < 9 ? 1 : 2
      set(MID - w, y, 'C')
      set(MID + w, y, 'C')
      if (w && y % 2) for (let x = MID - w + 1; x < MID + w; x++) set(x, y, 'c')
    }
    set(MID, 1, 'c')
    for (let x = MID - 4; x <= MID + 4; x++) set(x, 12, 'G')
    set(MID, 0, frame ? 'r' : 'R')
    const arcs = frame ? [2, 4] : [2]
    for (const r of arcs) {
      for (const s of [-1, 1]) {
        set(MID + s * r, 1, 'c')
        set(MID + s * (r - 1), 0, 't')
        set(MID + s * (r - 1), 2, 't')
      }
    }
  }
  return grid.map(r => r.join(''))
}

// Called by Vue with the element on mount and null on unmount (when the
// line may already be gone).
function paint(el: unknown, who: Speaker | undefined, frame: number) {
  if (!who || !(el instanceof HTMLCanvasElement) || el.dataset.who === who) return
  el.dataset.who = who
  const g = el.getContext('2d')
  if (!g) return
  g.clearRect(0, 0, N, N)
  face(who, frame).forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return
    g.fillStyle = PAL[ch] ?? '#ffffff'
    g.fillRect(x, y, 1, 1)
  }))
}
</script>

<style scoped>
/* Neon Shrine's dialog box (themes/zelda/render/hud.ts box()) at 2 CSS px
   per pixel: four offset shadows draw a one-pixel border with notched
   corners; the ::before line is the faint rule inside the top edge.
   Text width in font pixels is pinned by tests/starfox-story.test.mjs
   (desktop 171, a 375 px phone 151): change both together. */
.sf-intercom {
  --edge: #ffd23f;
  --rule: rgba(255, 210, 63, 0.35);
  position: fixed;
  z-index: 4;
  left: 18px;
  top: max(14px, env(safe-area-inset-top));
  /* Clear of the radio widget top-right (up to 340 px wide). */
  width: clamp(260px, calc(100vw - 400px), 420px);
  box-sizing: border-box;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 14px 12px 12px;
  background: rgba(11, 6, 22, 0.88);
  box-shadow: 0 -2px 0 0 var(--edge), 0 2px 0 0 var(--edge), -2px 0 0 0 var(--edge), 2px 0 0 0 var(--edge);
  pointer-events: none;
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
}
.sf-intercom::before {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  top: 4px;
  height: 2px;
  background: var(--rule);
}

.sf-intercom--hollow {
  --edge: #ff2fa0;
  --rule: rgba(255, 47, 160, 0.35);
}
.sf-intercom--hangar {
  --edge: #2ff3ff;
  --rule: rgba(47, 243, 255, 0.35);
}

/* Short landscape screens: a compact panel in the corner. */
@media (min-width: 641px) and (max-height: 520px) {
  .sf-intercom {
    left: 12px;
    top: max(10px, env(safe-area-inset-top));
    width: clamp(240px, calc(100vw - 400px), 380px);
    padding: 8px 10px 8px 8px;
    gap: 8px;
  }
  .sf-intercom::before { display: none; }
  .sf-intercom-portrait { width: 26px !important; height: 26px !important; }
  .sf-intercom .sf-intercom-who { display: none; }
  .sf-intercom .sf-intercom-text { line-height: 18px; }
}

/* Phones: full width just under the radio widget, the portrait and the
   edge colour say who talks, the name line goes. */
@media (max-width: 640px) {
  .sf-intercom {
    left: 10px;
    right: 10px;
    width: auto;
    top: calc(max(12px, env(safe-area-inset-top)) + 48px);
    padding: 8px 10px 8px 8px;
    gap: 8px;
    background: rgba(11, 6, 22, 0.78);
  }
  .sf-intercom::before { display: none; }
  .sf-intercom-portrait { width: 26px !important; height: 26px !important; }
  .sf-intercom .sf-intercom-who { display: none; }
  .sf-intercom .sf-intercom-text { line-height: 18px; }
}

.sf-intercom-portrait {
  position: relative;
  flex: none;
  width: 39px;
  height: 39px;
  background: #0b0616;
  box-shadow: 0 0 0 2px #1c1030;
}

.sf-intercom-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
.sf-intercom-face--b {
  visibility: hidden;
}
.sf-intercom--talking .sf-intercom-face--a {
  animation: sf-face-a 0.32s steps(1) infinite;
}
.sf-intercom--talking .sf-intercom-face--b {
  animation: sf-face-b 0.32s steps(1) infinite;
}
/* The Hollow's eye glitches in bursts, not on an even beat. */
.sf-intercom--hollow.sf-intercom--talking .sf-intercom-face--a {
  animation: sf-glitch-a 0.9s steps(1) infinite;
}
.sf-intercom--hollow.sf-intercom--talking .sf-intercom-face--b {
  animation: sf-glitch-b 0.9s steps(1) infinite;
}
/* The mast's red light blinks slowly. */
.sf-intercom--hangar.sf-intercom--talking .sf-intercom-face--a {
  animation-duration: 0.6s;
}
.sf-intercom--hangar.sf-intercom--talking .sf-intercom-face--b {
  animation-duration: 0.6s;
}
@keyframes sf-face-a {
  50% { visibility: hidden; }
}
@keyframes sf-face-b {
  50% { visibility: visible; }
}
@keyframes sf-glitch-a {
  20%, 30%, 70% { visibility: hidden; }
  25%, 40%, 80% { visibility: visible; }
}
@keyframes sf-glitch-b {
  20%, 30%, 70% { visibility: visible; }
  25%, 40%, 80% { visibility: hidden; }
}

.sf-intercom-body {
  min-width: 0;
  flex: 1;
}

.sf-intercom-who {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1;
  color: var(--edge);
  text-shadow: 2px 2px 0 #0b0616;
}

.sf-intercom-text {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  color: #fff4ff;
  text-shadow: 2px 2px 0 #3a1a4a;
  text-align: left;
  text-transform: uppercase;
}
.sf-intercom--hollow .sf-intercom-text {
  color: #ff8ae0;
}
.sf-intercom--hollow.sf-intercom--talking .sf-intercom-text {
  animation: sf-hollow-jitter 0.18s steps(2) infinite;
}
@keyframes sf-hollow-jitter {
  0% { transform: translateX(0); }
  50% { transform: translateX(2px); text-shadow: -2px 0 0 rgba(47, 243, 255, 0.6), 2px 2px 0 #3a1a4a; }
}

.sf-intercom-caret {
  color: var(--edge);
  animation: sf-caret 0.5s steps(2) infinite;
}
@keyframes sf-caret {
  50% { opacity: 0; }
}

.sf-intercom-ghost {
  visibility: hidden;
}

.sf-intercom-enter-active {
  transition: opacity 0.24s steps(3), transform 0.24s steps(3);
}
.sf-intercom-leave-active {
  transition: opacity 0.2s steps(2);
}
.sf-intercom-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.sf-intercom-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sf-intercom--talking .sf-intercom-face--a,
  .sf-intercom--talking .sf-intercom-face--b,
  .sf-intercom--hollow.sf-intercom--talking .sf-intercom-face--a,
  .sf-intercom--hollow.sf-intercom--talking .sf-intercom-face--b,
  .sf-intercom--hollow.sf-intercom--talking .sf-intercom-text,
  .sf-intercom-caret {
    animation: none;
  }
  .sf-intercom-enter-active { transition: opacity 0.2s; }
  .sf-intercom-enter-from { transform: none; }
}
</style>
