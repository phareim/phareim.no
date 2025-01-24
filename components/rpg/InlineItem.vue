<!-- InlineItem.vue -->
<script setup lang="ts">
interface Props {
  name: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'click', name: string): void
}>()

const handleClick = () => {
  emit('click', props.name)
}
</script>

<template>
  <span class="inline-item" @click="handleClick" role="button" tabindex="0">
    {{ name }}
  </span>
</template>

<style scoped>
.inline-item {
  color: #ffd700;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.inline-item:hover {
  color: #ffed4a;
}
</style> 