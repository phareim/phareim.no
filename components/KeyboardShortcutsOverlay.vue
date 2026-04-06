<template>
  <Teleport to="body">
    <Transition name="kbd-overlay">
      <div
        v-if="open"
        class="kbd-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
      >
        <div class="kbd-panel" tabindex="-1" ref="panelRef">
          <header class="kbd-header">
            <span class="kbd-title">keyboard shortcuts</span>
            <button class="kbd-close" @click="$emit('close')" aria-label="Close shortcuts">✕</button>
          </header>

          <div class="kbd-section">
            <div class="kbd-section-label">navigation</div>
            <div class="kbd-row">
              <kbd>M</kbd>
              <span>toggle menu</span>
            </div>
            <div class="kbd-row">
              <kbd>?</kbd>
              <span>show shortcuts</span>
            </div>
            <div class="kbd-row">
              <kbd>Esc</kbd>
              <span>close overlays</span>
            </div>
          </div>

          <div class="kbd-divider" aria-hidden="true"></div>

          <div class="kbd-section">
            <div class="kbd-section-label">themes</div>
            <div class="kbd-row">
              <kbd>1</kbd>
              <span>scandinavian glass</span>
              <span class="kbd-swatch" style="background: #6b8cae"></span>
            </div>
            <div class="kbd-row">
              <kbd>2</kbd>
              <span>cyberpunk</span>
              <span class="kbd-swatch" style="background: #00ff41"></span>
            </div>
            <div class="kbd-row">
              <kbd>3</kbd>
              <span>space</span>
              <span class="kbd-swatch" style="background: #89abd0"></span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const panelRef = ref<HTMLElement | null>(null)

watch(() => props.open, (val) => {
  if (val) {
    nextTick(() => panelRef.value?.focus())
  }
})
</script>

<style scoped>
.kbd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 1rem;
}

.kbd-panel {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.92));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
  border-radius: var(--theme-card-radius, 20px);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
  padding: 1.5rem 1.75rem 1.75rem;
  width: 100%;
  max-width: 320px;
  outline: none;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.kbd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.kbd-title {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
}

.kbd-close {
  background: none;
  border: none;
  font-size: 0.9rem;
  color: var(--theme-text-subtle, #aaa);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  line-height: 1;
  border-radius: 4px;
  transition: color 0.15s ease, background 0.15s ease;
}

.kbd-close:hover {
  color: var(--theme-text, #111);
  background: var(--theme-card-border, rgba(0, 0, 0, 0.08));
}

.kbd-close:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 2px;
}

/* ── Sections ────────────────────────────────────────────────── */

.kbd-section {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.kbd-section-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--theme-text-subtle, #bbb);
  margin-bottom: 0.2rem;
}

.kbd-divider {
  width: 100%;
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.08));
  margin: 1rem 0;
}

/* ── Rows ────────────────────────────────────────────────────── */

.kbd-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--theme-text-muted, #555);
  line-height: 1;
}

.kbd-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.8;
}

/* ── kbd element ─────────────────────────────────────────────── */

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6rem;
  height: 1.6rem;
  padding: 0 0.35rem;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--theme-text, #111);
  background: var(--theme-bg, #f5f5f3);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.15));
  border-radius: 5px;
  box-shadow: 0 1px 0 var(--theme-card-border, rgba(0, 0, 0, 0.2));
  flex-shrink: 0;
  line-height: 1;
}

/* ── Transitions ─────────────────────────────────────────────── */

.kbd-overlay-enter-active {
  transition: opacity 0.2s ease;
}
.kbd-overlay-leave-active {
  transition: opacity 0.15s ease;
}
.kbd-overlay-enter-from,
.kbd-overlay-leave-to {
  opacity: 0;
}

.kbd-overlay-enter-active .kbd-panel {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.kbd-overlay-leave-active .kbd-panel {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.kbd-overlay-enter-from .kbd-panel {
  opacity: 0;
  transform: scale(0.94) translateY(8px);
}
.kbd-overlay-leave-to .kbd-panel {
  opacity: 0;
  transform: scale(0.97);
}

/* ── Hacker theme overrides ─────────────────────────────────── */

:global(.hacker-page) .kbd-panel {
  border-radius: 0;
  box-shadow: 0 0 30px var(--theme-card-shadow, rgba(0, 255, 65, 0.15));
}

:global(.hacker-page) kbd {
  border-radius: 0;
  font-family: monospace;
  color: var(--theme-text, #00ff41);
  background: rgba(0, 20, 0, 0.9);
  border-color: var(--theme-accent, #00ff41);
  box-shadow: 0 0 6px rgba(0, 255, 65, 0.3);
}

:global(.hacker-page) .kbd-title,
:global(.hacker-page) .kbd-section-label {
  font-family: monospace;
}

:global(.hacker-page) .kbd-row {
  font-family: monospace;
}

:global(.hacker-page) .kbd-close {
  font-family: monospace;
}

/* ── Space theme overrides ──────────────────────────────────── */

:global(.space-page) .kbd-panel {
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(140, 170, 220, 0.15);
}

:global(.space-page) kbd {
  background: rgba(15, 15, 30, 0.8);
  border-color: rgba(140, 170, 220, 0.25);
  box-shadow: 0 1px 0 rgba(140, 170, 220, 0.15), inset 0 1px 0 rgba(140, 170, 220, 0.05);
}
</style>
