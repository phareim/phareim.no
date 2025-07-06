import { defineEventHandler, getQuery, readBody } from 'h3'
import { db } from '../../utils/firebase-admin'
import type { BlogPost } from '~/types/blogpost'
import { validateBlogPost, blogpostsCollection } from '~/types/blogpost'
import type { Query, CollectionReference } from 'firebase-admin/firestore'

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

export default defineEventHandler(async (event) => {
    try {
        // GET request – retrieve list of blog posts
        if (event.method === 'GET') {
            const query = getQuery(event)
            const { author } = query as { author?: string }

            let postsRef: Query | CollectionReference = db.collection(blogpostsCollection)

            if (author) {
                postsRef = postsRef.where('author', '==', author)
            }

            // Order by creation date (newest first) if the field exists
            postsRef = (postsRef as CollectionReference).orderBy?.('createdAt', 'desc') || postsRef

            const snapshot = await postsRef.get()
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BlogPost[]

            return { posts }
        }

        // POST request – create a new blog post
        if (event.method === 'POST') {
            const body = await readBody(event)

            if (!validateBlogPost(body)) {
                return {
                    error: 'Invalid blog post data. Title and content are required.',
                    status: 400
                }
            }

            const slug = body.slug ? String(body.slug) : slugify(body.title)
            const postRef = db.collection(blogpostsCollection).doc(slug)
            const existing = await postRef.get()

            if (existing.exists) {
                return {
                    error: 'A blog post with this slug already exists',
                    status: 409
                }
            }

            const now = new Date()
            const postData: Omit<BlogPost, 'id'> = {
                slug,
                title: body.title,
                content: body.content,
                excerpt: body.excerpt || (body.content.length > 150 ? body.content.substring(0, 147) + '...' : body.content),
                author: body.author,
                date: body.date || now.toISOString().split('T')[0],
                createdAt: now,
                updatedAt: now
            }

            await postRef.set(postData)

            return {
                id: slug,
                ...postData
            }
        }

        // Method not allowed
        return {
            error: 'Method not allowed',
            status: 405
        }
    } catch (error: any) {
        console.error('Error in blogposts handler:', error)
        return {
            error: 'Internal server error',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
})