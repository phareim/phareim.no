<template>
  <div class="gallery-page">
    <header class="gallery-header">
      <h1>gallery</h1>
      <p class="subtitle">
        ai-generated images —
        <NuxtLink to="/playground" class="subtitle-link">try the playground</NuxtLink>
      </p>
    </header>

    <main class="gallery-main">

      <!-- Loading skeleton -->
      <div v-if="pending" class="gallery-grid gallery-grid--skeleton" aria-label="Loading images" aria-busy="true">
        <div v-for="i in 12" :key="i" class="gallery-skeleton"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!images.length" class="gallery-empty">
        <div class="gallery-empty-icon" aria-hidden="true">✦</div>
        <p class="gallery-empty-text">no images generated yet</p>
        <NuxtLink to="/playground" class="gallery-cta">open the playground →</NuxtLink>
      </div>

      <!-- Image grid -->
      <div
        v-else
        class="gallery-grid"
        role="list"
        :aria-label="`${images.length} generated images`"
      >
        <a
          v-for="img in images"
          :key="img.key"
          :href="img.url"
          target="_blank"
          rel="noopener noreferrer"
          class="gallery-item"
          :aria-label="`AI-generated image from ${formatDate(img.uploaded)}`"
          role="listitem"
        >
          <img
            :src="img.url"
            :alt="`AI-generated image, ${formatDate(img.uploaded)}`"
            class="gallery-img"
            loading="lazy"
            decoding="async"
          />
          <div class="gallery-overlay" aria-hidden="true">
            <span class="gallery-date">{{ formatDate(img.uploaded) }}</span>
            <span class="gallery-open">open ↗</span>
          </div>
        </a>
      </div>

      <p v-if="!pending && images.length" class="gallery-count" aria-live="polite">
        {{ images.length }} image{{ images.length !== 1 ? 's' : '' }}
      </p>

    </main>
  </div>
</template>

<script setup lang="ts">
import type { GalleryImage } from '~/server/api/gallery'

useHead({ title: 'gallery — phareim.no' })

const { data, pending } = await useFetch<GalleryImage[]>('/api/gallery')

const images = computed(() => data.value ?? [])

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────── */

.gallery-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 900px;
  margin: 0 auto;
}

/* ── Header ─────────────────────────────────────────────────── */

.gallery-header {
  margin-bottom: 2.5rem;
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

.subtitle-link {
  color: var(--theme-accent, #6b8cae);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.subtitle-link:hover {
  border-color: var(--theme-accent, #6b8cae);
}

.subtitle-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Grid ───────────────────────────────────────────────────── */

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.5rem;
}

/* ── Skeleton loading ───────────────────────────────────────── */

.gallery-skeleton {
  aspect-ratio: 1;
  border-radius: var(--theme-card-radius, 12px);
  background: var(--theme-card-border, rgba(0, 0, 0, 0.08));
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.gallery-skeleton:nth-child(2)  { animation-delay: 0.1s; }
.gallery-skeleton:nth-child(3)  { animation-delay: 0.2s; }
.gallery-skeleton:nth-child(4)  { animation-delay: 0.3s; }
.gallery-skeleton:nth-child(5)  { animation-delay: 0.4s; }
.gallery-skeleton:nth-child(6)  { animation-delay: 0.5s; }
.gallery-skeleton:nth-child(7)  { animation-delay: 0.6s; }
.gallery-skeleton:nth-child(8)  { animation-delay: 0.7s; }
.gallery-skeleton:nth-child(9)  { animation-delay: 0.8s; }
.gallery-skeleton:nth-child(10) { animation-delay: 0.9s; }
.gallery-skeleton:nth-child(11) { animation-delay: 1.0s; }
.gallery-skeleton:nth-child(12) { animation-delay: 1.1s; }

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

/* ── Image items ────────────────────────────────────────────── */

.gallery-item {
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--theme-card-radius, 12px);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  position: relative;
  cursor: pointer;
  background: var(--theme-card-bg, rgba(0, 0, 0, 0.04));
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.gallery-item:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px var(--theme-card-shadow, rgba(0, 0, 0, 0.12));
}

.gallery-item:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
}

.gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.gallery-item:hover .gallery-img {
  transform: scale(1.06);
}

/* ── Hover overlay ──────────────────────────────────────────── */

.gallery-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.6) 0%,
    transparent 50%
  );
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0.6rem 0.7rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.gallery-item:hover .gallery-overlay {
  opacity: 1;
}

.gallery-date {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  letter-spacing: 0.03em;
}

.gallery-open {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

/* ── Count ──────────────────────────────────────────────────── */

.gallery-count {
  margin: 1.5rem 0 0;
  font-size: 0.72rem;
  color: var(--theme-text-subtle, #aaa);
  text-align: center;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* ── Empty state ────────────────────────────────────────────── */

.gallery-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
  text-align: center;
}

.gallery-empty-icon {
  font-size: 2.5rem;
  color: var(--theme-text-subtle, #ccc);
  animation: icon-pulse 3s ease-in-out infinite;
}

@keyframes icon-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%       { opacity: 0.9; transform: scale(1.1); }
}

.gallery-empty-text {
  font-size: 0.95rem;
  color: var(--theme-text-muted, #666);
  margin: 0;
}

.gallery-cta {
  font-size: 0.85rem;
  color: var(--theme-accent, #6b8cae);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.gallery-cta:hover {
  border-color: var(--theme-accent, #6b8cae);
}

.gallery-cta:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Responsive ─────────────────────────────────────────────── */

@media (max-width: 640px) {
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.35rem;
  }
}

@media (max-width: 380px) {
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
  }
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

:global(.hacker-page) .subtitle-link {
  font-family: monospace;
}

:global(.hacker-page) .gallery-item {
  border-radius: 0;
}

:global(.hacker-page) .gallery-item:hover {
  box-shadow: 0 0 20px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

:global(.hacker-page) .gallery-skeleton {
  border-radius: 0;
}

:global(.hacker-page) .gallery-count {
  font-family: monospace;
}

:global(.hacker-page) .gallery-date,
:global(.hacker-page) .gallery-open {
  font-family: monospace;
}

:global(.hacker-page) .gallery-empty-text,
:global(.hacker-page) .gallery-cta {
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

:global(.space-page) .subtitle {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
}

:global(.space-page) .gallery-item {
  box-shadow: 0 0 0 1px rgba(140, 170, 220, 0.1);
}

:global(.space-page) .gallery-item:hover {
  box-shadow:
    0 8px 32px rgba(140, 170, 220, 0.2),
    0 0 0 1px rgba(140, 170, 220, 0.25);
}
</style>
