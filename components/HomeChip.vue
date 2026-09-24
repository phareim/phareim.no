<template>
  <button
    v-if="!isHome && !navigationBlocked"
    class="theme-home"
    title="Back to the portal (Esc)"
    aria-label="Back to the portal"
    @click="goHome"
  >
    <!-- ⌂ drawn as strokes, so it glows in any font. -->
    <svg class="theme-home__glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 11.5 12 4l8.5 7.5M6.5 9.5V20h11V9.5M10 20v-5.5h4V20" />
    </svg>
  </button>
</template>

<script setup lang="ts">
/**
 * The only site chrome in a game: the way back to the portal. There is no
 * pager (chevrons, dots, swipes and arrow keys went 2026-09-24); another
 * game is reached by walking out and into its cabinet.
 */
const { isHome, goHome, navigationBlocked } = useTheme()
</script>

<style scoped>
/* Bottom-right: the one corner no game uses (radio top-right, sound toggle
   bottom-left, titles and labels top-left; checked at 375×667 and 1280×800,
   2026-09-24). Gone while a game owns the controls. */
.theme-home {
  position: fixed;
  z-index: 50;
  right: max(0.5rem, env(safe-area-inset-right));
  bottom: calc(max(0.9rem, var(--app-safe-bottom, 0px)) - 0.45rem);
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  color: var(--theme-accent, currentColor);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

.theme-home__glyph {
  width: 1.35rem;
  height: 1.35rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.7;
  filter:
    drop-shadow(0 0 3px color-mix(in srgb, var(--theme-accent, #fff) 90%, transparent))
    drop-shadow(0 0 10px color-mix(in srgb, var(--theme-accent, #fff) 55%, transparent));
  transition: opacity 0.25s ease, filter 0.25s ease, color 0.25s ease;
}

.theme-home:hover .theme-home__glyph,
.theme-home:focus-visible .theme-home__glyph,
.theme-home:active .theme-home__glyph {
  opacity: 1;
  color: #fff;
  filter:
    drop-shadow(0 0 4px color-mix(in srgb, var(--theme-accent, #fff) 95%, transparent))
    drop-shadow(0 0 14px color-mix(in srgb, var(--theme-accent, #fff) 80%, transparent))
    drop-shadow(0 0 30px color-mix(in srgb, var(--theme-accent, #fff) 50%, transparent));
}

.theme-home:focus-visible { outline: none; }
</style>
