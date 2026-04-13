<template>
  <div class="colophon-page">
    <header class="colophon-header">
      <h1>colophon</h1>
      <p class="subtitle">how this place works</p>
    </header>

    <main class="colophon-content">

      <!-- The agent -->
      <section class="colophon-section">
        <h2 class="section-label">the agent</h2>
        <div class="colophon-prose">
          <p>
            this site updates itself. a scheduled
            <a href="https://www.anthropic.com/claude" target="_blank" rel="noopener noreferrer" class="colophon-link">claude</a>
            agent runs every six hours and decides whether to make a small polish
            or a medium feature. it reads the codebase, checks a task list,
            and ships a commit — no human in the loop.
          </p>
          <p>
            small updates happen at 06:00 and 18:00 utc: spacing, accessibility,
            hover states, tiny animations. medium updates happen at 00:00 and
            12:00 utc: new pages, new features, architectural improvements.
          </p>
          <p>
            you can watch the history on <NuxtLink to="/meta" class="colophon-link">the meta page</NuxtLink>
            or the <NuxtLink to="/activity" class="colophon-link">activity feed</NuxtLink>.
            the agent wrote this very page.
          </p>
        </div>
      </section>

      <div class="colophon-divider" aria-hidden="true"></div>

      <!-- The three themes -->
      <section class="colophon-section">
        <h2 class="section-label">three themes</h2>
        <div class="theme-cards">

          <div class="theme-card theme-card--scandi">
            <div class="theme-card-header">
              <span class="theme-card-key" aria-label="Press 1">1</span>
              <span class="theme-card-name">scandinavian glass</span>
            </div>
            <p class="theme-card-desc">
              frosted glass surfaces, nature-inspired tones, soft aurora
              in the background. inspired by nordic design sensibility —
              calm, functional, with a faint warmth underneath the cool.
            </p>
            <div class="theme-card-swatches" aria-hidden="true">
              <span class="swatch" style="background: #f5f5f3; border: 1px solid rgba(0,0,0,0.1);"></span>
              <span class="swatch" style="background: rgba(255,255,255,0.65);"></span>
              <span class="swatch" style="background: #6b8cae;"></span>
              <span class="swatch" style="background: #9bab8b;"></span>
              <span class="swatch" style="background: #c1272d;"></span>
            </div>
          </div>

          <div class="theme-card theme-card--hacker">
            <div class="theme-card-header">
              <span class="theme-card-key" aria-label="Press 2">2</span>
              <span class="theme-card-name">cyberpunk</span>
            </div>
            <p class="theme-card-desc">
              terminal green on pitch black, scanline grid, digital rain
              dripping down the screen. the landing page becomes a
              space invaders game. sharp corners, monospace everything.
            </p>
            <div class="theme-card-swatches" aria-hidden="true">
              <span class="swatch" style="background: #0a0a0a;"></span>
              <span class="swatch" style="background: rgba(0,20,0,0.8); border: 1px solid #008F11;"></span>
              <span class="swatch" style="background: #00ff41;"></span>
              <span class="swatch" style="background: #008F11;"></span>
              <span class="swatch" style="background: #ff0055;"></span>
            </div>
          </div>

          <div class="theme-card theme-card--space">
            <div class="theme-card-header">
              <span class="theme-card-key" aria-label="Press 3">3</span>
              <span class="theme-card-name">space</span>
            </div>
            <p class="theme-card-desc">
              deep black, drifting star field, impact-weight type.
              everything is uppercase and severe. stellar blues and ambers.
              inspired by the kind of sci-fi that takes itself just seriously
              enough to be fun.
            </p>
            <div class="theme-card-swatches" aria-hidden="true">
              <span class="swatch" style="background: #0a0a0f;"></span>
              <span class="swatch" style="background: rgba(15,15,30,0.75); border: 1px solid rgba(140,170,220,0.15);"></span>
              <span class="swatch" style="background: #89abd0;"></span>
              <span class="swatch" style="background: #e8c87a;"></span>
              <span class="swatch" style="background: #e06060;"></span>
            </div>
          </div>

        </div>
      </section>

      <div class="colophon-divider" aria-hidden="true"></div>

      <!-- Design decisions -->
      <section class="colophon-section">
        <h2 class="section-label">decisions</h2>
        <ul class="decision-list">
          <li class="decision-item">
            <span class="decision-title">no hardcoded colors</span>
            <span class="decision-desc">every color in every component goes through <code>var(--theme-*)</code> css custom properties. switching themes is purely css — no javascript, no flash.</span>
          </li>
          <li class="decision-item">
            <span class="decision-title">edge-first</span>
            <span class="decision-desc">hosted on cloudflare pages. the database (d1) and object storage (r2) run at the edge too. zero cold starts, global latency under 50ms.</span>
          </li>
          <li class="decision-item">
            <span class="decision-title">no auth (for now)</span>
            <span class="decision-desc">auth was removed intentionally. the guestbook uses rate-limiting per ip instead of accounts. fewer moving parts, more trust in users.</span>
          </li>
          <li class="decision-item">
            <span class="decision-title">keyboard first</span>
            <span class="decision-desc"><kbd>m</kbd> opens the menu. <kbd>[</kbd> and <kbd>]</kbd> navigate between pages. <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> switch themes. <kbd>?</kbd> shows all shortcuts. <kbd>⌘k</kbd> opens the command palette.</span>
          </li>
          <li class="decision-item">
            <span class="decision-title">hand-rolled canvas</span>
            <span class="decision-desc">the landing page's bubble physics simulation is pure canvas api — elastic collisions, gyroscope support, momentum. no three.js, no library.</span>
          </li>
          <li class="decision-item">
            <span class="decision-title">public apis only</span>
            <span class="decision-desc">bluesky posts come from the public at protocol api. github repos and commits from the public github api. no scraping, no fragile secrets.</span>
          </li>
        </ul>
      </section>

      <div class="colophon-divider" aria-hidden="true"></div>

      <!-- Stack -->
      <section class="colophon-section">
        <h2 class="section-label">built with</h2>
        <div class="stack-grid">
          <a v-for="item in stack" :key="item.name" :href="item.href" target="_blank" rel="noopener noreferrer" class="stack-item">
            <span class="stack-name">{{ item.name }}</span>
            <span class="stack-role">{{ item.role }}</span>
          </a>
        </div>
      </section>

      <div class="colophon-divider" aria-hidden="true"></div>

      <!-- Footer note -->
      <section class="colophon-section colophon-footer-note">
        <p>
          source code is on
          <a href="https://github.com/phareim/phareim.no" target="_blank" rel="noopener noreferrer" class="colophon-link">github</a>.
          deploy on every push to master via github actions.
        </p>
        <p>
          last updated: automatically, probably while you were sleeping.
        </p>
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'colophon — phareim.no' })

