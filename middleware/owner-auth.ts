export default defineNuxtRouteMiddleware(async (to, from) => {
  const { currentUser, isLoading } = useAuth()

  // Wait for auth to initialize on client
  if (import.meta.client && isLoading.value) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(isLoading, (val) => {
        if (!val) {
          unwatch()
          resolve()
        }
      })
    })
  }

  if (!currentUser.value) {
    return navigateTo(`/login?redirect=${to.path}`)
  }

  try {
    const token = await currentUser.value.getIdToken()
    await $fetch('/api/auth/check-email', {
      headers: { authorization: `Bearer ${token}` }
    })
  } catch {
    return navigateTo('/')
  }
})
