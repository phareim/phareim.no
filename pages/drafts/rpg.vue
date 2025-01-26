<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useNuxtApp } from '#app'
import TextWindow from '~/components/rpg/TextWindow.vue'

const messageWindow = ref<HTMLElement | null>(null)
const gameMessages = ref<string[]>([])
const commandInput = ref('')
const commandHistory = ref<string[]>([])
const historyIndex = ref(-1)
const isLoading = ref(false)

const handleKeyDown = async (event: KeyboardEvent) => {
  if (isLoading.value) return

  if (event.key === 'Enter' && commandInput.value.trim()) {
    // Handle command submission
    const command = commandInput.value.trim()
    commandHistory.value.push(command)
    historyIndex.value = -1
    commandInput.value = ''
    
    // Process command...
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (historyIndex.value < commandHistory.value.length - 1) {
      historyIndex.value++
      commandInput.value = commandHistory.value[commandHistory.value.length - 1 - historyIndex.value]
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (historyIndex.value > -1) {
      historyIndex.value--
      commandInput.value = historyIndex.value >= 0 
        ? commandHistory.value[commandHistory.value.length - 1 - historyIndex.value]
        : ''
    }
  }
}

const handleAction = (command: string) => {
  if (isLoading.value) return
  commandInput.value = command
}
</script>

<template>
  <div class="rpg-container">
    <div class="game-window">
      <div class="message-window" ref="messageWindow">
        <div v-for="(message, index) in gameMessages" :key="index" class="message">
          <TextWindow 
            :text="message" 
            :active="!isLoading" 
            @action="handleAction"
          />
        </div>
      </div>
      <div class="input-pane">
        <input
          v-model="commandInput"
          type="text"
          @keydown="handleKeyDown"
          :disabled="isLoading"
          placeholder="Type your command..."
          class="command-input"
        />
        <div v-if="isLoading" class="loading-indicator">...</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rpg-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.game-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.message-window {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.message {
  margin-bottom: 1rem;
}

.input-pane {
  position: relative;
  display: flex;
  align-items: center;
}

.command-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: none;
  padding: 0.5rem 1rem;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  border-radius: 4px;
}

.command-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-indicator {
  position: absolute;
  right: 1rem;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
}
</style> 
