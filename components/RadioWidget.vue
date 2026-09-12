<template>
  <div class="radio-widget" role="status" aria-label="Music radio">
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
    ><span class="radio-widget__dot" :class="{ off: muted }" aria-hidden="true" />{{ muted ? 'MUTED' : trackName }}</button>
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
.radio-widget {
  position: fixed;
  top: max(0.6rem, env(safe-area-inset-top));
  right: 0.6rem;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  max-width: min(62vw, 340px);
  padding: 0.32rem 0.55rem;
  font-family: var(--font-machine, monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--theme-accent, #2ff3ff);
  background: rgba(11, 6, 22, 0.62);
  border: 1px solid color-mix(in srgb, var(--theme-accent, #ff2fa0) 35%, transparent);
  border-radius: 4px;
  pointer-events: auto;
  opacity: 0.9;
}

.radio-widget__btn,
.radio-widget__name {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.radio-widget__btn {
  min-width: 1.6rem;
  min-height: 1.6rem;
  display: grid;
  place-items: center;
  opacity: 0.85;
}

.radio-widget__btn:hover,
.radio-widget__name:hover {
  opacity: 1;
  color: #fff;
}

.radio-widget__name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 0 8px color-mix(in srgb, currentColor 65%, transparent);
}

.radio-widget__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
  animation: radio-pulse 1.6s ease-in-out infinite;
}

.radio-widget__dot.off {
  animation: none;
  opacity: 0.35;
  box-shadow: none;
}

.radio-widget__pos {
  flex: none;
  opacity: 0.55;
  font-size: 9px;
}

@keyframes radio-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .radio-widget__dot { animation: none; }
}
</style>
