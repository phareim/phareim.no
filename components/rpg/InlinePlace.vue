<!-- InlinePlace.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useNuxtApp } from '#app'
import { doc, getDoc } from 'firebase/firestore'

interface Props {
  placeId: string,
  active: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'click', placeId: string): void,
  (e: 'action', command: string): void
}>()

const place = ref<any | null>(null)
const isLoading = ref(true)
const showActions = ref(false)

// Fetch place data from Firebase
async function fetchPlace() {
  try {
    const { $firebase } = useNuxtApp()
    const placeDoc = doc($firebase.firestore, 'places', props.placeId)
    const placeSnapshot = await getDoc(placeDoc)
    
    if (placeSnapshot.exists()) {
      place.value = {
        id: placeSnapshot.id,
        ...placeSnapshot.data()
      }
    } else {
      place.value = {
        id: props.placeId,
        name: props.placeId,
        description: 'A mysterious place...',
        type: 'location',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  } catch (error) {
    console.error('Error fetching place:', error)
    place.value = {
      id: props.placeId,
      name: props.placeId,
      description: 'A mysterious place...',
      type: 'location',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchPlace()
})

const handleClick = () => {
  if (props.active) {
    showActions.value = !showActions.value
  }
}

const handleAction = (action: string) => {
  if (!place.value) return
  emit('action', `${action} ${place.value.name}`)
}

// Get available actions based on place type
const availableActions = computed(() => {
  if (!place.value) return []
  
  const actions = [
    { emoji: '👀', command: 'examine', label: 'Examine' },
    { emoji: '🚶', command: 'go to', label: 'Go to' }
  ]

  // Add type-specific actions
  if (place.value.type === 'shop') {
    actions.push({ emoji: '🛍️', command: 'enter', label: 'Enter Shop' })
  } else if (place.value.type === 'dungeon') {
    actions.push({ emoji: '⚔️', command: 'enter', label: 'Enter Dungeon' })
  }

  return actions
})
</script>

<template>
  <span class="inline-place" role="button" tabindex="0">
    <span v-if="isLoading">...</span>
    <template v-else>
      <span @click="handleClick" class="place-name">{{ place?.name }}</span>
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
.inline-place {
  color: #98fb98;
  position: relative;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.place-name {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.place-name:hover {
  color: #b3fdb3;
  font-weight: bold;
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