<template>
  <!-- HÅR: the styles as the figure's own head, then the colours
    (regnbue drawn in its stripes). -->
  <div class="fg-panel-body">
    <p class="fg-label"><FgIcon id="hair" :scale="2" />FRISYRE</p>
    <div class="fg-grid">
      <button
        v-for="h in HAIR_STYLES"
        :key="h.id"
        type="button"
        class="fg-tile"
        :class="{ 'fg-tile--on': body.hair === h.id }"
        :aria-label="h.name"
        :aria-pressed="body.hair === h.id"
        @click="set({ hair: h.id })"
      >
        <img class="fg-pic" :src="head(h.id)" alt="">
      </button>
    </div>

    <p class="fg-label"><FgIcon id="draw" :scale="2" />HÅRFARGE</p>
    <div class="fg-grid fg-grid--swatch">
      <button
        v-for="c in HAIR_COLORS"
        :key="c.id"
        type="button"
        class="fg-tile fg-swatch"
        :class="{ 'fg-tile--on': body.hairColor === c.color }"
        :aria-label="c.name"
        :aria-pressed="body.hairColor === c.color"
        @click="set({ hairColor: c.color })"
      >
        <span class="fg-swatch-fill" :style="{ background: c.color === 'rainbow' ? rainbow : c.color }" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { FigureBody, HairStyle } from '../types'
import { HAIR_STYLES, HAIR_COLORS, RAINBOW } from '../catalog'
import { useFigur } from '~/composables/useFigur'
import FgIcon from './FgIcon.vue'
import { headPic } from './pics'
import { FG_CTX } from './context'

const game = useFigur()
const ctx = inject(FG_CTX)!
const body = computed(() => game.active.value.body)

/** Hard stripes, top to bottom (no blend: the pixel look). */
const rainbow = `linear-gradient(${RAINBOW.map((c, i) => `${c} ${(i * 100) / RAINBOW.length}% ${((i + 1) * 100) / RAINBOW.length}%`).join(', ')})`

function set(patch: Partial<FigureBody>) {
  game.setBody(patch)
  ctx.sfx('pop')
}

/** The head with this hair and nothing on it (a hat would hide the hair). */
function head(hair: HairStyle): string {
  const f = game.active.value
  return headPic({ ...f, body: { ...f.body, hair }, outfit: { ...f.outfit, hat: null, face: null, back: null } }, game.closet.value, f.style)
}
</script>
