<template>
  <div class="stats-page">
    <header class="stats-header">
      <h1>stats</h1>
      <p class="subtitle">by the numbers</p>
    </header>

    <main class="stats-content">

      <!-- Big numbers -->
      <section class="stats-numbers" aria-label="Overview">
        <div class="stat-card">
          <span class="stat-value">{{ displayRepos }}</span>
          <span class="stat-label">repos</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ displayStars }}</span>
          <span class="stat-label">stars</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ displayStreak }}</span>
          <span class="stat-label">day streak</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ displayCommits }}</span>
          <span class="stat-label">commits</span>
        </div>
      </section>

      <div class="stats-divider" aria-hidden="true"></div>

      <!-- Language breakdown -->
      <section class="stats-section" aria-label="Language breakdown">
        <h2 class="section-label">languages</h2>

        <div v-if="projectsPending" class="stats-placeholder">
          <span>loading…</span>
        </div>
        <div v-else-if="langStats.length" class="lang-section">
          <!-- Stacked bar -->
          <div class="lang-bar" role="img" :aria-label="langBarAriaLabel">
            <div
              v-for="{ lang, pct } in langStats"
              :key="lang"
              class="lang-bar-segment"
              :style="{ width: pct + '%', '--lang-color': langColor(lang) }"
              :title="`${lang} — ${pct}%`"
            ></div>
          </div>

          <!-- Legend rows -->
          <ul class="lang-list" role="list">
            <li
              v-for="{ lang, count, pct } in langStats"
              :key="lang"
              class="lang-row"
            >
              <span class="lang-dot" :style="{ '--lang-color': langColor(lang) }" aria-hidden="true"></span>
              <span class="lang-name">{{ lang }}</span>
              <span class="lang-bar-inline" aria-hidden="true">
                <span class="lang-bar-fill" :style="{ width: pct + '%', '--lang-color': langColor(lang) }"></span>
              </span>
              <span class="lang-meta">
                <span class="lang-count">{{ count }} repo{{ count !== 1 ? 's' : '' }}</span>
                <span class="lang-pct">{{ pct }}%</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <div class="stats-divider" aria-hidden="true"></div>

      <!-- Top repos by stars -->
      <section class="stats-section" aria-label="Most starred repositories">
        <h2 class="section-label">most starred</h2>

        <div v-if="projectsPending" class="stats-placeholder">
          <span>loading…</span>
        </div>
        <ul v-else-if="topRepos.length" class="top-repos" role="list">
          <li
            v-for="(repo, i) in topRepos"
            :key="repo.name"
            class="top-repo-item"
          >
            <span class="top-repo-rank" aria-hidden="true">{{ i + 1 }}</span>
            <a
              :href="repo.html_url"
              target="_blank"
              rel="noopener noreferrer"
              class="top-repo-link"
            >
              <span class="top-repo-name">{{ repo.name }}</span>
              <span class="top-repo-desc">{{ repo.description || '…' }}</span>
            </a>
            <div class="top-repo-meta">
              <span class="top-repo-stars" :aria-label="`${repo.stars} stars`">★ {{ repo.stars }}</span>
              <span v-if="repo.language" class="top-repo-lang" :style="{ '--lang-color': langColor(repo.language) }">
                <span class="top-repo-lang-dot" aria-hidden="true"></span>{{ repo.language }}
              </span>
            </div>
          </li>
        </ul>
        <div v-else class="stats-placeholder"><span>no data</span></div>
      </section>

      <div class="stats-divider" aria-hidden="true"></div>

      <!-- Recent commit activity heatmap (last 12 weeks) -->
      <section class="stats-section" aria-label="Recent commit activity">
        <h2 class="section-label">commit activity</h2>
        <div v-if="commitsPending" class="stats-placeholder"><span>loading…</span></div>
        <div v-else-if="commitActivity.length" class="commit-activity">

          <div class="heatmap">
            <!-- Month labels -->
            <div class="heatmap-months" aria-hidden="true">
              <div class="heatmap-day-spacer"></div>
              <div class="heatmap-month-track">
                <span
                  v-for="label in monthLabels"
                  :key="label.text + label.weekIdx"
                  class="heatmap-month"
                  :style="{ left: label.leftPct }"
                >{{ label.text }}</span>
              </div>
            </div>

            <!-- Day labels + cells -->
            <div class="heatmap-body">
              <div class="heatmap-days" aria-hidden="true">
                <span v-for="slot in daySlots" :key="slot.row" class="heatmap-day-slot">{{ slot.label }}</span>
              </div>
              <div class="commit-grid" role="img" :aria-label="`${commitCount} commits in last ${WEEKS} weeks`">
                <div
                  v-for="day in commitActivity"
                  :key="day.date"
                  class="commit-cell"
                  :class="`commit-cell--level${day.level}`"
                  :title="`${day.date}: ${day.count} commit${day.count !== 1 ? 's' : ''}`"
                ></div>
              </div>
            </div>
          </div>

          <div class="commit-legend" aria-hidden="true">
            <span class="legend-label">less</span>
            <span class="commit-cell commit-cell--level0"></span>
            <span class="commit-cell commit-cell--level1"></span>
            <span class="commit-cell commit-cell--level2"></span>
            <span class="commit-cell commit-cell--level3"></span>
            <span class="commit-cell commit-cell--level4"></span>
            <span class="legend-label">more</span>
          </div>
        </div>
        <div v-else class="stats-placeholder"><span>no recent commits</span></div>
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
import type { Project } from '~/server/api/projects'
import type { Commit } from '~/server/api/meta'

