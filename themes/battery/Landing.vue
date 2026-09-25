<template>
  <!-- Night of the Dead Battery: the page is the game. The game (engine,
    content, art, score) is its own chunk, loaded on the client only, so the
    site's entry stays small. SSR paints the dark page and the title text. -->
  <div class="nb-page">
    <ClientOnly>
      <BatteryGame />
      <template #fallback>
        <p class="nb-loading">NIGHT OF THE DEAD BATTERY</p>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const BatteryGame = defineAsyncComponent(() => import('./Game.vue'))
</script>

<style scoped>
.nb-page {
  position: relative;
  width: 100%;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  background: #07040d;
}
.nb-loading {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-pixel);
  font-size: 16px;
  color: rgba(199, 166, 255, 0.5);
}
</style>
