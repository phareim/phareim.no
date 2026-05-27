<template>
  <AlmanacFrame title="Projects" kicker="Things I've built and tinkered with." back="/">
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

      <!-- Language distribution bar -->
      <div v-if="langStats.length > 1" class="lang-distribution">
        <div
          class="dist-bar"
          role="group"
          aria-label="Filter projects by language"
        >
          <button
            v-for="{ lang, count, pct } in langStats"
            :key="lang"
            class="dist-segment"
            :class="{ active: activeLang === lang, dimmed: activeLang !== null && activeLang !== lang }"
            :style="{ '--pct': pct + '%', '--color': langColor(lang) }"
            :title="`${lang}: ${count} project${count !== 1 ? 's' : ''}`"
            :aria-label="`${lang}: ${count} project${count !== 1 ? 's' : ''}`"
            :aria-pressed="activeLang === lang"
            @click="activeLang = activeLang === lang ? null : lang"
          ></button>
        </div>
        <div class="dist-legend">
          <button
            v-for="{ lang, count } in langStats"
            :key="lang"
            class="dist-legend-item"
            :class="{ active: activeLang === lang, dimmed: activeLang !== null && activeLang !== lang }"
            :aria-pressed="activeLang === lang"
            @click="activeLang = activeLang === lang ? null : lang"
          >
            <span class="dist-dot" :style="{ '--color': langColor(lang) }"></span>
            <span class="dist-lang">{{ lang }}</span>
            <span class="dist-count">{{ count }}</span>
          </button>
          <button
            v-if="activeLang !== null"
            class="dist-clear"
            @click="activeLang = null"
            aria-label="Show all languages"
          >clear ×</button>
        </div>
      </div>

      <!-- Sort controls -->
      <div class="sort-controls" role="group" aria-label="Sort projects by">
        <span class="sort-label">sort</span>
        <button
          v-for="opt in sortOptions"
          :key="opt.value"
          :class="['sort-btn', { active: sortBy === opt.value }]"
          :aria-pressed="sortBy === opt.value"
          @click="sortBy = opt.value"
        >{{ opt.label }}</button>
      </div>
    </div>

    <div v-if="!pending && filteredProjects.length" class="projects-grid">
      <a
        v-for="(project, index) in filteredProjects"
        :key="project.name"
        :href="project.html_url"
        target="_blank"
        rel="noopener noreferrer"
        class="project-card"
        :style="{ '--card-index': Math.min(index, 14) }"
      >
        <div class="project-top">
          <h2 class="project-name">{{ project.name.replace(/-/g, '‑') }}</h2>
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
    </div>

    <div v-else-if="!pending && !filteredProjects.length && projects?.length" class="loading">
      <span class="loading-text">no matches found</span>
    </div>

    <div v-else-if="pending" class="loading">
      <span class="loading-text">fetching projects…</span>
    </div>

    <div v-else class="loading">
      <span class="loading-text">no projects found</span>
    </div>
  </AlmanacFrame>
</template>

<script setup lang="ts">
import type { Project } from '~/server/api/projects'

useHead({ title: 'projects — phareim.no' })

const { data: projects, pending } = await useFetch<Project[]>('/api/projects')

const search = ref('')
const activeLang = ref<string | null>(null)
const sortBy = ref<'recent' | 'stars' | 'name'>('recent')

const sortOptions: { value: 'recent' | 'stars' | 'name'; label: string }[] = [
  { value: 'recent', label: 'recent' },
  { value: 'stars',  label: 'stars' },
  { value: 'name',   label: 'a→z' },
]

// Language dot colors — these are GitHub's canonical per-language colors.
// They live inside SVG-style data dots (interior decoration, not chrome),
// so per the Almanac rule "interior is native" we keep the hex literals.
const LANG_COLORS: Record<string, string> = {
  TypeScript:  '#3178c6',
  JavaScript:  '#f7df1e',
  Vue:         '#42b883',
  Python:      '#3572a5',
  Go:          '#00add8',
  Rust:        '#dea584',
  CSS:         '#563d7c',
  HTML:        '#e34c26',
  Swift:       '#f05138',
  Kotlin:      '#a97bff',
  Java:        '#b07219',
  'C#':        '#178600',
  'C++':       '#f34b7d',
  C:           '#555555',
  Ruby:        '#701516',
  PHP:         '#4f5d95',
  Shell:       '#89e051',
  Dockerfile:  '#384d54',
  Nix:         '#7e7eff',
  Svelte:      '#ff3e00',
}

