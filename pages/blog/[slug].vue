<template>
  <div class="blog-container" v-if="post">
    <NuxtLink to="/blog" class="back-button">← Back to Blog</NuxtLink>
    <article>
      <h1>{{ post.title }}</h1>
      <p class="post-meta">{{ formatDate(post.date) }}</p>
      <div v-html="post.content" class="post-content"></div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface BlogPost {
  slug: string
  title: string
  date: string
  content: string
}

const route = useRoute()
const router = useRouter()
const post = ref<BlogPost | null>(null)

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

onMounted(async () => {
  const slug = route.params.slug as string
  const res = await fetch(`/api/blog/${slug}`)
  if (!res.ok) {
    router.replace('/blog')
    return
  }
  post.value = await res.json()
})
</script>

<style scoped>
.blog-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: 'Comfortaa', sans-serif;
}

.back-button {
  display: inline-block;
  background: #3498db;
  color: white;
  text-decoration: none;
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

.post-meta {
  color: #666;
  font-size: 0.9rem;
  margin: 0 0 1rem 0;
}

.post-content {
  line-height: 1.8;
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .blog-container { color: #fff; }
  .post-content { color: #fff; }
}
</style>

