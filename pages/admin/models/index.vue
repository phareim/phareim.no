<template>
  <div class="admin-page">
    <AdminSidebar />
    <div class="admin-content">
      <div class="admin-container">
        <div class="admin-card">
          <div class="header-row">
            <h1>🖼️ Image Models</h1>
            <NuxtLink to="/admin/models/new" class="btn-primary">
              ➕ Add New Model
            </NuxtLink>
          </div>

          <div class="search-bar">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="🔍 Search models..."
              class="search-input"
            />
          </div>

          <div v-if="loading" class="loading">
            Loading models...
          </div>

          <div v-else-if="filteredModels.length === 0" class="empty-state">
            No models found
          </div>

          <div v-else class="models-table">
            <div class="table-header">
              <div class="col-icon"></div>
              <div class="col-name">Name</div>
              <div class="col-type">Type</div>
              <div class="col-styles">Styles</div>
              <div class="col-priority">Priority</div>
              <div class="col-enabled">Enabled</div>
              <div class="col-actions">Actions</div>
            </div>

            <div
              v-for="model in filteredModels"
              :key="model.id"
              class="table-row"
            >
              <div class="col-icon">{{ model.icon }}</div>
              <div class="col-name">
                <div class="model-name">{{ model.name }}</div>
                <div class="model-description">{{ model.description }}</div>
              </div>
              <div class="col-type">
                <span class="type-badge" :class="model.type">{{ model.type }}</span>
              </div>
              <div class="col-styles">
                {{ model.supportedStyles?.length || 0 }}
              </div>
              <div class="col-priority">{{ model.priority }}</div>
              <div class="col-enabled">
                <button
                  @click="toggleEnabled(model)"
                  class="toggle-btn"
                  :class="{ active: model.enabled }"
                >
                  {{ model.enabled ? '✅' : '❌' }}
                </button>
              </div>
              <div class="col-actions">
                <NuxtLink
                  :to="`/admin/models/${model.id}`"
                  class="action-icon"
                  title="Edit"
                >
                  ✏️
                </NuxtLink>
                <button
                  @click="confirmDelete(model)"
                  class="action-icon delete"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteModal" class="modal-overlay" @click="deleteModal = null">
      <div class="modal-card" @click.stop>
        <h2>⚠️ Delete Model</h2>
        <p>Are you sure you want to delete <strong>{{ deleteModal.name }}</strong>?</p>
        <p class="warning">This action cannot be undone.</p>
        <div class="modal-actions">
          <button @click="deleteModal = null" class="btn-cancel">
            Cancel
          </button>
          <button @click="deleteModel" class="btn-delete">
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'admin-auth'
})

const models = ref([])
const loading = ref(true)
const searchQuery = ref('')
const deleteModal = ref(null)

const filteredModels = computed(() => {
  if (!searchQuery.value) return models.value

  const query = searchQuery.value.toLowerCase()
  return models.value.filter(model =>
    model.name.toLowerCase().includes(query) ||
    model.description.toLowerCase().includes(query) ||
    model.type.toLowerCase().includes(query)
  )
})

const fetchModels = async () => {
  try {
    loading.value = true
    const data = await $fetch('/api/admin/models')
    models.value = data
  } catch (error) {
    console.error('Failed to fetch models:', error)
  } finally {
    loading.value = false
  }
}

const toggleEnabled = async (model) => {
  try {
    const updatedModel = await $fetch(`/api/admin/models/${model.id}`, {
      method: 'PATCH',
      body: { enabled: !model.enabled }
    })

    // Update local model
    const index = models.value.findIndex(m => m.id === model.id)
    if (index !== -1) {
      models.value[index] = updatedModel
    }
  } catch (error) {
    console.error('Failed to toggle model:', error)
  }
}

const confirmDelete = (model) => {
  deleteModal.value = model
}

const deleteModel = async () => {
  if (!deleteModal.value) return

  try {
    await $fetch(`/api/admin/models/${deleteModal.value.id}`, {
      method: 'DELETE'
    })

    // Remove from local list
    models.value = models.value.filter(m => m.id !== deleteModal.value.id)
    deleteModal.value = null
  } catch (error) {
    console.error('Failed to delete model:', error)
  }
}

onMounted(() => {
  fetchModels()
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
  max-width: 1400px;
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
  margin-bottom: 1.5rem;
}

h1 {
  color: white;
  font-size: 2rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  margin: 0;
}

.btn-primary {
  background: rgba(255, 255, 255, 0.9);
  color: #667eea;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  font-family: "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-decoration: none;
  display: inline-block;
}

.btn-primary:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.search-bar {
  margin-bottom: 1.5rem;
}

.search-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
  font-family: "Alan Sans", sans-serif;
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: white;
  font-size: 1.1rem;
}

.models-table {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 50px 2fr 100px 80px 80px 80px 100px;
  gap: 1rem;
  padding: 1rem;
  align-items: center;
}

.table-header {
  background: rgba(0, 0, 0, 0.2);
  color: white;
  font-weight: bold;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.table-row {
  background: rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.table-row:hover {
  background: rgba(255, 255, 255, 0.1);
}

.col-icon {
  font-size: 1.5rem;
  text-align: center;
}

.col-name .model-name {
  color: white;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.col-name .model-description {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
}

.type-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
}

.type-badge.fal {
  background: rgba(59, 130, 246, 0.8);
  color: white;
}

.type-badge.venice {
  background: rgba(139, 92, 246, 0.8);
  color: white;
}

.col-styles,
.col-priority {
  color: white;
  text-align: center;
}

.toggle-btn {
  background: rgba(220, 53, 69, 0.8);
  border: none;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toggle-btn.active {
  background: rgba(40, 167, 69, 0.8);
}

.toggle-btn:hover {
  transform: scale(1.1);
}

.col-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.action-icon {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 6px;
  padding: 0.5rem;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-block;
}

.action-icon:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.action-icon.delete:hover {
  background: rgba(220, 53, 69, 0.8);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-card h2 {
  color: #667eea;
  margin-bottom: 1rem;
}

.modal-card p {
  color: #333;
  margin-bottom: 1rem;
}

.modal-card .warning {
  color: #dc3545;
  font-weight: bold;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-cancel,
.btn-delete {
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  font-family: "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-cancel {
  background: rgba(108, 117, 125, 0.8);
  color: white;
}

.btn-cancel:hover {
  background: rgba(108, 117, 125, 1);
}

.btn-delete {
  background: rgba(220, 53, 69, 0.9);
  color: white;
}

.btn-delete:hover {
  background: rgba(220, 53, 69, 1);
}

@media (max-width: 768px) {
  .admin-content {
    margin-left: 0;
    padding: 1rem;
  }

  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .table-header {
    display: none;
  }
}
</style>
