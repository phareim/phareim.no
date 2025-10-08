export default defineEventHandler(async (event) => {
    const cookie = getCookie(event, 'admin-session')

    return {
        authenticated: cookie === 'authenticated'
    }
})
