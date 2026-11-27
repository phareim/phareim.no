<!-- DEV MODE's line along the top of the screen (`devMode.ts`): an element over the canvas, so it costs the game's
  painter nothing. No plate, no outline: it must not draw the eye in a picture of the game. -->
<template>
  <div class="zelda-dev" aria-hidden="true">{{ text }}</div>
</template>

<script setup lang="ts">
import { STRIP_H } from './devMode'

defineProps<{ text: string }>()
const height = `${STRIP_H}px`
</script>

<style scoped>
.zelda-dev {
  position: absolute;
  left: 0;
  right: 0;
  top: env(safe-area-inset-top, 0px);
  z-index: 4;
  height: v-bind(height);
  line-height: v-bind(height);
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  /* The site's smallest face: one CSS px to a pixel of the lettering. The lilac at a third of its strength. */
  font-family: var(--font-pixel);
  font-size: 8px;
  font-weight: 400;
  -webkit-font-smoothing: none;
  color: rgba(185, 168, 217, 0.34);
}
</style>
