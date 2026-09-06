<template>
  <div :class="[themePageClass, 'error-root']">
    <component :is="theme.backdrop" v-if="theme.backdrop" />

    <!-- Hacker and Breakout themes (both neon-on-black, same block) -->
    <div v-if="activeTheme === 'hacker' || activeTheme === 'breakout' || activeTheme === 'rtype'" class="error-container hacker-container-inner">
      <p class="hacker-prompt">$ navigate --path {{ requestedPath }}</p>
      <p class="hacker-err">
        <span class="hacker-err-code">404</span>
        <span class="hacker-err-msg">FILE_NOT_FOUND</span>
      </p>
      <p class="hacker-prompt hacker-dim">$ the requested page does not exist in this system</p>
      <div class="hacker-prompt hacker-cmd-row">
        <button class="hacker-cmd-btn" @click="goHome">$ return --home<span class="cursor">_</span></button>
      </div>
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

    <!-- Tetris theme -->
    <div v-else-if="activeTheme === 'tetris'" class="error-container tetris-container-inner">
      <p class="tetris-404-num">404</p>
      <div class="tetris-cell-row" aria-hidden="true">
        <span class="tetris-cell"></span>
        <span class="tetris-cell"></span>
        <span class="tetris-cell"></span>
        <span class="tetris-cell"></span>
        <span class="tetris-cell"></span>
        <span class="tetris-cell"></span>
        <span class="tetris-cell"></span>
        <span class="tetris-cell tetris-cell-missing"></span>
        <span class="tetris-cell"></span>
        <span class="tetris-cell"></span>
      </div>
      <h1 class="tetris-title">GAME OVER</h1>
      <p class="tetris-msg"><em>{{ requestedPath }}</em> never stacked here</p>
      <button class="tetris-home-btn" @click="goHome">[ PRESS START ]</button>
    </div>

    <!-- Scandinavian (default) theme -->
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
  font-family: var(--theme-font-body, 'Comfortaa', system-ui, sans-serif);
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

/* ---- Hacker ---- */
.hacker-container-inner {
  text-align: left;
  font-family: monospace;
  padding: 2rem;
}

.hacker-prompt {
  color: var(--theme-text, #00ff41);
  font-family: monospace;
  font-size: 0.9rem;
  margin: 0.4rem 0;
  letter-spacing: 0.05em;
  animation: hacker-type-in 0.3s steps(20) forwards;
  opacity: 0;
}

.hacker-prompt:nth-child(1) { animation-delay: 0.1s; }
.hacker-prompt:nth-child(2) { animation-delay: 0.5s; }
.hacker-prompt:nth-child(3) { animation-delay: 0.9s; }
.hacker-prompt:nth-child(4) { animation-delay: 1.3s; }

@keyframes hacker-type-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}

.hacker-err {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin: 1rem 0;
  animation: hacker-type-in 0.3s steps(20) forwards;
  animation-delay: 0.5s;
  opacity: 0;
}

.hacker-err-code {
  font-size: clamp(3rem, 10vw, 6rem);
  font-family: monospace;
  color: var(--theme-accent, #00ff41);
  text-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
  line-height: 1;
  font-weight: bold;
}

.hacker-err-msg {
  font-family: monospace;
  font-size: 1rem;
  color: var(--hacker-accent, #ff0055);
  text-shadow: 0 0 10px currentColor;
  letter-spacing: 0.1em;
}

.hacker-dim {
  color: var(--theme-text-muted, #008F11);
}

.hacker-cmd-row {
  margin-top: 1.5rem;
}

.hacker-cmd-btn {
  background: transparent;
  border: none;
  color: var(--theme-text, #00ff41);
  font-family: monospace;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
  letter-spacing: 0.05em;
  text-shadow: 0 0 8px currentColor;
  animation: none;
  transition: text-shadow 0.2s;
}

.hacker-cmd-btn:hover {
  text-shadow: 0 0 16px currentColor, 0 0 32px currentColor;
}

.hacker-cmd-btn:focus-visible {
  outline: 1px solid var(--theme-text, #00ff41);
  outline-offset: 4px;
}

.cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

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
  font-family: monospace;
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

/* ---- Tetris ---- */
.tetris-container-inner {
  text-align: center;
}

.tetris-404-num {
  font-family: 'Courier New', monospace;
  font-size: clamp(3rem, 12vw, 6rem);
  font-weight: 400;
  line-height: 1;
  margin: 0;
  color: var(--theme-text, #F4F1FF);
  letter-spacing: 0.15em;
  text-shadow: 0 0 24px var(--theme-card-border);
}

.tetris-cell-row {
  display: flex;
  gap: 4px;
  justify-content: center;
  margin: 2rem 0;
  flex-wrap: wrap;
}

.tetris-cell {
  display: inline-block;
  width: 24px;
  height: 24px;
  background: #ff2fa022;
  border: 1px solid var(--tetris-pink);
  box-shadow: 0 0 8px #ff2fa044;
}

.tetris-cell-missing {
  background: transparent;
  box-shadow: none;
  border: 1px dashed rgba(244, 241, 255, 0.2);
}

.tetris-title {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 1rem 0;
  color: var(--tetris-pink);
  text-shadow: none;
}

.tetris-msg {
  font-family: system-ui, sans-serif;
  color: var(--theme-text-muted, #B4ADD9);
  font-size: 0.9rem;
  margin: 0 0 2.5rem;
  line-height: 1.6;
}

.tetris-home-btn {
  background: transparent;
  border: 2px solid var(--theme-accent, #FFD500);
  color: var(--theme-accent, #FFD500);
  font-family: 'Courier New', monospace;
  font-size: 0.6875rem;
  font-weight: 400;
  cursor: pointer;
  padding: 0.75rem 1.25rem;
  letter-spacing: 0.15em;
  transition: background-color 120ms, color 120ms;
}

.tetris-home-btn:hover {
  background: var(--theme-accent, #FFD500);
  color: var(--theme-bg, #15123A);
  box-shadow: 0 0 24px var(--theme-card-shadow);
}

.tetris-home-btn:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 4px;
}
</style>
