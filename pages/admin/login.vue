<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <h1>🔐 Admin Login</h1>
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              v-model="password"
              placeholder="Enter admin password"
              required
              autofocus
            />
          </div>
          <button type="submit" :disabled="loading" class="login-btn">
            {{ loading ? 'Logging in...' : 'Login' }}
          </button>
          <div v-if="error" class="error-message">
            {{ error }}
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/admin/auth/login', {
      method: 'POST',
      body: {
        password: password.value
      }
    })

    if (response.success) {
      // Redirect to admin dashboard
      navigateTo('/admin')
    }
  } catch (err) {
    error.value = 'Invalid password'
    password.value = ''
  } finally {
    loading.value = false
  }
}

// Check if already authenticated
onMounted(async () => {
  try {
    const { authenticated } = await $fetch('/api/admin/auth/check')
    if (authenticated) {
      navigateTo('/admin')
    }
  } catch (err) {
    // Not authenticated, stay on login page
  }
})
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
  font-family: "Alan Sans", sans-serif;
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}

.login-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 3rem 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  color: white;
  margin-bottom: 2rem;
  font-size: 2rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  color: white;
  margin-bottom: 0.5rem;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
  font-family: "Alan Sans", sans-serif;
  transition: all 0.3s ease;
}

input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.login-btn {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #667eea;
  font-size: 1.1rem;
  font-weight: bold;
  font-family: "Alan Sans", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.login-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(220, 53, 69, 0.9);
  color: white;
  border-radius: 8px;
  text-align: center;
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .login-card {
    background: rgba(0, 0, 0, 0.3);
  }
}
</style>
