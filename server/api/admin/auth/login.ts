export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const body = await readBody(event)

    if (!body.password) {
        throw createError({
            status: 400,
            statusText: 'Password is required'
        })
    }

    // Simple password comparison
    if (body.password === config.adminPassword) {
        // Set session cookie (valid for 24 hours)
        setCookie(event, 'admin-session', 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/'
        })

        return {
            success: true,
            message: 'Authentication successful'
        }
    } else {
        throw createError({
            status: 401,
            statusText: 'Invalid password'
        })
    }
})
