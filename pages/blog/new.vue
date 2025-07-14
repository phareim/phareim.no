<template>
  <div class="new-post-container">
    <h1>Create New Blog Post</h1>

    <form class="post-form" @submit.prevent="submitPost">
      <div class="form-group">
        <label for="title">Title</label>
        <input id="title" v-model="title" placeholder="Post title" required />
      </div>

      <div class="form-group">
        <label for="slug">Slug (optional)</label>
        <input id="slug" v-model="slug" placeholder="custom-slug" />
        <small v-if="slug">Final URL will be /blog/{{ slug }}</small>
      </div>

      <div class="form-group">
        <label for="author">Author (optional)</label>
        <input id="author" v-model="author" placeholder="Your name" />
      </div>

      <div class="form-group">
        <label for="date">Date</label>
        <input id="date" type="date" v-model="date" />
      </div>

      <div class="form-group">
        <label for="content">Markdown Content</label>
        <textarea
          id="content"
          v-model="content"
          class="markdown-input"
          placeholder="Write your post in Markdown..."
          rows="15"
          required
        ></textarea>
      </div>

      <div class="form-group">
        <label>Preview</label>
        <div class="preview" v-html="renderedContent"></div>
      </div>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Saving...' : 'Save Post' }}
      </button>
    </form>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="success" class="success">Post saved successfully!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()

const title = ref('')
const slug = ref('')
const author = ref('')
const date = ref(new Date().toISOString().split('T')[0])
const content = ref('')

const isSubmitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const renderedContent = computed(() => md.render(content.value || ''))

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^\-+|\-+$/g, '')
}

async function submitPost() {
  error.value = null
  success.value = false
  isSubmitting.value = true

  // Auto-generate slug if empty
  const finalSlug = slug.value ? slug.value.trim() : generateSlug(title.value)

  try {
    const res = await fetch('/api/blogposts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        slug: finalSlug,
        title: title.value,
        content: content.value,
        excerpt: content.value.substring(0, 147) + '...',
        author: author.value,
        date: date.value
      })
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to save post')
    }

    success.value = true
    // Optionally clear form
    title.value = ''
    slug.value = ''
    author.value = ''
    content.value = ''
  } catch (err: any) {
    error.value = err.message || 'An unexpected error occurred'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.new-post-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 1rem;
  font-family: 'Comfortaa', sans-serif;
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
}

.post-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

label {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

input,
textarea {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}

textarea.markdown-input {
  font-family: monospace;
  min-height: 300px;
}

.preview {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 1rem;
  background: #fafafa;
  max-height: 400px;
  overflow: auto;
}

button {
  padding: 0.75rem 1.5rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  align-self: flex-start;
}

button[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 1rem;
  color: #e74c3c;
}

.success {
  margin-top: 1rem;
  color: #2ecc71;
}
</style>