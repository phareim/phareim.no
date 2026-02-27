export default defineNuxtRouteMiddleware(async () => {
    // Only run on client side
    if (import.meta.server) return

    try {
        const data = await $fetch<{ authenticated: boolean }>('/api/admin/auth/check')
        if (!data.authenticated) {
            return navigateTo('/admin/login')
        }
    } catch {
        return navigateTo('/admin/login')
    }
})
