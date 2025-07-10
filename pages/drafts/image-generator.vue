<template>
  <div class="container">
    <h1>Image-to-Image Generator</h1>
    <form @submit.prevent="handleSubmit" class="form">
      <!-- Image URL field is only needed for tiers other than "new" -->
      <div v-if="tier !== 'new'" class="field">
        <label class="field-label">Image URL</label>
        <input
          v-model="imageUrl"
          type="text"
          placeholder="https://example.com/image.png"
          class="field-input"
        />
      </div>

      <!-- Image size selection, only relevant for the "new" tier -->
      <div v-if="tier === 'new'" class="field">
        <label class="field-label">Image Size</label>
        <select v-model="imageSize" class="field-select">
          <option value="square_hd">Square HD</option>
          <option value="square">Square</option>
          <option value="portrait_4_3">Portrait 4:3</option>
          <option value="portrait_16_9">Portrait 16:9</option>
          <option value="landscape_4_3">Landscape 4:3</option>
          <option value="landscape_16_9">Landscape 16:9</option>
        </select>
      </div>
      
      <div class="field">
        <label class="field-label">Prompt</label>
        <textarea 
          v-model="prompt" 
          placeholder="Describe the transformation" 
          required 
          class="field-textarea"
        ></textarea>
      </div>
      
      <div class="field">
        <label class="field-label">Model Tier</label>
        <select v-model="tier" class="field-select">
          <option value="pro">Pro</option>
          <option value="max">Max</option>
          <option value="new">New</option>
        </select>
      </div>
      
      <button type="submit" :disabled="loading" class="submit-button">
        {{ loading ? 'Generating…' : 'Generate' }}
      </button>
    </form>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="resultUrl" class="result">
      <h2>Result</h2>
      <img :src="resultUrl" alt="Generated image" class="result-image" />
      <p class="request-id">request id: {{ requestId }}</p>
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
  color: var(--text-primary, #1a1a1a);
}

@media (prefers-color-scheme: dark) {
  .container {
    color: var(--text-primary, #e5e5e5);
  }
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

@media (prefers-color-scheme: dark) {
  h1 {
    color: var(--text-primary, #e5e5e5);
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--bg-secondary, #f8f9fa);
  padding: 2rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

@media (prefers-color-scheme: dark) {
  .form {
    background: var(--bg-secondary, #1e293b);
    border-color: var(--border-color, #334155);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary, #374151);
}

@media (prefers-color-scheme: dark) {
  .field-label {
    color: var(--text-secondary, #9ca3af);
  }
}

.field-input,
.field-textarea,
.field-select {
  padding: 0.75rem 1rem;
  font-size: 1rem;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  color: var(--text-primary, #1a1a1a);
  transition: all 0.2s ease;
  font-family: inherit;
}

@media (prefers-color-scheme: dark) {
  .field-input,
  .field-textarea,
  .field-select {
    background: var(--bg-primary, #0f172a);
    border-color: var(--border-color, #475569);
    color: var(--text-primary, #e5e5e5);
  }
}

.field-input:focus,
.field-textarea:focus,
.field-select:focus {
  outline: none;
  border-color: var(--accent-color, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.field-textarea {
  min-height: 100px;
  resize: vertical;
}

.submit-button {
  align-self: flex-start;
  padding: 0.75rem 1.5rem;
  background: var(--accent-color, #3b82f6);
  border: none;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  font-family: inherit;
}

.submit-button:hover:not(:disabled) {
  background: var(--accent-color-hover, #2563eb);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.result {
  margin-top: 3rem;
  text-align: center;
}

.result h2 {
  margin-bottom: 1rem;
  color: var(--text-primary, #1a1a1a);
}

@media (prefers-color-scheme: dark) {
  .result h2 {
    color: var(--text-primary, #e5e5e5);
  }
}

.result-image {
  max-width: 100%;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

@media (prefers-color-scheme: dark) {
  .result-image {
    border-color: var(--border-color, #334155);
    box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
  }
}

.request-id {
  font-size: 0.8rem;
  color: var(--text-tertiary, #6b7280);
  margin-top: 0.5rem;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

@media (prefers-color-scheme: dark) {
  .request-id {
    color: var(--text-tertiary, #9ca3af);
  }
}

.error {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--error-bg, #fef2f2);
  border: 1px solid var(--error-border, #fecaca);
  border-radius: 8px;
  color: var(--error-text, #dc2626);
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .error {
    background: var(--error-bg, #1f1517);
    border-color: var(--error-border, #7f1d1d);
    color: var(--error-text, #f87171);
  }
}
</style>