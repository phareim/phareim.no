<template>
  <div class="account-page">
    <div class="account-container">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading your account...</p>
      </div>

      <!-- Not Authenticated -->
      <div v-else-if="!isAuthenticated" class="not-authenticated">
        <h1>🔒 Account</h1>
        <p>You need to be signed in to view this page.</p>
        <button @click="router.push('/login')" class="btn-primary">
          Sign In
        </button>
      </div>

      <!-- Authenticated -->
      <div v-else class="account-content">
        <div class="profile-card">
          <div class="profile-header">
            <img
              v-if="photoURL"
              :src="photoURL"
              :alt="displayName || 'User'"
              class="profile-photo"
            />
            <div v-else class="profile-photo-placeholder">
              {{ (displayName || email || 'U')[0].toUpperCase() }}
            </div>
            <div class="profile-info">
              <h1>{{ displayName || 'User' }}</h1>
              <p class="email">{{ email }}</p>
              <p class="user-id">ID: {{ userId }}</p>
            </div>
          </div>

          <div class="divider"></div>

          <div class="account-actions">
            <h2>Quick Actions</h2>

            <button @click="router.push('/inspire')" class="action-btn">
              <span class="icon">🎨</span>
              <div>
                <div class="action-title">Generate Images</div>
                <div class="action-desc">Create AI-generated artwork</div>
              </div>
            </button>

            <button @click="showPromptManager = !showPromptManager" class="action-btn">
              <span class="icon">📝</span>
              <div>
                <div class="action-title">Manage Prompts</div>
                <div class="action-desc">Edit your custom image prompts</div>
              </div>
            </button>
          </div>

          <div class="divider"></div>

          <div class="logout-section">
            <button @click="handleLogout" :disabled="loggingOut" class="btn-logout">
              {{ loggingOut ? 'Signing out...' : 'Sign Out' }}
            </button>
          </div>
        </div>

        <!-- Prompt Manager (Expandable) -->
        <div v-if="showPromptManager" class="prompt-manager-section">
          <PromptManager />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const {
  isLoading,
  isAuthenticated,
  displayName,
  email,
  photoURL,
  userId,
  logout
} = useAuth()

const router = useRouter()
const loggingOut = ref(false)
const showPromptManager = ref(false)

const handleLogout = async () => {
  if (!confirm('Are you sure you want to sign out?')) {
    return
  }

  loggingOut.value = true
  const success = await logout()

  if (success) {
    router.push('/')
  } else {
    loggingOut.value = false
  }
}
</script>

<style scoped>
.account-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  font-family: "Comfortaa", "Alan Sans", sans-serif;
}

.account-container {
  max-width: 800px;
  margin: 0 auto;
}

.loading-state {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 4rem 2rem;
  text-align: center;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(102, 126, 234, 0.1);
  border-top-color: #667eea;
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  color: #666;
  font-size: 0.9rem;
}

.not-authenticated {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 4rem 2rem;
  text-align: center;
}

.not-authenticated h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #333;
}

.not-authenticated p {
  color: #666;
  margin-bottom: 2rem;
}

.btn-primary {
  padding: 1rem 2.5rem;
  border: none;
  border-radius: 12px;
  background: #667eea;
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: "Comfortaa", "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.profile-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.profile-photo,
.profile-photo-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  flex-shrink: 0;
}

.profile-photo {
  object-fit: cover;
  border: 3px solid #667eea;
}

.profile-photo-placeholder {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
}

.profile-info h1 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.75rem;
}

.email {
  color: #666;
  margin: 0 0 0.25rem 0;
  font-size: 0.95rem;
}

.user-id {
  color: #999;
  margin: 0;
  font-size: 0.75rem;
  font-family: monospace;
}

.divider {
  height: 1px;
  background: linear-gradient(to right, transparent, #ddd, transparent);
  margin: 2rem 0;
}

.account-actions h2 {
  font-size: 1.25rem;
  color: #333;
  margin-bottom: 1rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 1.25rem;
  margin-bottom: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.action-btn:hover {
  border-color: #667eea;
  background: #f8f9ff;
  transform: translateX(4px);
}

.action-btn .icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.action-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.action-desc {
  font-size: 0.85rem;
  color: #666;
}

.logout-section {
  text-align: center;
}

.btn-logout {
  padding: 0.875rem 2rem;
  border: 2px solid #dc3545;
  border-radius: 12px;
  background: white;
  color: #dc3545;
  font-size: 1rem;
  font-weight: 600;
  font-family: "Comfortaa", "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-logout:hover:not(:disabled) {
  background: #dc3545;
  color: white;
  transform: scale(1.05);
}

.btn-logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.prompt-manager-section {
  margin-top: 2rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

@media (max-width: 640px) {
  .account-page {
    padding: 1rem;
  }

  .profile-card {
    padding: 1.5rem;
  }

  .profile-header {
    flex-direction: column;
    text-align: center;
  }

  .profile-photo,
  .profile-photo-placeholder {
    width: 100px;
    height: 100px;
  }

  .profile-info h1 {
    font-size: 1.5rem;
  }

  .action-btn {
    padding: 1rem;
  }

  .action-btn .icon {
    font-size: 1.5rem;
  }
}
</style>
