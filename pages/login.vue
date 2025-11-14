<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <h1>Welcome Back</h1>
        <p class="subtitle">Sign in to manage your image prompts</p>

        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Checking authentication...</p>
        </div>

        <div v-else class="login-content">
          <button @click="handleGoogleSignIn" :disabled="signingIn" class="google-btn">
            <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {{ signingIn ? 'Signing in...' : 'Continue with Google' }}
          </button>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div class="info-box">
            <p class="info-text">
              By signing in, you'll be able to:
            </p>
            <ul class="features-list">
              <li>Create and manage your custom image prompts</li>
              <li>Save your favorite prompts</li>
              <li>Access your prompts from any device</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const { signInWithGoogle, isLoading, isAuthenticated, error } = useAuth()
const router = useRouter()

const signingIn = ref(false)

// Check if already authenticated
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    // Get redirect path from query or default to home
    const redirect = router.currentRoute.value.query.redirect as string || '/'
    router.push(redirect)
  }
}, { immediate: true })

const handleGoogleSignIn = async () => {
  signingIn.value = true
  const success = await signInWithGoogle()

  if (success) {
    // Navigation handled by watcher
    console.log('Sign in successful')
  }

  signingIn.value = false
}
</script>

<style scoped>
.login-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Comfortaa", "Alan Sans", sans-serif;
}

.login-container {
  width: 100%;
  max-width: 450px;
  padding: 2rem;
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 3rem 2.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 2.25rem;
  font-weight: 700;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 2.5rem;
  font-size: 1rem;
}

.loading-state {
  text-align: center;
  padding: 2rem 0;
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

.login-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 1.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  color: #333;
  font-size: 1.05rem;
  font-weight: 600;
  font-family: "Comfortaa", "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.google-btn:hover:not(:disabled) {
  border-color: #667eea;
  background: #f8f9ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.google-btn:active:not(:disabled) {
  transform: translateY(0);
}

.google-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.error-message {
  padding: 1rem;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  color: #c33;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 500;
}

.info-box {
  background: #f8f9ff;
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 0.5rem;
}

.info-text {
  color: #4a5568;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.features-list li {
  color: #667eea;
  font-size: 0.85rem;
  padding: 0.4rem 0;
  padding-left: 1.5rem;
  position: relative;
}

.features-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  font-weight: bold;
  color: #34a853;
}

@media (max-width: 640px) {
  .login-container {
    padding: 1rem;
  }

  .login-card {
    padding: 2rem 1.5rem;
  }

  h1 {
    font-size: 1.75rem;
  }

  .subtitle {
    font-size: 0.9rem;
  }

  .google-btn {
    font-size: 0.95rem;
    padding: 0.875rem 1.25rem;
  }
}
</style>
