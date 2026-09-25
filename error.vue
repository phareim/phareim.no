<template>
  <div :class="[themePageClass, 'error-root']">
    <component :is="theme.backdrop" v-if="theme.backdrop" />

    <!-- The portal and every live game: the road out of town ends at a
      signpost (LostScene, on the pixel stage) and Neon Shrine's dialog box
      says so. A 404 has no ?theme, so it is usually the portal's. -->
    <template v-if="pixel">
      <LostScene />
      <div class="error-container lost-box px-box" role="alert">
        <h1 class="lost-title">404</h1>
        <p class="lost-line">NO ROAD TO <span class="lost-path">{{ requestedPath }}</span></p>
        <p class="lost-line lost-dim">THE PATH ENDS HERE.</p>
        <button class="px-btn lost-btn" @click="goHome">▶ BACK TO TOWN</button>
      </div>
    </template>

    <!-- Another Shore II: a frame with nothing in it -->
    <div v-else-if="activeTheme === 'shore'" class="error-container shore2-error">
      <p class="shore2-chapter">404 / off the edge of the frame</p>
      <h1>No shot here.</h1>
      <p>{{ requestedPath }} is past the last edge.</p>
      <button @click="goHome">walk back</button>
    </div>

    <!-- Space theme -->
    <div v-else-if="activeTheme === 'space'" class="error-container space-container-inner">
      <p class="space-404-num">404</p>
      <h1 class="space-title">LOST IN SPACE</h1>
      <p class="space-coords">{{ requestedPath }}</p>
      <p class="space-msg">this sector of space is uncharted</p>
      <button class="space-home-btn" @click="goHome">→ return to base</button>
    </div>

    <!-- Tufte Desk theme -->
    <div v-else-if="activeTheme === 'desk'" class="error-container desk-container-inner">
      <div class="desk-sheet-stack">
        <div class="desk-sheet desk-err-sheet">
          <p class="desk-label">{{ requestedPath }}</p>
          <hr class="desk-rule" />
          <h1 class="desk-err-title">Not on this desk</h1>
          <p class="desk-err-msg">No sheet answers to that address.</p>
          <button class="desk-err-btn" @click="goHome">← back to the front page</button>
          <span class="desk-stamp desk-err-stamp" aria-hidden="true">404<br />not found</span>
        </div>
      </div>
    </div>

    <!-- Scandinavian Glass (parked) -->
    <div v-else class="error-container scandi-container-inner">
      <p class="scandi-404-num">404</p>
      <h1 class="scandi-title">drifted off course</h1>
      <p class="scandi-msg">the page you're looking for isn't here</p>
      <button class="scandi-home-btn" @click="goHome">← back home</button>
    </div>

  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  error: Object
})

const { theme, activeTheme, themePageClass } = useTheme()

/** The parked themes keep their own 404 blocks; everything else gets the pixel one. */
const OWN_BLOCK = ['shore', 'space', 'desk', 'scandi']
const pixel = computed(() => !OWN_BLOCK.includes(activeTheme.value))

const requestedPath = computed(() => {
  if (props.error?.url) {
    try { return new URL(props.error.url, 'http://x').pathname } catch { return props.error.url }
  }
  return import.meta.client ? window.location.pathname : '/'
})

/** Every 404 leads back to the portal. */
function goHome() {
  clearError({ redirect: '/' })
}

useHead({ title: '404 — phareim.no' })
</script>


<style scoped>
.shore2-error { text-align: left; color: var(--theme-text); }
.shore2-chapter { font: 11px var(--font-machine); letter-spacing: 0.28em; text-transform: uppercase; color: var(--theme-accent); margin: 0 0 8px; }
.shore2-error h1 { font-weight: 300; font-size: clamp(2rem, 6vw, 3.5rem); margin: 0 0 0.5rem; }
.shore2-error p { font-weight: 300; color: var(--theme-text-muted); }
.shore2-error button { background: transparent; color: var(--theme-accent); border: 0; border-bottom: 1px solid currentColor; padding: 0.6rem 0; font: 12px var(--font-machine); letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
.shore2-error button:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 5px; }
/* ---- Root ---- */
.error-root {
  position: relative;
  min-height: 100vh;
  min-height: var(--app-height, 100dvh);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--theme-font-body, var(--font-person));
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

/* ---- Scandinavian ---- */
.scandi-404-num {
  font-size: clamp(6rem, 20vw, 12rem);
  font-weight: 300;
  line-height: 1;
  margin: 0;
  color: var(--theme-card-border, rgba(0,0,0,0.12));
  letter-spacing: -0.04em;
  animation: scandi-float 6s ease-in-out infinite;
}

