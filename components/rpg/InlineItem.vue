<!-- InlineItem.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { Item } from '~/types/item'

interface Props {
  itemId: string,
  active: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'click', itemId: string): void,
  (e: 'action', command: string): void
}>()

const item = ref<Item | null>(null)
const isLoading = ref(true)
const showActions = ref(false)

// Fetch item data from D1 via server API
async function fetchItem() {
  try {
    const response = await fetch(`/api/items/${encodeURIComponent(props.itemId)}`)
    if (response.ok) {
      const data = await response.json()
      item.value = data as Item
    } else {
      item.value = {
        id: props.itemId,
        name: props.itemId,
        description: 'A mysterious item...',
        type: 'misc',
        properties: {}
      } as Item
    }
  } catch (error) {
    console.error('Error fetching item:', error)
    item.value = {
      id: props.itemId,
      name: props.itemId,
      description: 'A mysterious item...',
      type: 'misc',
      properties: {}
    } as Item
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchItem()
})

const handleClick = () => {
  if (props.active) {
    showActions.value = !showActions.value
  }
}

const handleAction = (action: string) => {
  if (!item.value) return
  emit('action', `${action} ${item.value.name}`)
}

// Get available actions based on item type
const availableActions = computed(() => {
  if (!item.value) return []
  
  const actions = [
    { emoji: '👀', command: 'examine', label: 'Examine' },
    { emoji: '🤚', command: 'take', label: 'Take' }
  ]

  // Add type-specific actions
  switch (item.value.type) {
    case 'weapon':
      actions.push({ emoji: '⚔️', command: 'equip', label: 'Equip' })
      break
    case 'armor':
      actions.push({ emoji: '🛡️', command: 'wear', label: 'Wear' })
      break
    case 'potion':
      actions.push({ emoji: '🧪', command: 'drink', label: 'Drink' })
      break
    case 'tool':
      actions.push({ emoji: '🔧', command: 'use', label: 'Use' })
      break
    case 'key':
      actions.push({ emoji: '🔑', command: 'use', label: 'Use' })
      break
  }

  return actions
})
</script>

<template>
  <span class="inline-item" role="button" tabindex="0">
    <span v-if="isLoading">...</span>
    <template v-else>
      <span @click="handleClick" class="item-name">{{ item?.name }}</span>
      <span v-if="showActions" class="actions">
        <button 
          v-for="action in availableActions" 
          :key="action.command"
          class="action-btn"
          :title="action.label"
          @click.stop="handleAction(action.command)"
        >
          {{ action.emoji }}
        </button>
      </span>
      
    </template>
  </span>
</template>

<style scoped>
.inline-item {
  color: var(--theme-rpg-item, #ffd700);
  position: relative;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.item-name {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.item-name:hover {
  opacity: 0.8;
}

.actions {
  display: inline-flex;
  gap: 0.25rem;
  margin-left: 0.25rem;
}

.action-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.8;
  transition: transform 0.1s, opacity 0.1s;
}

.action-btn:hover {
  opacity: 1;
  transform: scale(1.2);
}
</style> 