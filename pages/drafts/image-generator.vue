<template>
  <div class="container">
    <h1>Image-to-Image Generator</h1>
    <form @submit.prevent="handleSubmit" class="form">
      <!-- Image URL field is only needed for tiers other than "new" -->
      <label v-if="tier !== 'new'">
        Image URL:
        <input
          v-model="imageUrl"
          type="text"
          placeholder="https://example.com/image.png"
          :required="tier !== 'new'"
        />
      </label>
      <label>
        Prompt:
        <textarea v-model="prompt" placeholder="Describe the transformation" required></textarea>
      </label>
      <label>
        Model Tier:
        <select v-model="tier">
          <option value="pro">Pro</option>
          <option value="max">Max</option>
          <option value="new">New</option>
        </select>
      </label>

      <!-- Image size selection, only relevant for the "new" tier -->
      <label v-if="tier === 'new'">
        Image Size:
        <select v-model="imageSize">
          <option value="square_hd">Square HD</option>
          <option value="square">Square</option>
          <option value="portrait_4_3">Portrait 4:3</option>
          <option value="portrait_16_9">Portrait 16:9</option>
          <option value="landscape_4_3">Landscape 4:3</option>
          <option value="landscape_16_9">Landscape 16:9</option>
        </select>
      </label>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Generating…' : 'Generate' }}
      </button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="resultUrl" class="result">
      <h2>Result</h2>
      <img :src="resultUrl" alt="Generated image" />
      <p class="small">request id: {{ requestId }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const imageUrl = ref('')
const prompt = ref('make this into a realistic photograph. ')
const tier = ref<'pro' | 'max' | 'new'>('pro')
// Image size parameter for the "new" tier. Default to landscape_4_3 as per spec
const imageSize = ref<
  | 'square_hd'
  | 'square'
  | 'portrait_4_3'
  | 'portrait_16_9'
  | 'landscape_4_3'
  | 'landscape_16_9'
>('landscape_4_3')

const loading = ref(false)
const resultUrl = ref<string | null>(null)
const requestId = ref<string | null>(null)
const error = ref<string | null>(null)

async function handleSubmit() {
  loading.value = true
  error.value = null
  resultUrl.value = null
  requestId.value = null

  try {
    const payload: Record<string, unknown> = {
      prompt: prompt.value,
      safety_tolerance: '5',
      tier: tier.value
    }

    if (tier.value !== 'new') {
      payload.image_url = imageUrl.value
    } else {
      payload.image_size = imageSize.value
    }

    const res = await fetch('/api/image-to-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (data.error) {
      throw new Error(data.error || 'Unknown error')
    }

    const images = data.data?.images || []
    if (images.length === 0) {
      throw new Error('No image returned')
    }
    resultUrl.value = images[0].url
    requestId.value = data.requestId
  } catch (e: any) {
    error.value = e.message || 'Failed to generate image'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.container {
  max-width: 640px;
  margin: 4rem auto;
  padding: 0 1rem;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  color: #111;
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
  font-size: 2rem;
  font-weight: 600;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #f9f9f9;
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

label {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  gap: 0.25rem;
}

input,
textarea,
select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  background: #def;
  border: 1px solid #aaa;
  border-radius: 3px;
  color: #333;
  transition: border-color 0.2s;
  margin: 0.4rem 1rem;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border: 2px solid #888;
}

button {
  align-self: flex-start;
  padding: 0.55rem 1.25rem;
  background: #111;
  border: none;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

button:hover:not(:disabled) {
  background: #333;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result {
  margin-top: 3rem;
  text-align: center;
}

.result img {
  max-width: 100%;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.small {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.5rem;
}

.error {
  margin-top: 1rem;
  color: #c33;
  text-align: center;
}
</style>