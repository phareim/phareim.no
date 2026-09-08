<template>
  <!-- Uniform Escape feedback for every game theme: a hold-to-quit progress
    pill while Escape is held, and a paused pill while the run is frozen.
    Fixed above the canvas and the landing overlay (pager is z-50), never
    intercepting input. Games with their own paused UI pass show-paused=false. -->
  <div v-if="holding || (paused && showPaused)" class="esc-hold-layer">
    <div v-if="holding" class="esc-hold-pill" role="status" aria-label="Holding Escape to quit">
      <span class="esc-hold-label">HOLD ESC TO QUIT</span>
      <span class="esc-hold-track" aria-hidden="true"><span class="esc-hold-fill" :style="{ transform: `scaleX(${progress})` }" /></span>
    </div>
    <div v-else class="esc-hold-pill" role="status" aria-label="Game paused">
      <span class="esc-hold-label">PAUSED — ESC RESUMES · HOLD ESC QUITS</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { EscHoldTracker, ESC_HOLD_MS } from './escHold'

const props = withDefaults(defineProps<{
  /** True while a run is active (playing or paused); idle attract mode ignores Escape. */
  isActive: () => boolean
  /** True while the run is frozen; shows the paused pill when not holding. */
  paused: boolean
  /** False when the game already shows its own paused state (Tetris, Another Shore). */
  showPaused?: boolean
  holdMs?: number
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
.esc-hold-layer {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  pointer-events: none;
}
.esc-hold-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(5, 2, 12, 0.82);
  border: 1px solid rgba(47, 243, 255, 0.5);
  border-radius: 999px;
  font-family: var(--font-machine, ui-monospace, monospace);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
  color: #eafcff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.6);
}
.esc-hold-track {
  width: 90px;
  height: 4px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 2px;
  overflow: hidden;
}
.esc-hold-fill {
  display: block;
  height: 100%;
  background: #ff2fa0;
  box-shadow: 0 0 8px #ff2fa0;
  transform: scaleX(0);
  transform-origin: left center;
}
</style>
