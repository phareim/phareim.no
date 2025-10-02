<template>
  <div class="random-fact-container" @click="getRandomFact">
    <h1>Random Fact</h1>
    <p class="random-fact" v-html="randomFact"></p>
    <div v-if="isLoading" class="loading-spinner">🌀</div>
    <p class="click-hint" v-show="showHint && !isLoading">Click anywhere for a new fact! ✨</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useFetch } from '#app'

const randomFact = ref('Loading your first random fact... 🎲')
const showHint = ref(true)
const isLoading = ref(true)

const getRandomFact = async () => {
  isLoading.value = true
  const { data: newFact } = await useFetch('/api/random-fact', {
    key: Date.now().toString() // Force fresh request each time
  })
  randomFact.value = newFact.value.fact
  showHint.value = false
  isLoading.value = false
}

// Load the first fact after the page mounts
onMounted(() => {
  getRandomFact()
})

</script>

<style scoped>
h1 {
display: none;
}
.random-fact-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  cursor: pointer;
  transition: transform 0.2s ease;
  padding: 2rem;
}
.random-fact-container:hover {
  transform: scale(1.02);
}
.random-fact {
  font-size: 2.3rem;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  margin: 0;
  text-align: center;
}
.click-hint {
  margin-top: 2rem;
  font-size: 0.8rem;
  opacity: 0.6;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
.loading-spinner {
  margin-top: 2rem;
  font-size: 2rem;
  animation: spin 1s linear infinite;
  transform-origin: center;
}
@keyframes spin {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}
</style>