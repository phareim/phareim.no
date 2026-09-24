<template>
  <div :class="themePageClass">
    <component :is="theme.backdrop" v-if="theme.backdrop" />
    <NuxtPage />
    <HomeChip />
    <!-- The portal plays its own town music (it parks the radio) and its name
      billboard sits where the widget would; the radio returns in the games. -->
    <RadioWidget v-if="!isHome" />
  </div>
</template>

<script setup lang="ts">
const { theme, isHome, themePageClass, themeColor } = useTheme()
useThemeNavigation()

// The portal carries the site's name; a game names itself, so history and
// tabs read "Galaga — phareim.no". Description and og tags: nuxt.config.ts.
useHead({
  title: computed(() => isHome.value ? 'Petter Hareim — phareim.no' : `${theme.value.name} — phareim.no`),
  meta: [
    { name: 'theme-color', content: themeColor }
  ]
})

</script>

<style>
/* The document never scrolls (2026-09-05): every landing is locked to the
   viewport. Since 2026-09-07 the site is landings only — the three content
   routes that needed an inner scroller are gone. */
html,
body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  /* No double-tap zoom (Safari ignores user-scalable=no); pinch still works outside the games. */
  touch-action: manipulation;
  user-select: none;
  font-family: var(--font-person, system-ui, sans-serif);
  font-weight: 300;
  padding: 0;
  margin: 0;
}

#__nuxt {
  height: 100%;
  overflow: hidden;
}

h1 {
  font-size: 4rem;
  font-weight: 300;
  letter-spacing: -0.01em;
  margin: 0;
  padding: 0;
}
</style>
