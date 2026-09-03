<template>
  <!-- Owns the page: no DefaultLanding. A scholarly index, scrollable
       where it has to be (the registry marks the theme `scrollable`). -->
  <article class="almanac-frame">
    <header>
      <h1 class="almanac-title">
        <span class="almanac-glyph" aria-hidden="true">◐</span>
        An Almanac of Petter Hareim
      </h1>
      <p class="almanac-kicker">Father, husband, geek, aspiring good guy. Mostly serious. Sometimes not.</p>
      <hr class="almanac-rule" />
      <ClientOnly>
        <p class="almanac-datestamp">
          <span>{{ datestamp.weekday }}</span>
          <span>·</span>
          <span>{{ datestamp.dateline }}</span>
          <span>·</span>
          <span>day {{ datestamp.dayOfYear }} of {{ datestamp.year }}</span>
          <span>·</span>
          <span>week {{ datestamp.week }}</span>
        </p>
      </ClientOnly>
    </header>

    <section class="almanac-index">
      <div v-for="cat in categories" :key="cat.title">
        <h2 class="almanac-cat-title">{{ cat.title }}</h2>
        <ul class="almanac-list">
          <li v-for="p in cat.pages" :key="p.path">
            <NuxtLink
              :to="p.path"
              class="almanac-link"
              :target="p.external ? '_blank' : undefined"
              :rel="p.external ? 'noopener noreferrer' : undefined"
            >
              <span class="almanac-link-title">{{ p.title }}<span v-if="p.external" class="almanac-ext" aria-hidden="true"> ↗</span></span>
              <span class="almanac-link-desc">{{ p.desc }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="recent.length" class="almanac-recent">
      <h2 class="almanac-cat-title">Recent</h2>
      <ul class="almanac-list almanac-recent-list">
        <li v-for="item in recent" :key="item.name" class="almanac-recent-item">
          <time :datetime="item.pushed_at" class="almanac-recent-time">{{ relative(item.pushed_at) }}</time>
          <a :href="item.html_url" target="_blank" rel="noopener noreferrer" class="almanac-recent-text">
            {{ item.name }}<template v-if="item.description"> — {{ item.description }}</template>
          </a>
        </li>
      </ul>
    </section>

    <footer class="almanac-footer">
      <hr class="almanac-rule" />
      <p>
        Built in Nuxt, deployed to Cloudflare Pages.
        Source on <a href="https://github.com/phareim/phareim.no" target="_blank" rel="noopener noreferrer">GitHub</a>.
      </p>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { Project } from '~/server/api/projects'

interface IndexPage { path: string; title: string; desc: string; external?: boolean }

const categories: { title: string; pages: IndexPage[] }[] = [
  {
    title: 'Front matter',
    pages: [
      { path: '/about', title: 'About', desc: 'Who and what.' },
    ],
  },
  {
    title: 'The work',
    pages: [
      { path: '/projects', title: 'Projects', desc: 'Active and recent repos.' },
      { path: '/meta', title: 'Meta', desc: 'A log of changes to this very site.' },
    ],
  },
  {
    title: 'Elsewhere',
    pages: [
      { path: 'https://github.com/phareim', title: 'GitHub', desc: 'Code.', external: true },
      { path: 'https://bsky.app/profile/phareim.no', title: 'Bluesky', desc: 'Short thoughts.', external: true },
      { path: 'https://www.linkedin.com/in/phareim', title: 'LinkedIn', desc: 'The professional record.', external: true },
    ],
  },
  {
    title: 'Work',
    pages: [
      { path: 'https://www.miles.no', title: 'Miles', desc: 'Consultant, currently.', external: true },
    ],
  },
]

// Client-only: the server's clock and time zone are not the reader's.
const datestamp = computed(() => {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000)
  // ISO week, Monday start
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'long' }),
    dateline: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    dayOfYear,
    year: d.getFullYear(),
    week,
  }
})

const recent = ref<Project[]>([])

function relative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// The recent strip is optional: fetched after mount, silent on failure.
onMounted(async () => {
  try {
    const projects = await $fetch<Project[]>('/api/projects')
    recent.value = projects.slice(0, 3)
  } catch { /* paper stays paper */ }
})
</script>

<style scoped>
.almanac-frame {
  position: relative;
  z-index: 1;
  max-width: 64ch;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
  box-sizing: border-box;
  font-family: var(--theme-font-body, Georgia, serif);
  color: var(--theme-text, #1a1a1a);
}

.almanac-title {
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}

/* The moon glyph is the one accent on the page. */
.almanac-glyph {
  color: var(--theme-accent, #c14a2a);
  font-size: 0.7em;
  line-height: 1;
  flex-shrink: 0;
}

.almanac-kicker {
  margin: 0.75rem 0 0;
  font-style: italic;
  font-size: 1rem;
  color: var(--theme-text-muted, #555);
}

.almanac-rule {
  border: 0;
  border-top: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.15));
  margin: 1.5rem 0;
}

.almanac-datestamp {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin: 0 0 3rem;
  font-style: italic;
  font-size: 0.9rem;
  color: var(--theme-text-muted, #555);
}
.almanac-datestamp span:nth-child(2n) {
  color: var(--theme-card-border, rgba(0, 0, 0, 0.3));
}

.almanac-index {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
}
@media (min-width: 720px) {
  .almanac-index {
    grid-template-columns: 1fr 1fr;
    gap: 2.5rem 3rem;
  }
}

.almanac-cat-title {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 500;
  margin: 0 0 0.75rem;
  color: var(--theme-text-muted, #555);
}

.almanac-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.almanac-list li {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
}
.almanac-list li:last-child {
  border-bottom: 0;
}

.almanac-link {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  text-decoration: none;
  color: inherit;
}
.almanac-link-title {
  font-size: 1.05rem;
}
.almanac-link:hover .almanac-link-title,
.almanac-link:focus-visible .almanac-link-title {
  color: var(--theme-accent, #c14a2a);
}
.almanac-ext {
  font-size: 0.75em;
  color: var(--theme-text-subtle, #999);
}
.almanac-link-desc {
  font-style: italic;
  font-size: 0.85rem;
  color: var(--theme-text-muted, #555);
}

.almanac-recent {
  margin-top: 3.5rem;
}
.almanac-recent-item {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: 1rem;
  align-items: baseline;
  padding: 0.4rem 0;
  font-size: 0.9rem;
}
.almanac-recent-time {
  color: var(--theme-text-muted, #555);
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}
.almanac-recent-text {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.almanac-recent-text:hover {
  border-bottom-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}

.almanac-footer {
  margin-top: 3rem;
  font-size: 0.85rem;
  color: var(--theme-text-muted, #555);
}
.almanac-footer p {
  margin: 0;
}
</style>