useHead({ title: 'stats — phareim.no' })

const { data: projectsData, pending: projectsPending } = await useFetch<Project[]>('/api/projects')
const { data: commitsData, pending: commitsPending } = await useFetch<Commit[]>('/api/meta')

// ── Derived stats ─────────────────────────────────────────────────────

const repoCount = computed(() => projectsData.value?.length ?? 0)

const totalStars = computed(() =>
  (projectsData.value ?? []).reduce((s, p) => s + p.stars, 0)
)

const commitCount = computed(() => commitsData.value?.length ?? 0)

// Language frequency map
const langMap = computed(() => {
  const map = new Map<string, number>()
  for (const p of projectsData.value ?? []) {
    if (p.language) map.set(p.language, (map.get(p.language) ?? 0) + 1)
  }
  return map
})

const langStats = computed(() => {
  const total = repoCount.value || 1
  return [...langMap.value.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({
      lang,
      count,
      pct: Math.round((count / total) * 100),
    }))
})

const langBarAriaLabel = computed(() =>
  langStats.value.map(l => `${l.lang} ${l.pct}%`).join(', ')
)

const topRepos = computed(() =>
  [...(projectsData.value ?? [])]
    .filter(p => p.stars > 0)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 5)
)

// ── Commit heatmap (last 12 weeks) ────────────────────────────────────

const WEEKS = 12
const DAYS = WEEKS * 7

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const commitActivity = computed(() => {
  const commits = commitsData.value ?? []
  const countByDay = new Map<string, number>()

  for (const c of commits) {
    const day = c.date.slice(0, 10)
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1)
  }

  const now = new Date()
  const days: { date: string; count: number; level: number }[] = []

  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const count = countByDay.get(key) ?? 0
    const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4
    days.push({ date: key, count, level })
  }

  return days
})

const currentStreak = computed(() => {
  const days = commitActivity.value
  if (!days.length) return 0
  let i = days.length - 1
  // If today has no commits yet, start from yesterday
  if (days[i]?.count === 0) i--
  let streak = 0
  while (i >= 0 && days[i]?.count > 0) {
    streak++
    i--
  }
  return streak
})

const firstDow = computed(() => {
  if (!commitActivity.value.length) return 0
  return new Date(commitActivity.value[0].date + 'T00:00:00').getDay()
})

const daySlots = computed(() =>
  Array.from({ length: 7 }, (_, row) => {
    const dow = (firstDow.value + row) % 7
    return { row, label: (dow === 1 || dow === 3 || dow === 5) ? DAY_ABBR[dow] : '' }
  })
)

const monthLabels = computed(() => {
  const labels: { text: string; weekIdx: number; leftPct: string }[] = []
  let lastMonth = ''
  commitActivity.value.forEach((day, i) => {
    const weekIdx = Math.floor(i / 7)
    const d = new Date(day.date + 'T00:00:00')
    const monthStr = d.toLocaleDateString('en-US', { month: 'short' })
    if (monthStr !== lastMonth) {
      labels.push({ text: monthStr, weekIdx, leftPct: `${(weekIdx / WEEKS * 100).toFixed(1)}%` })
      lastMonth = monthStr
    }
  })
  return labels
})

// ── Language → color mapping ──────────────────────────────────────────

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
  return LANG_COLORS[lang] ?? '#6b8cae'
}

// ── Animated display values ───────────────────────────────────────────

