<template>
  <div class="stage-landing">
    <ClientOnly>
      <ViewStage />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
/**
 * The view stage (`/?theme=stage`): the studio shows this page in a frame and
 * drives it (ViewStage.vue). A landing imports no game: the stage is its own chunk.
 */
const ViewStage = defineAsyncComponent(() => import('./ViewStage.vue'))
</script>

<style>
.stage-landing {
  position: relative;
  width: 100%;
  height: var(--app-height, 100dvh);
  overflow: hidden;
}
</style>
