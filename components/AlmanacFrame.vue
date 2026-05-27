<template>
  <article class="almanac-frame">
    <header class="almanac-frame__header">
      <NuxtLink v-if="back" :to="back" class="almanac-frame__back">← {{ backLabel }}</NuxtLink>
      <h1 class="almanac-frame__title">
        <span class="almanac-frame__glyph" aria-hidden="true">◐</span>
        {{ title }}
      </h1>
      <p v-if="kicker" class="almanac-frame__kicker">{{ kicker }}</p>
      <hr class="almanac-frame__rule" />
    </header>
    <section class="almanac-frame__body">
      <slot />
    </section>
    <footer v-if="$slots.footer" class="almanac-frame__footer">
      <hr class="almanac-frame__rule" />
      <slot name="footer" />
    </footer>
  </article>
</template>

<script setup lang="ts">
// One defineProps call. All four props declared together.
withDefaults(
  defineProps<{
    title: string
    kicker?: string
    back?: string
    backLabel?: string
  }>(),
  { backLabel: 'back to almanac' }
)
</script>

<style scoped>
.almanac-frame {
  max-width: 64ch;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
  font-family: 'Source Serif 4', Georgia, serif;
  color: var(--theme-text, #1a1a1a);
}
.almanac-frame__back {
  display: inline-block;
  margin-bottom: 2rem;
  font-size: 0.85rem;
  letter-spacing: 0.02em;
  color: var(--theme-text-muted, #555);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}
.almanac-frame__back:hover {
  color: var(--theme-accent, #c14a2a);
}
.almanac-frame__title {
  font-family: 'Source Serif 4', Georgia, serif;
  font-weight: 400;
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.01em;
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}
.almanac-frame__glyph {
  color: var(--theme-accent, #c14a2a);
  font-size: 0.7em;
  line-height: 1;
  /* The moon glyph is the only consistent accent appearance per page — Almanac's
     "one accent at the moment of attention" rule. Do not use the accent color
     elsewhere in the page chrome. */
}
.almanac-frame__kicker {
  margin: 0.5rem 0 0;
  font-style: italic;
  color: var(--theme-text-muted, #555);
}
.almanac-frame__rule {
  border: 0;
  border-top: 1px solid var(--theme-card-border, rgba(0,0,0,0.15));
  margin: 1.5rem 0 2rem;
}
.almanac-frame__footer {
  margin-top: 4rem;
  font-size: 0.85rem;
  color: var(--theme-text-muted, #555);
}
</style>
