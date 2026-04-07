<template>
  <div class="meta-page">
    <header class="meta-header">
      <h1>meta</h1>
      <p class="subtitle">a log of changes to this very site</p>
    </header>

    <main v-if="!pending && commits?.length">
      <ol class="commit-list">
        <li
          v-for="commit in commits"
          :key="commit.sha"
          class="commit-item"
        >
          <div class="commit-date">{{ formatDate(commit.date) }}</div>
          <a
            :href="commit.url"
            target="_blank"
            rel="noopener noreferrer"
            class="commit-card"
          >
            <span class="commit-message">{{ commit.message }}</span>
            <span class="commit-sha">{{ commit.sha }}</span>
          </a>
        </li>
      </ol>

      <button
        v-if="hasMore"
        class="load-more"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? 'loading…' : 'load more' }}
      </button>
    </main>

    <div v-else-if="pending" class="loading">
      <span class="loading-text">fetching history…</span>
    </div>

    <div v-else class="loading">
      <span class="loading-text">no commits found</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Commit } from '~/server/api/meta'

useHead({ title: 'meta — phareim.no' })

const page = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const allCommits = ref<Commit[]>([])

const { data, pending } = await useFetch<Commit[]>('/api/meta', {
  query: { page: 1 }
})

watch(data, val => {
  if (val) {
    allCommits.value = val
    hasMore.value = val.length === 30
  }
}, { immediate: true })

const commits = computed(() => allCommits.value)

async function loadMore() {
  loadingMore.value = true
  page.value++
  try {
    const more = await $fetch<Commit[]>('/api/meta', { query: { page: page.value } })
    allCommits.value = [...allCommits.value, ...more]
    hasMore.value = more.length === 30
  } finally {
    loadingMore.value = false
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.meta-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 4rem;
  box-sizing: border-box;
  max-width: 760px;
  margin: 0 auto;
}

.meta-header {
  margin-bottom: 3rem;
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

.commit-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.commit-item {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.commit-date {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
  flex-shrink: 0;
  width: 7rem;
  text-align: right;
}

.commit-card {
  flex: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  background: var(--theme-card-bg, rgba(255,255,255,0.6));
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.08));
  border-radius: var(--theme-card-radius, 12px);
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: inherit;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 8px var(--theme-card-shadow, rgba(0,0,0,0.04));
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.commit-card:hover {
  transform: translateX(3px);
  box-shadow: 0 4px 16px var(--theme-card-shadow, rgba(0,0,0,0.08));
  border-color: var(--theme-accent, #89abd0);
}

.commit-card:focus-visible {
  outline: 2px solid var(--theme-accent, #89abd0);
  outline-offset: 2px;
}

.commit-message {
  font-size: 0.9rem;
  color: var(--theme-text, #111);
  line-height: 1.4;
}

.commit-sha {
  font-size: 0.7rem;
  font-family: monospace;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
  flex-shrink: 0;
}

.load-more {
  display: block;
  margin: 2rem auto 0;
  padding: 0.6rem 1.6rem;
  background: var(--theme-card-bg, rgba(255,255,255,0.6));
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.08));
  border-radius: var(--theme-card-radius, 12px);
  color: var(--theme-text-muted, #666);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s ease;
  backdrop-filter: blur(12px);
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

@media (max-width: 520px) {
  .commit-item {
    flex-direction: column;
    gap: 0.25rem;
  }

  .commit-date {
    text-align: left;
    width: auto;
  }
}

/* Hacker theme overrides */
:global(.hacker-page) .commit-card {
  border-radius: 0;
}

:global(.hacker-page) .commit-message {
  font-family: monospace;
  text-transform: lowercase;
}

:global(.hacker-page) .commit-card:hover {
  box-shadow: 0 0 16px var(--theme-card-shadow, rgba(0,255,65,0.2));
}

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .subtitle {
  font-family: monospace;
}

/* Space theme overrides */
:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .commit-card:hover {
  box-shadow: 0 8px 32px var(--theme-card-shadow, rgba(140, 170, 220, 0.15)),
              0 0 0 1px rgba(140, 170, 220, 0.25);
}
</style>
