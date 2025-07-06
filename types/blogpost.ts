export interface BlogPost {
    id?: string;
    slug: string;
    title: string;
    content: string;
    excerpt?: string;
    author?: string;
    date?: string; // ISO string (YYYY-MM-DD)
    createdAt: Date;
    updatedAt: Date;
}

export const blogpostsCollection = 'blogposts'

// Helper function to validate required blog post fields
export function validateBlogPost(post: Partial<BlogPost>): boolean {
    return !!(post.title && post.content)
}