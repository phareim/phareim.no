<!-- InlineItem.vue -->
<script setup lang="ts">
import type { Item } from '~/types/item'

interface Props {
  itemId: string,
  items: Record<string, Item>,
  active: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'click', itemId: string): void
}>()

const item = computed(() => props.items[props.itemId] || { 
  name: props.itemId,
  description: 'A mysterious item...',
  properties: {}
})

const handleClick = () => {
  if (props.active) {
    emit('click', props.itemId)
  }
}
</script>

<template>
  <span class="inline-item" @click="handleClick" role="button" tabindex="0">
    {{ item.name }}
    <div class="item-tooltip">
      <strong>{{ item.name }}</strong>
      <p>{{ item.description }}</p>
      <ul v-if="Object.keys(item.properties).length > 0">
        <li v-for="(value, key) in item.properties" :key="key">
          {{ key }}: {{ value }}
        </li>
      </ul>
    </div>
  </span>
</template>

<style scoped>
.inline-item {
  color: #ffd700;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  position: relative;
}

.inline-item:hover {
  color: #ffed4a;
}

.item-tooltip {
  position: absolute;
  background: #333;
  color: #fff;
  padding: 0.5rem;
  border-radius: 4px;
  width: 250px;
  z-index: 100;
  top: 100%;
  left: 50%; 
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.inline-item:hover .item-tooltip {
  opacity: 1;
}
</style> 