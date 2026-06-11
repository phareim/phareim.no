export default defineEventHandler((event) => {
    const config = useRuntimeConfig()

    // Check Cloudflare env bindings directly (booleans only — never
    // enumerate binding/secret names on a public endpoint)
    const cf = (event.context.cloudflare?.env || {}) as Record<string, unknown>

    return {
        runtimeConfig: {
            hasVeniceKey: !!config.veniceKey,
        },
        cloudflareEnv: {
            hasDB: !!cf.DB,
            hasBucket: !!cf.BUCKET,
        },
        processEnv: {
            hasVeniceKey: !!process.env.VENICE_KEY,
            hasNuxtVeniceKey: !!process.env.NUXT_VENICE_KEY,
        }
    }
})
