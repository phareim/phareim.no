<!-- TextWindow.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import InlineItem from './InlineItem.vue'
import InlineCharacter from './InlineCharacter.vue'
import InlinePlace from './InlinePlace.vue'

interface Props {
  text: string,
  active: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'itemClick', name: string): void
  (e: 'characterClick', name: string): void
  (e: 'placeClick', name: string): void
  (e: 'action', command: string): void
}>()

// Function to parse special items in text
const parsedContent = computed(() => {
  if (!props.text) return []
  
  // Split text into segments, preserving special markers
  return props.text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*)/g).map((segment, index) => {
    if (segment.startsWith('***') && segment.endsWith('***')) {
      // Place (***place***)
      return {
        type: 'place',
        content: segment.slice(3, -3),
        key: `place-${index}`
      }
    } else if (segment.startsWith('**') && segment.endsWith('**')) {
      // Character (**character**)
      return {
        type: 'character',
        content: segment.slice(2, -2),
        key: `character-${index}`
      }
    } else if (segment.startsWith('*') && segment.endsWith('*')) {
      // Item (*item*)
      return {
        type: 'item',
        content: segment.slice(1, -1),
        key: `item-${index}`
      }
    } else {
      // Regular text
      return {
        type: 'text',
        content: segment,
        key: `text-${index}`
      }
    }
  })
})

const handleItemClick = (name: string) => {
  emit('itemClick', name)
}

const handleCharacterClick = (name: string) => {
  emit('characterClick', name)
}

const handlePlaceClick = (name: string) => {
  emit('placeClick', name)
}

const handleAction = (command: string) => {
  emit('action', command)
}
</script>

<template>
  <div class="text-window">
    <div class="text-content">
      <template v-for="segment in parsedContent" :key="segment.key">
        <!-- Regular text -->
        <span v-if="segment.type === 'text'" class="text-segment">
          {{ segment.content }}
        </span>
        
        <!-- Items -->
        <InlineItem
          v-else-if="segment.type === 'item'"
          :itemId="segment.content"
          :active="props.active"
          @click="handleItemClick"
          @action="handleAction"
        />
        
        <!-- Characters -->
        <InlineCharacter
          v-else-if="segment.type === 'character'"
          :characterId="segment.content"
          :active="props.active"
          @click="handleCharacterClick"
          @action="handleAction"
        />
        
        <!-- Places -->
        <InlinePlace
          v-else-if="segment.type === 'place'"
          :placeId="segment.content"
          :active="props.active"
          @click="handlePlaceClick"
          @action="handleAction"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.text-window {
  font-family: var(--theme-font-body, monospace);
  background-color: var(--theme-rpg-terminal-bg, #000000);
  color: var(--theme-rpg-terminal-text, #e0e0e0);
  padding: 1rem;
  border-radius: var(--theme-card-radius, 4px);
  max-height: 400px;
  overflow-y: auto;
}

.text-content {
  line-height: 1.5;
  white-space: pre-wrap;
}

.item-segment {
  color: var(--theme-rpg-item, #ffd700);
  cursor: pointer;
}

.character-segment {
  color: var(--theme-rpg-character, #ff69b4);
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.character-segment:hover {
  opacity: 0.8;
  font-weight: bold;
}

.place-segment {
  color: var(--theme-rpg-place, #98fb98);
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.place-segment:hover {
  opacity: 0.8;
  font-weight: bold;
}
</style> 