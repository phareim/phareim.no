<!-- Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync. -->
<template>
  <section ref="box" class="win" :style="{ '--acc': accent }">
    <canvas ref="canvas" class="win__canvas" aria-hidden="true" />

    <template v-if="!quiet">
    <div class="win__hud win__hud--tl">
      <p class="win__name">{{ place.origin === 'opus' ? '◈ ' : '' }}{{ place.name }}</p>
      <p class="win__key"><PxText :text="hud.key" /></p>
    </div>

    <div class="win__hud win__hud--tr">
      <p class="win__bpm">{{ hud.bpm }} BPM</p>
      <div class="win__meter" :aria-label="`bar ${hud.phraseBar + 1} of ${hud.phraseBars}`">
        <span
          v-for="i in hud.phraseBars"
          :key="i"
          class="win__block"
          :class="{ past: i - 1 < hud.phraseBar, now: i - 1 === hud.phraseBar }"
        />
      </div>
    </div>

    <div class="win__hud win__hud--bl">
      <p v-if="hud.chord" class="win__chord">
        <PxText class="win__now" :text="hud.chord" /><template v-if="hud.next"><span class="win__arrow"> → </span><PxText class="win__next" :text="hud.next" /></template>
      </p>
      <p v-if="hud.note" class="win__note"><PxText :text="hud.note" /></p>
    </div>
    </template>

    <div class="win__corner" :class="{ 'win__corner--quiet': quiet }">
      <slot name="corner" />
    </div>

    <button
      v-if="!started"
      class="win__start"
      type="button"
      @click="$emit('start')"
    >
      <span class="win__cta px-box px-box--pink"><span class="px-blink">▶</span> {{ hint('PRESS SPACE TO TUNE IN', 'TAP TO TUNE IN') }}</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { useRadio } from '../composables/useRadio'
import PxText from './PxText.vue'
/**
 * The big window: the painted place, driven every animation frame by the
 * player's visual state, with the HUD over it (place, key, chord now → next,
 * bpm, the phrase meter, the transition note). The loop stops while the tab
 * is hidden.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createScene } from '../scene/index.ts'
import type { Scene } from '../scene/index.ts'

defineProps<{ quiet?: boolean }>()
defineEmits<{ start: [] }>()

const { hud, started, tick, landscapeOf } = useRadio()
const box = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const place = computed(() => landscapeOf(hud.landscape))
const accent = computed(() => place.value.accent || '#2ff3ff')

const touch = ref(false)
const hint = (k: string, t: string) => (touch.value ? t : k)

let scene: Scene | null = null
let raf = 0
let ro: ResizeObserver | null = null

function frame(now: number): void {
  raf = requestAnimationFrame(frame)
  const v = tick(now)
  try {
    scene?.frame(v, now)
  } catch (e) {
    console.error(e)
    scene = null
  }
}

function run(): void {
  cancelAnimationFrame(raf)
  if (document.visibilityState === 'visible') raf = requestAnimationFrame(frame)
}

function fit(): void {
  const el = box.value
  if (!el || !scene) return
  const r = el.getBoundingClientRect()
  scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), window.devicePixelRatio || 1)
}

onMounted(() => {
  touch.value = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  if (canvas.value) {
    try {
      scene = createScene(canvas.value)
    } catch (e) {
      console.error(e)
    }
  }
  fit()
  ro = new ResizeObserver(fit)
  if (box.value) ro.observe(box.value)
  document.addEventListener('visibilitychange', run)
  run()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  document.removeEventListener('visibilitychange', run)
  scene?.dispose()
})
</script>

<style scoped>
.win {
  position: relative;
  overflow: hidden;
  background: var(--bg);
  min-height: 0;
}

.win__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
}

.win p { margin: 0; }

.win__hud {
  position: absolute;
  z-index: 1;
  font-size: 16px;
  line-height: 20px;
  text-transform: uppercase;
  color: var(--ink);
  text-shadow: 2px 2px 0 var(--bg);
  pointer-events: none;
}
.win__hud--tl { top: calc(12px + env(safe-area-inset-top, 0px)); left: 16px; right: 40%; }
.win__hud--tr { top: calc(12px + env(safe-area-inset-top, 0px)); right: 16px; text-align: right; }
.win__hud--bl { bottom: 12px; left: 16px; right: 232px; }

/* AUTO, ▶▶ and DIM sit in the bottom-right corner; in the quiet view they are all there is. */
.win__corner {
  position: absolute;
  z-index: 3;
  right: 16px;
  bottom: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
}
.win__corner--quiet { bottom: calc(16px + var(--app-safe-bottom, 0px)); right: 20px; }

.win__name {
  font-size: 32px;
  line-height: 36px;
  color: var(--acc);
  text-shadow: 4px 4px 0 var(--bg), 0 0 18px color-mix(in srgb, var(--acc) 55%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.win__key { color: var(--muted); margin-top: 4px; --pxt-shadow: 2px 2px 0 #0b0616; }

.win__bpm { color: var(--cyan); }

.win__meter {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
}
.win__block {
  width: 10px;
  height: 10px;
  background: rgba(11, 6, 22, 0.7);
  box-shadow: inset 0 0 0 2px var(--edge-dim);
}
.win__block.past { background: color-mix(in srgb, var(--cyan) 35%, var(--bg)); box-shadow: none; }
.win__block.now { background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }

.win__chord {
  font-size: 32px;
  line-height: 36px;
  text-shadow: 4px 4px 0 var(--bg);
}
.win__now { color: var(--ink); }
.win__arrow { color: var(--subtle); }
.win__next { color: var(--muted); }

.win__note {
  --pxt-shadow: 2px 2px 0 #0b0616;
  margin-top: 6px !important;
  color: var(--pink);
}

.win__start {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 16px;
  color: var(--pink);
  text-shadow: 2px 2px 0 var(--bg), 0 0 10px color-mix(in srgb, var(--pink) 50%, transparent);
  -webkit-tap-highlight-color: transparent;
}
.win__cta {
  padding: 12px 16px;
  background: var(--bg);
  line-height: 16px;
}

@media (max-width: 700px) {
  .win__name { font-size: 24px; line-height: 28px; text-shadow: 2px 2px 0 var(--bg), 0 0 14px color-mix(in srgb, var(--acc) 55%, transparent); }
  .win__chord { font-size: 24px; line-height: 28px; text-shadow: 2px 2px 0 var(--bg); }
  .win__hud--tl { right: 34%; }
  .win__hud--bl { right: 16px; }
  .win__corner:not(.win__corner--quiet) { bottom: auto; top: calc(62px + env(safe-area-inset-top, 0px)); }
  .win__block { width: 8px; height: 8px; }
  .win__meter { gap: 2px; }
}
</style>
