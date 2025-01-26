<!-- TextWindow.vue -->
<script setup lang="ts">
import InlineItem from './InlineItem.vue'

interface Props {
  text: string,
  active: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'itemClick', name: string): void
  (e: 'characterClick', name: string): void
  (e: 'placeClick', name: string): void
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
          @click="handleItemClick"
          :active="props.active"
        />
        
        <!-- Characters -->
        <span 
          v-else-if="segment.type === 'character'" 
          class="character-segment"
          @click="props.active ? handleCharacterClick(segment.content) : null"
          role="button"
          tabindex="0"
        >
          {{ segment.content }}
        </span>
        
        <!-- Places -->
        <span 
          v-else-if="segment.type === 'place'" 
          class="place-segment"
          @click="props.active ? handlePlaceClick(segment.content) : null"
          role="button"
          tabindex="0"
        >
          {{ segment.content }}
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.text-window {
  font-family: monospace;
  background-color: #000000;
  color: #e0e0e0;
  padding: 1rem;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.text-content {
  line-height: 1.5;
  white-space: pre-wrap;
}

.item-segment {
  color: #ffd700; /* Gold for items */
  cursor: pointer;
}

.character-segment {
  color: #ff69b4; /* Pink for characters */
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.character-segment:hover {
  color: #ff9dc9;
  font-weight: bold;
}

.place-segment {
  color: #98fb98; /* Pale green for places */
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.place-segment:hover {
  color: #b3fdb3;
  font-weight: bold;
}
</style> 