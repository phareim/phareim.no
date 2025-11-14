# Image Prompts API Documentation

## Overview

The Image Prompts API allows users to manage their personal image generation prompts. The system supports both default prompts (for non-authenticated users) and user-specific prompts (for authenticated users).

## Authentication

All user-specific endpoints require authentication via Firebase ID token passed in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## Endpoints

### Get Random Prompt

Returns a random prompt for image generation. Uses user-specific prompts if authenticated, otherwise uses default prompts.

**Endpoint:** `GET /api/image-prompts/random`

**Headers:**
- `Authorization: Bearer <token>` (optional)

**Response:**
```json
{
  "prompt": "A serene mountain landscape at sunrise...",
  "id": "abc123",
  "isUserSpecific": true
}
```

**Notes:**
- For authenticated users on first use, automatically initializes their prompts by copying default prompts
- Returns `isUserSpecific: true` when returning a user's personal prompt

---

### List User Prompts

Get all prompts for the authenticated user.

**Endpoint:** `GET /api/image-prompts/user`

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "prompts": [
    {
      "id": "abc123",
      "prompt": "A serene mountain landscape...",
      "category": "nature",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "copiedFrom": "xyz789"
    }
  ],
  "count": 2
}
```

**Notes:**
- Prompts are ordered by creation date (newest first)
- `copiedFrom` field indicates if prompt was initialized from a default prompt

---

### Create User Prompt

Create a new prompt for the authenticated user.

**Endpoint:** `POST /api/image-prompts/user`

**Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "prompt": "A cyberpunk street scene with neon reflections in puddles",
  "category": "scifi"
}
```

**Response:**
```json
{
  "id": "new123",
  "prompt": "A cyberpunk street scene with neon reflections in puddles",
  "category": "scifi",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "message": "Prompt created successfully"
}
```

**Validation:**
- `prompt` is required and must be a non-empty string
- `category` is optional (defaults to "custom")

---

### Get Single Prompt

Get a specific prompt by ID.

**Endpoint:** `GET /api/image-prompts/user/{id}`

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "id": "abc123",
  "prompt": "A serene mountain landscape...",
  "category": "nature",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "statusMessage": "Prompt not found"
}
```

---

### Update User Prompt

Update an existing prompt.

**Endpoint:** `PATCH /api/image-prompts/user/{id}`

**Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "prompt": "Updated prompt text",
  "category": "updated-category"
}
```

**Notes:**
- Both `prompt` and `category` are optional
- Only provided fields will be updated
- `updatedAt` timestamp is automatically set

**Response:**
```json
{
  "id": "abc123",
  "prompt": "Updated prompt text",
  "category": "updated-category",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T12:00:00.000Z",
  "message": "Prompt updated successfully"
}
```

**Validation:**
- If `prompt` is provided, it must be a non-empty string
- If `category` is provided, it must be a string

---

### Delete User Prompt

Delete a prompt.

**Endpoint:** `DELETE /api/image-prompts/user/{id}`

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "id": "abc123",
  "message": "Prompt deleted successfully"
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "statusMessage": "Prompt not found"
}
```

---

## Database Structure

### Default Prompts Collection
```
image-prompts/
  {promptId}/
    - prompt: string
    - category: string
    - createdAt: timestamp
```

### User Prompts Collection
```
user-prompts/
  {userId}/
    prompts/
      {promptId}/
        - prompt: string
        - category: string
        - createdAt: timestamp
        - updatedAt: timestamp
        - copiedFrom: string (optional)
```

## Error Responses

All endpoints return consistent error responses:

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "statusMessage": "Authentication required"
}
```

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "statusMessage": "Prompt is required and must be a non-empty string"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "statusMessage": "Prompt not found"
}
```

**405 Method Not Allowed:**
```json
{
  "statusCode": 405,
  "statusMessage": "Method POST not allowed"
}
```

**500 Internal Server Error:**
```json
{
  "statusCode": 500,
  "statusMessage": "Failed to fetch prompts",
  "data": {
    "details": "Detailed error message"
  }
}
```

## Example Usage (JavaScript)

### Getting a random prompt with authentication

```javascript
// Get Firebase ID token
const auth = getAuth()
const user = auth.currentUser
const token = await user.getIdToken()

// Fetch random prompt
const response = await fetch('/api/image-prompts/random', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const data = await response.json()
console.log(data.prompt) // "A serene mountain landscape..."
```

### Creating a new prompt

```javascript
const token = await auth.currentUser.getIdToken()

const response = await fetch('/api/image-prompts/user', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'A magical forest with bioluminescent plants',
    category: 'fantasy'
  })
})

const data = await response.json()
console.log(data.id) // "new123"
```

### Updating a prompt

```javascript
const token = await auth.currentUser.getIdToken()
const promptId = 'abc123'

const response = await fetch(`/api/image-prompts/user/${promptId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'Updated magical forest with glowing mushrooms'
  })
})

const data = await response.json()
console.log(data.message) // "Prompt updated successfully"
```

### Deleting a prompt

```javascript
const token = await auth.currentUser.getIdToken()
const promptId = 'abc123'

const response = await fetch(`/api/image-prompts/user/${promptId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const data = await response.json()
console.log(data.message) // "Prompt deleted successfully"
```
