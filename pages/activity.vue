<template>
  <div class="activity-page">
    <header class="activity-header">
      <h1>activity</h1>
      <p class="activity-subtitle">everything, in order</p>
      <div class="activity-filters" role="group" aria-label="Filter by type">
        <button
          v-for="f in filterDefs"
          :key="f.type"
          :class="['filter-btn', `filter-btn--${f.type}`, { 'is-active': activeFilters.has(f.type) }]"
          :aria-pressed="activeFilters.has(f.type)"
          @click="toggleFilter(f.type)"
        >{{ f.label }}</button>
        <button
          v-if="activeFilters.size < 3"
          class="filter-btn filter-btn--reset"
          aria-label="Show all types"
          @click="resetFilters"
        >all</button>
      </div>
    </header>

    <main class="activity-feed" aria-live="polite">
      <div v-if="pending" class="activity-loading" aria-label="Loading activity">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>

      <template v-else>
        <div
          v-for="(item, idx) in items"
          :key="item.key"
          :class="['activity-item', `activity-item--${item.type}`]"
        >
          <div class="activity-track" aria-hidden="true">
            <span :class="['activity-dot', `dot--${item.type}`]"></span>
            <span v-if="idx < items.length - 1" class="activity-line"></span>
          </div>

          <div class="activity-content">
            <div class="activity-meta-row">
              <span :class="['activity-badge', `badge--${item.type}`]">{{ typeLabel(item.type) }}</span>
              <time :datetime="item.date" class="activity-date">{{ formatDate(item.date) }}</time>
            </div>

            <!-- Commit -->
            <template v-if="item.type === 'commit'">
              <a
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="commit-message"
              >{{ item.content }}</a>
              <span class="commit-sha">{{ item.sha }}</span>
            </template>

            <!-- Post -->
            <template v-else-if="item.type === 'post'">
              <p class="activity-text">{{ item.content }}</p>
              <a
                v-if="item.url"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="activity-source-link"
                :aria-label="`View post on ${item.source ?? 'Bluesky'}`"
              >{{ item.source ?? 'bluesky' }} ↗</a>
            </template>

            <!-- Guestbook -->
            <template v-else>
              <p class="activity-text">{{ item.content }}</p>
              <span class="guestbook-author">— {{ item.name }}</span>
            </template>
          </div>
        </div>

        <p v-if="!items.length" class="activity-empty">
          {{ activeFilters.size < 3 ? 'nothing matches the current filter' : 'no activity yet' }}
        </p>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { FeedPage } from '~/server/api/feed'
import type { Commit } from '~/server/api/meta'
import type { GuestbookEntry } from '~/server/api/guestbook'

useHead({ title: 'activity — phareim.no' })

type FilterType = 'commit' | 'post' | 'guestbook'

const filterDefs: { type: FilterType; label: string }[] = [
  { type: 'commit',    label: 'commits' },
  { type: 'post',      label: 'posts' },
  { type: 'guestbook', label: 'guestbook' },
]

const activeFilters = ref<Set<FilterType>>(new Set(['commit', 'post', 'guestbook']))

function toggleFilter(type: FilterType) {
  const next = new Set(activeFilters.value)
  if (next.has(type)) {
    // Keep at least one filter active
    if (next.size > 1) next.delete(type)
  } else {
    next.add(type)
  }
  activeFilters.value = next
}

function resetFilters() {
  activeFilters.value = new Set(['commit', 'post', 'guestbook'])
}

interface ActivityItem {
  key: string
  type: 'commit' | 'post' | 'guestbook'
  date: string
  content: string
  url?: string
  sha?: string
  name?: string
  source?: string
}

const { data: commitData, pending: commitPending } = useFetch<Commit[]>('/api/meta')
const { data: feedData, pending: feedPending } = useFetch<FeedPage>('/api/feed')
const { data: guestbookData, pending: guestbookPending } = useFetch<GuestbookEntry[]>('/api/guestbook')

