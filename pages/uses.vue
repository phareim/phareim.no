<template>
  <AlmanacFrame title="Uses" kicker="Tools, editors, hardware." back="/">
    <div class="uses-content">

      <section class="uses-section">
        <h2 class="section-label">this site</h2>
        <ul class="uses-list">
          <li v-for="item in thisSite" :key="item.name" class="uses-item">
            <div class="uses-item-main">
              <a
                v-if="item.href"
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="uses-name uses-link"
              >{{ item.name }}</a>
              <span v-else class="uses-name">{{ item.name }}</span>
              <span class="uses-tag" v-if="item.tag">{{ item.tag }}</span>
            </div>
            <p class="uses-desc">{{ item.desc }}</p>
          </li>
        </ul>
      </section>

      <div class="uses-divider" aria-hidden="true"></div>

      <section class="uses-section">
        <h2 class="section-label">frontend</h2>
        <ul class="uses-list">
          <li v-for="item in frontend" :key="item.name" class="uses-item">
            <div class="uses-item-main">
              <a
                v-if="item.href"
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="uses-name uses-link"
              >{{ item.name }}</a>
              <span v-else class="uses-name">{{ item.name }}</span>
              <span class="uses-tag" v-if="item.tag">{{ item.tag }}</span>
            </div>
            <p class="uses-desc">{{ item.desc }}</p>
          </li>
        </ul>
      </section>

      <div class="uses-divider" aria-hidden="true"></div>

      <section class="uses-section">
        <h2 class="section-label">infrastructure</h2>
        <ul class="uses-list">
          <li v-for="item in infra" :key="item.name" class="uses-item">
            <div class="uses-item-main">
              <a
                v-if="item.href"
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="uses-name uses-link"
              >{{ item.name }}</a>
              <span v-else class="uses-name">{{ item.name }}</span>
              <span class="uses-tag" v-if="item.tag">{{ item.tag }}</span>
            </div>
            <p class="uses-desc">{{ item.desc }}</p>
          </li>
        </ul>
      </section>

      <div class="uses-divider" aria-hidden="true"></div>

      <section class="uses-section">
        <h2 class="section-label">ai & apis</h2>
        <ul class="uses-list">
          <li v-for="item in aiTools" :key="item.name" class="uses-item">
            <div class="uses-item-main">
              <a
                v-if="item.href"
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="uses-name uses-link"
              >{{ item.name }}</a>
              <span v-else class="uses-name">{{ item.name }}</span>
              <span class="uses-tag" v-if="item.tag">{{ item.tag }}</span>
            </div>
            <p class="uses-desc">{{ item.desc }}</p>
          </li>
        </ul>
      </section>

    </div>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({ title: 'uses — phareim.no' })

interface UsesItem {
  name: string
  desc: string
  href?: string
  tag?: string
}

const thisSite: UsesItem[] = [
  {
    name: 'Nuxt 3',
    desc: 'the full-stack framework powering this site — file-based routing, server api routes, and ssr all in one',
    href: 'https://nuxt.com',
    tag: 'framework',
  },
  {
    name: 'Vue 3',
    desc: 'composition api, <script setup>, and reactivity that stays out of the way',
    href: 'https://vuejs.org',
    tag: 'ui',
  },
  {
    name: 'TypeScript',
    desc: 'everywhere — server routes, composables, components. makes refactoring less scary',
    href: 'https://www.typescriptlang.org',
    tag: 'language',
  },
  {
    name: 'Pinia',
    desc: 'lightweight client-side state management',
    href: 'https://pinia.vuejs.org',
    tag: 'state',
  },
]

