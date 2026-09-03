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

onMounted(() => {
  document.body.classList.add('scrollable');
  document.documentElement.classList.add('scrollable');
});

onBeforeUnmount(() => {
  document.body.classList.remove('scrollable');
  document.documentElement.classList.remove('scrollable');
});
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");

body,
html {
  overflow: hidden;
  user-select: none;
  font-family: "Comfortaa", sans-serif;
  padding: 0;
  margin: 0;
}

body.scrollable,
html.scrollable {
  overflow: auto !important;
}

h1 {
  font-size: 4rem;
  font-weight: 500;
  margin: 0;
  padding: 0;
}
</style>
