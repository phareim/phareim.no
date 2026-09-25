<template>
  <button
    v-if="!isHome && !navigationBlocked"
    class="theme-home"
    title="Back to the portal (Esc)"
    aria-label="Back to the portal"
    @click="goHome"
  >
    <!-- ⌂ as a pixel sprite (a house with a door), crisp at any scale. -->
    <svg class="theme-home__glyph" viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true">
      <path d="M4 0h1v1h1v1h1v1h1v1h1v1H8v3H5V5H4v3H1V5H0V4h1V3h1V2h1V1h1z" />
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
   2026-09-24). Gone while a game owns the controls. The house is a 9×8 pixel
   sprite at 3 CSS px per pixel with the pixel look's hard shadow. */
.theme-home {
  position: fixed;
  z-index: 50;
  right: max(0.5rem, env(safe-area-inset-right));
  bottom: calc(max(0.9rem, var(--app-safe-bottom, 0px)) - 0.45rem);
  width: 2.75rem;
  height: 2.75rem;
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
  width: 27px;
  height: 24px;
  fill: currentColor;
  opacity: 0.8;
  filter: drop-shadow(3px 3px 0 #0b0616);
}

.theme-home:hover .theme-home__glyph,
.theme-home:focus-visible .theme-home__glyph,
.theme-home:active .theme-home__glyph {
  opacity: 1;
  color: #f2e9ff;
}

.theme-home:focus-visible { outline: none; }
</style>
