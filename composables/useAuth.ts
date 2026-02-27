import { ref, computed, onMounted } from 'vue'

/**
 * Auth composable backed by the admin session cookie.
 * Single-user personal site — authenticated = admin cookie present.
 */
export const useAuth = () => {
    const isAuthenticated = ref(false)
    const isLoading = ref(true)
    const error = ref<string | null>(null)

    onMounted(async () => {
        try {
            const data = await $fetch<{ authenticated: boolean }>('/api/admin/auth/check')
            isAuthenticated.value = data.authenticated
        } catch {
            isAuthenticated.value = false
        }
        isLoading.value = false
    })

    const userId = computed(() => isAuthenticated.value ? 'owner' : null)
    const displayName = computed(() => isAuthenticated.value ? 'Admin' : null)
    const email = computed<string | null>(() => null)
    const photoURL = computed<string | null>(() => null)

    // Kept for middleware compatibility — resolves once loading is done
    const currentUser = computed(() => isAuthenticated.value ? { uid: 'owner' } : null)

    const signInWithGoogle = async () => {
        await navigateTo('/admin/login')
        return false
    }

    const logout = async () => {
        try {
            await navigateTo('/api/admin/auth/logout')
            isAuthenticated.value = false
            return true
        } catch {
            error.value = 'Failed to sign out'
            return false
        }
    }

    return {
        isAuthenticated,
        isLoading,
        error,
        userId,
        displayName,
        email,
        photoURL,
        currentUser,
        signInWithGoogle,
        logout
    }
}
