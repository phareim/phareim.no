<template>
  <AlmanacFrame title="Feed" kicker="Bluesky and X, merged." back="/">
    <div class="feed-toolbar">
      <p class="feed-sources">
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
      <a
        href="/api/rss.xml"
        class="rss-badge"
        title="Subscribe via RSS"
        aria-label="Subscribe via RSS"
      >rss</a>
    </div>

    <div v-if="!pending && posts.length" class="post-list">
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
    </div>

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
  </AlmanacFrame>
</template>

<script setup lang="ts">
import type { FeedPage, Post } from '~/server/api/feed'

useHead({
  title: 'feed — phareim.no',
  link: [
    { rel: 'alternate', type: 'application/rss+xml', title: 'phareim.no — feed', href: '/api/rss.xml' }
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
.feed-toolbar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}

.feed-sources {
  color: var(--theme-text-muted, #6a6a6a);
  font-size: 0.95rem;
  margin: 0;
  font-style: italic;
}

.feed-source-link {
  color: var(--theme-text, #1a1a1a);
  text-decoration: none;
  border-bottom: 1px solid var(--theme-card-border, rgba(0,0,0,0.2));
  transition: border-color 0.2s ease, color 0.2s ease;
  font-style: normal;
}

.feed-source-link:hover {
  border-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}

.feed-source-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
}

.rss-badge {
  font-size: 0.7rem;
  font-style: italic;
  letter-spacing: 0.04em;
  color: var(--theme-accent, #c14a2a);
  border: 1px solid var(--theme-accent, #c14a2a);
  border-radius: 0;
  padding: 0.1em 0.5em;
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease;
  flex-shrink: 0;
}

.rss-badge:hover {
  background: var(--theme-accent, #c14a2a);
  color: var(--theme-bg, #f4f0e8);
}

.rss-badge:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
}

/* ── Post list — hairline cards ────────────────────────────── */

@keyframes post-card-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.post-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.post-card {
  display: block;
  background: var(--theme-card-bg, transparent);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.15));
  border-radius: var(--theme-card-radius, 0);
  padding: 1.1rem 1.3rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s ease;
  animation: post-card-in 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation-delay: calc(var(--card-idx, 0) * 45ms);
}

@media (prefers-reduced-motion: reduce) {
  .post-card {
    animation: none;
  }
}

.post-card:hover {
  border-color: var(--theme-accent, #c14a2a);
}

.post-card:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
}

.post-text {
  font-size: 1rem;
  color: var(--theme-text, #1a1a1a);
  line-height: 1.65;
  margin: 0 0 1rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.post-media-hint {
  font-size: 0.85rem;
  color: var(--theme-text-subtle, #a39e8f);
  font-style: italic;
}

/* ── Rich text annotations ──────────────────────────────────── */

.post-mention {
  color: var(--theme-accent, #c14a2a);
  font-style: italic;
}

.post-tag {
  color: var(--theme-text-muted, #6a6a6a);
  font-style: italic;
}

.post-url {
  color: var(--theme-text-muted, #6a6a6a);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.post-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
}

.post-date {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #a39e8f);
  white-space: nowrap;
  font-style: italic;
}

.post-source {
  font-size: 0.65rem;
  color: var(--theme-text-subtle, #a39e8f);
  text-transform: lowercase;
  letter-spacing: 0.04em;
  font-style: italic;
  border: 0;
  background: transparent;
  padding: 0;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.source-bluesky,
.source-x {
  color: var(--theme-text-subtle, #a39e8f);
}

.post-stats {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.stat {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #a39e8f);
  white-space: nowrap;
  transition: color 0.15s ease;
}

.post-card:hover .stat {
  color: var(--theme-text-muted, #6a6a6a);
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
  background: var(--theme-text-subtle, #a39e8f);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse-dot {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1); }
}

.loading-empty {
  color: var(--theme-text-subtle, #a39e8f);
  font-size: 0.9rem;
  font-style: italic;
}

.load-more {
  display: block;
  margin: 2rem auto 0;
  padding: 0.5rem 1.6rem;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.2));
  border-radius: 0;
  color: var(--theme-text-muted, #6a6a6a);
  font-family: inherit;
  font-style: italic;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.load-more:hover:not(:disabled) {
  border-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}

.load-more:disabled {
  opacity: 0.5;
  cursor: default;
}

.load-more:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
}
</style>
