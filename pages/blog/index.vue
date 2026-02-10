<template>
  <div class="blog-container">
    <div class="blog-list">
      <h1>Blog</h1>
      <div v-if="loading" class="loading">Loading blog posts...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="posts.length === 0" class="no-posts">No blog posts found.</div>
      <div v-else class="posts-grid">
        <NuxtLink v-for="post in posts" :key="post.slug" class="post-card" :to="`/blog/${post.slug}`">
          <h2>{{ post.title }}</h2>
          <p class="post-meta">{{ formatDate(post.date) }}</p>
          <p class="post-excerpt">{{ post.excerpt }}</p>
        </NuxtLink>
      </div>
    </div>
  </div>

</template>

<script>
export default {
  data() {
    return {
      posts: [],
      loading: true,
      error: null
    }
  },
  async mounted() {
    document.body.classList.add('scrollable');
    await this.loadPosts()
  },
  beforeDestroy() {
    document.body.classList.remove('scrollable');
  },
  methods: {
    async loadPosts() {
      try {
        this.loading = true
        const response = await fetch('/api/blog')
        if (!response.ok) {
          throw new Error('Failed to fetch blog posts')
        }

        const data = await response.json()
        this.posts = Array.isArray(data) ? data : []
      } catch (error) {
        this.error = error.message
        console.error('Error loading blog posts:', error)
      } finally {
        this.loading = false
      }
    },
    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('nb-NO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
  }
}
</script>

<style scoped>
.blog-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: var(--theme-font-body, 'Comfortaa', sans-serif);
  color: var(--theme-text, #333);
}

.blog-list h1 {
  font-size: 3rem;
  margin-bottom: 2rem;
  text-align: center;
  color: var(--theme-text, #333);
}

.loading, .error, .no-posts {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}

.error {
  color: var(--theme-accent-danger, #e74c3c);
}

.posts-grid {
  display: grid;
  gap: 2rem;
}

.post-card {
  padding: 1.5rem;
  border: 1px solid var(--theme-card-border, #ddd);
  border-radius: var(--theme-card-radius, 8px);
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--theme-card-bg, white);
}

.post-card:hover {
  box-shadow: 0 4px 12px var(--theme-card-shadow, rgba(0, 0, 0, 0.1));
  transform: translateY(-2px);
}

.post-card h2 {
  margin: 0 0 0.5rem 0;
  color: var(--theme-text, #333);
  font-size: 1.5rem;
}

.post-meta {
  color: var(--theme-text-muted, #666);
  font-size: 0.9rem;
  margin: 0 0 1rem 0;
}

.post-excerpt {
  color: var(--theme-text-muted, #666);
  line-height: 1.6;
  margin: 0;
}

.post-content {
  line-height: 1.8;
  color: var(--theme-text, #333);
}

.post-content h1,
.post-content h2,
.post-content h3,
.post-content h4,
.post-content h5,
.post-content h6 {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.post-content p {
  margin-bottom: 1rem;
}

.post-content code {
  background: var(--theme-bg-alt, #f4f4f4);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: monospace;
}

.post-content pre {
  background: var(--theme-bg-alt, #f4f4f4);
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
