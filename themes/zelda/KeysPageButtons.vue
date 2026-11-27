<!-- The places to press on the menu's KEYS page, which is painted on the canvas (`render/keysPage.ts`): a bare button
  over each row on screen, RESET ALL and MORE, placed where the page laid them. As the other pages' buttons, they take
  a pointer's press at once and keep no focus from it; reached by Tab they own Enter, Space and Tab only
  (`data-game-keys`, input.ts). -->
<template>
  <button
    v-for="b in buttons"
    :key="b.id"
    type="button"
    class="zelda-key-row"
    :style="b.style"
    data-game-keys
    :aria-label="b.label"
    @pointerdown.prevent="press(b.id, $event)"
    @mousedown.prevent
    @click="$event.detail === 0 && emit('press', b.id)"
    @keydown="noRepeat"
    @contextmenu.prevent
  />
</template>

<script setup lang="ts">
import type { KeyButton } from './keysShell'

defineProps<{ buttons: KeyButton[] }>()
const emit = defineEmits<{ press: [id: number | 'more'] }>()

/** (The click that follows a pointer is not a second press.) */
function press(id: number | 'more', e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  emit('press', id)
}
function noRepeat(e: KeyboardEvent) {
  if (e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) e.preventDefault()
}
</script>

<style scoped>
.zelda-key-row {
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
.zelda-key-row:focus { outline: none; }
.zelda-key-row:focus-visible { outline: 2px solid #ffd23f; outline-offset: -2px; }
</style>
