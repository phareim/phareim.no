import { ref, computed } from 'vue'
import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User
} from 'firebase/auth'

/**
 * Composable for Firebase Authentication
 * Handles Google sign-in, sign-out, and auth state
 */
export const useAuth = () => {
  const { $firebase } = useNuxtApp()
  const auth = $firebase?.auth

  const currentUser = ref<User | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  // Listen to auth state changes
  if (auth && typeof window !== 'undefined') {
    onAuthStateChanged(auth, (user) => {
      currentUser.value = user
      isLoading.value = false
    })
  }

  /**
   * Sign in with Google popup
   */
  const signInWithGoogle = async () => {
    if (!auth) {
      error.value = 'Firebase auth is not initialized'
      return false
    }

    error.value = null

    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({
        prompt: 'select_account'
      })

      const result = await signInWithPopup(auth, provider)
      currentUser.value = result.user

      console.log('Signed in:', result.user.displayName)
      return true
    } catch (err: any) {
      console.error('Sign in error:', err)

      // Handle specific error codes
      if (err.code === 'auth/popup-closed-by-user') {
        error.value = 'Sign in cancelled'
      } else if (err.code === 'auth/popup-blocked') {
        error.value = 'Popup was blocked. Please allow popups for this site.'
      } else {
        error.value = err.message || 'Failed to sign in with Google'
      }

      return false
    }
  }

  /**
   * Sign out current user
   */
  const logout = async () => {
    if (!auth) {
      error.value = 'Firebase auth is not initialized'
      return false
    }

    error.value = null

    try {
      await signOut(auth)
      currentUser.value = null

      console.log('Signed out')
      return true
    } catch (err: any) {
      console.error('Sign out error:', err)
      error.value = err.message || 'Failed to sign out'
      return false
    }
  }

  /**
   * Check if user is authenticated
   */
  const isAuthenticated = computed(() => !!currentUser.value)

  /**
   * Get user display name
   */
  const displayName = computed(() => currentUser.value?.displayName || null)

  /**
   * Get user email
   */
  const email = computed(() => currentUser.value?.email || null)

  /**
   * Get user photo URL
   */
  const photoURL = computed(() => currentUser.value?.photoURL || null)

  /**
   * Get user ID
   */
  const userId = computed(() => currentUser.value?.uid || null)

  return {
    currentUser,
    isLoading,
    error,
    isAuthenticated,
    displayName,
    email,
    photoURL,
    userId,
    signInWithGoogle,
    logout
  }
}
