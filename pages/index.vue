<template>
  <AlmanacFrame title="An Almanac of Petter Hareim" kicker="Notes, projects, toys. Mostly serious. Sometimes not.">
    <p class="almanac-datestamp">
      <span>{{ datestamp.weekday }}</span>
      <span>·</span>
      <span>{{ datestamp.dateline }}</span>
      <span>·</span>
      <span>day {{ datestamp.dayOfYear }} of {{ datestamp.year }}</span>
      <span>·</span>
      <span>week {{ datestamp.week }}</span>
    </p>

    <section class="almanac-index">
      <div v-for="cat in categories" :key="cat.title" class="almanac-index__cat">
        <h2 class="almanac-index__cat-title">{{ cat.title }}</h2>
        <ul class="almanac-index__list">
          <li v-for="p in cat.pages" :key="p.path">
            <NuxtLink :to="p.path" class="almanac-index__link">
              <span class="almanac-index__link-title">{{ p.title }}</span>
              <span class="almanac-index__link-desc">{{ p.desc }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="recent.length" class="almanac-recent">
      <h2 class="almanac-recent__title">Recent</h2>
      <ul class="almanac-recent__list">
        <li v-for="item in recent" :key="item.id" class="almanac-recent__item">
          <time :datetime="item.iso" class="almanac-recent__time">{{ item.relative }}</time>
          <span class="almanac-recent__kind">{{ item.kind }}</span>
          <a :href="item.url" target="_blank" rel="noopener" class="almanac-recent__text">{{ item.text }}</a>
        </li>
      </ul>
    </section>

    <template #footer>
      <p>Built in Nuxt, deployed to Cloudflare Pages. Source on <a href="https://github.com/phareim/phareim.no">GitHub</a>. See <NuxtLink to="/colophon">colophon</NuxtLink> for design notes.</p>
    </template>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({
  title: 'phareim.no',
  meta: [{ name: 'description', content: 'An almanac of Petter Hareim — notes, projects, toys.' }],
})

// Almanac datestamp — purely client-side so SSR doesn't lock yesterday's date.
// Format: "Wednesday · 27 May 2026 · day 147 of 2026 · week 22".
const datestamp = computed(() => {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86400000)
  // ISO week (Mon-start).
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

const categories = [
  {
    title: 'Front matter',
    pages: [
      { path: '/about', title: 'About', desc: 'Who and what.' },
      { path: '/now', title: 'Now', desc: 'What I am working on this season.' },
      { path: '/uses', title: 'Uses', desc: 'Tools, editors, hardware.' },
    ],
  },
  {
    title: 'The work',
    pages: [
      { path: '/projects', title: 'Projects', desc: 'Active and recent repos.' },
      { path: '/feed', title: 'Feed', desc: 'Bluesky + X, merged.' },
      { path: '/gallery', title: 'Gallery', desc: 'Generated images.' },
      { path: '/guestbook', title: 'Guestbook', desc: 'Leave a note.' },
      { path: '/lab', title: 'Lab', desc: 'Experiments and half-built things.' },
    ],
  },
  {
    title: 'Playful',
    pages: [
      { path: '/games', title: 'Games', desc: 'Things you can play.' },
      { path: '/playground', title: 'Playground', desc: 'Toys, oddities, mostly-finished experiments.' },
    ],
  },
  {
    title: 'Meta',
    pages: [
      { path: '/colophon', title: 'Colophon', desc: 'How this site is made.' },
    ],
  },
]

type RecentItem = { id: string; iso: string; relative: string; kind: string; text: string; url: string }
const recent = ref<RecentItem[]>([])

const relative = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

onMounted(async () => {
  try {
    const [projects, feed] = await Promise.allSettled([
      $fetch<any[]>('/api/projects').catch(() => []),
      $fetch<any[]>('/api/feed').catch(() => []),
    ])
    const items: RecentItem[] = []
    if (projects.status === 'fulfilled' && Array.isArray(projects.value)) {
      for (const p of projects.value.slice(0, 3)) {
        if (p?.pushed_at) items.push({
          id: 'p-' + p.name,
          iso: p.pushed_at,
          relative: relative(p.pushed_at),
          kind: 'project',
          text: p.name + (p.description ? ' — ' + p.description : ''),
          url: p.html_url,
        })
      }
    }
    if (feed.status === 'fulfilled' && Array.isArray(feed.value)) {
      for (const post of feed.value.slice(0, 5)) {
        const iso = post?.created_at || post?.indexedAt
        if (iso) items.push({
          id: 'f-' + (post.uri || post.id || iso),
          iso,
          relative: relative(iso),
          kind: post.source || 'post',
          text: (post.text || '').slice(0, 120),
          url: post.url || post.uri || '#',
        })
      }
    }
    recent.value = items
      .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
      .slice(0, 8)
  } catch { /* swallow — recent strip is optional */ }
})
</script>

<style scoped>
.almanac-datestamp {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin: -1rem 0 3rem;
  font-style: italic;
  font-size: 0.9rem;
  color: var(--theme-text-muted, #555);
}
.almanac-datestamp span:nth-child(2n) { /* the · separators */
  color: var(--theme-card-border, rgba(0,0,0,0.3));
}

.almanac-index { display: grid; grid-template-columns: 1fr; gap: 2.5rem; }
@media (min-width: 720px) {
  .almanac-index { grid-template-columns: 1fr 1fr; gap: 2.5rem 3rem; }
}
.almanac-index__cat-title {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 500;
  margin: 0 0 0.75rem;
  color: var(--theme-text-muted, #555);
}
.almanac-index__list { list-style: none; padding: 0; margin: 0; }
.almanac-index__list li {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--theme-card-border, rgba(0,0,0,0.08));
}
.almanac-index__list li:last-child { border-bottom: 0; }
.almanac-index__link {
  display: flex; flex-direction: column; gap: 0.1rem;
  text-decoration: none; color: inherit;
}
.almanac-index__link-title { font-size: 1.05rem; }
.almanac-index__link-title:hover { color: var(--theme-accent, #c14a2a); }
.almanac-index__link-desc {
  font-style: italic;
  font-size: 0.85rem;
  color: var(--theme-text-muted, #555);
}

.almanac-recent { margin-top: 4rem; }
.almanac-recent__title {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 500;
  margin: 0 0 0.75rem;
  color: var(--theme-text-muted, #555);
}
.almanac-recent__list { list-style: none; padding: 0; margin: 0; }
.almanac-recent__item {
  display: grid;
  grid-template-columns: 5rem 5rem 1fr;
  gap: 1rem;
  align-items: baseline;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--theme-card-border, rgba(0,0,0,0.06));
  font-size: 0.9rem;
}
.almanac-recent__time, .almanac-recent__kind {
  color: var(--theme-text-muted, #555);
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}
.almanac-recent__text {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.almanac-recent__text:hover {
  border-bottom-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}
</style>
