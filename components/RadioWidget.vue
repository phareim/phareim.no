<template>
  <div class="radio-widget px-box" role="status" aria-label="Music radio">
    <button
      class="radio-widget__btn"
      :aria-label="muted ? 'Unmute radio' : 'Mute radio'"
      :title="muted ? 'UNMUTE' : 'MUTE'"
      @click="toggleMute"
    >{{ muted ? '▶' : '❚❚' }}</button>
    <button
      class="radio-widget__name"
      title="NEXT STATION [M]"
      aria-label="Next station"
      @click="next"
    ><span class="radio-widget__dot" :class="{ off: muted }" aria-hidden="true" /><span class="radio-widget__track">{{ muted ? 'MUTED' : trackName }}</span><span class="radio-widget__note" aria-hidden="true">♪</span></button>
    <span class="radio-widget__pos" aria-hidden="true">{{ stationPos }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * The persistent radio widget: fixed top-right on every theme, showing the
 * station the global engine (`themes/radio/engine.ts`) is playing. M, tap
 * or the name button cycles all six stations; the ▶/❚❚ button mutes.
 *
 * First-gesture autostart: browsers only allow audio inside a user gesture,
 * so the widget listens once for any pointerdown/keydown and starts the
 * radio there — games additionally call `ensurePlaying()` on their own
 * start gestures. The widget never captures game keys besides M, and M
 * ignores repeats and form fields.
 */
const { trackName, stationPos, muted, next, toggleMute, ensurePlaying } = useRadio()

function isInteractive(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null
  return !!e?.closest?.('a, button, input, textarea, select')
}

function onFirstGesture(): void {
  ensurePlaying()
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.code !== 'KeyM' || e.repeat || isInteractive(e.target)) return
  next()
}

onMounted(() => {
  window.addEventListener('pointerdown', onFirstGesture, { once: true })
  window.addEventListener('keydown', onFirstGesture, { once: true })
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onFirstGesture)
  window.removeEventListener('keydown', onFirstGesture)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
/* Neon Shrine's dialog box (.px-box in themes/base/pixel/pixel.css) in the
   theme's accent, pixel font at 16 px; the live pip blinks in steps. */
.radio-widget {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  right: 12px;
  z-index: 60;
  --px-edge: color-mix(in srgb, var(--theme-accent, #2ff3ff) 70%, #0b0616);
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(60vw, 340px);
  padding: 4px 10px 4px 6px;
  font-size: 16px;
  line-height: 20px;
  color: var(--theme-accent, #2ff3ff);
  text-shadow: 2px 2px 0 #0b0616;
  pointer-events: auto;
}
.radio-widget::before { display: none; }

.radio-widget__btn,
.radio-widget__name {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  text-shadow: inherit;
  cursor: pointer;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.radio-widget__btn {
  flex: none;
  min-width: 28px;
  min-height: 28px;
  display: grid;
  place-items: center;
}

.radio-widget__btn:hover,
.radio-widget__name:hover,
.radio-widget__btn:focus-visible,
.radio-widget__name:focus-visible {
  outline: none;
  color: #f2e9ff;
}

.radio-widget__name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radio-widget__dot {
  flex: none;
  width: 6px;
  height: 6px;
  background: currentColor;
  box-shadow: 2px 2px 0 #0b0616;
  animation: radio-pulse 1.2s steps(1) infinite;
}

.radio-widget__dot.off {
  animation: none;
  opacity: 0.35;
}

.radio-widget__pos {
  flex: none;
  color: var(--theme-text-muted, #b9a8d9);
}

@keyframes radio-pulse {
  50% { opacity: 0.3; }
}

@media (prefers-reduced-motion: reduce) {
  .radio-widget__dot { animation: none; }
}

.radio-widget__track {
  overflow: hidden;
  text-overflow: ellipsis;
}

.radio-widget__note { display: none; }

/* Phones: a note instead of the station's name, so the game's HUD row keeps
   the top edge; tapping the note still changes station. */
@media (max-width: 480px) {
  .radio-widget__track,
  .radio-widget__pos { display: none; }
  .radio-widget__note { display: inline; }
}
</style>