const stack = [
  { name: 'Nuxt 3',            role: 'framework',   href: 'https://nuxt.com' },
  { name: 'Vue 3',             role: 'ui',          href: 'https://vuejs.org' },
  { name: 'TypeScript',        role: 'language',    href: 'https://typescriptlang.org' },
  { name: 'Cloudflare Pages',  role: 'hosting',     href: 'https://pages.cloudflare.com' },
  { name: 'Cloudflare D1',     role: 'database',    href: 'https://developers.cloudflare.com/d1' },
  { name: 'Cloudflare R2',     role: 'storage',     href: 'https://developers.cloudflare.com/r2' },
  { name: 'Claude',            role: 'maintainer',  href: 'https://anthropic.com/claude' },
  { name: 'GitHub Actions',    role: 'ci/cd',       href: 'https://github.com/features/actions' },
]
</script>

<style scoped>
/* ── Page shell ───────────────────────────────────────────────────── */

.colophon-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 6rem;
  box-sizing: border-box;
  max-width: 640px;
  margin: 0 auto;
}

/* ── Header ───────────────────────────────────────────────────────── */

.colophon-header {
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

.colophon-divider {
  width: 36px;
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.12));
  margin: 2.25rem 0;
}

/* ── Prose ────────────────────────────────────────────────────────── */

.colophon-prose {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.05s both;
}

