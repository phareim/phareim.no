export default defineEventHandler(async (event) => {
    // Clear session cookie
    setCookie(event, 'admin-session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0,
        path: '/'
    })

    return {
        success: true,
        message: 'Logged out successfully'
    }
})
