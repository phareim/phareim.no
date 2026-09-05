<template>
  <Transition name="theme-swap" mode="out-in">
    <component :is="theme.landing" :key="theme.id" />
  </Transition>
</template>

<script setup lang="ts">
const { theme } = useTheme()
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
