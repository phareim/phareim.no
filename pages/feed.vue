<template>
  <div class="feed-page">
    <header class="feed-header">
      <div class="feed-header-top">
        <h1>thoughts</h1>
        <a
          href="/api/rss.xml"
          class="rss-badge"
          title="Subscribe via RSS"
          aria-label="Subscribe via RSS"
        >RSS</a>
      </div>
      <p class="subtitle">
        posts from
        <a
          href="https://bsky.app/profile/phareim.no"
          target="_blank"
          rel="noopener noreferrer"
          class="feed-source-link"
        >bluesky</a>
        &amp;
        <a
          href="https://x.com/phareim"
          target="_blank"
          rel="noopener noreferrer"
          class="feed-source-link"
        >x</a>
      </p>
    </header>

    <main v-if="!pending && posts.length" class="post-list">
      <a
        v-for="(post, index) in posts"
        :key="post.uri"
        :href="post.url"
        target="_blank"
        rel="noopener noreferrer"
        class="post-card"
        :style="{ '--card-idx': Math.min(Math.max(index - prevCount, 0), 9) }"
      >
        <p class="post-text" v-html="renderPostText(post.text, post.hasMedia)"></p>
        <div class="post-footer">
          <span class="post-date">{{ formatDate(post.createdAt) }}</span>
          <span class="post-source" :class="`source-${post.source}`">{{ post.source === 'x' ? 'x' : 'bsky' }}</span>
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

    <div v-else-if="pending" class="loading" aria-label="Loading posts">
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
    </div>

    <div v-else class="loading">
      <span class="loading-empty">no posts found</span>
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
import type { FeedPage, Post } from '~/server/api/feed'

useHead({
  title: 'thoughts — phareim.no',
  link: [
    { rel: 'alternate', type: 'application/rss+xml', title: 'phareim.no — thoughts', href: '/api/rss.xml' }
  ]
})

const cursor = ref<string | undefined>(undefined)
const loadingMore = ref(false)
const allPosts = ref<Post[]>([])
const prevCount = ref(0)

const { data, pending } = await useFetch<FeedPage>('/api/feed')

watch(data, (page) => {
  allPosts.value = page?.posts ?? []
  cursor.value = page?.cursor
}, { immediate: true })

const posts = computed(() => allPosts.value)
const nextCursor = computed(() => cursor.value)

async function loadMore() {
  if (!cursor.value) return
  loadingMore.value = true
  try {
    const result = await $fetch<FeedPage>('/api/feed', { query: { cursor: cursor.value } })
    prevCount.value = allPosts.value.length
    allPosts.value = [...allPosts.value, ...result.posts]
    cursor.value = result.cursor
  } finally {
    loadingMore.value = false
  }
}

function renderPostText(text: string, hasMedia?: boolean): string {
  if (!text) {
    return hasMedia ? '<span class="post-media-hint">[media]</span>' : ''
  }
  const parts = text.split(/(https?:\/\/[^\s]+|@[\w.-]+|#[\w]+)/)
  return parts.map((part) => {
    if (!part) return ''
    if (/^https?:\/\//.test(part)) {
      const clean = part.replace(/[.,!?;:)'"]+$/, '')
      const display = clean.length > 46 ? clean.slice(0, 45) + '…' : clean
      const safe = display.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      return `<span class="post-url">${safe}</span>`
    }
    const escaped = part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    if (/^@/.test(part)) return `<span class="post-mention">${escaped}</span>`
    if (/^#/.test(part)) return `<span class="post-tag">${escaped}</span>`
    return escaped
  }).join('')
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
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

.feed-header-top {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.rss-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--theme-accent, #6b8cae);
  border: 1px solid var(--theme-accent, #6b8cae);
  border-radius: 4px;
  padding: 0.18em 0.5em;
  text-decoration: none;
  opacity: 0.65;
  transition: opacity 0.2s ease, background 0.2s ease, color 0.2s ease;
  flex-shrink: 0;
  align-self: center;
  margin-bottom: 0.35rem;
}

.rss-badge:hover {
  opacity: 1;
  background: var(--theme-accent, #6b8cae);
  color: var(--theme-bg, #fff);
}

.rss-badge:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  opacity: 1;
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

@keyframes post-card-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

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
  animation: post-card-in 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation-delay: calc(var(--card-idx, 0) * 45ms);
}

@media (prefers-reduced-motion: reduce) {
  .post-card {
    animation: none;
  }
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

/* ── Rich text annotations ──────────────────────────────────── */

.post-mention {
  color: var(--theme-accent, #6b8cae);
  font-weight: 500;
}

.post-tag {
  color: var(--theme-accent-secondary, #9bab8b);
}

.post-url {
  color: var(--theme-text-muted, #888);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
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

.post-source {
  font-size: 0.65rem;
  color: var(--theme-text-subtle, #aaa);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.1));
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.source-bluesky {
  color: var(--theme-accent, #6b8cae);
  border-color: color-mix(in srgb, var(--theme-accent, #6b8cae) 35%, transparent);
}

.source-x {
  color: var(--theme-text-muted, #888);
  border-color: color-mix(in srgb, var(--theme-text-muted, #888) 35%, transparent);
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
  gap: 6px;
  min-height: 30vh;
}

.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--theme-text-subtle, #aaa);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse-dot {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1); }
}

.loading-empty {
  color: var(--theme-text-subtle, #aaa);
  font-size: 0.9rem;
  font-style: italic;
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

:global(.hacker-page) .post-mention {
  color: var(--hacker-text, #00ff41);
  text-shadow: 0 0 6px currentColor;
}

:global(.hacker-page) .post-tag {
  color: var(--hacker-text-dim, #008F11);
}

:global(.hacker-page) .post-url {
  color: var(--hacker-text-dim, #008F11);
  text-decoration-color: var(--hacker-text-dim, #008F11);
}

:global(.hacker-page) .loading-dot {
  border-radius: 0;
}

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .subtitle {
  font-family: monospace;
}

:global(.hacker-page) .rss-badge {
  border-radius: 0;
  font-family: monospace;
}

:global(.space-page) .rss-badge {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
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

:global(.space-page) .post-mention {
  color: var(--space-accent-blue, #89abd0);
  text-shadow: 0 0 8px rgba(137, 171, 208, 0.4);
}

:global(.space-page) .post-tag {
  color: var(--space-accent-amber, #e8c87a);
}

:global(.space-page) .post-url {
  color: var(--space-text-muted, #a0a8c0);
  text-decoration-color: rgba(137, 171, 208, 0.4);
}
</style>
