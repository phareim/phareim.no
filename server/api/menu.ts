import { defineEventHandler } from 'h3'
import fs from 'fs'
import path from 'path'

export default defineEventHandler(async () => {
  const draftsPath = path.join(process.cwd(), 'pages/drafts')
  
  try {
    const files = fs.readdirSync(draftsPath)
    const menuItems = files
      .filter(file => file.endsWith('.vue') && file !== 'index.vue')
      .map(file => {
        const name = file.replace('.vue', '')
        return {
          path: `/drafts/${name}`,
          title: name.charAt(0).toUpperCase() + name.slice(1)
        }
      })
      .sort((a, b) => a.title.localeCompare(b.title))

    return menuItems
  } catch (error) {
    console.error('Error reading drafts directory:', error)
    return []
  }
}) 