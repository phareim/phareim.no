<template>
  <!-- Lag Din Figur: the page is the studio. The studio (renderers, panels,
    the drawing board) is its own chunk, loaded on the client only, so the
    site's entry stays small. SSR paints the lilac and the name. -->
  <div class="fg-page">
    <ClientOnly>
      <FigurGame />
      <template #fallback>
        <p class="fg-loading">LAG DIN FIGUR</p>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const FigurGame = defineAsyncComponent(() => import('./Game.vue'))
</script>

<style scoped>
.fg-page {
  position: relative;
  width: 100%;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  background: var(--figur-bg, #f6d8ff);
}
.fg-loading {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: var(--font-pixel);
  font-size: 48px;
  color: #ffffff;
  text-shadow: 6px 6px 0 var(--figur-ink, #2a1744);
  -webkit-font-smoothing: none;
}
@media (max-width: 520px) {
  .fg-loading { font-size: 32px; text-shadow: 4px 4px 0 var(--figur-ink, #2a1744); }
}
</style>
