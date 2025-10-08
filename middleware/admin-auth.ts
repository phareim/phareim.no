export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip auth check on login page
  if (to.path === '/admin/login') {
    return
  }

  // Check authentication status
  try {
    const { authenticated } = await $fetch('/api/admin/auth/check')

    if (!authenticated) {
      return navigateTo('/admin/login')
    }
  } catch (error) {
    console.error('Auth check error:', error)
    return navigateTo('/admin/login')
  }
})
