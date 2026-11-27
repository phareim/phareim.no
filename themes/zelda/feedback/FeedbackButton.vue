<!-- DEV MODE's feedback button, in the top-left corner over the canvas: the hearts are painted there, and no other
  control stands there. It takes its press at the pointer's first touch, so the picture is of that moment, and no
  stick starts under it (`input.ts` leaves presses on buttons alone). -->
<template>
  <button
    type="button"
    class="zelda-fb"
    :class="{ away }"
    :disabled="away"
    data-game-keys
    aria-label="Send feedback"
    @pointerdown.prevent="down"
    @mousedown.prevent
    @click="$event.detail === 0 && emit('press')"
    @contextmenu.prevent
  >FB</button>
</template>

<script setup lang="ts">
defineProps<{
  /** The menu, a panel, a dialog or a way out has the screen. */
  away: boolean
}>()

const emit = defineEmits<{ press: [] }>()

function down(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  emit('press')
}
</script>

<style scoped>
.zelda-fb {
  position: absolute;
  left: env(safe-area-inset-left, 0px);
  top: env(safe-area-inset-top, 0px);
  z-index: 6;
  box-sizing: border-box;
  width: 44px;
  height: 44px;
  margin: 0;
  /* The letters stand in DEV MODE's row, along the top edge: the hearts are painted under it. */
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0 0 0 6px;
  border: 0;
  border-radius: 0;
  background: none;
  appearance: none;
  font-family: var(--font-pixel);
  font-size: 8px;
  font-weight: 400;
  line-height: 12px;
  -webkit-font-smoothing: none;
  color: rgba(185, 168, 217, 0.34);
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.zelda-fb:focus-visible {
  outline: 2px solid #ffd23f;
  outline-offset: -2px;
}
.zelda-fb.away {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms, visibility 0s 120ms;
}
@media (prefers-reduced-motion: reduce) {
  .zelda-fb.away { transition: none; }
}
</style>
