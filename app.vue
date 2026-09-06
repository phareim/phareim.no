<template>
  <div :class="themePageClass">
    <component :is="theme.backdrop" v-if="theme.backdrop" />
    <NuxtPage />
    <ThemePager />
  </div>
</template>

<script setup lang="ts">
const { theme, themePageClass, themeColor } = useTheme()
useThemeNavigation()

useHead({
  meta: [
    { name: 'theme-color', content: themeColor }
  ]
})

</script>

<style>
/* The document never scrolls (2026-09-05): every landing is locked to the
   viewport, and a route with more content than fits scrolls inside its own
   `.page-scroll` container instead. */
html,
body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
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

.page-scroll {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

h1 {
  font-size: 4rem;
  font-weight: 300;
  letter-spacing: -0.01em;
  margin: 0;
  padding: 0;
}
</style>
