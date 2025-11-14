import type { H3Event } from 'h3'
import { getAuth } from 'firebase-admin/auth'

/**
 * Get the authenticated user ID from the request
 * Returns null if the user is not authenticated or token is invalid
 */
export async function getAuthenticatedUserId(event: H3Event): Promise<string | null> {
  try {
    const authHeader = getHeader(event, 'authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.split('Bearer ')[1]

    if (!token) {
      return null
    }

    // Verify the ID token
    const decodedToken = await getAuth().verifyIdToken(token)
    return decodedToken.uid
  } catch (error) {
    console.error('Error verifying auth token:', error)
    return null
  }
}
