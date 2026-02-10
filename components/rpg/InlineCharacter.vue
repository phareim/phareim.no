<!-- InlineCharacter.vue -->
<!--
  RPG Inline Character Component

  This component displays NPCs (non-player characters) mentioned in the RPG game text.
  When the AI generates text with **character names**, this component fetches and displays them.

  NOTE: This is separate from the character gallery. These are dynamically generated NPCs
  created during gameplay, not pre-made gallery characters.
-->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useNuxtApp } from '#app'
import { doc, getDoc } from 'firebase/firestore'

interface Props {
  characterId: string,
  active: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'click', characterId: string): void,
  (e: 'action', command: string): void
}>()

const character = ref<any | null>(null)
const isLoading = ref(true)
const showActions = ref(false)

// Fetch character data from Firebase
async function fetchCharacter() {
  try {
    const { $firebase } = useNuxtApp()
    // Use rpgCharacters collection (separate from gallery characters)
    const characterDoc = doc($firebase.firestore, 'rpgCharacters', props.characterId)
    const characterSnapshot = await getDoc(characterDoc)
    
    if (characterSnapshot.exists()) {
      character.value = {
        id: characterSnapshot.id,
        ...characterSnapshot.data()
      }
    } else {
      character.value = {
        id: props.characterId,
        name: props.characterId,
        description: 'A mysterious character...',
        type: 'npc',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  } catch (error) {
    console.error('Error fetching character:', error)
    character.value = {
      id: props.characterId,
      name: props.characterId,
      description: 'A mysterious character...',
      type: 'npc',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchCharacter()
})

const handleClick = () => {
  if (props.active) {
    showActions.value = !showActions.value
  }
}

const handleAction = (action: string) => {
  if (!character.value) return
  emit('action', `${action} ${character.value.name}`)
}

// Get available actions based on character type
const availableActions = computed(() => {
  if (!character.value) return []
  
  const actions = [
    { emoji: '👀', command: 'examine', label: 'Examine' },
    { emoji: '💬', command: 'talk to', label: 'Talk to' }
  ]

  // Add type-specific actions
  if (character.value.type === 'merchant') {
    actions.push({ emoji: '🛍️', command: 'trade with', label: 'Trade' })
  }

  return actions
})
</script>

<template>
  <span class="inline-character" role="button" tabindex="0">
    <span v-if="isLoading">...</span>
    <template v-else>
      <span @click="handleClick" class="character-name">{{ character?.name }}</span>
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
.inline-character {
  color: var(--theme-rpg-character, #ff69b4);
  position: relative;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.character-name {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.character-name:hover {
  opacity: 0.8;
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