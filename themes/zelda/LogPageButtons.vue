<!-- The three places to press on the menu's LOG page, which is painted on the canvas (`render/logPage.ts`): a bare
  button over OLDER, NEWER (each only where there is such a page) and the DEV MODE row, placed where the page laid
  them. As the other pages' buttons, they take a pointer's press at once and keep no focus from it; reached by Tab
  they own Enter, Space and Tab only (`data-game-keys`, input.ts). -->
<template>
  <button
    v-for="b in buttons"
    :key="b.id"
    type="button"
    class="zelda-log-button"
    :style="b.style"
    data-game-keys
    :aria-label="b.label"
    :aria-pressed="b.id === 'dev' ? dev : undefined"
    :aria-keyshortcuts="b.keys"
    @pointerdown.prevent="press(b.id, $event)"
    @mousedown.prevent
    @click="$event.detail === 0 && act(b.id)"
    @keydown="noRepeat"
    @contextmenu.prevent
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LogTargets } from './render/renderer'

const props = defineProps<{ at: LogTargets; dev: boolean }>()
const emit = defineEmits<{ older: []; newer: []; dev: [] }>()

type Id = 'newer' | 'older' | 'dev'
const NAMES: Record<Id, { label: string; keys: string }> = {
  newer: { label: 'Newer changes', keys: 'ArrowUp' },
  older: { label: 'Older changes', keys: 'ArrowDown' },
  dev: { label: 'Dev mode', keys: 'D' },
}
const buttons = computed(() => (['newer', 'older', 'dev'] as const).flatMap((id) => {
  const b = props.at[id]
  return b ? [{ id, ...NAMES[id], style: { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` } }] : []
}))

function act(id: Id) {
  if (id === 'newer') emit('newer')
  else if (id === 'older') emit('older')
  else emit('dev')
}
/** (The click that follows a pointer is not a second press.) */
function press(id: Id, e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  act(id)
}
function noRepeat(e: KeyboardEvent) {
  if (e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) e.preventDefault()
}
</script>

<style scoped>
.zelda-log-button {
  position: absolute;
  z-index: 4;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  color: transparent;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.zelda-log-button:focus { outline: none; }
.zelda-log-button:focus-visible { outline: 2px solid #ffd23f; outline-offset: -2px; }
</style>
