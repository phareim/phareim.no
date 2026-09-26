<template>
  <img
    class="fg-icon"
    :src="src"
    :width="size.w * scale"
    :height="size.h * scale"
    alt=""
    aria-hidden="true"
    draggable="false"
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { icon, iconSize, type IconId } from './icons'

const props = withDefaults(defineProps<{ id: IconId; scale?: number; grey?: boolean }>(), { scale: 3, grey: false })
const src = computed(() => icon(props.id, props.grey))
const size = computed(() => iconSize(props.id))
</script>

<style scoped>
.fg-icon {
  display: block;
  image-rendering: pixelated;
  flex: none;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
</style>
