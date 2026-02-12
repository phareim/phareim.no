import { defineEventHandler } from 'h3'
import { readdir } from 'fs/promises'
import { join } from 'path'

// Theme metadata mapping
const themeMetadata = {
  'scandinavian': {
    id: 'scandi',
    name: 'Scandinavian Glass',
    icon: '❄️',
    description: 'Clean, minimal, frosted glass design'
  },
  'hacker': {
    id: 'hacker',
    name: 'Cyberpunk',
    icon: '📟',
    description: 'High contrast, terminal-inspired aesthetic'
  },
  'tolkien': {
    id: 'tolkien',
    name: 'Fantasy',
    icon: '📜',
    description: 'Middle-earth inspired theme'
  },
  'cartoon': {
    id: 'cartoon',
    name: 'Cartoon',
    icon: '🍄',
    description: 'Super Mario-inspired vibrant cartoon theme'
  }
}

export default defineEventHandler(async (event) => {
  try {
    // Read the themes directory
    const themesDir = join(process.cwd(), 'assets', 'themes')
    const files = await readdir(themesDir)

    // Filter CSS files and map to theme objects
    const themes = files
      .filter(file => file.endsWith('.css'))
      .map(file => {
        const themeName = file.replace('.css', '')
        const metadata = themeMetadata[themeName]

        if (metadata) {
          return {
            ...metadata,
            file: file
          }
        }

        // Fallback for themes without metadata
        return {
          id: themeName,
          name: themeName.charAt(0).toUpperCase() + themeName.slice(1),
          icon: '🎨',
          file: file,
          description: `${themeName} theme`
        }
      })
      .filter(theme => theme !== null)

    return themes
  } catch (error) {
    console.error('Error reading themes directory:', error)

    // Fallback to hardcoded themes if reading fails
    return [
      { id: 'scandi', name: 'Scandinavian Glass', icon: '❄️', file: 'scandinavian.css' },
      { id: 'hacker', name: 'Cyberpunk', icon: '📟', file: 'hacker.css' },
      { id: 'tolkien', name: 'Fantasy', icon: '📜', file: 'tolkien.css' },
      { id: 'cartoon', name: 'Cartoon', icon: '🍄', file: 'cartoon.css' }
    ]
  }
})
