<template>
  <div class="playground-page">
    <header class="playground-header">
      <h1>playground</h1>
      <p class="subtitle">generate images with AI</p>
    </header>

    <main class="playground-main">
      <form class="prompt-form" @submit.prevent="generate" aria-label="Image generation form">

        <!-- Prompt input -->
        <div class="field">
          <label for="prompt-input" class="field-label">prompt</label>
          <textarea
            id="prompt-input"
            v-model="prompt"
            class="prompt-textarea"
            placeholder="a foggy Norwegian fjord at dawn, cinematic light…"
            rows="3"
            maxlength="1000"
            aria-describedby="prompt-hint"
            :disabled="generating"
          ></textarea>
          <span id="prompt-hint" class="field-hint">{{ prompt.length }}/1000</span>
        </div>

        <!-- Controls row -->
        <div class="controls-row">
          <!-- Model selector -->
          <div class="field field--inline">
            <label for="model-select" class="field-label">model</label>
            <div class="select-wrapper">
              <select
                id="model-select"
                v-model="selectedModel"
                class="select-input"
                :disabled="generating"
              >
                <option v-for="m in models" :key="m.id" :value="m.id">
                  {{ m.icon }} {{ m.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Size selector -->
          <div class="field field--inline">
            <label for="size-select" class="field-label">size</label>
            <div class="select-wrapper">
              <select
                id="size-select"
                v-model="selectedSize"
                class="select-input"
                :disabled="generating"
              >
                <option v-for="s in sizes" :key="s.id" :value="s.id">{{ s.label }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Generate button -->
        <button
          type="submit"
          class="generate-btn"
          :disabled="generating || !prompt.trim()"
          :aria-label="generating ? 'Generating image…' : 'Generate image'"
        >
          <span v-if="generating" class="btn-spinner" aria-hidden="true"></span>
          <span>{{ generating ? 'generating…' : 'generate' }}</span>
        </button>
      </form>

      <!-- Error -->
      <div v-if="error" class="error-message" role="alert">
        {{ error }}
      </div>

      <!-- Result -->
      <div v-if="imageUrl" class="result-section">
        <div class="result-card" :class="aspectClass">
          <img
            :src="imageUrl"
            :alt="lastPrompt"
            class="result-image"
            loading="lazy"
          />
          <div class="result-overlay">
            <a
              :href="imageUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="result-open"
              aria-label="Open image in new tab"
            >open ↗</a>
          </div>
        </div>
        <p class="result-prompt">{{ lastPrompt }}</p>
      </div>

      <!-- Placeholder when empty -->
      <div v-else-if="!generating && !error" class="result-placeholder" aria-hidden="true">
        <div class="placeholder-frame">
          <span class="placeholder-icon">✦</span>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'playground — phareim.no' })

interface Model {
  id: string
  name: string
  icon: string
  description: string
}

interface Size {
  id: string
  label: string
}

const models: Model[] = [
  { id: 'z-image-turbo', name: 'Z-Image Turbo', icon: '⚡', description: 'Fastest' },
  { id: 'chroma',        name: 'Chroma',        icon: '🎨', description: 'Creative' },
  { id: 'venice-sd35',   name: 'SD 3.5',        icon: '🖼️', description: 'Stable Diffusion 3.5' },
  { id: 'hidream',       name: 'HiDream',       icon: '💭', description: 'High quality' },
  { id: 'qwen-image',    name: 'Qwen Image',    icon: '🔮', description: 'Highest quality' },
]

const sizes: Size[] = [
  { id: 'landscape_16_9', label: '16:9 landscape' },
  { id: 'square_hd',      label: '1:1 square HD' },
  { id: 'portrait_16_9',  label: '9:16 portrait' },
  { id: 'landscape_4_3',  label: '4:3 landscape' },
  { id: 'portrait_4_3',   label: '3:4 portrait' },
  { id: 'square',         label: '1:1 square' },
]

const prompt       = ref('')
const selectedModel = ref('z-image-turbo')
const selectedSize  = ref('landscape_16_9')
const generating   = ref(false)
const imageUrl     = ref('')
const lastPrompt   = ref('')
const error        = ref('')

const aspectClass = computed(() => {
  if (selectedSize.value.includes('portrait'))  return 'result-card--portrait'
  if (selectedSize.value === 'square_hd' || selectedSize.value === 'square') return 'result-card--square'
  return 'result-card--landscape'
})

async function generate() {
  if (!prompt.value.trim() || generating.value) return

  generating.value = true
  error.value = ''
  imageUrl.value = ''
  lastPrompt.value = prompt.value.trim()

  try {
    const res = await $fetch<{ success: boolean; imageUrl: string; error?: string }>('/api/generate-image', {
      method: 'POST',
      body: {
        prompt: lastPrompt.value,
        model: selectedModel.value,
        imageSize: selectedSize.value,
      },
    })

    if (res.success && res.imageUrl) {
      imageUrl.value = res.imageUrl
    } else {
      error.value = res.error ?? 'generation failed — try a different prompt or model'
    }
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'something went wrong'
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
/* ── Page shell ────────────────────────────────────────────── */

.playground-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 640px;
  margin: 0 auto;
}

/* ── Header ─────────────────────────────────────────────────── */

.playground-header {
  margin-bottom: 2.5rem;
}

h1 {
  font-size: clamp(2rem, 6vw, 3.5rem);
  margin: 0 0 0.5rem;
  color: var(--theme-text, #111);
  font-weight: 500;
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--theme-text-muted, #666);
  font-size: 1rem;
  margin: 0;
}

/* ── Form ───────────────────────────────────────────────────── */

.prompt-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field--inline {
  flex: 1;
  min-width: 0;
}

.field-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
  cursor: default;
}

.field-hint {
  font-size: 0.65rem;
  color: var(--theme-text-subtle, #aaa);
  text-align: right;
  margin-top: -0.2rem;
}

.prompt-textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 80px;
  padding: 0.8rem 1rem;
  background: var(--theme-input-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-input-border, rgba(0, 0, 0, 0.12));
  border-radius: var(--theme-card-radius, 12px);
  color: var(--theme-input-text, #111);
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1.5;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.prompt-textarea:focus {
  outline: none;
  border-color: var(--theme-accent, #6b8cae);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #6b8cae) 15%, transparent);
}

.prompt-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.prompt-textarea::placeholder {
  color: var(--theme-text-subtle, #bbb);
}

/* ── Controls ───────────────────────────────────────────────── */

.controls-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.select-wrapper {
  position: relative;
}

.select-wrapper::after {
  content: '▾';
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.65rem;
  color: var(--theme-text-subtle, #aaa);
  pointer-events: none;
}

.select-input {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  padding: 0.55rem 2rem 0.55rem 0.85rem;
  background: var(--theme-input-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-input-border, rgba(0, 0, 0, 0.12));
  border-radius: var(--theme-card-radius, 10px);
  color: var(--theme-input-text, #111);
  font-family: inherit;
  font-size: 0.82rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  cursor: pointer;
  transition: border-color 0.2s ease;
  white-space: nowrap;
}

.select-input:focus {
  outline: none;
  border-color: var(--theme-accent, #6b8cae);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent, #6b8cae) 15%, transparent);
}

.select-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Generate button ─────────────────────────────────────────── */

.generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1.6rem;
  background: var(--theme-accent, #6b8cae);
  color: var(--theme-bg, #fff);
  border: none;
  border-radius: var(--theme-card-radius, 12px);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  align-self: flex-start;
  transition: opacity 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6b8cae) 30%, transparent);
}

.generate-btn:hover:not(:disabled) {
  opacity: 0.88;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--theme-accent, #6b8cae) 40%, transparent);
}

.generate-btn:active:not(:disabled) {
  transform: translateY(0);
}

.generate-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.generate-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 3px;
}

/* Spinner */
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Error ──────────────────────────────────────────────────── */

.error-message {
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--theme-accent-danger, #c1272d) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-accent-danger, #c1272d) 30%, transparent);
  border-radius: var(--theme-card-radius, 12px);
  color: var(--theme-accent-danger, #c1272d);
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
}

/* ── Result image ───────────────────────────────────────────── */

.result-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: fade-up 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.result-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--theme-card-radius, 16px);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  background: var(--theme-card-bg, rgba(0, 0, 0, 0.04));
  box-shadow: 0 4px 20px var(--theme-card-shadow, rgba(0, 0, 0, 0.06));
  width: 100%;
}

.result-card--landscape { aspect-ratio: 16 / 9; }
.result-card--square    { aspect-ratio: 1 / 1; }
.result-card--portrait  { aspect-ratio: 9 / 16; max-width: 340px; }

.result-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.result-overlay {
  position: absolute;
  inset: 0;
  background: transparent;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.result-card:hover .result-overlay {
  opacity: 1;
}

.result-open {
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.result-open:hover {
  background: rgba(0, 0, 0, 0.7);
}

.result-open:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.result-prompt {
  font-size: 0.78rem;
  color: var(--theme-text-subtle, #aaa);
  line-height: 1.5;
  font-style: italic;
  margin: 0;
}

/* ── Placeholder ─────────────────────────────────────────────── */

.result-placeholder {
  margin-top: 0.5rem;
}

.placeholder-frame {
  aspect-ratio: 16 / 9;
  border: 1px dashed var(--theme-card-border, rgba(0, 0, 0, 0.12));
  border-radius: var(--theme-card-radius, 16px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-text-subtle, #ccc);
  font-size: 2rem;
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.placeholder-icon {
  animation: placeholder-pulse 3s ease-in-out infinite;
}

@keyframes placeholder-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%       { opacity: 0.9; transform: scale(1.15); }
}

/* ── Hacker theme overrides ─────────────────────────────────── */

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .subtitle {
  font-family: monospace;
}

:global(.hacker-page) .field-label {
  font-family: monospace;
}

:global(.hacker-page) .prompt-textarea,
:global(.hacker-page) .select-input {
  font-family: monospace;
  border-radius: 0;
}

:global(.hacker-page) .prompt-textarea:focus,
:global(.hacker-page) .select-input:focus {
  box-shadow: 0 0 0 2px var(--theme-accent, #00ff41);
}

:global(.hacker-page) .generate-btn {
  border-radius: 0;
  font-family: monospace;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  box-shadow: 0 0 12px color-mix(in srgb, var(--theme-accent, #00ff41) 40%, transparent);
}

:global(.hacker-page) .generate-btn:hover:not(:disabled) {
  box-shadow: 0 0 20px color-mix(in srgb, var(--theme-accent, #00ff41) 60%, transparent);
}

:global(.hacker-page) .result-card {
  border-radius: 0;
}

:global(.hacker-page) .placeholder-frame {
  border-radius: 0;
  border-style: dashed;
}

:global(.hacker-page) .error-message {
  border-radius: 0;
  font-family: monospace;
}

/* ── Space theme overrides ──────────────────────────────────── */

:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .subtitle {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
}

:global(.space-page) .field-label {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
}

:global(.space-page) .generate-btn {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-size: 0.75rem;
  box-shadow: 0 2px 16px color-mix(in srgb, var(--theme-accent, #89abd0) 35%, transparent),
              0 0 0 1px rgba(140, 170, 220, 0.15);
}

:global(.space-page) .generate-btn:hover:not(:disabled) {
  box-shadow: 0 4px 24px color-mix(in srgb, var(--theme-accent, #89abd0) 50%, transparent),
              0 0 0 1px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .result-card {
  box-shadow: 0 4px 24px rgba(140, 170, 220, 0.12),
              0 0 0 1px rgba(140, 170, 220, 0.08);
}

:global(.space-page) .result-card:hover {
  box-shadow: 0 8px 40px rgba(140, 170, 220, 0.2),
              0 0 0 1px rgba(140, 170, 220, 0.2);
}
</style>
