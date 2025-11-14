<template>
  <div class="inspire-container" :style="backgroundStyle">
    <button
      class="generate-button"
      :class="{ 'loading': isLoading }"
      @click="generateImage"
      :disabled="isLoading"
    >
      <svg
        class="arrow-icon"
        :class="{ 'spinning': isLoading }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
      </svg>
    </button>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const route = useRoute()
const isLoading = ref(false)
const currentImageUrl = ref<string | null>(null)
const error = ref<string | null>(null)

const { getRandomPrompt } = useImagePrompts()

// Get category from URL query params
const category = computed(() => route.query.category as string | undefined)

const backgroundStyle = computed(() => {
  if (currentImageUrl.value) {
    return {
      backgroundImage: `url(${currentImageUrl.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }
  }
  return {}
})

async function generateImage() {
  isLoading.value = true
  error.value = null

  try {
    // Step 1: Fetch a random prompt (automatically handles auth)
    const promptData = await getRandomPrompt(category.value)

    // Step 2: Get screen dimensions
    const width = window.innerWidth
    const height = window.innerHeight

    // Step 3: Start image generation job
    const startResponse = await fetch('/api/generate-krea-image/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basePrompt: promptData.prompt,
        width,
        height
      })
    })

    const startData = await startResponse.json()

    if (startData.error) {
      throw new Error(startData.error)
    }

    const jobId = startData.jobId

    // Step 4: Poll for job completion
    await pollJobStatus(jobId)
  } catch (e: any) {
    error.value = e.message || 'Failed to generate image'
    console.error('Error generating image:', e)
  } finally {
    isLoading.value = false
  }
}

async function pollJobStatus(jobId: string) {
  const maxAttempts = 120 // 2 minutes max (polling every 1 second)
  let attempts = 0

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(`/api/generate-krea-image/status/${jobId}`)
    const statusData = await statusResponse.json()

    if (statusData.error && statusData.status === 404) {
      throw new Error('Job not found')
    }

    if (statusData.status === 'completed') {
      currentImageUrl.value = statusData.imageUrl
      return
    }

    if (statusData.status === 'failed') {
      throw new Error(statusData.error || 'Image generation failed')
    }

    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000))
    attempts++
  }

  throw new Error('Image generation timed out')
}
</script>

<style scoped>
.inspire-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1a1a1a;
  transition: background-image 0.5s ease-in-out;
}

.generate-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.generate-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: scale(1.05);
}

.generate-button:active:not(:disabled) {
  transform: scale(0.95);
}

.generate-button:disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.arrow-icon {
  width: 40px;
  height: 40px;
  color: white;
  transition: transform 0.3s ease;
}

.arrow-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 20;
  max-width: 80%;
  text-align: center;
}

/* Responsive design for smaller screens */
@media (max-width: 640px) {
  .generate-button {
    width: 70px;
    height: 70px;
  }

  .arrow-icon {
    width: 35px;
    height: 35px;
  }
}
</style>
