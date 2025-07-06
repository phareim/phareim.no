import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '../../utils/firebase-admin'
import type { BlogPost } from '~/types/blogpost'
import { validateBlogPost, blogpostsCollection } from '~/types/blogpost'

export default defineEventHandler(async (event) => {
    try {
        const slug = getRouterParam(event, 'slug')
        if (!slug) {
            return {
                error: 'Blog post slug is required',
                status: 400
            }
        }

        const postRef = db.collection(blogpostsCollection).doc(slug)

        // GET request – retrieve blog post
        if (event.method === 'GET') {
            const doc = await postRef.get()
            if (!doc.exists) {
                return {
                    error: 'Blog post not found',
                    status: 404
                }
            }
            return { id: doc.id, ...doc.data() } as BlogPost
        }

        // PUT request – update blog post
        if (event.method === 'PUT') {
            const body = await readBody(event)

            if (!validateBlogPost({ ...body, slug })) {
                return {
                    error: 'Invalid blog post data. Title and content are required.',
                    status: 400
                }
            }

            const updateData: Partial<BlogPost> = {
                title: body.title,
                content: body.content,
                excerpt: body.excerpt,
                author: body.author,
                date: body.date,
                updatedAt: new Date()
            }

            await postRef.update(updateData)

            return {
                id: slug,
                ...updateData
            }
        }

        // DELETE request – delete blog post
        if (event.method === 'DELETE') {
            const doc = await postRef.get()
            if (!doc.exists) {
                return {
                    error: 'Blog post not found',
                    status: 404
                }
            }

            await postRef.delete()
            return { message: 'Blog post deleted successfully', id: slug }
        }

        // Method not allowed
        return {
            error: 'Method not allowed',
            status: 405
        }
    } catch (error: any) {
        console.error('Error in blogpost handler:', error)
        return {
            error: 'Internal server error',
            details: error?.message || 'Unknown error',
            status: 500
        }
    }
})