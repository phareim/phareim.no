# Character Image Generation Service 🎨

This service generates character images using fal.ai and uploads them to Firebase Storage.

## API Endpoints

### Generate Character Image

**POST** `/api/characters/generate-image`

Generates a character image based on a text prompt and uploads it to Firebase Storage.

#### Request Body
```json
{
  "prompt": "a brave female warrior with silver armor and blue eyes",
  "characterId": "optional-character-id"
}
```

#### Response
```json
{
  "success": true,
  "imageUrl": "https://firebasestorage.googleapis.com/v0/b/phareim-no.firebasestorage.app/o/characters%2Ftest-123-uuid.jpg?alt=media",
  "originalUrl": "https://fal.ai/generated-image-url"
}
```

### Create Character with Image

**POST** `/api/characters`

Creates a new character and optionally generates an image for them.

#### Request Body
```json
{
  "name": "Aria the Brave",
  "background": "A heroic warrior from the northern kingdoms",
  "generateImage": true,
  "imagePrompt": "a heroic warrior with shining armor standing proudly"
}
```

## Image Generation Details

### Standard Prompt
All generated images include this base prompt for consistency:
```
"flat white background, AAA hollywood blockbuster, realistic photography, 
masterwork portrait quality, standing with eye contact,
bold expressive photo artwork, highest quality ,
standing in basic position,
full body portrait, 
highest quality,  
epic fantasy, gritty fantasy,
steampunk aesthetics, "
```

Your custom prompt is appended to this standard prompt.

### Firebase Storage
- Images are stored in the `characters/` folder
- Filenames follow the pattern: `characters/{characterId}-{uuid}.jpg`
- Images are made publicly accessible
- Metadata includes generation timestamp and character ID

## Usage Examples

### Direct Image Generation
```javascript
const response = await fetch('/api/characters/generate-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'a mystical elf wizard with glowing staff',
    characterId: 'elf-wizard-001'
  })
})

const result = await response.json()
console.log('Generated image URL:', result.imageUrl)
```

### Character Creation with Image
```javascript
const response = await fetch('/api/characters', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Gandalf the Grey',
    background: 'A wise wizard of Middle-earth',
    generateImage: true,
    imagePrompt: 'an old wise wizard with grey robes and staff'
  })
})

const character = await response.json()
console.log('Character with image:', character)
```

## Testing

Run the test script to verify the service is working:

```bash
# Make sure your development server is running first
npm run dev

# In another terminal, run the test
node test-character-image.js
```

## Environment Requirements

Make sure you have the following environment variables configured:
- Firebase Admin credentials (for Firebase Storage)
- fal.ai API key (configured in @fal-ai/client)

## Error Handling

The service includes robust error handling:
- Image generation failures are logged but don't break character creation
- Firebase upload errors are caught and reported
- Invalid requests return appropriate HTTP status codes

## File Structure

```
server/
├── api/
│   └── characters/
│       ├── index.ts              # Main character API (with image integration)
│       └── generate-image.ts     # Image generation service
└── utils/
    └── firebase-admin.ts         # Firebase configuration (includes Storage)
```
