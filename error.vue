<template>
  <div :class="[themePageClass, 'error-root']">
    <AlmanacPaper />

    <div class="error-container">
      <p class="almanac-404-num">404</p>
      <h1 class="almanac-title">drifted off course</h1>
      <p class="almanac-coords">{{ requestedPath }}</p>
      <p class="almanac-msg">the page you're looking for isn't here</p>
      <button class="almanac-home-btn" @click="goHome">← back home</button>
    </div>

    <MenuComponent />
  </div>
</template>

<script setup lang="ts">
import MenuComponent from '~/components/MenuComponent.vue'

const props = defineProps({
  error: Object
})

const { themePageClass } = useTheme()

const requestedPath = computed(() => {
  if (props.error?.url) {
    try { return new URL(props.error.url, 'http://x').pathname } catch { return props.error.url }
  }
  return import.meta.client ? window.location.pathname : '/'
})

function goHome() {
  clearError({ redirect: '/' })
}

useHead({ title: '404 — phareim.no' })
</script>


<style scoped>
/* ---- Root ---- */
.error-root {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--theme-font-body, 'Source Serif 4', Georgia, serif);
}

/* ---- Shared ---- */
.error-container {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 2rem;
  max-width: 600px;
  width: 100%;
}

/* ---- Almanac ---- */
.almanac-404-num {
  font-family: var(--theme-font-body, 'Source Serif 4', Georgia, serif);
  font-size: clamp(6rem, 20vw, 12rem);
  font-weight: 300;
  line-height: 1;
  margin: 0;
  color: var(--theme-card-border, rgba(0, 0, 0, 0.18));
  letter-spacing: -0.04em;
}

.almanac-title {
  font-family: var(--theme-font-body, 'Source Serif 4', Georgia, serif);
  font-size: clamp(1.4rem, 4vw, 2.2rem);
  font-weight: 400;
  margin: 0.5rem 0 0.75rem;
  color: var(--theme-text, #1a1a1a);
  letter-spacing: -0.01em;
}

.almanac-coords {
  font-family: monospace;
  font-size: 0.78rem;
  color: var(--theme-text-subtle, #888);
  letter-spacing: 0.08em;
  margin: 0 0 0.5rem;
}

.almanac-msg {
  color: var(--theme-text-muted, #555);
  font-style: italic;
  font-size: 0.95rem;
  margin: 0 0 2.5rem;
  line-height: 1.6;
}

.almanac-home-btn {
  background: transparent;
  border: none;
  color: var(--theme-text-muted, #555);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.5rem 0;
  position: relative;
  letter-spacing: 0.02em;
  border-bottom: 1px solid currentColor;
  transition: color 0.2s ease;
}

.almanac-home-btn:hover {
  color: var(--theme-accent, #c14a2a);
}

.almanac-home-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 4px;
}
</style>
