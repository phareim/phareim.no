<template>
  <Transition name="theme-swap" mode="out-in">
    <component :is="theme.landing" :key="theme.id" />
  </Transition>
</template>

<script setup lang="ts">
const { theme } = useTheme()

// Most landings fill the viewport and never scroll; a theme marked
// `scrollable` in the registry (Almanac) keeps the page scrollable.
const applyScroll = (scrollable: boolean) => {
  const method = scrollable ? 'add' : 'remove'
  document.body.classList[method]('scrollable')
  document.documentElement.classList[method]('scrollable')
}

onMounted(() => applyScroll(!!theme.value.scrollable))
watch(() => theme.value.scrollable, (s: boolean | undefined) => applyScroll(!!s))
onBeforeUnmount(() => applyScroll(true))
</script>

<style>
.theme-swap-enter-active,
.theme-swap-leave-active {
  transition: opacity 0.18s ease;
}

.theme-swap-enter-from,
.theme-swap-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .theme-swap-enter-active,
  .theme-swap-leave-active {
    transition: none;
  }
}
</style>
