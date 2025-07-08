<template>
  <div class="container">
    <h1>Image to Image</h1>
    <form @submit.prevent="handleSubmit" class="form">
      <label>
        Image URL:
        <input v-model="imageUrl" type="text" placeholder="https://example.com/image.png" required />
      </label>
      <label>
        Description / Prompt:
        <textarea v-model="prompt" placeholder="Describe the transformation" required></textarea>
      </label>
      <label>
        Model Tier:
        <select v-model="tier">
          <option value="pro">Pro</option>
          <option value="max">Max</option>
        </select>
      </label>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Generating...' : 'Generate' }}
      </button>
    </form>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="resultUrl" class="result">
      <h2>Result</h2>
      <img :src="resultUrl" alt="Generated image" />
      <p class="small">(request id: {{ requestId }})</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const imageUrl = ref('')
const prompt = ref('make this into a photography, cinematic in style. 8K HD. keep the comic-book proportions. ')
const loading = ref(false)
const resultUrl = ref<string | null>(null)
const requestId = ref<string | null>(null)
const error = ref<string | null>(null)
const tier = ref<'pro' | 'max'>('pro')

async function handleSubmit() {
  loading.value = true
  error.value = null
  resultUrl.value = null
  requestId.value = null

  try {
    const res = await fetch('/api/image-to-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl.value,
        prompt: prompt.value,
        safety_tolerance: '5',
        tier: tier.value
      })
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
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Courier New', monospace;
  color: #33ff33;
}

h1 {
  text-align: center;
  margin-bottom: 20px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  background: #1a1a1a;
  padding: 20px;
  border: 2px solid #33ff33;
  border-radius: 5px;
}

input,
textarea {
  width: 100%;
  padding: 8px;
  background: #000;
  border: 1px solid #33ff33;
  border-radius: 4px;
  color: #33ff33;
}

button {
  padding: 10px 16px;
  background: #000;
  border: 2px solid #33ff33;
  color: #33ff33;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}
button:hover:not(:disabled) {
  background: #33ff33;
  color: #000;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result {
  margin-top: 30px;
  text-align: center;
}
.result img {
  max-width: 100%;
  border: 2px solid #33ff33;
  border-radius: 5px;
}
.small {
  font-size: 0.8em;
  color: #999;
}
.error {
  margin-top: 20px;
  color: #ff3333;
  text-align: center;
}
</style>