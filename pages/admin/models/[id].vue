<template>
  <div class="admin-page">
    <AdminSidebar />
    <div class="admin-content">
      <div class="admin-container">
        <div class="admin-card">
          <div class="header-row">
            <h1>{{ isNewModel ? '➕ New Model' : '✏️ Edit Model' }}</h1>
            <NuxtLink to="/admin/models" class="btn-secondary">
              ← Back to Models
            </NuxtLink>
          </div>

          <div v-if="loading" class="loading">
            Loading model...
          </div>

          <form v-else @submit.prevent="saveModel" class="model-form">
            <!-- Basic Info -->
            <div class="form-section">
              <h2>📋 Basic Information</h2>

              <div class="form-row">
                <div class="form-group">
                  <label>Model ID</label>
                  <input
                    v-model="model.id"
                    type="text"
                    :disabled="!isNewModel"
                    required
                  />
                  <small v-if="isNewModel">Cannot be changed after creation</small>
                </div>

                <div class="form-group">
                  <label>Icon</label>
                  <input v-model="model.icon" type="text" required />
                </div>
              </div>

              <div class="form-group">
                <label>Name</label>
                <input v-model="model.name" type="text" required />
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea v-model="model.description" rows="2"></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Type</label>
                  <select v-model="model.type" required>
                    <option value="fal">FAL.ai</option>
                    <option value="venice">Venice AI</option>
                    <option value="openai">OpenAI</option>
                    <option value="external">External</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Endpoint</label>
                  <input v-model="model.endpoint" type="text" required />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Priority</label>
                  <input v-model.number="model.priority" type="number" required />
                  <small>Lower numbers appear first</small>
                </div>

                <div class="form-group">
                  <label>
                    <input v-model="model.enabled" type="checkbox" />
                    Enabled
                  </label>
                </div>
              </div>
            </div>

            <!-- Prompts -->
            <div class="form-section">
              <h2>💬 Prompts</h2>

              <div class="form-group">
                <label>Base Prompt</label>
                <textarea v-model="model.basePrompt" rows="3"></textarea>
                <small>The base prompt that will be used for all generations</small>
              </div>

              <div class="form-group">
                <label>Prompt Suffix (Optional)</label>
                <textarea v-model="model.promptSuffix" rows="2"></textarea>
                <small>Additional text appended at the end of prompts</small>
              </div>
            </div>

            <!-- Parameters JSON -->
            <div class="form-section">
              <h2>⚙️ Parameters</h2>

              <div class="form-group">
                <label>Parameters (JSON)</label>
                <textarea
                  v-model="parametersJson"
                  rows="8"
                  class="code-editor"
                  @blur="validateJson('parameters')"
                ></textarea>
                <small v-if="jsonErrors.parameters" class="error">
                  {{ jsonErrors.parameters }}
                </small>
                <small v-else>Model-specific parameters as JSON</small>
              </div>
            </div>

            <!-- Supported Styles -->
            <div class="form-section">
              <h2>🎨 Supported Styles</h2>

              <div class="styles-list">
                <div
                  v-for="(style, index) in model.supportedStyles"
                  :key="index"
                  class="style-item"
                >
                  <div class="style-header">
                    <input
                      v-model="style.icon"
                      type="text"
                      placeholder="Icon"
                      class="style-icon-input"
                    />
                    <input
                      v-model="style.value"
                      type="text"
                      placeholder="Value (e.g., 'disney')"
                      class="style-value-input"
                    />
                    <button
                      type="button"
                      @click="removeStyle(index)"
                      class="btn-remove"
                    >
                      🗑️
                    </button>
                  </div>
                  <input
                    v-model="style.title"
                    type="text"
                    placeholder="Title (e.g., 'Disney')"
                    class="style-title-input"
                  />
                  <input
                    v-model="style.description"
                    type="text"
                    placeholder="Description"
                    class="style-desc-input"
                  />
                  <div class="style-prompts-container">
                    <div class="prompt-field">
                      <label>Style Modifier (legacy/short)</label>
                      <textarea
                        v-model="style.styleModifier"
                        placeholder="Short style modifier text"
                        rows="2"
                        class="style-modifier-input"
                      ></textarea>
                    </div>
                    <div class="prompt-field">
                      <label>Image Prompt (full/detailed) <span class="recommended">✨ Recommended</span></label>
                      <textarea
                        v-model="style.imagePrompt"
                        placeholder="Full detailed image prompt (replaces styleModifier if provided)"
                        rows="6"
                        class="style-image-prompt-input"
                      ></textarea>
                      <small>This full prompt will be used if provided, otherwise styleModifier</small>
                    </div>
                  </div>
                </div>
              </div>

              <button type="button" @click="addStyle" class="btn-add-style">
                ➕ Add Style
              </button>
            </div>

            <!-- Prompt Preview -->
            <div class="form-section prompt-preview-section">
              <h2>👁️ Prompt Preview</h2>
              <p class="preview-description">See how the final prompt will be constructed:</p>

              <div class="prompt-breakdown">
                <div class="prompt-part">
                  <strong>1. Base Prompt:</strong>
                  <div class="prompt-content">{{ model.basePrompt || '(not set)' }}</div>
                </div>

                <div class="prompt-part" v-if="model.supportedStyles.length > 0">
                  <strong>2. Style Modifier (example with first style):</strong>
                  <div class="prompt-content">
                    {{ model.supportedStyles[0]?.imagePrompt || model.supportedStyles[0]?.styleModifier || '(not set)' }}
                  </div>
                  <small>Style: {{ model.supportedStyles[0]?.icon }} {{ model.supportedStyles[0]?.title }}</small>
                </div>

                <div class="prompt-part">
                  <strong>3. User Prompt:</strong>
                  <div class="prompt-content prompt-placeholder">[User's description goes here]</div>
                </div>

                <div class="prompt-part" v-if="model.promptSuffix">
                  <strong>4. Prompt Suffix:</strong>
                  <div class="prompt-content">{{ model.promptSuffix }}</div>
                </div>
              </div>

              <div class="prompt-full">
                <strong>Complete Example Prompt:</strong>
                <div class="prompt-content">
                  {{ buildExamplePrompt() }}
                </div>
              </div>
            </div>

            <!-- Test Image Generation -->
            <div class="form-section test-section">
              <h2>🖼️ Test Image Generation</h2>

              <div class="form-row">
                <div class="form-group">
                  <label>Test Prompt</label>
                  <input
                    v-model="testPrompt"
                    type="text"
                    placeholder="Enter a test prompt..."
                  />
                </div>

                <div class="form-group">
                  <label>Style</label>
                  <select v-model="testStyle">
                    <option value="">Default</option>
                    <option
                      v-for="style in model.supportedStyles"
                      :key="style.value"
                      :value="style.value"
                    >
                      {{ style.icon }} {{ style.title }}
                    </option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                @click="generateTestImage"
                :disabled="testGenerating || !testPrompt"
                class="btn-test"
              >
                {{ testGenerating ? '⏳ Generating...' : '🎨 Generate Test Image' }}
              </button>

              <div v-if="testImageUrl" class="test-result">
                <img :src="testImageUrl" alt="Test generation" />
                <div class="test-info">
                  <strong>Full Prompt:</strong>
                  <p>{{ testFullPrompt }}</p>
                </div>
              </div>

              <div v-if="testError" class="test-error">
                ❌ {{ testError }}
              </div>
            </div>

            <!-- Save Button -->
            <div class="form-actions">
              <button type="submit" :disabled="saving" class="btn-save">
                {{ saving ? 'Saving...' : '💾 Save Model' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'admin-auth'
})

const route = useRoute()
const router = useRouter()

const isNewModel = computed(() => route.params.id === 'new')
const loading = ref(true)
const saving = ref(false)

const model = ref({
  id: '',
  name: '',
  icon: '🎨',
  description: '',
  enabled: true,
  endpoint: '',
  type: 'fal',
  basePrompt: '',
  promptSuffix: '',
  parameters: {},
  supportedStyles: [],
  priority: 999
})

const parametersJson = ref('{}')
const jsonErrors = ref({
  parameters: ''
})

const testPrompt = ref('')
const testStyle = ref('')
const testGenerating = ref(false)
const testImageUrl = ref('')
const testFullPrompt = ref('')
const testError = ref('')

const loadModel = async () => {
  if (isNewModel.value) {
    loading.value = false
    parametersJson.value = JSON.stringify({}, null, 2)
    return
  }

  try {
    const data = await $fetch(`/api/admin/models/${route.params.id}`)
    model.value = {
      ...data,
      supportedStyles: data.supportedStyles || []
    }
    parametersJson.value = JSON.stringify(data.parameters || {}, null, 2)
  } catch (error) {
    console.error('Failed to load model:', error)
  } finally {
    loading.value = false
  }
}

const validateJson = (field) => {
  try {
    if (field === 'parameters') {
      const parsed = JSON.parse(parametersJson.value)
      model.value.parameters = parsed
      jsonErrors.value.parameters = ''
    }
  } catch (error) {
    jsonErrors.value[field] = `Invalid JSON: ${error.message}`
  }
}

const addStyle = () => {
  model.value.supportedStyles.push({
    value: '',
    title: '',
    icon: '',
    description: '',
    styleModifier: '',
    imagePrompt: ''
  })
}

const removeStyle = (index) => {
  model.value.supportedStyles.splice(index, 1)
}

const saveModel = async () => {
  // Validate parameters JSON one more time
  validateJson('parameters')
  if (jsonErrors.value.parameters) {
    alert('Please fix JSON errors before saving')
    return
  }

  try {
    saving.value = true

    if (isNewModel.value) {
      await $fetch('/api/admin/models', {
        method: 'POST',
        body: model.value
      })
    } else {
      await $fetch(`/api/admin/models/${model.value.id}`, {
        method: 'PUT',
        body: model.value
      })
    }

    router.push('/admin/models')
  } catch (error) {
    console.error('Failed to save model:', error)
    alert('Failed to save model. Check console for details.')
  } finally {
    saving.value = false
  }
}

const buildExamplePrompt = () => {
  let parts = []

  // Base prompt
  if (model.value.basePrompt) {
    parts.push(model.value.basePrompt)
  }

  // First style's imagePrompt or styleModifier
  if (model.value.supportedStyles.length > 0) {
    const firstStyle = model.value.supportedStyles[0]
    const styleText = firstStyle.imagePrompt || firstStyle.styleModifier
    if (styleText) {
      parts.push(styleText)
    }
  }

  // Example user prompt
  parts.push('a brave warrior with a sword')

  // Suffix
  if (model.value.promptSuffix) {
    parts.push(model.value.promptSuffix)
  }

  return parts.join(', ')
}

const generateTestImage = async () => {
  if (!testPrompt.value) return

  try {
    testGenerating.value = true
    testError.value = ''
    testImageUrl.value = ''
    testFullPrompt.value = ''

    const result = await $fetch('/api/admin/test-image', {
      method: 'POST',
      body: {
        modelId: model.value.id,
        userPrompt: testPrompt.value,
        selectedStyle: testStyle.value
      }
    })

    testImageUrl.value = result.imageUrl
    testFullPrompt.value = result.fullPrompt
  } catch (error) {
    console.error('Test generation error:', error)
    testError.value = error.message || 'Failed to generate test image'
  } finally {
    testGenerating.value = false
  }
}

onMounted(() => {
  loadModel()
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  font-family: "Alan Sans", sans-serif;
}

.admin-content {
  flex: 1;
  margin-left: 250px;
  padding: 2rem;
}

.admin-container {
  max-width: 1000px;
  margin: 0 auto;
}

.admin-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h1 {
  color: white;
  font-size: 2rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  margin: 0;
}

h2 {
  color: white;
  font-size: 1.3rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  margin-bottom: 1rem;
}

.btn-secondary {
  background: rgba(108, 117, 125, 0.8);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  font-family: "Alan Sans", sans-serif;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: rgba(108, 117, 125, 1);
}

.loading {
  text-align: center;
  padding: 3rem;
  color: white;
  font-size: 1.1rem;
}

.model-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
  font-family: "Alan Sans", sans-serif;
  transition: all 0.3s ease;
}

.form-group input:disabled {
  background: rgba(200, 200, 200, 0.5);
  cursor: not-allowed;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.form-group input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
}

.form-group small {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
}

.form-group small.error {
  color: #ff6b6b;
  font-weight: bold;
}

.code-editor {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
}

/* Styles List */
.styles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.style-item {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.style-header {
  display: grid;
  grid-template-columns: 60px 1fr auto;
  gap: 0.5rem;
}

.style-icon-input {
  padding: 0.5rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 1.5rem;
}

.style-value-input,
.style-title-input,
.style-desc-input,
.style-modifier-input,
.style-image-prompt-input {
  padding: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  font-family: "Alan Sans", sans-serif;
}

.style-prompts-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.1);
  padding: 1rem;
  border-radius: 6px;
  margin-top: 0.5rem;
}

