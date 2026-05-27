<template>
  <AlmanacFrame title="Now" kicker="What I'm up to these days." back="/">
    <div class="now-content">

      <!-- Current focus -->
      <section class="now-section now-section--1">
        <h2 class="section-label">working on</h2>
        <ul class="now-list">
          <li>consulting at <a href="https://www.miles.no" target="_blank" rel="noopener noreferrer" class="now-link">miles</a> — helping teams build better software</li>
          <li>maintaining and iterating on <a href="/" class="now-link">phareim.no</a> — this site, which updates itself</li>
        </ul>
      </section>

      <div class="now-divider" aria-hidden="true"></div>

      <!-- Latest thought from Bluesky -->
      <section class="now-section now-section--2">
        <h2 class="section-label">latest thought</h2>
        <a
          v-if="latestPost"
          :href="latestPost.url"
          target="_blank"
          rel="noopener noreferrer"
          class="now-card"
          :aria-label="`View on ${latestPost.source === 'x' ? 'X' : 'Bluesky'}: ${latestPost.text}`"
        >
          <p class="now-card-text">{{ latestPost.text }}</p>
          <div class="now-card-footer">
            <span class="now-card-date">{{ formatDate(latestPost.createdAt) }}</span>
            <span class="now-card-source">{{ latestPost.source === 'x' ? 'x' : 'bluesky' }} ↗</span>
          </div>
        </a>
        <div v-else-if="feedPending" class="now-placeholder now-placeholder--loading">
          <span>fetching…</span>
        </div>
        <div v-else class="now-placeholder">
          <span>no recent thoughts found</span>
        </div>
      </section>

      <div class="now-divider" aria-hidden="true"></div>

      <!-- Latest GitHub activity -->
      <section class="now-section now-section--3">
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
        <div v-else-if="projectsPending" class="now-placeholder now-placeholder--loading">
          <span>fetching…</span>
        </div>
        <div v-else class="now-placeholder">
          <span>no recent activity found</span>
        </div>
      </section>

      <div class="now-divider" aria-hidden="true"></div>

      <!-- Latest guestbook entry -->
      <section class="now-section now-section--4">
        <h2 class="section-label">latest visitor</h2>
        <div v-if="guestbookPending" class="now-placeholder now-placeholder--loading">
          <span>fetching…</span>
        </div>
        <div v-else-if="latestEntry" class="now-guest-card">
          <p class="now-guest-message">{{ latestEntry.message }}</p>
          <div class="now-guest-footer">
            <span class="now-guest-name">— {{ latestEntry.name }}</span>
            <a href="/guestbook" class="now-guest-link">{{ formatDate(latestEntry.created_at) }}</a>
          </div>
        </div>
        <div v-else class="now-placeholder">
          <span>no entries yet — <a href="/guestbook" class="now-link">be the first</a></span>
        </div>
      </section>

      <div class="now-divider" aria-hidden="true"></div>

      <footer class="now-footer now-section--5">
        <p class="now-updated">
          this page updates itself — last commit:
          <a href="/projects" class="now-link">see the log</a>
        </p>
        <p class="now-inspired">
          inspired by <a href="https://nownownow.com/about" target="_blank" rel="noopener noreferrer" class="now-link">nownownow.com</a>
        </p>
      </footer>

    </div>
  </AlmanacFrame>
</template>

<script setup lang="ts">
import type { FeedPage } from '~/server/api/feed'
import type { Project } from '~/server/api/projects'
import type { GuestbookEntry } from '~/server/api/guestbook'

useHead({ title: 'now — phareim.no' })

const { data: feedData, pending: feedPending } = await useFetch<FeedPage>('/api/feed')
const { data: projectsData, pending: projectsPending } = await useFetch<Project[]>('/api/projects')
const { data: guestbookData, pending: guestbookPending } = useFetch<GuestbookEntry[]>('/api/guestbook')

const latestPost = computed(() => {
  const posts = feedData.value?.posts
  if (!posts?.length) return null
  return posts.find(p => p.text && p.text.trim().length > 0) ?? null
})

