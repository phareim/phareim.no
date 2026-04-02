<template>
  <div class="projects-page">
    <header class="projects-header">
      <h1>projects</h1>
      <p class="subtitle">things i've built and tinkered with</p>
    </header>

    <div v-if="!pending && projects?.length" class="projects-filters">
      <div class="search-wrapper">
        <input
          v-model="search"
          type="search"
          class="search-input"
          placeholder="search projects…"
          aria-label="Search projects"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
      <div class="lang-filters" role="group" aria-label="Filter by language">
        <button
          :class="['lang-btn', { active: activeLang === null }]"
          @click="activeLang = null"
          aria-pressed="activeLang === null"
        >all</button>
        <button
          v-for="lang in availableLangs"
          :key="lang"
          :class="['lang-btn', { active: activeLang === lang }]"
          :style="{ '--lang-color': langColor(lang) }"
          @click="activeLang = activeLang === lang ? null : lang"
          :aria-pressed="activeLang === lang"
        >
          <span class="lang-dot"></span>{{ lang }}
        </button>
      </div>
    </div>

    <main v-if="!pending && filteredProjects.length" class="projects-grid">
      <a
        v-for="project in filteredProjects"
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

    <div v-else-if="!pending && !filteredProjects.length && projects?.length" class="loading">
      <span class="loading-text">no matches found</span>
    </div>

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

const search = ref('')
const activeLang = ref<string | null>(null)

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

const availableLangs = computed(() => {
  if (!projects.value) return []
  const langs = new Set(projects.value.map(p => p.language).filter(Boolean) as string[])
  return [...langs].sort()
})

const filteredProjects = computed(() => {
  if (!projects.value) return []
  const q = search.value.trim().toLowerCase()
  return projects.value.filter(p => {
    const matchesSearch = !q
      || p.name.toLowerCase().includes(q)
      || (p.description ?? '').toLowerCase().includes(q)
    const matchesLang = activeLang.value === null || p.language === activeLang.value
    return matchesSearch && matchesLang
  })
})
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
  margin-bottom: 2rem;
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

/* ── Filters ───────────────────────────────────────────────── */

.projects-filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.search-wrapper {
  width: 100%;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 1rem;
  background: var(--theme-card-bg, rgba(255,255,255,0.6));
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.1));
  border-radius: var(--theme-card-radius, 16px);
  color: var(--theme-text, #111);
  font-family: inherit;
  font-size: 0.9rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

.search-input::placeholder {
  color: var(--theme-text-subtle, #aaa);
}

.search-input:focus {
  border-color: var(--theme-accent, #89abd0);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent, #89abd0) 20%, transparent);
}

/* Remove webkit search cancel button styling */
.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--theme-text-subtle, #aaa);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M18 6L6 18M6 6l12 12' stroke='currentColor' stroke-width='2'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M18 6L6 18M6 6l12 12' stroke='currentColor' stroke-width='2'/%3E%3C/svg%3E");
  cursor: pointer;
}

.lang-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  font-family: inherit;
  font-size: 0.78rem;
  color: var(--theme-text-muted, #666);
  background: var(--theme-card-bg, rgba(255,255,255,0.5));
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.08));
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.lang-btn:hover {
  border-color: var(--theme-accent, #89abd0);
  color: var(--theme-text, #111);
}

.lang-btn.active {
  border-color: var(--theme-accent, #89abd0);
  color: var(--theme-text, #111);
  background: color-mix(in srgb, var(--theme-accent, #89abd0) 12%, var(--theme-card-bg, rgba(255,255,255,0.6)));
}

.lang-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #89abd0);
  outline-offset: 2px;
}

.lang-btn .lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lang-color, var(--theme-accent, #888));
  flex-shrink: 0;
}

/* ── Grid ──────────────────────────────────────────────────── */

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

/* ── Hacker theme overrides ────────────────────────────────── */

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

:global(.hacker-page) .subtitle {
  font-family: monospace;
}

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .search-input,
:global(.hacker-page) .lang-btn {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .lang-btn.active {
  background: color-mix(in srgb, var(--theme-accent, #00ff41) 15%, transparent);
}
</style>