function langColor(lang: string): string {
  return LANG_COLORS[lang] ?? 'var(--theme-text-subtle, #a39e8f)'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

const langStats = computed(() => {
  if (!projects.value) return []
  const counts: Record<string, number> = {}
  for (const p of projects.value) {
    if (p.language) counts[p.language] = (counts[p.language] ?? 0) + 1
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (!total) return []
  return Object.entries(counts)
    .map(([lang, count]) => ({ lang, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count)
})

const filteredProjects = computed(() => {
  if (!projects.value) return []
  const q = search.value.trim().toLowerCase()
  const filtered = projects.value.filter(p => {
    const matchesSearch = !q
      || p.name.toLowerCase().includes(q)
      || (p.description ?? '').toLowerCase().includes(q)
    const matchesLang = activeLang.value === null || p.language === activeLang.value
    return matchesSearch && matchesLang
  })
  return [...filtered].sort((a, b) => {
    if (sortBy.value === 'stars') return b.stars - a.stars
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
  })
})
</script>

<style scoped>
/* ── Filters ───────────────────────────────────────────────── */

.projects-filters {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-bottom: 2rem;
}

.search-wrapper {
  width: 100%;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.85rem;
  background: var(--theme-input-bg, transparent);
  border: 0;
  border-bottom: 1px solid var(--theme-input-border, rgba(0,0,0,0.2));
  border-radius: 0;
  color: var(--theme-text, #1a1a1a);
  font-family: inherit;
  font-size: 0.95rem;
  transition: border-color 0.2s ease;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

.search-input::placeholder {
  color: var(--theme-text-subtle, #a39e8f);
  font-style: italic;
}

.search-input:focus {
  border-bottom-color: var(--theme-accent, #c14a2a);
}

/* ── Language distribution bar ─────────────────────────────── */

.lang-distribution {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.dist-bar {
  display: flex;
  height: 6px;
  border-radius: 0;
  overflow: hidden;
  gap: 1px;
}

.dist-segment {
  flex: 0 0 var(--pct);
  height: 100%;
  background: var(--color, var(--theme-text-subtle, #a39e8f));
  border: none;
  padding: 0;
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 0.2s ease, flex-basis 0.3s ease;
  border-radius: 0;
}

.dist-segment:hover,
.dist-segment.active {
  opacity: 1;
}

.dist-segment.dimmed {
  opacity: 0.25;
}

.dist-segment:focus-visible {
  outline: 1px solid var(--color, var(--theme-accent, #c14a2a));
  outline-offset: 2px;
}

.dist-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.85rem;
  align-items: center;
}

.dist-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  padding: 0.15rem 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.75rem;
  color: var(--theme-text-muted, #6a6a6a);
  transition: color 0.15s ease, opacity 0.15s ease;
}

.dist-legend-item:hover,
.dist-legend-item.active {
  color: var(--theme-text, #1a1a1a);
}

.dist-legend-item.dimmed {
  opacity: 0.4;
}

.dist-legend-item:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
}

.dist-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color, var(--theme-text-subtle, #a39e8f));
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}

.dist-lang {
  font-weight: 500;
}

.dist-count {
  color: var(--theme-text-subtle, #a39e8f);
  font-size: 0.68rem;
  font-style: italic;
}

.dist-clear {
  background: none;
  border: none;
  padding: 0.15rem 0;
  margin-left: 0.25rem;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.7rem;
  font-style: italic;
  color: var(--theme-text-subtle, #a39e8f);
  transition: color 0.15s ease;
}

.dist-clear:hover {
  color: var(--theme-accent, #c14a2a);
}

.dist-clear:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Sort controls ─────────────────────────────────────────── */

.sort-controls {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.sort-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--theme-text-subtle, #a39e8f);
  margin-right: 0.15rem;
}

.sort-btn {
  font-family: inherit;
  font-size: 0.75rem;
  font-style: italic;
  text-transform: lowercase;
  letter-spacing: 0.02em;
  padding: 0.15rem 0;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: none;
  color: var(--theme-text-subtle, #a39e8f);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.sort-btn:hover {
  color: var(--theme-text, #1a1a1a);
}

.sort-btn.active {
  color: var(--theme-accent, #c14a2a);
  border-bottom-color: var(--theme-accent, #c14a2a);
}

.sort-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
}

/* ── Grid — hairline cards, no shadow or blur ──────────────── */

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.project-card {
  display: flex;
  flex-direction: column;
  background: var(--theme-card-bg, transparent);
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.15));
  border-radius: var(--theme-card-radius, 0);
  padding: 1rem 1.1rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s ease;
  min-height: 130px;
  animation: card-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) backwards;
  animation-delay: calc(var(--card-index, 0) * 35ms);
}

.project-card:hover {
  border-color: var(--theme-accent, #c14a2a);
}

.project-card:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
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
  color: var(--theme-text, #1a1a1a);
  line-height: 1.3;
  word-break: break-word;
  border-bottom: 0;
  padding-bottom: 0;
}

.project-card:hover .project-name {
  color: var(--theme-accent, #c14a2a);
}

.project-stars {
  font-size: 0.75rem;
  color: var(--theme-accent, #c14a2a);
  white-space: nowrap;
  padding-top: 0.1rem;
  flex-shrink: 0;
}

.project-description {
  font-size: 0.85rem;
  color: var(--theme-text-muted, #6a6a6a);
  margin: 0 0 auto;
  line-height: 1.55;
  flex: 1;
  padding-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--theme-card-border, rgba(0,0,0,0.08));
}

.language-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--theme-text-muted, #6a6a6a);
}

.lang-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lang-color, var(--theme-text-subtle, #a39e8f));
  flex-shrink: 0;
}

.project-date {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #a39e8f);
  font-style: italic;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 30vh;
}

.loading-text {
  color: var(--theme-text-muted, #6a6a6a);
  font-size: 1rem;
  font-style: italic;
  animation: loading-pulse 1.6s ease-in-out infinite;
}

@keyframes loading-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  .project-card {
    animation: none;
  }
}
</style>
