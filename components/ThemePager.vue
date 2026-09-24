<template>
  <div v-if="!isHome" class="theme-pager" aria-label="Theme">
    <button
      v-if="!navigationBlocked"
      class="theme-home"
      title="Back to the portal (Esc)"
      aria-label="Back to the portal"
      @click="goHome"
    >
      <!-- ⌂ drawn as strokes, so it glows like the chevrons in any font. -->
      <svg class="theme-home__glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 11.5 12 4l8.5 7.5M6.5 9.5V20h11V9.5M10 20v-5.5h4V20" />
      </svg>
    </button>
    <button
      v-if="!navigationBlocked"
      class="theme-arrow theme-arrow--prev"
      :title="`← ${neighbour(-1).name}`"
      aria-label="Previous theme"
      @click="previousTheme"
    ><span class="theme-arrow__glyph" aria-hidden="true" /></button>
    <button
      v-if="!navigationBlocked"
      class="theme-arrow theme-arrow--next"
      :title="`${neighbour(1).name} →`"
      aria-label="Next theme"
      @click="nextTheme"
    ><span class="theme-arrow__glyph" aria-hidden="true" /></button>
    <div class="theme-dots" role="tablist">
      <button
        v-for="t in themes"
        :key="t.id"
        class="theme-dot"
        :class="{ active: t.id === activeTheme }"
        role="tab"
        :aria-selected="t.id === activeTheme"
        :disabled="navigationBlocked"
        :title="t.name"
        :aria-label="t.name"
        @click="setTheme(t.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const { themes, activeTheme, isHome, setTheme, nextTheme, previousTheme, goHome, navigationBlocked } = useTheme()

// Same walk as useTheme's step: from a parked theme, the first or last game.
const neighbour = (delta: number) => {
  const i = themes.findIndex(t => t.id === activeTheme.value)
  if (i < 0) return themes[delta > 0 ? 0 : themes.length - 1]
  return themes[(i + delta + themes.length) % themes.length]
}
</script>

<style scoped>
.theme-pager {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  color: var(--theme-text, #333);
}

.theme-arrow,
.theme-home,
.theme-dot {
  pointer-events: auto;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

/* Edge arrows: on every device (touch users can still swipe). A theme that
   owns horizontal input locks navigation, and then they are gone.
   Neon: the glyph glows in the theme accent and breathes; hovering — or a
   tap — lights up the whole edge. */
.theme-arrow {
  display: grid;
  place-items: center;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 5.5rem;
  height: 9rem;
  color: var(--theme-accent, currentColor);
  transition: opacity 0.25s ease;
}

/* The edge wash — dark until you come near it. */
.theme-arrow::before {
  content: '';
  position: absolute;
  inset: -1rem -2rem;
  opacity: 0;
  transition: opacity 0.3s ease;
  background: radial-gradient(
    ellipse at var(--edge, 0%) 50%,
    color-mix(in srgb, var(--theme-accent, #fff) 28%, transparent) 0%,
    transparent 70%
  );
}

/* The chevron itself: two borders on a rotated square, so it stays crisp at
   any size and the glow follows the stroke (drop-shadow, not box-shadow). */
.theme-arrow__glyph {
  position: relative;
  display: block;
  width: 2rem;
  height: 2rem;
  border-top: 3.5px solid currentColor;
  border-right: 3.5px solid currentColor;
  border-radius: 3px;
  opacity: 0.7;
  filter:
    drop-shadow(0 0 3px color-mix(in srgb, var(--theme-accent, #fff) 90%, transparent))
    drop-shadow(0 0 10px color-mix(in srgb, var(--theme-accent, #fff) 60%, transparent))
    drop-shadow(0 0 26px color-mix(in srgb, var(--theme-accent, #fff) 35%, transparent));
  animation: theme-arrow-breathe 3.4s ease-in-out infinite;
  transition: opacity 0.25s ease, filter 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
}

.theme-arrow--prev { left: 0.25rem; --edge: 0%; }
.theme-arrow--next { right: 0.25rem; --edge: 100%; }
.theme-arrow--prev .theme-arrow__glyph { transform: rotate(-135deg) translate(-0.15rem, 0.15rem); }
.theme-arrow--next .theme-arrow__glyph { transform: rotate(45deg) translate(-0.15rem, 0.15rem); }
.theme-arrow--next .theme-arrow__glyph { animation-delay: -1.7s; }

.theme-arrow:hover .theme-arrow__glyph,
.theme-arrow:focus-visible .theme-arrow__glyph,
.theme-arrow:active .theme-arrow__glyph {
  opacity: 1;
  animation-play-state: paused;
  border-color: #fff;
  filter:
    drop-shadow(0 0 4px color-mix(in srgb, var(--theme-accent, #fff) 95%, transparent))
    drop-shadow(0 0 14px color-mix(in srgb, var(--theme-accent, #fff) 85%, transparent))
    drop-shadow(0 0 34px color-mix(in srgb, var(--theme-accent, #fff) 60%, transparent))
    drop-shadow(0 0 70px color-mix(in srgb, var(--theme-accent, #fff) 40%, transparent));
}

.theme-arrow--prev:hover .theme-arrow__glyph,
.theme-arrow--prev:focus-visible .theme-arrow__glyph,
.theme-arrow--prev:active .theme-arrow__glyph {
  transform: rotate(-135deg) translate(0.05rem, -0.05rem);
}
.theme-arrow--next:hover .theme-arrow__glyph,
.theme-arrow--next:focus-visible .theme-arrow__glyph,
.theme-arrow--next:active .theme-arrow__glyph {
  transform: rotate(45deg) translate(0.05rem, -0.05rem);
}

.theme-arrow:hover::before,
.theme-arrow:focus-visible::before,
.theme-arrow:active::before { opacity: 1; }

.theme-arrow:focus-visible { outline: none; }

@keyframes theme-arrow-breathe {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.95; }
}

@media (prefers-reduced-motion: reduce) {
  .theme-arrow__glyph { animation: none; opacity: 0.75; }
}

/* Touch: smaller chevrons closer to the edge, so they stay out of the way of
   a landing that fills a phone viewport. The hit box stays thumb-sized. */
@media (hover: none), (pointer: coarse) {
  .theme-arrow {
    width: 3.25rem;
    height: 7rem;
  }

  .theme-arrow--prev { left: 0; }
  .theme-arrow--next { right: 0; }

  .theme-arrow__glyph {
    width: 1.5rem;
    height: 1.5rem;
    border-width: 3px;
  }
}

/* Home chip: back to the portal. Bottom-right, on the dots' baseline — the
   one corner no game uses (radio top-right, sound toggle bottom-left, titles
   and labels top-left; checked at 375×667 and 1280×800, 2026-09-24). Gone
   while a game owns the controls, like the chevrons. */
.theme-home {
  position: absolute;
  right: max(0.5rem, env(safe-area-inset-right));
  bottom: calc(max(0.9rem, env(safe-area-inset-bottom)) - 0.45rem);
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  color: var(--theme-accent, currentColor);
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

.theme-dots {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(0.9rem, env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.theme-dot {
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  opacity: 0.35;
  transition: opacity 0.2s ease;
}

.theme-dot::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.theme-dot.active { opacity: 0.85; }

/* Phones: a tighter row, so eleven dots clear the home chip at 375 px. */
@media (max-width: 420px) {
  .theme-dots { gap: 0.25rem; }
  .theme-dot { width: 1.3rem; }
}
.theme-dot:hover,
.theme-dot:focus-visible { opacity: 0.85; outline: none; }
</style>
