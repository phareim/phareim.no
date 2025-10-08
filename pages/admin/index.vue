<template>
  <div class="admin-page">
    <AdminSidebar />
    <div class="admin-content">
      <div class="admin-container">
        <div class="admin-card">
          <h1>🎨 Admin Dashboard</h1>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">🖼️</div>
              <div class="stat-info">
                <div class="stat-value">{{ totalModels }}</div>
                <div class="stat-label">Total Models</div>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">✅</div>
              <div class="stat-info">
                <div class="stat-value">{{ enabledModels }}</div>
                <div class="stat-label">Enabled Models</div>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">🎭</div>
              <div class="stat-info">
                <div class="stat-value">{{ totalStyles }}</div>
                <div class="stat-label">Total Styles</div>
              </div>
            </div>
          </div>

          <div class="quick-actions">
            <h2>Quick Actions</h2>
            <div class="action-buttons">
              <NuxtLink to="/admin/models" class="action-btn">
                📋 Manage Models
              </NuxtLink>
              <NuxtLink to="/admin/models/new" class="action-btn">
                ➕ Add New Model
              </NuxtLink>
              <button @click="logout" class="action-btn logout-btn">
                🚪 Logout
              </button>
            </div>
          </div>
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

const totalModels = computed(() => models.value.length)
const enabledModels = computed(() => models.value.filter(m => m.enabled).length)
const totalStyles = computed(() => {
  return models.value.reduce((sum, model) => {
    return sum + (model.supportedStyles?.length || 0)
  }, 0)
})

const fetchModels = async () => {
  try {
    const data = await $fetch('/api/admin/models')
    models.value = data
  } catch (error) {
    console.error('Failed to fetch models:', error)
  } finally {
    loading.value = false
  }
}

const logout = async () => {
  try {
    await $fetch('/api/admin/auth/logout', { method: 'POST' })
    navigateTo('/admin/login')
  } catch (error) {
    console.error('Logout error:', error)
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
  max-width: 1200px;
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

h1 {
  color: white;
  margin-bottom: 2rem;
  font-size: 2rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

h2 {
  color: white;
  margin-bottom: 1rem;
  font-size: 1.5rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.stat-label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.quick-actions {
  margin-top: 2rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.action-btn {
  background: rgba(255, 255, 255, 0.9);
  color: #667eea;
  border: none;
  border-radius: 8px;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  font-family: "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-decoration: none;
  display: inline-block;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.logout-btn {
  background: rgba(220, 53, 69, 0.9);
  color: white;
}

.logout-btn:hover {
  background: rgba(220, 53, 69, 1);
}

@media (max-width: 768px) {
  .admin-content {
    margin-left: 0;
    padding: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
