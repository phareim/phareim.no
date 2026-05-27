<template>
  <AlmanacFrame title="Lab" kicker="Live experiments and half-thoughts." back="/">
    <div class="lab-content">

      <section class="lab-section">
        <h2 class="section-label">experiments</h2>
        <div class="lab-grid">
          <a
            v-for="tool in liveTools"
            :key="tool.id"
            :href="tool.href"
            :target="tool.external ? '_blank' : undefined"
            :rel="tool.external ? 'noopener noreferrer' : undefined"
            class="lab-card"
          >
            <div class="lab-card-top">
              <h3 class="lab-card-name">{{ tool.name }}</h3>
              <span class="badge-live" v-if="tool.status === 'live'">live</span>
              <span class="badge-experimental" v-else-if="tool.status === 'experimental'">experimental</span>
              <span class="badge-archived" v-else>archived</span>
            </div>
            <p class="lab-card-desc">{{ tool.desc }}</p>
            <div class="lab-card-footer">
              <span class="lab-card-tech">{{ tool.tech }}</span>
              <span class="lab-card-arrow" aria-hidden="true">{{ tool.external ? '↗' : '→' }}</span>
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
            <NuxtLink to="/projects" class="lab-meta-link">see /projects</NuxtLink>
          </div>
        </div>
      </section>

    </div>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({ title: 'lab — phareim.no' })

interface Tool {
  id: string
  name: string
  desc: string
  href: string
  tech: string
  status: 'live' | 'experimental' | 'archived'
  external?: boolean
}

const liveTools: Tool[] = [
  {
    id: 'imagine',
    name: 'imagine',
    desc: 'an in-house AI image generator — prompts in, pictures out, into the gallery.',
    href: '/lab/imagine',
    tech: 'nuxt + fal',
    status: 'experimental',
  },
  {
    id: 'reddot',
    name: 'red dot',
    desc: 'a small browser game. click the dot. try not to miss.',
    href: 'https://dot.phareim.no',
    tech: 'vanilla js',
    status: 'live',
    external: true,
  },
  {
    id: 'reader',
    name: 'rss reader',
    desc: 'a personal rss feed reader. built for reading, not for analytics.',
    href: 'https://reader.phareim.no',
    tech: 'nuxt + d1',
    status: 'live',
    external: true,
  },
]
</script>

<style scoped>
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
  color: var(--theme-text-subtle, #a39e8f);
  margin: 0 0 1.1rem;
  border-bottom: 0;
  padding-bottom: 0;
}

.lab-divider {
  width: 36px;
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.12));
  margin: 2.5rem 0;
}

/* ── Tool grid — hairline cards ───────────────────────────── */

.lab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.lab-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--theme-card-bg, transparent);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.15));
  border-radius: var(--theme-card-radius, 0);
  padding: 1.1rem 1.25rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s ease;
}

.lab-card:hover {
  border-color: var(--theme-accent, #c14a2a);
}

.lab-card:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
}

.lab-card-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

/* ── Hairline + italic status badges (Almanac style) ──────── */

.badge-live {
  display: inline-block;
  padding: 0 0.4em;
  border: 1px solid var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
  font-family: 'Source Serif 4', Georgia, serif;
  font-style: italic;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: lowercase;
  vertical-align: middle;
}

.badge-experimental {
  display: inline-block;
  padding: 0 0.4em;
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.25));
  color: var(--theme-text-muted, #6a6a6a);
  font-family: 'Source Serif 4', Georgia, serif;
  font-style: italic;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: lowercase;
  vertical-align: middle;
}

.badge-archived {
  display: inline-block;
  padding: 0 0.4em;
  border: 1px dashed var(--theme-card-border, rgba(0,0,0,0.2));
  color: var(--theme-text-subtle, #a39e8f);
  font-family: 'Source Serif 4', Georgia, serif;
  font-style: italic;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: lowercase;
  vertical-align: middle;
}

.lab-card-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--theme-text, #1a1a1a);
  margin: 0;
  line-height: 1.3;
  border-bottom: 0;
  padding-bottom: 0;
}

.lab-card:hover .lab-card-name {
  color: var(--theme-accent, #c14a2a);
}

.lab-card-desc {
  font-size: 0.88rem;
  color: var(--theme-text-muted, #6a6a6a);
  line-height: 1.55;
  margin: 0;
  flex: 1;
}

.lab-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
}

.lab-card-tech {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #a39e8f);
  font-style: italic;
}

.lab-card-arrow {
  font-size: 0.95rem;
  color: var(--theme-text-subtle, #a39e8f);
  transition: color 0.2s ease, transform 0.2s ease;
}

.lab-card:hover .lab-card-arrow {
  color: var(--theme-accent, #c14a2a);
  transform: translate(2px, -2px);
}

/* ── Meta card — hairline rows ─────────────────────────────── */

.lab-meta-card {
  background: transparent;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
  padding: 0 0.2rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.lab-meta-row {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.06));
}

.lab-meta-row:last-child {
  border-bottom: none;
}

.lab-meta-label {
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #a39e8f);
  white-space: nowrap;
  min-width: 7rem;
  flex-shrink: 0;
  font-style: italic;
}

.lab-meta-value {
  font-size: 0.9rem;
  color: var(--theme-text, #1a1a1a);
}

.lab-meta-link {
  font-size: 0.9rem;
  color: var(--theme-text, #1a1a1a);
  text-decoration: none;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.2));
  transition: border-color 0.2s ease, color 0.2s ease;
}

.lab-meta-link:hover {
  border-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}

.lab-meta-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