const pending = computed(() => commitPending.value || feedPending.value || guestbookPending.value)

const items = computed((): ActivityItem[] => {
  const result: ActivityItem[] = []

  for (const c of commitData.value ?? []) {
    result.push({
      key: `commit-${c.sha}`,
      type: 'commit',
      date: c.date,
      content: c.message,
      url: c.url,
      sha: c.sha,
    })
  }

  for (const p of feedData.value?.posts ?? []) {
    if (!p.text?.trim()) continue
    result.push({
      key: `post-${p.uri}`,
      type: 'post',
      date: p.createdAt,
      content: p.text.trim(),
      url: p.url,
      source: p.source,
    })
  }

  for (const g of guestbookData.value ?? []) {
    result.push({
      key: `guest-${g.id}`,
      type: 'guestbook',
      date: g.created_at,
      content: g.message,
      name: g.name,
    })
  }

  return result
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter(item => activeFilters.value.has(item.type))
})

function typeLabel(type: ActivityItem['type']): string {
  return { commit: 'commit', post: 'post', guestbook: 'guest' }[type]
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────── */
.activity-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 6rem;
  box-sizing: border-box;
  max-width: 640px;
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────── */
.activity-header {
  margin-bottom: 2.5rem;
}

h1 {
  font-size: clamp(2rem, 6vw, 3.5rem);
  margin: 0 0 0.4rem;
  color: var(--theme-text, #111);
  font-weight: 500;
  letter-spacing: -0.02em;
}

.activity-subtitle {
  color: var(--theme-text-muted, #666);
  font-size: 1rem;
  margin: 0 0 1.2rem;
}

/* ── Filters ─────────────────────────────────────────────────── */
.activity-filters {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.filter-btn {
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid;
  background: none;
  cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  opacity: 0.35;
}

.filter-btn.is-active {
  opacity: 1;
}

.filter-btn--commit {
  color: var(--theme-accent, #6b8cae);
  border-color: var(--theme-accent, #6b8cae);
}
.filter-btn--commit.is-active {
  background: color-mix(in srgb, var(--theme-accent, #6b8cae) 12%, transparent);
}

.filter-btn--post {
  color: var(--theme-accent-secondary, #9bab8b);
  border-color: var(--theme-accent-secondary, #9bab8b);
}
.filter-btn--post.is-active {
  background: color-mix(in srgb, var(--theme-accent-secondary, #9bab8b) 12%, transparent);
}

.filter-btn--guestbook {
  color: var(--theme-accent-danger, #c1272d);
  border-color: var(--theme-accent-danger, #c1272d);
}
.filter-btn--guestbook.is-active {
  background: color-mix(in srgb, var(--theme-accent-danger, #c1272d) 12%, transparent);
}

.filter-btn--reset {
  color: var(--theme-text-subtle, #aaa);
  border-color: var(--theme-text-subtle, #aaa);
  border-style: dashed;
  opacity: 0.6;
}

.filter-btn:hover {
  opacity: 1;
}

.filter-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
}

/* ── Loading ─────────────────────────────────────────────────── */
.activity-loading {
  display: flex;
  gap: 6px;
  padding: 2rem 0;
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

/* ── Timeline ────────────────────────────────────────────────── */
.activity-feed {
  display: flex;
  flex-direction: column;
}

.activity-item {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 0 1rem;
}

/* ── Track (dot + line) ──────────────────────────────────────── */
.activity-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 3px;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dot--commit  { background: var(--theme-accent, #6b8cae); }
.dot--post    { background: var(--theme-accent-secondary, #9bab8b); }
.dot--guestbook { background: var(--theme-accent-danger, #c1272d); }

.activity-item:hover .activity-dot {
  transform: scale(1.4);
  box-shadow: 0 0 0 3px var(--theme-card-border, rgba(0,0,0,0.08));
}

.activity-line {
  width: 1px;
  flex: 1;
  min-height: 1rem;
  background: var(--theme-card-border, rgba(0,0,0,0.1));
  margin-top: 4px;
}

/* ── Content ─────────────────────────────────────────────────── */
.activity-content {
  padding-bottom: 1.75rem;
  min-width: 0;
}

.activity-meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.activity-badge {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  border: 1px solid;
  flex-shrink: 0;
}

.badge--commit    { color: var(--theme-accent, #6b8cae);           border-color: var(--theme-accent, #6b8cae); }
.badge--post      { color: var(--theme-accent-secondary, #9bab8b); border-color: var(--theme-accent-secondary, #9bab8b); }
.badge--guestbook { color: var(--theme-accent-danger, #c1272d);    border-color: var(--theme-accent-danger, #c1272d); }

.activity-date {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
}

/* ── Commit ──────────────────────────────────────────────────── */
.commit-message {
  display: block;
  font-size: 0.9rem;
  color: var(--theme-text, #111);
  text-decoration: none;
  line-height: 1.5;
  transition: color 0.2s ease;
  word-break: break-word;
}

.commit-message:hover {
  color: var(--theme-accent, #6b8cae);
}

.commit-message:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 3px;
  border-radius: 2px;
}

.commit-sha {
  display: inline-block;
  margin-top: 0.25rem;
  font-size: 0.65rem;
  font-family: monospace;
  color: var(--theme-text-subtle, #aaa);
  letter-spacing: 0.05em;
}

/* ── Post ────────────────────────────────────────────────────── */
.activity-text {
  font-size: 0.9rem;
  color: var(--theme-text, #111);
  line-height: 1.6;
  margin: 0 0 0.3rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.activity-source-link {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #aaa);
  text-decoration: none;
  transition: color 0.2s ease;
}

.activity-source-link:hover {
  color: var(--theme-accent, #6b8cae);
}

.activity-source-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Guestbook ───────────────────────────────────────────────── */
.guestbook-author {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--theme-text-muted, #666);
  font-style: italic;
}

/* ── Empty ───────────────────────────────────────────────────── */
.activity-empty {
  color: var(--theme-text-subtle, #aaa);
  font-size: 0.9rem;
  font-style: italic;
  padding: 2rem 0;
}

/* ── Hacker theme overrides ──────────────────────────────────── */
:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .activity-subtitle {
  font-family: monospace;
}

:global(.hacker-page) .filter-btn {
  font-family: monospace;
  border-radius: 0;
}

:global(.hacker-page) .activity-badge {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .activity-dot {
  border-radius: 0;
}

:global(.hacker-page) .commit-message {
  font-family: monospace;
  font-size: 0.85rem;
  text-shadow: 0 0 6px currentColor;
}

:global(.hacker-page) .commit-message:hover {
  text-shadow: 0 0 12px var(--theme-accent, #00ff41);
}

:global(.hacker-page) .activity-text {
  font-family: monospace;
  font-size: 0.85rem;
}

:global(.hacker-page) .guestbook-author {
  font-family: monospace;
}

:global(.hacker-page) .activity-date {
  font-family: monospace;
}

/* ── Space theme overrides ───────────────────────────────────── */
:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .activity-subtitle {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
}

:global(.space-page) .activity-badge {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
}

:global(.space-page) .filter-btn {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
}

:global(.space-page) .activity-dot {
  box-shadow: 0 0 6px currentColor;
}

:global(.space-page) .dot--commit {
  box-shadow: 0 0 6px var(--space-accent-blue, #89abd0);
}

:global(.space-page) .dot--post {
  box-shadow: 0 0 6px var(--space-accent-amber, #e8c87a);
}

:global(.space-page) .dot--guestbook {
  box-shadow: 0 0 6px var(--space-accent-red, #e06060);
}

:global(.space-page) .commit-message {
  font-family: monospace;
}

:global(.space-page) .commit-message:hover {
  color: var(--space-accent-blue, #89abd0);
  text-shadow: 0 0 10px var(--space-accent-blue, #89abd0);
}
</style>
