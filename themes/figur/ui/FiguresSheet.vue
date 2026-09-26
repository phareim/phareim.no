<template>
  <!-- MINE FIGURER: every figure as a picture in its own style. Tap one to
    play with it, + NY FIGUR for a new one, the trash can asks first. -->
  <Sheet title="MINE FIGURER" icon="figures" @close="$emit('close')">
    <div class="fg-grid fg-figs">
      <div v-for="f in game.save.value.figures" :key="f.id" class="fg-fig">
        <button
          type="button"
          class="fg-tile fg-fig-tile"
          :class="{ 'fg-tile--on': f.id === game.active.value.id }"
          :aria-pressed="f.id === game.active.value.id"
          @click="choose(f.id)"
        >
          <img class="fg-fig-pic" :src="figurePic(f, game.closet.value, f.style)" alt="">
          <span class="fg-tile-name">{{ f.name }}</span>
        </button>
        <button
          v-if="game.save.value.figures.length > 1"
          type="button"
          class="px-btn fg-btn fg-btn--plain fg-trash"
          :aria-label="`Slett ${f.name}`"
          @click="remove(f.id, f.name)"
        >
          <FgIcon id="trash" :scale="2" />
        </button>
      </div>
    </div>
    <p v-if="full" class="fg-p fg-dim fg-full">{{ fullText }}</p>
    <template #footer>
      <button type="button" class="px-btn fg-btn fg-btn--go" :disabled="full" @click="add">
        <FgIcon id="plus" :scale="2" />NY FIGUR
      </button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { MAX_FIGURES } from '../types'
import { SAVE_ERROR_TEXT } from '../core/save'
import { useFigur } from '~/composables/useFigur'
import Sheet from './Sheet.vue'
import FgIcon from './FgIcon.vue'
import { figurePic } from './pics'
import { FG_CTX } from './context'

const emit = defineEmits<{ close: [] }>()
const game = useFigur()
const ctx = inject(FG_CTX)!
const full = computed(() => game.save.value.figures.length >= MAX_FIGURES)
const fullText = SAVE_ERROR_TEXT.full

function choose(id: string) {
  game.setActive(id)
  ctx.sfx('pop')
  emit('close')
}

function add() {
  const r = game.addFigure()
  if (!r.ok) { ctx.say(r.message); ctx.sfx('no'); return }
  ctx.sfx('sparkle')
  emit('close')
}

function remove(id: string, name: string) {
  ctx.ask(`Vil du slette ${name}?`, () => {
    const r = game.removeFigure(id)
    if (!r.ok) ctx.say(r.message)
    else ctx.sfx('whoosh')
  })
}
</script>

<style scoped>
.fg-root .fg-grid.fg-figs { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
.fg-fig { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.fg-fig-tile { padding: 8px 4px; }
.fg-fig-pic {
  display: block;
  width: 100%;
  height: 96px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
}
.fg-root .px-btn.fg-btn.fg-trash { min-height: 44px; width: 100%; padding: 0; }
.fg-full { margin-top: 12px; }
</style>
