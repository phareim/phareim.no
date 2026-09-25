<template>
  <!-- Uniform Escape feedback for every game theme: a hold-to-quit progress
    pill while Escape is held, and a paused pill while the run is frozen.
    Fixed above the canvas and the landing overlay (pager is z-50), never
    intercepting input. Games with their own paused UI pass show-paused=false. -->
  <div v-if="holding || (paused && showPaused)" class="esc-hold-layer">
    <div v-if="holding" class="esc-hold-pill px-box" role="status" :aria-label="holdLabel">
      <span class="esc-hold-label">{{ holdLabel }}</span>
      <span class="esc-hold-track" aria-hidden="true"><span class="esc-hold-fill" :style="{ transform: `scaleX(${Math.floor(progress * CELLS) / CELLS})` }" /></span>
    </div>
    <div v-else class="esc-hold-pill px-box" role="status" aria-label="Game paused">
      <span class="esc-hold-label">{{ pausedLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { EscHoldTracker, ESC_HOLD_MS } from './escHold'

const props = withDefaults(defineProps<{
  /** True while a run is active (playing or paused); idle attract mode ignores Escape. */
  isActive: () => boolean
  /** True while the run is frozen; shows the paused pill when not holding. */
  paused: boolean
  /** False when the game already shows its own paused state (Tetris, Another Shore). */
  showPaused?: boolean
  holdMs?: number
  /** What the hold does, on the progress pill; default 'HOLD ESC TO QUIT'. */
  label?: string
}>(), {
  showPaused: true,
  holdMs: ESC_HOLD_MS,
})

const emit = defineEmits<{
  /** Quick Escape tap: pause or resume. */
  tap: []
  /** Full hold: quit the run into game over. */
  hold: []
}>()

/** The hold bar fills in whole cells, like Neon Shrine's meters. */
const CELLS = 12

const holdLabel = computed(() => props.label ?? 'HOLD ESC TO QUIT')
const { hint } = useInputMode()
const pausedLabel = computed(() => hint(`PAUSED — ESC RESUMES · ${props.label ?? 'HOLD ESC QUITS'}`, 'PAUSED'))

const holding = ref(false)
const progress = ref(0)

let tracker: EscHoldTracker | null = null
let raf = 0

function sync(): void {
  if (!tracker) return
  holding.value = tracker.holding
  progress.value = tracker.progress
}

function frame(): void {
  raf = 0
  tracker?.poll()
  sync()
  // Keep polling until the key is released; after the hold fires the full
  // bar just sits until keyup (poll is a no-op once fired).
  if (tracker?.holding) raf = requestAnimationFrame(frame)
}

function onKeyDown(e: KeyboardEvent): void {
  if (tracker?.onKeyDown(e)) {
    sync()
    if (!raf) raf = requestAnimationFrame(frame)
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (!tracker?.holding) return
  tracker.onKeyUp(e)
  sync()
}

function onBlur(): void {
  if (!tracker?.holding) return
  tracker.cancel()
  sync()
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') onBlur()
}

onMounted(() => {
  tracker = new EscHoldTracker(
    {
      isActive: props.isActive,
      onTap: () => emit('tap'),
      onHold: () => emit('hold'),
    },
    props.holdMs,
  )
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
  document.removeEventListener('visibilitychange', onVisibility)
  if (raf) cancelAnimationFrame(raf)
  tracker?.cancel()
  tracker = null
})
</script>

<style scoped>
/* Neon Shrine's dialog box (.px-box in themes/base/pixel/pixel.css) with the
   pixel font; the bar fills in twelve whole cells. */
.esc-hold-layer {
  position: fixed;
  top: max(14px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  pointer-events: none;
}
.esc-hold-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  max-width: calc(100vw - 40px);
  box-sizing: border-box;
  font-size: 16px;
  line-height: 20px;
  background: #0b0616;
  color: #f2e9ff;
  text-shadow: 2px 2px 0 #0b0616;
}
.esc-hold-label { white-space: nowrap; }
/* Narrow screens: under the radio, not beside it. */
@media (max-width: 640px) {
  .esc-hold-layer { top: calc(max(12px, env(safe-area-inset-top)) + 52px); }
  .esc-hold-label { white-space: normal; text-align: center; }
}
.esc-hold-track {
  flex: none;
  width: 96px;
  height: 8px;
  background: #1a1030;
  box-shadow: 0 0 0 2px #0b0616;
}
.esc-hold-fill {
  display: block;
  height: 100%;
  background: repeating-linear-gradient(90deg, #ff2fa0 0 6px, transparent 6px 8px);
  transform: scaleX(0);
  transform-origin: left center;
}
</style>
