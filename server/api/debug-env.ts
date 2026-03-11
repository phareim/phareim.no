export default defineEventHandler(() => {
    const config = useRuntimeConfig()
    return {
        hasVeniceKey: !!config.veniceKey,
        hasOpenaiKey: !!config.openaiApiKey,
        hasFalKey: !!config.falKey,
        hasAdminPassword: !!config.adminPassword,
        hasWavespeedKey: !!config.wavespeedKey,
    }
})