.prompt-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.prompt-field label {
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.prompt-field .recommended {
  color: #ffd700;
  font-size: 0.85rem;
  font-weight: normal;
}

.prompt-field small {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
}

.btn-remove {
  background: rgba(220, 53, 69, 0.8);
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-remove:hover {
  background: rgba(220, 53, 69, 1);
}

.btn-add-style {
  background: rgba(40, 167, 69, 0.8);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  font-family: "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-add-style:hover {
  background: rgba(40, 167, 69, 1);
}

/* Prompt Preview Section */
.prompt-preview-section {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.preview-description {
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 1rem;
}

.prompt-breakdown {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.prompt-part {
  background: rgba(0, 0, 0, 0.2);
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid rgba(59, 130, 246, 0.8);
}

.prompt-part strong {
  color: white;
  display: block;
  margin-bottom: 0.5rem;
}

.prompt-part small {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  display: block;
  margin-top: 0.5rem;
}

.prompt-content {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.75rem;
  border-radius: 6px;
  color: white;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.prompt-placeholder {
  font-style: italic;
  opacity: 0.7;
}

.prompt-full {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 8px;
  border: 2px solid rgba(59, 130, 246, 0.5);
}

.prompt-full strong {
  color: white;
  display: block;
  margin-bottom: 0.75rem;
}

/* Test Section */
.test-section {
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.btn-test {
  background: rgba(139, 92, 246, 0.9);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  font-family: "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
}

.btn-test:hover:not(:disabled) {
  background: rgba(139, 92, 246, 1);
  transform: translateY(-2px);
}

.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-result {
  margin-top: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
}

.test-result img {
  width: 100%;
  max-width: 512px;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.test-info {
  color: white;
}

.test-info p {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.75rem;
  border-radius: 6px;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.test-error {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(220, 53, 69, 0.9);
  color: white;
  border-radius: 8px;
  font-weight: 600;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn-save {
  background: rgba(40, 167, 69, 0.9);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.875rem 2rem;
  font-size: 1.1rem;
  font-weight: bold;
  font-family: "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-save:hover:not(:disabled) {
  background: rgba(40, 167, 69, 1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .admin-content {
    margin-left: 0;
    padding: 1rem;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .style-header {
    grid-template-columns: 1fr;
  }
}
</style>