const frontend: UsesItem[] = [
  {
    name: 'CSS custom properties',
    desc: 'the theme system is built entirely on css variables — almanac runs on a single set of warm-paper tokens, light/dark via prefers-color-scheme',
    tag: 'styling',
  },
  {
    name: 'Canvas API',
    desc: 'the space-invaders game is hand-rolled canvas with full game state — no lib needed',
    tag: 'animation',
  },
  {
    name: 'AT Protocol',
    desc: 'bluesky posts fetched directly from the public at proto api, no sdk',
    href: 'https://atproto.com',
    tag: 'api',
  },
  {
    name: 'GitHub API',
    desc: 'public repos fetched live for the projects page',
    href: 'https://docs.github.com/en/rest',
    tag: 'api',
  },
]

const infra: UsesItem[] = [
  {
    name: 'Cloudflare Pages',
    desc: 'global cdn hosting with automatic deploys from github — zero cold starts on the edge',
    href: 'https://pages.cloudflare.com',
    tag: 'hosting',
  },
  {
    name: 'Cloudflare D1',
    desc: 'sqlite at the edge — used for persistent data without running a db server',
    href: 'https://developers.cloudflare.com/d1',
    tag: 'database',
  },
  {
    name: 'Cloudflare R2',
    desc: 's3-compatible object storage for assets — no egress fees',
    href: 'https://developers.cloudflare.com/r2',
    tag: 'storage',
  },
  {
    name: 'GitHub Actions',
    desc: 'ci/cd: build → apply d1 schema → deploy to cloudflare pages on every push to master',
    href: 'https://github.com/features/actions',
    tag: 'ci/cd',
  },
]

const aiTools: UsesItem[] = [
  {
    name: 'Claude (Anthropic)',
    desc: 'this site is partially maintained by a scheduled claude agent — it writes and ships its own updates',
    href: 'https://anthropic.com',
    tag: 'llm',
  },
  {
    name: 'Venice AI',
    desc: 'privacy-focused inference api for text generation experiments',
    href: 'https://venice.ai',
    tag: 'inference',
  },
  {
    name: 'FAL AI',
    desc: 'fast image generation and diffusion model apis',
    href: 'https://fal.ai',
    tag: 'image',
  },
  {
    name: 'OpenAI',
    desc: 'gpt models for various text and embedding tasks',
    href: 'https://openai.com',
    tag: 'llm',
  },
  {
    name: 'Wavespeed',
    desc: 'fast inference for open-source models',
    href: 'https://wavespeed.ai',
    tag: 'inference',
  },
]
</script>

<style scoped>
.uses-content {
  display: flex;
  flex-direction: column;
}

.uses-section {
  padding: 0.25rem 0;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #a39e8f);
  margin: 0 0 1rem;
  border-bottom: 0;
  padding-bottom: 0;
}

.uses-divider {
  width: 36px;
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.12));
  margin: 2rem 0;
}

/* ── List ───────────────────────────────────────────────────── */

.uses-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.uses-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.5rem 0.75rem 0.5rem 0.6rem;
  margin: 0 -0.75rem;
  border-radius: 0;
  border-left: 2px solid transparent;
  transition: border-left-color 0.2s ease;
}

.uses-item:hover {
  border-left-color: var(--theme-accent, #c14a2a);
}

.uses-item-main {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.uses-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--theme-text, #1a1a1a);
}

.uses-link {
  text-decoration: none;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.2));
  transition: border-color 0.2s ease, color 0.2s ease;
}

.uses-link:hover {
  border-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}

.uses-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
}

.uses-tag {
  font-size: 0.65rem;
  font-style: italic;
  text-transform: lowercase;
  letter-spacing: 0.04em;
  color: var(--theme-text-subtle, #a39e8f);
  background: transparent;
  border: 0;
  padding: 0;
  flex-shrink: 0;
}

.uses-tag::before {
  content: '· ';
  color: var(--theme-card-border, rgba(0,0,0,0.2));
  font-style: normal;
}

.uses-desc {
  font-size: 0.85rem;
  color: var(--theme-text-muted, #6a6a6a);
  line-height: 1.6;
  margin: 0;
}
</style>