const displayRepos = ref(0)
const displayStars = ref(0)
const displayStreak = ref(0)
const displayCommits = ref(0)

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function animateCount(target: number, setter: (v: number) => void, duration = 900) {
  if (!target) { setter(0); return }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setter(target)
    return
  }
  const start = performance.now()
  function step(now: number) {
    const elapsed = now - start
    const t = Math.min(elapsed / duration, 1)
    setter(Math.round(easeOutCubic(t) * target))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

onMounted(() => {
  // Short delay lets the card enter-animations finish before counting starts
  setTimeout(() => {
    animateCount(repoCount.value, n => { displayRepos.value = n })
    animateCount(totalStars.value, n => { displayStars.value = n })
    animateCount(currentStreak.value, n => { displayStreak.value = n }, 700)
    animateCount(commitCount.value, n => { displayCommits.value = n })
  }, 300)
})
</script>

<style scoped>
/* ── Page shell ───────────────────────────────────────────────────── */

.stats-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 640px;
  margin: 0 auto;
}

/* ── Header ───────────────────────────────────────────────────────── */

.stats-header {
  margin-bottom: 3rem;
}

h1 {
  font-size: clamp(2rem, 6vw, 3.5rem);
  margin: 0 0 0.5rem;
  color: var(--theme-text, #111);
  font-weight: 500;
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--theme-text-muted, #666);
  font-size: 1rem;
  margin: 0;
}

/* ── Section label ────────────────────────────────────────────────── */

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
  margin: 0 0 1.1rem;
}

/* ── Divider ──────────────────────────────────────────────────────── */

.stats-divider {
  width: 36px;
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.12));
  margin: 2.25rem 0;
}

/* ── Big numbers ──────────────────────────────────────────────────── */

.stats-numbers {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.stat-card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1.1rem 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 8px var(--theme-card-shadow, rgba(0, 0, 0, 0.04));
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: card-enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.stat-card:nth-child(1) { animation-delay: 0.05s; }
.stat-card:nth-child(2) { animation-delay: 0.1s; }
.stat-card:nth-child(3) { animation-delay: 0.15s; }
.stat-card:nth-child(4) { animation-delay: 0.2s; }

@keyframes card-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--theme-card-shadow, rgba(0, 0, 0, 0.08));
}

.stat-value {
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  font-weight: 600;
  color: var(--theme-text, #111);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--theme-text-subtle, #aaa);
}

/* ── Language section ─────────────────────────────────────────────── */

.stats-section {
  animation: card-enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.25s both;
}

/* Stacked bar */
.lang-bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  gap: 2px;
  margin-bottom: 1.5rem;
}

