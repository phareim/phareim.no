<template>
  <Transition name="intercom">
    <div
      v-if="line"
      :key="line.id"
      class="intercom"
      :class="[`intercom--${line.who}`, { 'intercom--talking': typing }]"
      role="status"
      aria-live="polite"
    >
      <div class="intercom-portrait" aria-hidden="true">
        <canvas :ref="el => paint(el, line?.who, 0)" class="intercom-face intercom-face--a" width="13" height="13" />
        <canvas :ref="el => paint(el, line?.who, 1)" class="intercom-face intercom-face--b" width="13" height="13" />
      </div>
      <div class="intercom-body">
        <p class="intercom-who">{{ line.who === 'claude' ? 'CLAUDE · COMMS' : 'THE CHOIR · INTERCEPT' }}</p>
        <p class="intercom-text">
          <span>{{ line.text.slice(0, shown) }}</span><span v-if="typing" class="intercom-caret">▶</span><span class="intercom-ghost">{{ line.text.slice(shown) }}</span>
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * The Galaga intercom: one line at a time from the story director
 * (story.ts), typed out, in Neon Shrine's dialog box (2026-09-24): a dark
 * panel with a notched one-pixel border and the 5×7 pixel font. Claude's
 * panel is cyan with a gold pixel spark; the Choir's is pink with rings
 * and a waveform that glitches while it talks. The untyped remainder is
 * laid out invisibly so the panel never changes size while typing.
 */
import { PAL } from '~/themes/base/pixel/sprites'

const props = defineProps<{
  line: { id: number; who: 'claude' | 'choir'; text: string } | null
  shown: number
}>()

const typing = computed(() => !!props.line && props.shown < props.line.text.length)

/** The portrait as a 13×13 pixel map; frame 1 is the talking beat. */
function face(who: 'claude' | 'choir', frame: number): string[] {
  const n = 13
  const c = 6
  const grid = Array.from({ length: n }, () => Array<string>(n).fill('.'))
  const set = (x: number, y: number, ch: string) => { if (x >= 0 && y >= 0 && x < n && y < n) grid[y]![x] = ch }
  if (who === 'claude') {
    // Eight rays round a hot core, long and short alternating; they swap on the beat.
    const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
    dirs.forEach(([dx, dy], i) => {
      const len = (i % 2 === frame ? 6 : 4)
      for (let r = 2; r <= len; r++) set(c + dx! * r, c + dy! * r, r === len ? 'Y' : 'y')
    })
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) set(c + x, c + y, 'e')
    set(c, c, 'w')
  } else {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.round(Math.hypot(x - c, y - c))
      if (d === 6) set(x, y, 'P')
      else if (d === 4) set(x, y, 'p')
      else if (d === 2) set(x, y, 'm')
    }
    // The waveform across the middle.
    const wave = frame ? [0, -2, 1, -3, 3, -1, 2, -2, 1, 0] : [0, -1, 1, -1, 2, -2, 1, -1, 1, 0]
    for (let i = 0; i < 11; i++) set(1 + i, c + (wave[i] ?? 0), 'w')
  }
  return grid.map(r => r.join(''))
}

// Called by Vue with the element on mount and null on unmount (when the
// line may already be gone).
function paint(el: unknown, who: 'claude' | 'choir' | undefined, frame: number) {
  if (!who || !(el instanceof HTMLCanvasElement) || el.dataset.who === who) return
  el.dataset.who = who
  const g = el.getContext('2d')
  if (!g) return
  g.clearRect(0, 0, 13, 13)
  face(who, frame).forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return
    g.fillStyle = PAL[ch] ?? '#ffffff'
    g.fillRect(x, y, 1, 1)
  }))
}
</script>

<style scoped>
/* Neon Shrine's dialog box (themes/zelda/render/hud.ts box()) at 2 CSS px
   per pixel: the four offset shadows draw a one-pixel border with notched
   corners, the ::before line is the faint cyan rule inside the top edge. */
.intercom {
  --edge: #2ff3ff;
  position: absolute;
  z-index: 3;
  left: 18px;
  bottom: calc(64px + var(--app-safe-bottom, 0px));
  width: min(420px, calc(100vw - 36px));
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
.intercom::before {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  top: 4px;
  height: 2px;
  background: rgba(47, 243, 255, 0.35);
}

.intercom--choir {
  --edge: #ff2fa0;
}

/* Short landscape screens: a compact panel in the corner. */
@media (min-width: 641px) and (max-height: 520px) {
  .intercom {
    left: 12px;
    bottom: calc(12px + var(--app-safe-bottom, 0px));
    width: min(340px, 46vw);
    padding: 8px 10px 8px 8px;
    gap: 8px;
  }
  .intercom-portrait { width: 26px !important; height: 26px !important; }
}

/* Phones: under the HUD at the top, clear of the ship and the thumb. */
@media (max-width: 640px) {
  .intercom {
    left: 14px;
    right: 14px;
    width: auto;
    bottom: auto;
    top: calc(max(0.6rem, env(safe-area-inset-top)) + 118px);
    padding: 10px 10px 10px 10px;
    gap: 10px;
  }
}

.intercom-portrait {
  position: relative;
  flex: none;
  width: 39px;
  height: 39px;
  background: #0b0616;
  box-shadow: 0 0 0 2px #1c1030;
}

.intercom-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
.intercom-face--b {
  visibility: hidden;
}
.intercom--talking .intercom-face--a {
  animation: face-a 0.32s steps(1) infinite;
}
.intercom--talking .intercom-face--b {
  animation: face-b 0.32s steps(1) infinite;
}
@keyframes face-a {
  50% { visibility: hidden; }
}
@keyframes face-b {
  50% { visibility: visible; }
}

.intercom-body {
  min-width: 0;
  flex: 1;
}

.intercom-who {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1;
  color: var(--edge);
  text-shadow: 2px 2px 0 #0b0616;
}

.intercom-text {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  color: #fff4ff;
  text-shadow: 2px 2px 0 #3a1a4a;
  text-align: left;
  text-transform: uppercase;
}
.intercom--choir .intercom-text {
  color: #ff8ae0;
  text-shadow: 2px 2px 0 #3a1a4a;
}
.intercom--choir.intercom--talking .intercom-text {
  animation: choir-glitch 0.18s steps(2) infinite;
}
@keyframes choir-glitch {
  0% { transform: translateX(0); }
  50% { transform: translateX(2px); text-shadow: -2px 0 0 rgba(47, 243, 255, 0.6), 2px 2px 0 #3a1a4a; }
}

.intercom-caret {
  color: var(--edge);
  animation: caret 0.5s steps(2) infinite;
}
@keyframes caret {
  50% { opacity: 0; }
}

.intercom-ghost {
  visibility: hidden;
}

.intercom-enter-active {
  transition: opacity 0.24s steps(3), transform 0.24s steps(3);
}
.intercom-leave-active {
  transition: opacity 0.2s steps(2);
}
.intercom-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.intercom-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .intercom--talking .intercom-face--a,
  .intercom--talking .intercom-face--b,
  .intercom--choir.intercom--talking .intercom-text,
  .intercom-caret {
    animation: none;
  }
  .intercom-enter-active { transition: opacity 0.2s; }
  .intercom-enter-from { transform: none; }
}
</style>
