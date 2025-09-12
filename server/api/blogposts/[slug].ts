import { defineEventHandler, getRouterParam, createError } from 'h3'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()

export default defineEventHandler(async (event) => {
    const slug = getRouterParam(event, 'slug')
    if (!slug) {
        throw createError({ statusCode: 400, statusMessage: 'Blog post slug is required' })
    }

    if (event.method === 'GET') {
        const blogDir = join(process.cwd(), 'blog')
        const filePath = join(blogDir, `${slug}.md`)
        if (!existsSync(filePath)) {
            throw createError({ statusCode: 404, statusMessage: 'Blog post not found' })
        }
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
        return { slug, title: title.charAt(0).toUpperCase() + title.slice(1), date, content: htmlContent }
    }

    // All write operations disabled in filesystem-backed mode
    throw createError({ statusCode: 410, statusMessage: 'Blog posts are now filesystem-backed. Writing via API is disabled.' })
})