const latestEntry = computed(() => guestbookData.value?.[0] ?? null)

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
.now-content {
  display: flex;
  flex-direction: column;
  gap: 0;
}

@keyframes now-fade-in {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

.now-section,
.now-footer {
  animation: now-fade-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.now-section {
  padding: 0.25rem 0;
}

.now-section--1 { animation-delay: 0.05s; }
.now-section--2 { animation-delay: 0.15s; }
.now-section--3 { animation-delay: 0.25s; }
.now-section--4 { animation-delay: 0.35s; }
.now-section--5 { animation-delay: 0.45s; }

@media (prefers-reduced-motion: reduce) {
  .now-section,
  .now-footer {
    animation: none;
  }
}

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #a39e8f);
  margin: 0 0 0.9rem;
  border-bottom: 0;
  padding-bottom: 0;
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
  color: var(--theme-text, #1a1a1a);
  line-height: 1.6;
  padding-left: 1.1rem;
  position: relative;
}

.now-list li::before {
  content: '→';
  position: absolute;
  left: 0;
  color: var(--theme-accent, #c14a2a);
  font-size: 0.85em;
}

.now-link {
  color: var(--theme-text, #1a1a1a);
  text-decoration: none;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.2));
  transition: border-color 0.2s ease, color 0.2s ease;
}

.now-link:hover {
  border-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}

.now-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Bluesky card — hairline rectangle, no shadow/blur ─────── */

.now-card {
  display: block;
  text-decoration: none;
  color: inherit;
  background: var(--theme-card-bg, transparent);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.15));
  border-radius: var(--theme-card-radius, 0);
  padding: 1.1rem 1.3rem;
  transition: border-color 0.25s ease;
}

.now-card:hover {
  border-color: var(--theme-accent, #c14a2a);
}

.now-card:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
}

.now-card-text {
  font-size: 0.95rem;
  color: var(--theme-text, #1a1a1a);
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
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
}

.now-card-date {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #a39e8f);
  font-style: italic;
}

.now-card-source {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #a39e8f);
  transition: color 0.2s ease;
  font-style: italic;
}

.now-card:hover .now-card-source {
  color: var(--theme-accent, #c14a2a);
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
  color: var(--theme-text, #1a1a1a);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.now-project-link:hover .now-project-name {
  color: var(--theme-accent, #c14a2a);
}

.now-project-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 3px;
  border-radius: 3px;
}

.now-project-desc {
  font-size: 0.8rem;
  color: var(--theme-text-muted, #6a6a6a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  font-style: italic;
}

.now-project-date {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #a39e8f);
  white-space: nowrap;
  flex-shrink: 0;
  font-style: italic;
}

/* ── Placeholder ────────────────────────────────────────────── */

.now-placeholder {
  font-size: 0.9rem;
  color: var(--theme-text-subtle, #a39e8f);
  font-style: italic;
}

.now-placeholder--loading span {
  animation: placeholder-pulse 1.6s ease-in-out infinite;
  display: inline-block;
}

@keyframes placeholder-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

/* ── Guestbook card ─────────────────────────────────────────── */

.now-guest-card {
  background: var(--theme-card-bg, transparent);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.15));
  border-radius: var(--theme-card-radius, 0);
  padding: 1.1rem 1.3rem;
}

.now-guest-message {
  font-size: 0.95rem;
  color: var(--theme-text, #1a1a1a);
  line-height: 1.65;
  margin: 0 0 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
  font-style: italic;
}

.now-guest-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
}

.now-guest-name {
  font-size: 0.75rem;
  color: var(--theme-text-muted, #6a6a6a);
  font-weight: 500;
}

.now-guest-link {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #a39e8f);
  text-decoration: none;
  transition: color 0.2s ease;
  font-style: italic;
}

.now-guest-link:hover {
  color: var(--theme-accent, #c14a2a);
}

.now-guest-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Footer ─────────────────────────────────────────────────── */

.now-footer {
  padding-top: 0.5rem;
}

.now-updated,
.now-inspired {
  font-size: 0.75rem;
  color: var(--theme-text-subtle, #a39e8f);
  margin: 0 0 0.35rem;
  line-height: 1.5;
  font-style: italic;
}
</style>
