<template>
  <!-- One panel over the studio: the pixel look's box, centred, never
    taller than the view. The body scrolls inside; the page never does. -->
  <div class="fg-sheet-layer" @pointerdown.self="$emit('close')">
    <section
      class="px-box fg-box fg-sheet"
      :class="{ 'fg-sheet--narrow': narrow }"
      role="dialog"
      :aria-label="title"
    >
      <header class="fg-sheet-head">
        <FgIcon v-if="icon" :id="icon" :scale="3" />
        <h2 class="fg-sheet-title">{{ title }}</h2>
        <button type="button" class="px-btn fg-btn fg-btn--plain fg-btn--square" aria-label="Lukk" @click="$emit('close')">
          <FgIcon id="close" :scale="2" />
        </button>
      </header>
      <div class="fg-sheet-body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="fg-sheet-foot">
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import FgIcon from './FgIcon.vue'
import type { IconId } from './icons'

defineProps<{ title: string; icon?: IconId; narrow?: boolean }>()
defineEmits<{ close: [] }>()
</script>

<style scoped>
.fg-sheet-layer {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(12px, env(safe-area-inset-top, 0px))
    max(12px, env(safe-area-inset-right, 0px))
    calc(12px + var(--app-safe-bottom, 0px) + var(--fg-kb, 0px))
    max(12px, env(safe-area-inset-left, 0px));
  background: rgba(42, 23, 68, 0.32);
}
.fg-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: 100%;
  min-height: 0;
}
.fg-sheet--narrow { max-width: 420px; }
.fg-sheet { animation: fg-in 150ms ease-out; }
.fg-sheet-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 8px 14px;
  flex: none;
}
.fg-sheet-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 24px;
  line-height: 1.25;
  font-weight: 400;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fg-sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 6px 14px 14px;
  touch-action: pan-y;
}
.fg-sheet-foot {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  align-items: center;
  padding: 10px 14px 14px;
  border-top: 3px solid var(--fg-grey);
}
@media (max-width: 440px) {
  .fg-sheet-title { font-size: 16px; }
}
</style>
