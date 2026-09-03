<template>
  <Transition name="theme-swap" mode="out-in">
    <component :is="theme.landing" :key="theme.id" />
  </Transition>
</template>

<script setup lang="ts">
const { theme } = useTheme()

// The landing page fills the viewport and never scrolls.
onMounted(() => {
  document.body.classList.remove('scrollable')
  document.documentElement.classList.remove('scrollable')
})

onBeforeUnmount(() => {
  document.body.classList.add('scrollable')
  document.documentElement.classList.add('scrollable')
})
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
