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
  background: var(--theme-bg, #f5f5f3);
  display: flex;
  font-family: var(--theme-font-display, "Alan Sans", sans-serif);
  color: var(--theme-text, #333);
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
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.65));
  backdrop-filter: blur(20px);
  border: 1px solid var(--theme-card-border, rgba(255, 255, 255, 0.4));
  border-radius: var(--theme-card-radius, 16px);
  padding: 2rem;
  box-shadow: 0 8px 32px var(--theme-card-shadow, rgba(0, 0, 0, 0.1));
}

h1 {
  color: var(--theme-text, #333);
  margin-bottom: 2rem;
  font-size: 2rem;
}

h2 {
  color: var(--theme-text, #333);
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.5));
  backdrop-filter: blur(10px);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
  border-radius: var(--theme-card-radius, 12px);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all var(--theme-transition, 0.3s ease);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px var(--theme-card-shadow, rgba(0, 0, 0, 0.1));
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
  color: var(--theme-text, #333);
}

.stat-label {
  font-size: 0.9rem;
  color: var(--theme-text-muted, #666);
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
  background: var(--theme-bg, white);
  color: var(--theme-accent, #667eea);
  border: 1px solid var(--theme-card-border, transparent);
  border-radius: var(--theme-card-radius, 8px);
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  font-family: var(--theme-font-display, "Alan Sans", sans-serif);
  cursor: pointer;
  transition: all var(--theme-transition, 0.3s ease);
  box-shadow: 0 4px 12px var(--theme-card-shadow, rgba(0, 0, 0, 0.1));
  text-decoration: none;
  display: inline-block;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px var(--theme-card-shadow, rgba(0, 0, 0, 0.15));
}

.logout-btn {
  background: var(--theme-accent-danger, rgba(220, 53, 69, 0.9));
  color: var(--theme-bg, white);
}

.logout-btn:hover {
  opacity: 0.9;
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
