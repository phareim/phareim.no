<template>
  <div class="projects-page">
    <header class="projects-header">
      <NuxtLink to="/" class="back-link">← home</NuxtLink>
      <h1>projects</h1>
      <p class="subtitle">things i've built and tinkered with</p>
    </header>

    <main class="projects-grid" v-if="!pending && projects?.length">
      <a
        v-for="project in projects"
        :key="project.name"
        :href="project.html_url"
        target="_blank"
        rel="noopener noreferrer"
        class="project-card"
      >
        <div class="project-top">
          <h2 class="project-name">{{ project.name.replace(/-/g, '\u2011') }}</h2>
          <span v-if="project.stars > 0" class="project-stars" :title="`${project.stars} stars`">
            ★ {{ project.stars }}
          </span>
        </div>
        <p class="project-description">{{ project.description || '…' }}</p>
        <div class="project-footer">
          <span
            v-if="project.language"
            class="language-badge"
            :style="{ '--lang-color': langColor(project.language) }"
          >
            <span class="lang-dot"></span>{{ project.language }}
          </span>
          <span class="project-date">{{ formatDate(project.pushed_at) }}</span>
        </div>
      </a>
    </main>

    <div v-else-if="pending" class="loading">
      <span class="loading-text">fetching projects…</span>
    </div>

    <div v-else class="loading">
      <span class="loading-text">no projects found</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Project } from '~/server/api/projects'

const { data: projects, pending } = await useFetch<Project[]>('/api/projects')

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Vue: '#41b883',
  Swift: '#f05138',
  Python: '#3572a5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Go: '#00add8',
  Rust: '#dea584',
}

function langColor(lang: string): string {
  return LANG_COLORS[lang] ?? 'var(--theme-accent, #888)'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en', { month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.projects-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 4rem;
  box-sizing: border-box;
  max-width: 900px;
  margin: 0 auto;
}

.projects-header {
  margin-bottom: 3rem;
}

.back-link {
  display: inline-block;
  color: var(--theme-text-muted, #666);
  text-decoration: none;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--theme-text, #111);
}

.back-link:focus-visible {
  outline: 2px solid var(--theme-accent, #89abd0);
  outline-offset: 3px;
  border-radius: 3px;
  color: var(--theme-text, #111);
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

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

.project-card {
  display: flex;
  flex-direction: column;
  background: var(--theme-card-bg, rgba(255,255,255,0.6));
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1.25rem 1.4rem;
  text-decoration: none;
  color: inherit;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px var(--theme-card-shadow, rgba(0,0,0,0.04));
  min-height: 130px;
}

.project-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 24px var(--theme-card-shadow, rgba(0,0,0,0.08));
  border-color: var(--theme-accent, #89abd0);
}

.project-card:focus-visible {
  outline: 2px solid var(--theme-accent, #89abd0);
  outline-offset: 2px;
  transform: translateY(-3px);
  box-shadow: 0 6px 24px var(--theme-card-shadow, rgba(0,0,0,0.08));
}

.project-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.project-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--theme-text, #111);
  line-height: 1.3;
  word-break: break-word;
}

.project-stars {
  font-size: 0.75rem;
  color: var(--theme-accent, #888);
  white-space: nowrap;
  padding-top: 0.1rem;
  flex-shrink: 0;
}

.project-description {
  font-size: 0.85rem;
  color: var(--theme-text-muted, #666);
  margin: 0 0 auto;
  line-height: 1.5;
  flex: 1;
  padding-bottom: 0.75rem;
}

.project-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--theme-card-border, rgba(0,0,0,0.06));
}

.language-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--theme-text-muted, #666);
}

.lang-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lang-color, #888);
  flex-shrink: 0;
}

.project-date {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #aaa);
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
}

/* Hacker theme overrides */
:global(.hacker-page) .project-card {
  border-radius: 0;
}

:global(.hacker-page) .project-name {
  font-family: monospace;
  text-transform: lowercase;
}

:global(.hacker-page) .project-card:hover,
:global(.hacker-page) .project-card:focus-visible {
  box-shadow: 0 0 20px var(--theme-card-shadow, rgba(0,255,65,0.2));
  outline-color: var(--theme-accent, #00ff41);
}

:global(.hacker-page) .back-link,
:global(.hacker-page) .subtitle {
  font-family: monospace;
}

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}
</style>
