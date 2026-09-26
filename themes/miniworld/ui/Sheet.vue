<template>
  <!-- One panel: Neon Shrine's dialog box in daylight, centred, never
    taller than the view. The body scrolls inside; the page never does. -->
  <div class="mw-sheet-layer">
    <section
      class="px-box mw-box mw-sheet"
      :class="{ 'mw-sheet--wide': wide, 'mw-sheet--narrow': narrow, 'mw-sheet--tall': tall }"
      role="dialog"
      :aria-label="title"
    >
      <header class="mw-sheet-head">
        <button v-if="back" type="button" class="px-btn mw-btn mw-btn--plain mw-sheet-x" aria-label="Tilbake" @click="$emit('back')">◀</button>
        <PxIcon v-if="icon" :id="icon" :scale="3" />
        <h2 class="mw-sheet-title" :class="{ 'mw-sheet-title--long': title.length > 10 }">{{ title }}</h2>
        <span v-if="bits !== undefined" class="mw-sheet-bits" aria-label="Bits">
          <PxIcon id="coin" :scale="2" />{{ bits }}
        </span>
        <button v-if="closable" type="button" class="px-btn mw-btn mw-btn--plain mw-sheet-x" aria-label="Lukk" @click="$emit('close')">
          <PxIcon id="close" :scale="2" />
        </button>
      </header>
      <div ref="bodyRef" class="mw-sheet-body" :class="{ 'mw-sheet-body--flat': flat }">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="mw-sheet-foot">
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PxIcon from './PxIcon.vue'
import type { IconId } from './icons'

withDefaults(defineProps<{
  title: string
  icon?: IconId
  closable?: boolean
  back?: boolean
  wide?: boolean
  narrow?: boolean
  /** Show the wallet in the header (shops, workshop, gifts). */
  bits?: number
  /** No inner padding (games that lay out their own body). */
  flat?: boolean
  /** As tall as the view allows (games that fit a grid to the space). */
  tall?: boolean
}>(), { closable: true })

defineEmits<{ close: []; back: [] }>()

const bodyRef = ref<HTMLElement | null>(null)
defineExpose({ bodyRef })
</script>

<style scoped>
.mw-sheet-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(10px, env(safe-area-inset-top, 0px))
    max(10px, env(safe-area-inset-right, 0px))
    calc(10px + var(--app-safe-bottom, 0px) + var(--mw-kb, 0px))
    max(10px, env(safe-area-inset-left, 0px));
  background: rgba(42, 31, 74, 0.28);
  pointer-events: auto;
}
.mw-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  max-height: 100%;
  min-height: 0;
}
.mw-sheet--wide { max-width: 820px; }
.mw-sheet--narrow { max-width: 440px; }
.mw-sheet--tall { height: 100%; max-width: 900px; }
.mw-sheet-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 8px 14px;
  flex: none;
}
.mw-sheet-title {
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
.mw-sheet-bits {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  padding: 0 4px;
}
.mw-root .px-btn.mw-btn.mw-sheet-x { padding: 0; width: 48px; flex: none; }
.mw-sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 6px 14px 14px;
  touch-action: pan-y;
}
.mw-sheet-body--flat { padding: 0 8px 8px; }
.mw-sheet-foot {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  align-items: center;
  padding: 10px 14px 14px;
  border-top: 3px solid var(--mw-grey);
}
@media (max-width: 440px) {
  .mw-sheet-title--long { font-size: 16px; }
}
@media (max-height: 420px) {
  .mw-sheet-head { padding: 6px 8px 4px 12px; }
  .mw-sheet-foot { padding: 6px 12px 8px; }
}
</style>
