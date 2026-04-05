<template>
  <div class="now-page">
    <header class="now-header">
      <h1>now</h1>
      <p class="subtitle">what i'm up to these days</p>
    </header>

    <main class="now-content">

      <!-- Current focus -->
      <section class="now-section">
        <h2 class="section-label">working on</h2>
        <ul class="now-list">
          <li>consulting at <a href="https://www.miles.no" target="_blank" rel="noopener noreferrer" class="now-link">miles</a> — helping teams build better software</li>
          <li>maintaining and iterating on <a href="/" class="now-link">phareim.no</a> — this site, which updates itself</li>
        </ul>
      </section>

      <div class="now-divider" aria-hidden="true"></div>

      <!-- Latest thought from Bluesky -->
      <section class="now-section">
        <h2 class="section-label">latest thought</h2>
        <div v-if="latestPost" class="now-card">
          <p class="now-card-text">{{ latestPost.text }}</p>
          <div class="now-card-footer">
            <span class="now-card-date">{{ formatDate(latestPost.createdAt) }}</span>
            <a
              :href="latestPost.url"
              target="_blank"
              rel="noopener noreferrer"
              class="now-card-source"
              aria-label="View on Bluesky"
            >bluesky ↗</a>
          </div>
        </div>
        <div v-else-if="feedPending" class="now-placeholder">
          <span>fetching…</span>
        </div>
        <div v-else class="now-placeholder">
          <span>no recent thoughts found</span>
        </div>
      </section>

      <div class="now-divider" aria-hidden="true"></div>

      <!-- Latest GitHub activity -->
      <section class="now-section">
        <h2 class="section-label">recently pushed</h2>
        <ul v-if="recentProjects.length" class="now-project-list">
          <li
            v-for="project in recentProjects"
            :key="project.name"
            class="now-project-item"
          >
            <a
              :href="project.html_url"
              target="_blank"
              rel="noopener noreferrer"
              class="now-project-link"
            >
              <span class="now-project-name">{{ project.name }}</span>
              <span class="now-project-desc">{{ project.description || '…' }}</span>
            </a>
            <span class="now-project-date">{{ formatDate(project.pushed_at) }}</span>
          </li>
        </ul>
        <div v-else-if="projectsPending" class="now-placeholder">
          <span>fetching…</span>
        </div>
        <div v-else class="now-placeholder">
          <span>no recent activity found</span>
        </div>
      </section>

      <div class="now-divider" aria-hidden="true"></div>

      <footer class="now-footer">
        <p class="now-updated">
          this page updates itself — last commit:
          <a
            href="/meta"
            class="now-link"
          >see the log</a>
        </p>
        <p class="now-inspired">
          inspired by <a href="https://nownownow.com/about" target="_blank" rel="noopener noreferrer" class="now-link">nownownow.com</a>
        </p>
      </footer>

    </main>
  </div>
</template>

<script setup lang="ts">
import type { FeedPage } from '~/server/api/feed'
import type { Project } from '~/server/api/projects'

useHead({ title: 'now — phareim.no' })

const { data: feedData, pending: feedPending } = await useFetch<FeedPage>('/api/feed')
const { data: projectsData, pending: projectsPending } = await useFetch<Project[]>('/api/projects')

const latestPost = computed(() => {
  const posts = feedData.value?.posts
  if (!posts?.length) return null
  return posts.find(p => p.text && p.text.trim().length > 0) ?? null
})

const recentProjects = computed(() => {
  if (!projectsData.value) return []
  return [...projectsData.value]
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
    .slice(0, 3)
})

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return d.toLocaleDateString('en', { month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.now-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 580px;
  margin: 0 auto;
}

.now-header {
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

/* ── Sections ───────────────────────────────────────────────── */

.now-content {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.now-section {
  padding: 0.25rem 0;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
  margin: 0 0 0.9rem;
}

.now-divider {
  width: 36px;
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.12));
  margin: 2rem 0;
}

/* ── List ───────────────────────────────────────────────────── */

.now-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.now-list li {
  font-size: 1rem;
  color: var(--theme-text-muted, #555);
  line-height: 1.6;
  padding-left: 1.1rem;
  position: relative;
}

.now-list li::before {
  content: '→';
  position: absolute;
  left: 0;
  color: var(--theme-accent, #6b8cae);
  font-size: 0.85em;
}

.now-link {
  color: var(--theme-text, #111);
  text-decoration: none;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.2));
  transition: border-color 0.2s ease, color 0.2s ease;
}

.now-link:hover {
  border-color: var(--theme-accent, #6b8cae);
  color: var(--theme-accent, #6b8cae);
}

.now-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Bluesky card ───────────────────────────────────────────── */

.now-card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1.1rem 1.3rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px var(--theme-card-shadow, rgba(0, 0, 0, 0.04));
}

.now-card-text {
  font-size: 0.95rem;
  color: var(--theme-text, #111);
  line-height: 1.65;
  margin: 0 0 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.now-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.06));
}

.now-card-date {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #aaa);
}

.now-card-source {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #aaa);
  text-decoration: none;
  transition: color 0.2s ease;
}

.now-card-source:hover {
  color: var(--theme-accent, #6b8cae);
}

.now-card-source:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Project list ───────────────────────────────────────────── */

.now-project-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.now-project-item {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.now-project-link {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  text-decoration: none;
  color: inherit;
  min-width: 0;
}

.now-project-name {
  font-size: 0.9rem;
  color: var(--theme-text, #111);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.now-project-link:hover .now-project-name {
  color: var(--theme-accent, #6b8cae);
}

.now-project-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 3px;
  border-radius: 3px;
}

.now-project-desc {
  font-size: 0.8rem;
  color: var(--theme-text-subtle, #aaa);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.now-project-date {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Placeholder ────────────────────────────────────────────── */

.now-placeholder {
  font-size: 0.9rem;
  color: var(--theme-text-subtle, #aaa);
  font-style: italic;
}

/* ── Footer ─────────────────────────────────────────────────── */

.now-footer {
  padding-top: 0.5rem;
}

.now-updated,
.now-inspired {
  font-size: 0.75rem;
  color: var(--theme-text-subtle, #aaa);
  margin: 0 0 0.35rem;
  line-height: 1.5;
}

/* ── Hacker theme overrides ─────────────────────────────────── */

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .subtitle {
  font-family: monospace;
}

:global(.hacker-page) .section-label {
  font-family: monospace;
}

:global(.hacker-page) .now-list li {
  font-family: monospace;
}

:global(.hacker-page) .now-card {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .now-card-text {
  font-family: monospace;
}

:global(.hacker-page) .now-project-name,
:global(.hacker-page) .now-project-desc {
  font-family: monospace;
}

:global(.hacker-page) .now-card:hover {
  box-shadow: 0 0 18px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

/* ── Space theme overrides ──────────────────────────────────── */

:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .now-card {
  box-shadow: 0 4px 24px var(--theme-card-shadow, rgba(140, 170, 220, 0.1));
}

:global(.space-page) .now-card:hover {
  box-shadow:
    0 8px 32px var(--theme-card-shadow, rgba(140, 170, 220, 0.15)),
    0 0 0 1px rgba(140, 170, 220, 0.2);
}

:global(.space-page) .section-label {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
}
</style>
