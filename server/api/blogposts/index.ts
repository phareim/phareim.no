import { defineEventHandler, getQuery, createError } from 'h3'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()

// Helper function to generate slug from title if not provided
function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        // Replace spaces and non-alphanumeric characters with hyphens
        .replace(/[^a-z0-9]+/g, '-')
        // Remove leading and trailing hyphens
        .replace(/^\-+|\-+$/g, '')
}

// Minimal parser similar to /api/blog to keep backward compatibility for GET
function parseMarkdownFile(filePath: string, slug: string) {
    try {
        const content = readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        let title = slug.replace(/-/g, ' ').replace(/^\d{4}-\d{2}-\d{2}-/, '')
        let date = new Date().toISOString().split('T')[0]
        let contentStart = 0
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
            const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/)
            if (dateMatch) {
                date = dateMatch[1]
                title = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ')
            }
        }
        const markdownContent = lines.slice(contentStart).join('\n').trim()
        const htmlContent = md.render(markdownContent)
        const textContent = markdownContent.replace(/[#*`]/g, '').trim()
        const firstParagraph = textContent.split('\n\n')[0]
        const excerpt = firstParagraph.length > 150 ? firstParagraph.substring(0, 150) + '...' : firstParagraph
        return { slug, title: title.charAt(0).toUpperCase() + title.slice(1), date, excerpt, content: htmlContent }
    } catch {
        return null
    }
}

export default defineEventHandler(async (event) => {
    if (event.method === 'GET') {
        const blogDir = join(process.cwd(), 'blog')
        if (!existsSync(blogDir)) {
            return { posts: [] }
        }
        const files = readdirSync(blogDir).filter(f => f.endsWith('.md'))
        const posts = files.map(file => parseMarkdownFile(join(blogDir, file), file.replace('.md', ''))).filter(Boolean)
        posts.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        return { posts }
    }

    // All write operations disabled in filesystem-backed mode
    throw createError({ statusCode: 410, statusMessage: 'Blog posts are now filesystem-backed. Writing via API is disabled.' })
})