<template>
  <div class="lab-page">
    <header class="lab-header">
      <h1>lab</h1>
      <p class="subtitle">live experiments and side projects</p>
    </header>

    <main class="lab-content">

      <section class="lab-section">
        <h2 class="section-label">live tools</h2>
        <div class="lab-grid">
          <a
            v-for="tool in liveTools"
            :key="tool.id"
            :href="tool.href"
            target="_blank"
            rel="noopener noreferrer"
            class="lab-card"
          >
            <div class="lab-card-top">
              <span class="lab-card-icon" aria-hidden="true">{{ tool.icon }}</span>
              <span class="lab-status" :class="`status-${tool.status}`">{{ tool.status }}</span>
            </div>
            <h3 class="lab-card-name">{{ tool.name }}</h3>
            <p class="lab-card-desc">{{ tool.desc }}</p>
            <div class="lab-card-footer">
              <span class="lab-card-tech">{{ tool.tech }}</span>
              <span class="lab-card-arrow" aria-hidden="true">↗</span>
            </div>
          </a>
        </div>
      </section>

      <div class="lab-divider" aria-hidden="true"></div>

      <section class="lab-section">
        <h2 class="section-label">this site</h2>
        <div class="lab-meta-card">
          <div class="lab-meta-row">
            <span class="lab-meta-label">built with</span>
            <span class="lab-meta-value">Nuxt 3 + Cloudflare Pages</span>
          </div>
          <div class="lab-meta-row">
            <span class="lab-meta-label">maintained by</span>
            <span class="lab-meta-value">a scheduled Claude agent + Petter</span>
          </div>
          <div class="lab-meta-row">
            <span class="lab-meta-label">database</span>
            <span class="lab-meta-value">Cloudflare D1 (SQLite)</span>
          </div>
          <div class="lab-meta-row">
            <span class="lab-meta-label">storage</span>
            <span class="lab-meta-value">Cloudflare R2</span>
          </div>
          <div class="lab-meta-row">
            <span class="lab-meta-label">changelog</span>
            <NuxtLink to="/meta" class="lab-meta-link">see /meta</NuxtLink>
          </div>
        </div>
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'lab — phareim.no' })

interface Tool {
  id: string
  name: string
  desc: string
  href: string
  icon: string
  tech: string
  status: 'live' | 'experimental' | 'archived'
}

const liveTools: Tool[] = [
  {
    id: 'reddot',
    name: 'red dot game',
    desc: 'a small browser game. click the dot. try not to miss.',
    href: 'https://dot.phareim.no',
    icon: '🔴',
    tech: 'vanilla js',
    status: 'live',
  },
  {
    id: 'reader',
    name: 'rss reader',
    desc: 'a personal rss feed reader. built for reading, not for analytics.',
    href: 'https://reader.phareim.no',
    icon: '📰',
    tech: 'nuxt + d1',
    status: 'live',
  },
]
</script>

<style scoped>
.lab-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 680px;
  margin: 0 auto;
}

.lab-header {
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

/* ── Layout ─────────────────────────────────────────────────── */

.lab-content {
  display: flex;
  flex-direction: column;
}

.lab-section {
  padding: 0.25rem 0;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
  margin: 0 0 1.1rem;
}

.lab-divider {
  width: 36px;
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.12));
  margin: 2.5rem 0;
}

/* ── Tool grid ──────────────────────────────────────────────── */

.lab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.lab-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1.25rem 1.3rem;
  text-decoration: none;
  color: inherit;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px var(--theme-card-shadow, rgba(0, 0, 0, 0.04));
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.lab-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 22px var(--theme-card-shadow, rgba(0, 0, 0, 0.08));
  border-color: var(--theme-accent, #89abd0);
}

.lab-card:focus-visible {
  outline: 2px solid var(--theme-accent, #89abd0);
  outline-offset: 2px;
  transform: translateY(-3px);
}

.lab-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.lab-card-icon {
  font-size: 1.4rem;
  line-height: 1;
}

.lab-status {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.2em 0.55em;
  border-radius: 999px;
  border: 1px solid transparent;
}

.lab-status.status-live {
  color: #3a9e5c;
  background: rgba(58, 158, 92, 0.1);
  border-color: rgba(58, 158, 92, 0.25);
}

.lab-status.status-experimental {
  color: var(--theme-accent, #6b8cae);
  background: color-mix(in srgb, var(--theme-accent, #6b8cae) 10%, transparent);
  border-color: color-mix(in srgb, var(--theme-accent, #6b8cae) 25%, transparent);
}

.lab-status.status-archived {
  color: var(--theme-text-subtle, #aaa);
  background: color-mix(in srgb, var(--theme-text-subtle, #aaa) 8%, transparent);
  border-color: color-mix(in srgb, var(--theme-text-subtle, #aaa) 20%, transparent);
}

.lab-card-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--theme-text, #111);
  margin: 0;
  line-height: 1.3;
}

.lab-card-desc {
  font-size: 0.85rem;
  color: var(--theme-text-muted, #666);
  line-height: 1.55;
  margin: 0;
  flex: 1;
}

.lab-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.06));
}

.lab-card-tech {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #aaa);
  font-family: monospace;
}

.lab-card-arrow {
  font-size: 0.85rem;
  color: var(--theme-text-subtle, #aaa);
  transition: color 0.2s ease, transform 0.2s ease;
}

.lab-card:hover .lab-card-arrow {
  color: var(--theme-accent, #89abd0);
  transform: translate(2px, -2px);
}

/* ── Meta card ──────────────────────────────────────────────── */

.lab-meta-card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1.1rem 1.3rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px var(--theme-card-shadow, rgba(0, 0, 0, 0.04));
  display: flex;
  flex-direction: column;
  gap: 0;
}

.lab-meta-row {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.05));
}

.lab-meta-row:last-child {
  border-bottom: none;
}

.lab-meta-label {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
  min-width: 7rem;
  flex-shrink: 0;
}

.lab-meta-value {
  font-size: 0.88rem;
  color: var(--theme-text-muted, #555);
}

.lab-meta-link {
  font-size: 0.88rem;
  color: var(--theme-text, #111);
  text-decoration: none;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.2));
  transition: border-color 0.2s ease, color 0.2s ease;
}

.lab-meta-link:hover {
  border-color: var(--theme-accent, #6b8cae);
  color: var(--theme-accent, #6b8cae);
}

.lab-meta-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 2px;
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

:global(.hacker-page) .lab-card {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .lab-card:hover {
  box-shadow: 0 0 20px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

:global(.hacker-page) .lab-card-name {
  font-family: monospace;
  text-transform: lowercase;
}

:global(.hacker-page) .lab-card-desc {
  font-family: monospace;
}

:global(.hacker-page) .lab-status.status-live {
  color: var(--theme-text, #00ff41);
  background: rgba(0, 255, 65, 0.08);
  border-color: rgba(0, 255, 65, 0.3);
  border-radius: 0;
}

:global(.hacker-page) .lab-status.status-experimental {
  border-radius: 0;
}

:global(.hacker-page) .lab-meta-card {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .lab-meta-label {
  font-family: monospace;
}

:global(.hacker-page) .lab-meta-value {
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

:global(.space-page) .section-label {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
}

:global(.space-page) .lab-card:hover {
  box-shadow:
    0 8px 32px var(--theme-card-shadow, rgba(140, 170, 220, 0.15)),
    0 0 0 1px rgba(140, 170, 220, 0.25);
}

:global(.space-page) .lab-card-name {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.01em;
}

:global(.space-page) .lab-status.status-live {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  letter-spacing: 0.05em;
}
</style>
