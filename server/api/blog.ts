import { defineEventHandler, getQuery, createError } from 'h3'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()

interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  content: string
}

function parseMarkdownFile(filePath: string, slug: string): BlogPost | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    
    // Extract metadata from front matter or first lines
    let title = slug.replace(/-/g, ' ').replace(/^\d{4}-\d{2}-\d{2}-/, '')
    let date = new Date().toISOString().split('T')[0]
    let contentStart = 0
    
    // Check for front matter (lines starting with ---)
    if (lines[0]?.trim() === '---') {
      const frontMatterEnd = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
      if (frontMatterEnd !== -1) {
        for (let i = 1; i < frontMatterEnd; i++) {
          const line = lines[i]
          if (line.startsWith('title:')) {
            title = line.replace('title:', '').trim().replace(/['"]/g, '')
          } else if (line.startsWith('date:')) {
            date = line.replace('date:', '').trim()
          }
        }
        contentStart = frontMatterEnd + 1
      }
    } else {
      // Try to extract date from filename (YYYY-MM-DD-title.md format)
      const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/)
      if (dateMatch) {
        date = dateMatch[1]
        title = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ')
      }
    }
    
    // Get the content after front matter
    const markdownContent = lines.slice(contentStart).join('\n').trim()
    const htmlContent = md.render(markdownContent)
    
    // Create excerpt from first paragraph or first 150 characters
    const textContent = markdownContent.replace(/[#*`]/g, '').trim()
    const firstParagraph = textContent.split('\n\n')[0]
    const excerpt = firstParagraph.length > 150 
      ? firstParagraph.substring(0, 150) + '...' 
      : firstParagraph
    
    return {
      slug,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      date,
      excerpt,
      content: htmlContent
    }
  } catch (error) {
    console.error(`Error parsing markdown file ${filePath}:`, error)
    return null
  }
}

export default defineEventHandler(async (event) => {
  try {
    const blogDir = join(process.cwd(), 'blog')
    
    // Check if blog directory exists
    if (!existsSync(blogDir)) {
      return []
    }
    
    const files = readdirSync(blogDir)
    const markdownFiles = files.filter(file => file.endsWith('.md'))
    
    const posts: BlogPost[] = []
    
    for (const file of markdownFiles) {
      const filePath = join(blogDir, file)
      const slug = file.replace('.md', '')
      const post = parseMarkdownFile(filePath, slug)
      
      if (post) {
        posts.push(post)
      }
    }
    
    // Sort posts by date (newest first)
    posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    return posts
  } catch (error) {
    console.error('Error reading blog posts:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error reading blog posts'
    })
  }
})