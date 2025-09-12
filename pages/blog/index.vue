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
    }
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
  font-family: 'Comfortaa', sans-serif;
}

.blog-list h1 {
  font-size: 3rem;
  margin-bottom: 2rem;
  text-align: center;
  color: #333;
}

.loading, .error, .no-posts {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}

.error {
  color: #e74c3c;
}

.posts-grid {
  display: grid;
  gap: 2rem;
}

.post-card {
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.post-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.post-card h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.5rem;
}

.post-meta {
  color: #666;
  font-size: 0.9rem;
  margin: 0 0 1rem 0;
}

.post-excerpt {
  color: #666;
  line-height: 1.6;
  margin: 0;
}

.back-button {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 2rem;
  font-family: 'Comfortaa', sans-serif;
  transition: background-color 0.3s ease;
}

.back-button:hover {
  background: #2980b9;
}

.blog-post h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.post-content {
  line-height: 1.8;
  color: #333;
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
  background: #f4f4f4;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: monospace;
}

.post-content pre {
  background: #f4f4f4;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

@media (prefers-color-scheme: dark) {
  .blog-container {
    color: #fff;
  }
  
  .blog-list h1,
  .post-card h2,
  .blog-post h1 {
    color: #fff;
  }
  
  .post-card {
    background: #333;
    border-color: #555;
  }
  
  .post-content {
    color: #fff;
  }
  
  .post-content code,
  .post-content pre {
    background: #222;
    color: #fff;
  }
}
</style>