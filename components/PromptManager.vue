<template>
  <div class="prompt-manager">
    <h2>Manage Your Image Prompts</h2>

    <!-- Error Display -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Create New Prompt Form -->
    <div class="create-form">
      <h3>Create New Prompt</h3>
      <input
        v-model="newPrompt.prompt"
        type="text"
        placeholder="Enter your image prompt..."
        class="prompt-input"
      />
      <input
        v-model="newPrompt.category"
        type="text"
        placeholder="Category (optional)"
        class="category-input"
      />
      <button @click="handleCreate" :disabled="!newPrompt.prompt || isLoading">
        Create Prompt
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading">
      Loading prompts...
    </div>

    <!-- Prompts List -->
    <div v-else class="prompts-list">
      <h3>Your Prompts ({{ prompts.length }})</h3>

      <div v-if="prompts.length === 0" class="empty-state">
        No prompts yet. Create one above!
      </div>

      <div
        v-for="prompt in prompts"
        :key="prompt.id"
        class="prompt-item"
      >
        <!-- View Mode -->
        <div v-if="editingId !== prompt.id" class="prompt-view">
          <div class="prompt-content">
            <p class="prompt-text">{{ prompt.prompt }}</p>
            <span v-if="prompt.category" class="category-badge">
              {{ prompt.category }}
            </span>
            <span v-if="prompt.copiedFrom" class="copied-badge">
              Default
            </span>
          </div>
          <div class="prompt-actions">
            <button @click="startEdit(prompt)" class="btn-edit">
              Edit
            </button>
            <button @click="handleDelete(prompt.id!)" class="btn-delete">
              Delete
            </button>
          </div>
        </div>

        <!-- Edit Mode -->
        <div v-else class="prompt-edit">
          <input
            v-model="editForm.prompt"
            type="text"
            class="prompt-input"
          />
          <input
            v-model="editForm.category"
            type="text"
            placeholder="Category"
            class="category-input"
          />
          <div class="edit-actions">
            <button @click="handleUpdate(prompt.id!)" class="btn-save">
              Save
            </button>
            <button @click="cancelEdit" class="btn-cancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ImagePrompt } from '~/types/image-prompt'

const {
  listUserPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  isAuthenticated
} = useImagePrompts()

const prompts = ref<ImagePrompt[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const newPrompt = ref({
  prompt: '',
  category: ''
})

const editingId = ref<string | null>(null)
const editForm = ref({
  prompt: '',
  category: ''
})

// Load prompts on mount
onMounted(async () => {
  if (!isAuthenticated()) {
    error.value = 'You must be logged in to manage prompts'
    return
  }

  await loadPrompts()
})

async function loadPrompts() {
  isLoading.value = true
  error.value = null

  try {
    const response = await listUserPrompts()
    prompts.value = response.prompts
  } catch (e: any) {
    error.value = e.message || 'Failed to load prompts'
    console.error('Error loading prompts:', e)
  } finally {
    isLoading.value = false
  }
}

async function handleCreate() {
  if (!newPrompt.value.prompt) return

  error.value = null

  try {
    await createPrompt({
      prompt: newPrompt.value.prompt,
      category: newPrompt.value.category || undefined
    })

    // Reset form
    newPrompt.value = { prompt: '', category: '' }

    // Reload prompts
    await loadPrompts()
  } catch (e: any) {
    error.value = e.message || 'Failed to create prompt'
    console.error('Error creating prompt:', e)
  }
}

function startEdit(prompt: ImagePrompt) {
  editingId.value = prompt.id!
  editForm.value = {
    prompt: prompt.prompt,
    category: prompt.category || ''
  }
}

function cancelEdit() {
  editingId.value = null
  editForm.value = { prompt: '', category: '' }
}

async function handleUpdate(id: string) {
  error.value = null

  try {
    await updatePrompt(id, {
      prompt: editForm.value.prompt,
      category: editForm.value.category || undefined
    })

    // Exit edit mode
    cancelEdit()

    // Reload prompts
    await loadPrompts()
  } catch (e: any) {
    error.value = e.message || 'Failed to update prompt'
    console.error('Error updating prompt:', e)
  }
}

async function handleDelete(id: string) {
  if (!confirm('Are you sure you want to delete this prompt?')) {
    return
  }

  error.value = null

  try {
    await deletePrompt(id)

    // Reload prompts
    await loadPrompts()
  } catch (e: any) {
    error.value = e.message || 'Failed to delete prompt'
    console.error('Error deleting prompt:', e)
  }
}
</script>

<style scoped>
.prompt-manager {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  margin-bottom: 2rem;
  color: #333;
}

h3 {
  margin-bottom: 1rem;
  color: #555;
}

.error-message {
  background: #fee;
  border: 1px solid #fcc;
  color: #c33;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.create-form {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.prompt-input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.category-input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  background: #4CAF50;
  color: white;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #45a049;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.prompts-list {
  margin-top: 2rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #999;
  font-style: italic;
}

.prompt-item {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.prompt-view {
  display: flex;
  justify-content: space-between;
  align-items: start;
}

.prompt-content {
  flex: 1;
}

.prompt-text {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.category-badge,
.copied-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  margin-right: 0.5rem;
}

.category-badge {
  background: #e3f2fd;
  color: #1976d2;
}

.copied-badge {
  background: #fff3e0;
  color: #f57c00;
}

.prompt-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-edit,
.btn-save {
  background: #2196F3;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-edit:hover,
.btn-save:hover {
  background: #1976D2;
}

.btn-delete {
  background: #f44336;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-delete:hover {
  background: #d32f2f;
}

.btn-cancel {
  background: #757575;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-cancel:hover {
  background: #616161;
}

.prompt-edit {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
