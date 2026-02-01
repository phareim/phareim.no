import { getAuth } from 'firebase-admin/auth'

const ALLOWED_EMAIL = 'phareim@gmail.com'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({ status: 401, statusText: 'Not authenticated' })
  }

  const token = authHeader.split('Bearer ')[1]

  if (!token) {
    throw createError({ status: 401, statusText: 'Not authenticated' })
  }

  const decodedToken = await getAuth().verifyIdToken(token)

  if (decodedToken.email !== ALLOWED_EMAIL) {
    throw createError({ status: 403, statusText: 'Forbidden' })
  }

  return { authorized: true }
})
