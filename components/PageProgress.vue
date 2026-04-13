<template>
  <!-- Reading progress bar -->
  <div
    class="page-progress-bar"
    :class="{ active: showBar }"
    :style="{ transform: `scaleX(${progress})` }"
    aria-hidden="true"
  ></div>

  <!-- Scroll to top button -->
  <Transition name="scroll-top">
    <button
      v-if="showScrollTop"
      class="scroll-top-btn"
      @click="scrollToTop"
      aria-label="Back to top"
      title="Back to top"
    >↑</button>
  </Transition>
</template>

<script setup lang="ts">
const route = useRoute()

const progress = ref(0)
const showScrollTop = ref(false)
const SCROLL_TOP_THRESHOLD = 0.15

// Don't show on the index page (full-screen canvas, no scroll)
const isIndexPage = computed(() => route.path === '/')
const showBar = computed(() => !isIndexPage.value && progress.value > 0 && progress.value < 1)

function updateProgress() {
  if (isIndexPage.value) {
    progress.value = 0
    showScrollTop.value = false
    return
  }
  const scrollTop = window.scrollY
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  if (docHeight <= 0) {
    progress.value = 0
    showScrollTop.value = false
    return
  }
  progress.value = Math.min(scrollTop / docHeight, 1)
  showScrollTop.value = progress.value > SCROLL_TOP_THRESHOLD
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

let ticking = false
function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      updateProgress()
      ticking = false
    })
    ticking = true
  }
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  updateProgress()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})

watch(() => route.path, () => {
  progress.value = 0
  showScrollTop.value = false
  nextTick(updateProgress)
})
</script>

<style scoped>
/* ── Progress bar ────────────────────────────────────────────── */

.page-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  z-index: 9999;
  transform-origin: left;
  transform: scaleX(0);
  background: var(--theme-accent, #6b8cae);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  will-change: transform;
}

.page-progress-bar.active {
  opacity: 1;
}

/* ── Scroll-to-top button ────────────────────────────────────── */

.scroll-top-btn {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 9998;
  width: 2.4rem;
  height: 2.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.8));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
  border-radius: 50%;
  color: var(--theme-text-muted, #666);
  font-family: inherit;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px var(--theme-card-shadow, rgba(0, 0, 0, 0.08));
  transition:
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.scroll-top-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 20px var(--theme-card-shadow, rgba(0, 0, 0, 0.12));
  border-color: var(--theme-accent, #6b8cae);
  color: var(--theme-accent, #6b8cae);
}

.scroll-top-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 3px;
}

/* ── Transition ──────────────────────────────────────────────── */

.scroll-top-enter-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.scroll-top-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.scroll-top-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.85);
}
.scroll-top-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.9);
}

/* ── Hacker theme overrides ─────────────────────────────────── */

:global(.hacker-page) .page-progress-bar {
  background: var(--hacker-text, #00ff41);
  box-shadow: 0 0 6px var(--hacker-text, #00ff41), 0 0 14px rgba(0, 255, 65, 0.35);
  height: 1px;
}

:global(.hacker-page) .scroll-top-btn {
  border-radius: 0;
  font-family: monospace;
  font-size: 0.85rem;
  font-weight: bold;
  letter-spacing: 0.05em;
}

:global(.hacker-page) .scroll-top-btn:hover {
  box-shadow: 0 0 18px var(--hacker-glow, rgba(0, 255, 65, 0.25)), inset 0 0 8px var(--hacker-glow, rgba(0, 255, 65, 0.1));
}

/* ── Space theme overrides ──────────────────────────────────── */

:global(.space-page) .page-progress-bar {
  background: var(--space-accent-blue, #89abd0);
  box-shadow: 0 0 8px rgba(137, 171, 208, 0.6), 0 0 18px rgba(137, 171, 208, 0.25);
  height: 2px;
}

:global(.space-page) .scroll-top-btn {
  border-radius: 6px;
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  font-size: 0.8rem;
}

:global(.space-page) .scroll-top-btn:hover {
  box-shadow:
    0 5px 20px rgba(140, 170, 220, 0.2),
    0 0 0 1px rgba(140, 170, 220, 0.25);
}
</style>
