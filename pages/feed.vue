<template>
  <div class="feed-page">
    <header class="feed-header">
      <h1>thoughts</h1>
      <p class="subtitle">
        posts from
        <a
          href="https://bsky.app/profile/phareim.no"
          target="_blank"
          rel="noopener noreferrer"
          class="feed-source-link"
        >bluesky</a>
      </p>
    </header>

    <main v-if="!pending && posts.length" class="post-list">
      <a
        v-for="post in posts"
        :key="post.uri"
        :href="post.url"
        target="_blank"
        rel="noopener noreferrer"
        class="post-card"
      >
        <p class="post-text">{{ post.text }}<span v-if="!post.text && post.hasMedia" class="post-media-hint">[media]</span></p>
        <div class="post-footer">
          <span class="post-date">{{ formatDate(post.createdAt) }}</span>
          <div class="post-stats" aria-label="engagement">
            <span v-if="post.likeCount > 0" class="stat" :title="`${post.likeCount} likes`">
              ♥ {{ post.likeCount }}
            </span>
            <span v-if="post.repostCount > 0" class="stat" :title="`${post.repostCount} reposts`">
              ↻ {{ post.repostCount }}
            </span>
            <span v-if="post.replyCount > 0" class="stat" :title="`${post.replyCount} replies`">
              ↩ {{ post.replyCount }}
            </span>
          </div>
        </div>
      </a>
    </main>

    <div v-else-if="pending" class="loading">
      <span class="loading-text">fetching thoughts…</span>
    </div>

    <div v-else class="loading">
      <span class="loading-text">no posts found</span>
    </div>

    <button
      v-if="nextCursor && posts.length && !pending"
      class="load-more"
      :disabled="loadingMore"
      @click="loadMore"
    >
      {{ loadingMore ? 'loading…' : 'load more' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { FeedPage } from '~/server/api/feed'

useHead({ title: 'thoughts — phareim.no' })

const nextCursor = ref<string | undefined>(undefined)
const loadingMore = ref(false)
const allPosts = ref<FeedPage['posts']>([])

const { data, pending } = await useFetch<FeedPage>('/api/feed')

watch(data, val => {
  if (val) {
    allPosts.value = val.posts
    nextCursor.value = val.cursor
  }
}, { immediate: true })

const posts = computed(() => allPosts.value)

async function loadMore() {
  if (!nextCursor.value) return
  loadingMore.value = true
  try {
    const result = await $fetch<FeedPage>('/api/feed', {
      query: { cursor: nextCursor.value }
    })
    allPosts.value = [...allPosts.value, ...result.posts]
    nextCursor.value = result.cursor
  } finally {
    loadingMore.value = false
  }
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.feed-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 4rem;
  box-sizing: border-box;
  max-width: 680px;
  margin: 0 auto;
}

.feed-header {
  margin-bottom: 2.5rem;
}

h1 {
  font-size: clamp(2rem, 6vw, 3.5rem);
  margin: 0 0 0.5rem;
  color: var(--theme-text, #111);
  font-weight: 500;
}

.subtitle {
  color: var(--theme-text-muted, #666);
  font-size: 1rem;
  margin: 0;
}

.feed-source-link {
  color: var(--theme-accent, #6b8cae);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.feed-source-link:hover {
  border-color: var(--theme-accent, #6b8cae);
}

.feed-source-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Post list ──────────────────────────────────────────────── */

.post-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.post-card {
  display: block;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1.25rem 1.5rem;
  text-decoration: none;
  color: inherit;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px var(--theme-card-shadow, rgba(0, 0, 0, 0.04));
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px var(--theme-card-shadow, rgba(0, 0, 0, 0.08));
  border-color: var(--theme-accent, #89abd0);
}

.post-card:focus-visible {
  outline: 2px solid var(--theme-accent, #89abd0);
  outline-offset: 2px;
  transform: translateY(-2px);
}

.post-text {
  font-size: 1rem;
  color: var(--theme-text, #111);
  line-height: 1.65;
  margin: 0 0 1rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.post-media-hint {
  font-size: 0.85rem;
  color: var(--theme-text-subtle, #aaa);
  font-style: italic;
}

.post-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.06));
}

.post-date {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
}

.post-stats {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.stat {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
  transition: color 0.15s ease;
}

.post-card:hover .stat {
  color: var(--theme-text-muted, #666);
}

/* ── Utilities ──────────────────────────────────────────────── */

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 30vh;
}

.loading-text {
  color: var(--theme-text-muted, #888);
  font-size: 1rem;
  animation: loading-pulse 1.6s ease-in-out infinite;
}

@keyframes loading-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.load-more {
  display: block;
  margin: 2rem auto 0;
  padding: 0.6rem 1.6rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 12px);
  color: var(--theme-text-muted, #666);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: border-color 0.15s ease, color 0.15s ease;
}

.load-more:hover:not(:disabled) {
  border-color: var(--theme-accent, #89abd0);
  color: var(--theme-text, #111);
}

.load-more:disabled {
  opacity: 0.5;
  cursor: default;
}

.load-more:focus-visible {
  outline: 2px solid var(--theme-accent, #89abd0);
  outline-offset: 2px;
  border-color: var(--theme-accent, #89abd0);
}

/* ── Hacker theme overrides ─────────────────────────────────── */

:global(.hacker-page) .post-card {
  border-radius: 0;
}

:global(.hacker-page) .post-text {
  font-family: monospace;
}

:global(.hacker-page) .post-card:hover {
  box-shadow: 0 0 18px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .subtitle {
  font-family: monospace;
}

:global(.hacker-page) .load-more {
  border-radius: 0;
  font-family: monospace;
}

/* ── Space theme overrides ──────────────────────────────────── */

:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .post-card:hover {
  box-shadow: 0 8px 32px var(--theme-card-shadow, rgba(140, 170, 220, 0.15)),
              0 0 0 1px rgba(140, 170, 220, 0.25);
}
</style>