.lang-bar-segment {
  height: 100%;
  background: var(--lang-color, #6b8cae);
  border-radius: 999px;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.lang-bar-segment:hover {
  opacity: 0.75;
}

/* Legend list */
.lang-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.lang-row {
  display: grid;
  grid-template-columns: 10px 7rem 1fr auto;
  align-items: center;
  gap: 0.6rem;
}

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lang-color, #6b8cae);
  flex-shrink: 0;
}

.lang-name {
  font-size: 0.85rem;
  color: var(--theme-text, #111);
  font-weight: 500;
  white-space: nowrap;
}

.lang-bar-inline {
  height: 4px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 999px;
  overflow: hidden;
}

.lang-bar-fill {
  display: block;
  height: 100%;
  background: var(--lang-color, #6b8cae);
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.lang-meta {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  white-space: nowrap;
}

.lang-count {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #aaa);
}

.lang-pct {
  font-size: 0.72rem;
  color: var(--theme-text-muted, #666);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 2.5rem;
  text-align: right;
}

/* ── Top repos ────────────────────────────────────────────────────── */

.top-repos {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.top-repo-item {
  display: grid;
  grid-template-columns: 1.4rem 1fr auto;
  align-items: start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.top-repo-item:hover {
  transform: translateX(3px);
  border-color: var(--theme-accent, #6b8cae);
  box-shadow: 0 4px 16px var(--theme-card-shadow, rgba(0, 0, 0, 0.06));
}

.top-repo-rank {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--theme-text-subtle, #aaa);
  font-variant-numeric: tabular-nums;
  padding-top: 2px;
  text-align: right;
}

.top-repo-link {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  text-decoration: none;
  color: inherit;
  min-width: 0;
}

.top-repo-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--theme-text, #111);
  transition: color 0.2s ease;
}

.top-repo-item:hover .top-repo-name {
  color: var(--theme-accent, #6b8cae);
}

.top-repo-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 3px;
  border-radius: 4px;
}

.top-repo-desc {
  font-size: 0.75rem;
  color: var(--theme-text-subtle, #aaa);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-repo-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  flex-shrink: 0;
}

.top-repo-stars {
  font-size: 0.75rem;
  color: var(--theme-text-muted, #666);
  font-weight: 600;
  white-space: nowrap;
}

.top-repo-lang {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
}

.top-repo-lang-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lang-color, #6b8cae);
  flex-shrink: 0;
}

/* ── Commit heatmap ───────────────────────────────────────────────── */

.commit-activity {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.heatmap {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.heatmap-months {
  display: flex;
  gap: 6px;
}

.heatmap-day-spacer {
  flex-shrink: 0;
  width: 24px;
}

.heatmap-month-track {
  flex: 1;
  position: relative;
  height: 14px;
  overflow: visible;
}

.heatmap-month {
  position: absolute;
  font-size: 0.55rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
  line-height: 14px;
}

.heatmap-body {
  display: flex;
  gap: 6px;
}

.heatmap-days {
  flex-shrink: 0;
  width: 24px;
  display: grid;
  grid-template-rows: repeat(7, 10px);
  gap: 2px;
}

.heatmap-day-slot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 0.5rem;
  color: var(--theme-text-subtle, #aaa);
  line-height: 1;
}

.commit-grid {
  flex: 1;
  display: grid;
  grid-template-rows: repeat(7, 10px);
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 2px;
}

.commit-cell {
  border-radius: 2px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.08));
  transition: opacity 0.2s ease;
}

.commit-cell:hover {
  opacity: 0.75;
}

.commit-cell--level0 { background: var(--theme-card-border, rgba(0, 0, 0, 0.08)); }
.commit-cell--level1 { background: color-mix(in srgb, var(--theme-accent, #6b8cae) 30%, transparent); }
.commit-cell--level2 { background: color-mix(in srgb, var(--theme-accent, #6b8cae) 55%, transparent); }
.commit-cell--level3 { background: color-mix(in srgb, var(--theme-accent, #6b8cae) 80%, transparent); }
.commit-cell--level4 { background: var(--theme-accent, #6b8cae); }

.commit-legend {
  display: flex;
  align-items: center;
  gap: 3px;
  justify-content: flex-end;
}

.commit-legend .commit-cell {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.legend-label {
  font-size: 0.6rem;
  color: var(--theme-text-subtle, #aaa);
  padding: 0 4px;
}

/* ── Placeholder ──────────────────────────────────────────────────── */

.stats-placeholder {
  font-size: 0.9rem;
  color: var(--theme-text-subtle, #aaa);
  font-style: italic;
  padding: 0.5rem 0;
}

/* ── Responsive ───────────────────────────────────────────────────── */

@media (max-width: 480px) {
  .stats-numbers {
    grid-template-columns: repeat(2, 1fr);
  }

  .lang-row {
    grid-template-columns: 10px 5.5rem 1fr auto;
  }

  .heatmap-day-spacer,
  .heatmap-days {
    width: 16px;
  }
}

/* ── Hacker theme overrides ───────────────────────────────────────── */

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

:global(.hacker-page) .stat-card {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .stat-card:hover {
  box-shadow: 0 0 16px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

:global(.hacker-page) .stat-value {
  font-family: monospace;
  text-shadow: 0 0 8px currentColor;
}

:global(.hacker-page) .lang-bar {
  border-radius: 0;
  gap: 1px;
}

:global(.hacker-page) .lang-bar-segment {
  border-radius: 0;
}

:global(.hacker-page) .lang-dot {
  border-radius: 0;
}

:global(.hacker-page) .lang-name {
  font-family: monospace;
  font-size: 0.8rem;
}

:global(.hacker-page) .top-repo-item {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .top-repo-item:hover {
  box-shadow: 0 0 16px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

:global(.hacker-page) .top-repo-name {
  font-family: monospace;
}

:global(.hacker-page) .commit-cell {
  border-radius: 0;
}

:global(.hacker-page) .heatmap-month,
:global(.hacker-page) .heatmap-day-slot {
  font-family: monospace;
}

/* ── Space theme overrides ────────────────────────────────────────── */

:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .subtitle {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
}

:global(.space-page) .section-label {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
}

:global(.space-page) .stat-card {
  box-shadow:
    0 2px 8px var(--theme-card-shadow, rgba(140, 170, 220, 0.08)),
    0 0 0 1px rgba(140, 170, 220, 0.06);
}

:global(.space-page) .stat-card:hover {
  box-shadow:
    0 6px 20px var(--theme-card-shadow, rgba(140, 170, 220, 0.15)),
    0 0 0 1px rgba(140, 170, 220, 0.2);
}

:global(.space-page) .stat-value {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
}

:global(.space-page) .top-repo-item:hover {
  box-shadow:
    0 8px 32px var(--theme-card-shadow, rgba(140, 170, 220, 0.15)),
    0 0 0 1px rgba(140, 170, 220, 0.25);
}

:global(.space-page) .commit-cell--level1 { background: rgba(137, 171, 208, 0.25); }
:global(.space-page) .commit-cell--level2 { background: rgba(137, 171, 208, 0.5); }
:global(.space-page) .commit-cell--level3 { background: rgba(137, 171, 208, 0.75); }
:global(.space-page) .commit-cell--level4 { background: #89abd0; }
</style>