.scandi-title {
  font-size: clamp(1.4rem, 4vw, 2.2rem);
  font-weight: 400;
  margin: 0.5rem 0 1rem;
  color: var(--theme-text, #111);
  letter-spacing: -0.01em;
}

.scandi-msg {
  color: var(--theme-text-muted, #666);
  font-size: 0.95rem;
  margin: 0 0 2.5rem;
  line-height: 1.6;
}

.scandi-home-btn {
  background: transparent;
  border: none;
  color: var(--theme-text-muted, #666);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.5rem 0;
  position: relative;
  letter-spacing: 0.02em;
  transition: color 0.3s ease;
}

.scandi-home-btn::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.3s ease;
}

.scandi-home-btn:hover {
  color: var(--theme-text, #111);
}

.scandi-home-btn:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}

.scandi-home-btn:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 4px;
  border-radius: 2px;
}

@keyframes scandi-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* ---- Pixel 404 (the portal and the live games) ---- */
/* The box sits in the sky, so the path and its sign show below it. */
.error-root:has(.lost-box) {
  align-items: flex-start;
  padding-top: max(12vh, 64px);
  box-sizing: border-box;
}

.lost-box {
  z-index: 1;
  width: min(360px, calc(100vw - 40px));
  box-sizing: border-box;
  padding: 20px 20px 18px;
  text-align: center;
  color: #f2e9ff;
  text-shadow: 2px 2px 0 #0b0616;
}

.lost-title {
  margin: 0 0 12px;
  font: 400 64px/1 var(--font-pixel);
  color: #ff2fa0;
  text-shadow: 8px 8px 0 #0b0616;
}

.lost-line {
  margin: 0 0 8px;
  font-size: 16px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.lost-path { color: #2ff3ff; }
.lost-dim { color: #b9a8d9; }
.lost-btn { margin-top: 12px; }

/* ---- Tufte Desk ---- */
.desk-container-inner {
  text-align: left;
  max-width: 34rem;
}

.desk-err-sheet {
  padding: 2rem 2.25rem 5rem;
}

.desk-err-title {
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
  color: var(--theme-text, #111);
}

.desk-err-msg {
  color: var(--theme-text-muted, #6b675d);
  margin: 0 0 2rem;
  line-height: 1.55;
}

.desk-err-btn {
  background: transparent;
  border: none;
  padding: 0.25rem 0;
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--theme-text, #111);
  border-bottom: 1px solid var(--theme-card-border, #d6cfc0);
  cursor: pointer;
}

.desk-err-btn:hover,
.desk-err-btn:focus-visible {
  color: var(--theme-accent, #c1351d);
  border-color: currentColor;
  outline: none;
}

.desk-err-stamp {
  position: absolute;
  right: 1.5rem;
  bottom: 1.25rem;
}

/* ---- Space ---- */
.space-container-inner {
  text-align: center;
}

.space-404-num {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-size: clamp(6rem, 22vw, 14rem);
  font-weight: 900;
  line-height: 1;
  margin: 0;
  color: var(--theme-text, #fff);
  letter-spacing: -0.04em;
  text-shadow:
    0 0 40px rgba(140, 170, 220, 0.4),
    0 0 80px rgba(140, 170, 220, 0.2);
  animation: space-pulse 4s ease-in-out infinite;
}

@keyframes space-pulse {
  0%, 100% { text-shadow: 0 0 40px rgba(140,170,220,0.4), 0 0 80px rgba(140,170,220,0.2); }
  50%       { text-shadow: 0 0 60px rgba(140,170,220,0.6), 0 0 120px rgba(140,170,220,0.3); }
}

.space-title {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-size: clamp(1.2rem, 4vw, 2rem);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0.25rem 0 0.75rem;
  color: var(--theme-text, #fff);
}

.space-coords {
  font-family: var(--font-machine);
  font-size: 0.75rem;
  color: var(--theme-text-subtle, #5a6080);
  letter-spacing: 0.1em;
  margin: 0 0 0.5rem;
}

.space-msg {
  color: var(--theme-text-muted, #a0a8c0);
  font-size: 0.9rem;
  margin: 0 0 2.5rem;
  letter-spacing: 0.05em;
}

.space-home-btn {
  background: transparent;
  border: 1px solid var(--space-border, rgba(140,170,220,0.2));
  color: var(--theme-text, #fff);
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  cursor: pointer;
  padding: 0.75rem 2rem;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.space-home-btn:hover {
  background: rgba(140, 170, 220, 0.1);
  border-color: var(--space-accent-blue, #89abd0);
  box-shadow: 0 0 20px rgba(140, 170, 220, 0.2);
}

.space-home-btn:focus-visible {
  outline: 2px solid var(--space-accent-blue, #89abd0);
  outline-offset: 4px;
}

</style>
