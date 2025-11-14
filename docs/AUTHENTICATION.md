# Authentication Guide

## Overview

The application uses Firebase Authentication with Google Sign-In for user authentication. This allows users to manage their personal image prompts and access user-specific features.

## Pages

### `/login`
- **Purpose**: Sign in with Google
- **Features**:
  - Google OAuth popup authentication
  - Auto-redirect to original page after login (via `?redirect` query param)
  - Auto-redirect to home if already authenticated
  - Error handling for popup blockers and cancelled sign-ins

### `/account`
- **Purpose**: User profile and account management
- **Features**:
  - Display user profile (name, email, photo, user ID)
  - Quick actions to navigate to features
  - Inline prompt manager (expandable)
  - Sign out functionality
  - Auto-redirect to login if not authenticated

## Composable

### `useAuth()`

The auth composable provides reactive authentication state and methods.

#### State
```typescript
const {
  currentUser,      // User | null - Current Firebase user object
  isLoading,        // boolean - Loading state during auth initialization
  error,            // string | null - Error message if auth fails
  isAuthenticated,  // boolean - Whether user is signed in
  displayName,      // string | null - User's display name
  email,            // string | null - User's email
  photoURL,         // string | null - User's profile photo URL
  userId,           // string | null - User's unique ID
} = useAuth()
```

#### Methods
```typescript
const {
  signInWithGoogle, // () => Promise<boolean> - Sign in with Google
  logout,           // () => Promise<boolean> - Sign out
} = useAuth()
```

#### Example Usage

**Basic Authentication Check**
```vue
<script setup>
const { isAuthenticated, displayName } = useAuth()
</script>

<template>
  <div v-if="isAuthenticated">
    Welcome, {{ displayName }}!
  </div>
  <div v-else>
    <NuxtLink to="/login">Sign In</NuxtLink>
  </div>
</template>
```

**Sign In**
```typescript
const { signInWithGoogle, error } = useAuth()

const handleSignIn = async () => {
  const success = await signInWithGoogle()

  if (success) {
    // User signed in successfully
    navigateTo('/account')
  } else {
    // Check error.value for error message
    console.error(error.value)
  }
}
```

**Sign Out**
```typescript
const { logout } = useAuth()

const handleSignOut = async () => {
  const success = await logout()

  if (success) {
    navigateTo('/')
  }
}
```

**Protected Route Pattern**
```vue
<script setup>
const { isAuthenticated, isLoading } = useAuth()
const router = useRouter()

watch(isLoading, (loading) => {
  if (!loading && !isAuthenticated.value) {
    router.push('/login?redirect=' + router.currentRoute.value.path)
  }
})
</script>
```

## Integration with API

API endpoints can check for authenticated users by reading the Firebase ID token from the Authorization header.

### Server-Side Auth Check

**Example API Endpoint**
```typescript
import { getAuthenticatedUserId } from '~/server/utils/user-auth'

export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event)

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  // User is authenticated, proceed with request
  // userId contains the Firebase user ID
})
```

### Client-Side API Calls with Auth

**Using the composable**
```typescript
const { currentUser } = useAuth()

// Get auth token
const token = await currentUser.value?.getIdToken()

// Make authenticated request
const response = await fetch('/api/some-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

**Using useImagePrompts composable (recommended)**
```typescript
// The useImagePrompts composable automatically handles auth
const { listUserPrompts } = useImagePrompts()

// This will automatically include auth token if user is signed in
const { prompts } = await listUserPrompts()
```

## Flow Diagrams

### Sign In Flow
```
User visits /login
  ↓
Clicks "Continue with Google"
  ↓
Google OAuth popup opens
  ↓
User selects Google account
  ↓
Firebase verifies with Google
  ↓
User object stored in Firebase Auth
  ↓
onAuthStateChanged fires
  ↓
User redirected to original page or home
```

### Protected Resource Flow
```
User requests protected resource
  ↓
Client gets Firebase ID token
  ↓
Token sent in Authorization header
  ↓
Server verifies token with Firebase Admin
  ↓
If valid: Return user's data
If invalid: Return 401 Unauthorized
```

### User-Specific Prompts Flow
```
User requests random prompt
  ↓
API checks auth status
  ↓
If authenticated:
  - Check for user prompts in Firestore
  - If none exist: Initialize by copying defaults
  - Return random user prompt
If not authenticated:
  - Return random default prompt
```

## Security Notes

1. **Never expose Firebase Admin credentials** - They are server-side only
2. **ID tokens expire** - Firebase automatically refreshes them
3. **Always verify tokens server-side** - Don't trust client-side auth state for sensitive operations
4. **Use HTTPS in production** - Required for secure token transmission

## Environment Variables

Make sure these are set in your `.env` file:

```bash
# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key

# Firebase Client (Public)
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## Troubleshooting

### Popup Blocked
If the Google sign-in popup is blocked:
- The error message will indicate this
- User needs to allow popups for the site
- Some browsers require user interaction (button click) to allow popups

### Token Verification Fails
If server-side token verification fails:
- Check that Firebase Admin is properly initialized
- Verify environment variables are set correctly
- Ensure the token is being sent in the correct format: `Bearer <token>`

### User Not Persisting
If user state is lost on refresh:
- Firebase Auth automatically persists to localStorage
- Check that localStorage is not being cleared
- Verify Firebase is properly initialized in the plugin

## Future Enhancements

Potential improvements to consider:

1. **Email/Password Auth** - Add traditional email/password sign-in
2. **Social Providers** - Add Facebook, Twitter, etc.
3. **Email Verification** - Require email verification
4. **Multi-Factor Auth** - Add 2FA support
5. **Role-Based Access** - Add user roles and permissions
6. **Session Management** - Add session timeout and refresh
