<template>
  <div class="theme-pager" aria-label="Theme">
    <button
      class="theme-arrow theme-arrow--prev"
      :title="`← ${neighbour(-1).name}`"
      aria-label="Previous theme"
      @click="previousTheme"
    >‹</button>
    <button
      class="theme-arrow theme-arrow--next"
      :title="`${neighbour(1).name} →`"
      aria-label="Next theme"
      @click="nextTheme"
    >›</button>
    <div class="theme-dots" role="tablist">
      <button
        v-for="t in themes"
        :key="t.id"
        class="theme-dot"
        :class="{ active: t.id === activeTheme }"
        role="tab"
        :aria-selected="t.id === activeTheme"
        :title="t.name"
        :aria-label="t.name"
        @click="setTheme(t.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const { themes, activeTheme, setTheme, nextTheme, previousTheme } = useTheme()

const neighbour = (delta: number) => {
  const i = themes.findIndex(t => t.id === activeTheme.value)
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
.theme-dot {
  pointer-events: auto;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}

/* Edge arrows: only on devices with a hover pointer; touch users swipe. */
.theme-arrow {
  display: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 3rem;
  height: 6rem;
  font-size: 2.2rem;
  line-height: 1;
  opacity: 0.18;
  transition: opacity 0.2s ease;
}

.theme-arrow--prev { left: 0.5rem; }
.theme-arrow--next { right: 0.5rem; }

.theme-arrow:hover,
.theme-arrow:focus-visible {
  opacity: 0.8;
  outline: none;
}

@media (hover: hover) and (pointer: fine) {
  .theme-arrow { display: block; }
}

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
.theme-dot:hover,
.theme-dot:focus-visible { opacity: 0.85; outline: none; }
</style>
