<template>
  <!-- TEGN: pick what to draw (each a picture of that kind of piece),
    then the child's own clothes: tap one to draw on it again. -->
  <div class="fg-panel-body">
    <p class="fg-label"><FgIcon id="pencil" :scale="2" />HVA VIL DU TEGNE?</p>
    <div class="fg-grid">
      <button
        v-for="t in DRAW_TEMPLATES"
        :key="t.kind"
        type="button"
        class="fg-tile"
        @click="start(t.kind)"
      >
        <img class="fg-pic" :src="templatePic(t.kind)" alt="">
        <span class="fg-tile-name">{{ t.name }}</span>
      </button>
    </div>

    <template v-if="mine.length">
      <p class="fg-label"><FgIcon id="star" :scale="2" />MINE KLÆR</p>
      <div class="fg-grid">
        <div v-for="d in mine" :key="d.id" class="fg-mine">
          <button type="button" class="fg-tile" :aria-label="`Tegn på ${d.name}`" @click="edit(d.id)">
            <img class="fg-pic" :src="drawnPic(d)" alt="">
            <span class="fg-tile-name">{{ d.name }}</span>
          </button>
          <button type="button" class="px-btn fg-btn fg-btn--plain fg-trash" :aria-label="`Slett ${d.name}`" @click="remove(d.id, d.name)">
            <FgIcon id="trash" :scale="2" />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { GarmentKind } from '../types'
import { DRAW_TEMPLATES, GARMENTS } from '../catalog'
import { drawnTexture, garmentTexture } from '../core/textures'
import { useFigur } from '~/composables/useFigur'
import FgIcon from './FgIcon.vue'
import { drawnPic, texturePic } from './pics'
import { FG_CTX } from './context'

const game = useFigur()
const ctx = inject(FG_CTX)!
const mine = computed(() => game.closet.value.slice().reverse())

/** The kind's picture: its first built-in piece in pale lilac with white, so it reads as "blank". */
function templatePic(kind: GarmentKind): string {
  const def = GARMENTS.find(d => d.kind === kind)
  if (!def) return ''
  const pair = kind === 'sneaker' || kind === 'boot' || kind === 'flat'
  return texturePic(garmentTexture(def, '#d6b3ff', '#ffffff'), pair)
}

function start(kind: GarmentKind) {
  ctx.sfx('pop')
  ctx.openBoard({ kind })
}

function edit(id: string) {
  const d = game.closet.value.find(x => x.id === id)
  if (!d) return
  ctx.sfx('pop')
  ctx.openBoard({ kind: d.kind, tex: drawnTexture(d) ?? undefined, editId: d.id, name: d.name })
}

function remove(id: string, name: string) {
  ctx.ask(`Vil du slette ${name}?`, () => {
    game.deleteDrawn(id)
    ctx.sfx('whoosh')
  })
}
</script>

<style scoped>
.fg-mine { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.fg-root .px-btn.fg-btn.fg-trash { min-height: 44px; width: 100%; padding: 0; }
</style>
