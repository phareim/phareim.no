export default defineEventHandler((event) => {
    const config = useRuntimeConfig()

    // Check Cloudflare env bindings directly
    const cf = (event.context.cloudflare?.env || {}) as Record<string, unknown>
    const cfKeys = Object.keys(cf)

    return {
        runtimeConfig: {
            hasVeniceKey: !!config.veniceKey,
            hasAdminPassword: !!config.adminPassword,
        },
        cloudflareEnvKeys: cfKeys,
        processEnv: {
            hasVeniceKey: !!process.env.VENICE_KEY,
            hasNuxtVeniceKey: !!process.env.NUXT_VENICE_KEY,
        }
    }
})