.colophon-prose p {
  font-size: 0.95rem;
  color: var(--theme-text-muted, #666);
  line-height: 1.75;
  margin: 0;
}

.colophon-link {
  color: var(--theme-accent, #6b8cae);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.colophon-link:hover {
  border-color: var(--theme-accent, #6b8cae);
}

.colophon-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 2px;
}

@keyframes enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Theme cards ──────────────────────────────────────────────────── */

.theme-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s both;
}

.theme-card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1rem 1.1rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.theme-card:hover {
  box-shadow: 0 4px 16px var(--theme-card-shadow, rgba(0, 0, 0, 0.06));
}

.theme-card--scandi:hover { border-color: #6b8cae; }
.theme-card--hacker:hover { border-color: #00ff41; }
.theme-card--space:hover  { border-color: #89abd0; }

.theme-card-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.55rem;
}

.theme-card-key {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--theme-text-subtle, #aaa);
  background: var(--theme-bg, #f5f5f3);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
  border-radius: 4px;
  padding: 0.1rem 0.45rem;
  line-height: 1.5;
  font-family: monospace;
  flex-shrink: 0;
}

.theme-card-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--theme-text, #111);
}

.theme-card-desc {
  font-size: 0.83rem;
  color: var(--theme-text-muted, #666);
  line-height: 1.65;
  margin: 0 0 0.85rem;
}

.theme-card-swatches {
  display: flex;
  gap: 4px;
}

.swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Decision list ────────────────────────────────────────────────── */

.decision-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  animation: enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.15s both;
}

.decision-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.85rem 0.75rem 0.85rem 0.6rem;
  margin: 0 -0.75rem;
  border-radius: 6px;
  border-left: 2px solid transparent;
  transition: background 0.2s ease, border-left-color 0.2s ease;
}

.decision-item:hover {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.5));
  border-left-color: var(--theme-accent, #6b8cae);
}

.decision-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--theme-text, #111);
}

.decision-desc {
  font-size: 0.82rem;
  color: var(--theme-text-muted, #666);
  line-height: 1.65;
}

.decision-desc code {
  font-family: monospace;
  font-size: 0.78rem;
  color: var(--theme-accent, #6b8cae);
  background: color-mix(in srgb, var(--theme-accent, #6b8cae) 10%, transparent);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}

.decision-desc kbd {
  font-family: monospace;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--theme-text-muted, #666);
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.15));
  border-radius: 3px;
  padding: 0.1rem 0.35rem;
}

/* ── Stack grid ───────────────────────────────────────────────────── */

.stack-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  animation: enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s both;
}

.stack-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.7rem 0.85rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  text-decoration: none;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.stack-item:hover {
  border-color: var(--theme-accent, #6b8cae);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--theme-card-shadow, rgba(0, 0, 0, 0.06));
}

.stack-item:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: var(--theme-card-radius, 16px);
}

.stack-name {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--theme-text, #111);
}

.stack-role {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--theme-text-subtle, #aaa);
}

/* ── Footer note ──────────────────────────────────────────────────── */

.colophon-footer-note {
  animation: enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.25s both;
}

.colophon-footer-note p {
  font-size: 0.85rem;
  color: var(--theme-text-subtle, #aaa);
  line-height: 1.7;
  margin: 0 0 0.4rem;
  font-style: italic;
}

.colophon-footer-note p:last-child {
  margin-bottom: 0;
}

/* ── Responsive ───────────────────────────────────────────────────── */

@media (max-width: 480px) {
  .stack-grid {
    grid-template-columns: 1fr;
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

:global(.hacker-page) .colophon-prose p {
  font-family: monospace;
  font-size: 0.85rem;
}

:global(.hacker-page) .theme-card {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .theme-card-name {
  font-family: monospace;
}

:global(.hacker-page) .theme-card-desc {
  font-family: monospace;
  font-size: 0.78rem;
}

:global(.hacker-page) .decision-title {
  font-family: monospace;
}

:global(.hacker-page) .decision-desc {
  font-family: monospace;
  font-size: 0.78rem;
}

:global(.hacker-page) .decision-item:hover {
  border-radius: 0;
}

:global(.hacker-page) .stack-item {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .stack-item:hover {
  box-shadow: 0 0 12px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

:global(.hacker-page) .swatch {
  border-radius: 0;
}

:global(.hacker-page) .colophon-footer-note p {
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

:global(.space-page) .theme-card-name {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  font-size: 0.8rem;
  text-transform: uppercase;
}

:global(.space-page) .theme-card:hover {
  box-shadow:
    0 4px 16px var(--theme-card-shadow, rgba(140, 170, 220, 0.12)),
    0 0 0 1px rgba(140, 170, 220, 0.2);
}

:global(.space-page) .decision-title {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-size: 0.78rem;
  text-transform: uppercase;
  font-weight: 900;
}

:global(.space-page) .stack-name {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.78rem;
}

:global(.space-page) .stack-item:hover {
  box-shadow:
    0 4px 16px rgba(140, 170, 220, 0.15),
    0 0 0 1px rgba(140, 170, 220, 0.25);
}
</style>
