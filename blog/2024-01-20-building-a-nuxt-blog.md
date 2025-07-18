---
title: "Building a Nuxt.js Blog with Markdown"
date: "2024-01-20"
---

# Building a Nuxt.js Blog with Markdown

Today I want to share how I built this blog system using Nuxt.js and markdown files. It's a simple but effective approach that gives you full control over your content.

## The Architecture

The blog system consists of several key components:

### 1. File-based Content
All blog posts are stored as markdown files in the `/blog/` directory. This approach has several advantages:

- **Version control** - Your content is versioned along with your code
- **Simplicity** - No database setup required
- **Portability** - Easy to migrate or backup
- **Performance** - Static content loads fast

### 2. API Endpoint
The `/api/blog` endpoint reads the markdown files and parses them into JSON. It handles:

- Front matter parsing (title, date, etc.)
- Markdown to HTML conversion using `markdown-it`
- Automatic excerpt generation
- Date-based sorting

### 3. Vue.js Frontend
The blog page (`/blog`) provides a clean interface that:

- Lists all blog posts
- Shows individual posts when clicked
- Includes a back button for navigation
- Supports both light and dark themes

## Code Example

Here's how the API endpoint parses markdown files:

```typescript
function parseMarkdownFile(filePath: string, slug: string): BlogPost | null {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  // Parse front matter
  if (lines[0]?.trim() === '---') {
    // Extract metadata...
  }
  
  // Convert markdown to HTML
  const htmlContent = md.render(markdownContent)
  
  return { slug, title, date, excerpt, content: htmlContent }
}
```

## Benefits of This Approach

1. **Fast Development** - No complex CMS setup
2. **Great SEO** - Server-side rendering with Nuxt.js
3. **Developer Friendly** - Write posts in your favorite editor
4. **Customizable** - Full control over styling and functionality

This approach works great for personal blogs, documentation sites, or any project where you want to keep things simple and maintainable.


What do you think? Have you built similar systems before?