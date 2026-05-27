<template>
  <AlmanacFrame title="Colophon" kicker="How this place works." back="/">
    <div class="colophon-content">

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
            you can watch the history on <NuxtLink to="/projects" class="colophon-link">the projects page</NuxtLink>
            or in the <NuxtLink to="/feed" class="colophon-link">feed</NuxtLink>.
            the agent wrote this very page.
          </p>
        </div>
      </section>

      <div class="colophon-divider" aria-hidden="true"></div>

      <!-- The almanac -->
      <section class="colophon-section">
        <h2 class="section-label">the almanac</h2>
        <div class="colophon-prose">
          <p>
            in may 2026 the site collapsed from four themes (scandinavian,
            cyberpunk, space, almanac) down to one. warm paper by day,
            midnight paper by night. georgia serif, hairline rules instead
            of cards, no animation, no chrome. follows your system's
            light/dark setting by design.
          </p>
          <p>
            the five rules: hairline not box, accent only at the moment of
            attention, serif body always, stars dark only, no chrome. ported
            from the cross-medium <a href="https://github.com/phareim/almanac-design" target="_blank" rel="noopener noreferrer" class="colophon-link">almanac design system</a>.
          </p>
          <div class="theme-swatches" aria-hidden="true">
            <span class="swatch" style="background: var(--almanac-paper); border: 1px solid var(--almanac-rule-light);"></span>
            <span class="swatch" style="background: var(--almanac-ink);"></span>
            <span class="swatch" style="background: var(--almanac-rust);"></span>
            <span class="swatch" style="background: var(--almanac-night-bottom);"></span>
            <span class="swatch" style="background: var(--almanac-amber);"></span>
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
            <span class="decision-desc">every color in every component goes through <code>var(--theme-*)</code> css custom properties. light/dark switch is purely css — no javascript, no flash.</span>
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
            <span class="decision-desc"><kbd>m</kbd> opens the menu. <kbd>[</kbd> and <kbd>]</kbd> navigate between pages. <kbd>?</kbd> shows all shortcuts. <kbd>⌘k</kbd> opens the command palette.</span>
          </li>
          <li class="decision-item">
            <span class="decision-title">hand-rolled canvas</span>
            <span class="decision-desc">the <NuxtLink to="/games/space-invaders" class="colophon-link">space invaders</NuxtLink> game is pure canvas api — full game state, bullets, enemies, waves. no three.js, no library.</span>
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

    </div>
  </AlmanacFrame>
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
.colophon-content {
  display: flex;
  flex-direction: column;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #a39e8f);
  margin: 0 0 1.1rem;
  border-bottom: 0;
  padding-bottom: 0;
}

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
  color: var(--theme-text, #1a1a1a);
  line-height: 1.75;
  margin: 0;
}

.colophon-link {
  color: var(--theme-text, #1a1a1a);
  text-decoration: none;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.2));
  transition: border-color 0.2s ease, color 0.2s ease;
}

.colophon-link:hover {
  border-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}

.colophon-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
}

@keyframes enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Theme swatches ───────────────────────────────────────────────── */

.theme-swatches {
  display: flex;
  gap: 6px;
  margin-top: 0.5rem;
}

.swatch {
  width: 18px;
  height: 18px;
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
  border-radius: 0;
  border-left: 2px solid transparent;
  transition: border-left-color 0.2s ease;
}

.decision-item:hover {
  border-left-color: var(--theme-accent, #c14a2a);
}

.decision-title {
  font-size: 0.95rem;
  font-style: italic;
  color: var(--theme-text, #1a1a1a);
}

.decision-desc {
  font-size: 0.85rem;
  color: var(--theme-text-muted, #6a6a6a);
  line-height: 1.7;
}

.decision-desc code {
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 0.78rem;
  color: var(--theme-accent, #c14a2a);
  background: transparent;
  padding: 0;
  border-radius: 0;
}

.decision-desc kbd {
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--theme-text-muted, #6a6a6a);
  background: transparent;
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.2));
  border-radius: 0;
  padding: 0.05rem 0.35rem;
}

/* ── Stack grid — hairline cells ─────────────────────────────────── */

.stack-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  animation: enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s both;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
}

.stack-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.85rem 0.85rem;
  background: transparent;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
  border-right: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
  border-radius: 0;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.stack-item:nth-child(2n) {
  border-right: 0;
}

.stack-item:hover {
  background: var(--theme-bg-alt, transparent);
  color: var(--theme-accent, #c14a2a);
}

.stack-item:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: -2px;
}

.stack-name {
  font-size: 0.95rem;
  color: var(--theme-text, #1a1a1a);
}

.stack-item:hover .stack-name {
  color: var(--theme-accent, #c14a2a);
}

.stack-role {
  font-size: 0.7rem;
  font-style: italic;
  text-transform: lowercase;
  letter-spacing: 0.04em;
  color: var(--theme-text-subtle, #a39e8f);
}

/* ── Footer note ──────────────────────────────────────────────────── */

.colophon-footer-note {
  animation: enter 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.25s both;
}

.colophon-footer-note p {
  font-size: 0.85rem;
  color: var(--theme-text-subtle, #a39e8f);
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
  .stack-item {
    border-right: 0;
  }
}
</style>
