<template>
  <!-- Owns the page: the Tetris cabinet over the Neon Dreams horizon. The
    profile column was removed 2026-09-07 — Player One carries the person,
    this theme is only the game. -->
  <div class="tetris-landing">
    <Horizon ref="horizon" />
    <Arcade @beat="horizon?.beat($event)" />
  </div>
</template>

<script setup lang="ts">
import Arcade from './Arcade.vue'
import Horizon from './Horizon.vue'
const horizon = ref<InstanceType<typeof Horizon> | null>(null)
// The game itself owns navigationLocked while a run is active; reset here too
// so a mid-run theme switch never leaves the shell locked.
const { navigationLocked } = useTheme()
onBeforeUnmount(() => { navigationLocked.value = false })
</script>

<style scoped>
.tetris-landing { position: relative; isolation: isolate; height: 100dvh; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(54px, calc(42px + env(safe-area-inset-bottom))) max(16px, env(safe-area-inset-left)); }
/* The cabinet keeps the desktop sizing it was tuned for: at ≥900px it is a
   row with one item, and Arcade.vue caps itself at 780px tall. */
@media (min-width: 900px) { .tetris-landing { flex-direction: row; justify-content: center; padding-top: 24px; } }
@media (max-height: 480px) { .tetris-landing { padding-top: 6px; gap: 4px; } }
</style>
